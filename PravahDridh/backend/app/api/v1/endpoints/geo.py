from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.atm import ATMLocation
from app.models.transaction import SuspiciousTransaction
from app.schemas.atm import ATMGeoJSONFeatureCollection, ATMGeoJSONFeature, GeoJSONGeometry
from app.schemas.common import StandardResponse
from app.services.geospatial_service import GeospatialService

router = APIRouter()


@router.get("/atms", response_model=StandardResponse[ATMGeoJSONFeatureCollection])
async def get_atms_geojson(
    city: Optional[str] = None,
    state: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ATMLocation).where(ATMLocation.is_active == True)
    if city:
        query = query.where(ATMLocation.city == city)
    if state:
        query = query.where(ATMLocation.state == state)

    result = await db.execute(query.limit(1000))
    atms = result.scalars().all()

    features = []
    for atm in atms:
        features.append(
            ATMGeoJSONFeature(
                type="Feature",
                geometry=GeoJSONGeometry(
                    type="Point",
                    coordinates=[atm.longitude, atm.latitude]
                ),
                properties={
                    "id": str(atm.id),
                    "atm_code": atm.atm_code,
                    "bank_name": atm.bank_name,
                    "address": atm.address,
                    "city": atm.city,
                    "state": atm.state,
                }
            )
        )
    return StandardResponse(data=ATMGeoJSONFeatureCollection(type="FeatureCollection", features=features))


@router.get("/clusters")
async def get_dbscan_clusters(
    eps_km: float = Query(1.0, ge=0.1, le=10.0),
    min_samples: int = Query(3, ge=2, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SuspiciousTransaction.latitude, SuspiciousTransaction.longitude).limit(1000))
    coords = result.all()
    
    if not coords:
        return StandardResponse(data={"clusters": [], "total_points": 0})

    coords_list = [(c[0], c[1]) for c in coords]
    labels = GeospatialService.cluster_locations_dbscan(coords_list, eps_km=eps_km, min_samples=min_samples)

    clusters_map = {}
    for idx, label in enumerate(labels):
        if label != -1:  # ignore noise
            if label not in clusters_map:
                clusters_map[label] = []
            clusters_map[label].append({"lat": coords_list[idx][0], "lon": coords_list[idx][1]})

    return StandardResponse(
        data={
            "total_points": len(coords_list),
            "num_clusters": len(clusters_map),
            "clusters": clusters_map,
        }
    )
