import pytest
from app.services.risk_engine import RiskEngine


def test_rule_evaluation_r01_velocity():
    score, reasons = RiskEngine.evaluate_rules(
        tx_count_24h=8,
        max_single_amount=15000,
        is_mule_account=False,
        historical_incidents_500m=0,
        is_night_weekend=False,
        is_pattern_match=False,
    )
    assert score >= 0.25
    assert any("Elevated velocity" in r for r in reasons)


def test_rule_evaluation_multi_triggers():
    score, reasons = RiskEngine.evaluate_rules(
        tx_count_24h=6,
        max_single_amount=80000,
        is_mule_account=True,
        historical_incidents_500m=4,
        is_night_weekend=True,
        is_pattern_match=True,
    )
    assert score >= 0.70
    assert len(reasons) >= 4


def test_composite_risk_scoring_severity_critical():
    result = RiskEngine.compute_composite_risk(
        ml_score=0.88,
        rule_score=0.85,
        days_since_incident=0.2,
        reasons=["High transaction velocity", "Mule account detected"],
    )
    assert result["risk_score"] >= 0.75
    assert result["severity"] == "CRITICAL"
    assert result["confidence"] >= 0.70


def test_composite_risk_scoring_severity_low():
    result = RiskEngine.compute_composite_risk(
        ml_score=0.08,
        rule_score=0.0,
        days_since_incident=25.0,
        reasons=["Baseline monitoring"],
    )
    assert result["risk_score"] < 0.30
    assert result["severity"] == "LOW"
