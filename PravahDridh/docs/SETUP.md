# PravahDridh — Environment Setup & Execution Guide

## 1. Prerequisites
- Python 3.11+ (Windows / Linux / macOS)
- PostgreSQL 15+ with PostGIS extension enabled
- Native virtual environment (`venv`)

## 2. Backend Installation

```bash
cd PravahDridh/backend

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/macOS

# 2. Install dependencies
pip install -r requirements.txt
pip install xgboost lightgbm

# 3. Environment variables (.env)
DATABASE_URL=postgresql+asyncpg://hermes_user:hermes_password@localhost:5500/pravahdridh
SYNC_DATABASE_URL=postgresql://hermes_user:hermes_password@localhost:5500/pravahdridh
SECRET_KEY=hermes-production-secret-key-2026-sih
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# 4. Run Alembic Database Migrations
alembic upgrade head

# 5. Run Data Fusion & Model Training
python data_generator/data_fusion_pipeline.py
python data_generator/benchmark_models.py

# 6. Run Test Suite
python -m pytest -v

# 7. Start FastAPI Development Server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 3. API Contract Access
- Interactive Swagger UI: `http://localhost:8000/docs`
- OpenAPI Specification: `http://localhost:8000/openapi.json`
- Health Check: `http://localhost:8000/health`
