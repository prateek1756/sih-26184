from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "HERMES" in data["project"]


def test_unauthorized_access_to_protected_endpoint():
    response = client.get("/api/v1/complaints")
    assert response.status_code in [401, 403]


def test_openapi_spec_has_all_core_routes():
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    paths = spec["paths"]
    
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/auth/register" in paths
    assert "/api/v1/complaints" in paths
    assert "/api/v1/predictions" in paths
    assert "/api/v1/predictions/hotspots" in paths
    assert "/api/v1/predictions/top-k" in paths
    assert "/api/v1/alerts" in paths
    assert "/api/v1/alerts/{alert_id}/acknowledge" in paths
    assert "/api/v1/investigations" in paths
    assert "/api/v1/audit/events" in paths
    assert "/api/v1/models" in paths
