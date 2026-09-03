# HERMES AI — API Contract Specification

**Base URL**: `/api/v1`  
**Standard Response Structure**:
```json
{
  "status": "success" | "error",
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  },
  "error": null | {
    "code": "ERROR_CODE",
    "message": "Human readable description",
    "details": null
  }
}
```

---

## 1. Authentication Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user (strictly assigns `VIEWER` role) | Public |
| `POST` | `/api/v1/auth/login` | Authenticate with email/password, returns JWT tokens | Public |
| `POST` | `/api/v1/auth/refresh` | Refresh access token using valid refresh token | Public |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile and roles | Authenticated |

---

## 2. Cybercrime Complaints Endpoints

| Method | Endpoint | Query Params | Description | Access |
|---|---|---|---|---|
| `GET` | `/api/v1/complaints` | `page`, `per_page`, `category`, `status`, `city` | List complaints with pagination | Authenticated |
| `POST` | `/api/v1/complaints` | - | Ingest cybercrime complaint report | `ANALYST+` |
| `GET` | `/api/v1/complaints/{id}` | - | Fetch single complaint detail | Authenticated |
| `PATCH` | `/api/v1/complaints/{id}` | - | Update complaint status or description | `ANALYST+` |

---

## 3. Predictions & Risk Intelligence Endpoints

| Method | Endpoint | Query Params | Description | Access |
|---|---|---|---|---|
| `GET` | `/api/v1/predictions` | `page`, `per_page`, `severity`, `city` | List scored candidate ATM predictions | Authenticated |
| `GET` | `/api/v1/predictions/{id}`| - | Fetch prediction detail with reasons | Authenticated |
| `POST` | `/api/v1/predictions/run` | Request body: `{ window_hours, min_risk_threshold, model_version }` | Trigger batch inference pipeline across candidate ATMs | `ML_ENGINEER+` |
| `GET` | `/api/v1/predictions/hotspots` | `city` | Fetch GeoJSON FeatureCollection of high-risk polygon zones | Authenticated |
| `GET` | `/api/v1/predictions/top-k` | `k`, `city` | Fetch Top-K highest priority ATM targets | Authenticated |

---

## 4. Alerts & Intervention Endpoints

| Method | Endpoint | Query Params | Description | Access |
|---|---|---|---|---|
| `GET` | `/api/v1/alerts` | `page`, `per_page`, `status`, `severity` | List prioritized active warnings | Authenticated |
| `GET` | `/api/v1/alerts/{id}` | - | Fetch alert details with linked prediction | Authenticated |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | - | Investigator acknowledges alert | `INVESTIGATOR+` |
| `PATCH` | `/api/v1/alerts/{id}/assign` | Request body: `{ assigned_to }` | Assign alert to field investigator | `SUPERVISOR+` |
| `PATCH` | `/api/v1/alerts/{id}/resolve` | Request body: `{ status, resolution_notes }` | Resolve or flag alert as false positive | `INVESTIGATOR+` |

---

## 5. Case Investigation Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/investigations` | List investigation cases with filters | Authenticated |
| `POST` | `/api/v1/investigations` | Create new investigation case from alert | `INVESTIGATOR+` |
| `GET` | `/api/v1/investigations/{id}` | Fetch investigation detail with notes history | Authenticated |
| `PATCH` | `/api/v1/investigations/{id}` | Update status (`active`, `monitoring`, `closed`), priority, findings | `INVESTIGATOR+` |
| `POST` | `/api/v1/investigations/{id}/notes` | Add case progress note | `INVESTIGATOR+` |

---

## 6. Geospatial & Map Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/geo/atms` | ATM GeoJSON Point FeatureCollection (filterable by city/state) | Authenticated |
| `GET` | `/api/v1/geo/clusters` | DBSCAN spatial cluster coordinates over recent incident events | Authenticated |

---

## 7. Model Registry & Audit Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/models` | List all trained model runs and evaluation metrics | Authenticated |
| `GET` | `/api/v1/models/{id}` | Fetch detailed metrics (`PR-AUC`, `Precision@K`, `ROC-AUC`) | Authenticated |
| `POST` | `/api/v1/models/{id}/promote` | Promote a model run to active production status | `ML_ENGINEER+` |
| `GET` | `/api/v1/audit/events` | Query tamper-evident audit trail with SHA-256 hashes | `SUPERVISOR+` |
| `GET` | `/api/v1/audit/events/{id}` | Get single audit event with cryptographic digest | `SUPERVISOR+` |
