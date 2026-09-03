import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.prediction import RiskPrediction
from app.models.atm import ATMLocation
from app.schemas.prediction import (
    RiskPredictionRead,
    PredictionRunRequest,
    TopKRequest,
    HotspotGeoJSONCollection,
    HotspotPolygonFeature,
)
from app.schemas.common import StandardResponse, PaginationMeta
from app.services.ml_inference_service import MLInferenceService
from app.services.geospatial_service import GeospatialService
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=StandardResponse[List[RiskPredictionRead]])
async def list_predictions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    severity: Optional[str] = None,
    city: Optional[str] = None,
    is_active: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RiskPrediction)
        .join(RiskPrediction.atm)
        .options(selectinload(RiskPrediction.atm))
        .where(RiskPrediction.is_active == is_active)
    )
    if severity:
        query = query.where(RiskPrediction.severity == severity)
    if city:
        query = query.where(ATMLocation.city == city)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Sort by risk score descending
    offset = (page - 1) * per_page
    query = query.order_by(desc(RiskPrediction.risk_score)).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    response_items = []
    for item in items:
        p_read = RiskPredictionRead(
            id=item.id,
            model_version=item.model_version,
            location_id=item.location_id,
            latitude=item.latitude,
            longitude=item.longitude,
            risk_score=item.risk_score,
            severity=item.severity,
            confidence=item.confidence,
            predicted_window_start=item.predicted_window_start,
            predicted_window_end=item.predicted_window_end,
            reasons=item.reasons or [],
            is_active=item.is_active,
            predicted_at=item.predicted_at,
            atm_code=item.atm.atm_code if item.atm else None,
            bank_name=item.atm.bank_name if item.atm else None,
            city=item.atm.city if item.atm else None,
        )
        response_items.append(p_read)

    meta = PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )
    return StandardResponse(data=response_items, meta=meta)


@router.get("/{prediction_id}", response_model=StandardResponse[RiskPredictionRead])
async def get_prediction_detail(
    prediction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RiskPrediction)
        .options(selectinload(RiskPrediction.atm))
        .where(RiskPrediction.id == prediction_id)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Prediction not found")

    p_read = RiskPredictionRead(
        id=item.id,
        model_version=item.model_version,
        location_id=item.location_id,
        latitude=item.latitude,
        longitude=item.longitude,
        risk_score=item.risk_score,
        severity=item.severity,
        confidence=item.confidence,
        predicted_window_start=item.predicted_window_start,
        predicted_window_end=item.predicted_window_end,
        reasons=item.reasons or [],
        is_active=item.is_active,
        predicted_at=item.predicted_at,
        atm_code=item.atm.atm_code if item.atm else None,
        bank_name=item.atm.bank_name if item.atm else None,
        city=item.atm.city if item.atm else None,
    )
    return StandardResponse(data=p_read)


@router.post("/run", response_model=StandardResponse[List[RiskPredictionRead]])
async def trigger_prediction_run(
    run_req: PredictionRunRequest,
    request: Request,
    current_user: User = Depends(require_roles(["ML_ENGINEER", "SUPERVISOR", "ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    predictions = await MLInferenceService.run_batch_inference(
        db=db,
        window_hours=run_req.window_hours,
        min_risk_threshold=run_req.min_risk_threshold,
        model_version=run_req.model_version,
    )

    await AuditService.log_event(
        db=db,
        event_type="PREDICTION_BATCH_RUN",
        actor=current_user,
        resource_type="RiskPrediction",
        action_details={"generated_count": len(predictions), "window_hours": run_req.window_hours},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return StandardResponse(
        data=[RiskPredictionRead.model_validate(p) for p in predictions[:50]]
    )


@router.get("/hotspots", response_model=StandardResponse[HotspotGeoJSONCollection])
async def get_hotspots_geojson(
    city: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RiskPrediction)
        .join(RiskPrediction.atm)
        .options(selectinload(RiskPrediction.atm))
        .where(RiskPrediction.is_active == True)
        .where(RiskPrediction.severity.in_(["HIGH", "CRITICAL"]))
    )
    if city:
        query = query.where(ATMLocation.city == city)

    query = query.order_by(desc(RiskPrediction.risk_score)).limit(100)
    result = await db.execute(query)
    predictions = result.scalars().all()

    features = []
    for pred in predictions:
        poly_geom = GeospatialService.create_risk_polygon(pred.latitude, pred.longitude, radius_meters=1000.0)
        feature = HotspotPolygonFeature(
            type="Feature",
            geometry=poly_geom,
            properties={
                "prediction_id": str(pred.id),
                "risk_score": float(pred.risk_score),
                "severity": pred.severity,
                "confidence": float(pred.confidence),
                "atm_code": pred.atm.atm_code if pred.atm else "UNKNOWN",
                "bank_name": pred.atm.bank_name if pred.atm else "UNKNOWN",
                "city": pred.atm.city if pred.atm else "UNKNOWN",
                "reasons": pred.reasons or [],
            },
        )
        features.append(feature)

    return StandardResponse(data=HotspotGeoJSONCollection(type="FeatureCollection", features=features))


@router.get("/top-k", response_model=StandardResponse[List[RiskPredictionRead]])
async def get_top_k_predictions(
    k: int = Query(20, ge=1, le=100),
    city: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RiskPrediction)
        .join(RiskPrediction.atm)
        .options(selectinload(RiskPrediction.atm))
        .where(RiskPrediction.is_active == True)
    )
    if city:
        query = query.where(ATMLocation.city == city)

    query = query.order_by(desc(RiskPrediction.risk_score)).limit(k)
    result = await db.execute(query)
    items = result.scalars().all()
    
    response_items = []
    for item in items:
        response_items.append(
            RiskPredictionRead(
                id=item.id,
                model_version=item.model_version,
                location_id=item.location_id,
                latitude=item.latitude,
                longitude=item.longitude,
                risk_score=item.risk_score,
                severity=item.severity,
                confidence=item.confidence,
                predicted_window_start=item.predicted_window_start,
                predicted_window_end=item.predicted_window_end,
                reasons=item.reasons or [],
                is_active=item.is_active,
                predicted_at=item.predicted_at,
                atm_code=item.atm.atm_code if item.atm else None,
                bank_name=item.atm.bank_name if item.atm else None,
                city=item.atm.city if item.atm else None,
            )
        )
    return StandardResponse(data=response_items)
