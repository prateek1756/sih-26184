"""
SIH PS 26184 — Risk Intelligence Engine Schemas
=================================================
Pydantic response models for the Risk Intelligence Engine service.
These are NEW schemas — existing schemas in this package are UNTOUCHED.
Follows the same StandardResponse[T] envelope as the rest of the API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AlertGateDetail(BaseModel):
    """Structured alert gate decision with full audit trail."""
    alert_eligible: bool
    alert_reason: str
    required_evidence: List[str]
    missing_evidence: List[str]
    primary_tier_active: bool
    secondary_tier_active: bool
    quality_gate_passed: bool
    signal_anomaly_strength: float
    signal_activity_strength: float
    signal_mule_strength: float
    signal_velocity_strength: float
    data_quality: float


class RiskEvaluationRequest(BaseModel):
    """Request payload for POST /api/v1/risk/evaluate"""
    atm_id: str = Field(..., description="ATM identifier")
    cutoff_time: Optional[datetime] = Field(
        None, description="Evaluation timestamp; defaults to now()"
    )
    features: Dict[str, Any] = Field(
        ..., description="Pre-computed feature dictionary for the ATM at cutoff_time"
    )
    spatial_radius_km: float = Field(
        2.0, ge=0.1, le=50.0,
        description="Configurable spatial cluster radius in km"
    )
    mapping_distance_km: Optional[float] = Field(
        None, ge=0.0, description="Distance from ATM centroid to nearest record in km"
    )


class RiskEvaluationResponse(BaseModel):
    """
    Structured response for a single ATM risk evaluation.
    Keeps risk_score and alert_eligible as SEPARATE quantities.
    """
    atm_id: str
    cutoff_time: str
    prediction_window: str = Field(
        description="Prediction horizon (e.g. 48h from cutoff_time)"
    )

    # ── Risk Quantification (separate from alert decision) ────────────────────
    risk_score: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    mapping_confidence: float = Field(..., ge=0.0, le=1.0)
    severity: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")

    # ── Alert Gate (separate from risk_score) ─────────────────────────────────
    alert_eligible: bool
    alert_gate: AlertGateDetail

    # ── Explainability ────────────────────────────────────────────────────────
    evidence: List[str]
    reasons: List[str]
    factor_contributions: Dict[str, float]

    # ── Audit Metadata ────────────────────────────────────────────────────────
    data_freshness_hours: float
    spatial_radius_km: float
    engine_version: str = "rie-candidate-v0.1"
    evaluated_at: str

    model_config = {"json_schema_extra": {
        "example": {
            "atm_id": "ATM-DELHI-0042",
            "cutoff_time": "2023-12-01T00:00:00",
            "prediction_window": "2023-12-01T00:00:00 to 2023-12-03T00:00:00",
            "risk_score": 0.4403,
            "confidence": 0.72,
            "mapping_confidence": 0.95,
            "severity": "MEDIUM",
            "alert_eligible": True,
        }
    }}


class TopRiskATM(BaseModel):
    """Single ATM entry in the ranked top-K response."""
    rank: int
    atm_id: str
    city: Optional[str] = None
    risk_score: float
    confidence: float
    severity: str
    alert_eligible: bool
    primary_evidence: str


class ExplanationResponse(BaseModel):
    """Detailed explanation response for a single ATM."""
    atm_id: str
    risk_score: float
    confidence: float
    mapping_confidence: float
    severity: str
    alert_eligible: bool
    alert_reason: str
    evidence: List[str]
    factor_contributions: Dict[str, float]
    signal_strengths: Dict[str, float]
    data_freshness_hours: float
    evaluated_at: str
    engine_version: str = "rie-candidate-v0.1"
