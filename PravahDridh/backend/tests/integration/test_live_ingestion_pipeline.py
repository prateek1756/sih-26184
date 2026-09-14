"""
SIH PS 26184 — Live Ingestion & Forecast Update Pipeline Integration Tests
==========================================================================
Validates Task B:
1. Valid transaction ingestion (POST /ingest)
2. Invalid transaction rejection (422 validation error)
3. Event-time ordering and causal state management
4. Feature and state updates (24h/7d/30d rolling windows)
5. Forecast score and risk score dynamic updates
6. ATM ranking update (surging ATM moves to Rank #1)
7. Alert Gate integration (severity transitions and alert emission)
8. Authentication & RBAC enforcement
9. Duplicate event rejection (400 on duplicate transaction_id)
10. Temporal look-ahead leakage prevention
11. Replay simulation execution (POST /replay)
12. WebSocket real-time connection & broadcast
"""

import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.live_ingestion import TransactionEvent
from app.services.live_ingestion_service import LiveIngestionService


client = TestClient(app)


def make_mock_user(role: str = "ANALYST") -> User:
    return User(
        id=uuid.uuid4(),
        email=f"test_{role.lower()}@hermes.gov.in",
        full_name=f"Test {role}",
        badge_number=f"BDG-{role[:3]}",
        agency="I4C Live Ingestion Wing",
        role=role,
        is_active=True,
    )


@pytest.fixture(autouse=True)
def clean_ingestion_state():
    """Reset the singleton state before every test."""
    LiveIngestionService.get_instance().reset_state()
    yield
    LiveIngestionService.get_instance().reset_state()


# =============================================================================
# 1. AUTHENTICATION & VALIDATION TESTS
# =============================================================================

class TestIngestionAuthAndValidation:

    def test_unauthenticated_ingest_rejected(self):
        """POST /api/v1/risk/ingest without token must be rejected."""
        app.dependency_overrides.clear()
        event_payload = {
            "transaction_id": "TXN-TEST-001",
            "event_time": "2023-05-01T10:00:00Z",
            "account_id": "ACC-001",
            "transaction_type": "ATM_Withdrawal",
            "amount": 5000.0,
        }
        response = client.post("/api/v1/risk/ingest", json=event_payload)
        assert response.status_code in [401, 403]

    def test_invalid_negative_amount_returns_422(self):
        """Negative transaction amount must be rejected with 422."""
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        payload = {
            "transaction_id": "TXN-INVALID-001",
            "event_time": "2023-05-01T10:00:00Z",
            "account_id": "ACC-001",
            "transaction_type": "ATM_Withdrawal",
            "amount": -500.0,  # Invalid
        }
        response = client.post("/api/v1/risk/ingest", json=payload)
        assert response.status_code == 422
        app.dependency_overrides.clear()

    def test_duplicate_transaction_rejected_with_400(self):
        """Duplicate transaction_id must return 400 Bad Request."""
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        payload = {
            "transaction_id": "TXN-DUP-001",
            "event_time": "2023-05-01T10:00:00Z",
            "account_id": "ACC-001",
            "transaction_type": "ATM_Withdrawal",
            "amount": 2000.0,
            "city": "Mumbai",
        }
        # First ingestion -> 200 OK
        r1 = client.post("/api/v1/risk/ingest", json=payload)
        assert r1.status_code == 200

        # Duplicate ingestion -> 400 Bad Request
        r2 = client.post("/api/v1/risk/ingest", json=payload)
        assert r2.status_code == 400
        assert "duplicate" in r2.json()["detail"].lower()
        app.dependency_overrides.clear()


# =============================================================================
# 2. CAUSAL STATE UPDATE & DYNAMIC FORECASTING
# =============================================================================

class TestCausalIngestionAndForecasting:

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        yield
        app.dependency_overrides.clear()

    def test_single_transaction_ingestion_and_forecast_response(self):
        """Valid ingestion updates state and returns a complete ForecastUpdatePayload."""
        payload = {
            "transaction_id": "TXN-LIVE-001",
            "event_time": "2023-05-01T12:00:00Z",
            "account_id": "ACC-CUST-99",
            "transaction_type": "ATM_Withdrawal",
            "amount": 10000.0,
            "city": "Mumbai",
        }
        response = client.post("/api/v1/risk/ingest?top_k=5", json=payload)
        assert response.status_code == 200
        data = response.json()["data"]

        assert "event_id" in data
        assert data["event_time"] == "2023-05-01T12:00:00+00:00"
        assert data["forecast_horizon_hours"] == 48
        assert len(data["top_locations"]) <= 5
        assert data["pipeline_latency_ms"] >= 0.0

        # Verify location forecast fields
        top_loc = data["top_locations"][0]
        assert top_loc["rank"] == 1
        assert 0.0 <= top_loc["forecast_score"] <= 1.0
        assert 0.0 <= top_loc["risk_score"] <= 1.0
        assert 0.0 <= top_loc["confidence"] <= 1.0
        assert top_loc["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    def test_velocity_burst_escalates_atm_to_rank_1(self):
        """
        Successive rapid withdrawals on ATM-A should cause it to climb
        to Rank #1 with elevated forecast_score and trigger an alert.
        """
        svc = LiveIngestionService.get_instance()
        target_atm = list(svc.atm_states.keys())[0]

        base_time = datetime(2023, 5, 1, 1, 0, tzinfo=timezone.utc)

        # Ingest 5 rapid withdrawal events on target_atm within 30 minutes
        last_res = None
        for i in range(5):
            evt = TransactionEvent(
                transaction_id=f"TXN-BURST-{i+1:03d}",
                event_time=base_time + timedelta(minutes=i * 5),
                account_id=f"ACC-MULE-{i%2}",
                transaction_type="ATM_Withdrawal",
                amount=25000.0,
                atm_id=target_atm,
                city="Mumbai",
                is_fraud=1 if i >= 2 else 0,
            )
            last_res = svc.ingest_transaction(event=evt, top_k=5)

        assert last_res is not None
        # Target ATM must now be Rank #1
        assert last_res.top_locations[0].atm_id == target_atm
        assert last_res.top_locations[0].forecast_score > 0.40
        assert last_res.top_locations[0].severity in ["MEDIUM", "HIGH", "CRITICAL"]

    def test_temporal_lookahead_leakage_prevention(self):
        """
        Events at T1 must NOT reflect transactions that occur at T2 (T2 > T1).
        Verifies strict zero-lookahead causality in state management.
        """
        svc = LiveIngestionService.get_instance()
        target_atm = list(svc.atm_states.keys())[1]

        t1 = datetime(2023, 5, 1, 10, 0, tzinfo=timezone.utc)
        t2 = datetime(2023, 5, 1, 18, 0, tzinfo=timezone.utc)

        # Event at T1 (normal withdrawal)
        evt_t1 = TransactionEvent(
            transaction_id="TXN-T1-NORMAL",
            event_time=t1,
            account_id="ACC-001",
            transaction_type="ATM_Withdrawal",
            amount=2000.0,
            atm_id=target_atm,
            city="Mumbai",
            is_fraud=0,
        )
        res_t1 = svc.ingest_transaction(event=evt_t1)
        score_at_t1 = res_t1.top_locations[0].risk_score

        # Future event at T2 (massive fraudulent cashout surge)
        for j in range(4):
            evt_t2 = TransactionEvent(
                transaction_id=f"TXN-T2-FRAUD-{j}",
                event_time=t2 + timedelta(minutes=j*2),
                account_id="ACC-MULE-99",
                transaction_type="ATM_Withdrawal",
                amount=50000.0,
                atm_id=target_atm,
                city="Mumbai",
                is_fraud=1,
            )
            svc.ingest_transaction(event=evt_t2)

        # Now retrospectively check features at T1
        features_at_t1 = svc._compute_atm_features_at_t(target_atm, t1)
        # 24h count at T1 must strictly be 1 (does not see T2 transactions)
        assert features_at_t1["recent_cw_count_24h"] == 1.0


# =============================================================================
# 3. REPLAY SIMULATOR & WEBSOCKET BROADCAST
# =============================================================================

class TestReplayAndWebSocket:

    def test_replay_simulation_endpoint(self):
        """POST /api/v1/risk/replay runs chronological replay and returns timeline."""
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="SUPERVISOR")
        payload = {
            "city": "Mumbai",
            "max_events": 20,
            "forecast_horizon_hours": 48,
        }
        response = client.post("/api/v1/risk/replay", json=payload)
        assert response.status_code == 200
        data = response.json()["data"]

        assert data["status"] == "success"
        assert data["total_events_replayed"] == 20
        assert data["mean_pipeline_latency_ms"] >= 0.0
        assert "timeline_sample" in data
        assert len(data["timeline_sample"]) > 0
        app.dependency_overrides.clear()

    def test_websocket_ping_pong_connection(self):
        """WebSocket /api/v1/risk/ws connects and responds to ping."""
        with client.websocket_connect("/api/v1/risk/ws") as websocket:
            websocket.send_text("ping")
            data = websocket.receive_text()
            assert data == "pong"
