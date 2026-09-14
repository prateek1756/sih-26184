# PravahDridh — Cybercrime Cash-Withdrawal Predictive Analytics Platform

> **Heuristic Engine for Risk Mapping and Early-warning of Suspicious activity**  
> Smart India Hackathon · Problem Statement 26184

PravahDridh is a geospatial decision-support and intelligence-prioritization platform that helps **Law Enforcement Agencies (LEAs)** forecast ATM locations at elevated risk of cybercrime cash withdrawals — before incidents occur.

```
Predict → Prioritize → Explain → Alert → Act → Audit → Learn
```

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [System Workflow](#system-workflow)
- [ML Pipeline](#ml-pipeline)
- [Risk Scoring Formula](#risk-scoring-formula)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [RBAC — Role-Based Access Control](#rbac--role-based-access-control)
- [Quickstart](#quickstart)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Architecture Decision Records](#architecture-decision-records)

---

## Overview

Cybercrime cash withdrawals follow predictable spatial and temporal patterns. PravahDridh ingests complaint data, transaction signals, and ATM coordinates to:

1. **Predict** fraud probability per ATM per time window using ML.
2. **Score** each candidate using a composite risk engine (ML + domain rules + temporal decay).
3. **Explain** every prediction with human-readable rule triggers and SHAP feature contributions.
4. **Alert** supervisors and investigators in a prioritized queue.
5. **Track** investigations and resolutions through a full case lifecycle.
6. **Audit** all actions with cryptographic SHA-256 integrity hashes.

---

## Architecture

```
+------------------------------------------------------------------+
|                        FRONTEND LAYER                            |
|  React 18 + TypeScript + Vite                                    |
|  Leaflet / React-Leaflet  *  Recharts  *  Lucide Icons           |
|  Dashboards: Threat Analyst / Field Officer / Supervisor         |
+------------------------------+-----------------------------------+
                               | HTTPS / JWT Bearer Token
+------------------------------v-----------------------------------+
|                     FASTAPI GATEWAY LAYER                        |
|  /api/v1/*  *  OpenAPI 3.1  *  Rate Limiting  *  RBAC Guards     |
|  Pydantic v2 Request/Response Validation                         |
|  Standard Envelope: { status, data, meta, error }                |
+------------------------------+-----------------------------------+
                               |
       +-----------------------+-----------------------+
       |                       |                       |
+------v------+        +-------v--------+      +-------v----------+
|  ML Engine  |        |  Risk Engine   |      | Geospatial Engine|
|             |        |                |      |                  |
| FeatureBuilder       | Rules R01-R06  |      | PostGIS ST_*     |
| RandomForest |        | Composite Score|      | DBSCAN Clustering|
| XGBoost/LGBM|        | Severity Bands |      | GeoJSON Polygons |
+------+------+        +-------+--------+      +-------+----------+
       |                       |                       |
+------v-----------------------v-----------------------v----------+
|                      SERVICE LAYER                               |
|  Alert Service  *  Case Investigation  *  Audit Service         |
|  SHA-256 Evidence Integrity Hashing on all state transitions    |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|                        DATA LAYER                                |
|  PostgreSQL 16 + PostGIS 3.4  (Authoritative Store)             |
|  Alembic Migrations  *  Spatial GIST Indexes                    |
|  Redis 7 (Session / Rate-Limit Cache)                           |
|  Model Artifact Registry  (backend/artifacts/*.joblib)          |
+------------------------------------------------------------------+
```

---

## System Workflow

```
+------------------------------------------------------------------+
|  STEP 1 — DATA INGESTION                                         |
|    Cybercrime complaints --> PostgreSQL                          |
|    ATM location metadata --> PostGIS geometry columns            |
|    Transaction signals   --> Indexed by occurred_at + coords     |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 2 — FEATURE EXTRACTION  (FeatureBuilder)                   |
|    Anchor time T is set per prediction request                   |
|    Only events where occurred_at < T enter the feature vector    |
|    15 features: temporal, velocity, financial, spatial, network  |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 3 — ML INFERENCE                                           |
|    RandomForestClassifier (primary, rf-v1.0.joblib)              |
|    Output: P(fraud) in [0, 1] per candidate ATM                  |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 4 — COMPOSITE RISK SCORING  (Risk Engine)                  |
|    Domain rules R01-R06 evaluated against historical signals     |
|    Temporal decay applied for recency weighting                  |
|    Final Score = 0.60 x ML + 0.30 x Rules + 0.10 x Decay         |
|    Classified: LOW | MEDIUM | HIGH | CRITICAL                    |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 5 — GEOSPATIAL CLUSTERING                                  |
|    DBSCAN over recent incident coordinates                       |
|    GeoJSON polygon hotspot buffers generated                     |
|    Top-K ATM target ranking surfaced to frontend                 |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 6 — ALERT & INVESTIGATION LIFECYCLE                        |
|    Predictions auto-generate prioritized alerts                  |
|    Supervisors assign to field investigators                     |
|    Investigators open cases, add notes, close with findings      |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|  STEP 7 — AUDIT TRAIL                                            |
|    Every state transition hashed with SHA-256                    |
|    Tamper-evident log queryable by Supervisors+                  |
+------------------------------------------------------------------+
```

---

## ML Pipeline

### Problem Formulation

| Property | Value |
| --- | --- |
| **Prediction Unit** | Candidate ATM x Cutoff Time T |
| **Prediction Horizon** | 24 Hours |
| **Target Label (y = 1)** | Confirmed cybercrime cash withdrawal at ATM in (T, T+24h] |
| **Primary Metric** | PR-AUC (handles ~6% positive class imbalance) |
| **Secondary Metrics** | Precision@K, Recall@K (K=10,20), Brier Score |

### Feature Set (15 Features)

| # | Feature | Domain | Description |
| --- | --- | --- | --- |
| 1 | `hour_of_day` | Temporal | Hour of cutoff T (0-23) |
| 2 | `day_of_week` | Temporal | Day of cutoff T (0 = Monday) |
| 3 | `is_weekend` | Temporal | Binary weekend flag |
| 4 | `recent_activity_count_24h` | Velocity | Suspicious txns within 2km in last 24h |
| 5 | `recent_activity_count_7d` | Velocity | Suspicious txns within 2km in last 7d |
| 6 | `recent_amount_24h` | Financial | Total INR transacted within 2km in 24h |
| 7 | `max_single_amount_24h` | Financial | Max single transfer within 2km in 24h |
| 8 | `historical_cashout_count_30d` | History | Cash-outs at ATM in past 30d |
| 9 | `historical_incident_count_500m` | Spatial | Incidents within 500m in past 30d |
| 10 | `historical_incident_count_2km` | Spatial | Incidents within 2km in past 30d |
| 11 | `atm_density_1km` | Spatial | Neighboring ATM count within 1km |
| 12 | `connected_mule_accounts_count` | Network | Distinct mule-flagged accounts within 2km in 7d |
| 13 | `unique_accounts_24h` | Network | Distinct transacting accounts within 2km in 24h |
| 14 | `hours_since_last_activity` | Recency | Hours since most recent transaction before T |
| 15 | `amount_log_24h` | Financial | log1p(total 24h amount) |

### Training Strategy

Chronological split — **no random shuffling** across time — guarantees zero temporal data leakage:

```
Timeline ---------------------------------------------------------------->
         |<-------- 70% TRAIN ------->|<-- 15% VAL -->|<-- 15% TEST -->|
```

### Model Artifacts (`backend/artifacts/`)

| File | Description |
| --- | --- |
| `rf-v1.0.joblib` | Serialized RandomForestClassifier (balanced class weights) |
| `feature_schema.json` | Strict 15-feature name and ordering definition |
| `metrics.json` | PR-AUC, ROC-AUC, Precision@K, Brier score |
| `model_metadata.json` | Version, training timestamp, hyperparameters |

---

## Risk Scoring Formula

```
Final Risk Score = 0.60 x ML_Score
                + 0.30 x Rule_Score (R01-R06)
                + 0.10 x exp(-0.05 x days_since_last_incident)
```

| Severity | Score Range | Recommended Action |
| --- | --- | --- |
| LOW | 0.00 – 0.30 | Monitor only |
| MEDIUM | 0.30 – 0.55 | Increased surveillance |
| HIGH | 0.55 – 0.75 | Dispatch field officer |
| CRITICAL | 0.75 – 1.00 | Immediate intervention |

**Domain Rules R01–R06** encode expert knowledge — repeated mule-account activity, unusually high single transactions, ATM clustering in known hotspots, and temporal surge patterns — and contribute 30% of the final score.

---

## Tech Stack

### Backend

| Layer | Technology |
| --- | --- |
| **API Framework** | FastAPI 0.111+ (async, OpenAPI 3.1) |
| **Runtime** | Python 3.11, Uvicorn |
| **ORM** | SQLAlchemy 2.0 (async) + Pydantic v2 |
| **Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Cache** | Redis 7 |
| **Migrations** | Alembic |
| **Auth** | JWT HS256/RS256, python-jose, passlib/bcrypt |
| **ML** | Scikit-Learn, XGBoost, LightGBM, SHAP |
| **Geospatial** | GeoAlchemy2, GeoPandas, Shapely, SciPy (DBSCAN) |
| **Task Queue** | Celery |
| **Testing** | Pytest, pytest-asyncio |

### Frontend

| Layer | Technology |
| --- | --- |
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **Maps** | Leaflet + React-Leaflet |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **HTTP Client** | Axios |
| **Router** | React Router DOM v6 |

### Infrastructure

| Component | Technology |
| --- | --- |
| **Containerization** | Docker + Docker Compose |
| **Database Image** | `postgis/postgis:16-3.4` |
| **Cache Image** | `redis:7-alpine` |

---

## Project Structure

```
sih-26184/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/       # Route handlers (auth, complaints, predictions, alerts, ...)
│   │   ├── core/                   # Settings, JWT, security utilities
│   │   ├── db/                     # Database session, declarative base
│   │   ├── ml/
│   │   │   ├── feature_builder.py  # Single source of truth for feature extraction
│   │   │   └── trainer.py          # Model training pipeline
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   ├── schemas/                # Pydantic v2 request / response schemas
│   │   ├── services/
│   │   │   ├── risk_engine.py      # Composite risk scoring (R01-R06 + ML + decay)
│   │   │   ├── geospatial_service.py  # PostGIS / DBSCAN / GeoJSON
│   │   │   └── audit_service.py    # SHA-256 tamper-evident audit trail
│   │   └── main.py                 # FastAPI app factory
│   ├── alembic/                    # Database migration scripts
│   ├── artifacts/                  # Trained model files (*.joblib, *.json)
│   ├── data_generator/             # Synthetic data seeding scripts
│   ├── experiments/                # Model comparison scripts / notebooks
│   ├── tests/                      # Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Route-level page views
│   │   └── services/               # Axios API client wrappers
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── docs/                           # Architecture, ML spec, API contract, audit reports
│   ├── ARCHITECTURE.md
│   ├── ML_SPEC.md
│   ├── API_CONTRACT.md
│   └── DATA_MODEL.md
├── docker-compose.yml
└── ARCHITECTURE_DECISIONS.md
```

---

## API Reference

**Base URL**: `http://localhost:8000/api/v1`  
**Interactive Docs**: `http://localhost:8000/api/v1/docs`

All responses follow the standard envelope:

```json
{
  "status": "success | error",
  "data": {},
  "meta": { "page": 1, "per_page": 20, "total": 100, "total_pages": 5 },
  "error": null
}
```

### Authentication

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Register new user (assigned VIEWER role) | Public |
| `POST` | `/auth/login` | Login and receive JWT tokens | Public |
| `POST` | `/auth/refresh` | Refresh access token | Public |
| `GET` | `/auth/me` | Get current user profile | Authenticated |

### Cybercrime Complaints

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/complaints` | List complaints with filters | Authenticated |
| `POST` | `/complaints` | Ingest new complaint | `ANALYST+` |
| `GET` | `/complaints/{id}` | Get complaint detail | Authenticated |
| `PATCH` | `/complaints/{id}` | Update complaint status | `ANALYST+` |

### Predictions & Risk Intelligence

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/predictions` | List scored ATM predictions | Authenticated |
| `GET` | `/predictions/{id}` | Prediction detail with SHAP reasons | Authenticated |
| `POST` | `/predictions/run` | Trigger batch inference pipeline | `ML_ENGINEER+` |
| `GET` | `/predictions/hotspots` | GeoJSON high-risk polygon zones | Authenticated |
| `GET` | `/predictions/top-k` | Top-K highest priority ATM targets | Authenticated |

### Alerts & Intervention

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/alerts` | List prioritized active alerts | Authenticated |
| `GET` | `/alerts/{id}` | Alert detail with linked prediction | Authenticated |
| `POST` | `/alerts/{id}/acknowledge` | Investigator acknowledges alert | `INVESTIGATOR+` |
| `PATCH` | `/alerts/{id}/assign` | Assign alert to field investigator | `SUPERVISOR+` |
| `PATCH` | `/alerts/{id}/resolve` | Resolve or flag as false positive | `INVESTIGATOR+` |

### Case Investigation

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/investigations` | List investigation cases | Authenticated |
| `POST` | `/investigations` | Create case from alert | `INVESTIGATOR+` |
| `GET` | `/investigations/{id}` | Case detail with notes history | Authenticated |
| `PATCH` | `/investigations/{id}` | Update status / priority / findings | `INVESTIGATOR+` |
| `POST` | `/investigations/{id}/notes` | Add progress note | `INVESTIGATOR+` |

### Geospatial & Maps

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/geo/atms` | ATM GeoJSON FeatureCollection | Authenticated |
| `GET` | `/geo/clusters` | DBSCAN spatial cluster coordinates | Authenticated |

### Model Registry & Audit

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/models` | List all trained model runs + metrics | Authenticated |
| `GET` | `/models/{id}` | Detailed model metrics (PR-AUC, Precision@K) | Authenticated |
| `POST` | `/models/{id}/promote` | Promote model to production | `ML_ENGINEER+` |
| `GET` | `/audit/events` | Query tamper-evident audit trail | `SUPERVISOR+` |
| `GET` | `/audit/events/{id}` | Single audit event with SHA-256 hash | `SUPERVISOR+` |

---

## RBAC — Role-Based Access Control

| Role | Email | Password | Permissions |
| --- | --- | --- | --- |
| **Admin** | `admin@hermes.gov.in` | `Admin@123` | Full system access |
| **Supervisor** | `supervisor@hermes.gov.in` | `Super@123` | Assign alerts, view audit trail |
| **Investigator** | `investigator@hermes.gov.in` | `Invest@123` | Acknowledge / resolve alerts, manage cases |
| **Analyst** | `analyst@hermes.gov.in` | `Analyst@123` | Ingest complaints, view predictions |
| **ML Engineer** | `ml@hermes.gov.in` | `MlEng@123` | Trigger inference, promote models |
| **Viewer** | *(self-registered)* | *(user-defined)* | Read-only access |

---

## Quickstart

### Option 1 — Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL + PostGIS, Redis, FastAPI backend)
docker-compose up --build
```

| Service | URL |
| --- | --- |
| API Server | `http://localhost:8000` |
| Swagger Docs | `http://localhost:8000/api/v1/docs` |
| OpenAPI JSON | `http://localhost:8000/api/v1/openapi.json` |
| Health Check | `http://localhost:8000/health` |

### Option 2 — Local Python Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate      # Linux / macOS

pip install -r requirements.txt

# Seed database and train ML baseline
python data_generator/generate_data.py

# Start development server
uvicorn app.main:app --reload --port 8000
```

```bash
# Start frontend dev server
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL connection URL |
| `SYNC_DATABASE_URL` | `postgresql://...` | Sync connection (Alembic / seeding) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis cache URL |
| `SECRET_KEY` | *(change in production)* | JWT signing secret |
| `ENVIRONMENT` | `development` | `development` or `production` |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |

---

## Running Tests

```bash
cd backend

# Run full test suite
pytest

# Verbose output
pytest -v

# Run specific test file
pytest tests/test_risk_engine.py
```

---

## Architecture Decision Records

See [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) for full rationale.

| ADR | Decision | Rationale |
| --- | --- | --- |
| **ADR-001** | FastAPI + PostgreSQL/PostGIS + Scikit-Learn | Async performance, native spatial indexing, explainable ML |
| **ADR-002** | Strict cutoff `T` in FeatureBuilder | Prevents future data leaking into historical feature vectors |
| **ADR-003** | Composite risk formula (60/30/10 split) | Balances probabilistic ML with domain expert heuristics |
| **ADR-004** | Standard `{ status, data, meta, error }` envelope | Consistent, machine-readable API contract across all endpoints |

---

## Documentation Index

| Document | Description |
| --- | --- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Comprehensive System Architecture Specification** (Multi-tier, Services, PostGIS, Security) |
| [`SYSTEM_WORKFLOW.md`](./SYSTEM_WORKFLOW.md) | **End-to-End System Workflow Specification** (Sequence Diagrams, Phase Breakdown, State Machine) |
| [`docs/ML_SPEC.md`](./docs/ML_SPEC.md) | ML problem formulation, 15-feature matrix definitions, evaluation metrics |
| [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) | Complete REST API endpoint reference and payload specifications |
| [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | PostgreSQL / PostGIS database schema and entity relationships |
| [`docs/SETUP.md`](./docs/SETUP.md) | Detailed environment setup and development guide |
| [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) | Architecture Decision Records (ADRs) |

---

*Smart India Hackathon 2026 · Problem Statement 26184 · Team PravahDridh*
