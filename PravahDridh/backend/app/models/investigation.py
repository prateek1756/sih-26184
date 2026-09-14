import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True)
    complaint_id = Column(UUID(as_uuid=True), ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_investigator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(30), default="active", index=True)  # active, monitoring, intervention_completed, closed, OPEN, UNDER_REVIEW, ACTION_TAKEN, RESOLVED, FALSE_POSITIVE
    priority = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, URGENT
    findings = Column(Text, nullable=True)
    outcome = Column(String(50), nullable=True, index=True)  # WITHDRAWAL_OCCURRED, NO_WITHDRAWAL_DETECTED, FALSE_POSITIVE, INTERVENTION_PREVENTED_CASHOUT
    outcome_notes = Column(Text, nullable=True)
    outcome_recorded_at = Column(DateTime(timezone=True), nullable=True)
    action_taken = Column(String(100), nullable=True)  # ATM_SURVEILLANCE_DISPATCHED, ACCOUNT_FREEZE_NOTICE_SENT, FI_ALERT_RELAYED, FIELD_UNIT_INTERCEPT
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    alert = relationship("Alert", back_populates="investigation")
    complaint = relationship("Complaint", backref="investigations")
    lead_investigator = relationship("User", foreign_keys=[lead_investigator_id])
    notes = relationship("InvestigationNote", back_populates="investigation", cascade="all, delete-orphan")


class InvestigationNote(Base):
    __tablename__ = "investigation_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id = Column(UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    investigation = relationship("Investigation", back_populates="notes")
    author = relationship("User")
