import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.complaint import Complaint
from app.schemas.complaint import ComplaintCreate, ComplaintRead, ComplaintUpdate
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=StandardResponse[List[ComplaintRead]])
async def list_complaints(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Complaint)
    if category:
        query = query.where(Complaint.category == category)
    if status:
        query = query.where(Complaint.status == status)
    if city:
        query = query.where(Complaint.victim_city == city)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Pagination
    offset = (page - 1) * per_page
    query = query.order_by(desc(Complaint.filed_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[ComplaintRead.model_validate(c) for c in items], meta=meta)


@router.post("", response_model=StandardResponse[ComplaintRead])
async def create_complaint(
    complaint_in: ComplaintCreate,
    request: Request,
    current_user: User = Depends(require_roles(["ANALYST", "INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    new_complaint = Complaint(
        complaint_number=complaint_in.complaint_number,
        filed_at=complaint_in.filed_at,
        category=complaint_in.category,
        subcategory=complaint_in.subcategory,
        reported_amount=complaint_in.reported_amount,
        victim_state=complaint_in.victim_state,
        victim_city=complaint_in.victim_city,
        description=complaint_in.description,
        status="open",
    )
    db.add(new_complaint)
    await db.flush()

    await AuditService.log_event(
        db=db,
        event_type="COMPLAINT_CREATE",
        actor=current_user,
        resource_type="Complaint",
        resource_id=new_complaint.id,
        action_details={"complaint_number": new_complaint.complaint_number, "category": new_complaint.category},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(new_complaint)
    return StandardResponse(data=ComplaintRead.model_validate(new_complaint))


@router.get("/{complaint_id}", response_model=StandardResponse[ComplaintRead])
async def get_complaint(
    complaint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalars().first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return StandardResponse(data=ComplaintRead.model_validate(complaint))


@router.patch("/{complaint_id}", response_model=StandardResponse[ComplaintRead])
async def update_complaint_status(
    complaint_id: uuid.UUID,
    update_in: ComplaintUpdate,
    request: Request,
    current_user: User = Depends(require_roles(["ANALYST", "INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalars().first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if update_in.status:
        complaint.status = update_in.status
    if update_in.description:
        complaint.description = update_in.description

    await AuditService.log_event(
        db=db,
        event_type="COMPLAINT_UPDATE",
        actor=current_user,
        resource_type="Complaint",
        resource_id=complaint.id,
        action_details={"updated_fields": update_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(complaint)
    return StandardResponse(data=ComplaintRead.model_validate(complaint))
