/**
 * PravahDridh — Alerts & Case Intelligence Types
 * Matches backend AlertRead, AlertUpdate, AlertAssign schemas
 */

import { User } from './auth';

export type AlertStatus = 'open' | 'assigned' | 'investigating' | 'resolved' | 'false_positive';

export interface AlertPredictionInfo {
  id: string;
  model_version: string;
  location_id?: string | null;
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
  atm_code?: string | null;
  bank_name?: string | null;
  city?: string | null;
}

export interface Alert {
  id: string;
  prediction_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: AlertStatus;
  assigned_to?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  prediction?: AlertPredictionInfo | null;
  assignee?: User | null;
}

export interface AlertUpdatePayload {
  status?: AlertStatus;
  resolution_notes?: string;
}

export interface AlertAssignPayload {
  assigned_to: string;
}
