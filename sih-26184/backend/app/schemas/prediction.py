import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class RiskPredictionBase(BaseModel):
    model_version: str
    location_id: Optional[uuid.UUID] = None
    latitude: float
    longitude: float
    risk_score: Decimal = Field(..., ge=0, le=1)
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: Decimal = Field(..., ge=0, le=1)
    predicted_window_start: datetime
    predicted_window_end: datetime
    reasons: Optional[List[str]] = []
    is_active: bool = True


class RiskPredictionRead(RiskPredictionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    predicted_at: datetime
    atm_code: Optional[str] = None
    bank_name: Optional[str] = None
    city: Optional[str] = None


class PredictionRunRequest(BaseModel):
    window_hours: int = Field(24, ge=1, le=168)
    model_version: Optional[str] = None
    min_risk_threshold: float = Field(0.30, ge=0.0, le=1.0)


class TopKRequest(BaseModel):
    k: int = Field(20, ge=1, le=100)
    city: Optional[str] = None
    severity: Optional[str] = None


class HotspotPolygonFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]


class HotspotGeoJSONCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[HotspotPolygonFeature]
