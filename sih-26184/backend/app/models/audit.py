import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False, index=True)  # LOGIN, QUERY, PREDICT_RUN, ALERT_ASSIGN, CASE_CLOSE
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_role = Column(String(50), nullable=True)
    resource_type = Column(String(50), nullable=True, index=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    action_details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    blockchain_hash = Column(String(64), nullable=True)  # Merkle leaf or transaction digest for tamper-evidence

    __table_args__ = (
        Index('idx_audit_actor_time', actor_id, occurred_at.desc()),
        Index('idx_audit_resource', resource_type, resource_id),
    )
