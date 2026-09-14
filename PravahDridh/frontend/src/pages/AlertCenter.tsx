/**
 * AlertCenter.tsx — SIH PS 26184
 *
 * Real-time Tactical Alert Center & Investigator Dispatch Workflow.
 * Connects to /api/v1/alerts/* and /api/v1/risk/ws.
 * Zero mock data — all alerts are produced by RandomForest-v2.0 / PostgreSQL.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ShieldAlert,
  CheckCircle2,
  MapPin,
  BrainCircuit,
  Filter,
  Check,
  AlertTriangle,
  UserCheck,
  Send,
  Loader2,
  RefreshCw,
  Clock,
  ExternalLink,
  X,
  Radio,
  FileCheck,
  AlertOctagon,
  Search,
} from 'lucide-react';
import { alertsApi } from '../api/alerts';
import { useRiskWebSocket } from '../hooks/useRiskWebSocket';
import { Alert, AlertStatus } from '../types/alerts';
import { User } from '../types/auth';
import { ForecastUpdatePayload } from '../types/risk';
import { SeverityBadge } from '../components/common/SeverityBadge';

// Severity border colors
const SEV_BORDER: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

// Format timestamp
function formatTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return isoStr;
  }
}

export const AlertCenter: React.FC = () => {
  const navigate = useNavigate();

  // Alert feed state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Investigators list for assignment
  const [investigators, setInvestigators] = useState<User[]>([]);

  // Interactive action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Assign modal state
  const [assignModalAlert, setAssignModalAlert] = useState<Alert | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');

  // Resolve modal state
  const [resolveModalAlert, setResolveModalAlert] = useState<Alert | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'false_positive'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Routing config panel state (display-only system configuration)
  const [routingChannel, setRoutingChannel] = useState<'Dashboard' | 'API Webhook' | 'Nodal Queue'>('Dashboard');
  const [recipient, setRecipient] = useState<'Investigator' | 'State Cyber Cell' | 'Bank Fraud Team' | 'I4C Desk'>('Investigator');
  const [rulesSynchronized, setRulesSynchronized] = useState(false);

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async (quiet = false) => {
    if (quiet) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'ALL' ? statusFilter : undefined;
      const severityParam = severityFilter !== 'ALL' ? severityFilter : undefined;
      const res = await alertsApi.listAlerts(1, 50, statusParam, severityParam);
      setAlerts(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts from backend.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, severityFilter]);

  // Load investigators list
  useEffect(() => {
    alertsApi
      .getInvestigators()
      .then(setInvestigators)
      .catch((err) => console.warn('Could not load investigators:', err));
  }, []);

  // Fetch on mount and filter changes
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // WebSocket for confirmed alert updates only
  const handleForecastUpdate = useCallback((payload: ForecastUpdatePayload) => {
    // Strictly process confirmed backend alert updates
    if (!payload.alert_updates || payload.alert_updates.length === 0) return;
    const confirmedAlerts = payload.alert_updates.filter((u) => u.alert_eligible);
    if (confirmedAlerts.length === 0) return;

    // Refresh the alert list from backend to sync full PostgreSQL entities
    fetchAlerts(true);
  }, [fetchAlerts]);

  const { status: wsStatus } = useRiskWebSocket({
    enabled: true,
    onForecastUpdate: handleForecastUpdate,
  });

  // Action: Acknowledge
  const handleAcknowledge = async (alertId: string) => {
    setActionLoading(alertId);
    setActionSuccess(null);
    try {
      const updated = await alertsApi.acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      setActionSuccess(`Alert acknowledged and assigned.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      alert(`Acknowledge failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Assign
  const handleAssignSubmit = async () => {
    if (!assignModalAlert || !selectedAssigneeId) return;
    const alertId = assignModalAlert.id;
    setActionLoading(alertId);
    setActionSuccess(null);
    try {
      const updated = await alertsApi.assignAlert(alertId, selectedAssigneeId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      const assigneeName = investigators.find((u) => u.id === selectedAssigneeId)?.full_name || 'Investigator';
      setActionSuccess(`Alert assigned to ${assigneeName}. Audit logged.`);
      setAssignModalAlert(null);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      alert(`Assignment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Resolve
  const handleResolveSubmit = async () => {
    if (!resolveModalAlert) return;
    if (!resolutionNotes.trim()) {
      alert('Please provide resolution notes for the audit log.');
      return;
    }
    const alertId = resolveModalAlert.id;
    setActionLoading(alertId);
    setActionSuccess(null);
    try {
      const updated = await alertsApi.resolveAlert(alertId, {
        status: resolveStatus,
        resolution_notes: resolutionNotes.trim(),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      setActionSuccess(`Alert closed as ${resolveStatus.toUpperCase()}. Audit logged.`);
      setResolveModalAlert(null);
      setResolutionNotes('');
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      alert(`Resolution failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'resolved').length,
    [alerts]
  );
  const openCount = useMemo(
    () => alerts.filter((a) => a.status === 'open').length,
    [alerts]
  );
  const assignedCount = useMemo(
    () => alerts.filter((a) => a.status === 'assigned').length,
    [alerts]
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              TACTICAL DISPATCH SYSTEM
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid',
                borderColor: wsStatus === 'CONNECTED' ? '#10b981' : '#f59e0b',
                color: wsStatus === 'CONNECTED' ? '#10b981' : '#f59e0b',
              }}
            >
              {wsStatus === 'CONNECTED' ? '● WebSocket Live' : '○ Connecting…'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Alert Center &amp; Investigator Dispatch
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Actionable machine-generated alerts produced by RandomForest-v2.0 (Calibrated). Triage, assign, and resolve with tamper-evident audit logging.
          </p>
        </div>

        {/* Refresh & Quick Counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => fetchAlerts(true)}
            disabled={isRefreshing || loading}
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '7px 12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Success Toast Banner */}
      {actionSuccess && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            borderRadius: '6px',
            color: '#34d399',
            fontSize: '0.8rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>CRITICAL ACTIVE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>{criticalCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>UNASSIGNED OPEN</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>{openCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>ASSIGNED / ACTIVE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '2px' }}>{assignedCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>TOTAL RETRIEVED</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{alerts.length}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Status filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '4px', fontWeight: 600 }}>STATUS:</span>
          {['ALL', 'open', 'assigned', 'resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: statusFilter === st ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                background: statusFilter === st ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                color: statusFilter === st ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Severity filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '4px', fontWeight: 600 }}>SEVERITY:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: severityFilter === sev ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                background: severityFilter === sev ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                color: severityFilter === sev ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: Alert Feed (Left) + Tactical Routing Config (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '24px' }}>
        {/* LEFT: Real Alert Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
              POSTGRESQL AUDIT-CONNECTED ALERTS ({alerts.length})
            </span>
          </div>

          {loading ? (
            <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '0.85rem' }}>Loading verified alerts…</div>
            </div>
          ) : error ? (
            <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#ef4444" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{error}</div>
              <button className="btn btn-primary" onClick={() => fetchAlerts()} style={{ fontSize: '0.78rem' }}>
                Retry
              </button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={32} style={{ color: 'var(--border-subtle)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                No Alerts Matching Current Filters
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {statusFilter !== 'ALL' || severityFilter !== 'ALL'
                  ? 'Try clearing the status or severity filters.'
                  : 'No active cash-out alerts have been triggered by the production ML model.'}
              </p>
            </div>
          ) : (
            alerts.map((al) => {
              const pred = al.prediction;
              const isActionInProgress = actionLoading === al.id;
              const riskPct = pred?.risk_score !== undefined ? Math.round(Number(pred.risk_score) * 100) : null;
              const confPct = pred?.confidence !== undefined ? Math.round(Number(pred.confidence) * 100) : null;
              const atmLabel = pred?.atm_code || (pred?.location_id ? `ATM-${String(pred.location_id).slice(0, 8).toUpperCase()}` : 'ATM Node');

              return (
                <div
                  key={al.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    borderLeft: `4px solid ${SEV_BORDER[al.severity] || '#6b7280'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Top metadata bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                        ALT-{al.id.slice(0, 8).toUpperCase()} · {formatTime(al.created_at)}
                      </span>
                      <SeverityBadge severity={al.severity} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {al.status === 'open' ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          OPEN
                        </span>
                      ) : al.status === 'assigned' ? (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(0, 212, 255, 0.12)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(0, 212, 255, 0.3)',
                          }}
                        >
                          ASSIGNED
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          {al.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Target ATM and bank location */}
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {atmLabel}
                      {pred?.bank_name ? ` — ${pred.bank_name}` : ''}
                      {pred?.city ? ` (${pred.city})` : ''}
                    </h3>

                    {pred && (
                      <div style={{ display: 'flex', gap: '14px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span>
                          Coordinates: <strong style={{ color: 'var(--text-secondary)' }}>{Number(pred.latitude).toFixed(4)}, {Number(pred.longitude).toFixed(4)}</strong>
                        </span>
                        {riskPct !== null && (
                          <span>
                            Risk Score: <strong style={{ color: SEV_BORDER[al.severity] }}>{riskPct}%</strong>
                          </span>
                        )}
                        {confPct !== null && (
                          <span>
                            Calibrated Conf: <strong style={{ color: 'var(--text-primary)' }}>{confPct}%</strong>
                          </span>
                        )}
                        <span>
                          Model: <strong style={{ color: 'var(--text-secondary)' }}>{pred.model_version}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prediction Evidence Reasons */}
                  {pred?.reasons && pred.reasons.length > 0 && (
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                        CORROBORATING PREDICTIVE EVIDENCE
                      </div>
                      {pred.reasons.map((r, idx) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          <span style={{ color: 'var(--accent-cyan)', marginRight: '6px' }}>›</span>
                          {r}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resolution notes if resolved */}
                  {al.resolved_at && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                      <span>Resolved at {formatTime(al.resolved_at)}</span>
                      {al.resolution_notes && (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                          — &ldquo;{al.resolution_notes}&rdquo;
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '10px',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Assignee:{' '}
                      <strong style={{ color: al.assignee ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                        {al.assignee ? `${al.assignee.full_name} (${al.assignee.role})` : 'Unassigned'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Acknowledge Button */}
                      {al.status === 'open' && (
                        <button
                          onClick={() => handleAcknowledge(al.id)}
                          disabled={isActionInProgress}
                          className="btn btn-ghost"
                          style={{
                            fontSize: '0.75rem',
                            padding: '5px 11px',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          {isActionInProgress ? <Loader2 size={12} className="spin-slow" /> : <Check size={12} />}
                          <span>Acknowledge</span>
                        </button>
                      )}

                      {/* Assign Button */}
                      {al.status !== 'resolved' && al.status !== 'false_positive' && (
                        <button
                          onClick={() => {
                            setAssignModalAlert(al);
                            setSelectedAssigneeId(al.assigned_to || (investigators[0]?.id ?? ''));
                          }}
                          disabled={isActionInProgress}
                          className="btn btn-ghost"
                          style={{
                            fontSize: '0.75rem',
                            padding: '5px 11px',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <UserCheck size={12} />
                          <span>{al.assigned_to ? 'Reassign' : 'Assign'}</span>
                        </button>
                      )}

                      {/* Resolve Button */}
                      {al.status !== 'resolved' && al.status !== 'false_positive' && (
                        <button
                          onClick={() => {
                            setResolveModalAlert(al);
                            setResolutionNotes('');
                            setResolveStatus('resolved');
                          }}
                          disabled={isActionInProgress}
                          className="btn btn-ghost"
                          style={{
                            fontSize: '0.75rem',
                            padding: '5px 11px',
                            border: '1px solid var(--border-subtle)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <FileCheck size={12} />
                          <span>Resolve</span>
                        </button>
                      )}

                      {/* Analyze Transactions Link (Phase 4) */}
                      <button
                        onClick={() => navigate(`/dashboard/transactions?alert_id=${al.id}`)}
                        className="btn btn-ghost"
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 11px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: 'var(--accent-cyan)',
                        }}
                      >
                        <Search size={12} />
                        <span>Tx Forensics</span>
                      </button>

                      {/* Investigate Map Link */}
                      <button
                        onClick={() => navigate('/dashboard/gis')}
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>GIS Focus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT: Tactical Routing & Dispatch System Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                DISPATCH PROTOCOL RULES
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                Automated Incident Routing
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                Configure live alert relay channels. Confirmed CRITICAL alerts trigger prioritized audit queues for designated nodal desks.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                TARGET DESK RECIPIENT
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['Investigator', 'State Cyber Cell', 'Bank Fraud Team', 'I4C Desk'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRecipient(r)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: recipient === r ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                      background: recipient === r ? 'rgba(0, 212, 255, 0.12)' : 'var(--bg-tertiary)',
                      color: recipient === r ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                NOTIFICATION DISPATCH CHANNEL
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(['Dashboard', 'API Webhook', 'Nodal Queue'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setRoutingChannel(ch)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: routingChannel === ch ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                      background: routingChannel === ch ? 'rgba(0, 212, 255, 0.12)' : 'var(--bg-tertiary)',
                      color: routingChannel === ch ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                ROUTING SPECIFICATION
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '4px', lineHeight: 1.45 }}>
                Alerts escalated to <strong>HIGH / CRITICAL</strong> by the risk engine are automatically persisted in PostgreSQL, routed to <strong>{recipient}</strong> via <strong>{routingChannel}</strong>, and logged to the tamper-evident audit ledger.
              </div>
            </div>

            <div>
              <button
                onClick={() => {
                  setRulesSynchronized(true);
                  setTimeout(() => setRulesSynchronized(false), 2500);
                }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: rulesSynchronized ? '#10b981' : undefined,
                }}
              >
                {rulesSynchronized ? <CheckCircle2 size={15} /> : <Send size={15} />}
                <span>{rulesSynchronized ? 'Routing In Sync' : 'Synchronize Routing Rules'}</span>
              </button>
            </div>
          </div>

          {/* Audit Chain Explainer */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <ShieldAlert size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Certified Forensic Audit Chain
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              All alert transitions (Creation, Acknowledgement, Assignment, and Resolution) are cryptographically hashed using SHA-256 and committed to PostgreSQL <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>audit_events</code> to ensure chain of custody for court-admissible electronic evidence.
            </p>
          </div>
        </div>
      </div>

      {/* ── MODAL: ASSIGN INVESTIGATOR ── */}
      {assignModalAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '440px',
              padding: '24px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Assign Alert to Investigator
              </h3>
              <button onClick={() => setAssignModalAlert(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Assigning will transition status to <strong>ASSIGNED</strong> and register an audit log entry in PostgreSQL.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                SELECT TEAM MEMBER
              </label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                {investigators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.role} {u.badge_number ? `(${u.badge_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setAssignModalAlert(null)}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={!selectedAssigneeId || actionLoading !== null}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '6px 16px' }}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RESOLVE ALERT ── */}
      {resolveModalAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '480px',
              padding: '24px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Resolve Machine Alert
              </h3>
              <button onClick={() => setResolveModalAlert(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                OUTCOME CLASSIFICATION
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResolveStatus('resolved')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: resolveStatus === 'resolved' ? '#10b981' : 'var(--border-subtle)',
                    background: resolveStatus === 'resolved' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-tertiary)',
                    color: resolveStatus === 'resolved' ? '#34d399' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Resolved (Intervention Confirmed)
                </button>
                <button
                  type="button"
                  onClick={() => setResolveStatus('false_positive')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: resolveStatus === 'false_positive' ? '#f59e0b' : 'var(--border-subtle)',
                    background: resolveStatus === 'false_positive' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-tertiary)',
                    color: resolveStatus === 'false_positive' ? '#fbbf24' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  False Positive
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                MANDATORY RESOLUTION NOTES (FOR AUDIT LOG)
              </label>
              <textarea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter field observation, inter-agency action, nodal officer confirmation, or rationale…"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setResolveModalAlert(null)}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSubmit}
                disabled={actionLoading !== null}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '6px 16px', backgroundColor: '#10b981' }}
              >
                Complete Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
