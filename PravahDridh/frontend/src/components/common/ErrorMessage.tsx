import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Backend Communication Failure',
  message,
  onRetry,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        borderLeft: '4px solid var(--sev-critical-text)',
        margin: '16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <AlertCircle size={22} color="var(--sev-critical-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {title}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn btn-secondary"
              style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} />
              Retry Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
