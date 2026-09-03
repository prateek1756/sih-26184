# HERMES AI — Architecture Specification
### Smart India Hackathon · Problem Statement 26184

---

## 1. System Overview

**HERMES AI** (*Heuristic Engine for Risk Mapping and Early-warning of Suspicious activity*) is a predictive analytics and decision-support platform designed to assist Law Enforcement Agencies (LEAs) in forecasting geographical locations at elevated risk of cybercrime cash withdrawals.

```
Predict → Prioritize → Explain → Alert → Act → Audit → Learn
```

---

## 2. Multi-Tier Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
│   React (Vite) + Leaflet/MapLibre GL + Chart.js             │
│   Dashboards: Threat Analyst / Field Officer / Supervisor   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / JWT Auth Header
┌────────────────────────▼────────────────────────────────────┐
│                    FASTAPI GATEWAY LAYER                    │
│   /api/v1/* (OpenAPI 3.1) · Rate Limiting · RBAC Guards     │
│   Request/Response Validation via Pydantic v2 ConfigDict    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ ML Inference Service  │   │ Risk Engine (R01-R06)     │  │
│  │ (FeatureBuilder + RF) │   │ Composite Risk Score      │  │
│  └───────────────────────┘   └───────────────────────────┘  │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ Geospatial Engine     │   │ Alert Service &           │  │
│  │ (PostGIS ST_* + DBSCAN│   │ Case Investigation        │  │
│  └───────────────────────┘   └───────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Audit Service (Cryptographic SHA-256 State Hashing)   │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      DATA LAYER                             │
│   PostgreSQL 16 + PostGIS 3.4 (Authoritative Store)         │
│   Alembic Migrations · Spatial GIST Indexes                 │
│   Model Artifact Registry (artifacts/*.joblib)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

1. **FastAPI Gateway (`backend/app/main.py`)**:
   - Manages asynchronous API request lifecycles.
   - Enforces standard JSON envelope `{ status, data, meta, error }`.
   - Protects administrative endpoints with JWT RBAC dependencies.

2. **FeatureBuilder (`backend/app/ml/feature_builder.py`)**:
   - Single source of truth for both training matrix generation and production serving.
   - Strictly enforces cutoff $T$: only records where `occurred_at < T` enter the feature vector.

3. **Risk Engine (`backend/app/services/risk_engine.py`)**:
   - Evaluates domain rules **R01–R06** against actual computed historical signals.
   - Computes composite risk score:
     $$\text{Risk Score} = 0.60 \times P(\text{ML}) + 0.30 \times \text{RuleScore} + 0.10 \times e^{-0.05 \times \text{days}}$$
   - Classifies risk severity: `LOW` (0–30), `MEDIUM` (30–55), `HIGH` (55–75), `CRITICAL` (75–100).

4. **Geospatial Engine (`backend/app/services/geospatial_service.py`)**:
   - Native PostGIS geometry operations (`Geometry(POINT, 4326)` and `Geometry(POLYGON, 4326)`).
   - DBSCAN spatial clustering over recent incident coordinates.
   - Dynamic GeoJSON polygon buffer generation for hotspot visualization.

5. **Audit Service (`backend/app/services/audit_service.py`)**:
   - Generates immutable SHA-256 evidence integrity hashes for all case transitions and alerts.
