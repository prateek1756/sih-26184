import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from app.db.base_class import Base


class ATMLocation(Base):
    __tablename__ = "atm_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    atm_code = Column(String(50), unique=True, index=True, nullable=False)
    bank_name = Column(String(100), index=True, nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), index=True, nullable=False)
    district = Column(String(100), index=True, nullable=True)
    state = Column(String(50), index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    # PostGIS Point (SRID 4326)
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index('idx_atm_locations_location', location, postgresql_using='gist'),
    )
