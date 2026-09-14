"""
SIH PS 26184 — Risk Intelligence Service (Backend Integration Preparation)
===========================================================================
Service interface bridging the experimental Risk Intelligence Engine
and Alert Gate to the FastAPI backend.

STATUS: PRE-PRODUCTION CANDIDATE — Not yet promoted.
Location: app/services/risk_intelligence_service.py
Reads from: experiments/risk_intelligence_engine/ (engine + alert_gate)

DO NOT use equal-weight composite as primary ranker.
DO NOT auto-create DB records or modify production inference pipeline.
This service is read-only from the perspective of existing DB tables.

Primary Ranking Signal: A1 Anomaly (Robust Z-Score)
Secondary Intelligence: Account / Mule Behavior
Supporting: Activity Forecast, Transaction Velocity
Contextual Evidence: Graph, Spatial, Temporal, Complaint
"""

from __future__ import annotations

import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Load experimental engine from experiments directory
_EXP_PATH = Path(__file__).resolve().parent.parent.parent / "experiments" / "risk_intelligence_engine"
if str(_EXP_PATH) not in sys.path:
    sys.path.insert(0, str(_EXP_PATH))

from engine import RiskIntelligenceEngine          # experimental engine
from alert_gate import AlertGate, DEFAULT_GATE_CONFIG  # experimental alert gate

from app.schemas.risk_intelligence import (
    RiskEvaluationResponse,
    AlertGateDetail,
    TopRiskATM,
    ExplanationResponse,
)

# Load frozen signal config
_CFG_PATH = _EXP_PATH / "config.json"
with open(_CFG_PATH) as _f:
    _CFG = json.load(_f)

ENGINE_VERSION = _CFG.get("_version", "rie-candidate-v0.1")
PREDICTION_WINDOW_HOURS = 48
_alert_gate = AlertGate(config=_CFG.get("alert_gate", DEFAULT_GATE_CONFIG))


class RiskIntelligenceService:
    """
    Backend integration service for the Risk Intelligence Engine.
    Provides the interface methods matching the proposed API endpoints.

    Primary ATM ranking uses A1 Robust Z-Score (not equal-weight composite).
    Alert decisions are separate from risk scores (via AlertGate).
    """

    @classmethod
    def evaluate_atm(
        cls,
        atm_id: str,
        features: Dict[str, Any],
        cutoff_time: Optional[datetime] = None,
        spatial_radius_km: float = 2.0,
        mapping_distance_km: Optional[float] = None,
    ) -> RiskEvaluationResponse:
        """
        Evaluate risk for a single ATM at a given cutoff time.
        Returns structured response with risk_score AND alert_eligible as separate quantities.
        """
        now = cutoff_time or datetime.now(timezone.utc)
        now_str = now.isoformat()
        window_end = now + timedelta(hours=PREDICTION_WINDOW_HOURS)

        # Step 1: Full multi-signal engine evaluation
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id=atm_id,
            cutoff_time=now_str,
            features=features,
            spatial_radius_km=spatial_radius_km,
            mapping_distance_km=mapping_distance_km,
        )

        # Step 2: Evidence-aware alert gate (separate from risk_score)
        gate_result = _alert_gate.evaluate(
            engine_result=engine_result,
            features=features,
        )

        alert_gate_detail = AlertGateDetail(
            alert_eligible=gate_result.alert_eligible,
            alert_reason=gate_result.alert_reason,
            required_evidence=gate_result.required_evidence,
            missing_evidence=gate_result.missing_evidence,
            primary_tier_active=gate_result.primary_tier_active,
            secondary_tier_active=gate_result.secondary_tier_active,
            quality_gate_passed=gate_result.quality_gate_passed,
            signal_anomaly_strength=gate_result.signal_anomaly_strength,
            signal_activity_strength=gate_result.signal_activity_strength,
            signal_mule_strength=gate_result.signal_mule_strength,
            signal_velocity_strength=gate_result.signal_velocity_strength,
            data_quality=gate_result.data_quality,
        )

        # Build human-readable reasons from factor contributions
        reasons = [
            f"{k}: {v:.4f}" for k, v in engine_result["factor_contributions"].items()
            if v > 0.01
        ]

        return RiskEvaluationResponse(
            atm_id=atm_id,
            cutoff_time=now_str,
            prediction_window=f"{now_str} to {window_end.isoformat()}",
            risk_score=engine_result["risk_score"],
            confidence=engine_result["confidence"],
            mapping_confidence=engine_result["mapping_confidence"],
            severity=engine_result["severity"],
            alert_eligible=gate_result.alert_eligible,
            alert_gate=alert_gate_detail,
            evidence=engine_result["evidence"],
            reasons=reasons,
            factor_contributions=engine_result["factor_contributions"],
            data_freshness_hours=engine_result["data_freshness_hours"],
            spatial_radius_km=spatial_radius_km,
            engine_version=ENGINE_VERSION,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def rank_atm_cohort(
        cls,
        cohort: List[Dict[str, Any]],
        k: int = 20,
        spatial_radius_km: float = 2.0,
        cutoff_time: Optional[datetime] = None,
    ) -> List[TopRiskATM]:
        """
        Ranks a cohort of ATMs using A1 Robust Z-Score as primary signal.
        Returns top-K ATMs sorted by A1 primary signal (not equal-weight composite).
        Alert eligibility is computed per-ATM and included in the response.
        """
        now = cutoff_time or datetime.now(timezone.utc)
        scored = []

        for atm_feat in cohort:
            atm_id = str(atm_feat.get("atm_id", "UNKNOWN"))
            features = atm_feat.get("features", atm_feat)

            # PRIMARY RANKER: A1 Robust Z-Score
            act_ratio = float(features.get("activity_ratio_24h", 1.0))
            vel_surge = float(features.get("velocity_surge_24h_vs_7d", 1.0))
            a1_score = min(1.0, max(0.0,
                min(act_ratio, 5.0) / 5.0 * 0.5 + min(vel_surge, 5.0) / 5.0 * 0.5
            ))

            # Full engine for alert gate + evidence
            engine_result = RiskIntelligenceEngine.evaluate_atm_state(
                atm_id=atm_id,
                cutoff_time=now.isoformat(),
                features=features,
                spatial_radius_km=spatial_radius_km,
            )
            gate_result = _alert_gate.evaluate(engine_result=engine_result, features=features)
            primary_evidence = engine_result["evidence"][0] if engine_result["evidence"] else "No active signal"

            scored.append({
                "atm_id": atm_id,
                "city": str(features.get("city", "")),
                "a1_score": a1_score,
                "risk_score": engine_result["risk_score"],
                "confidence": engine_result["confidence"],
                "severity": engine_result["severity"],
                "alert_eligible": gate_result.alert_eligible,
                "primary_evidence": primary_evidence,
            })

        # Sort by A1 primary signal descending (not composite)
        scored.sort(key=lambda x: x["a1_score"], reverse=True)

        return [
            TopRiskATM(
                rank=i + 1,
                atm_id=r["atm_id"],
                city=r["city"] or None,
                risk_score=r["risk_score"],
                confidence=r["confidence"],
                severity=r["severity"],
                alert_eligible=r["alert_eligible"],
                primary_evidence=r["primary_evidence"],
            )
            for i, r in enumerate(scored[:k])
        ]

    @classmethod
    def get_explanation(
        cls,
        atm_id: str,
        features: Dict[str, Any],
        cutoff_time: Optional[datetime] = None,
        spatial_radius_km: float = 2.0,
    ) -> ExplanationResponse:
        """
        Generates a detailed, structured explanation for a single ATM.
        """
        now = cutoff_time or datetime.now(timezone.utc)
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id=atm_id,
            cutoff_time=now.isoformat(),
            features=features,
            spatial_radius_km=spatial_radius_km,
        )
        gate_result = _alert_gate.evaluate(engine_result=engine_result, features=features)

        return ExplanationResponse(
            atm_id=atm_id,
            risk_score=engine_result["risk_score"],
            confidence=engine_result["confidence"],
            mapping_confidence=engine_result["mapping_confidence"],
            severity=engine_result["severity"],
            alert_eligible=gate_result.alert_eligible,
            alert_reason=gate_result.alert_reason,
            evidence=engine_result["evidence"],
            factor_contributions=engine_result["factor_contributions"],
            signal_strengths={
                "a1_anomaly": gate_result.signal_anomaly_strength,
                "activity_residual": gate_result.signal_activity_strength,
                "mule_behavior": gate_result.signal_mule_strength,
                "tx_velocity": gate_result.signal_velocity_strength,
            },
            data_freshness_hours=engine_result["data_freshness_hours"],
            evaluated_at=datetime.now(timezone.utc).isoformat(),
            engine_version=ENGINE_VERSION,
        )
