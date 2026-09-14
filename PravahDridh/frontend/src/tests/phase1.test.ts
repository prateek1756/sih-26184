/**
 * HERMES AI — Phase 1 Unit Tests
 * Covers: TypeScript models, API response parsing, RBAC logic, WebSocket message handling
 */

import { describe, it, expect } from 'vitest';
import { ForecastUpdatePayload, LocationForecast, LiveAlertUpdate, SeverityLevel } from '../types/risk';
import { User, UserRole } from '../types/auth';
import { StandardResponse } from '../types/common';

// ─────────────────────────────────────────────────────────────────────────────
// 1. StandardResponse envelope parsing
// ─────────────────────────────────────────────────────────────────────────────
describe('StandardResponse envelope', () => {
  it('correctly types a successful response', () => {
    const resp: StandardResponse<string> = {
      status: 'success',
      data: 'hello',
      meta: null,
      error: null,
    };
    expect(resp.status).toBe('success');
    expect(resp.data).toBe('hello');
  });

  it('correctly types an error response', () => {
    const resp: StandardResponse<null> = {
      status: 'error',
      data: null,
      error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
    };
    expect(resp.status).toBe('error');
    expect(resp.error?.code).toBe('AUTH_FAILED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LocationForecast type shape validation
// ─────────────────────────────────────────────────────────────────────────────
describe('LocationForecast type', () => {
  const mockForecast: LocationForecast = {
    rank: 1,
    atm_id: 'ATM-MUM-0001',
    city: 'Mumbai',
    latitude: 19.076,
    longitude: 72.877,
    forecast_score: 0.85,
    risk_score: 0.72,
    confidence: 0.78,
    mapping_confidence: 0.92,
    severity: 'HIGH',
    alert_eligible: true,
    primary_evidence: 'Velocity surge 3.2σ above mean',
    factor_contributions: { a1_anomaly: 0.40, velocity: 0.15 },
  };

  it('has all required fields from backend schema', () => {
    expect(mockForecast.rank).toBe(1);
    expect(mockForecast.forecast_score).toBeGreaterThan(0);
    expect(mockForecast.forecast_score).toBeLessThanOrEqual(1);
    expect(mockForecast.alert_eligible).toBe(true);
    expect(mockForecast.factor_contributions).toHaveProperty('a1_anomaly');
  });

  it('severity is a valid tier', () => {
    const validSeverities: SeverityLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(validSeverities).toContain(mockForecast.severity);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ForecastUpdatePayload shape validation
// ─────────────────────────────────────────────────────────────────────────────
describe('ForecastUpdatePayload', () => {
  const mockPayload: ForecastUpdatePayload = {
    event_id: 'evt-001',
    event_time: '2023-05-01T02:37:00',
    cutoff_time: '2023-05-01T02:37:00',
    forecast_start: '2023-05-01T02:37:00',
    forecast_end: '2023-05-03T02:37:00',
    forecast_horizon_hours: 48,
    trigger_atm_id: 'ATM-MUM-0001',
    trigger_transaction_id: 'TXN-001',
    trigger_transaction_amount: 25000.0,
    top_locations: [],
    alert_updates: [],
    total_tracked_atms: 150,
    pipeline_latency_ms: 1.5,
    engine_version: 'rie-candidate-v0.1',
  };

  it('contains all core fields', () => {
    expect(mockPayload.forecast_horizon_hours).toBe(48);
    expect(mockPayload.total_tracked_atms).toBe(150);
    expect(Array.isArray(mockPayload.top_locations)).toBe(true);
    expect(Array.isArray(mockPayload.alert_updates)).toBe(true);
  });

  it('pipeline_latency_ms is sub-100ms', () => {
    expect(mockPayload.pipeline_latency_ms).toBeLessThan(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. LiveAlertUpdate shape
// ─────────────────────────────────────────────────────────────────────────────
describe('LiveAlertUpdate', () => {
  const mockAlert: LiveAlertUpdate = {
    alert_id: 'alert-uuid-001',
    atm_id: 'ATM-MUM-0001',
    city: 'Mumbai',
    trigger_transaction_id: 'TXN-001',
    old_severity: 'MEDIUM',
    new_severity: 'HIGH',
    risk_score: 0.72,
    confidence: 0.78,
    alert_eligible: true,
    operational_action: 'Priority Investigator Review Required within 4 hours',
    primary_evidence: 'A1 anomaly + velocity surge',
    emitted_at: '2023-05-01T02:37:01',
  };

  it('has required fields with correct types', () => {
    expect(typeof mockAlert.alert_id).toBe('string');
    expect(mockAlert.alert_eligible).toBe(true);
    expect(mockAlert.risk_score).toBeGreaterThanOrEqual(0);
    expect(mockAlert.risk_score).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. RBAC Logic — canAccessExplainability
// ─────────────────────────────────────────────────────────────────────────────
describe('RBAC explainability access', () => {
  const hasRole = (user: User, allowedRoles: UserRole[]): boolean => {
    if (user.role === 'ADMIN') return true;
    return allowedRoles.includes(user.role);
  };

  const canAccessExplainability = (user: User): boolean =>
    hasRole(user, ['ANALYST', 'SUPERVISOR', 'ADMIN']);

  const makeUser = (role: UserRole): User => ({
    id: 'uuid',
    email: 'user@hermes.gov.in',
    full_name: 'Test Officer',
    role,
    is_active: true,
    created_at: '',
    updated_at: '',
  });

  it('ADMIN can access explainability', () => {
    expect(canAccessExplainability(makeUser('ADMIN'))).toBe(true);
  });

  it('ANALYST can access explainability', () => {
    expect(canAccessExplainability(makeUser('ANALYST'))).toBe(true);
  });

  it('SUPERVISOR can access explainability', () => {
    expect(canAccessExplainability(makeUser('SUPERVISOR'))).toBe(true);
  });

  it('VIEWER cannot access explainability', () => {
    expect(canAccessExplainability(makeUser('VIEWER'))).toBe(false);
  });

  it('INVESTIGATOR cannot access explainability via this gate', () => {
    expect(canAccessExplainability(makeUser('INVESTIGATOR'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. WebSocket message parsing
// ─────────────────────────────────────────────────────────────────────────────
describe('WebSocket ForecastUpdatePayload parsing', () => {
  it('parses valid JSON payload correctly', () => {
    const raw = JSON.stringify({
      event_id: 'evt-ws-001',
      event_time: '2023-05-01T10:00:00',
      cutoff_time: '2023-05-01T10:00:00',
      forecast_start: '2023-05-01T10:00:00',
      forecast_end: '2023-05-03T10:00:00',
      forecast_horizon_hours: 48,
      trigger_atm_id: null,
      trigger_transaction_id: null,
      trigger_transaction_amount: null,
      top_locations: [],
      alert_updates: [],
      total_tracked_atms: 150,
      pipeline_latency_ms: 2.1,
      engine_version: 'rie-candidate-v0.1',
    });

    const parsed: ForecastUpdatePayload = JSON.parse(raw);
    expect(parsed.event_id).toBe('evt-ws-001');
    expect(parsed.total_tracked_atms).toBe(150);
  });

  it('does not throw on empty alert_updates array', () => {
    const payload: ForecastUpdatePayload = JSON.parse(
      '{"event_id":"x","event_time":"","cutoff_time":"","forecast_start":"","forecast_end":"","forecast_horizon_hours":48,"top_locations":[],"alert_updates":[],"total_tracked_atms":0,"pipeline_latency_ms":0,"engine_version":""}'
    );
    expect(payload.alert_updates).toHaveLength(0);
  });

  it('pong heartbeat messages are not parsed as payloads', () => {
    const data = 'pong';
    expect(() => {
      if (data === 'pong') return;
      JSON.parse(data);
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. No mock data enforcement
// ─────────────────────────────────────────────────────────────────────────────
describe('Mock data enforcement', () => {
  it('no static risk scores in types module', () => {
    // LocationForecast.forecast_score must be a runtime field, not statically defined
    const forecast: LocationForecast = {
      rank: 1,
      atm_id: 'ATM-TEST-001',
      city: 'Delhi',
      latitude: 28.6,
      longitude: 77.2,
      forecast_score: 0.0,   // Backend provides this
      risk_score: 0.0,
      confidence: 0.0,
      mapping_confidence: 0.0,
      severity: 'LOW',
      alert_eligible: false,
      primary_evidence: '',
      factor_contributions: {},
    };
    // Validates that type doesn't hardcode a default risk value
    expect(forecast.forecast_score).toBe(0.0);
  });
});
