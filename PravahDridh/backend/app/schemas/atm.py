import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class ATMLocationBase(BaseModel):
    atm_code: str
    bank_name: str
    address: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    latitude: float
    longitude: float
    is_active: bool = True


class ATMLocationCreate(ATMLocationBase):
    pass


class ATMLocationRead(ATMLocationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [lon, lat]


class ATMGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]


class ATMGeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[ATMGeoJSONFeature]
