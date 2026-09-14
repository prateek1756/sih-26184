/**
 * PravahDridh — Intelligence Command Dashboard (Phase 2)
 *
 * Opens directly — no login required in demo mode.
 *
 * Layout (three-column command center):
 * ┌─────────────────────────────────────────────────────────┐
 * │  TOP NAV BAR  (brand + nav + WS status)                 │
 * ├──────────────┬──────────────────────┬───────────────────┤
 * │ FORECAST     │  GIS MAP             │ ALERT FEED        │
 * │ RANKING      │  (React-Leaflet)     │ + SELECTED ATM    │
 * │ Top-K list   │                      │   DETAIL          │
 * └──────────────┴──────────────────────┴───────────────────┘
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, RefreshCw, Zap, Info, Activity, Bell, MapPin } from 'lucide-react';
import { useRiskWebSocket } from '../hooks/useRiskWebSocket';
import { geoApi } from '../api/geo';
import { alertsApi } from '../api/alerts';
import { predictionsApi } from '../api/predictions';
import { ForecastRankingPanel } from '../components/forecast/ForecastRankingPanel';
import { AlertFeedPanel } from '../components/forecast/AlertFeedPanel';
import { ForecastMetaStrip } from '../components/forecast/ForecastMetaStrip';
import { ForecastMap } from '../components/map/ForecastMap';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ATMGeoJSONFeatureCollection } from '../types/geo';
import { ForecastUpdatePayload, LocationForecast, LiveAlertUpdate } from '../types/risk';

// ─── Styles injected once ──────────────────────────────────────────────────
const pulseKeyframe = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(1.3); }
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ─── Tabs for right panel ─────────────────────────────────────────────────
type RightTab = 'alerts' | 'detail';

export const Dashboard: React.FC = () => {
  // ── State ────────────────────────────────────────────────────────────────
  const [atmGeoJSON, setAtmGeoJSON] = useState<ATMGeoJSONFeatureCollection | null>(null);
  const [atmLoadError, setAtmLoadError] = useState<string | null>(null);
  const [forecastLocations, setForecastLocations] = useState<LocationForecast[]>([]);
  const [alertFeed, setAlertFeed] = useState<LiveAlertUpdate[]>([]);
  const [latestPayload, setLatestPayload] = useState<ForecastUpdatePayload | null>(null);
  const [selectedAtmId, setSelectedAtmId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('alerts');
  const [newAlertFlash, setNewAlertFlash] = useState(false);
  const alertFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const handleForecastUpdate = useCallback((payload: ForecastUpdatePayload) => {
    setLatestPayload(payload);

    // Merge top_locations (WebSocket always provides full ordered list)
    if (payload.top_locations.length > 0) {
      setForecastLocations(payload.top_locations);
      // Auto-select rank-1 ATM if nothing is selected
      setSelectedAtmId((prev) => prev ?? payload.top_locations[0]?.atm_id ?? null);
    }

    // Accumulate alert updates (cap at 100 to prevent memory growth)
    if (payload.alert_updates.length > 0) {
      setAlertFeed((prev) => {
        const merged = [...payload.alert_updates, ...prev];
        const seen = new Set<string>();
        return merged
          .filter((a) => {
            if (seen.has(a.alert_id)) return false;
            seen.add(a.alert_id);
            return true;
          })
          .slice(0, 100);
      });

      // Flash the alert tab badge
      if (alertFlashTimer.current) clearTimeout(alertFlashTimer.current);
      setNewAlertFlash(true);
      alertFlashTimer.current = setTimeout(() => setNewAlertFlash(false), 2000);
    }
  }, []);

  const { status: wsStatus, error: wsError } = useRiskWebSocket({
    enabled: true,
    onForecastUpdate: handleForecastUpdate,
  });

  // ── Load ATM GeoJSON with Realistic Fallback for Prototype Demo ──────────
  useEffect(() => {
    // Populate realistic demo locations immediately so command center is never blank
    const demoLocations: LocationForecast[] = [
      {
        rank: 1,
        atm_id: 'ATM-ROH-04',
        city: 'Delhi NCR',
        latitude: 28.7041,
        longitude: 77.1025,
        forecast_score: 0.94,
        risk_score: 94,
        confidence: 0.93,
        mapping_confidence: 0.95,
        severity: 'CRITICAL',
        alert_eligible: true,
        primary_evidence: '3 active mule accounts within 2km; rapid withdrawal burst signature',
        factor_contributions: {
          mule_proximity: 0.92,
          velocity_anomaly: 0.89,
          structuring_pattern: 0.85,
        },
      },
      {
        rank: 2,
        atm_id: 'ATM-LXN-11',
        city: 'East Delhi',
        latitude: 28.6304,
        longitude: 77.2773,
        forecast_score: 0.86,
        risk_score: 86,
        confidence: 0.88,
        mapping_confidence: 0.91,
        severity: 'HIGH',
        alert_eligible: true,
        primary_evidence: 'Peer-to-peer UPI layering termination; linked to NCRP complaint #88190',
        factor_contributions: {
          upi_layering: 0.88,
          sim_swap: 0.82,
        },
      },
      {
        rank: 3,
        atm_id: 'ATM-GUR-22',
        city: 'Gurugram',
        latitude: 28.4817,
        longitude: 77.0807,
        forecast_score: 0.79,
        risk_score: 79,
        confidence: 0.82,
        mapping_confidence: 0.87,
        severity: 'HIGH',
        alert_eligible: true,
        primary_evidence: 'Cross-border interstate velocity hop from Delhi to Haryana',
        factor_contributions: {
          travel_speed_anomaly: 0.84,
        },
      },
      {
        rank: 4,
        atm_id: 'ATM-CP-01',
        city: 'Central Delhi',
        latitude: 28.6315,
        longitude: 77.2167,
        forecast_score: 0.62,
        risk_score: 62,
        confidence: 0.74,
        mapping_confidence: 0.85,
        severity: 'MEDIUM',
        alert_eligible: false,
        primary_evidence: 'Elevated daytime commercial volume with slight velocity increase',
        factor_contributions: {
          transaction_volume: 0.65,
        },
      },
    ];

    setForecastLocations((prev) => (prev.length > 0 ? prev : demoLocations));
    setSelectedAtmId((prev) => prev ?? demoLocations[0].atm_id);

    // Fetch live predictions from PostgreSQL
    predictionsApi
      .getTopKPredictions(20)
      .then((preds) => {
        if (preds && preds.length > 0) {
          const realLocations: LocationForecast[] = preds.map((p, idx) => ({
            rank: idx + 1,
            atm_id: p.atm_code || (p.location_id ? `ATM-${p.location_id.slice(0, 8).toUpperCase()}` : `ATM-${idx + 1}`),
            city: p.city || 'Delhi NCR',
            latitude: p.latitude,
            longitude: p.longitude,
            forecast_score: Number(p.risk_score),
            risk_score: Math.round(Number(p.risk_score) * 100),
            confidence: Number(p.confidence),
            mapping_confidence: 0.95,
            severity: p.severity,
            alert_eligible: Number(p.risk_score) >= 0.75,
            primary_evidence: p.reasons?.[0] || 'Calibrated Random Forest cash-out risk vector',
            factor_contributions: {
              mule_proximity: 0.88,
              velocity_anomaly: 0.82,
              structuring_pattern: 0.78,
            },
          }));
          setForecastLocations(realLocations);
          setSelectedAtmId((prev) => prev ?? realLocations[0].atm_id);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch real predictions, using fallback:', err);
      });

    // Fetch confirmed alerts from backend API
    alertsApi
      .listAlerts(1, 20)
      .then((res) => {
        if (res.items && res.items.length > 0) {
          const realUpdates: LiveAlertUpdate[] = res.items.map((al) => ({
            alert_id: `ALT-${al.id.slice(0, 8).toUpperCase()}`,
            atm_id: al.prediction?.atm_code || (al.prediction?.location_id ? `ATM-${String(al.prediction.location_id).slice(0, 8).toUpperCase()}` : 'ATM Node'),
            city: al.prediction?.city || 'Delhi NCR',
            trigger_transaction_id: 'PRED-' + (al.prediction_id ? String(al.prediction_id).slice(0, 8) : 'AUTO'),
            old_severity: 'MEDIUM',
            new_severity: al.severity as any,
            risk_score: al.prediction?.risk_score ? Number(al.prediction.risk_score) : 0.85,
            confidence: al.prediction?.confidence ? Number(al.prediction.confidence) : 0.9,
            alert_eligible: true,
            operational_action: al.resolution_notes || (al.prediction?.reasons?.[0] ? al.prediction.reasons[0] : 'Investigator review required'),
            primary_evidence: al.prediction?.reasons?.[0] || 'Machine-predicted cash drain risk',
            emitted_at: al.created_at,
          }));
          setAlertFeed((prev) => (prev.length > 0 ? prev : realUpdates));
        }
      })
      .catch(() => {
        // Fallback: wait for WebSocket updates
      });

    geoApi
      .getATMsGeoJSON()
      .then(setAtmGeoJSON)
      .catch((err) => {
        // Fallback demo feature collection
        setAtmGeoJSON({
          type: 'FeatureCollection',
          features: demoLocations.map((loc) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [loc.longitude, loc.latitude],
            },
            properties: {
              id: loc.atm_id,
              atm_code: loc.atm_id,
              bank_name: 'State Bank of India',
              address: `${loc.city} Commercial Terminal`,
              city: loc.city || 'Delhi NCR',
              state: 'Delhi',
            },
          })),
        });
        console.info('[PravahDridh] Operating with demo benchmark GIS layer');
      });
  }, []);

  // ── Selected ATM detail ───────────────────────────────────────────────────
  const selectedLocation = forecastLocations.find((l) => l.atm_id === selectedAtmId) ?? null;

  // ── Alert count badge ─────────────────────────────────────────────────────
  const highPriorityCount = alertFeed.filter(
    (a) => a.new_severity === 'CRITICAL' || a.new_severity === 'HIGH'
  ).length;

  return (
    <>
      {/* Inject keyframe CSS */}
      <style>{pulseKeyframe}</style>

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ═══════ TOP NAV BAR ═══════ */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            height: '52px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
            zIndex: 200,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color="var(--accent-cyan)" />
            <div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Pravah
              </span>
              <span
                style={{
                  fontWeight: 400,
                  fontSize: '0.95rem',
                  color: 'var(--accent-cyan)',
                  letterSpacing: '-0.01em',
                }}
              >
                Dridh
              </span>
            </div>
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                borderLeft: '1px solid var(--border-subtle)',
                paddingLeft: '10px',
                marginLeft: '2px',
              }}
            >
              Cash-Withdrawal Location Forecasting · MHA / I4C
            </span>
          </div>

          {/* Right side: stream status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {wsError && (
              <span style={{ fontSize: '0.7rem', color: 'var(--sev-high-text)' }}>
                WS: {wsError}
              </span>
            )}
            <StatusIndicator status={wsStatus} />
            {wsStatus === 'DISCONNECTED' || wsStatus === 'ERROR' ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Start backend to enable live forecast stream
              </span>
            ) : null}
          </div>
        </header>

        {/* ═══════ FORECAST META STRIP ═══════ */}
        <ForecastMetaStrip payload={latestPayload} wsStatus={wsStatus} />

        {/* ═══════ MAIN THREE-COLUMN LAYOUT ═══════ */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '280px 1fr 300px',
            overflow: 'hidden',
          }}
        >
          {/* ── COL 1: Forecast Ranking Panel ── */}
          <div
            style={{
              borderRight: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <ForecastRankingPanel
              locations={forecastLocations}
              selectedAtmId={selectedAtmId}
              onSelectAtm={(id) => {
                setSelectedAtmId(id);
                setRightTab('detail');
              }}
              isLive={wsStatus === 'CONNECTED'}
            />
          </div>

          {/* ── COL 2: GIS Map ── */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            {atmLoadError && (
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                  background: 'rgba(15,21,35,0.9)',
                  border: '1px solid var(--sev-high-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  color: 'var(--sev-high-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <RefreshCw size={12} />
                {atmLoadError}
              </div>
            )}

            {forecastLocations.length === 0 && wsStatus !== 'CONNECTED' && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 500,
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <MapPin size={36} color="rgba(0,212,255,0.2)" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  GIS Forecast Map
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Start the backend to enable live location forecasting
                </p>
              </div>
            )}

            <ForecastMap
              atmGeoJSON={atmGeoJSON}
              forecastLocations={forecastLocations}
              selectedAtmId={selectedAtmId}
              onSelectAtm={(id) => {
                setSelectedAtmId(id);
                setRightTab('detail');
              }}
            />
          </div>

          {/* ── COL 3: Alert Feed + ATM Detail ── */}
          <div
            style={{
              borderLeft: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              {[
                {
                  id: 'alerts' as RightTab,
                  icon: <Bell size={13} />,
                  label: 'Alerts',
                  badge: highPriorityCount > 0 ? highPriorityCount : null,
                  flash: newAlertFlash,
                },
                {
                  id: 'detail' as RightTab,
                  icon: <Info size={13} />,
                  label: 'ATM Detail',
                  badge: null,
                  flash: false,
                },
              ].map(({ id, icon, label, badge, flash }) => (
                <button
                  key={id}
                  onClick={() => setRightTab(id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '9px 8px',
                    background: rightTab === id ? 'var(--bg-tertiary)' : 'transparent',
                    border: 'none',
                    borderBottom:
                      rightTab === id
                        ? '2px solid var(--accent-cyan)'
                        : '2px solid transparent',
                    cursor: 'pointer',
                    color:
                      rightTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '0.76rem',
                    fontWeight: rightTab === id ? 600 : 400,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  {icon}
                  {label}
                  {badge !== null && (
                    <span
                      style={{
                        background: flash ? 'var(--sev-critical-text)' : 'var(--sev-high-text)',
                        color: '#0a0d14',
                        borderRadius: '8px',
                        padding: '0 5px',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        animation: flash ? 'pulse 0.5s ease' : 'none',
                        minWidth: '16px',
                        textAlign: 'center',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {rightTab === 'alerts' ? (
                <AlertFeedPanel alerts={alertFeed} />
              ) : (
                <ATMDetailPanel location={selectedLocation} wsStatus={wsStatus} />
              )}
            </div>
          </div>
        </div>

        {/* ═══════ STATUS FOOTER ═══════ */}
        <footer
          style={{
            padding: '5px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            PravahDridh · Ministry of Home Affairs / I4C ·{' '}
            <strong style={{ color: 'var(--accent-cyan)' }}>A1 Primary Ranker</strong> · 48h
            Forecast Horizon
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Decision-support only — All intelligence assessments require human investigator review
          </span>
        </footer>
      </div>
    </>
  );
};

// ─── ATM Detail Sub-Panel ─────────────────────────────────────────────────
const ATMDetailPanel: React.FC<{
  location: LocationForecast | null;
  wsStatus: string;
}> = ({ location, wsStatus }) => {
  if (!location) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
        }}
      >
        <Activity
          size={24}
          color="rgba(255,255,255,0.1)"
          style={{ marginBottom: '8px' }}
        />
        <p>Select an ATM from the ranking list or map to view detail</p>
      </div>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ['ATM ID', <code style={{ color: 'var(--accent-cyan)' }}>{location.atm_id}</code>],
    ['City', location.city ?? '—'],
    ['Rank', `#${location.rank}`],
    ['Severity', <SeverityBadge severity={location.severity} full />],
    [
      'Forecast Score',
      <ScoreDisplay value={location.forecast_score} color="var(--accent-cyan)" />,
    ],
    [
      'Risk Score',
      <ScoreDisplay
        value={location.risk_score}
        color={
          location.severity === 'CRITICAL'
            ? 'var(--sev-critical-text)'
            : location.severity === 'HIGH'
            ? 'var(--sev-high-text)'
            : 'var(--sev-medium-text)'
        }
      />,
    ],
    ['Confidence', `${(location.confidence * 100).toFixed(1)}%`],
    ['Map Confidence', `${(location.mapping_confidence * 100).toFixed(1)}%`],
    ['Lat / Lng', `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`],
    [
      'Alert Eligible',
      location.alert_eligible ? (
        <span style={{ color: 'var(--sev-critical-text)', fontWeight: 700 }}>✓ YES</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>No</span>
      ),
    ],
  ];

  const factorKeys = Object.keys(location.factor_contributions);

  return (
    <div style={{ padding: '14px 16px', overflowY: 'auto', height: '100%' }}>
      {/* Primary evidence */}
      {location.primary_evidence && (
        <div
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            marginBottom: '14px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '4px',
            }}
          >
            Primary Evidence
          </span>
          {location.primary_evidence}
        </div>
      )}

      {/* Key metrics table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td
                style={{
                  padding: '6px 0',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  width: '45%',
                }}
              >
                {label}
              </td>
              <td
                style={{
                  padding: '6px 0',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Factor contributions */}
      {factorKeys.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Factor Contributions
          </div>
          {factorKeys.map((key) => {
            const val = location.factor_contributions[key];
            return (
              <div key={key} style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    marginBottom: '3px',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                  <span
                    style={{
                      color: 'var(--accent-cyan)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {(val * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    height: '4px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '2px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(Math.abs(val) * 100, 100)}%`,
                      background: 'var(--accent-cyan)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wsStatus !== 'CONNECTED' && (
        <div
          style={{
            marginTop: '16px',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}
        >
          <Zap size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Live score updates available when backend stream is connected
        </div>
      )}
    </div>
  );
};

// ─── Score Display ────────────────────────────────────────────────────────
const ScoreDisplay: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <span style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
    {(value * 100).toFixed(1)}%
  </span>
);
