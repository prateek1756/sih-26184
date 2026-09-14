import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.account import Account
from app.models.alert import Alert
from app.models.atm import ATMLocation
from app.models.complaint import Complaint
from app.models.investigation import Investigation
from app.models.prediction import RiskPrediction
from app.models.transaction import SuspiciousTransaction
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.transaction import (
    ActionableIntelligencePackage,
    IngestionStatusResponse,
    SuspiciousTransactionRead,
    TransactionAnalysisResponse,
    TransactionItemRead,
)
from app.services.transaction_analysis_service import TransactionAnalysisService

router = APIRouter()


@router.get("/analysis", response_model=StandardResponse[TransactionAnalysisResponse])
async def get_transaction_analysis(
    alert_id: Optional[uuid.UUID] = Query(None, description="Resolve transactions for this alert"),
    prediction_id: Optional[uuid.UUID] = Query(None, description="Resolve transactions for this prediction"),
    atm_id: Optional[uuid.UUID] = Query(None, description="Target ATM ID"),
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by account"),
    start_time: Optional[datetime] = Query(None, description="Filter from timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter until timestamp"),
    min_amount: Optional[Decimal] = Query(None, ge=0, description="Minimum amount in INR"),
    max_amount: Optional[Decimal] = Query(None, ge=0, description="Maximum amount in INR"),
    transaction_type: Optional[str] = Query(None, description="Filter type: IMPS, UPI, NEFT, ATM_WITHDRAW"),
    staging_window_hours: Optional[int] = Query(None, ge=1, le=720, description="Configurable pre-window staging buffer (hours)"),
    proximity_radius_meters: Optional[float] = Query(None, ge=50.0, le=100000.0, description="Configurable PostGIS spatial proximity (meters)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    sort_by: str = Query("occurred_at", description="Sort by occurred_at, amount, velocity_score, relevance_score"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN", "ANALYST"])),
    db: AsyncSession = Depends(get_db),
):
    """
    ALERT → PREDICTION → ATM → WINDOW → RELEVANT TRANSACTIONS → ACCOUNTS → EVIDENCE
    Core Phase 4 investigator analytics endpoint. Computes deterministic relevance scoring,
    delineates prediction basis vs forensic evidence, detects suspicious indicators,
    and returns actionable intelligence packages.
    """
    # Validate sort_by
    allowed_sorts = {"occurred_at", "amount", "velocity_score", "relevance_score"}
    if sort_by not in allowed_sorts:
        sort_by = "occurred_at"

    analysis = await TransactionAnalysisService.analyze_for_alert(
        db=db,
        alert_id=alert_id,
        prediction_id=prediction_id,
        atm_id=atm_id,
        account_id=account_id,
        start_time=start_time,
        end_time=end_time,
        min_amount=min_amount,
        max_amount=max_amount,
        transaction_type=transaction_type,
        staging_window_hours=staging_window_hours,
        proximity_radius_meters=proximity_radius_meters,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
    )
    return StandardResponse(data=analysis)


@router.get("/analysis/package", response_model=StandardResponse[ActionableIntelligencePackage])
async def get_actionable_intelligence_package(
    alert_id: Optional[uuid.UUID] = Query(None, description="Alert ID for the intelligence package"),
    prediction_id: Optional[uuid.UUID] = Query(None, description="Prediction ID for the intelligence package"),
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN", "ANALYST"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Actionable Intelligence Package export endpoint.
    Produces a structured, signed intelligence package for inter-agency relay
    across LEA desks, Bank/FI nodal officers, and I4C coordination units.
    """
    if not alert_id and not prediction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either alert_id or prediction_id must be provided to generate the intelligence package",
        )

    analysis = await TransactionAnalysisService.analyze_for_alert(
        db=db,
        alert_id=alert_id,
        prediction_id=prediction_id,
        current_user=current_user,
    )
    if not analysis.actionable_package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not compile actionable intelligence package",
        )
    return StandardResponse(data=analysis.actionable_package)


@router.get("/ingestion/status", response_model=StandardResponse[IngestionStatusResponse])
async def get_ingestion_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get live ingestion pipeline status and database entity counts.
    """
    total_tx = (await db.execute(select(func.count(SuspiciousTransaction.id)))).scalar_one() or 0
    flagged_tx = (await db.execute(select(func.count(SuspiciousTransaction.id)).where(SuspiciousTransaction.is_flagged == True))).scalar_one() or 0
    cash_out_tx = (await db.execute(select(func.count(SuspiciousTransaction.id)).where(SuspiciousTransaction.is_cash_out == True))).scalar_one() or 0

    total_acc = (await db.execute(select(func.count(Account.id)))).scalar_one() or 0
    mule_acc = (await db.execute(select(func.count(Account.id)).where(Account.is_mule_suspected == True))).scalar_one() or 0

    total_comp = (await db.execute(select(func.count(Complaint.id)))).scalar_one() or 0
    total_atm = (await db.execute(select(func.count(ATMLocation.id)))).scalar_one() or 0
    total_pred = (await db.execute(select(func.count(RiskPrediction.id)))).scalar_one() or 0
    total_alert = (await db.execute(select(func.count(Alert.id)))).scalar_one() or 0
    total_inv = (await db.execute(select(func.count(Investigation.id)))).scalar_one() or 0

    earliest_res = await db.execute(select(func.min(SuspiciousTransaction.occurred_at)))
    earliest_tx = earliest_res.scalar_one_or_none()

    latest_res = await db.execute(select(func.max(SuspiciousTransaction.occurred_at)))
    latest_tx = latest_res.scalar_one_or_none()

    status_data = IngestionStatusResponse(
        status="ACTIVE",
        total_transactions=total_tx,
        flagged_transactions=flagged_tx,
        cash_out_transactions=cash_out_tx,
        total_accounts=total_acc,
        mule_suspected_accounts=mule_acc,
        total_complaints=total_comp,
        total_atms=total_atm,
        total_predictions=total_pred,
        total_alerts=total_alert,
        total_investigations=total_inv,
        earliest_transaction=earliest_tx,
        latest_transaction=latest_tx,
        active_dataset="indian_banking_transactions_clean.csv",
    )
    return StandardResponse(data=status_data)


@router.get("/{transaction_id}", response_model=StandardResponse[TransactionItemRead])
async def get_transaction_detail(
    transaction_id: uuid.UUID,
    current_user: User = Depends(require_roles(["INVESTIGATOR", "SUPERVISOR", "ADMIN", "ANALYST"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve single transaction dossier with eager-loaded relationships and masked account privacy.
    """
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

    masked_acc = (
        TransactionAnalysisService.mask_account_hash(tx.account.account_hash)
        if tx.account
        else "ACC-UNKNOWN"
    )

    item = TransactionItemRead(
        id=tx.id,
        complaint_id=tx.complaint_id,
        complaint_number=tx.complaint.complaint_number if tx.complaint else None,
        account_id=tx.account_id,
        source_account_masked=masked_acc,
        bank_name=tx.account.bank_name if tx.account else None,
        account_risk_tier=tx.account.risk_tier if tx.account else None,
        is_mule_suspected=bool(tx.account.is_mule_suspected if tx.account else False),
        amount=tx.amount,
        transaction_type=tx.transaction_type,
        occurred_at=tx.occurred_at,
        latitude=tx.latitude,
        longitude=tx.longitude,
        atm_id=tx.atm_id,
        destination_atm_code=tx.atm.atm_code if tx.atm else None,
        distance_to_atm_meters=None,
        velocity_score=tx.velocity_score or Decimal("0.0"),
        is_flagged=tx.is_flagged,
        is_cash_out=tx.is_cash_out,
        relevance="HIGH" if tx.is_cash_out else "MEDIUM",
        relevance_score=0.85 if tx.is_cash_out else 0.50,
        relevance_reasons=["Direct dossier inspection"],
        created_at=tx.created_at or tx.occurred_at,
    )
    return StandardResponse(data=item)
