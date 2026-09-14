import pytest
from app.services.geospatial_service import GeospatialService


def test_haversine_distance():
    # Delhi to Mumbai distance approx ~1150km
    dist = GeospatialService.haversine_distance_km(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1100 <= dist <= 1200


def test_dbscan_clustering():
    # 3 points close to each other in CP Delhi + 1 in Mumbai
    coords = [
        (28.6315, 77.2167),
        (28.6320, 77.2170),
        (28.6310, 77.2160),
        (19.0760, 72.8777),
    ]
    labels = GeospatialService.cluster_locations_dbscan(coords, eps_km=1.0, min_samples=3)
    assert len(labels) == 4
    assert labels[0] == labels[1] == labels[2] == 0
    assert labels[3] == -1


def test_risk_polygon_geojson_generation():
    poly = GeospatialService.create_risk_polygon(28.6139, 77.2090, radius_meters=500.0)
    assert poly["type"] == "Polygon"
    assert len(poly["coordinates"]) == 1
    assert len(poly["coordinates"][0]) >= 20
    assert poly["coordinates"][0][0] == poly["coordinates"][0][-1]
