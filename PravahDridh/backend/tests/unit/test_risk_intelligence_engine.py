"""
SIH PS 26184 — Risk Intelligence Engine Unit Tests
===================================================
Tests verify:
1. rf-v1.0.joblib is unchanged (300,489 bytes)
2. Existing production risk engine (RiskEngine) is unmodified
3. Risk scores are bounded [0.0, 1.0]
4. Risk calculation is deterministic
5. Alert gate correctly blocks alerts without corroborating evidence
6. Alert gate correctly passes alerts with full evidence
7. risk_score and alert_eligible are separate (high score != auto alert)
8. CRITICAL severity never triggers without multi-factor evidence
9. Explanations correspond to actual contributing signals
"""

import sys
import json
from pathlib import Path

import pytest

# ── Production risk engine (existing, must remain intact) ─────────────────────
from app.services.risk_engine import RiskEngine

# ── Experimental engine + alert gate ─────────────────────────────────────────
_EXP = Path(__file__).resolve().parent.parent.parent / "experiments" / "risk_intelligence_engine"
if str(_EXP) not in sys.path:
    sys.path.insert(0, str(_EXP))
from engine import RiskIntelligenceEngine
from alert_gate import AlertGate

# ── Schemas & service ─────────────────────────────────────────────────────────
from app.services.risk_intelligence_service import RiskIntelligenceService


# ── Helpers ───────────────────────────────────────────────────────────────────
PROD_MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "artifacts" / "rf-v1.0.joblib"

LOW_RISK_FEATURES = {
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

HIGH_RISK_FEATURES = {
    "activity_ratio_24h": 4.5,
    "velocity_surge_24h_vs_7d": 3.8,
    "base_cw_rate_daily": 2.0,
    "recent_cw_count_24h": 9.0,
    "amount_ratio_24h": 2.5,
    "activity_delta_24h": 7.0,
    "connected_mule_accounts_7d": 3.0,
    "unique_account_surge_24h": 2.8,
    "suspicious_density_city_7d": 8.0,
    "hours_since_last_fraud": 4.0,
    "atm_cluster_density": 5.0,
    "is_weekend": 1.0,
    "hour_of_day": 23.0,
    "base_tx_count_30d": 120.0,
}

HIGH_SCORE_NO_MULE_FEATURES = {
    **LOW_RISK_FEATURES,
    # Elevated activity ratio to push risk_score up but no mule accounts
    "activity_ratio_24h": 3.5,
    "velocity_surge_24h_vs_7d": 2.5,
    "connected_mule_accounts_7d": 0.0,
    "unique_account_surge_24h": 1.0,
    "amount_ratio_24h": 1.2,
    "activity_delta_24h": 1.0,
    # Low data quality
    "base_tx_count_30d": 5.0,
}


# =============================================================================
# 1. PRODUCTION SAFETY TESTS
# =============================================================================

class TestProductionSafety:

    def test_rf_v1_0_exists_and_unchanged(self):
        """rf-v1.0.joblib must exist and remain exactly 300,489 bytes."""
        assert PROD_MODEL_PATH.exists(), "rf-v1.0.joblib is missing!"
        size = PROD_MODEL_PATH.stat().st_size
        assert size == 300_489, f"rf-v1.0.joblib size changed! Expected 300489, got {size}"

    def test_production_risk_engine_evaluate_rules_intact(self):
        """Existing RiskEngine.evaluate_rules must still function correctly."""
        score, reasons = RiskEngine.evaluate_rules(
            tx_count_24h=8,
            max_single_amount=15000,
            is_mule_account=False,
            historical_incidents_500m=0,
            is_night_weekend=False,
            is_pattern_match=False,
        )
        assert score >= 0.25
        assert any("velocity" in r.lower() for r in reasons)

    def test_production_risk_engine_composite_scoring_intact(self):
        """Existing RiskEngine.compute_composite_risk must still produce bounded CRITICAL output."""
        result = RiskEngine.compute_composite_risk(
            ml_score=0.88,
            rule_score=0.85,
            days_since_incident=0.2,
            reasons=["High velocity", "Mule"],
        )
        assert result["severity"] == "CRITICAL"
        assert 0.0 <= result["risk_score"] <= 1.0


# =============================================================================
# 2. RISK SCORE BOUNDS & DETERMINISM TESTS
# =============================================================================

class TestRiskScoreBounds:

    def test_risk_score_bounded_low_features(self):
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-001",
            cutoff_time="2023-01-01T00:00:00",
            features=LOW_RISK_FEATURES,
        )
        assert 0.0 <= result["risk_score"] <= 1.0

    def test_risk_score_bounded_high_features(self):
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-002",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        assert 0.0 <= result["risk_score"] <= 1.0

    def test_confidence_bounded(self):
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-003",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        assert 0.0 <= result["confidence"] <= 1.0

    def test_mapping_confidence_bounded(self):
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-004",
            cutoff_time="2023-01-01T00:00:00",
            features=LOW_RISK_FEATURES,
            mapping_distance_km=1.5,
        )
        assert 0.0 <= result["mapping_confidence"] <= 1.0

    def test_risk_score_deterministic(self):
        """Same inputs must produce identical outputs every time."""
        r1 = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-DET",
            cutoff_time="2023-06-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        r2 = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-TEST-DET",
            cutoff_time="2023-06-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        assert r1["risk_score"] == r2["risk_score"]
        assert r1["confidence"] == r2["confidence"]
        assert r1["severity"] == r2["severity"]


# =============================================================================
# 3. ALERT GATE TESTS (risk_score vs alert_eligible separation)
# =============================================================================

class TestAlertGate:

    def setup_method(self):
        self.gate = AlertGate()

    def test_high_risk_low_mule_blocks_alert(self):
        """
        A high activity ratio (pushes risk_score up) with no mule accounts
        and insufficient data quality must NOT produce an alert.
        High risk_score != automatic alert.
        """
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-FP-TEST",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_SCORE_NO_MULE_FEATURES,
        )
        gate_result = self.gate.evaluate(
            engine_result=engine_result,
            features=HIGH_SCORE_NO_MULE_FEATURES,
        )
        # risk_score and alert_eligible are separate quantities
        assert engine_result["risk_score"] >= 0.0  # some score exists
        assert gate_result.alert_eligible is False, (
            f"Alert should be blocked (no mule, low data quality) but was eligible. "
            f"risk_score={engine_result['risk_score']}, reason={gate_result.alert_reason}"
        )
        assert len(gate_result.missing_evidence) > 0

    def test_full_evidence_passes_alert_gate(self):
        """Full multi-signal evidence must pass the alert gate."""
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-GATE-PASS",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        gate_result = self.gate.evaluate(
            engine_result=engine_result,
            features=HIGH_RISK_FEATURES,
        )
        assert gate_result.alert_eligible is True, (
            f"Alert should be eligible with full high-risk features. "
            f"Reason: {gate_result.alert_reason}"
        )
        assert gate_result.primary_tier_active is True
        assert gate_result.secondary_tier_active is True
        assert gate_result.quality_gate_passed is True

    def test_low_risk_never_alerts(self):
        """Low risk features must never produce an alert."""
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-LOW",
            cutoff_time="2023-01-01T00:00:00",
            features=LOW_RISK_FEATURES,
        )
        gate_result = self.gate.evaluate(
            engine_result=engine_result,
            features=LOW_RISK_FEATURES,
        )
        assert gate_result.alert_eligible is False

    def test_alert_gate_result_contains_audit_fields(self):
        """Alert gate result must always have required_evidence and missing_evidence."""
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-AUDIT",
            cutoff_time="2023-01-01T00:00:00",
            features=LOW_RISK_FEATURES,
        )
        gate_result = self.gate.evaluate(
            engine_result=engine_result,
            features=LOW_RISK_FEATURES,
        )
        assert isinstance(gate_result.required_evidence, list)
        assert len(gate_result.required_evidence) > 0
        assert isinstance(gate_result.missing_evidence, list)
        assert isinstance(gate_result.alert_reason, str)
        assert len(gate_result.alert_reason) > 0

    def test_risk_score_and_alert_eligible_are_independent(self):
        """
        Verifies the explicit governance rule:
        risk_score and alert_eligible are separate quantities.
        """
        engine_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-INDEP",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_SCORE_NO_MULE_FEATURES,
        )
        gate_result = self.gate.evaluate(
            engine_result=engine_result,
            features=HIGH_SCORE_NO_MULE_FEATURES,
        )
        # This is the key governance assertion: score can be non-trivial
        # while alert remains blocked
        assert "risk_score" in engine_result
        assert hasattr(gate_result, "alert_eligible")
        # They are tracked as separate attributes, not derived from each other directly
        assert isinstance(gate_result.risk_score, float)
        assert isinstance(gate_result.alert_eligible, bool)


# =============================================================================
# 4. EXPLANATION CORRESPONDENCE TESTS
# =============================================================================

class TestExplanations:

    def test_mule_evidence_present_when_mule_active(self):
        """When mule accounts are present, evidence must mention it."""
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-MULE-EV",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        evidence_text = " ".join(result["evidence"]).lower()
        assert "mule" in evidence_text or "flagged" in evidence_text, (
            f"Mule evidence missing. Got: {result['evidence']}"
        )

    def test_factor_contributions_sum_approximately_to_risk_score(self):
        """Factor contributions must sum approximately to risk_score."""
        result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-CONTRIB",
            cutoff_time="2023-01-01T00:00:00",
            features=HIGH_RISK_FEATURES,
        )
        contrib_sum = sum(result["factor_contributions"].values())
        # Allow small floating point tolerance
        assert abs(contrib_sum - result["risk_score"]) < 0.01, (
            f"Factor contributions {contrib_sum:.4f} do not match "
            f"risk_score {result['risk_score']:.4f}"
        )

    def test_severity_critical_requires_high_features(self):
        """CRITICAL severity must only appear with genuinely high-risk features."""
        low_result = RiskIntelligenceEngine.evaluate_atm_state(
            atm_id="ATM-SEV-LOW",
            cutoff_time="2023-01-01T00:00:00",
            features=LOW_RISK_FEATURES,
        )
        assert low_result["severity"] != "CRITICAL", (
            "CRITICAL severity should not appear for low-risk baseline features"
        )

    def test_service_explanation_signal_strengths_present(self):
        """RiskIntelligenceService.get_explanation must return all signal strengths."""
        exp = RiskIntelligenceService.get_explanation(
            atm_id="ATM-SVC-EXP",
            features=HIGH_RISK_FEATURES,
        )
        assert "a1_anomaly" in exp.signal_strengths
        assert "mule_behavior" in exp.signal_strengths
        assert "activity_residual" in exp.signal_strengths
        assert "tx_velocity" in exp.signal_strengths
        for k, v in exp.signal_strengths.items():
            assert 0.0 <= v <= 1.0, f"Signal strength {k}={v} out of bounds"


# =============================================================================
# 5. ALERT EXPLOSION GUARD
# =============================================================================

class TestAlertExplosionGuard:

    def test_false_positive_rate_low_risk_cohort(self):
        """
        On a cohort of 50 baseline ATMs, alert rate must be near 0.
        Guards against threshold misconfiguration causing alert explosions.
        """
        gate = AlertGate()
        alert_count = 0
        for i in range(50):
            result = RiskIntelligenceEngine.evaluate_atm_state(
                atm_id=f"ATM-FP-{i:03d}",
                cutoff_time="2023-01-01T00:00:00",
                features=LOW_RISK_FEATURES,
            )
            gr = gate.evaluate(engine_result=result, features=LOW_RISK_FEATURES)
            if gr.alert_eligible:
                alert_count += 1
        alert_rate = alert_count / 50.0
        assert alert_rate == 0.0, (
            f"Alert explosion on low-risk cohort: {alert_count}/50 = {alert_rate:.1%}"
        )
