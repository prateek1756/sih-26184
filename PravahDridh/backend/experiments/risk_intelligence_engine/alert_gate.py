#!/usr/bin/env python3
"""
SIH PS 26184 — Alert Gate Module
==================================
Separates risk_score from alert_decision.

A high risk_score does NOT automatically create an alert.
Alert eligibility requires corroborating evidence across
primary and secondary signal tiers.

Alert Gate Logic:
  REQUIRED: Primary tier evidence (A1 anomaly OR activity residual surge)
  AND
  CORROBORATING: Secondary tier evidence (account/mule links OR tx velocity burst)
  AND
  QUALITY: confidence >= min_confidence AND data_quality >= min_data_quality

All thresholds are configurable — none are claimed to be calibrated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ── DEFAULT THRESHOLDS (Configurable, not calibrated) ─────────────────────────
DEFAULT_GATE_CONFIG: Dict = {
    # Primary tier: A1 anomaly must cross this signal strength to be "active"
    "primary_anomaly_min_signal": 0.25,
    # Primary tier: Activity residual must cross this to be "active"
    "primary_activity_min_signal": 0.30,
    # Secondary tier: at least one must be active
    "secondary_mule_min_signal": 0.20,
    "secondary_velocity_min_signal": 0.25,
    # Data quality gate: minimum confidence and data quality to allow an alert
    "min_confidence": 0.40,
    "min_data_quality": 0.35,
    # Minimum risk_score for alert eligibility (independent of evidence gate)
    "min_risk_score_for_alert": 0.30,
}


@dataclass
class AlertGateResult:
    """
    Structured alert gate decision with full audit trail.
    Keeps risk_score and alert_eligible as separate quantities.
    """
    risk_score: float
    confidence: float
    mapping_confidence: float
    data_quality: float

    # Alert gate decision (SEPARATE from risk_score)
    alert_eligible: bool
    alert_reason: str                     # Human-readable gate outcome
    required_evidence: List[str]          # Evidence that would have satisfied the gate
    missing_evidence: List[str]           # What was absent or below threshold

    # Signal tier activation summary
    primary_tier_active: bool             # A1 anomaly OR activity residual active
    secondary_tier_active: bool           # Mule/account OR velocity active
    quality_gate_passed: bool             # Confidence + data_quality both sufficient

    # Signal tier strengths (normalized 0..1)
    signal_anomaly_strength: float
    signal_activity_strength: float
    signal_mule_strength: float
    signal_velocity_strength: float

    # Pass-through from engine
    severity: str
    evidence: List[str]
    factor_contributions: Dict[str, float]


class AlertGate:
    """
    Evidence-aware alert gate for the Risk Intelligence Engine.

    A risk_score alone does NOT trigger an alert.
    The gate enforces corroborating evidence from primary + secondary tiers
    with minimum data quality, producing a transparent, auditable decision.
    """

    def __init__(self, config: Optional[Dict] = None):
        self.cfg = config or DEFAULT_GATE_CONFIG

    def evaluate(
        self,
        engine_result: Dict,
        features: Dict,
    ) -> AlertGateResult:
        """
        Takes the engine evaluation result and raw features.
        Returns a structured AlertGateResult with a separate alert_eligible decision.
        """
        risk_score = float(engine_result["risk_score"])
        confidence = float(engine_result["confidence"])
        mapping_confidence = float(engine_result["mapping_confidence"])
        severity = engine_result["severity"]
        evidence = engine_result.get("evidence", [])
        factor_contributions = engine_result.get("factor_contributions", {})

        # ── SIGNAL TIER STRENGTH EXTRACTION ────────────────────────────────────
        act_ratio = float(features.get("activity_ratio_24h", 1.0))
        vel_surge = float(features.get("velocity_surge_24h_vs_7d", 1.0))
        cw_count_24h = float(features.get("recent_cw_count_24h", 0.0))
        base_cw_rate = max(0.01, float(features.get("base_cw_rate_daily", 1.0)))
        mule_accts = float(features.get("connected_mule_accounts_7d", 0.0))
        uniq_surge = float(features.get("unique_account_surge_24h", 1.0))
        amt_ratio = float(features.get("amount_ratio_24h", 1.0))
        act_delta = max(0.0, float(features.get("activity_delta_24h", 0.0)))
        tx_30d = float(features.get("base_tx_count_30d", 0.0))

        # A1 Anomaly signal strength: normalized ratio excess
        s_anomaly = min(1.0, max(0.0, (min(act_ratio, 5.0) / 5.0 * 0.5 + min(vel_surge, 5.0) / 5.0 * 0.5)))
        # Activity residual signal strength
        s_activity = min(1.0, max(0.0, cw_count_24h / (base_cw_rate * 3.0 + 1e-4)))
        # Mule / account behavior signal strength
        s_mule = min(1.0, max(0.0, min(mule_accts, 3.0) / 3.0 * 0.6 + min(uniq_surge, 3.0) / 3.0 * 0.4))
        # Transaction velocity signal strength
        s_velocity = min(1.0, max(0.0, min(amt_ratio, 4.0) / 4.0 * 0.5 + min(act_delta, 10.0) / 10.0 * 0.5))

        # ── DATA QUALITY SCORE (volume + mapping) ──────────────────────────────
        data_quality = round(
            min(1.0, tx_30d / 50.0) * 0.7 + mapping_confidence * 0.3,
            4
        )

        # ── TIER GATE EVALUATION ───────────────────────────────────────────────
        primary_tier_active = (
            s_anomaly >= self.cfg["primary_anomaly_min_signal"]
            or s_activity >= self.cfg["primary_activity_min_signal"]
        )
        secondary_tier_active = (
            s_mule >= self.cfg["secondary_mule_min_signal"]
            or s_velocity >= self.cfg["secondary_velocity_min_signal"]
        )
        quality_gate_passed = (
            confidence >= self.cfg["min_confidence"]
            and data_quality >= self.cfg["min_data_quality"]
        )
        score_gate_passed = risk_score >= self.cfg["min_risk_score_for_alert"]

        alert_eligible = (
            score_gate_passed
            and primary_tier_active
            and secondary_tier_active
            and quality_gate_passed
        )

        # ── AUDIT TRAIL: REASONS & MISSING EVIDENCE ────────────────────────────
        required_evidence = [
            "Primary: A1 anomaly signal >= 0.25 OR activity residual >= 0.30",
            "Secondary: Mule/account signal >= 0.20 OR velocity signal >= 0.25",
            f"Quality: confidence >= {self.cfg['min_confidence']} AND data_quality >= {self.cfg['min_data_quality']}",
            f"Score: risk_score >= {self.cfg['min_risk_score_for_alert']}",
        ]

        missing_evidence: List[str] = []
        if not score_gate_passed:
            missing_evidence.append(
                f"risk_score {risk_score:.4f} below alert minimum {self.cfg['min_risk_score_for_alert']}"
            )
        if not primary_tier_active:
            missing_evidence.append(
                f"Primary tier inactive: A1={s_anomaly:.3f} (need {self.cfg['primary_anomaly_min_signal']}), "
                f"Activity={s_activity:.3f} (need {self.cfg['primary_activity_min_signal']})"
            )
        if not secondary_tier_active:
            missing_evidence.append(
                f"Secondary tier inactive: Mule={s_mule:.3f} (need {self.cfg['secondary_mule_min_signal']}), "
                f"Velocity={s_velocity:.3f} (need {self.cfg['secondary_velocity_min_signal']})"
            )
        if not quality_gate_passed:
            missing_evidence.append(
                f"Quality gate: confidence={confidence:.3f} (need {self.cfg['min_confidence']}), "
                f"data_quality={data_quality:.3f} (need {self.cfg['min_data_quality']})"
            )

        if alert_eligible:
            alert_reason = (
                f"Alert eligible: primary tier active (A1={s_anomaly:.3f}, activity={s_activity:.3f}), "
                f"corroborated by secondary tier (mule={s_mule:.3f}, velocity={s_velocity:.3f}), "
                f"quality gates passed (conf={confidence:.3f}, dq={data_quality:.3f})"
            )
        else:
            alert_reason = (
                "Alert blocked: " + "; ".join(missing_evidence)
                if missing_evidence else "Alert blocked: insufficient evidence"
            )

        return AlertGateResult(
            risk_score=round(risk_score, 4),
            confidence=round(confidence, 4),
            mapping_confidence=round(mapping_confidence, 4),
            data_quality=data_quality,
            alert_eligible=alert_eligible,
            alert_reason=alert_reason,
            required_evidence=required_evidence,
            missing_evidence=missing_evidence,
            primary_tier_active=primary_tier_active,
            secondary_tier_active=secondary_tier_active,
            quality_gate_passed=quality_gate_passed,
            signal_anomaly_strength=round(s_anomaly, 4),
            signal_activity_strength=round(s_activity, 4),
            signal_mule_strength=round(s_mule, 4),
            signal_velocity_strength=round(s_velocity, 4),
            severity=severity,
            evidence=evidence,
            factor_contributions=factor_contributions,
        )
