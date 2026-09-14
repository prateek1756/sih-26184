/**
 * PravahDridh — Top-K Forecast Ranking Panel
 * Driven by WebSocket ForecastUpdatePayload.top_locations
 */
import React from 'react';
import { MapPin, TrendingUp, Shield, ChevronRight } from 'lucide-react';
import { LocationForecast, SeverityLevel } from '../../types/risk';
import { SeverityBadge } from '../common/SeverityBadge';

interface Props {
  locations: LocationForecast[];
  selectedAtmId: string | null;
  onSelectAtm: (atmId: string) => void;
  isLive: boolean;
}

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function scoreBar(score: number, color: string) {
  return (
    <div
      style={{
        height: '3px',
        background: 'var(--bg-tertiary)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginTop: '3px',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(score * 100, 100)}%`,
          background: color,
          borderRadius: '2px',
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  );
}

export const ForecastRankingPanel: React.FC<Props> = ({
  locations,
  selectedAtmId,
  onSelectAtm,
  isLive,
}) => {
  const sorted = [...locations].sort(
    (a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      b.forecast_score - a.forecast_score
  );

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
          <TrendingUp size={15} color="var(--accent-cyan)" />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Top-K Forecast
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isLive && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.65rem',
                color: '#34d399',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#34d399',
                  boxShadow: '0 0 6px #34d399',
                  animation: 'pulse 1.5s infinite',
                  display: 'inline-block',
                }}
              />
              LIVE
            </span>
          )}
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {sorted.length} ATMs
          </span>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
            }}
          >
            <TrendingUp size={24} color="rgba(255,255,255,0.1)" style={{ marginBottom: '8px' }} />
            <p>Awaiting forecast update...</p>
            <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>
              Ingest a transaction or wait for live stream
            </p>
          </div>
        ) : (
          sorted.map((loc, idx) => {
            const isSelected = loc.atm_id === selectedAtmId;
            const critColor =
              loc.severity === 'CRITICAL'
                ? 'var(--sev-critical-text)'
                : loc.severity === 'HIGH'
                ? 'var(--sev-high-text)'
                : loc.severity === 'MEDIUM'
                ? 'var(--sev-medium-text)'
                : 'var(--sev-low-text)';

            return (
              <button
                key={loc.atm_id}
                id={`rank-row-${idx + 1}`}
                onClick={() => onSelectAtm(loc.atm_id)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: isSelected
                    ? 'rgba(0,212,255,0.06)'
                    : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  borderLeft: isSelected
                    ? '2px solid var(--accent-cyan)'
                    : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Rank */}
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: idx === 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        minWidth: '18px',
                      }}
                    >
                      #{loc.rank}
                    </span>
                    <MapPin size={11} color={critColor} />
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'JetBrains Mono, monospace',
                        maxWidth: '110px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loc.atm_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <SeverityBadge severity={loc.severity} />
                    {loc.alert_eligible && (
                      <Shield size={11} color="var(--sev-critical-text)" />
                    )}
                    <ChevronRight size={12} color="var(--text-muted)" />
                  </div>
                </div>

                {/* City */}
                {loc.city && (
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      marginBottom: '5px',
                    }}
                  >
                    {loc.city}
                  </div>
                )}

                {/* Score bars */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.62rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>Forecast</span>
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {(loc.forecast_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    {scoreBar(loc.forecast_score, 'var(--accent-cyan)')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.62rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>Risk</span>
                      <span style={{ color: critColor, fontFamily: 'JetBrains Mono, monospace' }}>
                        {(loc.risk_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    {scoreBar(loc.risk_score, critColor)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
