/**
 * PravahDridh — Risk Intelligence & Live Forecasting Types
 * Matches backend Pydantic models from risk_intelligence.py and live_ingestion.py
 */

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertGateDetail {
  alert_eligible: boolean;
  alert_reason: string;
  required_evidence: string[];
  missing_evidence: string[];
  primary_tier_active: boolean;
  secondary_tier_active: boolean;
  quality_gate_passed: boolean;
  signal_anomaly_strength: number;
  signal_activity_strength: number;
  signal_mule_strength: number;
  signal_velocity_strength: number;
  data_quality: number;
}

export interface RiskEvaluationRequest {
  atm_id: string;
  cutoff_time?: string | null;
  features: Record<string, unknown>;
  spatial_radius_km?: number;
  mapping_distance_km?: number | null;
}

export interface RiskEvaluationResponse {
  atm_id: string;
  cutoff_time: string;
  prediction_window: string;
  risk_score: number;
  confidence: number;
  mapping_confidence: number;
  severity: SeverityLevel;
  alert_eligible: boolean;
  alert_gate: AlertGateDetail;
  evidence: string[];
  reasons: string[];
  factor_contributions: Record<string, number>;
  data_freshness_hours: number;
  spatial_radius_km: number;
  engine_version: string;
  evaluated_at: string;
}

export interface TopRiskATM {
  rank: number;
  atm_id: string;
  city?: string | null;
  risk_score: number;
  confidence: number;
  severity: SeverityLevel;
  alert_eligible: boolean;
  primary_evidence: string;
}

export interface ExplanationResponse {
  atm_id: string;
  risk_score: number;
  confidence: number;
  mapping_confidence: number;
  severity: SeverityLevel;
  alert_eligible: boolean;
  alert_reason: string;
  evidence: string[];
  factor_contributions: Record<string, number>;
  signal_strengths: Record<string, number>;
  data_freshness_hours: number;
  evaluated_at: string;
  engine_version: string;
}

export interface TransactionEvent {
  transaction_id: string;
  event_time: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  channel?: string | null;
  atm_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  is_fraud?: number | null;
}

export interface LocationForecast {
  rank: number;
  atm_id: string;
  city?: string | null;
  latitude: number;
  longitude: number;
  forecast_score: number;
  risk_score: number;
  confidence: number;
  mapping_confidence: number;
  severity: SeverityLevel;
  alert_eligible: boolean;
  primary_evidence: string;
  factor_contributions: Record<string, number>;
}

export interface LiveAlertUpdate {
  alert_id: string;
  atm_id: string;
  city?: string | null;
  trigger_transaction_id: string;
  old_severity: string;
  new_severity: SeverityLevel;
  risk_score: number;
  confidence: number;
  alert_eligible: boolean;
  operational_action: string;
  primary_evidence: string;
  emitted_at: string;
}

export interface ForecastUpdatePayload {
  event_id: string;
  event_time: string;
  cutoff_time: string;
  forecast_start: string;
  forecast_end: string;
  forecast_horizon_hours: number;
  trigger_atm_id?: string | null;
  trigger_transaction_id?: string | null;
  trigger_transaction_amount?: number | null;
  top_locations: LocationForecast[];
  alert_updates: LiveAlertUpdate[];
  total_tracked_atms: number;
  pipeline_latency_ms: number;
  engine_version: string;
}

export interface ReplaySimulationRequest {
  city?: string;
  max_events?: number;
  forecast_horizon_hours?: number;
}

export interface ReplayTimelineStep {
  step: number;
  event_time: string;
  trigger_tx: string;
  top_1_atm: string;
  top_1_forecast_score: number;
  top_1_risk_score: number;
  alerts_emitted: number;
}

export interface ReplaySimulationResponse {
  status: string;
  total_events_replayed: number;
  total_alerts_emitted: number;
  top1_rank_shifts: number;
  mean_pipeline_latency_ms: number;
  max_pipeline_latency_ms: number;
  alerts: LiveAlertUpdate[];
  timeline_sample: ReplayTimelineStep[];
}
