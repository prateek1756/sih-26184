import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base_class import Base


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    predicted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    model_version = Column(String(20), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("atm_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    risk_score = Column(Numeric(6, 4), nullable=False, index=True)  # 0.0000 - 1.0000
    severity = Column(String(20), nullable=False, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Numeric(6, 4), nullable=False)
    predicted_window_start = Column(DateTime(timezone=True), nullable=False)
    predicted_window_end = Column(DateTime(timezone=True), nullable=False)
    risk_zone = Column(Geometry(geometry_type='POLYGON', srid=4326), nullable=True)
    reasons = Column(JSON, nullable=True)  # List of explainable SHAP / rule triggers
    model_run_id = Column(UUID(as_uuid=True), ForeignKey("model_runs.id"), nullable=True)
    is_active = Column(Boolean, default=True, index=True)

    atm = relationship("ATMLocation")
    model_run = relationship("ModelRun")
    alerts = relationship("Alert", back_populates="prediction", cascade="all, delete-orphan")

    @property
    def atm_code(self):
        return self.atm.atm_code if self.atm else None

    @property
    def bank_name(self):
        return self.atm.bank_name if self.atm else None

    @property
    def city(self):
        return self.atm.city if self.atm else None

    __table_args__ = (
        Index('idx_risk_predictions_zone', risk_zone, postgresql_using='gist'),
        Index('idx_risk_predictions_active_score', is_active, risk_score.desc()),
    )
