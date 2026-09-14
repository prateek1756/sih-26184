/**
 * PravahDridh — Alert Feed Panel
 * Shows live alert stream from WebSocket + API
 */
import React from 'react';
import { Bell, Shield, AlertTriangle } from 'lucide-react';
import { LiveAlertUpdate } from '../../types/risk';
import { SeverityBadge } from '../common/SeverityBadge';

interface Props {
  alerts: LiveAlertUpdate[];
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString.slice(11, 19) || '—';
  }
}

export const AlertFeedPanel: React.FC<Props> = ({ alerts }) => {
  const criticalCount = alerts.filter(
    (a) => a.new_severity === 'CRITICAL' || a.new_severity === 'HIGH'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={15} color="var(--sev-high-text)" />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Alert Feed
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {criticalCount > 0 && (
            <span
              style={{
                background: 'var(--sev-critical-bg)',
                color: 'var(--sev-critical-text)',
                border: '1px solid var(--sev-critical-border)',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '0.65rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {criticalCount} HIGH+
            </span>
          )}
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {alerts.length} total
          </span>
        </div>
      </div>

      {/* Alert List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {alerts.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
            }}
          >
            <Bell size={22} color="rgba(255,255,255,0.1)" style={{ marginBottom: '8px' }} />
            <p>No alerts yet</p>
            <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>
              Alert-eligible transitions will appear here
            </p>
          </div>
        ) : (
          [...alerts].reverse().map((alert) => (
            <div
              key={alert.alert_id}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background:
                  alert.new_severity === 'CRITICAL'
                    ? 'rgba(239,68,68,0.04)'
                    : alert.new_severity === 'HIGH'
                    ? 'rgba(249,115,22,0.03)'
                    : 'transparent',
              }}
            >
              {/* Row 1: ATM ID + severity + time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {alert.new_severity === 'CRITICAL' ? (
                    <Shield size={11} color="var(--sev-critical-text)" />
                  ) : (
                    <AlertTriangle size={11} color="var(--sev-high-text)" />
                  )}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {alert.atm_id}
                  </span>
                  <SeverityBadge severity={alert.new_severity} />
                </div>
                <span
                  style={{
                    fontSize: '0.62rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {formatTime(alert.emitted_at)}
                </span>
              </div>

              {/* Row 2: City + severity escalation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                {alert.city && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {alert.city}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {alert.old_severity} → {alert.new_severity}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {(alert.risk_score * 100).toFixed(1)}% risk
                </span>
              </div>

              {/* Row 3: Operational action */}
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  fontStyle: 'italic',
                }}
              >
                {alert.operational_action}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
