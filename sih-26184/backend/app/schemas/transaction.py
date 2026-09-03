import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TransactionBase(BaseModel):
    complaint_id: uuid.UUID
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
