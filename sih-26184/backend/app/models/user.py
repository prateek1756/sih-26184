import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    badge_number = Column(String(50), nullable=True)
    agency = Column(String(100), nullable=True)
    role = Column(String(50), default="VIEWER", nullable=False)  # VIEWER, ANALYST, INVESTIGATOR, SUPERVISOR, ML_ENGINEER, ADMIN
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
