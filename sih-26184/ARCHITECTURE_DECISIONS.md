# HERMES AI — Architecture Decisions Record (ADR)

## ADR-001: Architecture Plan & Framework Selection
- **Status**: Approved (2026-09-02)
- **Context**: Smart India Hackathon Problem Statement 26184 requires a decision-support and intelligence-prioritization platform for forecasting cybercrime cash withdrawal locations.
- **Decision**:
  - Backend: FastAPI 0.111+ (Python 3.11) with async SQLAlchemy 2.0 and Pydantic v2.
  - Spatial Engine: PostgreSQL 16 + PostGIS 3.4 using GeoAlchemy2 and GIST indexes.
  - ML Strategy: Scikit-Learn baseline (Logistic Regression & Random Forest) + Gradient Boosting/XGBoost. No unjustified deep learning.
  - Explainability: Combined heuristic rule engine (R01-R06) with feature importance and SHAP reasoning.
  - Security: JWT HS256/RS256 with 6 RBAC roles and SHA-256 evidence integrity hashing on all audit events.

## ADR-002: Data Schema & Target Leakage Prevention
- **Status**: Approved (2026-09-02)
- **Context**: Cybercrime risk forecasting requires strict chronological validity to prevent future data leaking into historical feature vectors.
- **Decision**:
  - The `FeatureExtractor` takes `prediction_time` as an explicit anchor and restricts rolling windows (24h, 7d) to transactions occurring strictly prior to `prediction_time`.
  - Account numbers and sensitive victim PII are strictly stored as SHA-256 hashes or encrypted values.

## ADR-003: Composite Risk Formulation
- **Status**: Approved (2026-09-02)
- **Context**: Combining probabilistic predictions with domain heuristics and temporal decay.
- **Decision**:
  - `Final Risk Score = 0.60 * ML_Score + 0.30 * Rule_Score + 0.10 * exp(-0.05 * days_since_incident)`
  - Severity thresholds: LOW (0.00-0.30), MEDIUM (0.30-0.55), HIGH (0.55-0.75), CRITICAL (0.75-1.00).

## ADR-004: Standard Response Envelope & RBAC
- **Status**: Approved (2026-09-02)
- **Decision**: All REST endpoints output `{ status, data, meta, error }` standard envelope. Role checkers protect administrative and investigative endpoints.
