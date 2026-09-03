"""
SIH PS 26184 — Live Transaction Ingestion & Forecast Update Schemas
===================================================================
Pydantic models for validated live transaction events, location forecasts,
alert transitions, and WebSocket broadcast payloads.
Follows strict SIH PS 26184 naming and schema conventions.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TransactionEvent(BaseModel):
    """
    Validated real-time transaction event schema.
    Contains only fields supported by project datasets and banking stream conventions.
    """
    transaction_id: str = Field(..., description="Unique transaction reference ID")
    event_time: datetime = Field(..., description="Event timestamp (ISO-8601)")
    account_id: str = Field(..., description="Customer or account identifier")
    transaction_type: str = Field(
        ..., description="Transaction type: ATM_Withdrawal, UPI_Transfer, NEFT, RTGS, POS_Payment"
    )
    amount: float = Field(..., gt=0.0, description="Transaction monetary amount in INR")
    channel: Optional[str] = Field(None, description="Channel: ATM, Mobile, Internet, Branch")
    atm_id: Optional[str] = Field(None, description="ATM terminal ID if transaction is ATM-linked")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Terminal latitude")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Terminal longitude")
    city: Optional[str] = Field(None, description="City location")
    is_fraud: Optional[int] = Field(0, ge=0, le=1, description="Known fraud / suspect indicator (0 or 1)")

    model_config = {"json_schema_extra": {
        "example": {
            "transaction_id": "TXN-MUM-20230501-0012",
            "event_time": "2023-05-01T02:37:00",
            "account_id": "CUST-98214",
            "transaction_type": "ATM_Withdrawal",
            "amount": 25000.0,
            "channel": "ATM",
            "atm_id": "ATM-MUM-0001",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "city": "Mumbai",
            "is_fraud": 1
        }
    }}


class LocationForecast(BaseModel):
    """
    Discrete location forecast for a physical cash-withdrawal touchpoint.
    Distinguishes future cashout forecast from static risk score.
    """
    rank: int = Field(..., ge=1, description="Priority rank (1 = highest forecast probability)")
    atm_id: str = Field(..., description="Physical ATM identifier")
    city: Optional[str] = Field(None, description="City")
    latitude: Optional[float] = Field(None, description="Terminal latitude")
    longitude: Optional[float] = Field(None, description="Terminal longitude")
    forecast_score: float = Field(..., ge=0.0, le=1.0, description="A1-Primary forecast priority score")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Composite multi-signal risk score")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Data sufficiency & signal agreement")
    mapping_confidence: float = Field(..., ge=0.0, le=1.0, description="Spatial proximity confidence")
    severity: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    alert_eligible: bool = Field(..., description="Evidence-aware alert gate eligibility")
    primary_evidence: str = Field(..., description="Primary driving reason for forecast")
    factor_contributions: Dict[str, float] = Field(default_factory=dict, description="Factor breakdown")


class LiveAlertUpdate(BaseModel):
    """
    Real-time alert transition event emitted when an ATM's risk/alert state changes.
    """
    alert_id: str = Field(..., description="Alert event unique identifier")
    atm_id: str = Field(..., description="Target ATM terminal ID")
    city: Optional[str] = None
    trigger_transaction_id: str = Field(..., description="Transaction ID that triggered the update")
    old_severity: str = Field(..., description="Previous severity tier")
    new_severity: str = Field(..., description="New severity tier")
    risk_score: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    alert_eligible: bool
    operational_action: str = Field(..., description="Investigator review protocol")
    primary_evidence: str
    emitted_at: str


class ForecastUpdatePayload(BaseModel):
    """
    Complete forecast-update event payload transmitted via REST or WebSocket.
    """
    event_id: str = Field(..., description="Forecast cycle identifier")
    event_time: str = Field(..., description="Event timestamp of latest triggering transaction")
    cutoff_time: str = Field(..., description="Causal cutoff boundary T (no data > T used)")
    forecast_start: str = Field(..., description="Forecast window start (T)")
    forecast_end: str = Field(..., description="Forecast window end (T + Horizon)")
    forecast_horizon_hours: int = Field(48, description="Prediction horizon in hours")
    trigger_atm_id: Optional[str] = None
    trigger_transaction_id: Optional[str] = None
    trigger_transaction_amount: Optional[float] = None
    top_locations: List[LocationForecast] = Field(default_factory=list, description="Top-K ranked ATMs")
    alert_updates: List[LiveAlertUpdate] = Field(default_factory=list, description="Newly triggered alerts")
    total_tracked_atms: int = Field(..., description="Number of ATMs monitored in state layer")
    pipeline_latency_ms: float = Field(..., description="Ingestion-to-forecast computation latency in ms")
    engine_version: str = "rie-candidate-v0.1"


class ReplaySimulationRequest(BaseModel):
    """
    Request payload to trigger historical transaction replay simulation.
    """
    city: str = Field("Mumbai", description="Metro city to simulate")
    max_events: int = Field(50, ge=1, le=1000, description="Max transaction events to stream")
    forecast_horizon_hours: int = Field(48, ge=6, le=168, description="Forecast horizon in hours")
