import math
import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.deps import get_current_user, get_optional_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.complaint import Complaint
from app.models.transaction import SuspiciousTransaction
from app.models.account import Account
from app.models.atm import ATMLocation
from app.models.prediction import RiskPrediction
from app.models.alert import Alert
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintRead,
    ComplaintUpdate,
    ComplaintIntelligenceRead,
    ComplaintLinkedTransactionRead,
    ComplaintLinkedAccountRead,
    CorrelatedPredictionRead,
)
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.audit_service import AuditService
from app.services.geospatial_service import GeospatialService

router = APIRouter()


def _mask_account(raw_hash: Optional[str]) -> str:
    if not raw_hash:
        return "ACC-UNKNOWN"
    h = str(raw_hash).strip()
    if len(h) > 10:
        return f"ACC-{h[:6]}...{h[-4:]}"
    return f"ACC-{h}"


async def _resolve_complaint(db: AsyncSession, identifier: str) -> Optional[Complaint]:
    clean = identifier.strip()
    try:
        u = uuid.UUID(clean)
        res = await db.execute(select(Complaint).where(Complaint.id == u))
        c = res.scalars().first()
        if c:
            return c
    except ValueError:
        pass
    res = await db.execute(select(Complaint).where(Complaint.complaint_number.ilike(clean)))
    return res.scalars().first()


@router.get("", response_model=StandardResponse[List[ComplaintRead]])
async def list_complaints(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List complaints for LEA investigators with optional filters and search.
    Requires authenticated user (ANALYST, INVESTIGATOR, SUPERVISOR, ADMIN, VIEWER).
    """
    query = select(Complaint)
    if category:
        query = query.where(Complaint.category == category)
    if status:
        query = query.where(Complaint.status == status)
    if city:
        query = query.where(Complaint.victim_city == city)
    if district:
        query = query.where(Complaint.victim_district == district)
    if state:
        query = query.where(Complaint.victim_state == state)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Complaint.complaint_number.ilike(search_pattern),
                Complaint.category.ilike(search_pattern),
                Complaint.description.ilike(search_pattern),
                Complaint.complainant_name.ilike(search_pattern),
                Complaint.victim_city.ilike(search_pattern),
            )
        )

    # Count total matching
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Order newest first (filed_at or created_at desc)
    offset = (page - 1) * per_page
    query = query.order_by(desc(Complaint.created_at), desc(Complaint.filed_at)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=[ComplaintRead.model_validate(c) for c in items], meta=meta)


@router.post("", response_model=StandardResponse[ComplaintRead], status_code=status.HTTP_201_CREATED)
async def create_complaint(
    complaint_in: ComplaintCreate,
    request: Request,
    optional_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a cybercrime complaint from Citizen Portal or LEA interface.
    Generates official NCRP complaint number format if not supplied.
    Persists cleanly in PostgreSQL. Returns HTTP 201.
    """
    now_utc = datetime.now(timezone.utc)

    # Generate authoritative complaint number format: CYB-YYYY-XXXXXX
    if complaint_in.complaint_number and complaint_in.complaint_number.strip():
        complaint_num = complaint_in.complaint_number.strip().upper()
    else:
        random_digits = random.randint(100000, 999999)
        complaint_num = f"CYB-{now_utc.year}-{random_digits}"

    # Ensure complaint_number uniqueness
    existing = await db.execute(select(Complaint).where(Complaint.complaint_number == complaint_num))
    if existing.scalars().first():
        # Append unique suffix
        complaint_num = f"{complaint_num}-{uuid.uuid4().hex[:4].upper()}"

    filed_at = complaint_in.filed_at or now_utc

    # City / District resolution
    victim_city = complaint_in.victim_city
    victim_district = complaint_in.victim_district
    if not victim_city and victim_district:
        victim_city = victim_district
    elif not victim_district and victim_city:
        victim_district = victim_city

    new_complaint = Complaint(
        complaint_number=complaint_num,
        filed_at=filed_at,
        category=complaint_in.category,
        subcategory=complaint_in.subcategory,
        reported_amount=complaint_in.reported_amount,
        victim_state=complaint_in.victim_state,
        victim_city=victim_city,
        victim_district=victim_district,
        complainant_name=complaint_in.complainant_name,
        complainant_contact=complaint_in.complainant_contact,
        suspect_info=complaint_in.suspect_info,
        financial_details=complaint_in.financial_details,
        evidence_files=complaint_in.evidence_files,
        priority=complaint_in.priority or "MEDIUM",
        status="open",
        description=complaint_in.description,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(new_complaint)
    await db.flush()

    # Log audit trail
    actor = optional_user
    await AuditService.log_event(
        db=db,
        event_type="COMPLAINT_CREATE",
        actor=actor,
        resource_type="Complaint",
        resource_id=new_complaint.id,
        action_details={
            "complaint_number": new_complaint.complaint_number,
            "category": new_complaint.category,
            "reported_amount": float(new_complaint.reported_amount or 0),
            "source": "citizen_portal" if not actor else "lea_platform",
        },
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(new_complaint)
    return StandardResponse(data=ComplaintRead.model_validate(new_complaint))


@router.get("/track/{identifier}", response_model=StandardResponse[ComplaintRead])
async def track_complaint(
    identifier: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public tracking endpoint for citizens to check status of their filed complaint
    by complaint_number (e.g. CYB-2026-123456) or by UUID.
    """
    clean_id = identifier.strip()

    # Try UUID lookup
    complaint = None
    try:
        parsed_uuid = uuid.UUID(clean_id)
        res = await db.execute(select(Complaint).where(Complaint.id == parsed_uuid))
        complaint = res.scalars().first()
    except ValueError:
        pass

    if not complaint:
        # Try lookup by complaint_number
        res = await db.execute(select(Complaint).where(Complaint.complaint_number.ilike(clean_id)))
        complaint = res.scalars().first()

    if not complaint:
        # Try lookup by complainant_contact
        res = await db.execute(select(Complaint).where(Complaint.complainant_contact.ilike(f"%{clean_id}%")))
        complaint = res.scalars().first()

    if not complaint:
        raise HTTPException(status_code=404, detail=f"No complaint found matching '{clean_id}'")

    return StandardResponse(data=ComplaintRead.model_validate(complaint))


@router.get("/{complaint_id}", response_model=StandardResponse[ComplaintRead])
async def get_complaint(
    complaint_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get complaint by UUID or complaint_number.
    """
    clean_id = complaint_id.strip()
    complaint = None

    try:
        parsed_uuid = uuid.UUID(clean_id)
        res = await db.execute(select(Complaint).where(Complaint.id == parsed_uuid))
        complaint = res.scalars().first()
    except ValueError:
        pass

    if not complaint:
        res = await db.execute(select(Complaint).where(Complaint.complaint_number.ilike(clean_id)))
        complaint = res.scalars().first()

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
    if update_in.priority:
        complaint.priority = update_in.priority
    complaint.updated_at = datetime.now(timezone.utc)

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


@router.get("/{complaint_id}/intelligence", response_model=StandardResponse[ComplaintIntelligenceRead])
async def get_complaint_intelligence(
    complaint_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    COMPLAINT → TRANSACTIONS → ACCOUNTS → MULE NETWORK → PREDICTED WITHDRAWAL ATMS
    Retrieves full evidence-based intelligence for an LEA investigator.
    Strictly distinguishes statistical ML prediction from case relevance reasons.
    """
    complaint = await _resolve_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # 1. Query real linked transactions
    tx_stmt = (
        select(SuspiciousTransaction)
        .options(
            selectinload(SuspiciousTransaction.account),
            selectinload(SuspiciousTransaction.beneficiary_account),
            selectinload(SuspiciousTransaction.atm),
        )
        .where(SuspiciousTransaction.complaint_id == complaint.id)
        .order_by(SuspiciousTransaction.occurred_at.asc())
    )
    tx_res = await db.execute(tx_stmt)
    txs = tx_res.scalars().all()

    tx_reads: List[ComplaintLinkedTransactionRead] = []
    account_map: Dict[uuid.UUID, Dict[str, Any]] = {}
    cashout_atm_ids = set()

    for idx, tx in enumerate(txs):
        src_acc = tx.account
        dst_acc = tx.beneficiary_account
        atm = tx.atm

        if tx.atm_id:
            cashout_atm_ids.add(tx.atm_id)

        # Source Account tracking
        if src_acc:
            acc_id = src_acc.id
            if acc_id not in account_map:
                account_map[acc_id] = {
                    "id": acc_id,
                    "account_masked": _mask_account(src_acc.account_hash),
                    "bank_name": src_acc.bank_name,
                    "account_type": src_acc.account_type or "SAVINGS",
                    "risk_tier": src_acc.risk_tier or "LOW",
                    "is_mule_suspected": bool(src_acc.is_mule_suspected),
                    "role": "Source / Victim" if idx == 0 else ("Cashout Mule" if tx.is_cash_out else "Suspect Account"),
                    "total_volume": Decimal(str(tx.amount)),
                    "transaction_count": 1,
                }
            else:
                account_map[acc_id]["total_volume"] += Decimal(str(tx.amount))
                account_map[acc_id]["transaction_count"] += 1
                if tx.is_cash_out:
                    account_map[acc_id]["role"] = "Cashout Mule"

        # Explicit Beneficiary Account tracking
        if dst_acc:
            dst_id = dst_acc.id
            if dst_id not in account_map:
                account_map[dst_id] = {
                    "id": dst_id,
                    "account_masked": _mask_account(dst_acc.account_hash),
                    "bank_name": dst_acc.bank_name,
                    "account_type": dst_acc.account_type or "SAVINGS",
                    "risk_tier": dst_acc.risk_tier or "LOW",
                    "is_mule_suspected": bool(dst_acc.is_mule_suspected),
                    "role": "Beneficiary Account",
                    "total_volume": Decimal(str(tx.amount)),
                    "transaction_count": 1,
                }
            else:
                account_map[dst_id]["total_volume"] += Decimal(str(tx.amount))
                account_map[dst_id]["transaction_count"] += 1

        tx_reads.append(
            ComplaintLinkedTransactionRead(
                id=tx.id,
                amount=tx.amount,
                transaction_type=tx.transaction_type,
                occurred_at=tx.occurred_at,
                is_flagged=bool(tx.is_flagged),
                is_cash_out=bool(tx.is_cash_out),
                velocity_score=float(tx.velocity_score or 0.0),
                account_id=src_acc.id if src_acc else None,
                account_masked=_mask_account(src_acc.account_hash) if src_acc else None,
                account_bank=src_acc.bank_name if src_acc else None,
                account_is_mule=bool(src_acc.is_mule_suspected) if src_acc else False,
                beneficiary_account_id=dst_acc.id if dst_acc else None,
                beneficiary_masked=_mask_account(dst_acc.account_hash) if dst_acc else None,
                beneficiary_bank=dst_acc.bank_name if dst_acc else None,
                beneficiary_is_mule=bool(dst_acc.is_mule_suspected) if dst_acc else False,
                atm_id=atm.id if atm else None,
                atm_code=atm.atm_code if atm else None,
                atm_bank=atm.bank_name if atm else None,
                atm_city=atm.city if atm else None,
            )
        )

    # 2. Compute Mule Network Indicators
    mule_acc_cnt = sum(1 for a in account_map.values() if a["is_mule_suspected"])
    flagged_tx_cnt = sum(1 for t in tx_reads if t.is_flagged)
    cashout_tx_cnt = sum(1 for t in tx_reads if t.is_cash_out)
    flagged_amt = sum(t.amount for t in tx_reads if t.is_flagged)

    mule_indicators = {
        "total_accounts": len(account_map),
        "mule_accounts_count": mule_acc_cnt,
        "flagged_transactions_count": flagged_tx_cnt,
        "cashout_transactions_count": cashout_tx_cnt,
        "total_flagged_amount": float(flagged_amt),
        "hop_count": len(tx_reads),
        "syndicate_detected": mule_acc_cnt >= 2 or flagged_tx_cnt >= 3,
    }

    # 3. Correlated Predicted Withdrawal Locations (Production Model Predictions)
    pred_query = (
        select(RiskPrediction)
        .join(RiskPrediction.atm)
        .options(selectinload(RiskPrediction.atm))
        .where(RiskPrediction.is_active == True)
    )

    if complaint.victim_city:
        pred_query = pred_query.where(
            or_(
                ATMLocation.city.ilike(f"%{complaint.victim_city}%"),
                RiskPrediction.location_id.in_(cashout_atm_ids) if cashout_atm_ids else False
            )
        )

    pred_query = pred_query.order_by(desc(RiskPrediction.risk_score)).limit(10)
    pred_res = await db.execute(pred_query)
    candidate_preds = pred_res.scalars().all()

    # Fallback if no city-specific predictions exist
    if not candidate_preds:
        fallback_q = (
            select(RiskPrediction)
            .join(RiskPrediction.atm)
            .options(selectinload(RiskPrediction.atm))
            .where(RiskPrediction.is_active == True)
            .order_by(desc(RiskPrediction.risk_score))
            .limit(8)
        )
        fallback_res = await db.execute(fallback_q)
        candidate_preds = fallback_res.scalars().all()

    # Reference coordinates for spatial distance
    ref_lat = float(txs[0].latitude) if txs else 28.6139
    ref_lon = float(txs[0].longitude) if txs else 77.2090

    correlated_preds: List[CorrelatedPredictionRead] = []
    for p in candidate_preds:
        if not p.atm:
            continue

        dist = GeospatialService.haversine_distance_km(ref_lat, ref_lon, p.latitude, p.longitude)
        
        # Build evidence-based relevance reasons
        reasons: List[str] = []
        if p.location_id in cashout_atm_ids:
            reasons.append("DIRECT EVIDENCE: Confirmed cash-out withdrawal executed at this ATM terminal in case financial trail.")
        if complaint.victim_city and p.atm.city and complaint.victim_city.lower() in p.atm.city.lower():
            reasons.append(f"JURISDICTIONAL MATCH: Located in reported victim city ({p.atm.city}).")
        if dist <= 5.0:
            reasons.append(f"SPATIAL PROXIMITY: Within {dist:.1f} km of reported cybercrime transaction origin.")
        if p.reasons and len(p.reasons) > 0:
            reasons.append(f"RISK ENGINE FACTOR: {p.reasons[0]}")
        if not reasons:
            reasons.append(f"MONITORING TERMINAL: High-risk regional terminal in {p.atm.city} (Risk Score: {float(p.risk_score):.2f}).")

        # Check for active alert
        alert_q = select(Alert).where(Alert.prediction_id == p.id)
        alert_res = await db.execute(alert_q)
        linked_alert = alert_res.scalars().first()

        correlated_preds.append(
            CorrelatedPredictionRead(
                atm_id=p.atm.id,
                atm_code=p.atm.atm_code,
                bank_name=p.atm.bank_name,
                city=p.atm.city,
                latitude=p.latitude,
                longitude=p.longitude,
                distance_km=round(dist, 2),
                ml_probability=float(p.confidence),
                composite_risk_score=float(p.risk_score),
                severity=p.severity,
                confidence=float(p.confidence),
                predicted_window_start=p.predicted_window_start,
                predicted_window_end=p.predicted_window_end,
                relevance_reasons=reasons,
                alert_id=linked_alert.id if linked_alert else None,
                has_active_alert=bool(linked_alert and linked_alert.status in ["open", "assigned", "investigating"]),
            )
        )

    # Sort correlated predictions by relevance (direct cashout match first, then risk score)
    correlated_preds.sort(key=lambda x: (1 if "DIRECT EVIDENCE" in x.relevance_reasons[0] else 0, x.composite_risk_score), reverse=True)

    accounts_list = [ComplaintLinkedAccountRead(**acc) for acc in account_map.values()]

    return StandardResponse(
        data=ComplaintIntelligenceRead(
            complaint=ComplaintRead.model_validate(complaint),
            transactions=tx_reads,
            accounts=accounts_list,
            mule_network_indicators=mule_indicators,
            correlated_predictions=correlated_preds,
        )
    )


@router.get("/{complaint_id}/transactions", response_model=StandardResponse[List[ComplaintLinkedTransactionRead]])
async def get_complaint_transactions(
    complaint_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List financial transactions linked to a specific complaint."""
    intel = await get_complaint_intelligence(complaint_id=complaint_id, current_user=current_user, db=db)
    return StandardResponse(data=intel.data.transactions)


@router.get("/{complaint_id}/accounts", response_model=StandardResponse[List[ComplaintLinkedAccountRead]])
async def get_complaint_accounts(
    complaint_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List source and beneficiary accounts involved in a complaint."""
    intel = await get_complaint_intelligence(complaint_id=complaint_id, current_user=current_user, db=db)
    return StandardResponse(data=intel.data.accounts)


@router.get("/{complaint_id}/predictions", response_model=StandardResponse[List[CorrelatedPredictionRead]])
async def get_complaint_predictions(
    complaint_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List correlated cash-out predicted locations for a complaint."""
    intel = await get_complaint_intelligence(complaint_id=complaint_id, current_user=current_user, db=db)
    return StandardResponse(data=intel.data.correlated_predictions)

