import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';

export interface InvestigationNote {
  id: string;
  author_id: string;
  author?: {
    id: string;
    email: string;
    badge_number: string;
    role: string;
  };
  note: string;
  created_at: string;
}

export interface Investigation {
  id: string;
  case_number: string;
  title: string;
  alert_id?: string | null;
  complaint_id?: string | null;
  lead_investigator_id: string;
  lead_investigator?: {
    id: string;
    email: string;
    badge_number: string;
    role: string;
  } | null;
  status: string; // active, monitoring, intervention_completed, closed, OPEN, UNDER_REVIEW, ACTION_TAKEN, RESOLVED, FALSE_POSITIVE
  priority: string; // LOW, MEDIUM, HIGH, URGENT
  findings?: string | null;
  outcome?: string | null; // WITHDRAWAL_OCCURRED, NO_WITHDRAWAL_DETECTED, FALSE_POSITIVE, INTERVENTION_PREVENTED_CASHOUT
  outcome_notes?: string | null;
  outcome_recorded_at?: string | null;
  action_taken?: string | null;
  created_at: string;
  updated_at: string;
  notes: InvestigationNote[];
}

export interface InvestigationCreateParams {
  title: string;
  alert_id?: string | null;
  complaint_id?: string | null;
  priority?: string;
  initial_findings?: string | null;
}

export interface InvestigationUpdateParams {
  status?: string;
  priority?: string;
  findings?: string | null;
  action_taken?: string | null;
}

export interface InvestigationOutcomeParams {
  outcome: string; // WITHDRAWAL_OCCURRED, NO_WITHDRAWAL_DETECTED, FALSE_POSITIVE, INTERVENTION_PREVENTED_CASHOUT
  outcome_notes?: string;
  action_taken?: string;
}

export const investigationsApi = {
  listInvestigations: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    priority?: string;
  }): Promise<{ items: Investigation[]; total: number }> => {
    const res = await apiClient.get<StandardResponse<Investigation[]>>('/investigations', { params });
    if (res.data.status === 'success' && res.data.data) {
      return {
        items: res.data.data,
        total: res.data.meta?.total ?? res.data.data.length,
      };
    }
    return { items: [], total: 0 };
  },

  getInvestigation: async (id: string): Promise<Investigation> => {
    return unwrapResponse(
      apiClient.get<StandardResponse<Investigation>>(`/investigations/${id}`)
    );
  },

  createInvestigation: async (data: InvestigationCreateParams): Promise<Investigation> => {
    return unwrapResponse(
      apiClient.post<StandardResponse<Investigation>>('/investigations', data)
    );
  },

  updateInvestigation: async (id: string, data: InvestigationUpdateParams): Promise<Investigation> => {
    return unwrapResponse(
      apiClient.patch<StandardResponse<Investigation>>(`/investigations/${id}`, data)
    );
  },

  updateStatus: async (id: string, status: string): Promise<Investigation> => {
    return unwrapResponse(
      apiClient.patch<StandardResponse<Investigation>>(`/investigations/${id}/status`, { status })
    );
  },

  addNote: async (id: string, note: string): Promise<InvestigationNote> => {
    return unwrapResponse(
      apiClient.post<StandardResponse<InvestigationNote>>(`/investigations/${id}/notes`, { note })
    );
  },

  recordOutcome: async (id: string, data: InvestigationOutcomeParams): Promise<Investigation> => {
    return unwrapResponse(
      apiClient.post<StandardResponse<Investigation>>(`/investigations/${id}/outcome`, data)
    );
  },
};
