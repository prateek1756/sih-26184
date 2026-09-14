import React from 'react';
import { WebSocketStatus } from '../../hooks/useRiskWebSocket';

interface StatusIndicatorProps {
  status: WebSocketStatus;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'CONNECTED':
        return {
          color: '#10b981',
          label: 'STREAM LIVE',
          pulse: true,
        };
      case 'CONNECTING':
        return {
          color: '#f59e0b',
          label: 'CONNECTING...',
          pulse: true,
        };
      case 'ERROR':
        return {
          color: '#ef4444',
          label: 'STREAM ERROR',
          pulse: false,
        };
      case 'DISCONNECTED':
      default:
        return {
          color: '#64748b',
          label: 'OFFLINE',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.7rem',
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        color: config.color,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          boxShadow: `0 0 8px ${config.color}`,
        }}
      />
      {config.label}
    </div>
  );
};
