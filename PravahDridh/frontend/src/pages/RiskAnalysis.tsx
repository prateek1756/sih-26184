import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  ShieldAlert, 
  BrainCircuit, 
  Activity, 
  ArrowRight,
  TrendingUp,
  MapPin,
  Network
} from 'lucide-react';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const RiskAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'entity' | 'transaction' | 'network' | 'geographic'>('entity');

  const riskCategories = [
    { id: 'entity', label: 'Entity Risk', score: 89, level: 'CRITICAL' },
    { id: 'transaction', label: 'Transaction Risk', score: 82, level: 'HIGH' },
    { id: 'network', label: 'Network Risk', score: 91, level: 'CRITICAL' },
    { id: 'geographic', label: 'Geographic Risk', score: 76, level: 'HIGH' },
  ];

  const explainableSignals = [
    { name: 'Transaction Velocity Burst', weight: '35%', desc: '3 high-value outward withdrawals within 18 minutes', score: 94 },
    { name: 'Mule Ring Association', weight: '25%', desc: 'Direct link to 4 flagged bank accounts in NCR cybercrime complaints', score: 92 },
    { name: 'Geographic Terminal Anomaly', weight: '20%', desc: 'ATM withdrawal terminal differs from typical home cell tower', score: 81 },
    { name: 'Amount Splitting / Structuring', weight: '20%', desc: 'Amounts clustered just under ₹50,000 regulatory reporting threshold', score: 88 },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
            MULTI-LAYER RISK ENGINE
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Explainable Risk Scoring & Analytics
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-factor Bayesian scoring evaluating entity posture, fund velocities, network graphs, and spatial risks.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard/graph')}
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>Explore Knowledge Graph</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* 4 Core Risk Pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {riskCategories.map((c) => (
          <div
            key={c.id}
            onClick={() => setActiveTab(c.id as any)}
            className="glass-panel"
            style={{
              padding: '18px 20px',
              cursor: 'pointer',
              borderTop: activeTab === c.id ? '3px solid var(--accent-cyan)' : '3px solid transparent',
              backgroundColor: activeTab === c.id ? 'rgba(0, 212, 255, 0.08)' : 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{c.label}</span>
              <SeverityBadge severity={c.level as any} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {c.score}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Explainability Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Signal Weight Contribution */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Contributing Signal Breakdown (Why Score: 89/100?)
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Human-in-the-loop explainable AI decision support factors.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {explainableSignals.map((sig, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  borderLeft: '3px solid var(--accent-cyan)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sig.name}</span>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                      Weight: {sig.weight}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: sig.score > 90 ? '#ef4444' : '#f59e0b' }}>
                    {sig.score}/100
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sig.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action and Context */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
              SYSTEM RECOMMENDATION
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
              Immediate Action Required
            </h3>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
              <AlertTriangle size={16} />
              <span>Critical Mule Node Isolation</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Account SBIN-0442-8819 meets the criteria for immediate freeze notification to the partner bank nodal officer and rapid terminal surveillance.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
            <button
              onClick={() => navigate('/dashboard/forecast')}
              className="btn btn-primary"
              style={{ padding: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <BrainCircuit size={16} />
              <span>Forecast Probable Next Withdrawal ATM</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/investigations')}
              className="btn btn-ghost"
              style={{ padding: '8px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>Add Node to Case Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
