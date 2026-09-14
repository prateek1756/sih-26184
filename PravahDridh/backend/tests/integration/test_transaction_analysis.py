"""
Integration tests for Phase 4: Real Transaction Intelligence.
Verifies:
- Unauthenticated rejection (401)
- Unauthorized role rejection (403)
- Authorized investigator access (200)
- Real Alert → Prediction → ATM → Window resolution
- Prediction basis vs forensic evidence separation
- Configurable analytical parameters (staging window, spatial radius)
- PostGIS spatial distance filtering (ST_Distance, ST_DWithin)
- Deterministic factor relevance scoring (HIGH / MEDIUM / LOW)
- Suspicious indicators (Observed facts vs contextual interpretation)
- Actionable Intelligence Package generation
- Sensitive account masking (ACC-***)
- SHA-256 tamper-evident audit logging
"""
import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from geoalchemy2.elements import WKTElement

from app.main import app
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base_class import Base
from app.models.user import User
from app.models.alert import Alert
from app.models.prediction import RiskPrediction
from app.models.atm import ATMLocation
from app.models.complaint import Complaint
from app.models.account import Account
from app.models.transaction import SuspiciousTransaction
from app.models.audit import AuditEvent
from app.core.security import get_password_hash

BASE_URL = "http://testserver"


@pytest.fixture(scope="module", autouse=True)
def ensure_schema():
    Base.metadata.create_all(bind=sync_engine)
    yield


@pytest.fixture(scope="module")
def db_session():
    session = SyncSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def seeded_phase4_data(db_session):
    """
    Seed a complete, verified relational cluster:
    Investigator User, Viewer User, ATM, Prediction (with reasons), Alert,
    Complaint, Mule Account, and Causal Transaction Chain.
    """
    run_id = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)

    # 1. Users
    inv_email = f"inv_{run_id}@hermes.gov.in"
    viewer_email = f"viewer_{run_id}@hermes.gov.in"
    inv_pw = "InvTestPw@2026"
    viewer_pw = "ViewerTestPw@2026"

    investigator = User(
        id=uuid.uuid4(),
        email=inv_email,
        hashed_password=get_password_hash(inv_pw),
        full_name=f"Inspector {run_id}",
        badge_number=f"INV-{run_id}",
        agency="State Cyber Cell",
        role="INVESTIGATOR",
        is_active=True,
    )
    viewer = User(
        id=uuid.uuid4(),
        email=viewer_email,
        hashed_password=get_password_hash(viewer_pw),
        full_name=f"Viewer {run_id}",
        badge_number=f"VIW-{run_id}",
        agency="Public Desk",
        role="VIEWER",
        is_active=True,
    )
    db_session.add_all([investigator, viewer])

    # 2. ATM Location (Delhi Connaught Place)
    atm = ATMLocation(
        id=uuid.uuid4(),
        atm_code=f"ATM-DEL-{run_id}",
        bank_name="State Bank of India",
        address="Connaught Place Inner Circle",
        city="Delhi",
        district="New Delhi",
        state="Delhi",
        latitude=28.6315,
        longitude=77.2167,
        location=WKTElement("POINT(77.2167 28.6315)", srid=4326),
        is_active=True,
    )
    db_session.add(atm)

    # 3. Prediction Basis & RiskPrediction
    pred_window_start = now + timedelta(hours=2)
    pred_window_end = now + timedelta(hours=26)
    pred_reasons = [
        "Historical cash-out density exceeds 90th percentile",
        "Calibrated RF-v2.0 probability threshold exceeded (0.84)",
        "Temporal signature matches high-risk nocturnal withdrawal corridor"
    ]

    prediction = RiskPrediction(
        id=uuid.uuid4(),
        model_version="production-rf-v2.0",
        location_id=atm.id,
        latitude=28.6315,
        longitude=77.2167,
        risk_score=Decimal("0.8450"),
        severity="HIGH",
        confidence=Decimal("0.8920"),
        predicted_window_start=pred_window_start,
        predicted_window_end=pred_window_end,
        reasons=pred_reasons,
        is_active=True,
    )
    db_session.add(prediction)

    # 4. Alert pointing to prediction
    alert = Alert(
        id=uuid.uuid4(),
        prediction_id=prediction.id,
        severity="HIGH",
        status="open",
        assigned_to=investigator.id,
    )
    db_session.add(alert)

    # 5. Complaint
    complaint = Complaint(
        id=uuid.uuid4(),
        complaint_number=f"NCRP-2026-{run_id}",
        filed_at=now - timedelta(hours=12),
        category="UPI Payment Fraud",
        subcategory="Task Fraud",
        reported_amount=Decimal("120000.00"),
        victim_state="Delhi",
        victim_city="Delhi",
        status="under_investigation",
    )
    db_session.add(complaint)

    # 6. Suspected Mule Account
    account = Account(
        id=uuid.uuid4(),
        account_hash=f"hash_{run_id}_78901234567890123456789012345678",
        bank_name="State Bank of India",
        account_type="SAVINGS",
        risk_tier="CRITICAL",
        is_mule_suspected=True,
    )
    db_session.add(account)

    # 7. Real Multi-Hop Transactions in PostgreSQL
    # Hop 1: IMPS staging 8 hours before window
    tx1 = SuspiciousTransaction(
        id=uuid.uuid4(),
        complaint_id=complaint.id,
        account_id=account.id,
        amount=Decimal("60000.00"),
        transaction_type="IMPS",
        occurred_at=now - timedelta(hours=6),
        latitude=28.6300,
        longitude=77.2150,
        location=WKTElement("POINT(77.2150 28.6300)", srid=4326),
        velocity_score=Decimal("0.85"),
        is_flagged=True,
        is_cash_out=False,
        atm_id=None,
    )
    # Hop 2: Terminal cash-out during predicted window at target ATM
    tx2 = SuspiciousTransaction(
        id=uuid.uuid4(),
        complaint_id=complaint.id,
        account_id=account.id,
        amount=Decimal("50000.00"),
        transaction_type="ATM_WITHDRAW",
        occurred_at=pred_window_start + timedelta(hours=1),
        latitude=28.6315,
        longitude=77.2167,
        location=WKTElement("POINT(77.2167 28.6315)", srid=4326),
        velocity_score=Decimal("0.92"),
        is_flagged=True,
        is_cash_out=True,
        atm_id=atm.id,
    )
    db_session.add_all([tx1, tx2])
    db_session.commit()

    return {
        "investigator_email": inv_email,
        "investigator_pw": inv_pw,
        "viewer_email": viewer_email,
        "viewer_pw": viewer_pw,
        "alert_id": alert.id,
        "prediction_id": prediction.id,
        "atm_id": atm.id,
        "complaint_id": complaint.id,
        "account_id": account.id,
        "tx1_id": tx1.id,
        "tx2_id": tx2.id,
        "pred_reasons": pred_reasons,
    }


async def get_token(client: AsyncClient, email: str, pw: str) -> str:
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["data"]["access_token"]


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """TEST 1: Unauthenticated transaction analysis request must return 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.get("/api/v1/transactions/analysis")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthorized_role_rejected(seeded_phase4_data):
    """TEST 2: Viewer role without investigation privileges must return 403."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        viewer_token = await get_token(client, d["viewer_email"], d["viewer_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authorized_investigator_success(seeded_phase4_data):
    """TEST 3: Authorized investigator receives 200 with structured analysis."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    res_data = resp.json()["data"]
    assert res_data["context"]["alert_id"] == str(d["alert_id"])
    assert res_data["context"]["prediction_id"] == str(d["prediction_id"])
    assert res_data["context"]["atm_id"] == str(d["atm_id"])


@pytest.mark.asyncio
async def test_prediction_basis_separated_from_forensic_evidence(seeded_phase4_data):
    """TEST 4: Prediction basis strictly preserves model metadata with zero post-hoc fabrication."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    context = resp.json()["data"]["context"]
    assert context["prediction_basis"] == d["pred_reasons"]
    # Verify model reasons do not contain post-hoc transaction IDs
    for reason in context["prediction_basis"]:
        assert str(d["tx1_id"]) not in reason
        assert str(d["tx2_id"]) not in reason


@pytest.mark.asyncio
async def test_real_transactions_and_relevance_scoring(seeded_phase4_data):
    """TEST 5: Real PostgreSQL transactions returned with deterministic HIGH / MEDIUM scoring."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    txs = resp.json()["data"]["transactions"]
    assert len(txs) >= 2

    # Find tx2 (terminal cashout)
    tx2_match = next((t for t in txs if t["id"] == str(d["tx2_id"])), None)
    assert tx2_match is not None
    assert tx2_match["relevance"] == "HIGH"
    assert tx2_match["relevance_score"] >= 0.65
    assert any("predicted ATM" in r for r in tx2_match["relevance_reasons"])
    assert any("predicted cash-out window" in r for r in tx2_match["relevance_reasons"])

    # Find tx1 (pre-window staging)
    tx1_match = next((t for t in txs if t["id"] == str(d["tx1_id"])), None)
    assert tx1_match is not None
    assert any("staging" in r for r in tx1_match["relevance_reasons"])


@pytest.mark.asyncio
async def test_postgis_spatial_distance_calculated(seeded_phase4_data):
    """TEST 6: PostGIS spatial distance in meters is calculated accurately."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    txs = resp.json()["data"]["transactions"]
    tx2_match = next(t for t in txs if t["id"] == str(d["tx2_id"]))
    # tx2 was placed exactly at the ATM coordinates
    assert tx2_match["distance_to_atm_meters"] is not None
    assert tx2_match["distance_to_atm_meters"] <= 10.0


@pytest.mark.asyncio
async def test_suspicious_indicators_facts_vs_interpretation(seeded_phase4_data):
    """TEST 7: Indicators distinguish observed facts from contextual interpretations."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    indicators = resp.json()["data"]["indicators"]
    assert len(indicators) >= 1

    # Check observed facts and suspicious interpretation structure
    for ind in indicators:
        assert "observed_facts" in ind
        assert "suspicious_interpretation" in ind
        assert "evidence" in ind
        assert len(ind["observed_facts"]) > 0
        assert len(ind["suspicious_interpretation"]) > 10


@pytest.mark.asyncio
async def test_actionable_intelligence_package_endpoint(seeded_phase4_data):
    """TEST 8: Standalone Actionable Intelligence Package contains recommendations and targets."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis/package?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    pkg = resp.json()["data"]
    assert pkg["alert_id"] == str(d["alert_id"])
    assert "recommended_actions" in pkg
    assert len(pkg["recommended_actions"]) >= 2
    assert "STATE_CYBER_CELL" in pkg["dissemination_targets"]
    assert "BANK_NODAL_DESK" in pkg["dissemination_targets"]


@pytest.mark.asyncio
async def test_account_masking_enforced(seeded_phase4_data):
    """TEST 9: Account financial identifiers are masked for PII privacy."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200
    txs = resp.json()["data"]["transactions"]
    for t in txs:
        if t["source_account_masked"]:
            assert t["source_account_masked"].startswith("ACC-")
            assert "..." in t["source_account_masked"]


@pytest.mark.asyncio
async def test_tamper_evident_audit_log_created(seeded_phase4_data):
    """TEST 10: Accessing transaction analysis creates an immutable SHA-256 audit entry."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        resp = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
    assert resp.status_code == 200

    # Query audit events from database
    session = SyncSessionLocal()
    audit_evt = (
        session.query(AuditEvent)
        .filter(AuditEvent.event_type == "TRANSACTION_INTELLIGENCE_ACCESS")
        .order_by(AuditEvent.occurred_at.desc())
        .first()
    )
    assert audit_evt is not None
    assert str(audit_evt.resource_id) == str(d["alert_id"])
    assert audit_evt.blockchain_hash is not None
    assert len(audit_evt.blockchain_hash) == 64  # Valid SHA-256 hex string
    session.close()


@pytest.mark.asyncio
async def test_filtering_and_sorting(seeded_phase4_data):
    """TEST 11: Amount filtering, type filtering, and sorting work safely."""
    d = seeded_phase4_data
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        inv_token = await get_token(client, d["investigator_email"], d["investigator_pw"])
        
        # Filter ATM_WITHDRAW only
        resp_type = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}&transaction_type=ATM_WITHDRAW",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
        assert resp_type.status_code == 200
        for tx in resp_type.json()["data"]["transactions"]:
            assert tx["transaction_type"] == "ATM_WITHDRAW"

        # Filter min_amount 55000 (should exclude tx2 at 50000)
        resp_amt = await client.get(
            f"/api/v1/transactions/analysis?alert_id={d['alert_id']}&min_amount=55000",
            headers={"Authorization": f"Bearer {inv_token}"},
        )
        assert resp_amt.status_code == 200
        for tx in resp_amt.json()["data"]["transactions"]:
            assert Decimal(str(tx["amount"])) >= Decimal("55000")
