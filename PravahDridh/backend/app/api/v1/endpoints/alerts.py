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
from app.models.alert import Alert
from app.models.prediction import RiskPrediction
from app.schemas.user import UserRead
from app.schemas.alert import AlertRead, AlertUpdate, AlertAssign
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=StandardResponse[List[AlertRead]])
async def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Alert)
        .options(
            selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
            selectinload(Alert.assignee),
        )
    )
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(desc(Alert.created_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[AlertRead.model_validate(a) for a in items], meta=meta)


@router.get("/investigators", response_model=StandardResponse[List[UserRead]])
async def list_investigators(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List available investigators, supervisors, and admins for alert assignment.
    """
    query = (
        select(User)
        .where(
            User.is_active == True,
            User.role.in_(["INVESTIGATOR", "SUPERVISOR", "ADMIN"]),
        )
        .order_by(User.full_name)
    )
    result = await db.execute(query)
    users = result.scalars().all()
    return StandardResponse(data=[UserRead.model_validate(u) for u in users])


@router.get("/{alert_id}", response_model=StandardResponse[AlertRead])
async def get_alert_detail(
    alert_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert)
        .options(
            selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
            selectinload(Alert.assignee),
        )
        .where(Alert.id == alert_id)
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return StandardResponse(data=AlertRead.model_validate(alert))


@router.post("/{alert_id}/acknowledge", response_model=StandardResponse[AlertRead])
async def acknowledge_alert(
    alert_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert)
        .options(
            selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
            selectinload(Alert.assignee),
        )
        .where(Alert.id == alert_id)
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "assigned"
    if not alert.assigned_to:
        alert.assigned_to = current_user.id

    await AuditService.log_event(
        db=db,
        event_type="ALERT_ACKNOWLEDGE",
        actor=current_user,
        resource_type="Alert",
        resource_id=alert.id,
        action_details={"acknowledged_by": str(current_user.id), "status": alert.status},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(alert)
    return StandardResponse(data=AlertRead.model_validate(alert))


@router.patch("/{alert_id}/assign", response_model=StandardResponse[AlertRead])
async def assign_alert(
    alert_id: uuid.UUID,
    assign_in: AlertAssign,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert)
        .options(
            selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
            selectinload(Alert.assignee),
        )
        .where(Alert.id == alert_id)
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    user_res = await db.execute(select(User).where(User.id == assign_in.assigned_to))
    assignee = user_res.scalars().first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assigned user not found")

    alert.assigned_to = assignee.id
    alert.status = "assigned"

    await AuditService.log_event(
        db=db,
        event_type="ALERT_ASSIGN",
        actor=current_user,
        resource_type="Alert",
        resource_id=alert.id,
        action_details={"assigned_to": str(assignee.id), "assignee_name": assignee.full_name},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(alert)
    return StandardResponse(data=AlertRead.model_validate(alert))


@router.patch("/{alert_id}/resolve", response_model=StandardResponse[AlertRead])
async def resolve_alert(
    alert_id: uuid.UUID,
    update_in: AlertUpdate,
    request: Request,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert)
        .options(
            selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
            selectinload(Alert.assignee),
        )
        .where(Alert.id == alert_id)
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = update_in.status or "resolved"
    alert.resolution_notes = update_in.resolution_notes
    alert.resolved_at = datetime.now(timezone.utc)

    await AuditService.log_event(
        db=db,
        event_type="ALERT_RESOLVE",
        actor=current_user,
        resource_type="Alert",
        resource_id=alert.id,
        action_details={"status": alert.status, "notes": alert.resolution_notes},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(alert)
    return StandardResponse(data=AlertRead.model_validate(alert))
