import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.prediction import RiskPredictionRead
from app.schemas.user import UserRead


class AlertBase(BaseModel):
    prediction_id: uuid.UUID
    severity: str
    status: str = "open"


class AlertUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


class AlertAssign(BaseModel):
    assigned_to: uuid.UUID


class AlertRead(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    prediction: Optional[RiskPredictionRead] = None
    assignee: Optional[UserRead] = None
