import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.model_run import ModelRun
from app.schemas.model_run import ModelRunRead, ModelPromoteRequest
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=StandardResponse[List[ModelRunRead]])
async def list_model_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ModelRun)
    count_res = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_res.scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(desc(ModelRun.trained_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[ModelRunRead.model_validate(m) for m in items], meta=meta)


@router.get("/{model_id}", response_model=StandardResponse[ModelRunRead])
async def get_model_run(
    model_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ModelRun).where(ModelRun.id == model_id))
    model_run = result.scalars().first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found")
    return StandardResponse(data=ModelRunRead.model_validate(model_run))


@router.post("/{model_id}/promote", response_model=StandardResponse[ModelRunRead])
async def promote_model_to_production(
    model_id: uuid.UUID,
    promote_in: ModelPromoteRequest,
    request: Request,
    current_user: User = Depends(require_roles(["ML_ENGINEER", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ModelRun).where(ModelRun.id == model_id))
    model_run = result.scalars().first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found")

    # Demote all existing production models
    await db.execute(update(ModelRun).values(is_production=False))

    # Promote target model
    model_run.is_production = True
    if promote_in.notes:
        model_run.notes = promote_in.notes

    await AuditService.log_event(
        db=db,
        event_type="MODEL_PROMOTE_PRODUCTION",
        actor=current_user,
        resource_type="ModelRun",
        resource_id=model_run.id,
        action_details={"model_version": model_run.model_version, "model_name": model_run.model_name},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(model_run)
    return StandardResponse(data=ModelRunRead.model_validate(model_run))
