/**
 * PravahDridh — Real Transaction Intelligence & Forensic Evidence API Service
 * Interacts with /api/v1/transactions/*
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';

export interface SuspiciousIndicator {
  indicator: string;
  label: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  observed_facts: Record<string, any>;
  suspicious_interpretation: string;
  evidence: Record<string, any>;
}

export interface InvestigativeRecommendation {
  action_id: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
  target_entity: string;
  title: string;
  description: string;
  rationale: string;
}

export interface InvestigationContext {
  alert_id?: string;
  alert_severity?: string;
  alert_status?: string;
  prediction_id?: string;
  model_version?: string;
  atm_id?: string;
  atm_code?: string;
  bank_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  risk_score?: number;
  confidence?: number;
  predicted_window_start?: string;
  predicted_window_end?: string;
  prediction_basis: string[];
}

export interface MaskedAccountSummary {
  account_id: string;
  account_masked: string;
  bank_name: string;
  account_type: string;
  risk_tier: string;
  is_mule_suspected: boolean;
  transaction_count: number;
  total_volume: number;
}

export interface TransactionItem {
  id: string;
  complaint_id?: string;
  complaint_number?: string;
  account_id?: string;
  source_account_masked?: string;
  bank_name?: string;
  account_risk_tier?: string;
  is_mule_suspected: boolean;
  amount: number;
  transaction_type: string;
  occurred_at: string;
  latitude: number;
  longitude: number;
  atm_id?: string;
  destination_atm_code?: string;
  distance_to_atm_meters?: number;
  velocity_score: number;
  is_flagged: boolean;
  is_cash_out: boolean;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  relevance_score: number;
  relevance_reasons: string[];
  created_at: string;
}

export interface TransactionSummary {
  total_transactions: number;
  total_amount: number;
  unique_accounts: number;
  unique_destinations: number;
  cash_out_count: number;
  earliest_transaction?: string;
  latest_transaction?: string;
  atm_concentration_pct: number;
}

export interface ActionableIntelligencePackage {
  package_id: string;
  generated_at: string;
  alert_id: string;
  prediction_id: string;
  severity: string;
  risk_score: number;
  confidence: number;
  predicted_atm: {
    id?: string;
    atm_code?: string;
    bank_name?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  prediction_window: {
    start?: string;
    end?: string;
  };
  prediction_basis: string[];
  forensic_summary: TransactionSummary;
  relevant_accounts: MaskedAccountSummary[];
  verified_indicators: SuspiciousIndicator[];
  recommended_actions: InvestigativeRecommendation[];
  dissemination_targets: string[];
}

export interface TransactionAnalysisResponse {
  context: InvestigationContext;
  summary: TransactionSummary;
  transactions: TransactionItem[];
  indicators: SuspiciousIndicator[];
  recommendations: InvestigativeRecommendation[];
  relevant_accounts: MaskedAccountSummary[];
  actionable_package?: ActionableIntelligencePackage;
  page: number;
  per_page: number;
  total: number;
}

export interface TransactionAnalysisParams {
  alert_id?: string;
  prediction_id?: string;
  atm_id?: string;
  account_id?: string;
  start_time?: string;
  end_time?: string;
  min_amount?: number;
  max_amount?: number;
  transaction_type?: string;
  staging_window_hours?: number;
  proximity_radius_meters?: number;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export const transactionsApi = {
  /**
   * Run real alert-driven transaction analysis and evidence retrieval
   * GET /api/v1/transactions/analysis
   */
  async analyze(params: TransactionAnalysisParams = {}): Promise<TransactionAnalysisResponse> {
    const q = new URLSearchParams();
    if (params.alert_id) q.append('alert_id', params.alert_id);
    if (params.prediction_id) q.append('prediction_id', params.prediction_id);
    if (params.atm_id) q.append('atm_id', params.atm_id);
    if (params.account_id) q.append('account_id', params.account_id);
    if (params.start_time) q.append('start_time', params.start_time);
    if (params.end_time) q.append('end_time', params.end_time);
    if (params.min_amount !== undefined) q.append('min_amount', String(params.min_amount));
    if (params.max_amount !== undefined) q.append('max_amount', String(params.max_amount));
    if (params.transaction_type && params.transaction_type !== 'ALL') {
      q.append('transaction_type', params.transaction_type);
    }
    if (params.staging_window_hours !== undefined) {
      q.append('staging_window_hours', String(params.staging_window_hours));
    }
    if (params.proximity_radius_meters !== undefined) {
      q.append('proximity_radius_meters', String(params.proximity_radius_meters));
    }
    if (params.page) q.append('page', String(params.page));
    if (params.per_page) q.append('per_page', String(params.per_page));
    if (params.sort_by) q.append('sort_by', params.sort_by);
    if (params.sort_order) q.append('sort_order', params.sort_order);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return unwrapResponse<TransactionAnalysisResponse>(
      apiClient.get<StandardResponse<TransactionAnalysisResponse>>(`/transactions/analysis${queryStr}`)
    );
  },

  /**
   * Fetch standalone Actionable Intelligence Package
   * GET /api/v1/transactions/analysis/package
   */
  async getIntelligencePackage(
    alertId?: string,
    predictionId?: string
  ): Promise<ActionableIntelligencePackage> {
    const q = new URLSearchParams();
    if (alertId) q.append('alert_id', alertId);
    if (predictionId) q.append('prediction_id', predictionId);

    return unwrapResponse<ActionableIntelligencePackage>(
      apiClient.get<StandardResponse<ActionableIntelligencePackage>>(
        `/transactions/analysis/package?${q.toString()}`
      )
    );
  },

  /**
   * Fetch single transaction detail dossier
   * GET /api/v1/transactions/{transaction_id}
   */
  async getDetail(transactionId: string): Promise<TransactionItem> {
    return unwrapResponse<TransactionItem>(
      apiClient.get<StandardResponse<TransactionItem>>(`/transactions/${transactionId}`)
    );
  },

  /**
   * Fetch live ingestion pipeline status and database entity counts
   * GET /api/v1/transactions/ingestion/status
   */
  async getIngestionStatus(): Promise<IngestionStatus> {
    return unwrapResponse<IngestionStatus>(
      apiClient.get<StandardResponse<IngestionStatus>>('/transactions/ingestion/status')
    );
  },
};

export interface IngestionStatus {
  status: string;
  total_transactions: number;
  flagged_transactions: number;
  cash_out_transactions: number;
  total_accounts: number;
  mule_suspected_accounts: number;
  total_complaints: number;
  total_atms: number;
  total_predictions: number;
  total_alerts: number;
  total_investigations: number;
  earliest_transaction?: string | null;
  latest_transaction?: string | null;
  active_dataset: string;
}

