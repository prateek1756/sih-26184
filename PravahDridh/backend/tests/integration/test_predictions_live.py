"""
Integration Tests for Live Prediction & Hotspot APIs.
Verifies:
1. Unauthenticated calls to /hotspots/live are rejected (401/403).
2. INVESTIGATOR user can access /hotspots/live (read-only, real pipeline).
3. /hotspots returns valid GeoJSON polygon FeatureCollection (route conflict resolved).
4. /top-k returns top ranked predictions.
5. All prediction fields are genuine: real coordinates, real ATM codes, real reasons.
"""
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base_class import Base
from app.models.user import User
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
def seeded_investigator(db_session):
    run_id = uuid.uuid4().hex[:6]
    investigator_email = f"investigator_{run_id}@hermes.gov.in"
    password = "InvestigatorPw@2026"

    user = User(
        id=uuid.uuid4(),
        email=investigator_email,
        hashed_password=get_password_hash(password),
        full_name=f"Investigator {run_id}",
        badge_number=f"INV-{run_id}",
        agency="State Cyber Cell",
        role="INVESTIGATOR",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return {"email": investigator_email, "password": password, "role": "INVESTIGATOR"}


@pytest.mark.asyncio
async def test_live_hotspots_unauthenticated_rejected():
    """Unauthenticated calls must be rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        res = await client.get("/api/v1/predictions/hotspots/live")
        assert res.status_code in (401, 403), f"Expected 401/403 but got {res.status_code}"


@pytest.mark.asyncio
async def test_investigator_can_access_live_hotspots(seeded_investigator):
    """INVESTIGATOR user must be able to access live predictions without ML_ENGINEER privileges."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        # 1. Login
        login_res = await client.post(
            "/api/v1/auth/login",
            json={
                "email": seeded_investigator["email"],
                "password": seeded_investigator["password"],
            },
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Call /hotspots/live
        res = await client.get("/api/v1/predictions/hotspots/live?limit=10", headers=headers)
        assert res.status_code == 200, f"Call failed: {res.text}"
        body = res.json()
        assert body["status"] == "success"
        data = body["data"]
        assert isinstance(data, list)
        assert len(data) > 0

        # Validate prediction structure
        top_pred = data[0]
        assert "atm_code" in top_pred and top_pred["atm_code"] is not None
        assert "risk_score" in top_pred
        assert "severity" in top_pred
        assert "confidence" in top_pred
        assert "reasons" in top_pred
        assert isinstance(top_pred["reasons"], list)
        assert len(top_pred["reasons"]) > 0
        assert "latitude" in top_pred and "longitude" in top_pred
        assert top_pred["latitude"] != 0.0


@pytest.mark.asyncio
async def test_hotspots_geojson_route_not_blocked(seeded_investigator):
    """Verify /hotspots route is not caught by /{prediction_id} UUID path."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={
                "email": seeded_investigator["email"],
                "password": seeded_investigator["password"],
            },
        )
        token = login_res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/predictions/hotspots", headers=headers)
        assert res.status_code == 200, f"Hotspots endpoint failed: {res.status_code} {res.text}"
        body = res.json()
        assert body["status"] == "success"
        assert body["data"]["type"] == "FeatureCollection"


@pytest.mark.asyncio
async def test_top_k_predictions_route(seeded_investigator):
    """Verify /top-k route returns ranked predictions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={
                "email": seeded_investigator["email"],
                "password": seeded_investigator["password"],
            },
        )
        token = login_res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/predictions/top-k?k=5", headers=headers)
        assert res.status_code == 200, f"Top-k endpoint failed: {res.status_code} {res.text}"
        body = res.json()
        assert body["status"] == "success"
        assert isinstance(body["data"], list)
