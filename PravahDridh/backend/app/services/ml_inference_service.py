import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.atm import ATMLocation
from app.models.transaction import SuspiciousTransaction
from app.models.prediction import RiskPrediction
from app.models.model_run import ModelRun
from app.models.alert import Alert
from app.ml.feature_builder import FeatureBuilder
from app.ml.model_store import ModelStore
from app.services.risk_engine import RiskEngine
from app.services.geospatial_service import GeospatialService
from app.services.audit_service import AuditService
from app.schemas.prediction import RiskPredictionRead


class MLInferenceService:
    """
    Production ML Inference Service for ATM Cash-Out Risk Forecasting.
    Uses unified FeatureBuilder, active trained Model artifact, and RiskEngine.
    """

    @classmethod
    async def run_batch_inference(
        cls,
        db: AsyncSession,
        window_hours: int = 24,
        min_risk_threshold: float = 0.30,
        model_version: Optional[str] = None,
        prediction_time: Optional[datetime] = None,
    ) -> List[RiskPrediction]:
        now = prediction_time or datetime.now(timezone.utc)
        window_end = now + timedelta(hours=window_hours)

        # 1. Fetch active production model record or fallback to local production artifact
        model_query = select(ModelRun)
        if model_version:
            model_query = model_query.where(ModelRun.model_version == model_version)
        else:
            model_query = model_query.where(ModelRun.is_production == True)

        result = await db.execute(model_query)
        model_run = result.scalars().first()

        artifact_path = None
        ver_str = None

        if model_run and model_run.artifact_path and os.path.exists(model_run.artifact_path):
            artifact_path = model_run.artifact_path
            ver_str = model_run.model_version
        else:
            # Check production v2.0 artifact first, then legacy fallback
            prod_v2_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "production-v2.0.joblib"))
            default_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "rf-v1.0.joblib"))
            if os.path.exists(prod_v2_path):
                artifact_path = prod_v2_path
                ver_str = "v2.0"
            elif os.path.exists(default_path):
                artifact_path = default_path
                ver_str = "rf-v1.0"
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="No production ML model artifact available. Please train or register a model first.",
                )

        active_model = ModelStore.get_model(artifact_path)
        if active_model is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to load ML model artifact from {artifact_path}.",
            )

        # 2. Get active candidate ATMs
        atm_result = await db.execute(select(ATMLocation).where(ATMLocation.is_active == True))
        atms = atm_result.scalars().all()
        if not atms:
            return []

        # 3. Query historical transactions strictly before `now` (last 30 days)
        cutoff_30d = now - timedelta(days=30)
        tx_result = await db.execute(
            select(SuspiciousTransaction).where(
                and_(
                    SuspiciousTransaction.occurred_at >= cutoff_30d,
                    SuspiciousTransaction.occurred_at < now  # Strict temporal cutoff
                )
            )
        )
        historical_txs = tx_result.scalars().all()

        predictions_to_insert = []

        # 4. Extract features & infer probability for each candidate ATM
        for atm in atms:
            feat_vec = FeatureBuilder.compute_features_from_history(
                atm_lat=atm.latitude,
                atm_lon=atm.longitude,
                prediction_time=now,
                historical_transactions=historical_txs,
                all_atms=atms,
            )

            # Predict probability using real model
            try:
                prob = float(active_model.predict_proba(feat_vec.reshape(1, -1))[0, 1])
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Model inference failed on feature vector: {exc}",
                )

            # Extract actual feature metrics for rule evaluation and explainability
            tx_count_24h = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("recent_activity_count_24h")])
            max_amount_24h = float(feat_vec[FeatureBuilder.FEATURE_NAMES.index("max_single_amount_24h")])
            mule_count = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("connected_mule_accounts_count")])
            incidents_500m = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("historical_incident_count_500m")])
            cashouts_30d = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")])
            hours_since = float(feat_vec[FeatureBuilder.FEATURE_NAMES.index("hours_since_last_activity")])

            is_night_weekend = (now.hour >= 22 or now.hour <= 4 or now.weekday() in [5, 6])
            
            # Domain Rules R01 - R06
            rule_score, rule_reasons = RiskEngine.evaluate_rules(
                tx_count_24h=tx_count_24h,
                max_single_amount=max_amount_24h,
                is_mule_account=(mule_count > 0),
                historical_incidents_500m=incidents_500m,
                is_night_weekend=is_night_weekend,
                is_pattern_match=(cashouts_30d > 0 or (tx_count_24h >= 2 and max_amount_24h >= 30000)),
            )

            # Composite Risk Calculation
            days_since = hours_since / 24.0
            reasons = rule_reasons if rule_reasons else [f"Monitoring baseline: {atm.bank_name} in {atm.city}"]
            
            risk_result = RiskEngine.compute_composite_risk(
                ml_score=prob,
                rule_score=rule_score,
                days_since_incident=days_since,
                reasons=reasons,
            )

            # Filter by threshold for active alerts and prioritization
            if risk_result["risk_score"] >= min_risk_threshold:
                prediction_obj = RiskPrediction(
                    model_version=ver_str,
                    location_id=atm.id,
                    latitude=atm.latitude,
                    longitude=atm.longitude,
                    risk_score=risk_result["risk_score"],
                    severity=risk_result["severity"],
                    confidence=risk_result["confidence"],
                    predicted_window_start=now,
                    predicted_window_end=window_end,
                    reasons=risk_result["reasons"],
                    model_run_id=model_run.id if model_run else None,
                    is_active=True,
                )
                db.add(prediction_obj)
                predictions_to_insert.append(prediction_obj)

                # Generate alert for HIGH and CRITICAL risk (deduplicate by prediction/event + overlapping window)
                if risk_result["severity"] in ["HIGH", "CRITICAL"]:
                    existing_alert_stmt = (
                        select(Alert)
                        .join(RiskPrediction, Alert.prediction_id == RiskPrediction.id)
                        .where(
                            RiskPrediction.location_id == atm.id,
                            Alert.status.in_(["open", "assigned"]),
                            RiskPrediction.predicted_window_start <= window_end,
                            RiskPrediction.predicted_window_end >= now,
                        )
                    )
                    existing_alert_res = await db.execute(existing_alert_stmt)
                    existing_alert = existing_alert_res.scalars().first()

                    if not existing_alert:
                        alert_obj = Alert(
                            prediction=prediction_obj,
                            severity=risk_result["severity"],
                            status="open",
                        )
                        db.add(alert_obj)
                        await db.flush()

                        await AuditService.log_event(
                            db=db,
                            event_type="ALERT_GENERATE",
                            actor=None,
                            resource_type="Alert",
                            resource_id=alert_obj.id,
                            action_details={
                                "prediction_id": str(prediction_obj.id),
                                "atm_id": str(atm.id),
                                "atm_code": atm.atm_code,
                                "severity": alert_obj.severity,
                                "risk_score": float(risk_result["risk_score"]),
                                "confidence": float(risk_result["confidence"]),
                                "model_version": ver_str,
                                "reasons": risk_result["reasons"][:3] if risk_result["reasons"] else [],
                            },
                        )

        await db.commit()
        return predictions_to_insert

    @classmethod
    async def run_live_inference_readonly(
        cls,
        db: AsyncSession,
        window_hours: int = 24,
        min_risk_threshold: float = 0.0,
        city: Optional[str] = None,
        model_version: Optional[str] = None,
        limit: int = 50,
    ) -> List[RiskPredictionRead]:
        """
        Execute real-time ML inference using PostgreSQL ATM locations and transaction history.
        Strictly read-only — does not mutate or commit to database.
        Returns sorted RiskPredictionRead items with full transparency.
        """
        now = datetime.now(timezone.utc)
        window_end = now + timedelta(hours=window_hours)

        # 1. Fetch active production model record or fallback to local production artifact
        model_query = select(ModelRun)
        if model_version:
            model_query = model_query.where(ModelRun.model_version == model_version)
        else:
            model_query = model_query.where(ModelRun.is_production == True)

        result = await db.execute(model_query)
        model_run = result.scalars().first()

        artifact_path = None
        ver_str = None

        if model_run and model_run.artifact_path and os.path.exists(model_run.artifact_path):
            artifact_path = model_run.artifact_path
            ver_str = model_run.model_version
        else:
            prod_v2_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "production-v2.0.joblib"))
            default_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "rf-v1.0.joblib"))
            if os.path.exists(prod_v2_path):
                artifact_path = prod_v2_path
                ver_str = "v2.0"
            elif os.path.exists(default_path):
                artifact_path = default_path
                ver_str = "rf-v1.0"
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="No production ML model artifact available. Please train or register a model first.",
                )

        active_model = ModelStore.get_model(artifact_path)
        if active_model is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to load ML model artifact from {artifact_path}.",
            )

        # 2. Get active candidate ATMs from PostgreSQL
        atm_query = select(ATMLocation).where(ATMLocation.is_active == True)
        if city:
            atm_query = atm_query.where(ATMLocation.city == city)
        atm_result = await db.execute(atm_query)
        atms = atm_result.scalars().all()
        if not atms:
            return []

        # 3. Query historical transactions strictly before `now` (last 30 days) from PostgreSQL
        cutoff_30d = now - timedelta(days=30)
        tx_result = await db.execute(
            select(SuspiciousTransaction).where(
                and_(
                    SuspiciousTransaction.occurred_at >= cutoff_30d,
                    SuspiciousTransaction.occurred_at < now
                )
            )
        )
        historical_txs = tx_result.scalars().all()

        live_predictions: List[RiskPredictionRead] = []

        # 4. Feature engineering & model scoring
        for atm in atms:
            feat_vec = FeatureBuilder.compute_features_from_history(
                atm_lat=atm.latitude,
                atm_lon=atm.longitude,
                prediction_time=now,
                historical_transactions=historical_txs,
                all_atms=atms,
            )

            try:
                prob = float(active_model.predict_proba(feat_vec.reshape(1, -1))[0, 1])
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Model inference failed on feature vector: {exc}",
                )

            tx_count_24h = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("recent_activity_count_24h")])
            max_amount_24h = float(feat_vec[FeatureBuilder.FEATURE_NAMES.index("max_single_amount_24h")])
            mule_count = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("connected_mule_accounts_count")])
            incidents_500m = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("historical_incident_count_500m")])
            cashouts_30d = int(feat_vec[FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")])
            hours_since = float(feat_vec[FeatureBuilder.FEATURE_NAMES.index("hours_since_last_activity")])

            is_night_weekend = (now.hour >= 22 or now.hour <= 4 or now.weekday() in [5, 6])

            # Domain Rules R01 - R06
            rule_score, rule_reasons = RiskEngine.evaluate_rules(
                tx_count_24h=tx_count_24h,
                max_single_amount=max_amount_24h,
                is_mule_account=(mule_count > 0),
                historical_incidents_500m=incidents_500m,
                is_night_weekend=is_night_weekend,
                is_pattern_match=(cashouts_30d > 0 or (tx_count_24h >= 2 and max_amount_24h >= 30000)),
            )

            days_since = hours_since / 24.0
            reasons = rule_reasons if rule_reasons else [f"Monitoring baseline: {atm.bank_name} in {atm.city}"]

            risk_result = RiskEngine.compute_composite_risk(
                ml_score=prob,
                rule_score=rule_score,
                days_since_incident=days_since,
                reasons=reasons,
            )

            risk_val = float(risk_result["risk_score"])
            if risk_val >= min_risk_threshold:
                # Deterministic UUID for read-only prediction representation
                pred_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"{atm.id}:{ver_str}:{now.strftime('%Y%m%d%H')}")
                p_item = RiskPredictionRead(
                    id=pred_uuid,
                    model_version=ver_str,
                    location_id=atm.id,
                    latitude=atm.latitude,
                    longitude=atm.longitude,
                    risk_score=Decimal(str(round(risk_val, 4))),
                    severity=risk_result["severity"],
                    confidence=Decimal(str(round(risk_result["confidence"], 4))),
                    predicted_window_start=now,
                    predicted_window_end=window_end,
                    reasons=risk_result["reasons"],
                    is_active=True,
                    predicted_at=now,
                    atm_code=atm.atm_code,
                    bank_name=atm.bank_name,
                    city=atm.city,
                )
                live_predictions.append(p_item)

        # Sort descending by risk score
        live_predictions.sort(key=lambda p: p.risk_score, reverse=True)
        return live_predictions[:limit]

