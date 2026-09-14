import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowRight, 
  ChevronRight, 
  Network, 
  MapPin, 
  BrainCircuit, 
  X,
  AlertTriangle,
  FileText,
  User,
  ExternalLink,
  RefreshCw,
  Clock,
  Building2,
  Database,
  Loader2,
  Users,
  Layers,
  Info
} from 'lucide-react';
import { complaintsApi, BackendComplaint, ComplaintIntelligence } from '../api/complaints';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const ComplaintsIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<BackendComplaint[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedComplaint, setSelectedComplaint] = useState<BackendComplaint | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live end-to-end intelligence dossier
  const [intel, setIntel] = useState<ComplaintIntelligence | null>(null);
  const [isLoadingIntel, setIsLoadingIntel] = useState<boolean>(false);
  const [dossierTab, setDossierTab] = useState<'overview' | 'mules' | 'predictions'>('overview');

  useEffect(() => {
    if (!selectedComplaint?.id) {
      setIntel(null);
      return;
    }
    let active = true;
    async function loadIntel() {
      setIsLoadingIntel(true);
      try {
        const res = await complaintsApi.getComplaintIntelligence(selectedComplaint!.id);
        if (active) setIntel(res);
      } catch (err) {
        console.warn('Could not fetch complaint intelligence:', err);
        if (active) setIntel(null);
      } finally {
        if (active) setIsLoadingIntel(false);
      }
    }
    loadIntel();
    return () => { active = false; };
  }, [selectedComplaint?.id]);


  const fetchComplaints = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await complaintsApi.getComplaints({
        per_page: 50,
        search: searchTerm.trim() || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      setComplaints(res.items);
      setTotalCount(res.total);
      if (res.items.length > 0 && !selectedComplaint) {
        setSelectedComplaint(res.items[0]);
      } else if (res.items.length > 0 && selectedComplaint) {
        // Keep selected if still in list, or select first
        const found = res.items.find((c) => c.id === selectedComplaint.id || c.complaint_number === selectedComplaint.complaint_number);
        setSelectedComplaint(found || res.items[0]);
      } else {
        setSelectedComplaint(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch real complaints from backend:', err);
      setError(err?.message || 'Could not connect to PostgreSQL complaints repository. Ensure backend is running.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Derived KPIs
  const newCount = complaints.filter((c) => c.status === 'open' || c.status === 'SUBMITTED').length;
  const underInvestigationCount = complaints.filter((c) => c.status === 'under_investigation').length;
  const highRiskCount = complaints.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH').length;
  const totalAmountLost = complaints.reduce((sum, c) => sum + (Number(c.reported_amount) || 0), 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              CITIZEN PORTAL BRIDGE
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '2px 6px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34d399',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Database size={10} />
              POSTGRESQL LIVE REPOSITORY ACTIVE
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Complaints Intelligence
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Real-time feed of citizen cybercrime grievances bridged from the public portal for predictive ATM hotspot forecasting and mule ring tracing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchComplaints(true)}
            disabled={isLoading || isRefreshing}
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '8px 14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh complaints from PostgreSQL"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Feed'}</span>
          </button>

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '8px 14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Open Citizen Portal</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'TOTAL COMPLAINTS', val: totalCount.toLocaleString(), color: 'var(--text-primary)' },
          { label: 'NEW / OPEN COMPLAINTS', val: newCount.toLocaleString(), color: 'var(--accent-cyan)' },
          { label: 'UNDER INVESTIGATION', val: underInvestigationCount.toLocaleString(), color: '#f59e0b' },
          { label: 'HIGH / CRITICAL PRIORITY', val: highRiskCount.toLocaleString(), color: '#ef4444' },
          { label: 'REPORTED LOSS (FEED)', val: `₹${(totalAmountLost / 100000).toFixed(1)}L`, color: '#10b981' },
        ].map((stat, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color, marginTop: '4px' }}>
              {stat.val}
            </div>
          </div>
        ))}
      </div>

      {/* Error Alert if backend unreachable */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '0.82rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Search, Filter Bar & Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedComplaint ? '1fr 420px' : '1fr', gap: '20px' }}>
        {/* Complaints Table */}
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search Complaint ID, Name, Category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 32px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="UPI">UPI Fraud</option>
                <option value="Phishing">Phishing</option>
                <option value="Card">Card Fraud</option>
                <option value="Digital Arrest">Digital Arrest</option>
                <option value="Investment">Investment Fraud</option>
              </select>

              <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {isLoading ? 'Loading...' : `Showing ${complaints.length} of ${totalCount}`}
              </span>
            </div>
          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLAINT ID</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>AMOUNT LOST</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>LOCATION</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>PRIORITY</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && complaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading real complaints from PostgreSQL database...
                    </td>
                  </tr>
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No complaints found matching current filters.
                    </td>
                  </tr>
                ) : (
                  complaints.map((c) => {
                    const isSelected = selectedComplaint?.id === c.id || selectedComplaint?.complaint_number === c.complaint_number;
                    const amount = Number(c.reported_amount) || 0;
                    const locationStr = [c.victim_city || c.victim_district, c.victim_state].filter(Boolean).join(', ') || 'India';
                    const sev = (c.priority || (amount > 100000 ? 'HIGH' : 'MEDIUM')) as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

                    return (
                      <tr
                        key={c.id || c.complaint_number}
                        onClick={() => setSelectedComplaint(c)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          {c.complaint_number}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                          {c.category}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: amount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Nil / Non-financial'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {locationStr}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <SeverityBadge severity={sev} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'JetBrains Mono, monospace',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: c.status === 'open' ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255,255,255,0.05)',
                              color: c.status === 'open' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            }}
                          >
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <ChevronRight size={15} color={isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Complaint Detail Dossier */}
        {selectedComplaint && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  COMPLAINT INTELLIGENCE DOSSIER
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedComplaint.complaint_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Dossier Tabs */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <button
                onClick={() => setDossierTab('overview')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: dossierTab === 'overview' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  backgroundColor: dossierTab === 'overview' ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                  color: dossierTab === 'overview' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}
              >
                Overview
              </button>
              <button
                onClick={() => setDossierTab('mules')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: dossierTab === 'mules' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  backgroundColor: dossierTab === 'mules' ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                  color: dossierTab === 'mules' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>Mule Ring</span>
                {intel && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>{intel.accounts?.length || 0}</span>}
              </button>
              <button
                onClick={() => setDossierTab('predictions')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: dossierTab === 'predictions' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  backgroundColor: dossierTab === 'predictions' ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                  color: dossierTab === 'predictions' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>Forecast ATMs</span>
                {intel && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '10px', background: 'rgba(0,212,255,0.2)', color: 'var(--accent-cyan)' }}>{intel.correlated_predictions?.length || 0}</span>}
              </button>
            </div>

            {isLoadingIntel && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <Loader2 size={14} className="animate-spin" color="var(--accent-cyan)" />
                <span>Correlating multi-hop transaction trails...</span>
              </div>
            )}

            {/* TAB 1: OVERVIEW */}
            {dossierTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Complainant & Financial Loss Card */}
                <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>COMPLAINANT</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedComplaint.complainant_name || 'Citizen Grievant'}
                      </div>
                      {selectedComplaint.complainant_contact && (
                        <div style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {selectedComplaint.complainant_contact}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>REPORTED LOSS</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: Number(selectedComplaint.reported_amount) > 0 ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
                        ₹{Number(selectedComplaint.reported_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Location: {selectedComplaint.victim_district || selectedComplaint.victim_city || selectedComplaint.victim_state || 'India'}</span>
                    <span>Filed: {new Date(selectedComplaint.filed_at || selectedComplaint.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                {/* Incident Summary */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Statement of Incident
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.5, background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px' }}>
                    {selectedComplaint.description || 'No detailed narrative provided by complainant.'}
                  </p>
                </div>

                {/* Suspect / Beneficiary Details if present */}
                {selectedComplaint.suspect_info && (
                  <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 600 }}>
                      Citizen-Reported Suspect Identifier
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)', marginTop: '3px', wordBreak: 'break-all' }}>
                      {selectedComplaint.suspect_info}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MULE RING & TRANSACTIONS */}
            {dossierTab === 'mules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                {intel?.mule_network_indicators && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <div style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>LINKED ACCOUNTS</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {intel.mule_network_indicators.total_accounts} ({intel.mule_network_indicators.mule_accounts_count} suspected)
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>FLAGGED VOLUME</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>
                        ₹{intel.mule_network_indicators.total_flagged_amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Linked Accounts */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'JetBrains Mono' }}>
                    LINKED ACCOUNTS ({intel?.accounts?.length || 0})
                  </div>
                  {intel?.accounts && intel.accounts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {intel.accounts.map(acc => (
                        <div key={acc.id} style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.74rem', fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {acc.account_masked}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {acc.bank_name} · Role: <strong style={{ color: 'var(--accent-cyan)' }}>{acc.role_in_case}</strong>
                            </div>
                          </div>
                          {acc.is_mule_suspected && (
                            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 700 }}>
                              MULE
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '8px' }}>No direct accounts mapped yet.</div>
                  )}
                </div>

                {/* Linked Transactions */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'JetBrains Mono' }}>
                    TRANSACTIONS TRAIL ({intel?.transactions?.length || 0})
                  </div>
                  {intel?.transactions && intel.transactions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {intel.transactions.map(tx => (
                        <div key={tx.id} style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {tx.transaction_type} · ₹{Number(tx.amount).toLocaleString('en-IN')}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                              {new Date(tx.occurred_at).toLocaleString('en-IN')}
                            </div>
                          </div>
                          {tx.is_cash_out && (
                            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(249,115,22,0.2)', color: '#f97316', fontWeight: 700 }}>
                              CASHOUT
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '8px' }}>No transactions recorded.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CORRELATED PREDICTED ATMS */}
            {dossierTab === 'predictions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                {/* Forensic Delineation Disclaimer */}
                <div style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.25)', fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--accent-cyan)' }}>Forensic Delineation:</strong> ML prediction computes withdrawal probability at physical ATMs in the next 24h. Fraud intelligence establishes case relevance via proximal financial flows.
                </div>

                {intel?.correlated_predictions && intel.correlated_predictions.length > 0 ? (
                  intel.correlated_predictions.map(pred => (
                    <div key={pred.id} style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {pred.atm_code || 'ATM Terminal'} · {pred.atm_bank || 'Bank'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {pred.atm_city || 'Delhi NCR'} {pred.distance_to_complaint_km ? `(${pred.distance_to_complaint_km} km)` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: pred.risk_score > 0.85 ? '#ef4444' : '#f59e0b' }}>
                            {Math.round(pred.risk_score * 100)}%
                          </span>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>24h Risk</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', marginTop: '2px', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
                        {pred.relevance_to_case}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No correlated ATM predictions found in this region.
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
              <button
                onClick={() => navigate(`/dashboard/graph?case_id=${selectedComplaint.id}`)}
                className="btn btn-primary"
                style={{ padding: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Network size={14} />
                <span>Examine in Knowledge Graph</span>
              </button>
              <button
                onClick={() => navigate('/dashboard/forecast')}
                className="btn btn-ghost"
                style={{ padding: '8px', fontSize: '0.8rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <BrainCircuit size={14} color="var(--accent-cyan)" />
                <span>Predict Cash-out Hotspots</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

