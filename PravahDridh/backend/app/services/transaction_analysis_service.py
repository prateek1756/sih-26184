import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.account import Account
from app.models.alert import Alert
from app.models.atm import ATMLocation
from app.models.complaint import Complaint
from app.models.prediction import RiskPrediction
from app.models.transaction import SuspiciousTransaction
from app.models.user import User
from app.schemas.transaction import (
    ActionableIntelligencePackage,
    InvestigationContext,
    InvestigativeRecommendation,
    MaskedAccountSummary,
    SuspiciousIndicator,
    TransactionAnalysisResponse,
    TransactionItemRead,
    TransactionSummary,
)
from app.services.audit_service import AuditService


class TransactionAnalysisService:

    @staticmethod
    def mask_account_hash(raw_hash: Optional[str]) -> str:
        """
        Masks an account hash for privacy while preserving verification prefix/suffix.
        Example: ACC-9fd229...9f38
        """
        if not raw_hash:
            return "ACC-UNKNOWN"
        clean = str(raw_hash).strip()
        if len(clean) > 10:
            return f"ACC-{clean[:6]}...{clean[-4:]}"
        return f"ACC-{clean}"

    @classmethod
    async def analyze_for_alert(
        cls,
        db: AsyncSession,
        alert_id: Optional[uuid.UUID] = None,
        prediction_id: Optional[uuid.UUID] = None,
        atm_id: Optional[uuid.UUID] = None,
        account_id: Optional[uuid.UUID] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        min_amount: Optional[Decimal] = None,
        max_amount: Optional[Decimal] = None,
        transaction_type: Optional[str] = None,
        staging_window_hours: Optional[int] = None,
        proximity_radius_meters: Optional[float] = None,
        page: int = 1,
        per_page: int = 50,
        sort_by: str = "occurred_at",
        sort_order: str = "desc",
        current_user: Optional[User] = None,
    ) -> TransactionAnalysisResponse:
        """
        ALERT → PREDICTION → PREDICTED ATM → PREDICTION WINDOW → RELEVANT TRANSACTIONS → ACCOUNTS → EVIDENCE
        Resolves real PostgreSQL entities and computes evidence-based relevance and actionable intelligence.
        """
        alert: Optional[Alert] = None
        prediction: Optional[RiskPrediction] = None
        target_atm: Optional[ATMLocation] = None

        # 1. Resolve Alert & Prediction
        if alert_id:
            alert_stmt = (
                select(Alert)
                .options(
                    selectinload(Alert.prediction).selectinload(RiskPrediction.atm),
                    selectinload(Alert.assignee),
                )
                .where(Alert.id == alert_id)
            )
            res = await db.execute(alert_stmt)
            alert = res.scalars().first()
            if not alert:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Alert with ID {alert_id} not found in database",
                )
            prediction = alert.prediction
            if prediction:
                target_atm = prediction.atm

        elif prediction_id:
            pred_stmt = (
                select(RiskPrediction)
                .options(selectinload(RiskPrediction.atm))
                .where(RiskPrediction.id == prediction_id)
            )
            res = await db.execute(pred_stmt)
            prediction = res.scalars().first()
            if not prediction:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Prediction with ID {prediction_id} not found in database",
                )
            target_atm = prediction.atm

        elif atm_id:
            atm_stmt = select(ATMLocation).where(ATMLocation.id == atm_id)
            res = await db.execute(atm_stmt)
            target_atm = res.scalars().first()
            if not target_atm:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ATM with ID {atm_id} not found in database",
                )

        # 2. Extract Prediction Basis (Zero post-hoc fabrication)
        prediction_basis: List[str] = []
        if prediction and prediction.reasons:
            if isinstance(prediction.reasons, list):
                prediction_basis = [str(r) for r in prediction.reasons]
            elif isinstance(prediction.reasons, dict):
                prediction_basis = [f"{k}: {v}" for k, v in prediction.reasons.items()]

        # 3. Analytical Time & Spatial Boundaries (Configurable with defaults)
        eff_staging_hours = (
            staging_window_hours
            if staging_window_hours is not None
            else settings.ANALYSIS_STAGING_WINDOW_HOURS
        )
        eff_post_hours = settings.ANALYSIS_POST_WINDOW_HOURS
        eff_radius_meters = (
            proximity_radius_meters
            if proximity_radius_meters is not None
            else settings.ANALYSIS_PROXIMITY_RADIUS_METERS
        )

        pred_window_start: Optional[datetime] = None
        pred_window_end: Optional[datetime] = None
        if prediction:
            pred_window_start = prediction.predicted_window_start
            pred_window_end = prediction.predicted_window_end

        # Establish effective query window
        if start_time:
            query_start = start_time
        elif pred_window_start:
            query_start = pred_window_start - timedelta(hours=eff_staging_hours)
        else:
            query_start = datetime.now(timezone.utc) - timedelta(days=30)

        if end_time:
            query_end = end_time
        elif pred_window_end:
            query_end = pred_window_end + timedelta(hours=eff_post_hours)
        else:
            query_end = datetime.now(timezone.utc) + timedelta(days=1)

        # 4. Query Relevant Transactions from PostgreSQL using relational & PostGIS filters
        atm_ref_id = target_atm.id if target_atm else None
        atm_lat = target_atm.latitude if target_atm else None
        atm_lon = target_atm.longitude if target_atm else None

        # Build conditions to collect candidates:
        # A. Directly at target ATM
        # B. In spatial proximity (PostGIS ST_DWithin)
        # C. Explicit account filter if passed
        candidate_filters = []
        if atm_ref_id:
            candidate_filters.append(SuspiciousTransaction.atm_id == atm_ref_id)

        if atm_lat is not None and atm_lon is not None:
            spatial_cond = text(
                "location IS NOT NULL AND ST_DWithin("
                "location::geography, "
                f"ST_SetSRID(ST_MakePoint({atm_lon}, {atm_lat}), 4326)::geography, "
                f"{eff_radius_meters})"
            )
            candidate_filters.append(spatial_cond)

        if account_id:
            candidate_filters.append(SuspiciousTransaction.account_id == account_id)

        # Base query for candidates within the temporal window
        base_query = (
            select(SuspiciousTransaction)
            .options(
                selectinload(SuspiciousTransaction.account),
                selectinload(SuspiciousTransaction.complaint),
                selectinload(SuspiciousTransaction.atm),
            )
            .where(
                SuspiciousTransaction.occurred_at >= query_start,
                SuspiciousTransaction.occurred_at <= query_end,
            )
        )

        if candidate_filters:
            base_query = base_query.where(or_(*candidate_filters))

        res = await db.execute(base_query.limit(500))
        direct_txs = res.scalars().all()

        # Step 4B: Associated / Linked Transactions in Complaint Chains
        # If any found transaction has a complaint_id, fetch all other transactions in that chain
        found_complaint_ids = {
            tx.complaint_id for tx in direct_txs if tx.complaint_id is not None
        }
        all_tx_map: Dict[uuid.UUID, SuspiciousTransaction] = {
            tx.id: tx for tx in direct_txs
        }

        if found_complaint_ids:
            chain_stmt = (
                select(SuspiciousTransaction)
                .options(
                    selectinload(SuspiciousTransaction.account),
                    selectinload(SuspiciousTransaction.complaint),
                    selectinload(SuspiciousTransaction.atm),
                )
                .where(SuspiciousTransaction.complaint_id.in_(found_complaint_ids))
            )
            res_chain = await db.execute(chain_stmt.limit(500))
            for ctx in res_chain.scalars().all():
                if ctx.id not in all_tx_map:
                    all_tx_map[ctx.id] = ctx

        raw_transactions = list(all_tx_map.values())

        # 5. Calculate Geodesic Distance via PostGIS for each candidate
        distances_map: Dict[uuid.UUID, float] = {}
        if atm_lat is not None and atm_lon is not None and raw_transactions:
            tx_ids = [tx.id for tx in raw_transactions]
            dist_stmt = text("""
                SELECT id,
                       ST_Distance(
                           location::geography,
                           ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                       ) as dist_meters
                FROM suspicious_transactions
                WHERE id = ANY(:ids) AND location IS NOT NULL
            """).bindparams(lon=atm_lon, lat=atm_lat, ids=tx_ids)
            dist_res = await db.execute(dist_stmt)
            for row in dist_res.fetchall():
                if row[1] is not None:
                    distances_map[row[0]] = round(float(row[1]), 1)

        # 6. Deterministic Relevance Scoring & Explicit Factual Reasons
        scored_items: List[Tuple[SuspiciousTransaction, str, float, List[str]]] = []

        for tx in raw_transactions:
            score = 0.0
            reasons: List[str] = []
            dist = distances_map.get(tx.id)

            # A. Direct ATM match
            is_atm_match = atm_ref_id is not None and tx.atm_id == atm_ref_id
            if is_atm_match:
                score += 0.40
                atm_label = (
                    target_atm.atm_code if target_atm else str(atm_ref_id)[:8]
                )
                reasons.append(f"Direct transaction at predicted ATM ({atm_label})")
                if tx.is_cash_out:
                    reasons.append("Flagged cash-out withdrawal event")

            # B. Window Match / Pre-window Staging
            if pred_window_start and pred_window_end:
                if pred_window_start <= tx.occurred_at <= pred_window_end:
                    score += 0.25
                    reasons.append(
                        f"Occurred within predicted cash-out window "
                        f"({pred_window_start.strftime('%d-%b %H:%M')} to {pred_window_end.strftime('%d-%b %H:%M')})"
                    )
                elif query_start <= tx.occurred_at < pred_window_start:
                    hours_prior = round(
                        (pred_window_start - tx.occurred_at).total_seconds() / 3600.0,
                        1,
                    )
                    score += 0.10
                    reasons.append(
                        f"Pre-withdrawal fund staging: occurred {hours_prior}h prior to predicted window"
                    )

            # C. Associated Complaint Chain Link
            if tx.complaint_id and tx.complaint_id in found_complaint_ids:
                score += 0.20
                c_num = (
                    tx.complaint.complaint_number
                    if tx.complaint
                    else str(tx.complaint_id)[:8]
                )
                reasons.append(f"Linked to complaint chain ({c_num})")

            # D. Suspected Mule Account Match
            if tx.account and (
                tx.account.is_mule_suspected or tx.account.risk_tier == "CRITICAL"
            ):
                score += 0.15
                masked_acc = cls.mask_account_hash(tx.account.account_hash)
                tier_info = tx.account.risk_tier or "CRITICAL"
                reasons.append(
                    f"Involves suspected mule account ({masked_acc}, tier: {tier_info})"
                )

            # E. High Velocity Staging
            v_score = float(tx.velocity_score or 0.0)
            if v_score >= settings.ANALYSIS_HIGH_VELOCITY_THRESHOLD:
                score += 0.10
                reasons.append(
                    f"High transaction velocity score ({v_score:.2f} >= {settings.ANALYSIS_HIGH_VELOCITY_THRESHOLD})"
                )

            # F. High Value Transfer
            amt_float = float(tx.amount)
            if amt_float >= settings.ANALYSIS_HIGH_VALUE_THRESHOLD:
                score += 0.10
                reasons.append(
                    f"High-value transfer (₹{amt_float:,.2f} >= ₹{settings.ANALYSIS_HIGH_VALUE_THRESHOLD:,.0f})"
                )

            # G. Geographic Proximity
            if dist is not None and dist <= eff_radius_meters:
                score += 0.10
                reasons.append(
                    f"Terminal located {int(dist)}m from predicted ATM coordinates"
                )

            final_score = min(1.0, round(score, 3))

            if final_score >= settings.ANALYSIS_RELEVANCE_HIGH_SCORE:
                tier = "HIGH"
            elif final_score >= settings.ANALYSIS_RELEVANCE_MEDIUM_SCORE:
                tier = "MEDIUM"
            else:
                tier = "LOW"

            if not reasons:
                reasons.append("Retrieved during temporal/spatial investigation scan")

            scored_items.append((tx, tier, final_score, reasons))

        # 7. Apply investigator filters (Amount, Type)
        filtered_items = []
        for tx, tier, final_score, reasons in scored_items:
            if min_amount is not None and tx.amount < min_amount:
                continue
            if max_amount is not None and tx.amount > max_amount:
                continue
            if transaction_type and transaction_type != "ALL":
                if tx.transaction_type.upper() != transaction_type.upper():
                    continue
            filtered_items.append((tx, tier, final_score, reasons))

        # 8. Sorting
        def sort_key(item):
            tx, tier, final_score, _ = item
            if sort_by == "amount":
                return float(tx.amount)
            elif sort_by == "relevance_score":
                return final_score
            elif sort_by == "velocity_score":
                return float(tx.velocity_score or 0.0)
            else:  # default occurred_at
                return tx.occurred_at.timestamp() if tx.occurred_at else 0

        reverse_order = (sort_order.lower() == "desc")
        filtered_items.sort(key=sort_key, reverse=reverse_order)

        # 9. Pagination
        total_count = len(filtered_items)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paged_items = filtered_items[start_idx:end_idx]

        # 10. Construct Output Transaction Items
        tx_item_reads: List[TransactionItemRead] = []
        for tx, tier, final_score, reasons in paged_items:
            dist = distances_map.get(tx.id)
            masked_acc = (
                cls.mask_account_hash(tx.account.account_hash)
                if tx.account
                else "ACC-UNKNOWN"
            )
            atm_code_val = tx.atm.atm_code if tx.atm else None
            comp_num_val = tx.complaint.complaint_number if tx.complaint else None

            tx_item_reads.append(
                TransactionItemRead(
                    id=tx.id,
                    complaint_id=tx.complaint_id,
                    complaint_number=comp_num_val,
                    account_id=tx.account_id,
                    source_account_masked=masked_acc,
                    bank_name=tx.account.bank_name if tx.account else None,
                    account_risk_tier=tx.account.risk_tier if tx.account else None,
                    is_mule_suspected=bool(
                        tx.account.is_mule_suspected if tx.account else False
                    ),
                    amount=tx.amount,
                    transaction_type=tx.transaction_type,
                    occurred_at=tx.occurred_at,
                    latitude=tx.latitude,
                    longitude=tx.longitude,
                    atm_id=tx.atm_id,
                    destination_atm_code=atm_code_val,
                    distance_to_atm_meters=dist,
                    velocity_score=tx.velocity_score or Decimal("0.0"),
                    is_flagged=tx.is_flagged,
                    is_cash_out=tx.is_cash_out,
                    relevance=tier,
                    relevance_score=final_score,
                    relevance_reasons=reasons,
                    created_at=tx.created_at or tx.occurred_at,
                )
            )

        # 11. Compute Forensic Evidence & Suspicious Indicators (Facts vs Interpretation)
        indicators: List[SuspiciousIndicator] = []
        all_candidate_txs = [item[0] for item in filtered_items]

        # Indicator A: Rapid Fund Movement (Linked complaint multi-hop transactions)
        rapid_complaints: Dict[uuid.UUID, List[SuspiciousTransaction]] = {}
        for tx in all_candidate_txs:
            if tx.complaint_id:
                rapid_complaints.setdefault(tx.complaint_id, []).append(tx)

        for cid, chain in rapid_complaints.items():
            if len(chain) >= 2:
                chain_sorted = sorted(chain, key=lambda t: t.occurred_at)
                first_t = chain_sorted[0].occurred_at
                last_t = chain_sorted[-1].occurred_at
                delta_minutes = round((last_t - first_t).total_seconds() / 60.0, 1)
                total_val = sum(t.amount for t in chain_sorted)
                comp_num = (
                    chain_sorted[0].complaint.complaint_number
                    if chain_sorted[0].complaint
                    else str(cid)[:8]
                )

                indicators.append(
                    SuspiciousIndicator(
                        indicator="rapid_fund_movement",
                        label="Rapid Multi-Hop Fund Movement",
                        severity="HIGH" if delta_minutes < 120 else "MEDIUM",
                        observed_facts={
                            "complaint_number": comp_num,
                            "hop_count": len(chain_sorted),
                            "time_span_minutes": delta_minutes,
                            "total_amount": float(total_val),
                            "earliest_timestamp": first_t.isoformat(),
                            "latest_timestamp": last_t.isoformat(),
                        },
                        suspicious_interpretation=(
                            f"{len(chain_sorted)} transfers totaling ₹{float(total_val):,.2f} "
                            f"routed within {delta_minutes} minutes, culminating near the predicted cash-out vector."
                        ),
                        evidence={
                            "transaction_ids": [str(t.id) for t in chain_sorted],
                            "account_ids": [
                                str(t.account_id)
                                for t in chain_sorted
                                if t.account_id
                            ],
                            "complaint_id": str(cid),
                        },
                    )
                )

        # Indicator B: ATM Cash-Out Concentration
        atm_cashouts = [
            t
            for t in all_candidate_txs
            if t.is_cash_out or (atm_ref_id and t.atm_id == atm_ref_id)
        ]
        if atm_cashouts:
            tot_cashout = sum(t.amount for t in atm_cashouts)
            indicators.append(
                SuspiciousIndicator(
                    indicator="atm_cash_out_concentration",
                    label="Target ATM Cash-Out Concentration",
                    severity="CRITICAL" if len(atm_cashouts) >= 2 else "HIGH",
                    observed_facts={
                        "cash_out_count": len(atm_cashouts),
                        "total_cash_out_amount": float(tot_cashout),
                        "target_atm_code": target_atm.atm_code if target_atm else "UNKNOWN",
                        "bank_name": target_atm.bank_name if target_atm else "UNKNOWN",
                    },
                    suspicious_interpretation=(
                        f"{len(atm_cashouts)} withdrawal events totaling ₹{float(tot_cashout):,.2f} "
                        f"concentrated at the predicted terminal."
                    ),
                    evidence={
                        "transaction_ids": [str(t.id) for t in atm_cashouts],
                        "atm_id": str(atm_ref_id) if atm_ref_id else None,
                    },
                )
            )

        # Indicator C: Mule Account Involvement
        mule_txs = [
            t
            for t in all_candidate_txs
            if t.account
            and (t.account.is_mule_suspected or t.account.risk_tier == "CRITICAL")
        ]
        if mule_txs:
            unique_mules = {t.account_id: t.account for t in mule_txs if t.account}
            tot_mule_val = sum(t.amount for t in mule_txs)
            indicators.append(
                SuspiciousIndicator(
                    indicator="mule_account_involvement",
                    label="Flagged Mule Account Routing",
                    severity="HIGH",
                    observed_facts={
                        "unique_mule_accounts": len(unique_mules),
                        "total_volume_through_mules": float(tot_mule_val),
                        "masked_accounts": [
                            cls.mask_account_hash(acc.account_hash)
                            for acc in unique_mules.values()
                        ],
                    },
                    suspicious_interpretation=(
                        f"Financial transactions routed through {len(unique_mules)} suspected mule account(s) "
                        f"totaling ₹{float(tot_mule_val):,.2f}."
                    ),
                    evidence={
                        "transaction_ids": [str(t.id) for t in mule_txs],
                        "account_ids": [str(aid) for aid in unique_mules.keys()],
                    },
                )
            )

        # Indicator D: High Velocity Staging
        high_vel_txs = [
            t
            for t in all_candidate_txs
            if float(t.velocity_score or 0.0) >= settings.ANALYSIS_HIGH_VELOCITY_THRESHOLD
        ]
        if high_vel_txs:
            indicators.append(
                SuspiciousIndicator(
                    indicator="high_velocity_staging",
                    label="High-Velocity Fund Diversion",
                    severity="MEDIUM",
                    observed_facts={
                        "high_velocity_transactions": len(high_vel_txs),
                        "threshold_applied": settings.ANALYSIS_HIGH_VELOCITY_THRESHOLD,
                        "max_velocity_observed": max(
                            float(t.velocity_score or 0.0) for t in high_vel_txs
                        ),
                    },
                    suspicious_interpretation=(
                        f"{len(high_vel_txs)} transactions exhibit velocity scores exceeding {settings.ANALYSIS_HIGH_VELOCITY_THRESHOLD}, "
                        f"characteristic of automated fund diversion."
                    ),
                    evidence={
                        "transaction_ids": [str(t.id) for t in high_vel_txs]
                    },
                )
            )

        # 12. Compile Relevant Accounts Summary
        acc_summary_map: Dict[uuid.UUID, Dict[str, Any]] = {}
        for tx in all_candidate_txs:
            if tx.account:
                aid = tx.account.id
                if aid not in acc_summary_map:
                    acc_summary_map[aid] = {
                        "account": tx.account,
                        "count": 0,
                        "total": Decimal("0.0"),
                    }
                acc_summary_map[aid]["count"] += 1
                acc_summary_map[aid]["total"] += tx.amount

        relevant_accounts_list: List[MaskedAccountSummary] = [
            MaskedAccountSummary(
                account_id=aid,
                account_masked=cls.mask_account_hash(data["account"].account_hash),
                bank_name=data["account"].bank_name,
                account_type=data["account"].account_type,
                risk_tier=data["account"].risk_tier,
                is_mule_suspected=bool(data["account"].is_mule_suspected),
                transaction_count=data["count"],
                total_volume=data["total"],
            )
            for aid, data in acc_summary_map.items()
        ]

        # 13. Formulate Actionable System Recommendations
        recommendations: List[InvestigativeRecommendation] = []
        atm_code_str = target_atm.atm_code if target_atm else "Target ATM"

        if target_atm and pred_window_start and pred_window_end:
            recommendations.append(
                InvestigativeRecommendation(
                    action_id="REC-ATM-PHYSICAL-PATROL",
                    priority="URGENT" if alert and alert.severity in ["CRITICAL", "HIGH"] else "HIGH",
                    target_entity="State Police Beat / Nodal Patrol",
                    title=f"Deploy Field Surveillance at {atm_code_str}",
                    description=(
                        f"Conduct active patrol and review CCTV surveillance at {atm_code_str} ({target_atm.bank_name}, {target_atm.city}) "
                        f"during the predicted cash-out window: {pred_window_start.strftime('%d-%b %H:%M')} to {pred_window_end.strftime('%d-%b %H:%M')} UTC."
                    ),
                    rationale=(
                        f"Predicted high-risk ATM location corroborated by {len(atm_cashouts)} terminal withdrawal(s) "
                        f"and {len(all_candidate_txs)} staging transactions."
                    ),
                )
            )

        if mule_txs:
            recommendations.append(
                InvestigativeRecommendation(
                    action_id="REC-BANK-MULE-HOLD",
                    priority="HIGH",
                    target_entity="Bank / FI Nodal Officer Desk",
                    title="Transmit Section 91 CrPC Debit Freeze Notice",
                    description=(
                        f"Issue formal fraud notification to designated bank nodal officers for "
                        f"{len(relevant_accounts_list)} identified accounts to prevent secondary withdrawals."
                    ),
                    rationale=(
                        f"Accounts flagged as suspected mule nodes with total observed volume of "
                        f"₹{sum(t.amount for t in mule_txs):,.2f}."
                    ),
                )
            )

        if rapid_complaints:
            recommendations.append(
                InvestigativeRecommendation(
                    action_id="REC-STAGING-INTERVENTION",
                    priority="MEDIUM",
                    target_entity="Cyber Crime Investigation Cell",
                    title="Consolidate Linked Complaint Dossier",
                    description=(
                        f"Consolidate {len(rapid_complaints)} linked complaint investigation(s) into a coordinated case file "
                        f"to document multi-hop transaction trails."
                    ),
                    rationale="Rapid multi-hop routing detected connecting victim complaints directly to the cash-out corridor.",
                )
            )

        recommendations.append(
            InvestigativeRecommendation(
                action_id="REC-I4C-NATIONAL-RELAY",
                priority="ROUTINE",
                target_entity="Indian Cybercrime Coordination Centre (I4C)",
                title="Relay Pattern to National Nodal Queue",
                description=(
                    "Transmit structured intelligence package to I4C portal for multi-jurisdictional "
                    "inter-state fraud correlation."
                ),
                rationale="Supports nationwide syndicate tracking across participating LEA jurisdictions.",
            )
        )

        # 14. Aggregated Transaction Summary
        total_volume = sum(t.amount for t in all_candidate_txs)
        unique_acc_count = len(acc_summary_map)
        unique_dest_count = len({t.atm_id for t in all_candidate_txs if t.atm_id})
        cash_out_cnt = sum(1 for t in all_candidate_txs if t.is_cash_out)
        earliest_dt = (
            min(t.occurred_at for t in all_candidate_txs)
            if all_candidate_txs
            else None
        )
        latest_dt = (
            max(t.occurred_at for t in all_candidate_txs)
            if all_candidate_txs
            else None
        )
        atm_conc_pct = (
            round((len(atm_cashouts) / len(all_candidate_txs)) * 100.0, 1)
            if all_candidate_txs
            else 0.0
        )

        summary = TransactionSummary(
            total_transactions=total_count,
            total_amount=total_volume,
            unique_accounts=unique_acc_count,
            unique_destinations=unique_dest_count,
            cash_out_count=cash_out_cnt,
            earliest_transaction=earliest_dt,
            latest_transaction=latest_dt,
            atm_concentration_pct=atm_conc_pct,
        )

        # 15. Investigation Context
        context = InvestigationContext(
            alert_id=alert.id if alert else None,
            alert_severity=alert.severity if alert else None,
            alert_status=alert.status if alert else None,
            prediction_id=prediction.id if prediction else None,
            model_version=prediction.model_version if prediction else None,
            atm_id=target_atm.id if target_atm else None,
            atm_code=target_atm.atm_code if target_atm else None,
            bank_name=target_atm.bank_name if target_atm else None,
            city=target_atm.city if target_atm else None,
            latitude=target_atm.latitude if target_atm else None,
            longitude=target_atm.longitude if target_atm else None,
            risk_score=float(prediction.risk_score) if prediction else None,
            confidence=float(prediction.confidence) if prediction else None,
            predicted_window_start=pred_window_start,
            predicted_window_end=pred_window_end,
            prediction_basis=prediction_basis,
        )

        # 16. Actionable Intelligence Package
        actionable_pkg = ActionableIntelligencePackage(
            package_id=uuid.uuid4(),
            generated_at=datetime.now(timezone.utc),
            alert_id=alert.id if alert else uuid.uuid4(),
            prediction_id=prediction.id if prediction else uuid.uuid4(),
            severity=alert.severity if alert else (prediction.severity if prediction else "MEDIUM"),
            risk_score=float(prediction.risk_score) if prediction else 0.0,
            confidence=float(prediction.confidence) if prediction else 0.0,
            predicted_atm={
                "id": str(target_atm.id) if target_atm else None,
                "atm_code": target_atm.atm_code if target_atm else None,
                "bank_name": target_atm.bank_name if target_atm else None,
                "city": target_atm.city if target_atm else None,
                "latitude": target_atm.latitude if target_atm else None,
                "longitude": target_atm.longitude if target_atm else None,
            },
            prediction_window={
                "start": pred_window_start.isoformat() if pred_window_start else None,
                "end": pred_window_end.isoformat() if pred_window_end else None,
            },
            prediction_basis=prediction_basis,
            forensic_summary=summary,
            relevant_accounts=relevant_accounts_list,
            verified_indicators=indicators,
            recommended_actions=recommendations,
            dissemination_targets=[
                "STATE_CYBER_CELL",
                "BANK_NODAL_DESK",
                "I4C_COORDINATION",
            ],
        )

        # 17. SHA-256 Tamper-Evident Audit Logging
        if alert:
            await AuditService.log_event(
                db=db,
                event_type="TRANSACTION_INTELLIGENCE_ACCESS",
                actor=current_user,
                resource_type="ALERT",
                resource_id=alert.id,
                action_details={
                    "alert_id": str(alert.id),
                    "prediction_id": str(prediction.id) if prediction else None,
                    "atm_code": target_atm.atm_code if target_atm else None,
                    "relevance_count": total_count,
                    "indicators_found": len(indicators),
                },
            )
            await db.commit()

        return TransactionAnalysisResponse(
            context=context,
            summary=summary,
            transactions=tx_item_reads,
            indicators=indicators,
            recommendations=recommendations,
            relevant_accounts=relevant_accounts_list,
            actionable_package=actionable_pkg,
            page=page,
            per_page=per_page,
            total=total_count,
        )
