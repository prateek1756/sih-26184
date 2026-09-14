#!/usr/bin/env python3
"""
SIH PS 26184 — Risk Intelligence Engine
========================================
Deterministic, Explainable Risk Scoring Engine.
Treats A1 Anomaly and Activity Forecasting as supporting signals.
Maintains separate risk_score, confidence, and mapping_confidence.
Generates structured audit explanations with concrete evidence strings.
"""

import json
import math
from typing import Dict, Any, List, Optional
from pathlib import Path
import numpy as np
import pandas as pd

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
with open(CONFIG_PATH) as f:
    CFG = json.load(f)

# Build experimental weights from frozen signal_hierarchy config
def _build_weights_from_config(cfg: dict) -> dict:
    hier = cfg.get("signal_hierarchy", {})
    w = {}
    primary = hier.get("PRIMARY", {})
    secondary = hier.get("SECONDARY", {})
    supporting = hier.get("SUPPORTING", [])
    context = hier.get("CONTEXTUAL_EVIDENCE", [])
    if primary:
        w["anomaly_zscore"] = primary.get("weight", 0.40)
    if secondary:
        w["account_mule_behavior"] = secondary.get("weight", 0.25)
    for sig in supporting:
        if sig["signal"] == "activity_forecast_residual":
            w["activity_residual"] = sig.get("weight", 0.15)
        elif sig["signal"] == "transaction_velocity":
            w["transaction_velocity"] = sig.get("weight", 0.10)
    spatial_w = temporal_w = graph_w = 0.0
    for sig in context:
        if sig["signal"] == "graph_proximity":
            graph_w = sig.get("weight", 0.05)
        elif sig["signal"] == "spatial_cluster":
            spatial_w = sig.get("weight", 0.025)
        elif sig["signal"] == "temporal_window":
            temporal_w = sig.get("weight", 0.025)
    w["graph_proximity"] = graph_w
    w["spatial_temporal_hotspot"] = spatial_w + temporal_w
    return w

EXPERIMENTAL_WEIGHTS = _build_weights_from_config(CFG)
THRESHOLDS = CFG.get("severity_thresholds", {"LOW": 0.0, "MEDIUM": 0.30, "HIGH": 0.55, "CRITICAL": 0.75})


class RiskIntelligenceEngine:
    """
    Deterministic Risk Intelligence Engine for ATM Cash-Out Risk Assessment.
    All calculations are strictly causal and bounded.
    """

    @classmethod
    def evaluate_atm_state(
        cls,
        atm_id: str,
        cutoff_time: str,
        features: Dict[str, float],
        spatial_radius_km: float = 2.0,
        mapping_distance_km: Optional[float] = None,
        weights: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates risk for a single ATM at a specific cutoff timestamp.
        Returns a structured dictionary containing separate risk_score, confidence,
        mapping_confidence, severity, factor contributions, and audit evidence.
        """
        w = weights or EXPERIMENTAL_WEIGHTS

        # ── 1. COMPONENT SIGNAL COMPUTATION (Normalized in [0.0, 1.0]) ───────────

        # Signal 1: A1 Anomaly Z-Score (Supporting Signal)
        act_ratio = features.get("activity_ratio_24h", 1.0)
        vel_ratio = features.get("velocity_surge_24h_vs_7d", 1.0)
        s_anomaly = min(1.0, max(0.0, (min(act_ratio, 5.0) / 5.0 * 0.5 + min(vel_ratio, 5.0) / 5.0 * 0.5)))

        # Signal 2: Activity Forecast Residual (Supporting Signal)
        base_cw_daily = features.get("base_cw_rate_daily", 1.0)
        recent_cw_24h = features.get("recent_cw_count_24h", 0.0)
        expected_cw_24h = max(0.01, base_cw_daily)
        s_activity = min(1.0, max(0.0, recent_cw_24h / (expected_cw_24h * 3.0 + 1e-4)))

        # Signal 3: Transaction Velocity & Amount Anomaly
        amt_ratio = features.get("amount_ratio_24h", 1.0)
        act_delta = max(0.0, features.get("activity_delta_24h", 0.0))
        s_tx_velocity = min(1.0, max(0.0, min(amt_ratio, 4.0) / 4.0 * 0.5 + min(act_delta, 10.0) / 10.0 * 0.5))

        # Signal 4: Account & Mule Behavior
        mule_accts_7d = features.get("connected_mule_accounts_7d", 0.0)
        uniq_acct_surge = features.get("unique_account_surge_24h", 1.0)
        s_mule_behavior = min(1.0, max(0.0, min(mule_accts_7d, 3.0) / 3.0 * 0.6 + min(uniq_acct_surge, 3.0) / 3.0 * 0.4))

        # Signal 5: Graph Proximity & Metro Network Exposure
        susp_density_city_7d = features.get("suspicious_density_city_7d", 0.0)
        hours_since_fraud = features.get("hours_since_last_fraud", 720.0)
        recency_decay = 1.0 / (1.0 + hours_since_fraud / 24.0)  # half-life 24h
        s_graph = min(1.0, max(0.0, min(susp_density_city_7d, 20.0) / 20.0 * 0.6 + recency_decay * 0.4))

        # Signal 6: Spatial, Temporal & Hotspot Window
        cluster_density = features.get("atm_cluster_density", 0.0)
        is_weekend = features.get("is_weekend", 0.0)
        hour_of_day = features.get("hour_of_day", 12.0)
        is_late_night = 1.0 if (hour_of_day >= 22.0 or hour_of_day <= 4.0) else 0.0
        s_spatial_temporal = min(1.0, max(0.0, min(cluster_density, 8.0) / 8.0 * 0.4 + is_weekend * 0.3 + is_late_night * 0.3))

        # ── 2. COMPOSITE RISK SCORE CALCULATION ─────────────────────────────────
        raw_risk_score = (
            w["anomaly_zscore"] * s_anomaly +
            w["activity_residual"] * s_activity +
            w["transaction_velocity"] * s_tx_velocity +
            w["account_mule_behavior"] * s_mule_behavior +
            w["graph_proximity"] * s_graph +
            w["spatial_temporal_hotspot"] * s_spatial_temporal
        )
        risk_score = round(min(1.0, max(0.0, raw_risk_score)), 4)

        # ── 3. SEPARATE CONFIDENCE ESTIMATE (Data Sufficiency & Freshness) ──────
        tx_30d = features.get("base_tx_count_30d", 0.0)
        data_volume_confidence = min(1.0, tx_30d / 50.0)
        freshness_confidence = math.exp(-0.01 * min(hours_since_fraud, 720.0))
        # Signal dispersion / agreement (lower variance between active signals = higher confidence)
        active_signals = [s_anomaly, s_activity, s_tx_velocity, s_mule_behavior, s_graph]
        signal_std = float(np.std(active_signals))
        agreement_confidence = max(0.20, 1.0 - signal_std)
        confidence = round(float(0.40 * data_volume_confidence + 0.30 * freshness_confidence + 0.30 * agreement_confidence), 4)

        # ── 4. SEPARATE MAPPING CONFIDENCE ──────────────────────────────────────
        if mapping_distance_km is not None:
            # Decay confidence with distance from ATM centroid
            mapping_confidence = round(max(0.10, math.exp(-0.5 * (mapping_distance_km / spatial_radius_km))), 4)
        else:
            # Default fallback for canonical exact centroid assignment
            mapping_confidence = 0.95

        # ── 5. OPERATIONAL SEVERITY CLASSIFICATION ──────────────────────────────
        # THRESHOLDS keys may be uppercase (CRITICAL/HIGH/MEDIUM/LOW) or lowercase
        def _thresh(key: str) -> float:
            return float(THRESHOLDS.get(key, THRESHOLDS.get(key.lower(), 0.0)))

        if risk_score >= _thresh("CRITICAL"):
            severity = "CRITICAL"
        elif risk_score >= _thresh("HIGH"):
            severity = "HIGH"
        elif risk_score >= _thresh("MEDIUM"):
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # ── 6. STRUCTURED AUDIT EVIDENCE & EXPLANATIONS ─────────────────────────
        evidence: List[str] = []
        if mule_accts_7d > 0:
            evidence.append(f"Mule network activity: {int(mule_accts_7d)} flagged account(s) transacted in trailing 7 days")
        if act_ratio >= 1.5:
            evidence.append(f"Acute withdrawal surge: 24h activity is {act_ratio:.1f}x above ATM daily baseline")
        if vel_ratio >= 1.5:
            evidence.append(f"Short-term velocity acceleration: 24h withdrawal rate exceeds 7d average by {vel_ratio:.1f}x")
        if susp_density_city_7d >= 3:
            evidence.append(f"Elevated regional crime density: {int(susp_density_city_7d)} suspicious events in metro area (7d)")
        if hours_since_fraud <= 48.0:
            evidence.append(f"Recent local fraud incident: last confirmed event occurred {hours_since_fraud:.1f} hours ago")
        if is_weekend and is_late_night:
            evidence.append("High-risk temporal window: Weekend late-night transaction period (10 PM - 4 AM)")
        elif is_weekend:
            evidence.append("Weekend transaction window")
        if not evidence:
            evidence.append("Normal background activity; no active risk multipliers triggered")

        factor_contributions = {
            "anomaly_zscore_factor": round(s_anomaly * w["anomaly_zscore"], 4),
            "activity_residual_factor": round(s_activity * w["activity_residual"], 4),
            "transaction_velocity_factor": round(s_tx_velocity * w["transaction_velocity"], 4),
            "account_mule_behavior_factor": round(s_mule_behavior * w["account_mule_behavior"], 4),
            "graph_proximity_factor": round(s_graph * w["graph_proximity"], 4),
            "spatial_temporal_factor": round(s_spatial_temporal * w["spatial_temporal_hotspot"], 4),
        }

        _sev_defs = CFG.get("severity_definitions", {
            "LOW": "Normal background activity; passive monitoring",
            "MEDIUM": "Minor anomaly detected; passive monitoring",
            "HIGH": "Elevated multi-signal convergence; queue for investigator review",
            "CRITICAL": "Investigator review required — NOT autonomous field intervention",
        })
        return {
            "atm_id": atm_id,
            "cutoff_time": cutoff_time,
            "risk_score": risk_score,
            "confidence": confidence,
            "mapping_confidence": mapping_confidence,
            "severity": severity,
            "operational_action": _sev_defs.get(severity, severity),
            "evidence": evidence,
            "factor_contributions": factor_contributions,
            "data_freshness_hours": round(float(hours_since_fraud), 1),
            "spatial_radius_km": spatial_radius_km,
        }

    @classmethod
    def evaluate_cutoff_cohort(
        cls,
        df_cutoff: pd.DataFrame,
        spatial_radius_km: float = 2.0,
        weights: Optional[Dict[str, float]] = None,
    ) -> pd.DataFrame:
        """
        Evaluates and ranks an entire cohort of candidate ATMs for a specific cutoff.
        Returns the cohort sorted by risk_score descending with per-cutoff ranks.
        """
        records = []
        for _, row in df_cutoff.iterrows():
            feat_dict = row.to_dict()
            res = cls.evaluate_atm_state(
                atm_id=str(row["atm_id"]),
                cutoff_time=str(row["cutoff_time"]),
                features=feat_dict,
                spatial_radius_km=spatial_radius_km,
                weights=weights,
            )
            res["target_c_48h"] = int(row.get("target_c_48h", 0))
            records.append(res)

        df_out = pd.DataFrame(records)
        df_out = df_out.sort_values("risk_score", ascending=False).reset_index(drop=True)
        df_out["rank"] = df_out.index + 1
        return df_out


if __name__ == "__main__":
    # Smoke test on sample dictionary
    sample_feat = {
        "activity_ratio_24h": 3.2,
        "velocity_surge_24h_vs_7d": 2.8,
        "base_cw_rate_daily": 2.5,
        "recent_cw_count_24h": 8.0,
        "amount_ratio_24h": 2.1,
        "activity_delta_24h": 5.5,
        "connected_mule_accounts_7d": 2.0,
        "unique_account_surge_24h": 2.0,
        "suspicious_density_city_7d": 6.0,
        "hours_since_last_fraud": 12.0,
        "atm_cluster_density": 4.0,
        "is_weekend": 1.0,
        "hour_of_day": 23.0,
        "base_tx_count_30d": 120.0,
    }
    sample_res = RiskIntelligenceEngine.evaluate_atm_state(
        atm_id="ATM-DELHI-001",
        cutoff_time="2023-05-19T00:00:00",
        features=sample_feat,
        spatial_radius_km=2.0,
        mapping_distance_km=0.35,
    )
    print("Risk Intelligence Engine Smoke Test:")
    print(json.dumps(sample_res, indent=2))
