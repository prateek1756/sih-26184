import math
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.cluster import DBSCAN
from shapely.geometry import Point, mapping


class GeospatialService:
    @staticmethod
    def cluster_locations_dbscan(
        coords: List[Tuple[float, float]],
        eps_km: float = 1.0,
        min_samples: int = 3,
    ) -> List[int]:
        """
        DBSCAN clustering using Haversine metric on (latitude, longitude).
        eps_km: radius in kilometers (1.0km default)
        """
        if not coords or len(coords) < min_samples:
            return [-1] * len(coords)

        # Convert to radians for Haversine
        coords_rad = np.radians(coords)
        # Earth radius approx 6371.0 km
        kms_per_radian = 6371.0
        epsilon = eps_km / kms_per_radian

        db = DBSCAN(eps=epsilon, min_samples=min_samples, metric='haversine')
        labels = db.fit_predict(coords_rad)
        return labels.tolist()

    @staticmethod
    def create_risk_polygon(lat: float, lon: float, radius_meters: float = 1000.0) -> Dict[str, Any]:
        """
        Creates an approximate circular polygon buffer in GeoJSON format.
        """
        # 1 deg lat approx 111,320m
        # 1 deg lon approx 111,320m * cos(lat)
        deg_lat = radius_meters / 111320.0
        deg_lon = radius_meters / (111320.0 * math.cos(math.radians(lat)))

        angles = np.linspace(0, 2 * np.pi, 24)
        poly_coords = [
            [
                round(lon + deg_lon * math.cos(a), 6),
                round(lat + deg_lat * math.sin(a), 6)
            ]
            for a in angles
        ]
        # Close the ring
        poly_coords.append(poly_coords[0])

        return {
            "type": "Polygon",
            "coordinates": [poly_coords]
        }

    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
