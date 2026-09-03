import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_number = Column(String(50), unique=True, index=True, nullable=False)
    filed_at = Column(DateTime(timezone=True), nullable=False)
    category = Column(String(100), index=True, nullable=False)  # e.g. "UPI Fraud", "Phishing", "Identity Theft"
    subcategory = Column(String(100), nullable=True)
    reported_amount = Column(Numeric(18, 2), nullable=False, default=0.0)
    victim_state = Column(String(50), index=True, nullable=True)
    victim_city = Column(String(100), index=True, nullable=True)
    status = Column(String(30), default="open", index=True)  # open, under_investigation, resolved, closed
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    transactions = relationship("SuspiciousTransaction", back_populates="complaint", cascade="all, delete-orphan")
