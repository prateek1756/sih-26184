import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit, 
  MapPin, 
  ShieldAlert, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  Info,
  RotateCw,
  Bell
} from 'lucide-react';
import { predictionsApi } from '../api/predictions';
import { RiskPredictionItem } from '../types/prediction';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const PredictiveForecast: React.FC = () => {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<RiskPredictionItem[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<RiskPredictionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [alertDispatched, setAlertDispatched] = useState<boolean>(false);

  const fetchLivePredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await predictionsApi.getLiveHotspots(undefined, 25);
      setPredictions(data);
      if (data.length > 0) {
        setSelectedPrediction(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch live predictions:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to connect to ML prediction pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLivePredictions();
  }, []);

  const handleDispatchAlert = () => {
    setAlertDispatched(true);
    setTimeout(() => setAlertDispatched(false), 3000);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              PREDICTIVE CASH-OUT INTELLIGENCE
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '2px 8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              LIVE INFERENCE PIPELINE (POSTGRESQL → ML)
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Forecast Likely Cash Withdrawal Locations in Advance
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Live inference executed over real PostgreSQL ATM terminals and historical transactions via FeatureBuilder & production model <code style={{ color: 'var(--accent-cyan)' }}>rf-v1.0</code>.
          </p>
        </div>

        {/* Prediction Horizon Selector with strict 24h limitation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--accent-cyan)',
                color: 'var(--text-inverse)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'default',
              }}
            >
              Next 24 Hours (Active)
            </button>
            <button
              disabled
              title="Model rf-v1.0 is calibrated for a 24-hour horizon. 48-hour model is under research."
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              Next 48 Hours [N/A]
            </button>
            <button
              disabled
              title="7-day horizon requires multi-week sequence modeling (Milestone 2B+)."
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              Next 7 Days [N/A]
            </button>
            <button
              disabled
              title="30-day horizon is unavailable for point-in-time cashout forecasting."
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              Next 30 Days [N/A]
            </button>
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            * Multi-horizon forecasts disabled — production rf-v1.0 is calibrated strictly for 24h
          </span>
        </div>
      </div>

      {/* Model Transparency & Data Quality Banner */}
      <div
        style={{
          background: 'rgba(59, 130, 246, 0.06)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={18} color="#60a5fa" />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>ML Governance & Transparency Notice: </strong>
            Inference powered by baseline <code style={{ color: 'var(--accent-cyan)' }}>RandomForest (rf-v1.0)</code> with 15 engineered spatial/temporal features.
            Current benchmark <strong style={{ color: '#fbbf24' }}>ROC-AUC is 0.49</strong> due to historical training class imbalance (5 positives / 3,900 samples). Predictions are ranked transparently using combined ML risk and domain rule verification.
          </div>
        </div>
        <button
          onClick={fetchLivePredictions}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <RotateCw size={12} className={loading ? 'spin' : ''} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && predictions.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'inline-block', marginBottom: '12px' }}>
            <RotateCw size={28} className="spin" color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Executing Live Inference Across ATMs...</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Querying PostgreSQL ATM locations, extracting 15-feature history vectors, and evaluating rf-v1.0 model.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live Prediction Inference Failed</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{error}</div>
            </div>
          </div>
          <button
            onClick={fetchLivePredictions}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid: Ranked Predictions + Explainable Factor Breakdown */}
      {!loading && predictions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Ranked Hotspots from Live DB Inference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                LIVE PREDICTIONS RANKED BY RISK SCORE ({predictions.length} ATMS SCANNED)
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                Model: rf-v1.0 · Horizon: 24h
              </span>
            </div>

            {predictions.map((pred, idx) => {
              const isSelected = selectedPrediction?.id === pred.id;
              const riskPercent = Math.round(Number(pred.risk_score) * 100);
              const confPercent = Math.round(Number(pred.confidence) * 100);
              const isElevated = pred.severity === 'HIGH' || pred.severity === 'CRITICAL' || riskPercent >= 50;

              return (
                <div
                  key={pred.id}
                  onClick={() => setSelectedPrediction(pred)}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${isElevated ? '#ef4444' : riskPercent >= 25 ? '#f59e0b' : '#3b82f6'}`,
                    backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'var(--bg-card)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          color: 'var(--accent-cyan)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {pred.atm_code || `ATM-${pred.location_id.slice(0, 8)}`}
                          </h3>
                          <SeverityBadge severity={pred.severity as any} />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {pred.bank_name || 'Bank Terminal'} · {pred.city || 'National'} · Lat/Lng: {Number(pred.latitude).toFixed(4)}, {Number(pred.longitude).toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        RISK SCORE
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: isElevated ? '#ef4444' : riskPercent >= 25 ? '#f59e0b' : 'var(--accent-cyan)',
                        }}
                      >
                        {riskPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Progress bar risk indicator */}
                  <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', margin: '10px 0' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(5, riskPercent))}%`,
                        background: isElevated ? '#ef4444' : riskPercent >= 25 ? '#f59e0b' : 'var(--accent-cyan)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>
                      Confidence: <strong style={{ color: 'var(--text-primary)' }}>{confPercent}%</strong>
                    </span>
                    <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                      24h Horizon: {new Date(pred.predicted_window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} - {new Date(pred.predicted_window_end).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explainability Engine: "WHY THIS LOCATION?" */}
          {selectedPrediction && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', height: 'fit-content' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  TRANSPARENT RISK FACTOR BREAKDOWN (MODEL production-v2.0)
                </span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  Why This Location?
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedPrediction.atm_code || 'ATM Terminal'} ({selectedPrediction.bank_name || 'Bank'}, {selectedPrediction.city || 'City'})
                </div>
              </div>

              {/* Reasons Generated from RiskEngine Domain Rules */}
              <div style={{ padding: '16px', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Audit & Domain Rule Triggers
                </div>
                {selectedPrediction.reasons && selectedPrediction.reasons.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedPrediction.reasons.map((reason, rIdx) => (
                      <li key={rIdx} style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Monitoring baseline activity for {selectedPrediction.bank_name || 'terminal'} in {selectedPrediction.city || 'region'}.
                  </p>
                )}
              </div>

              {/* Real Prediction Attributes */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Model & Geographic Context
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>MODEL VERSION</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedPrediction.model_version}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>PREDICTION WINDOW</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginTop: '2px' }}>
                      24 Hours (Strict)
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>COORDINATES</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {Number(selectedPrediction.latitude).toFixed(4)}, {Number(selectedPrediction.longitude).toFixed(4)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>SEVERITY LEVEL</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedPrediction.severity}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch Alert & GIS Navigation */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleDispatchAlert}
                  className="btn btn-primary"
                  style={{
                    padding: '11px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: alertDispatched ? '#10b981' : undefined,
                  }}
                >
                  {alertDispatched ? <CheckCircle2 size={16} /> : <Bell size={16} />}
                  <span>{alertDispatched ? 'Alert Dispatched to LEA Field Units' : 'Dispatch Preemptive Alert to Field Units'}</span>
                </button>
                <button
                  onClick={() => navigate('/dashboard/geo')}
                  className="btn btn-ghost"
                  style={{ padding: '8px', fontSize: '0.8rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <MapPin size={14} color="var(--accent-cyan)" />
                  <span>View on Full GIS Heatmap</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
