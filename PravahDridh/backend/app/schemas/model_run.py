import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class ModelRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    model_name: str
    model_version: str
    trained_at: datetime
    precision_score: Optional[Decimal] = None
    recall_score: Optional[Decimal] = None
    f1_score: Optional[Decimal] = None
    pr_auc: Optional[Decimal] = None
    roc_auc: Optional[Decimal] = None
    precision_at_k: Optional[Decimal] = None
    parameters: Optional[Dict[str, Any]] = None
    feature_importances: Optional[Dict[str, Any]] = None
    artifact_path: Optional[str] = None
    is_production: bool = False
    notes: Optional[str] = None


class ModelPromoteRequest(BaseModel):
    notes: Optional[str] = None
