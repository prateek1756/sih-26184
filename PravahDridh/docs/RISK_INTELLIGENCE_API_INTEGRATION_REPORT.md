# RISK INTELLIGENCE API INTEGRATION VALIDATION REPORT
## SIH PS 26184 — Task C: End-to-End API Execution & Forecasting Capability Verification

**Audit Date:** 2026-09-03  
**Organization:** Ministry of Home Affairs / I4C / CIS Division  
**Problem Statement ID:** PS 26184  
**Engine Version:** `rie-candidate-v0.1`  
**Safety Status:** Production model (`rf-v1.0.joblib` 300,489 bytes) and production services remain **100% UNTOUCHED**.

---

## 1. Test Environment & Execution Overview

- **Framework:** FastAPI / Pydantic v2 / SQLAlchemy Async
- **Test Runner:** `pytest 9.0.2` with `TestClient` (Starlette ASGI transport)
- **Database:** PostgreSQL (Schema unmodified, no migrations executed)
- **Test File Created:** [`tests/integration/test_risk_intelligence_api.py`](file:///c:/Users/Prateek/Desktop/sih/sih-26184/backend/tests/integration/test_risk_intelligence_api.py)
- **Total Integration Tests Executed:** 15 test cases (100% Passed)
- **Full Suite Status:** 54 Passed (36 unit + 18 integration), 0 Failed.

---

## 2. APIs Tested & HTTP Status Results

| Endpoint | Method | Auth / RBAC Required | Test Scenario | HTTP Status | Result |
| :--- | :---: | :---: | :--- | :---: | :---: |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Unauthenticated request | `401/403` | ✅ PASS |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Missing `features` payload | `422` | ✅ PASS |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Negative `spatial_radius_km` | `422` | ✅ PASS |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Baseline ATM evaluation | `200` | ✅ PASS |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Surge ATM + Mule accounts | `200` | ✅ PASS |
| `/api/v1/risk/evaluate` | `POST` | Bearer Token (`ANALYST`+) | Surge ATM without Mule links | `200` | ✅ PASS |
| `/api/v1/risk/top` | `POST` | Bearer Token (`SUPERVISOR`+) | Unauthenticated request | `401/403` | ✅ PASS |
| `/api/v1/risk/top` | `POST` | Bearer Token (`SUPERVISOR`+) | Rank 3-ATM cohort by A1 | `200` | ✅ PASS |
| `/api/v1/risk/atm/{atm_id}` | `GET` | Bearer Token (`ANALYST`+) | Unauthenticated request | `401/403` | ✅ PASS |
| `/api/v1/risk/atm/{atm_id}` | `GET` | Bearer Token (`ANALYST`+) | Quick baseline risk lookup | `200` | ✅ PASS |
| `/api/v1/risk/explanations/{atm_id}` | `GET` | Role: `VIEWER` (Unauthorized) | RBAC role check rejection | `403` | ✅ PASS |
| `/api/v1/risk/explanations/{atm_id}` | `GET` | Role: `ANALYST` (Authorized) | Full factor & signal breakdown | `200` | ✅ PASS |
| `/api/v1/openapi.json` | `GET` | Public | OpenAPI schema non-regression | `200` | ✅ PASS |

---

## 3. Authentication & RBAC Results

1. **Unauthenticated Rejection:** All `/api/v1/risk/*` routes strictly require valid JWT bearer tokens. Unauthenticated requests are rejected with HTTP 401/403.
2. **Role-Based Access Control:**
   - Evaluated `/api/v1/risk/explanations/{atm_id}` with `VIEWER` role $\to$ Returned `403 FORBIDDEN` (`Operation not permitted`).
   - Evaluated `/api/v1/risk/explanations/{atm_id}` with `ANALYST`, `SUPERVISOR`, `ADMIN` roles $\to$ Returned `200 OK`.

---

## 4. Request Validation Results

- Missing mandatory fields (`atm_id` or `features`) trigger FastAPI Pydantic validation returning structured `422 Unprocessable Content`.
- Negative or out-of-bound `spatial_radius_km` (e.g. $-5.0\text{ km}$) triggers `422` with parameter boundary violations.

---

## 5. Single ATM Risk Evaluation Results (`POST /evaluate`)

### Scenario A: Baseline Normal ATM (`ATM-DEL-0012`)
- **Input:** Normal 24h activity ratio ($1.0\times$), zero mule accounts, normal withdrawal volume.
- **Output:**
  - `risk_score`: $0.0500$ ($[0.0, 1.0]$ bounded)
  - `confidence`: $0.6200$
  - `mapping_confidence`: $0.9500$
  - `severity`: `LOW`
  - `alert_eligible`: `False`
  - `alert_gate.missing_evidence`: Score below threshold, primary tier inactive, secondary tier inactive.

### Scenario B: Acute Surge with Mule Account Links (`ATM-MUM-0088`)
- **Input:** $4.2\times$ activity surge, $3.5\times$ velocity acceleration, 2 connected mule accounts in 7d, late-night weekend window.
- **Output:**
  - `risk_score`: $0.6124$
  - `confidence`: $0.8420$
  - `severity`: `HIGH`
  - `alert_eligible`: `True`
  - `alert_gate.primary_tier_active`: `True`
  - `alert_gate.secondary_tier_active`: `True`
  - `alert_gate.quality_gate_passed`: `True`
  - `evidence`: `["Mule network activity: 2 flagged account(s)...", "Acute withdrawal surge: 4.2x above ATM daily baseline..."]`

---

## 6. Cohort Ranking & A1 Primary Discriminator Results (`POST /top`)

We evaluated a multi-ATM cohort containing:
1. `ATM-SURGE-02` (A1 Activity Ratio = $4.2\times$, Velocity Surge = $3.5\times$)
2. `ATM-MILD-03` (A1 Activity Ratio = $2.0\times$, Velocity Surge = $1.0\times$)
3. `ATM-BASELINE-01` (A1 Activity Ratio = $1.0\times$, Velocity Surge = $1.0\times$)

### Ranking Output:
```json
[
  {"rank": 1, "atm_id": "ATM-SURGE-02", "risk_score": 0.6124, "alert_eligible": true},
  {"rank": 2, "atm_id": "ATM-MILD-03",  "risk_score": 0.2250, "alert_eligible": false},
  {"rank": 3, "atm_id": "ATM-BASELINE-01", "risk_score": 0.0500, "alert_eligible": false}
]
```

**Verification:** Primary ranking strictly follows the **A1 Robust Z-Score** anomaly signal. The forbidden equal-weight composite is NOT used for cohort ranking.

---

## 7. Structured Explanation Results (`GET /explanations/{atm_id}`)

Endpoint returns complete mathematical factor decomposition and individual signal tier strengths:
- `signal_strengths.a1_anomaly`: Normalized excess surge ratio $[0.0, 1.0]$.
- `signal_strengths.mule_behavior`: Mule network connectivity score $[0.0, 1.0]$.
- `signal_strengths.activity_residual`: Demand forecast deviation $[0.0, 1.0]$.
- `signal_strengths.tx_velocity`: Acute burst amount ratio $[0.0, 1.0]$.
- `factor_contributions`: Numerical point contribution of each signal summing to `risk_score`.

---

## 8. Alert Gate Independence Verification

We specifically tested whether a high risk score automatically creates an alert:
- **Test Case:** An ATM with elevated activity ($3.8\times$) but **zero mule accounts** and **low historical transaction volume** ($10$ tx in 30d).
- **Result:**
  - `risk_score`: $0.2850$ (non-zero risk detected)
  - `alert_eligible`: **`False`** (Alert blocked by gate)
  - `alert_reason`: *"Alert blocked: Secondary tier inactive: Mule=0.000 (need 0.200); Quality gate: data_quality=0.285 (need 0.350)"*
- **Conclusion:** Proves that `risk_score` and `alert_eligible` are decoupled and enforced as independent quantities.

---

## 9. Critical Forecasting Capability Determination

Per the forensic audit guidelines, we explicitly determine what the API represents:

### Determination:
$$\mathbf{Option\ A:\ Genuine\ Future\ Cash\text{-}Withdrawal\ Location\ Forecast\ (with\ documented\ operational\ boundary)}$$

### Technical Justification:
1. **Target Horizon:** The prediction window explicitly specifies a future interval ($t \to t+48h$, e.g. `2023-12-01T00:00:00 to 2023-12-03T00:00:00`).
2. **Target Isolation:** The target is strictly future cashout events (`ATM_Withdrawal` with mule chain links) that have not yet occurred at cutoff $t$.
3. **Location Resolution:** The output pinpoints a specific physical ATM terminal (`atm_id` with exact lat/lon coordinates).
4. **Ranking Prioritization:** The cohort endpoint produces an ordered priority list (Top-K) answering *"WHERE is cash likely to be withdrawn next?"*.

### Documented Operational Boundary:
- The API is an **advance location forecast for history-positive ATMs** with active pre-cutoff velocity acceleration ($50\%$ Hit@10 in Group A).
- For **pure cold-start destination ATMs** with zero prior activity, the static pre-cutoff API cannot predict the destination in advance; real-time event streaming is required to trigger risk escalation upon the arrival of the first mule transaction.

---

## 10. Regression Testing Results

| Test Category | Test File | Tests Run | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| **Auth & Security** | `tests/unit/test_auth_security.py` | 2 | 2 | 0 |
| **Feature Builder & Causal Parity** | `tests/unit/test_feature_builder.py` | 3 | 3 | 0 |
| **Geospatial DBSCAN & Clusters** | `tests/unit/test_geospatial.py` | 3 | 3 | 0 |
| **Leakage & Zero Lookahead Audit** | `tests/unit/test_leakage_audit.py` | 4 | 4 | 0 |
| **Evaluation Metrics (P@K, R@K)** | `tests/unit/test_metrics_evaluation.py` | 2 | 2 | 0 |
| **Production Risk Engine (Legacy)** | `tests/unit/test_risk_engine.py` | 4 | 4 | 0 |
| **Risk Intelligence Engine (New)** | `tests/unit/test_risk_intelligence_engine.py` | 18 | 18 | 0 |
| **Legacy OpenAPI & Health Endpoints** | `tests/integration/test_api_endpoints.py` | 3 | 3 | 0 |
| **Risk Intelligence API (Integration)** | `tests/integration/test_risk_intelligence_api.py` | 15 | 15 | 0 |
| **TOTAL** | — | **54** | **54** | **0** |

---

## 11. Production Safety Verification

| Asset Checked | Verification Standard | Observed State | Result |
| :--- | :--- | :--- | :---: |
| `backend/artifacts/rf-v1.0.joblib` | Exact size 300,489 bytes | 300,489 bytes | ✅ **INTACT** |
| `backend/app/services/risk_engine.py` | Exact size 3,519 bytes | 3,519 bytes | ✅ **INTACT** |
| Database Schema (Alembic) | Zero migration modifications | Unchanged | ✅ **INTACT** |
| Existing Production Routes | `/predictions`, `/alerts`, `/complaints` | Unchanged | ✅ **INTACT** |

---

## 12. Failures, Discovered Gaps & Limitations

1. **Live Streaming Ingestion Gap:** The `/api/v1/risk/evaluate` endpoint currently receives pre-computed feature dictionaries. It requires a live streaming listener or WebSocket pump to automatically ingest real-time transaction streams from banking cores.
2. **Frontend Absence:** The backend endpoints are 100% verified and operational, but `frontend/` is currently empty. Investigators currently have no visual map or UI dashboard to interact with these APIs.

---

## 13. Recommended Next Step

Now that Task C (End-to-End API Integration Validation) is **100% complete and verified**:

### Recommended Next Task:
> **Task A: Build the Frontend Geospatial Intelligence Dashboard** in `frontend/` (Interactive Leaflet map with ATM pins and DBSCAN hotspot clusters, Priority Alert Queue, ATM Explanation Modal, and Replay Simulator visualizer).

Please review and confirm whether we should proceed with Task A.
