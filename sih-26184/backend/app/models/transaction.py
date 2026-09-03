import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base_class import Base


class SuspiciousTransaction(Base):
    __tablename__ = "suspicious_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_id = Column(UUID(as_uuid=True), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=True, index=True)  # nullable: live-ingested events have no complaint
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # IMPS, NEFT, UPI, ATM_WITHDRAW
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
    velocity_score = Column(Numeric(5, 2), default=0.0)
    is_flagged = Column(Boolean, default=False, index=True)
    is_cash_out = Column(Boolean, default=False, index=True)
    atm_id = Column(UUID(as_uuid=True), ForeignKey("atm_locations.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    complaint = relationship("Complaint", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    atm = relationship("ATMLocation")

    __table_args__ = (
        Index('idx_suspicious_tx_location', location, postgresql_using='gist'),
        Index('idx_suspicious_tx_time_flag', occurred_at, is_flagged),
    )
