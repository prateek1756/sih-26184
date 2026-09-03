# HERMES AI — Cybercrime Cash-Withdrawal Predictive Analytics Platform
### Smart India Hackathon · PS 26184

HERMES AI (**Heuristic Engine for Risk Mapping and Early-warning of Suspicious activity**) is a decision-support and intelligence-prioritization platform for law enforcement agencies to forecast locations at elevated risk of cybercrime cash withdrawals.

```
Predict → Prioritize → Explain → Alert → Act → Audit → Learn
```

---

## 🚀 Quickstart

### 1. Run via Docker Compose (PostGIS + Redis + FastAPI)
```bash
docker-compose up --build
```
- **API Server**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/api/v1/docs`
- **OpenAPI JSON**: `http://localhost:8000/api/v1/openapi.json`
- **Health Check**: `http://localhost:8000/health`

---

### 2. Local Python Setup (Without Docker)
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

#### Run Database Seeding & ML Baseline Training:
```bash
python data_generator/generate_data.py
```

#### Run Fast API Development Server:
```bash
uvicorn app.main:app --reload --port 8000
```

#### Run Pytest Test Suite:
```bash
pytest
```

---

## 🛡️ Default RBAC Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@hermes.gov.in` | `Admin@123` |
| **Supervisor** | `supervisor@hermes.gov.in` | `Super@123` |
| **Investigator** | `investigator@hermes.gov.in` | `Invest@123` |
| **Analyst** | `analyst@hermes.gov.in` | `Analyst@123` |
| **ML Engineer** | `ml@hermes.gov.in` | `MlEng@123` |

---

## 🏗️ Architecture & Modules

- **FastAPI 0.111+ Backend**: RESTful API under `/api/v1/*` with standard envelopes and JWT RBAC.
- **PostgreSQL 16 + PostGIS 3.4**: Spatial indexing (GIST) for ATM coordinates and Risk Zones.
- **Risk Engine**: Multi-tier scoring (`ML probability` + `Rule Heuristics R01-R06` + `Temporal Decay`).
- **Geospatial Engine**: Haversine distance, DBSCAN spatial clustering, and GeoJSON polygon buffers.
- **Audit Service**: Tamper-evident SHA-256 evidence integrity hashing on all case and prediction actions.
