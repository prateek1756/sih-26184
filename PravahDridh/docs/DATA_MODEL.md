# PravahDridh — Data Model Specification

## 1. Entity Relationship Overview

```
[Complaint]
    │
    ├──< [SuspiciousTransaction] (many per complaint)
    │         │
    │         ├── [Account] (Mule / Destination Node)
    │         └── [ATMLocation] (Withdrawal Target)
    │
    └──< [RiskPrediction] (Model Output)
              │
              ├──< [Alert] (Prioritized Warnings)
              │         └── [Investigation] (Law Enforcement Case)
              │                   └──< [InvestigationNote]
              │
              └── [ModelRun] (Model Registry)

[User] (RBAC Credentials)
[AuditEvent] (Immutable SHA-256 Trail)
```

---

## 2. Table Schemas

### `users`
- `id` (UUID, PK)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `hashed_password` (VARCHAR(255), NOT NULL)
- `full_name` (VARCHAR(100), NOT NULL)
- `badge_number` (VARCHAR(50))
- `agency` (VARCHAR(100))
- `role` (VARCHAR(50), NOT NULL) — `ADMIN`, `SUPERVISOR`, `INVESTIGATOR`, `ANALYST`, `ML_ENGINEER`, `VIEWER`
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ)

### `complaints`
- `id` (UUID, PK)
- `complaint_number` (VARCHAR(50), UNIQUE, NOT NULL)
- `filed_at` (TIMESTAMPTZ, NOT NULL)
- `category` (VARCHAR(100), NOT NULL)
- `subcategory` (VARCHAR(100))
- `reported_amount` (NUMERIC(18, 2), NOT NULL)
- `victim_state` (VARCHAR(50))
- `victim_city` (VARCHAR(100))
- `status` (VARCHAR(30)) — `open`, `under_investigation`, `resolved`
- `description` (TEXT)

### `accounts`
- `id` (UUID, PK)
- `account_hash` (VARCHAR(64), UNIQUE, NOT NULL) — SHA-256 of Account/IFSC
- `bank_name` (VARCHAR(100), NOT NULL)
- `account_type` (VARCHAR(30)) — `SAVINGS`, `CURRENT`
- `risk_tier` (VARCHAR(20)) — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `is_mule_suspected` (BOOLEAN, DEFAULT FALSE)

### `atm_locations`
- `id` (UUID, PK)
- `atm_code` (VARCHAR(50), UNIQUE, NOT NULL)
- `bank_name` (VARCHAR(100), NOT NULL)
- `address` (TEXT)
- `city` (VARCHAR(100), NOT NULL)
- `district` (VARCHAR(100))
- `state` (VARCHAR(50), NOT NULL)
- `latitude` (FLOAT, NOT NULL)
- `longitude` (FLOAT, NOT NULL)
- `location` (`Geometry(POINT, 4326)`) — GIST Indexed
- `is_active` (BOOLEAN, DEFAULT TRUE)

### `suspicious_transactions`
- `id` (UUID, PK)
- `complaint_id` (UUID, FK -> complaints.id)
- `account_id` (UUID, FK -> accounts.id)
- `amount` (NUMERIC(18, 2), NOT NULL)
- `transaction_type` (VARCHAR(50)) — `IMPS`, `UPI`, `NEFT`, `ATM_WITHDRAW`
- `occurred_at` (TIMESTAMPTZ, NOT NULL)
- `latitude` (FLOAT, NOT NULL)
- `longitude` (FLOAT, NOT NULL)
- `location` (`Geometry(POINT, 4326)`) — GIST Indexed
- `velocity_score` (NUMERIC(5, 2))
- `is_flagged` (BOOLEAN, DEFAULT FALSE)
- `is_cash_out` (BOOLEAN, DEFAULT FALSE)
- `atm_id` (UUID, FK -> atm_locations.id)

### `risk_predictions`
- `id` (UUID, PK)
- `predicted_at` (TIMESTAMPTZ, NOT NULL)
- `model_version` (VARCHAR(20), NOT NULL)
- `location_id` (UUID, FK -> atm_locations.id)
- `latitude` (FLOAT, NOT NULL)
- `longitude` (FLOAT, NOT NULL)
- `risk_score` (NUMERIC(6, 4), NOT NULL)
- `severity` (VARCHAR(20), NOT NULL) — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `confidence` (NUMERIC(6, 4), NOT NULL)
- `predicted_window_start` (TIMESTAMPTZ, NOT NULL)
- `predicted_window_end` (TIMESTAMPTZ, NOT NULL)
- `risk_zone` (`Geometry(POLYGON, 4326)`) — GIST Indexed
- `reasons` (JSON)
- `model_run_id` (UUID, FK -> model_runs.id)
- `is_active` (BOOLEAN, DEFAULT TRUE)

### `alerts`
- `id` (UUID, PK)
- `prediction_id` (UUID, FK -> risk_predictions.id)
- `severity` (VARCHAR(20), NOT NULL)
- `status` (VARCHAR(20), DEFAULT 'open') — `open`, `assigned`, `investigating`, `resolved`
- `assigned_to` (UUID, FK -> users.id)
- `created_at` (TIMESTAMPTZ)
- `resolved_at` (TIMESTAMPTZ)
- `resolution_notes` (TEXT)

### `investigations`
- `id` (UUID, PK)
- `case_number` (VARCHAR(50), UNIQUE, NOT NULL)
- `title` (VARCHAR(200), NOT NULL)
- `alert_id` (UUID, FK -> alerts.id)
- `lead_investigator_id` (UUID, FK -> users.id)
- `status` (VARCHAR(30), DEFAULT 'active') — `active`, `monitoring`, `closed`
- `priority` (VARCHAR(20), DEFAULT 'MEDIUM')
- `findings` (TEXT)

### `audit_events`
- `id` (UUID, PK)
- `event_type` (VARCHAR(50), NOT NULL)
- `actor_id` (UUID, FK -> users.id)
- `actor_role` (VARCHAR(50))
- `resource_type` (VARCHAR(50))
- `resource_id` (VARCHAR(100))
- `action_details` (JSON)
- `ip_address` (VARCHAR(45))
- `occurred_at` (TIMESTAMPTZ)
- `blockchain_hash` (VARCHAR(64)) — SHA-256 state digest
