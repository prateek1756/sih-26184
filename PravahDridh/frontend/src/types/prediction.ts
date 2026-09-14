export interface RiskPredictionItem {
  id: string;
  model_version: string;
  location_id: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  predicted_window_start: string;
  predicted_window_end: string;
  reasons: string[];
  is_active: boolean;
  predicted_at: string;
  atm_code?: string;
  bank_name?: string;
  city?: string;
}

export interface HotspotGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    prediction_id: string;
    risk_score: number;
    severity: string;
    confidence: number;
    atm_code: string;
    bank_name: string;
    city: string;
    reasons: string[];
  };
}

export interface HotspotGeoJSONCollection {
  type: 'FeatureCollection';
  features: HotspotGeoJSONFeature[];
}
