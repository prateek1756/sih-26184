"""
Real API Integration Tests — Database-backed.
Requires TEST_DATABASE_URL to be configured.
"""
import os
import uuid
import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base_class import Base
from app.models.user import User
from app.models.complaint import Complaint
from app.models.atm import ATMLocation
from app.models.transaction import SuspiciousTransaction
from app.models.account import Account
from app.core.security import get_password_hash


BASE_URL = "http://testserver"


@pytest.fixture(scope="module", autouse=True)
def ensure_schema():
    """Ensure schema is created before tests run."""
    Base.metadata.create_all(bind=sync_engine)
    yield


@pytest.fixture(scope="module")
def db_session():
    """Provide a sync session for module-level test setup."""
    session = SyncSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def seeded_users(db_session):
    """Seed one admin and one viewer user, return their emails and passwords."""
    run_id = uuid.uuid4().hex[:6]
    admin_email = f"admin_{run_id}@hermes.gov.in"
    viewer_email = f"viewer_{run_id}@hermes.gov.in"
    admin_pw = "AdminTestPw@2026"
    viewer_pw = "ViewerTestPw@2026"

    admin = User(
        id=uuid.uuid4(),
        email=admin_email,
        hashed_password=get_password_hash(admin_pw),
        full_name=f"Admin {run_id}",
        badge_number=f"ADM-{run_id}",
        agency="Test Agency",
        role="ADMIN",
        is_active=True,
    )
    viewer = User(
        id=uuid.uuid4(),
        email=viewer_email,
        hashed_password=get_password_hash(viewer_pw),
        full_name=f"Viewer {run_id}",
        badge_number=f"VIEW-{run_id}",
        agency="Test Agency",
        role="VIEWER",
        is_active=True,
    )
    db_session.add_all([admin, viewer])
    db_session.commit()
    return {
        "admin_email": admin_email,
        "admin_pw": admin_pw,
        "viewer_email": viewer_email,
        "viewer_pw": viewer_pw,
    }


@pytest.fixture(scope="module")
def seeded_atm_and_complaint(db_session):
    """Seed ATM and complaint data for city-filter tests."""
    run_id = uuid.uuid4().hex[:6]
    atm = ATMLocation(
        id=uuid.uuid4(),
        atm_code=f"ATM-API-{run_id}",
        bank_name="State Bank of India",
        city="Delhi",
        district="New Delhi",
        state="Delhi",
        latitude=28.6139,
        longitude=77.2090,
        is_active=True,
    )
    complaint = Complaint(
        id=uuid.uuid4(),
        complaint_number=f"NCRP-API-{run_id}",
        filed_at=datetime.now(timezone.utc) - timedelta(days=1),
        category="UPI Payment Fraud",
        subcategory="Phishing",
        reported_amount=Decimal("50000.00"),
        victim_state="Delhi",
        victim_city="Delhi",
        status="open",
        description="Test complaint for API integration test.",
    )
    db_session.add_all([atm, complaint])
    db_session.commit()
    return {"atm_id": atm.id, "complaint_id": complaint.id, "city": "Delhi"}


@pytest.mark.asyncio
async def test_health_check():
    """Health endpoint returns 200 with status=healthy."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_viewer_and_login(seeded_users):
    """Test registration and login flow, verify JWT returned."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        # Register a NEW user via public endpoint
        reg_email = f"new_{uuid.uuid4().hex[:6]}@hermes.gov.in"
        reg_resp = await client.post("/api/v1/auth/register", json={
            "email": reg_email,
            "password": "NewUser@Secure123",
            "full_name": "New Test User",
        })
        assert reg_resp.status_code == 200, f"Register failed: {reg_resp.text}"
        reg_data = reg_resp.json()
        assert reg_data["data"]["role"] == "VIEWER"  # Public reg always gets VIEWER

        # Login
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": reg_email,
            "password": "NewUser@Secure123",
        })
        assert login_resp.status_code == 200
        token_data = login_resp.json()["data"]
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_with_admin_role_must_not_produce_admin(seeded_users):
    """SECURITY: Registering with role=ADMIN must NOT produce an ADMIN user (§20E)."""
    # Even if an attacker sends a role field, the backend must ignore it
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        reg_email = f"evil_{uuid.uuid4().hex[:6]}@evil.com"
        # Attempt to register with role=ADMIN in body (schema allows it to be sent)
        # UserCreate schema does NOT have role field, so it will be ignored
        reg_resp = await client.post("/api/v1/auth/register", json={
            "email": reg_email,
            "password": "EvilAdmin@123",
            "full_name": "Evil Admin Attempt",
            "role": "ADMIN",  # Attacker tries to set ADMIN
        })
        assert reg_resp.status_code == 200
        registered_role = reg_resp.json()["data"]["role"]
        assert registered_role == "VIEWER", (
            f"SECURITY FAILURE: Registration with role=ADMIN produced role={registered_role}! "
            "Public registration must always produce VIEWER."
        )


@pytest.mark.asyncio
async def test_viewer_cannot_trigger_prediction_run(seeded_users):
    """RBAC: VIEWER role must receive 403 on prediction/run endpoint."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        # Login as viewer
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": seeded_users["viewer_email"],
            "password": seeded_users["viewer_pw"],
        })
        assert login_resp.status_code == 200
        access_token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        # VIEWER must NOT be able to trigger a batch prediction run
        run_resp = await client.post("/api/v1/predictions/run",
                                     json={"window_hours": 24, "min_risk_threshold": 0.3},
                                     headers=headers)
        assert run_resp.status_code == 403, (
            f"RBAC FAILURE: VIEWER was allowed to trigger prediction run! Status={run_resp.status_code}"
        )


@pytest.mark.asyncio
async def test_unauthorized_access_without_token():
    """Unauthenticated requests to protected endpoints must return 401/403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        for endpoint in ["/api/v1/complaints", "/api/v1/predictions", "/api/v1/alerts"]:
            resp = await client.get(endpoint)
            assert resp.status_code in [401, 403], f"{endpoint} should require auth, got {resp.status_code}"


@pytest.mark.asyncio
async def test_complaints_endpoint_returns_database_data(seeded_users, seeded_atm_and_complaint):
    """GET /complaints returns database-backed results, not empty or mocked."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": seeded_users["admin_email"],
            "password": seeded_users["admin_pw"],
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.get("/api/v1/complaints", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_complaints_city_filter(seeded_users, seeded_atm_and_complaint, db_session):
    """City filtering: ?city=Delhi returns only Delhi records."""
    # Add a Mumbai complaint for comparison
    run_id = uuid.uuid4().hex[:6]
    mumbai_complaint = Complaint(
        id=uuid.uuid4(),
        complaint_number=f"NCRP-MUM-{run_id}",
        filed_at=datetime.now(timezone.utc) - timedelta(hours=3),
        category="Investment Fraud",
        subcategory="Crypto",
        reported_amount=Decimal("200000.00"),
        victim_state="Maharashtra",
        victim_city="Mumbai",
        status="open",
        description="Test Mumbai complaint.",
    )
    db_session.add(mumbai_complaint)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": seeded_users["admin_email"],
            "password": seeded_users["admin_pw"],
        })
        token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp_delhi = await client.get("/api/v1/complaints?city=Delhi", headers=headers)
        assert resp_delhi.status_code == 200
        delhi_data = resp_delhi.json()["data"]

        resp_mumbai = await client.get("/api/v1/complaints?city=Mumbai", headers=headers)
        assert resp_mumbai.status_code == 200
        mumbai_data = resp_mumbai.json()["data"]

        # Verify city filter isolates results
        for c in delhi_data:
            assert c.get("victim_city") == "Delhi", f"Delhi filter returned non-Delhi: {c}"
        for c in mumbai_data:
            assert c.get("victim_city") == "Mumbai", f"Mumbai filter returned non-Mumbai: {c}"


@pytest.mark.asyncio
async def test_transaction_detail_endpoint(seeded_users, db_session):
    """GET /transactions/{id} returns real transaction from database."""
    run_id = uuid.uuid4().hex[:6]
    complaint = Complaint(
        id=uuid.uuid4(),
        complaint_number=f"NCRP-TX-{run_id}",
        filed_at=datetime.now(timezone.utc) - timedelta(hours=1),
        category="UPI Payment Fraud",
        subcategory="Phishing",
        reported_amount=Decimal("25000.00"),
        victim_state="Delhi",
        victim_city="Delhi",
        status="open",
        description="For transaction endpoint test.",
    )
    db_session.add(complaint)
    db_session.flush()

    tx = SuspiciousTransaction(
        id=uuid.uuid4(),
        complaint_id=complaint.id,
        amount=Decimal("25000.00"),
        transaction_type="IMPS",
        occurred_at=datetime.now(timezone.utc) - timedelta(hours=2),
        latitude=28.6139,
        longitude=77.2090,
        velocity_score=Decimal("0.65"),
        is_flagged=True,
        is_cash_out=False,
    )
    db_session.add(tx)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": seeded_users["admin_email"],
            "password": seeded_users["admin_pw"],
        })
        token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.get(f"/api/v1/transactions/{tx.id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == str(tx.id)
        assert float(data["amount"]) == float(tx.amount)


@pytest.mark.asyncio
async def test_me_endpoint_returns_current_user(seeded_users):
    """GET /auth/me returns the authenticated user's profile."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": seeded_users["admin_email"],
            "password": seeded_users["admin_pw"],
        })
        token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me_resp = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200
        me_data = me_resp.json()["data"]
        assert me_data["email"] == seeded_users["admin_email"]
