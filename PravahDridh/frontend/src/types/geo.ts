/**
 * PravahDridh — Geospatial & ATM Types
 * Matches backend GeoJSON and ATM schemas
 */

export interface GeoJSONGeometryPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ATMProperties {
  id: string;
  atm_code: string;
  bank_name: string;
  address?: string | null;
  city: string;
  state: string;
}

export interface ATMGeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometryPoint;
  properties: ATMProperties;
}

export interface ATMGeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: ATMGeoJSONFeature[];
}

export interface HotspotPolygonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    prediction_id: string;
    risk_score: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    atm_code: string;
    bank_name: string;
    city: string;
    reasons: string[];
  };
}

export interface HotspotGeoJSONCollection {
  type: 'FeatureCollection';
  features: HotspotPolygonFeature[];
}
