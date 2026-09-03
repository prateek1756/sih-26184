# RISK ENGINE PRODUCTION CANDIDATE
## SIH PS 26184 — Approved Architecture, Alert Gate, Limitations, and Promotion Checklist

**Document Date:** 2026-09-03  
**Engine Version:** `rie-candidate-v0.1`  
**Status:** PRE-PRODUCTION CANDIDATE — Hardening complete. Requires explicit production promotion approval.

---

## 1. Approved Signal Architecture & Hierarchy

The following signal hierarchy is **frozen** in [`experiments/risk_intelligence_engine/config.json`](file:///c:/Users/Prateek/Desktop/sih/sih-26184/backend/experiments/risk_intelligence_engine/config.json):

| Tier | Signal | Role | Experimental Weight |
|:--|:--|:--|:--:|
| **PRIMARY** | A1 Robust Z-Score Anomaly | Primary ATM ranking discriminator | 0.40 |
| **SECONDARY** | Account / Mule Behavior | Corroborating intelligence | 0.25 |
| **SUPPORTING** | Activity Forecast Residual | Demand normalization | 0.15 |
| **SUPPORTING** | Transaction Velocity | Acute burst amplifier | 0.10 |
| **CONTEXTUAL** | Graph Proximity & 2-Hop Metro | Evidence context only | 0.05 |
| **CONTEXTUAL** | Spatial Cluster Density | Evidence context only | 0.025 |
| **CONTEXTUAL** | Temporal Window (Late Night/Wknd) | Evidence context only | 0.025 |
| **RESERVED** | Complaint Intelligence | Future integration only | 0.00 |

> [!IMPORTANT]
> **The full equal-weight composite MUST NOT be used as the primary ATM ranking classifier.**
> It underperforms standalone A1 on per-cutoff Top-10 ranking (6.67% vs 20.00%).
> The composite score is reserved for alert evidence and audit explainability only.

> [!IMPORTANT]
> All weights are **experimental, heuristic defaults** — they are NOT calibrated from data.

---

## 2. Risk Score vs. Alert Distinction

A **`risk_score`** and an **`alert_eligible`** decision are computed and stored as **separate quantities**:

```
risk_score  ─────────────────────────────────────►  [0.0, 1.0]  Continuous risk indicator
                                                                 (audit, monitoring, dashboard)
alert_eligible  ─────────────────────────────────►  True/False  Operational alert decision
                                                                 (requires corroborating evidence)
```

A high `risk_score` **NEVER automatically produces an alert.**

---

## 3. Alert Gate Design & Logic

The **Evidence-Aware Alert Gate** ([`alert_gate.py`](file:///c:/Users/Prateek/Desktop/sih/sih-26184/backend/experiments/risk_intelligence_engine/alert_gate.py)) requires:

```
REQUIRED:
  risk_score >= 0.30  (minimum score gate)
  AND
  Primary tier active:
    A1 anomaly signal >= 0.25  OR  Activity residual >= 0.30

CORROBORATING:
  Secondary tier active:
    Mule/account signal >= 0.20  OR  Velocity signal >= 0.25

QUALITY:
  confidence >= 0.40  AND  data_quality >= 0.35
```

All 4 conditions must be satisfied simultaneously for `alert_eligible = True`.

### Alert Gate Response Fields

Every evaluation produces:

| Field | Type | Meaning |
|:--|:--|:--|
| `risk_score` | float [0,1] | Composite indicator |
| `confidence` | float [0,1] | Data volume + freshness + signal agreement |
| `mapping_confidence` | float [0,1] | Spatial proximity decay |
| `alert_eligible` | bool | Evidence-aware alert decision |
| `alert_reason` | str | Human-readable audit string |
| `required_evidence` | list[str] | What the gate requires |
| `missing_evidence` | list[str] | What was absent or below threshold |
| `primary_tier_active` | bool | A1/Activity tier status |
| `secondary_tier_active` | bool | Mule/Velocity tier status |
| `quality_gate_passed` | bool | Confidence + data quality status |
| `data_quality` | float [0,1] | Data volume × mapping quality |

---

## 4. Severity Thresholds & Operational Definitions

| Severity | Threshold | Operational Action |
|:--|:--:|:--|
| `LOW` | < 0.30 | Normal background; passive monitoring |
| `MEDIUM` | ≥ 0.30 | Minor anomaly; passive monitoring, no immediate action |
| `HIGH` | ≥ 0.55 | Elevated multi-signal convergence; queue for investigator review |
| `CRITICAL` | ≥ 0.75 | **Investigator review required — NOT autonomous field intervention** |

> [!CAUTION]
> **`CRITICAL` does NOT mean automatic intervention.**
> It means a human investigator must review the evidence before any field action.
> No system should autonomously dispatch personnel based solely on severity classification.

Thresholds are **operational defaults, not calibrated.** They must be re-evaluated empirically before field deployment.

---

## 5. Backend API Interface

New routes registered under `/api/v1/risk/` using existing auth/RBAC/`StandardResponse` patterns:

| Method | Endpoint | Auth | Description |
|:--|:--|:--|:--|
| `POST` | `/api/v1/risk/evaluate` | `Bearer` | Evaluate single ATM with full evidence gate |
| `POST` | `/api/v1/risk/top` | `Bearer` | Rank ATM cohort by A1 primary signal |
| `GET` | `/api/v1/risk/atm/{atm_id}` | `Bearer` | Quick ATM risk lookup (demo features) |
| `GET` | `/api/v1/risk/explanations/{atm_id}` | `ANALYST`/`SUPERVISOR`/`ADMIN` | Full structured explanation |

**Existing endpoints are completely unchanged:**

| Unchanged Route | Status |
|:--|:--|
| `/api/v1/predictions/*` | ✅ Untouched |
| `/api/v1/alerts/*` | ✅ Untouched |
| `/api/v1/auth/*` | ✅ Untouched |
| `/api/v1/complaints/*` | ✅ Untouched |
| `/api/v1/investigations/*` | ✅ Untouched |

---

## 6. Known Limitations

### Cold-Start ATM Problem (Critical Limitation)
- **12 of 16 verified cashout events (75%) occur at ATMs with no pre-cutoff suspicious activity.**
- Pre-cutoff spatial propagation achieves **0% recovery on cold-start destinations** in Top-10.
- The Risk Intelligence Engine shares this limitation — it cannot predict unknown destination ATMs before any mule activity appears at that terminal.
- **Implication:** The engine is effective for history-positive ATM monitoring and real-time escalation; it is not a cold-start destination predictor.

### Score Calibration
- All experimental weights and severity thresholds are heuristic defaults, not statistically calibrated.
- Alert gate thresholds were chosen to prevent alert explosion at baseline, not optimized for recall.
- Before field deployment, a calibration study on labeled operational data is required.

### Feature Dependency
- Live inference requires pre-computed feature vectors per ATM per evaluation.
- The current `/api/v1/risk/atm/{atm_id}` GET endpoint uses synthetic default features as a placeholder.
- Production integration requires a live feature pipeline feeding real-time ATM metrics.

### Data Freshness
- Confidence scores depend on `base_tx_count_30d` and `hours_since_last_fraud`.
- ATMs with fewer than 50 trailing transactions receive reduced confidence.

---

## 7. Test Results

All 22 unit tests pass. No regressions in existing production tests.

| Test Suite | Tests | Passed | Failed |
|:--|:--:|:--:|:--:|
| `test_risk_intelligence_engine.py` | 18 | **18** | 0 |
| `test_risk_engine.py` (production, unchanged) | 4 | **4** | 0 |
| **TOTAL** | **22** | **22** | **0** |

### Verified Governance Properties

| Property | Result |
|:--|:--:|
| `rf-v1.0.joblib` (300,489 bytes) is unchanged | ✅ |
| Existing APIs remain functional | ✅ |
| Existing database schema unchanged | ✅ |
| Risk scores bounded $[0.0, 1.0]$ | ✅ |
| Risk calculation is deterministic | ✅ |
| Replay is strictly event-time causal | ✅ |
| Alert gate blocks without corroborating evidence | ✅ |
| Baseline cohort produces 0% alert rate | ✅ |
| Evidence strings match contributing signals | ✅ |
| `CRITICAL` never fires on low-risk baseline | ✅ |

---

## 8. Components Approved / Not Approved for Promotion

### ✅ Approved (pre-production candidate, validated offline)

| Component | Location | Purpose |
|:--|:--|:--|
| `engine.py` | `experiments/risk_intelligence_engine/` | Core scoring |
| `alert_gate.py` | `experiments/risk_intelligence_engine/` | Evidence gate |
| `config.json` | `experiments/risk_intelligence_engine/` | Frozen architecture |
| `risk_intelligence_service.py` | `app/services/` | Backend service interface |
| `risk_intelligence.py` (schemas) | `app/schemas/` | Pydantic response models |
| `risk_intelligence.py` (endpoints) | `app/api/v1/endpoints/` | FastAPI routes |

### ❌ NOT Yet Approved / Promoted

| Item | Reason |
|:--|:--|
| Production deployment | Requires explicit sign-off after field calibration study |
| Alert auto-dispatch | Must remain human-reviewed — never automated |
| Live feature pipeline | Not yet implemented |
| Threshold calibration | Requires labeled operational data |
| `rf-v1.0.joblib` replacement | Not approved — existing model untouched |

---

## 9. What Remains Before Production Promotion

1. **Live Feature Pipeline:** Build a real-time ATM feature computation service feeding `activity_ratio_24h`, `velocity_surge_24h_vs_7d`, `connected_mule_accounts_7d`, etc. from live transaction streams.
2. **Threshold Calibration Study:** Calibrate alert gate thresholds against labeled operational incident data to reduce false-positive rate and maximize investigator efficiency.
3. **Integration Tests:** End-to-end integration test with a running FastAPI instance verifying the new `/api/v1/risk/*` routes return correctly structured responses.
4. **Staging Deployment:** Deploy to a staging environment and have investigators review alert outputs before production go-live.
5. **Production Go-Live Review:** Obtain explicit sign-off from SIH PS 26184 technical committee.

---

## 10. Production Safety Status

| Production Asset | Integrity Status |
|:--|:--|
| `backend/artifacts/rf-v1.0.joblib` (300,489 bytes) | ✅ **UNTOUCHED** |
| `backend/app/services/risk_engine.py` | ✅ **UNTOUCHED** |
| `backend/app/api/v1/endpoints/predictions.py` | ✅ **UNTOUCHED** |
| `backend/app/api/v1/endpoints/alerts.py` | ✅ **UNTOUCHED** |
| `backend/alembic/` (database schema) | ✅ **UNTOUCHED** |
| All existing `/api/v1/*` routes | ✅ **UNTOUCHED** |
