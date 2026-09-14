/**
 * GeographicIntelligence.tsx — SIH PS 26184
 *
 * Connects to /api/v1/predictions/hotspots/live (RandomForest-v2.0 Calibrated)
 * and /api/v1/risk/ws for real-time forecast updates.
 * Zero mock data — all risk locations are produced by the production ML model.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  BrainCircuit,
  Network,
  RefreshCw,
  WifiOff,
  Wifi,
  AlertTriangle,
  Loader2,
  Clock,
  Radio,
} from 'lucide-react';
import { predictionsApi } from '../api/predictions';
import { useRiskWebSocket } from '../hooks/useRiskWebSocket';
import { RiskPredictionItem } from '../types/prediction';
import { LocationForecast, ForecastUpdatePayload } from '../types/risk';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ForecastMap } from '../components/map/ForecastMap';

// ─── Severity border colours ──────────────────────────────────────────────────
const SEV_BORDER: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

// ─── Convert RiskPredictionItem → LocationForecast (ForecastMap contract) ────
function toLocationForecast(p: RiskPredictionItem, rank: number): LocationForecast {
  return {
    rank,
    atm_id: p.atm_code || p.location_id,
    city: p.city || null,
    latitude: p.latitude,
    longitude: p.longitude,
    forecast_score: p.risk_score,
    risk_score: p.risk_score,
    confidence: p.confidence,
    mapping_confidence: 0.95,
    severity: p.severity,
    alert_eligible: p.severity === 'HIGH' || p.severity === 'CRITICAL',
    primary_evidence: p.reasons?.[0] || `ML risk score: ${(p.risk_score * 100).toFixed(1)}%`,
    factor_contributions: {},
  };
}

// ─── Format ISO timestamp for display ─────────────────────────────────────────
function fmtWindow(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const hrs = Math.round((e.getTime() - s.getTime()) / 3600000);
    return `Next ${hrs}h window`;
  } catch {
    return 'Next 24h window';
  }
}

// ─── Stale data threshold: predictions older than 6h are "stale" ──────────────
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

// ─── WebSocket status indicator ───────────────────────────────────────────────
const WsIndicator: React.FC<{ status: string }> = ({ status }) => {
  const configs: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    CONNECTED: { icon: <Wifi size={10} />, label: 'Live', color: '#10b981' },
    CONNECTING: { icon: <Loader2 size={10} className="spin-slow" />, label: 'Connecting…', color: '#f59e0b' },
    DISCONNECTED: { icon: <WifiOff size={10} />, label: 'Offline', color: '#6b7280' },
    ERROR: { icon: <WifiOff size={10} />, label: 'WS Error', color: '#ef4444' },
  };
  const cfg = configs[status] || configs.DISCONNECTED;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.65rem',
        color: cfg.color,
        fontFamily: 'JetBrains Mono, monospace',
        border: `1px solid ${cfg.color}`,
        borderRadius: '3px',
        padding: '1px 6px',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const GeographicIntelligence: React.FC = () => {
  const navigate = useNavigate();

  // Predictions state
  const [predictions, setPredictions] = useState<RiskPredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [riskMode, setRiskMode] = useState<'ALL' | 'PREDICTED' | 'HISTORICAL'>('PREDICTED');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real predictions from backend
  const fetchPredictions = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const city = cityFilter.trim() || undefined;
      const data = await predictionsApi.getLiveHotspots(city, 50);
      setPredictions(data);
      setLastFetched(new Date());
      // Auto-select highest risk prediction
      if (data.length > 0) {
        setSelectedId((prev) => prev || (data[0].atm_code || data[0].location_id));
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions from backend.');
      setPredictions([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [cityFilter]);

  // Initial load + refresh on cityFilter change
  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  // WebSocket: receive real-time forecast pushes and merge top_locations
  const handleForecastUpdate = useCallback((payload: ForecastUpdatePayload) => {
    if (!payload.top_locations?.length) return;
    // Merge WS top_locations back into our prediction list format
    const wsItems: RiskPredictionItem[] = payload.top_locations.map((loc) => ({
      id: `ws-${loc.atm_id}-${payload.event_id}`,
      model_version: payload.engine_version || 'v2.0',
      location_id: loc.atm_id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      risk_score: loc.risk_score,
      severity: loc.severity,
      confidence: loc.confidence,
      predicted_window_start: payload.forecast_start,
      predicted_window_end: payload.forecast_end,
      reasons: [loc.primary_evidence],
      is_active: true,
      predicted_at: payload.cutoff_time,
      atm_code: loc.atm_id,
      bank_name: undefined,
      city: loc.city || undefined,
    }));

    setPredictions((prev) => {
      // Replace existing entries by atm_id, or append new ones; then re-sort
      const existingIds = new Set(wsItems.map((w) => w.location_id));
      const kept = prev.filter((p) => !existingIds.has(p.location_id));
      return [...wsItems, ...kept].sort((a, b) => b.risk_score - a.risk_score).slice(0, 50);
    });
    setLastFetched(new Date());
  }, []);

  const { status: wsStatus, error: wsError } = useRiskWebSocket({
    enabled: true,
    onForecastUpdate: handleForecastUpdate,
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const isStale = lastFetched
    ? Date.now() - lastFetched.getTime() > STALE_THRESHOLD_MS
    : false;

  const selectedPrediction = useMemo(
    () => predictions.find((p) => (p.atm_code || p.location_id) === selectedId) || predictions[0] || null,
    [predictions, selectedId]
  );

  // Build LocationForecast[] for ForecastMap
  const forecastLocations: LocationForecast[] = useMemo(
    () => predictions.map((p, i) => toLocationForecast(p, i + 1)),
    [predictions]
  );

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderSidebar = () => {
    if (loading) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.8rem' }}>Running ML inference…</span>
          <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', opacity: 0.6 }}>RandomForest-v2.0 (Calibrated)</span>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px', textAlign: 'center' }}>
          <AlertTriangle size={30} color="#ef4444" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{error}</span>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => fetchPredictions()}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      );
    }

    if (predictions.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center' }}>
          <MapPin size={28} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>No Risk Locations</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            The production model found no ATMs exceeding the risk threshold at this time.
            {cityFilter && ` (Filter: "${cityFilter}")`}
          </span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '5px 12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => { setCityFilter(''); fetchPredictions(); }}
          >
            <RefreshCw size={12} /> Clear Filter &amp; Refresh
          </button>
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Count + stale badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
            RANKED RISK ATMs ({predictions.length})
          </span>
          {isStale && (
            <span style={{ fontSize: '0.62rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={9} /> Stale
            </span>
          )}
        </div>

        {predictions.map((p, idx) => {
          const atmKey = p.atm_code || p.location_id;
          const isSelected = selectedId === atmKey || (!selectedId && idx === 0);
          const riskPct = Math.round(p.risk_score * 100);
          return (
            <div
              key={p.id}
              onClick={() => setSelectedId(atmKey)}
              className="glass-panel"
              style={{
                padding: '13px 15px',
                cursor: 'pointer',
                borderLeft: `4px solid ${SEV_BORDER[p.severity] || '#6b7280'}`,
                backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.09)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.atm_code || `ATM-${String(p.location_id).slice(0, 8).toUpperCase()}`}
                  </span>
                </div>
                <SeverityBadge severity={p.severity} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                <span>{p.bank_name || '—'}{p.city ? ` · ${p.city}` : ''}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Risk: {riskPct}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', color: 'var(--accent-cyan)', marginTop: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                <span>{fmtWindow(p.predicted_window_start, p.predicted_window_end)}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Conf: {Math.round(p.confidence * 100)}%
                </span>
              </div>

              {/* Primary reason */}
              {p.reasons?.[0] && (
                <div style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.4, borderTop: '1px solid var(--border-subtle)', paddingTop: '5px' }}>
                  {p.reasons[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Detail panel for selected prediction ─────────────────────────────────────
  const renderDetailPanel = () => {
    if (!selectedPrediction) return null;
    const sp = selectedPrediction;
    const riskPct = Math.round(sp.risk_score * 100);
    const confPct = Math.round(sp.confidence * 100);
    return (
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: '640px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
              PREDICTIVE WITHDRAWAL RATIONALE
            </span>
            <SeverityBadge severity={sp.severity} />
            <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
              model: {sp.model_version}
            </span>
          </div>

          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {sp.atm_code || `ATM ${String(sp.location_id).slice(0, 8).toUpperCase()}`}
            {sp.bank_name ? ` — ${sp.bank_name}` : ''}
            {sp.city ? `, ${sp.city}` : ''}
          </h4>

          {/* Key metrics row */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Risk Score: <strong style={{ color: SEV_BORDER[sp.severity] }}>{riskPct}%</strong></span>
            <span>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{confPct}%</strong></span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--accent-cyan)' }}>
              {fmtWindow(sp.predicted_window_start, sp.predicted_window_end)}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {sp.latitude.toFixed(5)}, {sp.longitude.toFixed(5)}
            </span>
          </div>

          {/* All evidence reasons */}
          {sp.reasons?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {sp.reasons.slice(0, 4).map((r, i) => (
                <p key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  <span style={{ color: 'var(--accent-cyan)', marginRight: '5px' }}>›</span>{r}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'flex-start', paddingTop: '4px' }}>
          <button
            onClick={() => navigate('/dashboard/forecast')}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <BrainCircuit size={13} />
            <span>Forecast Timeline</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/graph')}
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '8px 13px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Network size={13} color="var(--accent-cyan)" />
            <span>Mule Network</span>
          </button>
        </div>
      </div>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: 'var(--bg-primary)' }}>
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: '380px',
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
              GIS SPATIAL SURVEILLANCE
            </span>
            <WsIndicator status={wsStatus} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            Geographic Risk &amp; Heatmaps
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
            ML-predicted ATM cash-drain zones · RandomForest-v2.0 (Calibrated)
          </p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
            {[
              { id: 'PREDICTED', label: 'Predicted Risk' },
              { id: 'HISTORICAL', label: 'Historical' },
              { id: 'ALL', label: 'Fused Layer' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setRiskMode(m.id as typeof riskMode)}
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: riskMode === m.id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  background: riskMode === m.id ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                  color: riskMode === m.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* City filter + refresh */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="Filter by city…"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPredictions()}
              style={{
                flex: 1,
                padding: '5px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.73rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => fetchPredictions(true)}
              disabled={isRefreshing || loading}
              title="Refresh predictions"
              style={{
                padding: '5px 9px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* Last updated */}
          {lastFetched && (
            <div style={{ fontSize: '0.62rem', color: isStale ? '#f59e0b' : 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={9} />
              Updated {lastFetched.toLocaleTimeString()}
              {isStale && ' · Data may be stale — refresh recommended'}
            </div>
          )}

          {wsError && (
            <div style={{ fontSize: '0.62rem', color: '#f59e0b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <WifiOff size={9} /> {wsError}
            </div>
          )}
        </div>

        {/* Prediction list or state views */}
        {renderSidebar()}
      </div>

      {/* CENTER: GIS Map */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <ForecastMap
            atmGeoJSON={null}
            forecastLocations={forecastLocations}
            selectedAtmId={
              selectedPrediction
                ? (selectedPrediction.atm_code || selectedPrediction.location_id)
                : null
            }
            onSelectAtm={(atmId) => {
              const found = predictions.find(
                (p) => (p.atm_code || p.location_id) === atmId
              );
              if (found) setSelectedId(found.atm_code || found.location_id);
            }}
          />

          {/* Map overlay: PREDICTED label / HISTORICAL placeholder */}
          {riskMode === 'HISTORICAL' && !loading && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(10,14,26,0.85)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '20px 28px',
                textAlign: 'center',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              <Radio size={24} color="var(--accent-cyan)" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Historical Layer
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Historical heatmap requires complaint &amp; incident data ingestion.
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM: Selected prediction detail */}
        {renderDetailPanel()}
      </div>
    </div>
  );
};
