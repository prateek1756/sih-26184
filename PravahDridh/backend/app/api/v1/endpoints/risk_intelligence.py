"""
SIH PS 26184 — Risk Intelligence Engine API Endpoints
=======================================================
New API router: /api/v1/risk/...

STATUS: PRE-PRODUCTION CANDIDATE — Requires offline validation approval.
These endpoints are NEW and do NOT rename or modify existing routes:
  /api/v1/predictions/*  (unchanged)
  /api/v1/alerts/*       (unchanged)

New routes added:
  POST /api/v1/risk/evaluate       — Evaluate a single ATM
  POST /api/v1/risk/top            — Rank a cohort of ATMs (A1-primary)
  GET  /api/v1/risk/atm/{atm_id}   — Quick ATM risk lookup (demo with synthetic features)
  GET  /api/v1/risk/explanations/{atm_id} — Full explanation for an ATM

Auth/RBAC: Reuses get_current_user and require_roles from app.core.deps (unchanged).
Response envelope: Reuses StandardResponse from app.schemas.common (unchanged).
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, WebSocket, WebSocketDisconnect, HTTPException, status
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.risk_intelligence import (
    RiskEvaluationRequest,
    RiskEvaluationResponse,
    TopRiskATM,
    ExplanationResponse,
)
from app.schemas.live_ingestion import (
    TransactionEvent,
    ForecastUpdatePayload,
    ReplaySimulationRequest,
)
from app.services.risk_intelligence_service import RiskIntelligenceService
from app.services.live_ingestion_service import LiveIngestionService

from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post(
    "/evaluate",
    response_model=StandardResponse[RiskEvaluationResponse],
    summary="Evaluate single ATM risk with evidence-aware alert gate",
)
async def evaluate_atm_risk(
    body: RiskEvaluationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates risk for a single ATM using the experimental Risk Intelligence Engine.

    Returns **separate** `risk_score` and `alert_eligible` quantities.
    A high risk score does NOT automatically produce an alert —
    the evidence-aware gate requires corroborating primary + secondary signals.
    """
    result = RiskIntelligenceService.evaluate_atm(
        atm_id=body.atm_id,
        features=body.features,
        cutoff_time=body.cutoff_time,
        spatial_radius_km=body.spatial_radius_km,
        mapping_distance_km=body.mapping_distance_km,
    )
    return StandardResponse(data=result)


@router.post(
    "/top",
    response_model=StandardResponse[List[TopRiskATM]],
    summary="Rank ATM cohort by A1 primary signal (not equal-weight composite)",
)
async def get_top_risk_atms(
    cohort: List[dict],
    k: int = Query(20, ge=1, le=100),
    spatial_radius_km: float = Query(2.0, ge=0.1, le=50.0),
    current_user: User = Depends(get_current_user),
):
    """
    Ranks a cohort of ATMs using A1 Robust Z-Score as the primary signal.
    Full equal-weight composite is NOT used for ranking — it is available
    in per-ATM detail and alert evidence only.
    """
    result = RiskIntelligenceService.rank_atm_cohort(
        cohort=cohort,
        k=k,
        spatial_radius_km=spatial_radius_km,
    )
    return StandardResponse(data=result)


@router.get(
    "/atm/{atm_id}",
    response_model=StandardResponse[RiskEvaluationResponse],
    summary="Quick ATM risk evaluation with default features",
)
async def get_atm_risk(
    atm_id: str,
    spatial_radius_km: float = Query(2.0, ge=0.1, le=50.0),
    current_user: User = Depends(get_current_user),
):
    """
    Quick risk lookup for a single ATM using default/zero features.
    Intended for UI integration and live monitoring dashboards.

    Note: Without real pre-computed features, this returns a baseline LOW risk.
    Production integration must pass live computed features via POST /evaluate.
    """
    # Default features: baseline ATM with no active signals
    default_features = {
        "activity_ratio_24h": 1.0,
        "velocity_surge_24h_vs_7d": 1.0,
        "base_cw_rate_daily": 2.0,
        "recent_cw_count_24h": 2.0,
        "amount_ratio_24h": 1.0,
        "activity_delta_24h": 0.0,
        "connected_mule_accounts_7d": 0.0,
        "unique_account_surge_24h": 1.0,
        "suspicious_density_city_7d": 0.0,
        "hours_since_last_fraud": 720.0,
        "atm_cluster_density": 2.0,
        "is_weekend": 0.0,
        "hour_of_day": 12.0,
        "base_tx_count_30d": 60.0,
    }
    result = RiskIntelligenceService.evaluate_atm(
        atm_id=atm_id,
        features=default_features,
        spatial_radius_km=spatial_radius_km,
    )
    return StandardResponse(data=result)


@router.get(
    "/explanations/{atm_id}",
    response_model=StandardResponse[ExplanationResponse],
    summary="Full structured explanation for ATM risk evaluation",
)
async def get_atm_explanation(
    atm_id: str,
    current_user: User = Depends(require_roles(["ANALYST", "SUPERVISOR", "ADMIN"])),
):
    """
    Returns a full structured explanation for an ATM including:
    - Signal tier strengths
    - Factor contributions
    - Alert gate audit trail
    - Evidence strings
    - Data freshness and mapping confidence

    Restricted to ANALYST, SUPERVISOR, and ADMIN roles.
    """
    default_features = {
        "activity_ratio_24h": 1.0,
        "velocity_surge_24h_vs_7d": 1.0,
        "base_cw_rate_daily": 2.0,
        "recent_cw_count_24h": 2.0,
        "amount_ratio_24h": 1.0,
        "activity_delta_24h": 0.0,
        "connected_mule_accounts_7d": 0.0,
        "unique_account_surge_24h": 1.0,
        "suspicious_density_city_7d": 0.0,
        "hours_since_last_fraud": 720.0,
        "atm_cluster_density": 2.0,
        "is_weekend": 0.0,
        "hour_of_day": 12.0,
        "base_tx_count_30d": 60.0,
    }
    result = RiskIntelligenceService.get_explanation(
        atm_id=atm_id,
        features=default_features,
    )
    return StandardResponse(data=result)


# =============================================================================
# LIVE INGESTION & REAL-TIME FORECAST UPDATE (Task B)
# =============================================================================

@router.post(
    "/ingest",
    response_model=StandardResponse[ForecastUpdatePayload],
    summary="Ingest live transaction event and trigger causal forecast update",
)
async def ingest_live_transaction(
    event: TransactionEvent,
    background_tasks: BackgroundTasks,
    top_k: int = Query(10, ge=1, le=100),
    forecast_horizon_hours: int = Query(48, ge=6, le=168),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests a live banking transaction event, causally updates the ATM/account
    rolling state, evaluates A1 primary ranking and Alert Gate, broadcasts
    updates to WebSocket clients, and returns the updated forecast.

    Persistence (additive, non-blocking):
      The in-memory `ingest_transaction()` runs synchronously and returns
      immediately.  DB writes (SuspiciousTransaction, RiskPrediction, Alert)
      are fired as a BackgroundTask so they do not add latency to the response.
    """
    svc = LiveIngestionService.get_instance()
    try:
        update_payload = svc.ingest_transaction(
            event=event,
            forecast_horizon_hours=forecast_horizon_hours,
            top_k=top_k,
        )
        # Broadcast asynchronously to connected WebSocket clients
        await svc.broadcast_forecast_update(update_payload)
        # Persist to PostgreSQL in the background (non-blocking)
        background_tasks.add_task(
            svc.persist_ingestion_to_db, event, update_payload, db
        )
        return StandardResponse(data=update_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/replay",
    response_model=StandardResponse[dict],
    summary="Trigger historical transaction stream replay simulation",
)
async def trigger_stream_replay(
    req: ReplaySimulationRequest,
    current_user: User = Depends(require_roles(["ANALYST", "SUPERVISOR", "ADMIN"])),
):
    """
    Triggers historical transaction replay simulation feeding transactions
    chronologically through the live ingestion pipeline.
    """
    svc = LiveIngestionService.get_instance()
    summary = svc.run_replay_simulation(
        incident_city=req.city,
        max_events=req.max_events,
        forecast_horizon_hours=req.forecast_horizon_hours,
    )
    return StandardResponse(data=summary)


@router.websocket("/ws")
async def websocket_forecast_feed(websocket: WebSocket):
    """
    WebSocket endpoint broadcasting real-time forecast updates and alert transitions.
    """
    svc = LiveIngestionService.get_instance()
    await svc.connect_websocket(websocket)
    try:
        while True:
            # Keep-alive loop
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        svc.disconnect_websocket(websocket)

