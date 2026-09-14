import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class ComplaintBase(BaseModel):
    category: str
    description: Optional[str] = None
    subcategory: Optional[str] = None
    reported_amount: Decimal = Field(default=Decimal("0.0"), ge=0)
    victim_state: Optional[str] = None
    victim_city: Optional[str] = None
    victim_district: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_contact: Optional[str] = None
    suspect_info: Optional[str] = None
    financial_details: Optional[Any] = None
    evidence_files: Optional[Any] = None
    priority: Optional[str] = "MEDIUM"


class ComplaintCreate(ComplaintBase):
    complaint_number: Optional[str] = None
    filed_at: Optional[datetime] = None


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None


class ComplaintRead(ComplaintBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    complaint_number: str
    filed_at: datetime
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ComplaintLinkedTransactionRead(BaseModel):
    id: uuid.UUID
    amount: Decimal
    transaction_type: str
    occurred_at: datetime
    is_flagged: bool = False
    is_cash_out: bool = False
    velocity_score: float = 0.0
    account_id: Optional[uuid.UUID] = None
    account_masked: Optional[str] = None
    account_bank: Optional[str] = None
    account_is_mule: bool = False
    beneficiary_account_id: Optional[uuid.UUID] = None
    beneficiary_masked: Optional[str] = None
    beneficiary_bank: Optional[str] = None
    beneficiary_is_mule: bool = False
    atm_id: Optional[uuid.UUID] = None
    atm_code: Optional[str] = None
    atm_bank: Optional[str] = None
    atm_city: Optional[str] = None


class ComplaintLinkedAccountRead(BaseModel):
    id: uuid.UUID
    account_masked: str
    bank_name: str
    account_type: str = "SAVINGS"
    risk_tier: str = "LOW"
    is_mule_suspected: bool = False
    role: str = "participant"
    total_volume: Decimal = Decimal("0.0")
    transaction_count: int = 0


class CorrelatedPredictionRead(BaseModel):
    atm_id: uuid.UUID
    atm_code: str
    bank_name: str
    city: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    ml_probability: float
    composite_risk_score: float
    severity: str
    confidence: float
    predicted_window_start: datetime
    predicted_window_end: datetime
    relevance_reasons: List[str]
    alert_id: Optional[uuid.UUID] = None
    has_active_alert: bool = False


class ComplaintIntelligenceRead(BaseModel):
    complaint: ComplaintRead
    transactions: List[ComplaintLinkedTransactionRead]
    accounts: List[ComplaintLinkedAccountRead]
    mule_network_indicators: Dict[str, Any]
    correlated_predictions: List[CorrelatedPredictionRead]
    disclaimer: str = (
        "ML prediction represents the statistical probability of a cash withdrawal at this physical ATM in the next 24 hours. "
        "Fraud intelligence establishes operational relevance to this case based on proximal accounts, financial velocity, and spatial pattern."
    )

