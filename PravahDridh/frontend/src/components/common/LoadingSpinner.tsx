import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading Intelligence Feed...',
  size = 'md',
}) => {
  const sizePixels = size === 'sm' ? 18 : size === 'lg' ? 40 : 28;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: `${sizePixels}px`,
          height: `${sizePixels}px`,
          borderRadius: '50%',
          border: '2px solid rgba(0, 212, 255, 0.15)',
          borderTopColor: 'var(--accent-cyan)',
          animation: 'hermes-spin 0.8s linear infinite',
        }}
      />
      {message && (
        <span
          style={{
            fontSize: '0.8rem',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.05em',
          }}
        >
          {message}
        </span>
      )}
      <style>{`
        @keyframes hermes-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
