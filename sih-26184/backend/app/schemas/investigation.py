import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.user import UserRead


class InvestigationNoteBase(BaseModel):
    note: str = Field(..., min_length=1)


class InvestigationNoteCreate(InvestigationNoteBase):
    pass


class InvestigationNoteRead(InvestigationNoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    author: Optional[UserRead] = None
    created_at: datetime


class InvestigationBase(BaseModel):
    case_number: str
    title: str
    alert_id: Optional[uuid.UUID] = None
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    findings: Optional[str] = None


class InvestigationCreate(BaseModel):
    title: str
    alert_id: Optional[uuid.UUID] = None
    priority: str = "MEDIUM"
    initial_findings: Optional[str] = None


class InvestigationUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    findings: Optional[str] = None


class InvestigationRead(InvestigationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_investigator_id: uuid.UUID
    lead_investigator: Optional[UserRead] = None
    status: str
    created_at: datetime
    updated_at: datetime
    notes: List[InvestigationNoteRead] = []
