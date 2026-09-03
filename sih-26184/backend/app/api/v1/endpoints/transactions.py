import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.transaction import SuspiciousTransaction
from app.schemas.transaction import SuspiciousTransactionRead
from app.schemas.common import StandardResponse

router = APIRouter()


@router.get("/{transaction_id}", response_model=StandardResponse[SuspiciousTransactionRead])
async def get_transaction_detail(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SuspiciousTransaction)
        .options(
            selectinload(SuspiciousTransaction.complaint),
            selectinload(SuspiciousTransaction.account),
            selectinload(SuspiciousTransaction.atm),
        )
        .where(SuspiciousTransaction.id == transaction_id)
    )
    tx = result.scalars().first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return StandardResponse(data=SuspiciousTransactionRead.model_validate(tx))
