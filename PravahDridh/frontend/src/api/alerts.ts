/**
 * PravahDridh — Alerts & Case Intelligence API Service
 * Interacts with /api/v1/alerts/*
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse, PaginationMeta } from '../types/common';
import { Alert, AlertUpdatePayload } from '../types/alerts';
import { User } from '../types/auth';

export interface AlertListResponse {
  items: Alert[];
  meta?: PaginationMeta | null;
}

export const alertsApi = {
  /**
   * List alerts with pagination and filters
   * GET /api/v1/alerts
   */
  async listAlerts(
    page = 1,
    perPage = 20,
    status?: string,
    severity?: string
  ): Promise<AlertListResponse> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);

    const response = await apiClient.get<StandardResponse<Alert[]>>(`/alerts?${params.toString()}`);
    if (response.data.status === 'success' && response.data.data !== null) {
      return {
        items: response.data.data,
        meta: response.data.meta,
      };
    }
    throw new Error(response.data.error?.message || 'Failed to fetch alerts');
  },

  /**
   * Get detail of a specific alert
   * GET /api/v1/alerts/{alert_id}
   */
  async getAlert(alertId: string): Promise<Alert> {
    return unwrapResponse<Alert>(
      apiClient.get<StandardResponse<Alert>>(`/alerts/${alertId}`)
    );
  },

  /**
   * Acknowledge an alert (Investigator / Supervisor / Admin)
   * POST /api/v1/alerts/{alert_id}/acknowledge
   */
  async acknowledgeAlert(alertId: string): Promise<Alert> {
    return unwrapResponse<Alert>(
      apiClient.post<StandardResponse<Alert>>(`/alerts/${alertId}/acknowledge`)
    );
  },

  /**
   * Assign alert to an investigator
   * PATCH /api/v1/alerts/{alert_id}/assign
   */
  async assignAlert(alertId: string, assignedToUserId: string): Promise<Alert> {
    return unwrapResponse<Alert>(
      apiClient.patch<StandardResponse<Alert>>(`/alerts/${alertId}/assign`, {
        assigned_to: assignedToUserId,
      })
    );
  },

  /**
   * Resolve an alert with resolution notes
   * PATCH /api/v1/alerts/{alert_id}/resolve
   */
  async resolveAlert(alertId: string, payload: AlertUpdatePayload): Promise<Alert> {
    return unwrapResponse<Alert>(
      apiClient.patch<StandardResponse<Alert>>(`/alerts/${alertId}/resolve`, payload)
    );
  },

  /**
   * List available investigators for alert assignment
   * GET /api/v1/alerts/investigators
   */
  async getInvestigators(): Promise<User[]> {
    return unwrapResponse<User[]>(
      apiClient.get<StandardResponse<User[]>>('/alerts/investigators')
    );
  },
};
