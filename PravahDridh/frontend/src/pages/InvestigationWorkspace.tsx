import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Briefcase, 
  FileText, 
  Plus, 
  ArrowRight, 
  Network, 
  MapPin, 
  BrainCircuit, 
  ShieldAlert, 
  Clock, 
  Printer, 
  Download, 
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Filter,
  Check
} from 'lucide-react';
import { investigationsApi, Investigation, InvestigationNote } from '../api';
import { SeverityBadge } from '../components/common/SeverityBadge';

export const InvestigationWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const caseIdFromUrl = searchParams.get('case_id');

  const [activeTab, setActiveTab] = useState<'dossier' | 'report'>('dossier');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [isSavingOutcome, setIsSavingOutcome] = useState<boolean>(false);
  const [newNote, setNewNote] = useState<string>('');
  
  // Outcome feedback form
  const [outcomeVal, setOutcomeVal] = useState<string>('WITHDRAWAL_OCCURRED');
  const [actionTakenVal, setActionTakenVal] = useState<string>('ATM_SURVEILLANCE_DISPATCHED');
  const [outcomeNotesVal, setOutcomeNotesVal] = useState<string>('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Status update
  const [statusVal, setStatusVal] = useState<string>('UNDER_REVIEW');

  // Load investigations
  const loadInvestigations = async () => {
    setIsLoading(true);
    try {
      const res = await investigationsApi.listInvestigations({ per_page: 50 });
      if (res && res.items.length > 0) {
        setInvestigations(res.items);
        // Find matching case or default to first
        const matched = caseIdFromUrl 
          ? res.items.find(i => i.id === caseIdFromUrl) 
          : res.items[0];
        const active = matched || res.items[0];
        setSelectedCase(active);
        setStatusVal(active.status);
        if (active.outcome) setOutcomeVal(active.outcome);
        if (active.action_taken) setActionTakenVal(active.action_taken);
        if (active.outcome_notes) setOutcomeNotesVal(active.outcome_notes);
      }
    } catch (err) {
      console.error('Failed to load investigations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvestigations();
  }, [caseIdFromUrl]);

  const handleSelectCase = (inv: Investigation) => {
    setSelectedCase(inv);
    setStatusVal(inv.status);
    if (inv.outcome) setOutcomeVal(inv.outcome);
    if (inv.action_taken) setActionTakenVal(inv.action_taken);
    if (inv.outcome_notes) setOutcomeNotesVal(inv.outcome_notes);
    setSearchParams({ case_id: inv.id });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newNote.trim()) return;
    setIsSavingNote(true);
    try {
      const added = await investigationsApi.addNote(selectedCase.id, newNote.trim());
      setSelectedCase(prev => prev ? {
        ...prev,
        notes: [added, ...prev.notes],
      } : null);
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedCase) return;
    try {
      const updated = await investigationsApi.updateStatus(selectedCase.id, newStatus);
      setSelectedCase(updated);
      setStatusVal(updated.status);
      setInvestigations(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setIsSavingOutcome(true);
    setFeedbackSuccess(null);
    try {
      const updated = await investigationsApi.recordOutcome(selectedCase.id, {
        outcome: outcomeVal,
        action_taken: actionTakenVal,
        outcome_notes: outcomeNotesVal,
      });
      setSelectedCase(updated);
      setInvestigations(prev => prev.map(i => i.id === updated.id ? updated : i));
      setFeedbackSuccess('Outcome feedback recorded and synced with AI calibration loop.');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to record outcome:', err);
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading && investigations.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent-cyan)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading Operations Dossiers...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              OPERATIONS DOSSIER & WORKSPACE
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              CASE #{selectedCase?.case_number || 'N/A'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Investigation Workspace & Outcome Feedback
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Live database-backed evidence locker, tactical inter-agency coordination, and ground truth outcome recording for predictive analytics refinement.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('dossier')}
            className={activeTab === 'dossier' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.8rem', padding: '8px 16px' }}
          >
            Case Dossier
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={activeTab === 'report' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} />
            <span>Generate Intelligence Report</span>
          </button>
        </div>
      </div>

      {/* Case Selector Strip */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '12px 18px', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '14px', 
          overflowX: 'auto',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(15, 23, 42, 0.6)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
          <Briefcase size={14} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono' }}>ACTIVE CASES ({investigations.length}):</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {investigations.map(inv => {
            const isSelected = selectedCase?.id === inv.id;
            return (
              <button
                key={inv.id}
                onClick={() => handleSelectCase(inv)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  backgroundColor: inv.status === 'RESOLVED' ? '#10b981' : inv.outcome ? '#38bdf8' : '#ef4444' 
                }} />
                <span>{inv.case_number}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({inv.status})</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'dossier' && selectedCase ? (
        /* CASE DOSSIER VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Case Overview Card */}
            <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    INVESTIGATION TITLE · {selectedCase.case_number}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedCase.title}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Lead Investigator: <strong style={{ color: 'var(--text-primary)' }}>{selectedCase.lead_investigator?.badge_number || 'OFFICER-NCR'}</strong> ({selectedCase.lead_investigator?.email || 'LEA Investigator'})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <SeverityBadge severity={selectedCase.priority as any || 'HIGH'} />
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedCase.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 212, 255, 0.15)',
                    color: selectedCase.status === 'RESOLVED' ? '#10b981' : 'var(--accent-cyan)',
                    border: '1px solid currentColor',
                    fontFamily: 'JetBrains Mono'
                  }}>
                    {selectedCase.status}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                {selectedCase.findings || 'Automated multi-hop intelligence correlation initiated based on verified cybercrime complaint and correlated ATM cash-out signals.'}
              </p>

              {/* Status & Outcome Summary Banner */}
              {selectedCase.outcome && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '6px', 
                  backgroundColor: 'rgba(56, 189, 248, 0.08)', 
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>
                      RECORDED GROUND OUTCOME: {selectedCase.outcome}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {selectedCase.outcome_recorded_at ? new Date(selectedCase.outcome_recorded_at).toLocaleString('en-IN') : 'Recently recorded'}
                    </span>
                  </div>
                  {selectedCase.action_taken && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      <strong>Action Taken:</strong> {selectedCase.action_taken}
                    </div>
                  )}
                  {selectedCase.outcome_notes && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {selectedCase.outcome_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Metadata Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CASE ID</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>
                    {selectedCase.case_number.slice(-8)}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PRIORITY</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b' }}>
                    {selectedCase.priority}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ALERT LINK</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono' }}>
                    {selectedCase.alert_id ? `ALT-${selectedCase.alert_id.slice(0, 6)}` : 'DIRECT'}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NOTES LOGGED</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
                    {selectedCase.notes?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & Actions History */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                Investigation Notes & Activity Log
              </h4>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Log forensic finding, field unit dispatch, or bank nodal confirmation..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSavingNote || !newNote.trim()}
                    className="btn btn-primary"
                    style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                  >
                    {isSavingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Add Note</span>
                  </button>
                </div>
              </form>

              {/* Notes Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedCase.notes && selectedCase.notes.length > 0 ? (
                  selectedCase.notes.map((n, idx) => (
                    <div
                      key={n.id || idx}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--accent-cyan)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono' }}>
                          {n.author?.badge_number || 'INVESTIGATOR'} · {n.author?.role || 'LEAD'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(n.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {n.note}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No operational notes logged yet for this case. Use the input above to record field actions.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Tactical Tools & Feedback Recorder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Status & Outcome Feedback Recorder */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Record Outcome Feedback Loop
              </h4>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                Closing the feedback loop informs AI model validation without retraining production weights, ensuring audit compliance.
              </p>

              {feedbackSuccess && (
                <div style={{ 
                  padding: '10px 14px', 
                  borderRadius: '6px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                  border: '1px solid #10b981', 
                  color: '#10b981', 
                  fontSize: '0.75rem', 
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Check size={14} />
                  <span>{feedbackSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRecordOutcome} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    INVESTIGATION OUTCOME
                  </label>
                  <select
                    value={outcomeVal}
                    onChange={(e) => setOutcomeVal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <option value="WITHDRAWAL_OCCURRED">WITHDRAWAL_OCCURRED (Cashout confirmed)</option>
                    <option value="INTERVENTION_PREVENTED_CASHOUT">INTERVENTION_PREVENTED_CASHOUT (Preempted by LEA)</option>
                    <option value="NO_WITHDRAWAL_DETECTED">NO_WITHDRAWAL_DETECTED (No activity at ATM)</option>
                    <option value="FALSE_POSITIVE">FALSE_POSITIVE (Legitimate activity)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    ACTION TAKEN BY LEA / FI
                  </label>
                  <select
                    value={actionTakenVal}
                    onChange={(e) => setActionTakenVal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <option value="ATM_SURVEILLANCE_DISPATCHED">ATM_SURVEILLANCE_DISPATCHED (Physical Patrol)</option>
                    <option value="ACCOUNT_FREEZE_NOTICE_SENT">ACCOUNT_FREEZE_NOTICE_SENT (Sec 91 CrPC)</option>
                    <option value="FI_ALERT_RELAYED">FI_ALERT_RELAYED (Bank Nodal Intercept)</option>
                    <option value="FIELD_UNIT_INTERCEPT">FIELD_UNIT_INTERCEPT (Suspect Apprehended)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    FORENSIC & GROUND NOTES
                  </label>
                  <textarea
                    rows={3}
                    value={outcomeNotesVal}
                    onChange={(e) => setOutcomeNotesVal(e.target.value)}
                    placeholder="Enter details of apprehension, recovered cash amount, or bank freeze reference..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingOutcome}
                  className="btn btn-primary"
                  style={{ padding: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {isSavingOutcome ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>Save Outcome Feedback</span>
                </button>
              </form>

              {/* Status Switcher */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  CHANGE CASE STATUS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['OPEN', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'FALSE_POSITIVE'].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'JetBrains Mono',
                        border: selectedCase.status === st ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        backgroundColor: selectedCase.status === st ? 'rgba(0,212,255,0.15)' : 'transparent',
                        color: selectedCase.status === st ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tactical Investigation Actions */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tactical Intelligence Operations
              </h4>

              <button
                onClick={() => navigate(`/dashboard/graph?case_id=${selectedCase.id}`)}
                className="btn btn-primary"
                style={{ padding: '12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Network size={16} />
                <span>Open Case in Knowledge Graph</span>
              </button>

              <button
                onClick={() => navigate(selectedCase.alert_id ? `/dashboard/transactions?alert_id=${selectedCase.alert_id}` : '/dashboard/transactions')}
                className="btn btn-ghost"
                style={{ padding: '12px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ShieldAlert size={16} color="var(--accent-cyan)" />
                <span>Examine Relevant Transactions</span>
              </button>

              <button
                onClick={() => navigate('/dashboard/forecast')}
                className="btn btn-ghost"
                style={{ padding: '12px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <BrainCircuit size={16} color="var(--accent-cyan)" />
                <span>Predict Cash-Out Hotspots</span>
              </button>

              <button
                onClick={() => navigate('/dashboard/geo')}
                className="btn btn-ghost"
                style={{ padding: '12px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <MapPin size={16} color="var(--accent-cyan)" />
                <span>Examine Spatial Heatmap</span>
              </button>
            </div>
          </div>
        </div>
      ) : selectedCase ? (
        /* PRINTABLE INTELLIGENCE REPORT VIEW */
        <div className="glass-panel" style={{ padding: '36px', maxWidth: '900px', margin: '0 auto', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '8px' }}>
          {/* Print controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', letterSpacing: '0.08em' }}>
                INDIAN CYBER CRIME COORDINATION CENTRE (I4C)
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                CONFIDENTIAL LAW ENFORCEMENT INTELLIGENCE REPORT
              </h2>
            </div>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <Printer size={15} />
              <span>Print / Export PDF</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <div>
              <strong>CASE FILE:</strong> {selectedCase.case_number} | <strong>DATE:</strong> {new Date(selectedCase.created_at).toLocaleDateString('en-IN')} | <strong>STATUS:</strong> {selectedCase.status} | <strong>PRIORITY:</strong> {selectedCase.priority}
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px' }}>
                1. CASE TITLE & EXECUTIVE OVERVIEW
              </h3>
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>{selectedCase.title}</p>
              <p>
                {selectedCase.findings || 'Automated multi-hop intelligence correlation and predictive cashout forecasting initiated under SIH Problem Statement 26184 framework.'}
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px' }}>
                2. AI PREDICTION & RELEVANCE INTEGRATION
              </h3>
              <p>
                • <strong>Predictive Model:</strong> Calibrated Random Forest v2.0 (24-Hour Cashout Horizon)<br />
                • <strong>Alert Association:</strong> {selectedCase.alert_id ? `Active Alert #${selectedCase.alert_id}` : 'Case Investigation Baseline'}<br />
                • <strong>Forensic Rule:</strong> ML prediction establishes withdrawal probability at physical terminals; Fraud Intelligence correlates account flow to victim complaint.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px' }}>
                3. GROUND OUTCOME & INTERVENTION FEEDBACK
              </h3>
              <p>
                • <strong>Outcome Recorded:</strong> {selectedCase.outcome || 'PENDING FIELD VERIFICATION'}<br />
                • <strong>Action Executed:</strong> {selectedCase.action_taken || 'ROUTINE SURVEILLANCE'}<br />
                • <strong>Field Notes:</strong> {selectedCase.outcome_notes || 'Investigation ongoing by designated cyber cell officers.'}
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px' }}>
                4. OPERATIONAL NOTES LOG ({selectedCase.notes?.length || 0})
              </h3>
              {selectedCase.notes && selectedCase.notes.length > 0 ? (
                <ul style={{ paddingLeft: '20px' }}>
                  {selectedCase.notes.map(n => (
                    <li key={n.id} style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>[{new Date(n.created_at).toLocaleString('en-IN')}]</span> {n.note}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#64748b' }}>No notes recorded yet.</p>
              )}
            </div>

            <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#64748b' }}>
              Generated by PravahDridh Intelligence Platform · LEA Decision Support Report · Certified Section 65B Indian Evidence Act compliant metadata.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
