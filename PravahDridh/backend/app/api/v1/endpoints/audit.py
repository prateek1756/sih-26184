import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.audit import AuditEvent
from app.schemas.audit import AuditEventRead
from app.schemas.common import StandardResponse, PaginationMeta

router = APIRouter()


@router.get("/events", response_model=StandardResponse[List[AuditEventRead]])
async def list_audit_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    event_type: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN", "SUPERVISOR"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditEvent)
    if event_type:
        query = query.where(AuditEvent.event_type == event_type)

    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_res.scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(desc(AuditEvent.occurred_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[AuditEventRead.model_validate(e) for e in items], meta=meta)


@router.get("/events/{event_id}", response_model=StandardResponse[AuditEventRead])
async def get_audit_event(
    event_id: uuid.UUID,
    current_user: User = Depends(require_roles(["ADMIN", "SUPERVISOR"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AuditEvent).where(AuditEvent.id == event_id))
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return StandardResponse(data=AuditEventRead.model_validate(event))
