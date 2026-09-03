import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base


class ModelRun(Base):
    __tablename__ = "model_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(20), unique=True, index=True, nullable=False)
    trained_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    precision_score = Column(Numeric(6, 4), nullable=True)
    recall_score = Column(Numeric(6, 4), nullable=True)
    f1_score = Column(Numeric(6, 4), nullable=True)
    pr_auc = Column(Numeric(6, 4), nullable=True)
    roc_auc = Column(Numeric(6, 4), nullable=True)
    precision_at_k = Column(Numeric(6, 4), nullable=True)
    parameters = Column(JSON, nullable=True)
    feature_importances = Column(JSON, nullable=True)
    artifact_path = Column(Text, nullable=True)
    is_production = Column(Boolean, default=False, index=True)
    notes = Column(Text, nullable=True)
