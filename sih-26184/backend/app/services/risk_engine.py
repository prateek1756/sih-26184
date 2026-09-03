import math
from typing import Dict, Any, List, Tuple
from decimal import Decimal


class RiskEngine:
    """
    HERMES Composite Risk Scoring Engine
    Combines:
      - ML predicted probability (XGBoost/RandomForest)
      - Domain Rule heuristic score (R01-R06)
      - Temporal recency decay
    """
    W_ML = 0.60
    W_RULE = 0.30
    W_RECENCY = 0.10
    DECAY_LAMBDA = 0.05  # half-life approx 14 days

    @classmethod
    def evaluate_rules(
        cls,
        tx_count_24h: int,
        max_single_amount: float,
        is_mule_account: bool,
        historical_incidents_500m: int,
        is_night_weekend: bool,
        is_pattern_match: bool,
    ) -> Tuple[float, List[str]]:
        rule_score = 0.0
        reasons = []

        # R01: > 5 transactions from same account/cluster in 24h
        if tx_count_24h > 5:
            rule_score += 0.25
            reasons.append(f"Elevated velocity: {tx_count_24h} transactions linked within last 24h")

        # R02: Large single transfer amount > 50,000 INR
        if max_single_amount >= 50000:
            rule_score += 0.15
            reasons.append(f"High-value transfer detected (₹{max_single_amount:,.2f})")

        # R03: Account on mule suspect network
        if is_mule_account:
            rule_score += 0.30
            reasons.append("Flagged mule account network detected in financial transaction path")

        # R04: Historical hotspot proximity (> 3 incidents within 500m)
        if historical_incidents_500m >= 3:
            rule_score += 0.20
            reasons.append(f"Historical incident cluster ({historical_incidents_500m} incidents within 500m)")

        # R05: Similar time-of-day / category pattern match
        if is_pattern_match:
            rule_score += 0.10
            reasons.append("Temporal and MO signature aligns with previous confirmed cash-out campaigns")

        # R06: High-risk window (Weekend + Late Night 10PM - 4AM)
        if is_night_weekend:
            rule_score += 0.10
            reasons.append("High-risk time window (late night / weekend cash-out window)")

        # Normalize rule score to [0.0, 1.0]
        normalized_rule_score = min(rule_score, 1.0)
        return normalized_rule_score, reasons

    @classmethod
    def compute_composite_risk(
        cls,
        ml_score: float,
        rule_score: float,
        days_since_incident: float,
        reasons: List[str],
    ) -> Dict[str, Any]:
        recency_factor = math.exp(-cls.DECAY_LAMBDA * max(0.0, days_since_incident))
        
        final_score = (
            cls.W_ML * ml_score +
            cls.W_RULE * rule_score +
            cls.W_RECENCY * recency_factor
        )
        final_score = max(0.0, min(1.0, final_score))

        # Severity classification
        if final_score >= 0.75:
            severity = "CRITICAL"
        elif final_score >= 0.55:
            severity = "HIGH"
        elif final_score >= 0.30:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Calculate confidence metric
        confidence = round(min(0.95, 0.50 + 0.50 * abs(ml_score - 0.5) * 2), 4)

        return {
            "risk_score": round(final_score, 4),
            "severity": severity,
            "confidence": confidence,
            "reasons": reasons,
            "components": {
                "ml_score": round(ml_score, 4),
                "rule_score": round(rule_score, 4),
                "recency_factor": round(recency_factor, 4),
            }
        }
