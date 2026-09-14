/**
 * PravahDridh — Forecast Metadata Strip
 * Shows horizon, engine, latency, cutoff, and tracked ATMs from latest WS payload
 */
import React from 'react';
import { Clock, Cpu, Activity, Calendar } from 'lucide-react';
import { ForecastUpdatePayload } from '../../types/risk';

interface Props {
  payload: ForecastUpdatePayload | null;
  wsStatus: string;
}

function fmt(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso.slice(0, 16);
  }
}

export const ForecastMetaStrip: React.FC<Props> = ({ payload, wsStatus }) => {
  const items = [
    {
      icon: <Clock size={12} color="var(--accent-cyan)" />,
      label: 'Horizon',
      value: payload ? `${payload.forecast_horizon_hours}h` : '48h',
    },
    {
      icon: <Calendar size={12} color="var(--accent-cyan)" />,
      label: 'Forecast Window',
      value: payload
        ? `${fmt(payload.forecast_start)} → ${fmt(payload.forecast_end)}`
        : 'Awaiting stream',
    },
    {
      icon: <Activity size={12} color="var(--accent-cyan)" />,
      label: 'ATMs Tracked',
      value: payload ? String(payload.total_tracked_atms) : '—',
    },
    {
      icon: <Cpu size={12} color="var(--accent-cyan)" />,
      label: 'Engine',
      value: payload?.engine_version ?? 'A1 Statistical Ranker',
    },
    {
      icon: <Activity size={12} color="var(--text-muted)" />,
      label: 'Latency',
      value: payload ? `${payload.pipeline_latency_ms.toFixed(1)}ms` : '—',
    },
    {
      icon: <Clock size={12} color="var(--text-muted)" />,
      label: 'Last Update',
      value: payload ? fmt(payload.cutoff_time) : 'No data',
    },
    {
      icon: <Activity size={12} color={wsStatus === 'CONNECTED' ? '#34d399' : 'var(--text-muted)'} />,
      label: 'Live Stream',
      value: wsStatus,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '0',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {items.map(({ icon, label, value }, i) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRight: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {icon}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '2px' }}>
            {label}:
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color:
                label === 'Live Stream' && wsStatus === 'CONNECTED'
                  ? '#34d399'
                  : 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
};
