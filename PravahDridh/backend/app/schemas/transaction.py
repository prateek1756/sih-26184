import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class TransactionBase(BaseModel):
    complaint_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(..., gt=0)
    transaction_type: str  # IMPS, NEFT, UPI, ATM_WITHDRAW
    occurred_at: datetime
    latitude: float
    longitude: float
    is_flagged: bool = False
    is_cash_out: bool = False
    atm_id: Optional[uuid.UUID] = None


class TransactionCreate(TransactionBase):
    pass


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    velocity_score: Decimal
    created_at: datetime


SuspiciousTransactionRead = TransactionRead


# ============================================================
# Phase 4: Real Transaction Intelligence Schemas
# ============================================================

class SuspiciousIndicator(BaseModel):
    indicator: str  # e.g. "rapid_fund_movement", "atm_cash_out_concentration"
    label: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    observed_facts: Dict[str, Any]  # Empirical data: amounts, timestamps, hop count
    suspicious_interpretation: str  # Contextual forensic analysis
    evidence: Dict[str, Any]  # Supporting IDs: transaction_ids, account_ids


class InvestigativeRecommendation(BaseModel):
    action_id: str  # e.g. "REC-ATM-PHYSICAL-PATROL", "REC-BANK-MULE-HOLD"
    priority: str  # URGENT, HIGH, MEDIUM, ROUTINE
    target_entity: str  # "ATM Location", "Bank / FI Nodal Desk", "LEA Patrol", etc.
    title: str
    description: str
    rationale: str


class InvestigationContext(BaseModel):
    alert_id: Optional[uuid.UUID] = None
    alert_severity: Optional[str] = None
    alert_status: Optional[str] = None
    prediction_id: Optional[uuid.UUID] = None
    model_version: Optional[str] = None
    atm_id: Optional[uuid.UUID] = None
    atm_code: Optional[str] = None
    bank_name: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    risk_score: Optional[float] = None
    confidence: Optional[float] = None
    predicted_window_start: Optional[datetime] = None
    predicted_window_end: Optional[datetime] = None
    prediction_basis: List[str] = Field(default_factory=list)  # Model trigger explanations


class MaskedAccountSummary(BaseModel):
    account_id: uuid.UUID
    account_masked: str
    bank_name: str
    account_type: str
    risk_tier: str
    is_mule_suspected: bool
    transaction_count: int
    total_volume: Decimal


class TransactionItemRead(BaseModel):
    id: uuid.UUID
    complaint_id: Optional[uuid.UUID] = None
    complaint_number: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    source_account_masked: Optional[str] = None
    bank_name: Optional[str] = None
    account_risk_tier: Optional[str] = None
    is_mule_suspected: bool = False
    amount: Decimal
    transaction_type: str
    occurred_at: datetime
    latitude: float
    longitude: float
    atm_id: Optional[uuid.UUID] = None
    destination_atm_code: Optional[str] = None
    distance_to_atm_meters: Optional[float] = None
    velocity_score: Decimal
    is_flagged: bool
    is_cash_out: bool
    relevance: str  # HIGH, MEDIUM, LOW
    relevance_score: float  # Deterministic score 0.0 - 1.0
    relevance_reasons: List[str]  # Verified database-backed reasons
    created_at: datetime


class TransactionSummary(BaseModel):
    total_transactions: int
    total_amount: Decimal
    unique_accounts: int
    unique_destinations: int
    cash_out_count: int
    earliest_transaction: Optional[datetime] = None
    latest_transaction: Optional[datetime] = None
    atm_concentration_pct: float


class ActionableIntelligencePackage(BaseModel):
    package_id: uuid.UUID
    generated_at: datetime
    alert_id: uuid.UUID
    prediction_id: uuid.UUID
    severity: str
    risk_score: float
    confidence: float
    predicted_atm: Dict[str, Any]
    prediction_window: Dict[str, Any]
    prediction_basis: List[str]
    forensic_summary: TransactionSummary
    relevant_accounts: List[MaskedAccountSummary]
    verified_indicators: List[SuspiciousIndicator]
    recommended_actions: List[InvestigativeRecommendation]
    dissemination_targets: List[str]


class TransactionAnalysisResponse(BaseModel):
    context: InvestigationContext
    summary: TransactionSummary
    transactions: List[TransactionItemRead]
    indicators: List[SuspiciousIndicator]
    recommendations: List[InvestigativeRecommendation]
    relevant_accounts: List[MaskedAccountSummary]
    actionable_package: Optional[ActionableIntelligencePackage] = None
    page: int
    per_page: int
    total: int


class IngestionStatusResponse(BaseModel):
    status: str
    total_transactions: int
    flagged_transactions: int
    cash_out_transactions: int
    total_accounts: int
    mule_suspected_accounts: int
    total_complaints: int
    total_atms: int
    total_predictions: int
    total_alerts: int
    total_investigations: int
    earliest_transaction: Optional[datetime] = None
    latest_transaction: Optional[datetime] = None
    active_dataset: str = "indian_banking_transactions_clean.csv"

