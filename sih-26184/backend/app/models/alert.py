import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("risk_predictions.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(20), default="open", index=True)  # open, assigned, investigating, resolved, false_positive
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    prediction = relationship("RiskPrediction", back_populates="alerts")
    assignee = relationship("User", foreign_keys=[assigned_to])
    investigation = relationship("Investigation", back_populates="alert", uselist=False)

    __table_args__ = (
        Index('idx_alerts_status_severity', status, severity),
    )
