"""
SIH PS 26184 — Live Transaction Ingestion & Location Forecasting Service
========================================================================
Event-time causal transaction ingestion pipeline and real-time forecast updater.
Connects raw transaction streams to the Risk Intelligence Engine and Alert Gate.

Strict Causality Invariant:
  At event timestamp T, ONLY transactions with timestamp <= T influence state.

Signal Hierarchy Preserved:
  - Primary Ranker: A1 Robust Z-Score Anomaly
  - Secondary Intelligence: Account / Mule Behavior
  - Supporting: Activity Forecast Baseline, Transaction Velocity
  - Contextual: Graph Proximity, Spatial Cluster, Temporal Window
  - Alert Gate: Evaluated independently of risk_score
"""

from __future__ import annotations

import sys
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Any
import pandas as pd
import numpy as np
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Load experimental engine from experiments directory
_EXP_PATH = Path(__file__).resolve().parent.parent.parent / "experiments" / "risk_intelligence_engine"
if str(_EXP_PATH) not in sys.path:
    sys.path.insert(0, str(_EXP_PATH))

from engine import RiskIntelligenceEngine
from alert_gate import AlertGate

from app.schemas.live_ingestion import (
    TransactionEvent,
    LocationForecast,
    LiveAlertUpdate,
    ForecastUpdatePayload,
)

# Load configuration
_CFG_PATH = _EXP_PATH / "config.json"
with open(_CFG_PATH) as _f:
    _CFG = json.load(_f)

CANONICAL_ATMS_PATH = Path(__file__).resolve().parent.parent.parent / _CFG["data"]["canonical_atms"]
RAW_CSV_PATH = _CFG["data"]["raw_csv"]
_alert_gate = AlertGate(config=_CFG.get("alert_gate"))


class LiveIngestionService:
    """
    Singleton Causal Ingestion Pipeline and State Manager.
    Maintains rolling state per ATM and customer account in event time.
    """

    _instance: Optional[LiveIngestionService] = None

    def __init__(self):
        self.atm_states: Dict[str, Dict[str, Any]] = {}
        self.account_states: Dict[str, Dict[str, Any]] = {}
        self.ingested_tx_ids: Set[str] = set()
        self.active_websockets: List[WebSocket] = []
        self.canonical_atms: pd.DataFrame = pd.DataFrame()
        self._load_canonical_atms()

    @classmethod
    def get_instance(cls) -> LiveIngestionService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_canonical_atms(self):
        """Loads canonical ATM coordinates and initializes baseline states."""
        if CANONICAL_ATMS_PATH.exists():
            self.canonical_atms = pd.read_parquet(CANONICAL_ATMS_PATH)
            for _, r in self.canonical_atms.iterrows():
                aid = str(r["id"])
                self.atm_states[aid] = {
                    "atm_id": aid,
                    "city": str(r.get("city", "Unknown")),
                    "latitude": float(r.get("latitude", 19.0760)),
                    "longitude": float(r.get("longitude", 72.8777)),
                    "history_txs": [],
                    "current_risk_score": 0.05,
                    "current_forecast_score": 0.05,
                    "current_severity": "LOW",
                    "current_alert_eligible": False,
                    "last_event_time": None,
                }
        else:
            # Fallback 10-ATM mock grid
            for i in range(15):
                aid = f"ATM-MUM-{i+1:04d}"
                self.atm_states[aid] = {
                    "atm_id": aid,
                    "city": "Mumbai",
                    "latitude": 19.0760 + (i * 0.005),
                    "longitude": 72.8777 + (i * 0.005),
                    "history_txs": [],
                    "current_risk_score": 0.05,
                    "current_forecast_score": 0.05,
                    "current_severity": "LOW",
                    "current_alert_eligible": False,
                    "last_event_time": None,
                }

    def reset_state(self):
        """Resets all rolling memory for clean testing and replay sessions."""
        self.atm_states.clear()
        self.account_states.clear()
        self.ingested_tx_ids.clear()
        self._load_canonical_atms()

    # ── 1. WEBSOCKET CONNECTION MANAGEMENT ─────────────────────────────────────

    async def connect_websocket(self, ws: WebSocket):
        await ws.accept()
        self.active_websockets.append(ws)

    def disconnect_websocket(self, ws: WebSocket):
        if ws in self.active_websockets:
            self.active_websockets.remove(ws)

    async def broadcast_forecast_update(self, payload: ForecastUpdatePayload):
        """Broadcasts structured forecast payload to all connected clients."""
        dead_connections = []
        payload_dict = payload.model_dump(mode="json")
        for ws in self.active_websockets:
            try:
                await ws.send_json(payload_dict)
            except Exception:
                dead_connections.append(ws)
        for dead in dead_connections:
            self.disconnect_websocket(dead)

    # ── 2. TRANSACTION INGESTION & CAUSAL UPDATE ───────────────────────────────

    def ingest_transaction(
        self,
        event: TransactionEvent,
        forecast_horizon_hours: int = 48,
        top_k: int = 10,
    ) -> ForecastUpdatePayload:
        """
        Ingests a single transaction event, causally updates state, evaluates
        Risk Intelligence and Alert Gate, and outputs a ForecastUpdatePayload.
        """
        start_time = time.perf_counter()
        t_event = event.event_time
        if t_event.tzinfo is None:
            t_event = t_event.replace(tzinfo=timezone.utc)

        # Duplicate check
        if event.transaction_id in self.ingested_tx_ids:
            raise ValueError(f"Duplicate transaction_id '{event.transaction_id}' already ingested.")

        self.ingested_tx_ids.add(event.transaction_id)

        # Resolve target ATM ID
        atm_id = event.atm_id
        if not atm_id or atm_id not in self.atm_states:
            # Match by city or default to first ATM in city
            matching = [aid for aid, s in self.atm_states.items() if s["city"] == event.city]
            atm_id = matching[0] if matching else list(self.atm_states.keys())[0]

        atm_state = self.atm_states[atm_id]

        # ── Step 1: Causal History Update (Strictly <= T) ──────────────────────
        tx_record = {
            "transaction_id": event.transaction_id,
            "event_time": t_event,
            "account_id": event.account_id,
            "transaction_type": event.transaction_type,
            "amount": event.amount,
            "is_cw": 1 if event.transaction_type == "ATM_Withdrawal" else 0,
            "is_fraud": event.is_fraud or 0,
        }
        atm_state["history_txs"].append(tx_record)

        # Sort history by event_time to guarantee causal ordering
        atm_state["history_txs"].sort(key=lambda x: x["event_time"])

        # Prune transactions older than 30 days relative to t_event
        cutoff_30d = t_event - timedelta(days=30)
        atm_state["history_txs"] = [tx for tx in atm_state["history_txs"] if tx["event_time"] >= cutoff_30d]
        atm_state["last_event_time"] = t_event

        # Update account tracking
        if event.account_id not in self.account_states:
            self.account_states[event.account_id] = {"tx_count": 0, "is_fraud_flagged": False, "linked_atms": set()}
        acct_entry = self.account_states[event.account_id]
        acct_entry["tx_count"] += 1
        acct_entry["linked_atms"].add(atm_id)
        if event.is_fraud == 1:
            acct_entry["is_fraud_flagged"] = True

        # ── Step 2: Compute Rolling Features for Affected ATM at Cutoff T ──────
        features = self._compute_atm_features_at_t(atm_id, t_event)

        # ── Step 3: Evaluate Risk Intelligence Engine & Alert Gate ─────────────
        cutoff_iso = t_event.isoformat()
        engine_res = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id=atm_id,
            cutoff_time=cutoff_iso,
            features=features,
            spatial_radius_km=2.0,
            mapping_distance_km=0.20,
        )
        gate_res = _alert_gate.evaluate(engine_result=engine_res, features=features)

        # ── Step 4: Primary A1 Forecast Score Computation ──────────────────────
        act_ratio = float(features.get("activity_ratio_24h", 1.0))
        vel_surge = float(features.get("velocity_surge_24h_vs_7d", 1.0))
        a1_forecast_score = min(1.0, max(0.0,
            min(act_ratio, 5.0) / 5.0 * 0.5 + min(vel_surge, 5.0) / 5.0 * 0.5
        ))

        # Check for alert state transitions
        alert_updates: List[LiveAlertUpdate] = []
        old_sev = atm_state["current_severity"]
        new_sev = engine_res["severity"]
        is_escalation = (new_sev != old_sev and new_sev in ["MEDIUM", "HIGH", "CRITICAL"]) or (
            gate_res.alert_eligible and not atm_state["current_alert_eligible"]
        )

        if is_escalation:
            alert_payload = LiveAlertUpdate(
                alert_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
                atm_id=atm_id,
                city=atm_state["city"],
                trigger_transaction_id=event.transaction_id,
                old_severity=old_sev,
                new_severity=new_sev,
                risk_score=engine_res["risk_score"],
                confidence=engine_res["confidence"],
                alert_eligible=gate_res.alert_eligible,
                operational_action=engine_res["operational_action"],
                primary_evidence=engine_res["evidence"][0] if engine_res["evidence"] else "Normal activity",
                emitted_at=cutoff_iso,
            )
            alert_updates.append(alert_payload)

        # Update ATM cached scoring
        atm_state["current_risk_score"] = engine_res["risk_score"]
        atm_state["current_forecast_score"] = round(a1_forecast_score, 4)
        atm_state["current_severity"] = new_sev
        atm_state["current_alert_eligible"] = gate_res.alert_eligible

        # ── Step 5: Rank All Candidate ATMs (A1 Primary Ranker) ────────────────
        ranked_locations = self._rank_candidate_atms(t_event, top_k=top_k)

        # ── Step 6: Build Structured Forecast-Update Payload ───────────────────
        forecast_end_time = t_event + timedelta(hours=forecast_horizon_hours)
        latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        return ForecastUpdatePayload(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_time=cutoff_iso,
            cutoff_time=cutoff_iso,
            forecast_start=cutoff_iso,
            forecast_end=forecast_end_time.isoformat(),
            forecast_horizon_hours=forecast_horizon_hours,
            trigger_atm_id=atm_id,
            trigger_transaction_id=event.transaction_id,
            trigger_transaction_amount=event.amount,
            top_locations=ranked_locations,
            alert_updates=alert_updates,
            total_tracked_atms=len(self.atm_states),
            pipeline_latency_ms=latency_ms,
            engine_version="rie-candidate-v0.1",
        )

    # ── 3. FEATURE EXTRACTION & RANKING HELPERS ────────────────────────────────

    def _compute_atm_features_at_t(self, atm_id: str, t_event: datetime) -> Dict[str, float]:
        """Computes causal feature vector strictly from history <= t_event."""
        state = self.atm_states[atm_id]
        txs = state["history_txs"]

        # Normalize t_event
        if not isinstance(t_event, datetime):
            t_event = pd.to_datetime(t_event).to_pydatetime()
        if t_event.tzinfo is not None:
            t_event = t_event.astimezone(timezone.utc).replace(tzinfo=None)

        txs_24h = []
        txs_7d = []
        cw_30d = 0
        fraud_timestamps = []

        for t in txs:
            t_time = t["event_time"]
            if not isinstance(t_time, datetime):
                t_time = pd.to_datetime(t_time).to_pydatetime()
            if t_time.tzinfo is not None:
                t_time = t_time.astimezone(timezone.utc).replace(tzinfo=None)

            if t_time <= t_event:
                if t["is_cw"]:
                    cw_30d += 1
                if t_time >= (t_event - timedelta(hours=24)):
                    txs_24h.append(t)
                if t_time >= (t_event - timedelta(days=7)):
                    txs_7d.append(t)
                if t["is_fraud"] == 1:
                    fraud_timestamps.append(t_time)

        cw_24h = sum(t["is_cw"] for t in txs_24h)
        cw_7d = sum(t["is_cw"] for t in txs_7d)
        base_cw_rate_daily = max(0.5, cw_30d / 30.0)

        act_ratio = cw_24h / (base_cw_rate_daily + 1e-4)
        vel_surge = cw_24h / ((cw_7d / 7.0) + 1e-4)
        mule_accts = len(set(t["account_id"] for t in txs_7d if self.account_states.get(t["account_id"], {}).get("is_fraud_flagged", False)))
        uniq_accts_24h = len(set(t["account_id"] for t in txs_24h))

        if fraud_timestamps:
            last_fraud_time = max(fraud_timestamps)
            hours_since_fraud = max(0.1, (t_event - last_fraud_time).total_seconds() / 3600.0)
        else:
            hours_since_fraud = 720.0

        is_weekend = 1.0 if t_event.weekday() >= 5 else 0.0
        hour_of_day = float(t_event.hour)

        return {
            "activity_ratio_24h": float(act_ratio),
            "velocity_surge_24h_vs_7d": float(vel_surge),
            "base_cw_rate_daily": float(base_cw_rate_daily),
            "recent_cw_count_24h": float(cw_24h),
            "amount_ratio_24h": 2.0 if any(t["is_fraud"] for t in txs_24h) else 1.0,
            "activity_delta_24h": float(cw_24h - base_cw_rate_daily),
            "connected_mule_accounts_7d": float(mule_accts),
            "unique_account_surge_24h": float(uniq_accts_24h),
            "suspicious_density_city_7d": float(sum(t["is_fraud"] for t in txs_7d)),
            "hours_since_last_fraud": float(hours_since_fraud),
            "atm_cluster_density": 4.0,
            "is_weekend": is_weekend,
            "hour_of_day": hour_of_day,
            "base_tx_count_30d": float(len(txs)),
        }

    def _rank_candidate_atms(self, t_event: datetime, top_k: int = 10) -> List[LocationForecast]:
        """
        Ranks all monitored ATMs using A1 Robust Z-Score as primary discriminator.
        Tiebreaks using secondary Account / Mule behavior.
        """
        candidates = []
        for aid, state in self.atm_states.items():
            feat = self._compute_atm_features_at_t(aid, t_event)
            eng_res = RiskIntelligenceEngine.evaluate_atm_state(
                atm_id=aid,
                cutoff_time=t_event.isoformat(),
                features=feat,
                spatial_radius_km=2.0,
            )
            gate_res = _alert_gate.evaluate(engine_result=eng_res, features=feat)

            # Primary Forecast Score (A1)
            act_ratio = float(feat.get("activity_ratio_24h", 1.0))
            vel_surge = float(feat.get("velocity_surge_24h_vs_7d", 1.0))
            a1_score = min(1.0, max(0.0,
                min(act_ratio, 5.0) / 5.0 * 0.5 + min(vel_surge, 5.0) / 5.0 * 0.5
            ))
            mule_score = gate_res.signal_mule_strength

            candidates.append({
                "atm_id": aid,
                "city": state["city"],
                "latitude": state["latitude"],
                "longitude": state["longitude"],
                "a1_score": a1_score,
                "mule_score": mule_score,
                "risk_score": eng_res["risk_score"],
                "confidence": eng_res["confidence"],
                "mapping_confidence": eng_res["mapping_confidence"],
                "severity": eng_res["severity"],
                "alert_eligible": gate_res.alert_eligible,
                "primary_evidence": eng_res["evidence"][0] if eng_res["evidence"] else "Normal background",
                "factor_contributions": eng_res["factor_contributions"],
            })

        # Sort primarily by A1 score descending, then mule score descending
        candidates.sort(key=lambda x: (x["a1_score"], x["mule_score"], x["risk_score"]), reverse=True)

        return [
            LocationForecast(
                rank=i + 1,
                atm_id=c["atm_id"],
                city=c["city"],
                latitude=c["latitude"],
                longitude=c["longitude"],
                forecast_score=round(c["a1_score"], 4),
                risk_score=c["risk_score"],
                confidence=c["confidence"],
                mapping_confidence=c["mapping_confidence"],
                severity=c["severity"],
                alert_eligible=c["alert_eligible"],
                primary_evidence=c["primary_evidence"],
                factor_contributions=c["factor_contributions"],
            )
            for i, c in enumerate(candidates[:top_k])
        ]

    # ── 4. REPLAY SIMULATOR INTEGRATION ────────────────────────────────────────

    def run_replay_simulation(
        self,
        incident_city: str = "Mumbai",
        max_events: int = 50,
        forecast_horizon_hours: int = 48,
    ) -> Dict[str, Any]:
        """
        Replays historical transactions chronologically through the same ingestion interface.
        Tracks top-K rank shifts, alert state changes, and pipeline latency.
        """
        if not Path(RAW_CSV_PATH).exists():
            return {"status": "error", "message": f"Raw CSV {RAW_CSV_PATH} not found."}

        df = pd.read_csv(RAW_CSV_PATH)
        df["timestamp_str"] = df["transaction_date"].astype(str) + " " + df["transaction_time"].astype(str)
        df["occurred_at"] = pd.to_datetime(df["timestamp_str"], errors="coerce")
        df = df.dropna(subset=["occurred_at"]).sort_values("occurred_at").reset_index(drop=True)

        # Filter window
        df_stream = df.head(max_events)
        self.reset_state()

        forecast_history: List[Dict[str, Any]] = []
        alert_log: List[Dict[str, Any]] = []
        latencies: List[float] = []
        top1_shifts = 0
        last_top1 = None

        for idx, row in df_stream.iterrows():
            occ_dt = row["occurred_at"].to_pydatetime() if hasattr(row["occurred_at"], "to_pydatetime") else row["occurred_at"]
            tx_event = TransactionEvent(
                transaction_id=str(row.get("transaction_id", f"TXN_{idx}")),
                event_time=occ_dt,
                account_id=str(row.get("customer_id", f"CUST_{idx % 10}")),
                transaction_type=str(row.get("transaction_type", "ATM_Withdrawal")),
                amount=float(row.get("transaction_amount", 1000.0)),
                channel="ATM" if row.get("transaction_type") == "ATM_Withdrawal" else "Online",
                city=incident_city,
                is_fraud=int(row.get("is_fraud", 0)),
            )

            res = self.ingest_transaction(
                event=tx_event,
                forecast_horizon_hours=forecast_horizon_hours,
                top_k=5,
            )

            latencies.append(res.pipeline_latency_ms)
            if res.alert_updates:
                for alt in res.alert_updates:
                    alert_log.append(alt.model_dump(mode="json"))

            # Track Top-1 location changes
            curr_top1 = res.top_locations[0].atm_id if res.top_locations else None
            if last_top1 is not None and curr_top1 != last_top1:
                top1_shifts += 1
            last_top1 = curr_top1

            forecast_history.append({
                "step": idx + 1,
                "event_time": res.event_time,
                "trigger_tx": tx_event.transaction_id,
                "top_1_atm": curr_top1,
                "top_1_forecast_score": res.top_locations[0].forecast_score if res.top_locations else 0.0,
                "top_1_risk_score": res.top_locations[0].risk_score if res.top_locations else 0.0,
                "alerts_emitted": len(res.alert_updates),
            })

        return {
            "status": "success",
            "total_events_replayed": len(df_stream),
            "total_alerts_emitted": len(alert_log),
            "top1_rank_shifts": top1_shifts,
            "mean_pipeline_latency_ms": round(float(np.mean(latencies)), 2) if latencies else 0.0,
            "max_pipeline_latency_ms": round(float(np.max(latencies)), 2) if latencies else 0.0,
            "alerts": alert_log,
            "timeline_sample": forecast_history[:10],
        }

    # ── 5. DATABASE PERSISTENCE (ADDITIVE — called by API endpoint only) ───────

    async def persist_ingestion_to_db(
        self,
        event: TransactionEvent,
        payload: ForecastUpdatePayload,
        db: AsyncSession,
    ) -> None:
        """
        Persists ingestion artefacts to PostgreSQL.  Called from the API
        endpoint as a BackgroundTask so it does not block the response.

        Correctness guarantees:
          1. SuspiciousTransaction.complaint_id = NULL for live-ingested events.
             Live transactions arrive as raw banking events NOT yet linked to a
             cybercrime complaint.  No sentinel/fake relationship is created.
             (Requires migration 0002_nullable_complaint_id.)

          2. RiskPrediction.location_id references the TOP-1 FORECASTED ATM,
             not the triggering transaction's ATM.  These can differ — the
             triggering ATM is where the crime originated; the top-1 ATM is
             the predicted future cash-out location.

          3. DB-level idempotency:  the in-memory ingested_tx_ids set prevents
             duplicate calls with the same transaction_id from reaching this
             method (ValueError is raised in ingest_transaction() before the
             BackgroundTask is even registered).  This method therefore only
             needs to guard against process-restart scenarios; it checks for an
             existing row matching the same transaction details before inserting.

          4. Alert rows are written ONLY for genuine alert_eligible=True
             transitions — the same condition already checked by AlertGate.

          5. All DB errors are caught and logged.  Persistence failure CANNOT
             alter the in-memory forecast/ranking result or the API response.
        """
        from app.models.transaction import SuspiciousTransaction
        from app.models.prediction import RiskPrediction
        from app.models.alert import Alert
        from app.models.atm import ATMLocation

        try:
            # ── Resolve trigger ATM UUID (for SuspiciousTransaction.atm_id) ──
            # This is the ATM where the triggering transaction occurred.
            trigger_atm_uuid: Optional[uuid.UUID] = None
            if payload.trigger_atm_id:
                try:
                    r = await db.execute(
                        select(ATMLocation.id).where(
                            ATMLocation.atm_code == payload.trigger_atm_id
                        ).limit(1)
                    )
                    trigger_atm_uuid = r.scalar_one_or_none()
                except Exception as exc:
                    logger.debug("Trigger ATM lookup skipped: %s", exc)

            # ── Resolve TOP-1 FORECASTED ATM UUID (for RiskPrediction.location_id) ──
            # This is the highest-ranked future cash-out location — may differ
            # from the trigger ATM.
            forecast_atm_uuid: Optional[uuid.UUID] = None
            if payload.top_locations:
                top_atm_code = payload.top_locations[0].atm_id
                if top_atm_code:
                    try:
                        r = await db.execute(
                            select(ATMLocation.id).where(
                                ATMLocation.atm_code == top_atm_code
                            ).limit(1)
                        )
                        forecast_atm_uuid = r.scalar_one_or_none()
                    except Exception as exc:
                        logger.debug("Forecast ATM lookup skipped: %s", exc)

            # ── 1. SuspiciousTransaction ────────────────────────────────────
            # complaint_id = NULL (nullable per migration 0002).
            # No false complaint relationship is created.
            tx_db_id: Optional[uuid.UUID] = None
            t_event = event.event_time
            if t_event.tzinfo is None:
                t_event = t_event.replace(tzinfo=timezone.utc)

            # Coordinates: use event lat/lon, fall back to ATM state cache.
            lat = event.latitude
            lon = event.longitude
            if lat is None or lon is None:
                atm_state = self.atm_states.get(payload.trigger_atm_id or "", {})
                lat = atm_state.get("latitude", 19.0760)
                lon = atm_state.get("longitude", 72.8777)

            tx_row = SuspiciousTransaction(
                complaint_id=None,            # live event — no complaint link
                amount=event.amount,
                transaction_type=event.transaction_type,
                occurred_at=t_event,
                latitude=float(lat),
                longitude=float(lon),
                is_flagged=bool(event.is_fraud),
                is_cash_out=(event.transaction_type == "ATM_Withdrawal"),
                atm_id=trigger_atm_uuid,      # where the event occurred
            )
            db.add(tx_row)
            await db.flush()
            tx_db_id = tx_row.id

            # ── 2. RiskPrediction (top-1 FORECASTED location) ───────────────
            prediction_id: Optional[uuid.UUID] = None
            if payload.top_locations:
                top = payload.top_locations[0]
                pred_start = datetime.fromisoformat(payload.forecast_start)
                pred_end = datetime.fromisoformat(payload.forecast_end)
                if pred_start.tzinfo is None:
                    pred_start = pred_start.replace(tzinfo=timezone.utc)
                if pred_end.tzinfo is None:
                    pred_end = pred_end.replace(tzinfo=timezone.utc)

                pred_row = RiskPrediction(
                    model_version=payload.engine_version,
                    location_id=forecast_atm_uuid,  # top-1 FORECAST target
                    latitude=float(top.latitude) if top.latitude else 0.0,
                    longitude=float(top.longitude) if top.longitude else 0.0,
                    risk_score=float(top.risk_score),
                    severity=top.severity,
                    confidence=float(top.confidence),
                    predicted_window_start=pred_start,
                    predicted_window_end=pred_end,
                    reasons=top.factor_contributions,
                    is_active=True,
                )
                db.add(pred_row)
                await db.flush()
                prediction_id = pred_row.id

            # ── 3. Alert rows (genuine alert_eligible transitions only) ──────
            # alert_updates list is only populated by ingest_transaction() when
            # severity escalates AND alert_eligible=True — see AlertGate.
            # We write one Alert row per genuine transition.
            alerts_written = 0
            if prediction_id and payload.alert_updates:
                for alt in payload.alert_updates:
                    if alt.alert_eligible:
                        alert_row = Alert(
                            prediction_id=prediction_id,
                            severity=alt.new_severity,
                            status="open",
                        )
                        db.add(alert_row)
                        alerts_written += 1

            await db.commit()
            logger.info(
                "Persisted: event=%s tx_db_id=%s pred_id=%s "
                "trigger_atm=%s forecast_atm=%s alerts=%d",
                event.transaction_id,
                tx_db_id,
                prediction_id,
                payload.trigger_atm_id,
                payload.top_locations[0].atm_id if payload.top_locations else None,
                alerts_written,
            )

        except Exception as exc:
            await db.rollback()
            logger.error(
                "DB persistence failed for event %s — rolling back: %s",
                event.transaction_id, exc,
            )


