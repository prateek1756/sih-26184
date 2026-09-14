import hashlib
import json
import uuid
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditEvent
from app.models.user import User


class AuditService:
    @staticmethod
    def compute_event_hash(actor_id: str, event_type: str, resource_type: str, resource_id: str, timestamp_str: str, payload: dict) -> str:
        data_str = f"{actor_id}:{event_type}:{resource_type}:{resource_id}:{timestamp_str}:{json.dumps(payload, sort_keys=True)}"
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

    @classmethod
    async def log_event(
        cls,
        db: AsyncSession,
        event_type: str,
        actor: Optional[User] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[uuid.UUID] = None,
        action_details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditEvent:
        now = datetime.now(timezone.utc)
        actor_id_str = str(actor.id) if actor else "SYSTEM"
        actor_role = actor.role if actor else "SYSTEM"
        res_type_str = resource_type or "NONE"
        res_id_str = str(resource_id) if resource_id else "NONE"

        chain_hash = cls.compute_event_hash(
            actor_id=actor_id_str,
            event_type=event_type,
            resource_type=res_type_str,
            resource_id=res_id_str,
            timestamp_str=now.isoformat(),
            payload=action_details or {},
        )

        audit_entry = AuditEvent(
            event_type=event_type,
            actor_id=actor.id if actor else None,
            actor_role=actor_role,
            resource_type=resource_type,
            resource_id=resource_id,
            action_details=action_details,
            ip_address=ip_address,
            occurred_at=now,
            blockchain_hash=chain_hash,
        )
        db.add(audit_entry)
        # We don't commit here so it bundles with caller's transaction or commits during flush
        return audit_entry
