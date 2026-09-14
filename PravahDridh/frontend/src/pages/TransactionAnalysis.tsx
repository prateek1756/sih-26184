import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  ChevronRight, 
  AlertTriangle, 
  ExternalLink, 
  Network, 
  MapPin, 
  BrainCircuit, 
  X,
  CreditCard,
  Building,
  Clock,
  CheckCircle,
  ShieldAlert,
  Share2,
  FileSpreadsheet,
  ArrowUpRight,
  Filter,
  Loader2,
  Info,
  Layers,
  Send,
  Bell
} from 'lucide-react';
import { 
  transactionsApi, 
  TransactionAnalysisResponse, 
  TransactionItem,
  SuspiciousIndicator,
  InvestigativeRecommendation,
  alertsApi
} from '../api';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const TransactionAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertIdParam = searchParams.get('alert_id') || undefined;
  const predictionIdParam = searchParams.get('prediction_id') || undefined;

  // Analysis State
  const [data, setData] = useState<TransactionAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [selectedTxn, setSelectedTxn] = useState<TransactionItem | null>(null);

  // Relay Modal state
  const [showRelayModal, setShowRelayModal] = useState(false);
  const [relaySuccess, setRelaySuccess] = useState(false);

  // Available alerts for quick switcher
  const [availableAlerts, setAvailableAlerts] = useState<Array<{ id: string; severity: string; atm: string }>>([]);

  // Load available alerts for investigator selector
  useEffect(() => {
    alertsApi.listAlerts(1, 10).then((res) => {
      setAvailableAlerts(
        res.items.map((a) => ({
          id: a.id,
          severity: a.severity,
          atm: a.prediction?.atm_code || a.prediction?.bank_name || 'ATM Node',
        }))
      );
    }).catch((err) => console.warn('Could not load alerts list:', err));
  }, []);

  // Fetch Transaction Intelligence
  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await transactionsApi.analyze({
        alert_id: alertIdParam,
        prediction_id: predictionIdParam,
        transaction_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        min_amount: minAmount ? parseFloat(minAmount) : undefined,
        page: 1,
        per_page: 100,
        sort_by: 'occurred_at',
        sort_order: 'desc',
      });
      setData(res);
      if (res.transactions.length > 0) {
        setSelectedTxn(res.transactions[0]);
      } else {
        setSelectedTxn(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve transaction intelligence from PostgreSQL.');
    } finally {
      setLoading(false);
    }
  }, [alertIdParam, predictionIdParam, typeFilter, minAmount]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Client-side text filter on the retrieved evidence set
  const filteredTransactions = (data?.transactions || []).filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.id.toLowerCase().includes(term) ||
      (t.source_account_masked && t.source_account_masked.toLowerCase().includes(term)) ||
      (t.bank_name && t.bank_name.toLowerCase().includes(term)) ||
      (t.destination_atm_code && t.destination_atm_code.toLowerCase().includes(term)) ||
      (t.complaint_number && t.complaint_number.toLowerCase().includes(term))
    );
  });

  const handleAlertSelect = (newAlertId: string) => {
    setSearchParams({ alert_id: newAlertId });
  };

  const handleSimulateRelay = () => {
    setRelaySuccess(true);
    setTimeout(() => {
      setRelaySuccess(false);
      setShowRelayModal(false);
    }, 1800);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1500px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              PHASE 4 · REAL TRANSACTION FORENSICS
            </span>
            {data?.context.alert_id && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                / ALT-{data.context.alert_id.slice(0, 8).toUpperCase()}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Transaction Intelligence & Forensic Evidence
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
            Inspect real PostgreSQL financial flows, multi-hop staging trails, and account evidence corroborating predictive cash-out risk.
          </p>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Quick Alert Switcher */}
          {availableAlerts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target Alert:</span>
              <select
                value={alertIdParam || availableAlerts[0]?.id || ''}
                onChange={(e) => handleAlertSelect(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                }}
              >
                {availableAlerts.map((a) => (
                  <option key={a.id} value={a.id}>
                    ALT-{a.id.slice(0, 6).toUpperCase()} · {a.severity} ({a.atm})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowRelayModal(true)}
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '7px 12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Share2 size={13} color="var(--accent-cyan)" />
            <span>Actionable Package</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/geo')}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <MapPin size={13} />
            <span>Locate ATM on GIS</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Retrieving Real Transaction Forensics…
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Querying PostgreSQL transactions, PostGIS distance vectors, and associated complaint chains.
          </div>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '36px 24px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Transaction Intelligence Query Failed
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchAnalysis} style={{ fontSize: '0.78rem' }}>
            Retry Query
          </button>
        </div>
      ) : (
        <>
          {/* SECTION A: INVESTIGATION CONTEXT & PREDICTION BASIS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '18px' }}>
            {/* Prediction Basis Card */}
            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BrainCircuit size={16} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                    PREDICTIVE RISK BASIS (RF MODEL OUTPUT)
                  </span>
                </div>
                {data?.context.alert_severity && (
                  <SeverityBadge severity={(data.context.alert_severity as any) || 'MEDIUM'} />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Risk Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                    {data?.context.risk_score ? `${Math.round(data.context.risk_score * 100)}%` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Confidence</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    {data?.context.confidence ? `${Math.round(data.context.confidence * 100)}%` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Model</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {data?.context.model_version || 'rf-v2.0'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Alert Status</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginTop: '4px', textTransform: 'uppercase' }}>
                    {data?.context.alert_status || 'OPEN'}
                  </div>
                </div>
              </div>

              {/* Model Feature Explanations / Prediction Reasons */}
              <div>
                <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  MODEL EXPLAINABILITY FACTORS:
                </div>
                {data?.context.prediction_basis && data.context.prediction_basis.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {data.context.prediction_basis.map((reason, idx) => (
                      <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ color: 'var(--accent-cyan)' }}>›</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Baseline model inference applied to historical withdrawal concentration.
                  </div>
                )}
              </div>
            </div>

            {/* Target ATM & Predicted Cash-Out Window Card */}
            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={16} color="#34d399" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                    TARGET CASH-OUT TERMINAL & WINDOW
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  POSTGIS ANCHOR
                </span>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {data?.context.atm_code || 'ATM Node'} — {data?.context.bank_name || 'Bank Location'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {data?.context.city || 'Metro Region'} · Coordinates:{' '}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                    {data?.context.latitude?.toFixed(4)}, {data?.context.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Time Window Banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '6px' }}>
                <Clock size={16} color="var(--accent-cyan)" />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Predicted Cash-Out Window: </span>
                  {data?.context.predicted_window_start
                    ? `${new Date(data.context.predicted_window_start).toLocaleString()} to ${new Date(data.context.predicted_window_end!).toLocaleString()}`
                    : 'Active surveillance window'}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: SYSTEM RECOMMENDATIONS & ACTIONABLE INTELLIGENCE */}
          {data?.recommendations && data.recommendations.length > 0 && (
            <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '18px', borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={15} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    ACTIONABLE INVESTIGATIVE RECOMMENDATIONS (HUMAN-IN-THE-LOOP)
                  </span>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Generated from Corroborated Evidence
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                {data.recommendations.map((rec) => (
                  <div
                    key={rec.action_id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rec.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: rec.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                          color: rec.priority === 'URGENT' ? '#ef4444' : 'var(--accent-cyan)',
                        }}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {rec.description}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      Target: {rec.target_entity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION C: AGGREGATED FINANCIAL FORENSIC SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RELEVANT TRANSACTIONS</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data?.summary.total_transactions || 0}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Corroborating events
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DISPUTED VOLUME ROUTED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '2px' }}>
                ₹{Number(data?.summary.total_amount || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Through staging corridor
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LINKED ACCOUNTS</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                {data?.summary.unique_accounts || 0}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Intermediary & mule nodes
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATM WITHDRAWALS</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                {data?.summary.cash_out_count || 0}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Direct terminal cashouts
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATM CONCENTRATION</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                {data?.summary.atm_concentration_pct || 0}%
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Of corridor volume
              </div>
            </div>
          </div>

          {/* SECTION D: FORENSIC EVIDENCE & SUSPICIOUS INDICATORS */}
          {data?.indicators && data.indicators.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={15} color="#f59e0b" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  VERIFIED SUSPICIOUS INDICATORS ({data.indicators.length})
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
                {data.indicators.map((ind, idx) => (
                  <div
                    key={idx}
                    className="glass-panel"
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      borderLeft: `4px solid ${ind.severity === 'CRITICAL' ? '#ef4444' : ind.severity === 'HIGH' ? '#f59e0b' : 'var(--accent-cyan)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {ind.label}
                      </span>
                      <SeverityBadge severity={ind.severity} />
                    </div>

                    {/* Observed Facts Box */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '8px 10px', borderRadius: '4px', fontSize: '0.72rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px', fontFamily: 'JetBrains Mono, monospace' }}>
                        OBSERVED DATABASE FACTS:
                      </div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {Object.entries(ind.observed_facts).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                            <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                              {typeof v === 'number' ? (k.includes('amount') || k.includes('volume') ? `₹${v.toLocaleString()}` : v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contextual Forensic Interpretation */}
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Forensic Context: </strong>
                      {ind.suspicious_interpretation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION E: FILTER BAR & FORENSIC TRANSACTIONS TABLE */}
          <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '320px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search ID, masked account, bank, complaint…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 32px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Type Filter Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Type:</span>
                {['ALL', 'ATM_WITHDRAW', 'IMPS', 'UPI', 'NEFT'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: typeFilter === t ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                      background: typeFilter === t ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                      color: typeFilter === t ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Amount Threshold Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min ₹:</span>
                <input
                  type="number"
                  placeholder="Min amount"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  style={{
                    width: '100px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '0.72rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
              Showing {filteredTransactions.length} of {data?.summary.total_transactions || 0} Records
            </div>
          </div>

          {/* MAIN GRID: TRANSACTION TABLE + DOSSIER SLIDE-OUT */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedTxn ? '1fr 440px' : '1fr', gap: '16px' }}>
            {/* Table View */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>TRANSACTION ID</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>TIMESTAMP</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>AMOUNT</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>ACCOUNT (MASKED)</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>BANK / TYPE</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>ATM PROXIMITY</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>RELEVANCE</th>
                      <th style={{ padding: '10px 14px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No transactions found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((t) => {
                        const isSelected = selectedTxn?.id === t.id;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTxn(t)}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                              {t.id.slice(0, 8)}…
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                              {new Date(t.occurred_at).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              ₹{Number(t.amount).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
                              {t.source_account_masked || 'ACC-UNKNOWN'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.72rem' }}>
                                  {t.transaction_type}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  {t.bank_name || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {t.is_cash_out ? (
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>AT TARGET TERMINAL</span>
                              ) : t.distance_to_atm_meters !== undefined && t.distance_to_atm_meters !== null ? (
                                `${t.distance_to_atm_meters}m`
                              ) : (
                                'Corridor'
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background:
                                    t.relevance === 'HIGH'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : t.relevance === 'MEDIUM'
                                      ? 'rgba(245, 158, 11, 0.15)'
                                      : 'rgba(255, 255, 255, 0.05)',
                                  color:
                                    t.relevance === 'HIGH'
                                      ? '#ef4444'
                                      : t.relevance === 'MEDIUM'
                                      ? '#f59e0b'
                                      : 'var(--text-secondary)',
                                  border: `1px solid ${
                                    t.relevance === 'HIGH'
                                      ? 'rgba(239, 68, 68, 0.3)'
                                      : t.relevance === 'MEDIUM'
                                      ? 'rgba(245, 158, 11, 0.3)'
                                      : 'var(--border-subtle)'
                                  }`,
                                }}
                              >
                                {t.relevance} ({Math.round(t.relevance_score * 100)}%)
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <ChevronRight size={14} color="var(--text-muted)" />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Transaction Detail Dossier Panel */}
            {selectedTxn && (
              <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                      TRANSACTION DOSSIER
                    </span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                      {selectedTxn.id}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedTxn(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Amount & Account Quick Card */}
                <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Amount</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                      ₹{Number(selectedTxn.amount).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Masked Account</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                      {selectedTxn.source_account_masked || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Bank & Type</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedTxn.bank_name || 'Bank'} · {selectedTxn.transaction_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mule Suspect Tier</span>
                    <span style={{ fontWeight: 700, color: selectedTxn.is_mule_suspected ? '#ef4444' : 'var(--text-secondary)' }}>
                      {selectedTxn.account_risk_tier || (selectedTxn.is_mule_suspected ? 'CRITICAL MULE' : 'STANDARD')}
                    </span>
                  </div>
                </div>

                {/* Linked Complaint & PostGIS Geometry */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
                  {selectedTxn.complaint_number && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Linked Complaint:</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                        {selectedTxn.complaint_number}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Velocity Score:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                      {Number(selectedTxn.velocity_score).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Distance to Target ATM:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                      {selectedTxn.distance_to_atm_meters !== undefined && selectedTxn.distance_to_atm_meters !== null
                        ? `${selectedTxn.distance_to_atm_meters} meters`
                        : (selectedTxn.is_cash_out ? '0 meters (Terminal)' : 'Nearby Corridor')}
                    </span>
                  </div>
                </div>

                {/* Specific Factual Relevance Reasons */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', marginBottom: '6px' }}>
                    FORENSIC RELEVANCE RATIONALE:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedTxn.relevance_reasons.map((reason, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary)',
                          padding: '6px 8px',
                          background: 'rgba(0, 212, 255, 0.05)',
                          borderRadius: '4px',
                          border: '1px solid rgba(0, 212, 255, 0.1)',
                          lineHeight: 1.3,
                        }}
                      >
                        <span style={{ color: 'var(--accent-cyan)', marginRight: '6px' }}>›</span>
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons in Dossier */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => navigate('/dashboard/geo')}
                    className="btn btn-primary"
                    style={{ padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <MapPin size={13} />
                    <span>View ATM on Map</span>
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/graph')}
                    className="btn btn-ghost"
                    style={{ padding: '8px', fontSize: '0.75rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Network size={13} color="var(--accent-cyan)" />
                    <span>Knowledge Graph (Phase 6 Preview)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ACTIONABLE INTELLIGENCE PACKAGE MODAL */}
      {showRelayModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '650px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  ACTIONABLE INTELLIGENCE SHARING · PS 26184
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Inter-Agency Actionable Package
                </h2>
              </div>
              <button
                onClick={() => setShowRelayModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Transmits verified transaction forensic intelligence, masked mule account identifiers, and spatial surveillance coordinates to authorized stakeholder nodal desks.
            </div>

            {/* Dissemination Targets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { title: 'State Cyber Crime Cell Desk', desc: 'Deploy beat patrol and initiate field surveillance at predicted ATM.' },
                { title: 'Bank / FI Nodal Officer Desk', desc: 'Transmit Section 91 CrPC notice for priority debit freeze on identified mule nodes.' },
                { title: 'Indian Cybercrime Coordination Centre (I4C)', desc: 'Correlate interstate transaction chains with national syndicate patterns.' },
              ].map((tgt, idx) => (
                <div key={idx} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <CheckCircle size={15} color="#34d399" />
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tgt.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{tgt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setShowRelayModal(false)}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSimulateRelay}
                disabled={relaySuccess}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {relaySuccess ? (
                  <>
                    <CheckCircle size={14} color="#34d399" />
                    <span>Package Transmitted & Audited!</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Transmit Intelligence Package</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
