/**
 * PravahDridh — GIS Forecast Map (Dynamic Tactical Edition)
 *
 * Dynamic Features:
 *   1. Pulsing multi-ring sonar markers with animated target reticle locking
 *   2. Real-time simulated cash-out / mule transaction burst pings with floating badges
 *   3. Rotating tactical radar sweep scanner overlay (toggleable)
 *   4. Animated threat hazard perimeter buffer zones (breathing opacity & rotating dashes)
 *   5. Smooth auto-fly transition to selected ATM on ranking click
 *   6. Floating glassmorphism HUD telemetry bar & simulation controls
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Popup, Marker, CircleMarker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radar, Zap, RotateCcw, ShieldAlert, Radio, Activity, Eye, EyeOff } from 'lucide-react';
import { ATMGeoJSONFeatureCollection } from '../../types/geo';
import { LocationForecast, SeverityLevel } from '../../types/risk';

// Fix Leaflet's default icon path issue in Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEV_COLOR: Record<SeverityLevel, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

// ── Custom Dynamic Pulsing HTML Marker ─────────────────────────────────────────
function createPulsingMarkerIcon(rank: number, severity: SeverityLevel, isSelected: boolean) {
  const color = SEV_COLOR[severity] || '#ef4444';
  return L.divIcon({
    className: 'tactical-marker-parent',
    html: `
      <div class="tactical-marker-pin ${isSelected ? 'selected' : ''}">
        <div class="sonar-ring ring-1" style="border-color: ${color}"></div>
        <div class="sonar-ring ring-2" style="border-color: ${color}"></div>
        ${isSelected ? '<div class="target-reticle"></div>' : ''}
        <div class="core-dot" style="background-color: ${color}; box-shadow: 0 0 14px ${color}">
          <span class="rank-num">#${rank}</span>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

// ── Live Ping Interface & Icon ────────────────────────────────────────────────
interface LivePing {
  id: string;
  atmId: string;
  lat: number;
  lng: number;
  amount: number;
  label: string;
  severity: SeverityLevel;
}

function createPingIcon(ping: LivePing) {
  const formattedAmount = `₹${ping.amount.toLocaleString('en-IN')}`;
  return L.divIcon({
    className: 'live-ping-parent',
    html: `
      <div class="live-ping-container">
        <div class="ping-shockwave" style="border-color: ${SEV_COLOR[ping.severity]}"></div>
        <div class="ping-badge" style="border-color: ${SEV_COLOR[ping.severity]}; box-shadow: 0 0 16px ${SEV_COLOR[ping.severity]}aa">
          <span class="ping-icon">⚡</span>
          <span class="ping-text">${ping.atmId} · ${formattedAmount} ${ping.label}</span>
        </div>
      </div>
    `,
    iconSize: [240, 40],
    iconAnchor: [120, 20],
  });
}

// ── Smooth Map Flight Handler ────────────────────────────────────────────────
function MapController({
  targetLocation,
  onHoverCoords,
}: {
  targetLocation: { lat: number; lng: number } | null;
  onHoverCoords: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (targetLocation) {
      const key = `${targetLocation.lat.toFixed(4)},${targetLocation.lng.toFixed(4)}`;
      if (lastTarget.current !== key) {
        lastTarget.current = key;
        map.flyTo([targetLocation.lat, targetLocation.lng], 14, {
          animate: true,
          duration: 1.2,
        });
      }
    }
  }, [targetLocation, map]);

  useMapEvents({
    mousemove(e) {
      onHoverCoords(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

interface Props {
  atmGeoJSON: ATMGeoJSONFeatureCollection | null;
  forecastLocations: LocationForecast[];
  selectedAtmId: string | null;
  onSelectAtm: (atmId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]; // Delhi NCR focus

export const ForecastMap: React.FC<Props> = ({
  atmGeoJSON,
  forecastLocations,
  selectedAtmId,
  onSelectAtm,
}) => {
  // HUD and dynamic feature toggles
  const [showRadar, setShowRadar] = useState(true);
  const [showThreatZones, setShowThreatZones] = useState(true);
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);
  const [livePings, setLivePings] = useState<LivePing[]>([]);
  const [lastInterceptMsg, setLastInterceptMsg] = useState<string>('Surveillance stream initialized · Listening for mule burst activity...');
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number }>({ lat: 28.7041, lng: 77.1025 });

  const forecastIndex = useMemo(
    () => new Map(forecastLocations.map((l) => [l.atm_id, l])),
    [forecastLocations]
  );

  // Selected or top-1 location for centering
  const activeLocation = useMemo(() => {
    if (selectedAtmId) {
      const found = forecastIndex.get(selectedAtmId);
      if (found) return { lat: found.latitude, lng: found.longitude };
      // Check in base geojson
      const geoFeature = atmGeoJSON?.features.find((f) => f.properties.atm_code === selectedAtmId);
      if (geoFeature) return { lat: geoFeature.geometry.coordinates[1], lng: geoFeature.geometry.coordinates[0] };
    }
    if (forecastLocations.length > 0) {
      return { lat: forecastLocations[0].latitude, lng: forecastLocations[0].longitude };
    }
    return null;
  }, [selectedAtmId, forecastLocations, forecastIndex, atmGeoJSON]);

  // ── Manual or Automated Burst Ping Generator ──────────────────────────────
  const triggerBurstPing = useCallback((targetLoc?: LocationForecast) => {
    if (forecastLocations.length === 0) return;
    const loc = targetLoc || forecastLocations[Math.floor(Math.random() * Math.min(3, forecastLocations.length))];
    if (!loc) return;

    const burstLabels = [
      'RAPID CASH DRAIN',
      'MULE CLUSTER SPIKE',
      'UPI P2P WITHDRAWAL',
      'STRUCTURED CASH-OUT',
      'CROSS-BORDER HOP',
    ];
    const amounts = [20000, 35000, 48000, 25000, 50000, 75000];
    const chosenAmount = amounts[Math.floor(Math.random() * amounts.length)];
    const chosenLabel = burstLabels[Math.floor(Math.random() * burstLabels.length)];

    const newPing: LivePing = {
      id: `ping-${Date.now()}-${Math.random()}`,
      atmId: loc.atm_id,
      lat: loc.latitude + (Math.random() - 0.5) * 0.003, // Slight jitter
      lng: loc.longitude + (Math.random() - 0.5) * 0.003,
      amount: chosenAmount,
      label: chosenLabel,
      severity: loc.severity,
    };

    setLivePings((prev) => [...prev.slice(-3), newPing]);
    setLastInterceptMsg(
      `⚡ Intercepted: ₹${chosenAmount.toLocaleString('en-IN')} ${chosenLabel} at ${loc.atm_id} (${loc.city || 'Delhi NCR'})`
    );

    // Auto cleanup after 3.2s
    setTimeout(() => {
      setLivePings((prev) => prev.filter((p) => p.id !== newPing.id));
    }, 3200);
  }, [forecastLocations]);

  // ── Periodic Ingestion Simulator ──────────────────────────────────────────
  useEffect(() => {
    if (!isLiveSimulating) return;

    // Trigger an initial ping shortly after mount
    const initialTimer = setTimeout(() => {
      triggerBurstPing();
    }, 1500);

    const interval = setInterval(() => {
      triggerBurstPing();
    }, 4500);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isLiveSimulating, triggerBurstPing]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* ── MAP CONTAINER ─────────────────────────────────────────────────── */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#0a0d14' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* OpenStreetMap Standard Tiles (inverted to dark cyber mode in CSS) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Dynamic Map Controller for auto-flight & telemetry */}
        <MapController
          targetLocation={activeLocation}
          onHoverCoords={(lat, lng) => setHoverCoords({ lat, lng })}
        />

        {/* ── THREAT HAZARD BUFFER PERIMETERS ───────────────────────────────── */}
        {showThreatZones &&
          forecastLocations
            .filter((loc) => loc.severity === 'CRITICAL' || loc.severity === 'HIGH')
            .map((loc) => {
              const isCrit = loc.severity === 'CRITICAL';
              const radius = isCrit ? 1600 : 1000;
              const color = SEV_COLOR[loc.severity];

              return (
                <Circle
                  key={`hazard-${loc.atm_id}`}
                  center={[loc.latitude, loc.longitude]}
                  radius={radius}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: isCrit ? 0.15 : 0.09,
                    weight: 1.5,
                    dashArray: '6, 8',
                  }}
                />
              );
            })}

        {/* ── BASE ATMS LAYER (Unranked Terminals) ─────────────────────────── */}
        {atmGeoJSON?.features.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const atmId = feature.properties.atm_code;
          const forecast = forecastIndex.get(atmId);

          // If ranked, it is rendered below with pulsing effects
          if (forecast) return null;

          return (
            <CircleMarker
              key={atmId}
              center={[lat, lng]}
              radius={4}
              pathOptions={{
                color: '#334155',
                fillColor: '#475569',
                fillOpacity: 0.6,
                weight: 1,
              }}
              eventHandlers={{ click: () => onSelectAtm(atmId) }}
            >
              <Popup>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#f1f5f9', background: '#0f1523', padding: '4px' }}>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{atmId}</strong>
                  <br />
                  {feature.properties.bank_name}
                  <br />
                  {feature.properties.city}, {feature.properties.state}
                  <br />
                  <span style={{ color: '#64748b' }}>Status: Nominal / Unflagged</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* ── DYNAMIC RANKED ATMS (Pulsing Sonar Markers) ──────────────────── */}
        {forecastLocations.map((loc) => {
          const isSelected = loc.atm_id === selectedAtmId;
          const customIcon = createPulsingMarkerIcon(loc.rank, loc.severity, isSelected);

          return (
            <Marker
              key={loc.atm_id}
              position={[loc.latitude, loc.longitude]}
              icon={customIcon}
              eventHandlers={{ click: () => onSelectAtm(loc.atm_id) }}
            >
              <Popup>
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    minWidth: '220px',
                    color: '#f1f5f9',
                    background: '#0a0e1a',
                    padding: '8px',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, color: SEV_COLOR[loc.severity] }}>
                      RANK #{loc.rank} · {loc.atm_id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: `${SEV_COLOR[loc.severity]}22`,
                        color: SEV_COLOR[loc.severity],
                        border: `1px solid ${SEV_COLOR[loc.severity]}55`,
                      }}
                    >
                      {loc.severity}
                    </span>
                  </div>

                  {loc.city && (
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '8px' }}>
                      Terminal Zone: {loc.city}
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', marginBottom: '8px' }}>
                    <tbody>
                      {[
                        ['Forecast Prob.', `${(loc.forecast_score * 100).toFixed(1)}%`],
                        ['Risk Score', `${(loc.risk_score).toFixed(0)} / 100`],
                        ['Confidence', `${(loc.confidence * 100).toFixed(1)}%`],
                        ['Mule Proximity', loc.factor_contributions?.mule_proximity ? `${(loc.factor_contributions.mule_proximity * 100).toFixed(0)}%` : 'Elevated'],
                        ['Alert Protocol', loc.alert_eligible ? 'CRITICAL DISPATCH' : 'MONITORING'],
                      ].map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ color: '#64748b', padding: '3px 0' }}>{k}</td>
                          <td style={{ color: '#f1f5f9', fontWeight: 600, textAlign: 'right' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {loc.primary_evidence && (
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: '#cbd5e1',
                        borderLeft: `2px solid ${SEV_COLOR[loc.severity]}`,
                        paddingLeft: '6px',
                        margin: '6px 0 8px 0',
                        fontStyle: 'italic',
                      }}
                    >
                      {loc.primary_evidence}
                    </div>
                  )}

                  <button
                    onClick={() => triggerBurstPing(loc)}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '4px',
                      color: '#f87171',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <Zap size={12} /> Simulate Cash-Out Burst
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── LIVE SIMULATED TRANSACTION BURSTS (Dynamic Pings) ───────────── */}
        {livePings.map((ping) => (
          <Marker
            key={ping.id}
            position={[ping.lat, ping.lng]}
            icon={createPingIcon(ping)}
            interactive={false}
          />
        ))}
      </MapContainer>

      {/* ── RADAR SCANNER OVERLAY (Rotating Conical Beam) ─────────────────── */}
      {showRadar && (
        <div className="radar-sweep-container">
          <div className="radar-sweep-beam" />
          <div className="radar-grid-crosshair" />
        </div>
      )}

      {/* ── TOP HUD BAR (Interactive Map Controls) ────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Left Status Pill */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(10, 14, 26, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isLiveSimulating ? '#10b981' : '#f59e0b',
                boxShadow: isLiveSimulating ? '0 0 10px #10b981' : 'none',
                display: 'inline-block',
                animation: isLiveSimulating ? 'pulse 1.8s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
              GIS LIVE SURVEILLANCE
            </span>
          </div>

          <span style={{ height: '14px', width: '1px', background: 'var(--border-subtle)' }} />

          <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {forecastLocations.length} TARGETS MONITORED
          </span>
        </div>

        {/* Right Tactical Action Controls */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: '6px',
            background: 'rgba(10, 14, 26, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '4px 6px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Radar Sweep Toggle */}
          <button
            onClick={() => setShowRadar((v) => !v)}
            title="Toggle Radar Sweep Beam"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: showRadar ? 'rgba(0, 212, 255, 0.4)' : 'transparent',
              background: showRadar ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
              color: showRadar ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Radar size={13} />
            Radar {showRadar ? 'ON' : 'OFF'}
          </button>

          {/* Threat Zones Toggle */}
          <button
            onClick={() => setShowThreatZones((v) => !v)}
            title="Toggle Threat Perimeters"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: showThreatZones ? 'rgba(239, 68, 68, 0.4)' : 'transparent',
              background: showThreatZones ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: showThreatZones ? '#f87171' : 'var(--text-muted)',
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ShieldAlert size={13} />
            Zones
          </button>

          {/* Live Ingestion Toggle */}
          <button
            onClick={() => setIsLiveSimulating((v) => !v)}
            title="Toggle Real-time Transaction Simulator"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: isLiveSimulating ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
              background: isLiveSimulating ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: isLiveSimulating ? '#34d399' : 'var(--text-muted)',
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Radio size={13} />
            {isLiveSimulating ? 'Live Feed' : 'Paused'}
          </button>

          {/* Trigger Burst Immediate Action */}
          <button
            onClick={() => triggerBurstPing()}
            title="Simulate Immediate Cash-Out Intercept"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(249, 115, 22, 0.3))',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Zap size={13} color="#fbbf24" />
            + Burst
          </button>
        </div>
      </div>

      {/* ── BOTTOM TELEMETRY STRIP ────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          zIndex: 500,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(10, 14, 26, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          padding: '6px 12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Activity size={13} color="#00d4ff" />
          <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: '#cbd5e1' }}>
            {lastInterceptMsg}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            RETICLE: <span style={{ color: '#00d4ff' }}>{hoverCoords.lat.toFixed(4)}°N</span>,{' '}
            <span style={{ color: '#00d4ff' }}>{hoverCoords.lng.toFixed(4)}°E</span>
          </span>
        </div>
      </div>
    </div>
  );
};
