/**
 * PravahDridh — Geospatial & Spatial Clusters API Service
 * Interacts with /api/v1/geo/* and /api/v1/predictions/hotspots
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';
import { ATMGeoJSONFeatureCollection, HotspotGeoJSONCollection } from '../types/geo';

export const geoApi = {
  /**
   * Fetch all active ATM locations in GeoJSON format
   * GET /api/v1/geo/atms
   */
  async getATMsGeoJSON(city?: string, state?: string): Promise<ATMGeoJSONFeatureCollection> {
    let url = '/geo/atms';
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    if (params.toString()) url += `?${params.toString()}`;

    return unwrapResponse<ATMGeoJSONFeatureCollection>(
      apiClient.get<StandardResponse<ATMGeoJSONFeatureCollection>>(url)
    );
  },

  /**
   * Fetch high/critical risk hotspot polygon clusters in GeoJSON format
   * GET /api/v1/predictions/hotspots
   */
  async getHotspotsGeoJSON(city?: string): Promise<HotspotGeoJSONCollection> {
    let url = '/predictions/hotspots';
    if (city) url += `?city=${encodeURIComponent(city)}`;

    return unwrapResponse<HotspotGeoJSONCollection>(
      apiClient.get<StandardResponse<HotspotGeoJSONCollection>>(url)
    );
  },
};
