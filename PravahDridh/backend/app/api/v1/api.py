from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    complaints,
    transactions,
    predictions,
    alerts,
    geo,
    investigations,
    audit,
    models,
    risk_intelligence,  # NEW: Risk Intelligence Engine (pre-production candidate)
    graph,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(complaints.router, prefix="/complaints", tags=["Complaints"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["Risk Predictions"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(geo.router, prefix="/geo", tags=["Geospatial"])
api_router.include_router(investigations.router, prefix="/investigations", tags=["Investigations"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit & Evidence"])
api_router.include_router(models.router, prefix="/models", tags=["Model Registry"])
api_router.include_router(graph.router, prefix="/graph", tags=["Knowledge Graph"])

# NEW: Risk Intelligence Engine endpoints (pre-production candidate, isolated)
api_router.include_router(risk_intelligence.router, prefix="/risk", tags=["Risk Intelligence Engine"])

