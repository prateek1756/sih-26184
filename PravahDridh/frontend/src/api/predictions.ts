/**
 * PravahDridh — Predictions API Client
 * Connects to /api/v1/predictions/*
 * Authenticated via apiClient JWT Bearer interceptor.
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';
import { RiskPredictionItem, HotspotGeoJSONCollection } from '../types/prediction';

export const predictionsApi = {
  /**
   * Fetch live ML predictions computed across active ATMs and transaction history.
   * Authenticated read-only endpoint (INVESTIGATOR, ANALYST, etc.)
   * GET /api/v1/predictions/hotspots/live
   */
  async getLiveHotspots(city?: string, limit = 20): Promise<RiskPredictionItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (city) params.append('city', city);
    return unwrapResponse<RiskPredictionItem[]>(
      apiClient.get<StandardResponse<RiskPredictionItem[]>>(`/predictions/hotspots/live?${params.toString()}`)
    );
  },

  /**
   * Fetch top K active risk predictions from database.
   * GET /api/v1/predictions/top-k
   */
  async getTopKPredictions(k = 20, city?: string): Promise<RiskPredictionItem[]> {
    const params = new URLSearchParams({ k: String(k) });
    if (city) params.append('city', city);
    return unwrapResponse<RiskPredictionItem[]>(
      apiClient.get<StandardResponse<RiskPredictionItem[]>>(`/predictions/top-k?${params.toString()}`)
    );
  },

  /**
   * Fetch GeoJSON Hotspots for map visualization.
   * GET /api/v1/predictions/hotspots
   */
  async getHotspotsGeoJSON(city?: string): Promise<HotspotGeoJSONCollection> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return unwrapResponse<HotspotGeoJSONCollection>(
      apiClient.get<StandardResponse<HotspotGeoJSONCollection>>(`/predictions/hotspots${params}`)
    );
  },
};
