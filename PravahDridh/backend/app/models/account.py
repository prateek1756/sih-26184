import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_hash = Column(String(64), unique=True, index=True, nullable=False)  # SHA-256 hash of Account/IFSC
    bank_name = Column(String(100), index=True, nullable=False)
    account_type = Column(String(30), default="SAVINGS")  # SAVINGS, CURRENT, WALLET
    risk_tier = Column(String(20), default="LOW", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    is_mule_suspected = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    transactions = relationship("SuspiciousTransaction", primaryjoin="Account.id == SuspiciousTransaction.account_id", back_populates="account")
    incoming_transactions = relationship("SuspiciousTransaction", primaryjoin="Account.id == SuspiciousTransaction.beneficiary_account_id", back_populates="beneficiary_account")
