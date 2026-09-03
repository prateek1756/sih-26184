import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ComplaintBase(BaseModel):
    complaint_number: str
    filed_at: datetime
    category: str
    subcategory: Optional[str] = None
    reported_amount: Decimal = Field(..., ge=0)
    victim_state: Optional[str] = None
    victim_city: Optional[str] = None
    description: Optional[str] = None


class ComplaintCreate(ComplaintBase):
    pass


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None


class ComplaintRead(ComplaintBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    created_at: datetime
