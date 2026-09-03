"""
SIH PS 26184 — Risk Intelligence API Integration Tests
======================================================
End-to-end integration validation for the newly prepared Risk Intelligence API.

Validates:
1. Authentication & RBAC enforcement (401/403 on protected routes)
2. Request validation & error handling (422 on invalid/missing payloads)
3. POST /api/v1/risk/evaluate (Single ATM evaluation with Alert Gate)
4. POST /api/v1/risk/top (Cohort ranking using A1 primary signal)
5. GET /api/v1/risk/atm/{atm_id} (ATM quick risk evaluation)
6. GET /api/v1/risk/explanations/{atm_id} (Full structured audit explanation)
7. Independence of risk_score and alert_eligible
8. A1 as primary ranking discriminator (not equal-weight composite)
9. Non-regression of existing routes (/predictions, /alerts, /complaints, /investigations)
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.deps import get_current_user
from app.models.user import User


# ── Test Client ───────────────────────────────────────────────────────────────
client = TestClient(app)


# ── Mock Users for RBAC ───────────────────────────────────────────────────────
def make_mock_user(role: str = "ANALYST") -> User:
    return User(
        id=uuid.uuid4(),
        email=f"test_{role.lower()}@hermes.gov.in",
        full_name=f"Test {role}",
        badge_number=f"BDG-{role[:3]}",
        agency="I4C Investigation Wing",
        role=role,
        is_active=True,
    )


# ── Deterministic Feature Fixtures ────────────────────────────────────────────
BASELINE_FEATURES = {
    "activity_ratio_24h": 1.0,
    "velocity_surge_24h_vs_7d": 1.0,
    "base_cw_rate_daily": 2.0,
    "recent_cw_count_24h": 2.0,
    "amount_ratio_24h": 1.0,
    "activity_delta_24h": 0.0,
    "connected_mule_accounts_7d": 0.0,
    "unique_account_surge_24h": 1.0,
    "suspicious_density_city_7d": 0.0,
    "hours_since_last_fraud": 720.0,
    "atm_cluster_density": 2.0,
    "is_weekend": 0.0,
    "hour_of_day": 12.0,
    "base_tx_count_30d": 60.0,
}

SURGE_WITH_MULE_FEATURES = {
    "activity_ratio_24h": 4.2,
    "velocity_surge_24h_vs_7d": 3.5,
    "base_cw_rate_daily": 2.0,
    "recent_cw_count_24h": 8.0,
    "amount_ratio_24h": 2.2,
    "activity_delta_24h": 6.0,
    "connected_mule_accounts_7d": 2.0,
    "unique_account_surge_24h": 2.5,
    "suspicious_density_city_7d": 5.0,
    "hours_since_last_fraud": 12.0,
    "atm_cluster_density": 4.0,
    "is_weekend": 1.0,
    "hour_of_day": 23.0,
    "base_tx_count_30d": 100.0,
}

SURGE_WITHOUT_MULE_FEATURES = {
    **BASELINE_FEATURES,
    "activity_ratio_24h": 3.8,
    "velocity_surge_24h_vs_7d": 2.9,
    "connected_mule_accounts_7d": 0.0,
    "unique_account_surge_24h": 1.0,
    "base_tx_count_30d": 10.0,  # Low data quality
}


# =============================================================================
# 1. AUTHENTICATION & RBAC VALIDATION
# =============================================================================

class TestAuthenticationAndRBAC:

    def test_unauthenticated_evaluate_rejected(self):
        """Unauthenticated POST /api/v1/risk/evaluate must be rejected (401 or 403)."""
        app.dependency_overrides.clear()
        response = client.post(
            "/api/v1/risk/evaluate",
            json={"atm_id": "ATM-MUM-001", "features": BASELINE_FEATURES},
        )
        assert response.status_code in [401, 403]

    def test_unauthenticated_top_rejected(self):
        """Unauthenticated POST /api/v1/risk/top must be rejected."""
        app.dependency_overrides.clear()
        response = client.post(
            "/api/v1/risk/top",
            json=[{"atm_id": "ATM-MUM-001", "features": BASELINE_FEATURES}],
        )
        assert response.status_code in [401, 403]

    def test_unauthenticated_atm_lookup_rejected(self):
        """Unauthenticated GET /api/v1/risk/atm/{atm_id} must be rejected."""
        app.dependency_overrides.clear()
        response = client.get("/api/v1/risk/atm/ATM-MUM-001")
        assert response.status_code in [401, 403]

    def test_rbac_explanations_denied_for_viewer(self):
        """Role VIEWER must be rejected (403) from accessing full explanations."""
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="VIEWER")
        response = client.get("/api/v1/risk/explanations/ATM-MUM-001")
        assert response.status_code == 403
        app.dependency_overrides.clear()

    def test_rbac_explanations_allowed_for_analyst(self):
        """Role ANALYST must be allowed (200) to access full explanations."""
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        response = client.get("/api/v1/risk/explanations/ATM-MUM-001")
        assert response.status_code == 200
        app.dependency_overrides.clear()


# =============================================================================
# 2. REQUEST VALIDATION & ERROR HANDLING
# =============================================================================

class TestRequestValidation:

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        yield
        app.dependency_overrides.clear()

    def test_missing_features_returns_422(self):
        """Missing features payload must return 422 Unprocessable Entity."""
        response = client.post("/api/v1/risk/evaluate", json={"atm_id": "ATM-TEST-001"})
        assert response.status_code == 422

    def test_missing_atm_id_returns_422(self):
        """Missing atm_id must return 422."""
        response = client.post("/api/v1/risk/evaluate", json={"features": BASELINE_FEATURES})
        assert response.status_code == 422

    def test_invalid_spatial_radius_returns_422(self):
        """Negative spatial radius must return 422."""
        response = client.post(
            "/api/v1/risk/evaluate",
            json={"atm_id": "ATM-TEST-001", "features": BASELINE_FEATURES, "spatial_radius_km": -5.0},
        )
        assert response.status_code == 422


# =============================================================================
# 3. END-TO-END RISK EVALUATION (POST /evaluate)
# =============================================================================

class TestRiskEvaluationEndpoint:

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ANALYST")
        yield
        app.dependency_overrides.clear()

    def test_evaluate_baseline_atm(self):
        """Baseline ATM evaluation returns valid bounded response with alert_eligible=False."""
        payload = {
            "atm_id": "ATM-DEL-0012",
            "features": BASELINE_FEATURES,
            "spatial_radius_km": 2.0,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        data = body["data"]

        # Core Contract Validations
        assert data["atm_id"] == "ATM-DEL-0012"
        assert 0.0 <= data["risk_score"] <= 1.0
        assert 0.0 <= data["confidence"] <= 1.0
        assert 0.0 <= data["mapping_confidence"] <= 1.0
        assert data["severity"] == "LOW"
        assert data["alert_eligible"] is False
        assert "prediction_window" in data
        assert "engine_version" in data
        assert len(data["evidence"]) > 0

    def test_evaluate_surge_atm_with_mule_alerts(self):
        """Surge ATM with mule links and high volume produces alert_eligible=True."""
        payload = {
            "atm_id": "ATM-MUM-0088",
            "features": SURGE_WITH_MULE_FEATURES,
            "spatial_radius_km": 2.0,
            "mapping_distance_km": 0.25,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()["data"]

        assert data["risk_score"] > 0.30
        assert data["severity"] in ["MEDIUM", "HIGH", "CRITICAL"]
        assert data["alert_eligible"] is True
        assert data["alert_gate"]["primary_tier_active"] is True
        assert data["alert_gate"]["secondary_tier_active"] is True
        assert data["alert_gate"]["quality_gate_passed"] is True
        assert any("mule" in e.lower() for e in data["evidence"])

    def test_risk_score_and_alert_eligible_are_independent(self):
        """High activity surge without mule corroboration and low data quality blocks alert."""
        payload = {
            "atm_id": "ATM-BLR-0044",
            "features": SURGE_WITHOUT_MULE_FEATURES,
            "spatial_radius_km": 2.0,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()["data"]

        # Score is elevated, but alert gate blocks it due to lack of secondary corroboration
        assert data["risk_score"] > 0.15
        assert data["alert_eligible"] is False
        assert len(data["alert_gate"]["missing_evidence"]) > 0


# =============================================================================
# 4. COHORT RANKING & A1 PRIMARY DISCRIMINATOR (POST /top)
# =============================================================================

class TestCohortRankingEndpoint:

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="SUPERVISOR")
        yield
        app.dependency_overrides.clear()

    def test_cohort_ranking_uses_a1_primary_discriminator(self):
        """
        Verifies that ATMs in a cohort are ranked primarily by A1 Robust Z-Score surge.
        ATM-SURGE (A1=4.2x) must rank #1 over ATM-BASELINE (A1=1.0x) regardless of other factors.
        """
        cohort = [
            {"atm_id": "ATM-BASELINE-01", "city": "Mumbai", "features": BASELINE_FEATURES},
            {"atm_id": "ATM-SURGE-02", "city": "Mumbai", "features": SURGE_WITH_MULE_FEATURES},
            {"atm_id": "ATM-MILD-03", "city": "Mumbai", "features": {**BASELINE_FEATURES, "activity_ratio_24h": 2.0}},
        ]
        response = client.post("/api/v1/risk/top?k=3", json=cohort)
        assert response.status_code == 200
        ranked = response.json()["data"]

        assert len(ranked) == 3
        # Rank 1 must be the highest A1 anomaly
        assert ranked[0]["atm_id"] == "ATM-SURGE-02"
        assert ranked[0]["rank"] == 1
        assert ranked[1]["atm_id"] == "ATM-MILD-03"
        assert ranked[1]["rank"] == 2
        assert ranked[2]["atm_id"] == "ATM-BASELINE-01"
        assert ranked[2]["rank"] == 3


# =============================================================================
# 5. ATM LOOKUP & EXPLANATION ENDPOINTS (GET)
# =============================================================================

class TestAtmLookupAndExplanations:

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        app.dependency_overrides[get_current_user] = lambda: make_mock_user(role="ADMIN")
        yield
        app.dependency_overrides.clear()

    def test_get_atm_quick_risk(self):
        """GET /api/v1/risk/atm/{atm_id} returns a valid baseline evaluation."""
        response = client.get("/api/v1/risk/atm/ATM-CHE-0057")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["atm_id"] == "ATM-CHE-0057"
        assert 0.0 <= data["risk_score"] <= 1.0
        assert data["severity"] == "LOW"

    def test_get_atm_explanations(self):
        """GET /api/v1/risk/explanations/{atm_id} returns complete factor & signal breakdown."""
        response = client.get("/api/v1/risk/explanations/ATM-CHE-0057")
        assert response.status_code == 200
        data = response.json()["data"]

        assert data["atm_id"] == "ATM-CHE-0057"
        assert "factor_contributions" in data
        assert "signal_strengths" in data
        assert "a1_anomaly" in data["signal_strengths"]
        assert "mule_behavior" in data["signal_strengths"]
        assert "alert_reason" in data


# =============================================================================
# 6. ROUTE NON-REGRESSION VALIDATION
# =============================================================================

class TestRouteNonRegression:

    def test_openapi_includes_both_existing_and_new_routes(self):
        """OpenAPI spec must retain all existing routes alongside the new /risk/* endpoints."""
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        paths = response.json()["paths"]

        # Existing Production Routes (must remain completely intact)
        assert "/api/v1/auth/login" in paths
        assert "/api/v1/complaints" in paths
        assert "/api/v1/predictions" in paths
        assert "/api/v1/predictions/hotspots" in paths
        assert "/api/v1/predictions/top-k" in paths
        assert "/api/v1/alerts" in paths
        assert "/api/v1/investigations" in paths
        assert "/api/v1/audit/events" in paths
        assert "/api/v1/models" in paths

        # New Risk Intelligence Routes
        assert "/api/v1/risk/evaluate" in paths
        assert "/api/v1/risk/top" in paths
        assert "/api/v1/risk/atm/{atm_id}" in paths
        assert "/api/v1/risk/explanations/{atm_id}" in paths
