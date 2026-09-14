import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  AlertTriangle, 
  ArrowRight, 
  BrainCircuit, 
  Network, 
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  Layers
} from 'lucide-react';
import { mockPatterns, PatternRecord } from '../services/mockData';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const PatternDetection: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPattern, setSelectedPattern] = useState<PatternRecord | null>(mockPatterns[0]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
            BEHAVIORAL AI SURVEILLANCE
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Pattern Detection & Fraud Archetypes
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Automated discovery of structuring, money mule rings, burst velocities, and impossible travel patterns.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard/risk')}
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>View Risk Score Vectors</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Grid: List of Detected Patterns + Deep Dive Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Pattern Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mockPatterns.map((pat) => {
            const isSelected = selectedPattern?.id === pat.id;
            return (
              <div
                key={pat.id}
                onClick={() => setSelectedPattern(pat)}
                className="glass-panel"
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${pat.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                  backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'var(--bg-card)',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                        {pat.id}
                      </span>
                      <SeverityBadge severity={pat.riskLevel} />
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {pat.name}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CONFIDENCE</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                      {(pat.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                  {pat.explanation}
                </p>

                <div style={{ display: 'flex', gap: '18px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div>
                    Affected Entities: <strong style={{ color: 'var(--text-primary)' }}>{pat.affectedEntities} nodes</strong>
                  </div>
                  <div>
                    Flagged Transactions: <strong style={{ color: 'var(--text-primary)' }}>{pat.affectedTransactions} records</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Pattern Intelligence Breakdown */}
        {selectedPattern && (
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                PATTERN ARCHETYPE ANALYSIS
              </span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {selectedPattern.name}
              </h2>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Behavioral Signature
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedPattern.explanation}
              </p>
            </div>

            {/* Neural Evaluation Metrics */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Signal Distribution & Validation
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Temporal Burst Velocity', score: 92 },
                  { label: 'Terminal Location Proximity', score: 84 },
                  { label: 'Device/SIM Mismatch Frequency', score: 76 },
                ].map((sig, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{sig.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>{sig.score}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${sig.score}%`, background: 'var(--accent-cyan)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => navigate('/dashboard/graph')}
                className="btn btn-primary"
                style={{ padding: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Network size={16} />
                <span>Map Pattern in Knowledge Graph</span>
              </button>
              <button
                onClick={() => navigate('/dashboard/forecast')}
                className="btn btn-ghost"
                style={{ padding: '8px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <BrainCircuit size={16} color="var(--accent-cyan)" />
                <span>Predict Target Cash-out ATMs</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
