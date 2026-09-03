# PS 26184 — Implementation Audit & Gap Analysis

**System**: HERMES AI (Predictive Analytics Framework for Cybercrime Cash-Withdrawal Forecasting)  
**Problem Statement**: SIH PS 26184  
**Date**: 2026-09-02  
**Status**: Comprehensive Technical Audit

---

## 1. Executive Summary

This document performs an exhaustive audit of the existing codebase to identify design mismatches, data leakage risks, training/serving inconsistencies, and structural gaps. The critical finding is that while the service and API skeletons exist, the **ML formulation previously trained on transaction records rather than candidate ATM locations over a future cutoff window**, and **feature extraction was not unified between training and serving**.

---

## 2. Detailed Component Audit

### 2.1 Reusable Modules (Solid Foundation)
- **FastAPI Core (`backend/app/main.py`, `backend/app/api/v1/api.py`)**: Well-structured modular routing, error handling envelopes (`StandardResponse`), and dependency injection.
- **SQLAlchemy 2.0 Base & Models (`backend/app/models/`)**: 10 core entities defined (`User`, `Complaint`, `Account`, `ATMLocation`, `SuspiciousTransaction`, `ModelRun`, `RiskPrediction`, `Alert`, `Investigation`, `InvestigationNote`, `AuditEvent`).
- **Authentication & Security (`backend/app/core/security.py`, `backend/app/core/deps.py`)**: Bcrypt password hashing, JWT access/refresh token generation, and RBAC dependency decorators (`require_roles`).
- **Audit Service (`backend/app/services/audit_service.py`)**: Tamper-evident SHA-256 evidence integrity hashing on state transitions.
- **Geospatial Utilities (`backend/app/services/geospatial_service.py`)**: Haversine distance, DBSCAN spatial clustering, and GeoJSON polygon buffer generation.

### 2.2 Broken / Problematic Modules (P0 / P1 Fixes Required)
1. **ML Training & Target Definition (`backend/data_generator/generate_data.py`, `backend/app/ml/trainer.py`)**:
   - *Problem*: Trained directly on transactions (`training_samples.append((feat_vec, is_cashout, tx_time))`), which classifies *whether a transaction is a cash-out*. However, the serving target for PS 26184 is *forecasting which ATMs are at elevated risk of cash withdrawal in future window $(T, T+H]$*.
   - *Fix*: Refactor prediction unit to **ATM / LOCATION $\times$ CUTOFF TIME $T$**.
2. **Train/Serve Feature Inconsistency (`backend/app/ml/feature_extractor.py` vs `backend/app/services/ml_inference_service.py`)**:
   - *Problem*: `generate_data.py` created synthetic feature vectors using arbitrary values during transaction loop, while `ml_inference_service.py` attempted to aggregate historical counts at runtime with arbitrary hardcoded assumptions.
   - *Fix*: Create a single, authoritative `FeatureBuilder` shared by both training dataset creation and real-time/batch inference.
3. **Model Fallback Fake Probability (`backend/app/services/ml_inference_service.py`)**:
   - *Problem*: When no model was loaded, it defaulted to heuristic probabilities (`0.45` / `0.10`), which masks missing ML state.
   - *Fix*: If no production model is registered/loaded, fail with an explicit `MODEL_NOT_INITIALIZED` error.
4. **PostGIS Database Population & Spatial Queries (`backend/app/models/atm.py`, `backend/app/models/transaction.py`)**:
   - *Problem*: PostGIS `Geometry(POINT, 4326)` columns were declared nullable and not explicitly populated via `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` during ingestion.
   - *Fix*: Explicitly populate geometry values on all spatial tables and execute native spatial queries (`ST_DWithin`, `ST_Distance`).
5. **Public Admin Registration Vulnerability (`backend/app/api/v1/endpoints/auth.py`)**:
   - *Problem*: `/auth/register` accepted any `role` string from the request body, allowing arbitrary self-assignment of `ADMIN`.
   - *Fix*: Restrict `/auth/register` to `VIEWER` only; administrative/investigator role assignment must be restricted to existing `ADMIN` users.
6. **Case Number Collision Risk (`backend/app/api/v1/endpoints/investigations.py`)**:
   - *Problem*: Used `random.randint(10000, 99999)` for case numbers which causes collision under concurrency.
   - *Fix*: Use sequential or UUID-derived entropy (`HERMES-2026-XXXXXX`).

### 2.3 Missing Modules / Gaps
- **Alembic PostGIS Migration**: Alembic migration script to run `CREATE EXTENSION IF NOT EXISTS postgis;` and initial DDL.
- **Model Artifact Directory Structure**: Formal `artifacts/` layout containing `model.joblib`, `feature_schema.json`, `metrics.json`, and `model_metadata.json`.
- **Top-K Metrics**: Explicit `Precision@K` (K=10, 20) and `Recall@K` (K=10, 20) evaluation functions.

---

## 3. Data & ML Flow Analysis

```
Current Broken Flow:
Transactions Loop -> Random Feature Vector -> Train Transaction Classifier -> Serve ATM Scoring with Mock Fallbacks

Target Correct Flow:
Synthetic Events Ingestion (Complaints, Accounts, Suspicious Txs, Cash-outs, ATMs)
    ↓
Database (PostgreSQL 16 + PostGIS 3.4)
    ↓
FeatureBuilder.build_training_examples(cutoffs, horizon=24h)
[Strict Cutoff Filter: event.occurred_at < T]
    ↓
Matrix X (ATM × T features strictly < T), Vector y (Cash-out in (T, T+24h])
    ↓
Chronological Split (Train: 70%, Val: 15%, Test: 15%)
    ↓
ModelTrainer (RandomForest / GradientBoosting / XGBoost)
    ↓
Evaluation (PR-AUC, ROC-AUC, Precision@K, Recall@K, Calibration)
    ↓
Model Artifacts & Registry (ModelRun Table)
    ↓
Serving: FeatureBuilder.build_for_inference(atm_id, T=now) -> Predict Prob -> RiskEngine -> Alerts -> Cases -> Audit
```

---

## 4. Proposed Repair Sequence

1. **Phase B — Database & PostGIS Setup**: Update models for native PostGIS geometry generation, add Alembic PostGIS migration.
2. **Phase C — Synthetic Data Pipeline**: Refactor `generate_data.py` to seed structured historical events with realistic spatial/temporal relationships.
3. **Phase D/E — FeatureBuilder**: Implement unified, leakage-safe `FeatureBuilder` for ATM $\times$ Cutoff $T$.
4. **Phase F/G/H — Training, Evaluation & Artifact Persistence**: Train real baseline model, compute Precision@K, Recall@K, PR-AUC, persist metadata.
5. **Phase I/J — Inference & Risk Engine**: Refactor `MLInferenceService` to use `FeatureBuilder` and `RiskEngine` without hardcoded fallback probabilities.
6. **Phase K/L — Auth & API Hardening**: Restrict public registration to `VIEWER`, fix query filtering and case collision.
7. **Phase M/N — Expanded Tests & Real E2E**: Comprehensive unit, integration, and end-to-end pipeline tests.
8. **Phase O/P — Documentation & Final Report**: Complete all design, API, ML, and evaluation documents.
