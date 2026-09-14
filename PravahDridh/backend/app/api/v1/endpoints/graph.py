import uuid
from typing import List, Optional, Dict, Set, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.complaint import Complaint
from app.models.transaction import SuspiciousTransaction
from app.models.account import Account
from app.models.atm import ATMLocation
from app.models.alert import Alert
from app.models.prediction import RiskPrediction
from app.models.investigation import Investigation
from app.schemas.common import StandardResponse
from app.schemas.graph import GraphNode, GraphEdge, KnowledgeGraphResponse

router = APIRouter()


def _mask_account(raw_hash: Optional[str]) -> str:
    if not raw_hash:
        return "ACC-UNKNOWN"
    h = str(raw_hash).strip()
    if len(h) > 10:
        return f"ACC-{h[:6]}...{h[-4:]}"
    return f"ACC-{h}"


@router.get("", response_model=StandardResponse[KnowledgeGraphResponse])
async def get_knowledge_graph(
    limit_cases: int = Query(6, ge=1, le=30, description="Max active cases to include in global graph"),
    city: Optional[str] = Query(None, description="Filter by city"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Constructs a live database knowledge graph from PostgreSQL.
    Extracts real Complaints, Multi-Hop Transactions, Bank Accounts,
    ATM Terminals, Predictions, Alerts, and Investigations.
    Zero mock nodes/edges.
    """
    # 1. Fetch recent priority complaints
    comp_q = select(Complaint)
    if city:
        comp_q = comp_q.where(or_(Complaint.victim_city == city, Complaint.victim_district == city))
    comp_q = comp_q.order_by(desc(Complaint.created_at)).limit(limit_cases)
    comp_res = await db.execute(comp_q)
    complaints = comp_res.scalars().all()

    comp_ids = [c.id for c in complaints]
    if not comp_ids:
        return StandardResponse(data=KnowledgeGraphResponse(nodes=[], edges=[], stats={"nodes": 0, "edges": 0}))

    # 2. Fetch linked transactions with relations
    tx_q = (
        select(SuspiciousTransaction)
        .options(
            selectinload(SuspiciousTransaction.account),
            selectinload(SuspiciousTransaction.beneficiary_account),
            selectinload(SuspiciousTransaction.atm),
        )
        .where(SuspiciousTransaction.complaint_id.in_(comp_ids))
        .order_by(SuspiciousTransaction.occurred_at.asc())
    )
    tx_res = await db.execute(tx_q)
    transactions = tx_res.scalars().all()

    # 3. Fetch linked investigations
    inv_q = (
        select(Investigation)
        .options(selectinload(Investigation.alert))
        .where(or_(Investigation.complaint_id.in_(comp_ids), Investigation.alert_id != None))
        .limit(10)
    )
    inv_res = await db.execute(inv_q)
    investigations = inv_res.scalars().all()

    # 4. Fetch linked alerts and predictions
    alert_ids = [inv.alert_id for inv in investigations if inv.alert_id]
    alerts_q = (
        select(Alert)
        .options(selectinload(Alert.prediction).selectinload(RiskPrediction.atm))
        .where(Alert.id.in_(alert_ids))
    ) if alert_ids else None

    alerts = []
    if alerts_q is not None:
        alert_res = await db.execute(alerts_q)
        alerts = alert_res.scalars().all()

    # 5. Build Graph Nodes & Edges
    nodes_dict: Dict[str, GraphNode] = {}
    edges_list: List[GraphEdge] = []
    seen_edge_ids: Set[str] = set()

    # Add Complaint nodes
    for c in complaints:
        node_id = f"comp_{c.id}"
        nodes_dict[node_id] = GraphNode(
            id=node_id,
            label=c.complaint_number,
            type="Complaint",
            subType=c.category,
            properties={
                "complaint_number": c.complaint_number,
                "category": c.category,
                "amount": float(c.reported_amount or 0.0),
                "victim_city": c.victim_city or "Unknown",
                "status": c.status,
                "priority": c.priority,
                "filed_at": c.filed_at.isoformat() if c.filed_at else None,
            },
            isSuspicious=True,
            severity=c.priority,
        )

    # Add Transaction, Account, and ATM nodes
    for tx in transactions:
        tx_node_id = f"tx_{tx.id}"
        tx_amount = float(tx.amount)
        nodes_dict[tx_node_id] = GraphNode(
            id=tx_node_id,
            label=f"TX ₹{tx_amount:,.0f}",
            type="Transaction",
            subType=tx.transaction_type,
            properties={
                "amount": tx_amount,
                "type": tx.transaction_type,
                "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
                "is_flagged": tx.is_flagged,
                "is_cash_out": tx.is_cash_out,
                "velocity_score": float(tx.velocity_score or 0.0),
            },
            isSuspicious=bool(tx.is_flagged or tx.is_cash_out),
            riskScore=float(tx.velocity_score or 0.0),
        )

        # Edge: Complaint -> Transaction
        if tx.complaint_id:
            c_node_id = f"comp_{tx.complaint_id}"
            e_id = f"{c_node_id}_has_{tx_node_id}"
            if e_id not in seen_edge_ids and c_node_id in nodes_dict:
                seen_edge_ids.add(e_id)
                edges_list.append(GraphEdge(
                    id=e_id,
                    source=c_node_id,
                    target=tx_node_id,
                    type="HAS_TRANSACTION",
                    label=f"₹{tx_amount:,.0f}",
                    isSuspicious=bool(tx.is_flagged),
                    amount=tx_amount,
                ))

        # Source Account Node & Edge
        if tx.account:
            acc = tx.account
            acc_node_id = f"acc_{acc.id}"
            if acc_node_id not in nodes_dict:
                nodes_dict[acc_node_id] = GraphNode(
                    id=acc_node_id,
                    label=_mask_account(acc.account_hash),
                    type="Account",
                    subType=acc.bank_name,
                    properties={
                        "bank": acc.bank_name,
                        "account_type": acc.account_type,
                        "risk_tier": acc.risk_tier,
                        "is_mule": acc.is_mule_suspected,
                    },
                    isSuspicious=bool(acc.is_mule_suspected),
                    severity=acc.risk_tier,
                )

            # Edge: Transaction -> FROM_ACCOUNT
            e_from = f"{tx_node_id}_from_{acc_node_id}"
            if e_from not in seen_edge_ids:
                seen_edge_ids.add(e_from)
                edges_list.append(GraphEdge(
                    id=e_from,
                    source=tx_node_id,
                    target=acc_node_id,
                    type="FROM_ACCOUNT",
                    label="Debited",
                    isSuspicious=bool(acc.is_mule_suspected),
                ))

        # Beneficiary Account Node & Edge (Only when explicit in record)
        if tx.beneficiary_account:
            bacc = tx.beneficiary_account
            bacc_node_id = f"acc_{bacc.id}"
            if bacc_node_id not in nodes_dict:
                nodes_dict[bacc_node_id] = GraphNode(
                    id=bacc_node_id,
                    label=_mask_account(bacc.account_hash),
                    type="Account",
                    subType=bacc.bank_name,
                    properties={
                        "bank": bacc.bank_name,
                        "account_type": bacc.account_type,
                        "risk_tier": bacc.risk_tier,
                        "is_mule": bacc.is_mule_suspected,
                    },
                    isSuspicious=bool(bacc.is_mule_suspected),
                    severity=bacc.risk_tier,
                )

            # Edge: Transaction -> TO_ACCOUNT
            e_to = f"{tx_node_id}_to_{bacc_node_id}"
            if e_to not in seen_edge_ids:
                seen_edge_ids.add(e_to)
                edges_list.append(GraphEdge(
                    id=e_to,
                    source=tx_node_id,
                    target=bacc_node_id,
                    type="TO_ACCOUNT",
                    label="Credited",
                    isSuspicious=bool(bacc.is_mule_suspected),
                ))

        # ATM Node & Edge
        if tx.atm:
            atm = tx.atm
            atm_node_id = f"atm_{atm.id}"
            if atm_node_id not in nodes_dict:
                nodes_dict[atm_node_id] = GraphNode(
                    id=atm_node_id,
                    label=atm.atm_code,
                    type="ATM",
                    subType=atm.bank_name,
                    properties={
                        "atm_code": atm.atm_code,
                        "bank": atm.bank_name,
                        "city": atm.city,
                        "latitude": atm.latitude,
                        "longitude": atm.longitude,
                    },
                    isSuspicious=tx.is_cash_out,
                )

            # Edge: Transaction -> OCCURRED_AT
            e_occ = f"{tx_node_id}_at_{atm_node_id}"
            if e_occ not in seen_edge_ids:
                seen_edge_ids.add(e_occ)
                edges_list.append(GraphEdge(
                    id=e_occ,
                    source=tx_node_id,
                    target=atm_node_id,
                    type="OCCURRED_AT",
                    label="Cash Drain" if tx.is_cash_out else "Withdrawal",
                    isSuspicious=tx.is_cash_out,
                    amount=tx_amount,
                ))

            # Edge: Account -> USES -> ATM
            if tx.account_id:
                acc_node_id = f"acc_{tx.account_id}"
                e_uses = f"{acc_node_id}_uses_{atm_node_id}"
                if e_uses not in seen_edge_ids and acc_node_id in nodes_dict:
                    seen_edge_ids.add(e_uses)
                    edges_list.append(GraphEdge(
                        id=e_uses,
                        source=acc_node_id,
                        target=atm_node_id,
                        type="USES",
                        label="Operated At",
                        isSuspicious=tx.is_cash_out,
                    ))

    # Add Investigation nodes
    for inv in investigations:
        inv_node_id = f"inv_{inv.id}"
        nodes_dict[inv_node_id] = GraphNode(
            id=inv_node_id,
            label=inv.case_number,
            type="Investigation",
            subType=inv.status,
            properties={
                "case_number": inv.case_number,
                "title": inv.title,
                "status": inv.status,
                "priority": inv.priority,
                "outcome": inv.outcome,
            },
            severity=inv.priority,
        )

        # Edge: Investigation -> Complaint
        if inv.complaint_id:
            c_node_id = f"comp_{inv.complaint_id}"
            e_inv_comp = f"{inv_node_id}_inv_{c_node_id}"
            if e_inv_comp not in seen_edge_ids and c_node_id in nodes_dict:
                seen_edge_ids.add(e_inv_comp)
                edges_list.append(GraphEdge(
                    id=e_inv_comp,
                    source=inv_node_id,
                    target=c_node_id,
                    type="INVESTIGATES",
                    label="Investigates Case",
                ))

        # Edge: Investigation -> Alert
        if inv.alert_id:
            alt_node_id = f"alert_{inv.alert_id}"
            e_inv_alt = f"{inv_node_id}_inv_{alt_node_id}"
            if e_inv_alt not in seen_edge_ids and alt_node_id in nodes_dict:
                seen_edge_ids.add(e_inv_alt)
                edges_list.append(GraphEdge(
                    id=e_inv_alt,
                    source=inv_node_id,
                    target=alt_node_id,
                    type="INVESTIGATES",
                    label="Investigates Alert",
                ))

    # Add Alert and Prediction nodes
    for al in alerts:
        alt_node_id = f"alert_{al.id}"
        nodes_dict[alt_node_id] = GraphNode(
            id=alt_node_id,
            label=f"Alert ({al.severity})",
            type="Alert",
            subType=al.status,
            properties={
                "severity": al.severity,
                "status": al.status,
                "created_at": al.created_at.isoformat() if al.created_at else None,
            },
            severity=al.severity,
            isSuspicious=True,
        )

        if al.prediction:
            p = al.prediction
            pred_node_id = f"pred_{p.id}"
            if pred_node_id not in nodes_dict:
                nodes_dict[pred_node_id] = GraphNode(
                    id=pred_node_id,
                    label=f"ML Forecast ({float(p.confidence):.2f})",
                    type="Prediction",
                    subType=f"Risk: {float(p.risk_score):.2f}",
                    properties={
                        "risk_score": float(p.risk_score),
                        "confidence": float(p.confidence),
                        "severity": p.severity,
                        "window_start": p.predicted_window_start.isoformat(),
                        "window_end": p.predicted_window_end.isoformat(),
                    },
                    riskScore=float(p.risk_score),
                    severity=p.severity,
                    isSuspicious=True,
                )

            # Edge: Alert -> GENERATED_FOR -> Prediction
            e_al_p = f"{alt_node_id}_for_{pred_node_id}"
            if e_al_p not in seen_edge_ids:
                seen_edge_ids.add(e_al_p)
                edges_list.append(GraphEdge(
                    id=e_al_p,
                    source=alt_node_id,
                    target=pred_node_id,
                    type="GENERATED_FOR",
                    label="Triggered By",
                    isSuspicious=True,
                ))

            # Edge: Prediction -> TARGETS -> ATM
            if p.atm:
                atm = p.atm
                atm_node_id = f"atm_{atm.id}"
                if atm_node_id not in nodes_dict:
                    nodes_dict[atm_node_id] = GraphNode(
                        id=atm_node_id,
                        label=atm.atm_code,
                        type="ATM",
                        subType=atm.bank_name,
                        properties={
                            "atm_code": atm.atm_code,
                            "bank": atm.bank_name,
                            "city": atm.city,
                        },
                        isSuspicious=True,
                    )
                e_p_atm = f"{pred_node_id}_targets_{atm_node_id}"
                if e_p_atm not in seen_edge_ids:
                    seen_edge_ids.add(e_p_atm)
                    edges_list.append(GraphEdge(
                        id=e_p_atm,
                        source=pred_node_id,
                        target=atm_node_id,
                        type="TARGETS",
                        label="Targets Terminal",
                        isSuspicious=True,
                    ))

    nodes_list = list(nodes_dict.values())
    stats = {
        "total_nodes": len(nodes_list),
        "total_edges": len(edges_list),
        "complaints": sum(1 for n in nodes_list if n.type == "Complaint"),
        "accounts": sum(1 for n in nodes_list if n.type == "Account"),
        "transactions": sum(1 for n in nodes_list if n.type == "Transaction"),
        "atms": sum(1 for n in nodes_list if n.type == "ATM"),
        "investigations": sum(1 for n in nodes_list if n.type == "Investigation"),
        "alerts": sum(1 for n in nodes_list if n.type == "Alert"),
    }

    return StandardResponse(
        data=KnowledgeGraphResponse(
            nodes=nodes_list,
            edges=edges_list,
            stats=stats,
        )
    )


@router.get("/case/{case_id}", response_model=StandardResponse[KnowledgeGraphResponse])
async def get_case_subgraph(
    case_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Constructs the targeted knowledge subgraph focused on a single Complaint or Investigation.
    """
    clean = case_id.strip()

    # Try lookup as investigation first
    inv = None
    try:
        u = uuid.UUID(clean)
        inv_res = await db.execute(select(Investigation).where(Investigation.id == u))
        inv = inv_res.scalars().first()
    except ValueError:
        pass

    if not inv:
        inv_res = await db.execute(select(Investigation).where(Investigation.case_number.ilike(clean)))
        inv = inv_res.scalars().first()

    complaint = None
    if inv and inv.complaint_id:
        c_res = await db.execute(select(Complaint).where(Complaint.id == inv.complaint_id))
        complaint = c_res.scalars().first()
    elif not inv:
        # Try lookup as complaint
        try:
            u = uuid.UUID(clean)
            c_res = await db.execute(select(Complaint).where(Complaint.id == u))
            complaint = c_res.scalars().first()
        except ValueError:
            pass

        if not complaint:
            c_res = await db.execute(select(Complaint).where(Complaint.complaint_number.ilike(clean)))
            complaint = c_res.scalars().first()

    if not complaint and not inv:
        raise HTTPException(status_code=404, detail=f"No case or complaint found matching '{clean}'")

    comp_id = complaint.id if complaint else None
    
    # Query transactions for this complaint
    transactions = []
    if comp_id:
        tx_stmt = (
            select(SuspiciousTransaction)
            .options(
                selectinload(SuspiciousTransaction.account),
                selectinload(SuspiciousTransaction.beneficiary_account),
                selectinload(SuspiciousTransaction.atm),
            )
            .where(SuspiciousTransaction.complaint_id == comp_id)
            .order_by(SuspiciousTransaction.occurred_at.asc())
        )
        tx_res = await db.execute(tx_stmt)
        transactions = tx_res.scalars().all()

    nodes_dict: Dict[str, GraphNode] = {}
    edges_list: List[GraphEdge] = []
    seen_edge_ids: Set[str] = set()

    if complaint:
        c_node_id = f"comp_{complaint.id}"
        nodes_dict[c_node_id] = GraphNode(
            id=c_node_id,
            label=complaint.complaint_number,
            type="Complaint",
            subType=complaint.category,
            properties={
                "complaint_number": complaint.complaint_number,
                "category": complaint.category,
                "amount": float(complaint.reported_amount or 0.0),
                "victim_city": complaint.victim_city or "Unknown",
                "status": complaint.status,
                "priority": complaint.priority,
            },
            isSuspicious=True,
            severity=complaint.priority,
        )

    if inv:
        inv_node_id = f"inv_{inv.id}"
        nodes_dict[inv_node_id] = GraphNode(
            id=inv_node_id,
            label=inv.case_number,
            type="Investigation",
            subType=inv.status,
            properties={
                "case_number": inv.case_number,
                "title": inv.title,
                "status": inv.status,
                "priority": inv.priority,
                "outcome": inv.outcome,
            },
            severity=inv.priority,
        )
        if complaint:
            e_id = f"{inv_node_id}_inv_{c_node_id}"
            seen_edge_ids.add(e_id)
            edges_list.append(GraphEdge(
                id=e_id,
                source=inv_node_id,
                target=c_node_id,
                type="INVESTIGATES",
                label="Case Scope",
            ))

    for tx in transactions:
        tx_node_id = f"tx_{tx.id}"
        tx_amt = float(tx.amount)
        nodes_dict[tx_node_id] = GraphNode(
            id=tx_node_id,
            label=f"TX ₹{tx_amt:,.0f}",
            type="Transaction",
            subType=tx.transaction_type,
            properties={
                "amount": tx_amt,
                "type": tx.transaction_type,
                "is_cash_out": tx.is_cash_out,
                "is_flagged": tx.is_flagged,
            },
            isSuspicious=bool(tx.is_flagged or tx.is_cash_out),
        )

        if complaint:
            e_has = f"comp_{complaint.id}_has_{tx_node_id}"
            if e_has not in seen_edge_ids:
                seen_edge_ids.add(e_has)
                edges_list.append(GraphEdge(
                    id=e_has,
                    source=f"comp_{complaint.id}",
                    target=tx_node_id,
                    type="HAS_TRANSACTION",
                    label=f"₹{tx_amt:,.0f}",
                    isSuspicious=bool(tx.is_flagged),
                    amount=tx_amt,
                ))

        if tx.account:
            acc = tx.account
            acc_node_id = f"acc_{acc.id}"
            if acc_node_id not in nodes_dict:
                nodes_dict[acc_node_id] = GraphNode(
                    id=acc_node_id,
                    label=_mask_account(acc.account_hash),
                    type="Account",
                    subType=acc.bank_name,
                    properties={"bank": acc.bank_name, "is_mule": acc.is_mule_suspected},
                    isSuspicious=bool(acc.is_mule_suspected),
                    severity=acc.risk_tier,
                )
            e_f = f"{tx_node_id}_from_{acc_node_id}"
            if e_f not in seen_edge_ids:
                seen_edge_ids.add(e_f)
                edges_list.append(GraphEdge(
                    id=e_f,
                    source=tx_node_id,
                    target=acc_node_id,
                    type="FROM_ACCOUNT",
                    label="Debited",
                    isSuspicious=bool(acc.is_mule_suspected),
                ))

        if tx.beneficiary_account:
            bacc = tx.beneficiary_account
            bacc_node_id = f"acc_{bacc.id}"
            if bacc_node_id not in nodes_dict:
                nodes_dict[bacc_node_id] = GraphNode(
                    id=bacc_node_id,
                    label=_mask_account(bacc.account_hash),
                    type="Account",
                    subType=bacc.bank_name,
                    properties={"bank": bacc.bank_name, "is_mule": bacc.is_mule_suspected},
                    isSuspicious=bool(bacc.is_mule_suspected),
                    severity=bacc.risk_tier,
                )
            e_t = f"{tx_node_id}_to_{bacc_node_id}"
            if e_t not in seen_edge_ids:
                seen_edge_ids.add(e_t)
                edges_list.append(GraphEdge(
                    id=e_t,
                    source=tx_node_id,
                    target=bacc_node_id,
                    type="TO_ACCOUNT",
                    label="Credited",
                    isSuspicious=bool(bacc.is_mule_suspected),
                ))

        if tx.atm:
            atm = tx.atm
            atm_node_id = f"atm_{atm.id}"
            if atm_node_id not in nodes_dict:
                nodes_dict[atm_node_id] = GraphNode(
                    id=atm_node_id,
                    label=atm.atm_code,
                    type="ATM",
                    subType=atm.bank_name,
                    properties={"atm_code": atm.atm_code, "city": atm.city},
                    isSuspicious=tx.is_cash_out,
                )
            e_occ = f"{tx_node_id}_at_{atm_node_id}"
            if e_occ not in seen_edge_ids:
                seen_edge_ids.add(e_occ)
                edges_list.append(GraphEdge(
                    id=e_occ,
                    source=tx_node_id,
                    target=atm_node_id,
                    type="OCCURRED_AT",
                    label="Cash Drain" if tx.is_cash_out else "Withdrawal",
                    isSuspicious=tx.is_cash_out,
                    amount=tx_amt,
                ))

    nodes_list = list(nodes_dict.values())
    stats = {
        "total_nodes": len(nodes_list),
        "total_edges": len(edges_list),
        "complaints": sum(1 for n in nodes_list if n.type == "Complaint"),
        "accounts": sum(1 for n in nodes_list if n.type == "Account"),
        "transactions": sum(1 for n in nodes_list if n.type == "Transaction"),
        "atms": sum(1 for n in nodes_list if n.type == "ATM"),
        "investigations": sum(1 for n in nodes_list if n.type == "Investigation"),
        "alerts": sum(1 for n in nodes_list if n.type == "Alert"),
    }

    return StandardResponse(
        data=KnowledgeGraphResponse(
            nodes=nodes_list,
            edges=edges_list,
            stats=stats,
        )
    )
