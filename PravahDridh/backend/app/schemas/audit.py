import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    actor_id: Optional[uuid.UUID] = None
    actor_role: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[uuid.UUID] = None
    action_details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    occurred_at: datetime
    blockchain_hash: Optional[str] = None
