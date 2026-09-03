import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.investigation import Investigation, InvestigationNote
from app.models.alert import Alert
from app.schemas.investigation import (
    InvestigationCreate,
    InvestigationRead,
    InvestigationUpdate,
    InvestigationNoteCreate,
    InvestigationNoteRead,
)
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=StandardResponse[List[InvestigationRead]])
async def list_investigations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Investigation).options(
        selectinload(Investigation.lead_investigator),
        selectinload(Investigation.notes).selectinload(InvestigationNote.author),
    )
    if status:
        query = query.where(Investigation.status == status)
    if priority:
        query = query.where(Investigation.priority == priority)

    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_res.scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(desc(Investigation.created_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[InvestigationRead.model_validate(i) for i in items], meta=meta)


@router.post("", response_model=StandardResponse[InvestigationRead])
async def create_investigation(
    inv_in: InvestigationCreate,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    # Unique high-entropy case number
    case_no = f"HERMES-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"
    
    new_inv = Investigation(
        case_number=case_no,
        title=inv_in.title,
        alert_id=inv_in.alert_id,
        lead_investigator_id=current_user.id,
        status="active",
        priority=inv_in.priority,
        findings=inv_in.initial_findings,
    )
    db.add(new_inv)
    await db.flush()

    if inv_in.alert_id:
        alert_res = await db.execute(select(Alert).where(Alert.id == inv_in.alert_id))
        alert = alert_res.scalars().first()
        if alert:
            alert.status = "investigating"

    await AuditService.log_event(
        db=db,
        event_type="INVESTIGATION_CREATE",
        actor=current_user,
        resource_type="Investigation",
        resource_id=new_inv.id,
        action_details={"case_number": case_no, "alert_id": str(inv_in.alert_id) if inv_in.alert_id else None},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    
    # Reload with relations
    res = await db.execute(
        select(Investigation)
        .options(selectinload(Investigation.lead_investigator), selectinload(Investigation.notes))
        .where(Investigation.id == new_inv.id)
    )
    loaded_inv = res.scalars().first()
    return StandardResponse(data=InvestigationRead.model_validate(loaded_inv))


@router.get("/{investigation_id}", response_model=StandardResponse[InvestigationRead])
async def get_investigation_detail(
    investigation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Investigation)
        .options(
            selectinload(Investigation.lead_investigator),
            selectinload(Investigation.notes).selectinload(InvestigationNote.author)
        )
        .where(Investigation.id == investigation_id)
    )
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return StandardResponse(data=InvestigationRead.model_validate(inv))


@router.patch("/{investigation_id}", response_model=StandardResponse[InvestigationRead])
async def update_investigation(
    investigation_id: uuid.UUID,
    update_in: InvestigationUpdate,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Investigation)
        .options(selectinload(Investigation.lead_investigator), selectinload(Investigation.notes))
        .where(Investigation.id == investigation_id)
    )
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if update_in.status:
        inv.status = update_in.status
    if update_in.priority:
        inv.priority = update_in.priority
    if update_in.findings:
        inv.findings = update_in.findings

    await AuditService.log_event(
        db=db,
        event_type="INVESTIGATION_UPDATE",
        actor=current_user,
        resource_type="Investigation",
        resource_id=inv.id,
        action_details={"updated_fields": update_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(inv)
    return StandardResponse(data=InvestigationRead.model_validate(inv))


@router.post("/{investigation_id}/notes", response_model=StandardResponse[InvestigationNoteRead])
async def add_investigation_note(
    investigation_id: uuid.UUID,
    note_in: InvestigationNoteCreate,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Investigation).where(Investigation.id == investigation_id))
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    new_note = InvestigationNote(
        investigation_id=investigation_id,
        author_id=current_user.id,
        note=note_in.note,
    )
    db.add(new_note)
    await db.flush()

    await AuditService.log_event(
        db=db,
        event_type="INVESTIGATION_NOTE_ADD",
        actor=current_user,
        resource_type="InvestigationNote",
        resource_id=new_note.id,
        action_details={"investigation_id": str(investigation_id)},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(new_note)
    return StandardResponse(data=InvestigationNoteRead.model_validate(new_note))
