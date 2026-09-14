/**
 * PravahDridh — Risk Intelligence & Live Ingestion API Service
 * Interacts with /api/v1/risk/*
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';
import {
  TransactionEvent,
  ForecastUpdatePayload,
  ReplaySimulationRequest,
  ReplaySimulationResponse,
  TopRiskATM,
  RiskEvaluationRequest,
  RiskEvaluationResponse,
  ExplanationResponse,
} from '../types/risk';

export const riskApi = {
  /**
   * Ingest a single live banking transaction and get real-time forecast update
   * POST /api/v1/risk/ingest
   */
  async ingestTransaction(
    event: TransactionEvent,
    topK = 10,
    forecastHorizonHours = 48
  ): Promise<ForecastUpdatePayload> {
    return unwrapResponse<ForecastUpdatePayload>(
      apiClient.post<StandardResponse<ForecastUpdatePayload>>(
        `/risk/ingest?top_k=${topK}&forecast_horizon_hours=${forecastHorizonHours}`,
        event
      )
    );
  },

  /**
   * Run historical transaction stream replay simulation
   * POST /api/v1/risk/replay
   */
  async runReplay(request: ReplaySimulationRequest): Promise<ReplaySimulationResponse> {
    return unwrapResponse<ReplaySimulationResponse>(
      apiClient.post<StandardResponse<ReplaySimulationResponse>>('/risk/replay', request)
    );
  },

  /**
   * Rank ATM cohort using primary A1 Robust Z-Score discriminator
   * POST /api/v1/risk/top
   */
  async getTopRiskATMs(
    cohort: Array<Record<string, unknown>>,
    k = 20,
    spatialRadiusKm = 2.0
  ): Promise<TopRiskATM[]> {
    return unwrapResponse<TopRiskATM[]>(
      apiClient.post<StandardResponse<TopRiskATM[]>>(
        `/risk/top?k=${k}&spatial_radius_km=${spatialRadiusKm}`,
        cohort
      )
    );
  },

  /**
   * Quick risk lookup for a single ATM
   * GET /api/v1/risk/atm/{atm_id}
   */
  async getATMRisk(atmId: string, spatialRadiusKm = 2.0): Promise<RiskEvaluationResponse> {
    return unwrapResponse<RiskEvaluationResponse>(
      apiClient.get<StandardResponse<RiskEvaluationResponse>>(
        `/risk/atm/${encodeURIComponent(atmId)}?spatial_radius_km=${spatialRadiusKm}`
      )
    );
  },

  /**
   * Full structured explainability & evidence audit for an ATM
   * GET /api/v1/risk/explanations/{atm_id} (Requires ANALYST, SUPERVISOR, or ADMIN)
   */
  async getATMExplanation(atmId: string): Promise<ExplanationResponse> {
    return unwrapResponse<ExplanationResponse>(
      apiClient.get<StandardResponse<ExplanationResponse>>(
        `/risk/explanations/${encodeURIComponent(atmId)}`
      )
    );
  },

  /**
   * Detailed single-ATM evaluation with explicit features
   * POST /api/v1/risk/evaluate
   */
  async evaluateATM(request: RiskEvaluationRequest): Promise<RiskEvaluationResponse> {
    return unwrapResponse<RiskEvaluationResponse>(
      apiClient.post<StandardResponse<RiskEvaluationResponse>>('/risk/evaluate', request)
    );
  },
};
