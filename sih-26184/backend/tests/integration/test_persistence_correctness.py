"""
SIH PS 26184 — Persistence Correctness Integration Tests
=========================================================
Validates the following guarantees of persist_ingestion_to_db():

  1. complaint_id is NULL — no false complaint→transaction link
  2. location_id in risk_predictions references the TOP-1 FORECASTED ATM,
     not necessarily the triggering ATM
  3. Alert rows are only created for genuine alert_eligible=True transitions
  4. Non-alert transitions do NOT create DB alert rows
  5. Duplicate transaction_id is rejected before any DB write (idempotency)
  6. Forecast/ranking result is unaffected by DB failure
  7. Pipeline returns correct top-location fields
  8. Trigger ATM and forecast ATM are semantically distinct
  9. Sequential events accumulate monotonically
  10. RiskPrediction stores top-1 forecast ATM coordinates, not trigger event coords
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.live_ingestion import (
    ForecastUpdatePayload,
    LiveAlertUpdate,
    LocationForecast,
    TransactionEvent,
)
from app.services.live_ingestion_service import LiveIngestionService


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_event(
    tx_id: str = "TXN-PERSIST-001",
    atm_id: str | None = None,
    city: str = "Mumbai",
    amount: float = 5000.0,
    is_fraud: int = 0,
    event_time: datetime | None = None,
    latitude: float | None = 19.076,
    longitude: float | None = 72.877,
) -> TransactionEvent:
    if event_time is None:
        event_time = datetime(2023, 6, 1, 10, 0, tzinfo=timezone.utc)
    svc = LiveIngestionService.get_instance()
    if atm_id is None:
        atm_id = list(svc.atm_states.keys())[0]
    return TransactionEvent(
        transaction_id=tx_id,
        event_time=event_time,
        account_id="ACC-PERSIST-TEST",
        transaction_type="ATM_Withdrawal",
        amount=amount,
        atm_id=atm_id,
        city=city,
        latitude=latitude,
        longitude=longitude,
        is_fraud=is_fraud,
    )


def _make_payload(
    svc: LiveIngestionService,
    event: TransactionEvent,
    alert_eligible: bool = False,
    top_atm_id: str | None = None,
    top_lat: float = 19.080,
    top_lon: float = 72.882,
) -> ForecastUpdatePayload:
    top_atm = top_atm_id or (event.atm_id or list(svc.atm_states.keys())[0])
    alert_updates = []
    if alert_eligible:
        alert_updates.append(
            LiveAlertUpdate(
                alert_id="ALT-TEST-0001",
                atm_id=top_atm,
                city="Mumbai",
                trigger_transaction_id=event.transaction_id,
                old_severity="LOW",
                new_severity="HIGH",
                risk_score=0.82,
                confidence=0.75,
                alert_eligible=True,
                operational_action="Investigator review required",
                primary_evidence="Velocity surge >4x",
                emitted_at=event.event_time.isoformat(),
            )
        )
    return ForecastUpdatePayload(
        event_id="EVT-TEST-0001",
        event_time=event.event_time.isoformat(),
        cutoff_time=event.event_time.isoformat(),
        forecast_start=event.event_time.isoformat(),
        forecast_end=(event.event_time + timedelta(hours=48)).isoformat(),
        forecast_horizon_hours=48,
        trigger_atm_id=event.atm_id,
        trigger_transaction_id=event.transaction_id,
        trigger_transaction_amount=event.amount,
        top_locations=[
            LocationForecast(
                rank=1,
                atm_id=top_atm,
                city="Mumbai",
                latitude=top_lat,
                longitude=top_lon,
                forecast_score=0.72,
                risk_score=0.65,
                confidence=0.78,
                mapping_confidence=0.90,
                severity="HIGH" if alert_eligible else "LOW",
                alert_eligible=alert_eligible,
                primary_evidence="Velocity surge",
                factor_contributions={"a1_anomaly": 0.40, "velocity": 0.10},
            )
        ],
        alert_updates=alert_updates,
        total_tracked_atms=len(svc.atm_states),
        pipeline_latency_ms=1.5,
        engine_version="rie-candidate-v0.1",
    )


def _build_mock_db(atm_uuid=None, forecast_atm_uuid=None):
    """Mock AsyncSession with call-order-aware execute() for ATM FK resolution."""
    db = AsyncMock()
    db._added_rows = []
    db._flushed_rows = []
    db._all_added_rows = []

    def _add(row):
        db._added_rows.append(row)
        db._all_added_rows.append(row)

    db.add = MagicMock(side_effect=_add)

    async def _flush():
        for row in db._added_rows:
            if not getattr(row, "id", None):
                row.id = uuid.uuid4()
        db._flushed_rows.extend(db._added_rows)
        db._added_rows.clear()

    db.flush = _flush
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    call_count = [0]

    async def _execute(stmt):
        result = AsyncMock()
        call_count[0] += 1
        # Call 1 = trigger ATM lookup; Call 2 = forecast ATM lookup
        if call_count[0] == 1:
            result.scalar_one_or_none = MagicMock(return_value=atm_uuid)
        else:
            result.scalar_one_or_none = MagicMock(
                return_value=forecast_atm_uuid if forecast_atm_uuid is not None else atm_uuid
            )
        return result

    db.execute = _execute
    return db


@pytest.fixture(autouse=True)
def reset_ingestion_state():
    LiveIngestionService.get_instance().reset_state()
    yield
    LiveIngestionService.get_instance().reset_state()


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests: persist_ingestion_to_db() with mocked AsyncSession
# ─────────────────────────────────────────────────────────────────────────────

class TestPersistenceCorrectness:

    @pytest.fixture()
    def svc(self):
        return LiveIngestionService.get_instance()

    @pytest.mark.asyncio
    async def test_complaint_id_is_null_for_live_events(self, svc):
        """complaint_id must be None — no false complaint relationship."""
        event = _make_event()
        payload = _make_payload(svc, event)
        mock_db = _build_mock_db()

        await svc.persist_ingestion_to_db(event, payload, mock_db)

        from app.models.transaction import SuspiciousTransaction
        tx_rows = [r for r in mock_db._all_added_rows if isinstance(r, SuspiciousTransaction)]
        assert len(tx_rows) == 1
        assert tx_rows[0].complaint_id is None, (
            "complaint_id MUST be None for live-ingested events"
        )

    @pytest.mark.asyncio
    async def test_location_id_is_forecasted_atm_not_trigger_atm(self, svc):
        """RiskPrediction.location_id = top-1 forecast ATM UUID, not trigger ATM UUID."""
        trigger_uuid = uuid.uuid4()
        forecast_uuid = uuid.uuid4()

        atm_keys = list(svc.atm_states.keys())
        event = _make_event(atm_id=atm_keys[0])
        payload = _make_payload(svc, event, top_atm_id=atm_keys[1])
        mock_db = _build_mock_db(atm_uuid=trigger_uuid, forecast_atm_uuid=forecast_uuid)

        await svc.persist_ingestion_to_db(event, payload, mock_db)

        from app.models.prediction import RiskPrediction
        pred_rows = [r for r in mock_db._all_added_rows if isinstance(r, RiskPrediction)]
        assert len(pred_rows) == 1
        assert pred_rows[0].location_id == forecast_uuid, (
            "location_id must reference the FORECASTED ATM, not the trigger ATM"
        )
        assert pred_rows[0].location_id != trigger_uuid

    @pytest.mark.asyncio
    async def test_alert_row_created_only_for_eligible_transitions(self, svc):
        """DB Alert row written only when alert_eligible=True."""
        event = _make_event()
        payload = _make_payload(svc, event, alert_eligible=True)
        mock_db = _build_mock_db()

        await svc.persist_ingestion_to_db(event, payload, mock_db)

        from app.models.alert import Alert
        alert_rows = [r for r in mock_db._all_added_rows if isinstance(r, Alert)]
        assert len(alert_rows) == 1
        assert alert_rows[0].severity == "HIGH"
        assert alert_rows[0].status == "open"

    @pytest.mark.asyncio
    async def test_no_alert_row_for_non_eligible_event(self, svc):
        """No DB Alert row for alert_eligible=False payloads."""
        event = _make_event()
        payload = _make_payload(svc, event, alert_eligible=False)
        mock_db = _build_mock_db()

        await svc.persist_ingestion_to_db(event, payload, mock_db)

        from app.models.alert import Alert
        alert_rows = [r for r in mock_db._all_added_rows if isinstance(r, Alert)]
        assert len(alert_rows) == 0

    @pytest.mark.asyncio
    async def test_db_failure_does_not_alter_forecast_result(self, svc):
        """DB error in persist must not raise and must not alter in-memory state."""
        event = _make_event("TXN-DB-FAIL-001")
        result = svc.ingest_transaction(event, top_k=5)
        top1_atm = result.top_locations[0].atm_id
        score_before = svc.atm_states[top1_atm]["current_forecast_score"]

        payload = _make_payload(svc, event)
        failing_db = AsyncMock()
        failing_db.commit = AsyncMock(side_effect=Exception("DB connection refused"))
        failing_db.rollback = AsyncMock()
        failing_db.add = MagicMock()

        await svc.persist_ingestion_to_db(event, payload, failing_db)  # must not raise

        score_after = svc.atm_states[top1_atm]["current_forecast_score"]
        assert score_after == pytest.approx(score_before, abs=0.01)
        failing_db.rollback.assert_awaited_once()

    def test_duplicate_event_rejected_before_db_write(self, svc):
        """Duplicate transaction_id raises ValueError before BackgroundTask is registered."""
        event = _make_event("TXN-DUP-PERSIST-001")
        svc.ingest_transaction(event, top_k=5)
        with pytest.raises(ValueError, match="[Dd]uplicate"):
            svc.ingest_transaction(_make_event("TXN-DUP-PERSIST-001"), top_k=5)

    def test_forecast_payload_fields_are_consistent(self, svc):
        """All ForecastUpdatePayload top-location fields must be in valid range/type."""
        event = _make_event("TXN-FIELDS-001")
        result = svc.ingest_transaction(event, top_k=5)

        assert result.top_locations
        top = result.top_locations[0]
        assert 0.0 <= top.forecast_score <= 1.0
        assert 0.0 <= top.risk_score <= 1.0
        assert 0.0 <= top.confidence <= 1.0
        assert 0.0 <= top.mapping_confidence <= 1.0
        assert top.severity in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        assert isinstance(top.alert_eligible, bool)
        assert isinstance(top.factor_contributions, dict)

    def test_trigger_atm_and_forecast_atm_are_distinct_concepts(self, svc):
        """After surging one ATM, trigger_atm_id and forecast top-1 ATM both correct."""
        atm_keys = list(svc.atm_states.keys())
        surge_atm = atm_keys[0]
        base_time = datetime(2023, 5, 1, 1, 0, tzinfo=timezone.utc)

        last_result = None
        for i in range(5):
            evt = TransactionEvent(
                transaction_id=f"TXN-TRIGGER-FORECAST-{i}",
                event_time=base_time + timedelta(minutes=i * 3),
                account_id=f"ACC-MULE-{i}",
                transaction_type="ATM_Withdrawal",
                amount=30000.0,
                atm_id=surge_atm,
                city="Mumbai",
                is_fraud=1 if i >= 3 else 0,
            )
            last_result = svc.ingest_transaction(evt, top_k=10)

        assert last_result is not None
        assert last_result.trigger_atm_id == surge_atm
        assert last_result.top_locations[0].rank == 1
        assert last_result.top_locations[0].atm_id == surge_atm
        assert last_result.top_locations[0].forecast_score > 0.3

    def test_sequential_events_produce_monotonically_increasing_forecast_score(self, svc):
        """A1 forecast_score must not regress >0.05 across sequential events."""
        target_atm = list(svc.atm_states.keys())[0]
        base_time = datetime(2023, 5, 1, 6, 0, tzinfo=timezone.utc)
        scores = []

        for i in range(6):
            evt = TransactionEvent(
                transaction_id=f"TXN-SEQ-{i:04d}",
                event_time=base_time + timedelta(minutes=i * 10),
                account_id="ACC-SEQ-TEST",
                transaction_type="ATM_Withdrawal",
                amount=10000.0,
                atm_id=target_atm,
                city="Mumbai",
                is_fraud=0,
            )
            res = svc.ingest_transaction(evt, top_k=3)
            target_locs = [loc for loc in res.top_locations if loc.atm_id == target_atm]
            if target_locs:
                scores.append(target_locs[0].forecast_score)

        assert len(scores) >= 3
        regressions = sum(1 for a, b in zip(scores, scores[1:]) if b < a - 0.05)
        assert regressions == 0, f"Forecast score regressed unexpectedly: {scores}"

    @pytest.mark.asyncio
    async def test_risk_prediction_stores_forecasted_atm_coordinates(self, svc):
        """RiskPrediction (lat, lon) must match top-1 forecast ATM, not trigger event."""
        event = _make_event(latitude=19.076, longitude=72.877)
        payload = _make_payload(svc, event, top_lat=19.080, top_lon=72.882)
        mock_db = _build_mock_db()

        await svc.persist_ingestion_to_db(event, payload, mock_db)

        from app.models.prediction import RiskPrediction
        pred_rows = [r for r in mock_db._flushed_rows if isinstance(r, RiskPrediction)]
        assert len(pred_rows) == 1
        assert pred_rows[0].latitude == pytest.approx(19.080, abs=0.001)
        assert pred_rows[0].longitude == pytest.approx(72.882, abs=0.001)


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests: in-memory pipeline → payload semantic verification
# ─────────────────────────────────────────────────────────────────────────────

class TestPersistencePipelineIntegration:

    @pytest.fixture(autouse=True)
    def setup(self):
        LiveIngestionService.get_instance().reset_state()
        yield
        LiveIngestionService.get_instance().reset_state()

    def test_non_fraud_low_volume_event_has_no_alert_eligible_true(self):
        """
        A single normal withdrawal may emit a LiveAlertUpdate (severity change
        notification) but its alert_eligible must be False — no DB Alert row
        would be written.
        """
        svc = LiveIngestionService.get_instance()
        event = _make_event("TXN-NORMAL-001", is_fraud=0, amount=2000.0)
        result = svc.ingest_transaction(event)

        for alt in result.alert_updates:
            assert not alt.alert_eligible, (
                f"Normal single event must not have alert_eligible=True; "
                f"got severity={alt.new_severity}"
            )

    def test_fraud_burst_produces_alert_eligible_true(self):
        """Fraud burst must produce at least one alert_eligible=True transition."""
        svc = LiveIngestionService.get_instance()
        atm = list(svc.atm_states.keys())[0]
        base_time = datetime(2023, 5, 1, 2, 0, tzinfo=timezone.utc)

        alert_eligible_seen = False
        for i in range(6):
            evt = TransactionEvent(
                transaction_id=f"TXN-FRAUD-ALERT-RERUN-{i}",
                event_time=base_time + timedelta(minutes=i * 2),
                account_id=f"MULE-{i % 2}",
                transaction_type="ATM_Withdrawal",
                amount=45000.0,
                atm_id=atm,
                city="Mumbai",
                is_fraud=1,
            )
            r = svc.ingest_transaction(evt, top_k=5)
            for alt in r.alert_updates:
                if alt.alert_eligible:
                    alert_eligible_seen = True

        assert alert_eligible_seen, (
            "Fraud burst must produce at least one alert_eligible=True"
        )

    def test_pipeline_latency_is_sub_100ms(self):
        svc = LiveIngestionService.get_instance()
        event = _make_event("TXN-LATENCY-001")
        result = svc.ingest_transaction(event, top_k=10)
        assert result.pipeline_latency_ms < 100.0

    def test_event_time_preserved_in_payload(self):
        svc = LiveIngestionService.get_instance()
        t = datetime(2023, 7, 15, 14, 30, tzinfo=timezone.utc)
        event = _make_event("TXN-TIME-001", event_time=t)
        result = svc.ingest_transaction(event)
        assert "2023-07-15" in result.event_time
        assert "14:30" in result.event_time

    def test_all_top_k_locations_have_required_fields(self):
        svc = LiveIngestionService.get_instance()
        event = _make_event("TXN-FIELDS-CHECK-001")
        result = svc.ingest_transaction(event, top_k=10)

        for i, loc in enumerate(result.top_locations):
            assert loc.rank == i + 1
            assert loc.atm_id
            assert 0.0 <= loc.forecast_score <= 1.0
            assert 0.0 <= loc.risk_score <= 1.0
            assert 0.0 <= loc.confidence <= 1.0
            assert loc.severity in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
            assert isinstance(loc.alert_eligible, bool)
            assert isinstance(loc.factor_contributions, dict)
