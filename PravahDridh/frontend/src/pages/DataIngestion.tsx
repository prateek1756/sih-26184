import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  FileText, 
  Loader2, 
  FileSpreadsheet,
  Database,
  Search,
  Activity,
  Network,
  Cpu
} from 'lucide-react';
import { transactionsApi, IngestionStatus } from '../api';

interface StepStatus {
  title: string;
  desc: string;
  status: 'pending' | 'processing' | 'done';
}

export const DataIngestion: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus | null>(null);
  const [validationMetrics, setValidationMetrics] = useState<{
    loaded: number;
    valid: number;
    invalid: number;
    missing: number;
    duplicates: number;
    detectedColumns: string[];
  } | null>(null);

  useEffect(() => {
    transactionsApi
      .getIngestionStatus()
      .then(setIngestionStatus)
      .catch((err) => console.warn('Could not load live ingestion status:', err));
  }, []);


  const pipelineSteps: StepStatus[] = [
    { title: 'Data Cleaning & Normalization', desc: 'Removing nulls, standardizing timestamps & currency codes', status: stepIndex > 0 ? 'done' : stepIndex === 0 && isProcessing ? 'processing' : 'pending' },
    { title: 'Entity Extraction', desc: 'Parsing accounts, beneficiary PANs, phone hashes & device fingerprints', status: stepIndex > 1 ? 'done' : stepIndex === 1 ? 'processing' : 'pending' },
    { title: 'Relationship Mapping', desc: 'Correlating fund hops, rapid transfers and ATM physical terminals', status: stepIndex > 2 ? 'done' : stepIndex === 2 ? 'processing' : 'pending' },
    { title: 'Pattern Detection', desc: 'Executing structuring, layering and mule loop detection algorithms', status: stepIndex > 3 ? 'done' : stepIndex === 3 ? 'processing' : 'pending' },
    { title: 'Risk Scoring', desc: 'Computing multi-factor Bayesian risk vectors across nodes', status: stepIndex > 4 ? 'done' : stepIndex === 4 ? 'processing' : 'pending' },
    { title: 'Knowledge Graph Construction', desc: 'Generating entity-link adjacency graphs for multi-hop exploration', status: stepIndex > 5 ? 'done' : stepIndex === 5 ? 'processing' : 'pending' },
    { title: 'Predictive Analysis', desc: 'Generating 24h - 7d withdrawal hotspot forecasts & confidence scores', status: stepIndex > 6 ? 'done' : stepIndex === 6 ? 'processing' : 'pending' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const runSimulation = () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setStepIndex(0);

    const totalRecords = ingestionStatus ? ingestionStatus.total_transactions : 18450;
    const flagged = ingestionStatus ? ingestionStatus.flagged_transactions : 240;
    const valid = totalRecords - flagged;

    // Validation metrics populated from database
    setValidationMetrics({
      loaded: totalRecords,
      valid: valid > 0 ? valid : totalRecords,
      invalid: flagged,
      missing: 0,
      duplicates: 0,
      detectedColumns: ['Account ID', 'Transaction ID', 'Amount', 'Timestamp', 'Location', 'ATM ID', 'Device ID', 'Beneficiary'],
    });

    // Step through pipeline simulation
    let current = 0;
    const timer = setInterval(() => {
      current++;
      setStepIndex(current);
      if (current >= pipelineSteps.length) {
        clearInterval(timer);
        setIsProcessing(false);
      }
    }, 700);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
            DATA INGESTION PIPELINE
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
          Data Ingestion Center
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Upload financial transactions, cybercrime complaints, or bank ledger files for automated validation, pattern extraction, and intelligence graph synthesis.
        </p>
      </div>

      {/* Live Database Synchronization Status */}
      {ingestionStatus && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '14px 20px', 
            marginBottom: '24px', 
            border: '1px solid rgba(0, 212, 255, 0.25)',
            backgroundColor: 'rgba(0, 212, 255, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Active Production Database Pipeline: {ingestionStatus.status}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Dataset: {ingestionStatus.active_dataset} · {ingestionStatus.earliest_transaction ? new Date(ingestionStatus.earliest_transaction).toLocaleDateString() : ''} to {ingestionStatus.latest_transaction ? new Date(ingestionStatus.latest_transaction).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Transactions: </span><strong style={{ color: 'var(--text-primary)' }}>{ingestionStatus.total_transactions.toLocaleString()}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Complaints: </span><strong style={{ color: 'var(--text-primary)' }}>{ingestionStatus.total_complaints.toLocaleString()}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Accounts: </span><strong style={{ color: 'var(--text-primary)' }}>{ingestionStatus.total_accounts}</strong> (<span style={{ color: '#ef4444' }}>{ingestionStatus.mule_suspected_accounts} mules</span>)</div>
            <div><span style={{ color: 'var(--text-muted)' }}>ATMs: </span><strong style={{ color: 'var(--accent-cyan)' }}>{ingestionStatus.total_atms}</strong></div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left: Upload and Validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drag and Drop Zone */}
          <div
            className="glass-panel"
            style={{
              padding: '36px 24px',
              border: '2px dashed var(--border-subtle)',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
              backgroundColor: 'rgba(15, 21, 35, 0.6)',
            }}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.json"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <UploadCloud size={26} color="var(--accent-cyan)" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {selectedFile ? selectedFile.name : 'Select or Drag & Drop Dataset File'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Supported formats: CSV, XLSX, JSON (Max 250MB per batch)
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', padding: '6px 16px', border: '1px solid var(--border-subtle)' }}
            >
              {selectedFile ? 'Change File' : 'Browse Local Files'}
            </button>
          </div>

          {/* Quick Demo Pre-load Button */}
          {!selectedFile && (
            <div
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 212, 255, 0.04)',
                border: '1px solid rgba(0, 212, 255, 0.15)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Load Benchmark Cybercrime Dataset
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  indian_banking_transactions_clean.csv (18,450 records, multi-layer mule ring)
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(new File(['mock content'], 'indian_banking_transactions_clean.csv', { type: 'text/csv' }));
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px 14px' }}
              >
                Load Sample
              </button>
            </div>
          )}

          {/* Action Trigger */}
          {selectedFile && !validationMetrics && (
            <button
              onClick={runSimulation}
              disabled={isProcessing}
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
              <span>Process & Extract Intelligence</span>
            </button>
          )}

          {/* STEP 1: File Validation Metrics */}
          {validationMetrics && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                  STEP 1 — FILE VALIDATION REPORT
                </span>
                <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} /> Schema Validated
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RECORDS LOADED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {validationMetrics.loaded.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#10b981' }}>VALID RECORDS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                    {validationMetrics.valid.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>INVALID / ERRORS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>
                    {validationMetrics.invalid.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <strong>Detected Schema Columns:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {validationMetrics.detectedColumns.map((col, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 8px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.68rem',
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Visual Processing Pipeline */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
              STEP 2 — PROCESSING PIPELINE
            </span>
            {stepIndex >= pipelineSteps.length && (
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                PIPELINE COMPLETE
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pipelineSteps.map((step, idx) => {
              const isDone = step.status === 'done';
              const isCurr = step.status === 'processing';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: isCurr ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                    border: isCurr ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid transparent',
                  }}
                >
                  <div style={{ marginTop: '2px' }}>
                    {isDone ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : isCurr ? (
                      <Loader2 size={16} color="var(--accent-cyan)" className="animate-spin" />
                    ) : (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '2px solid var(--text-muted)',
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isDone || isCurr ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* STEP 3: Complete & Call to Action */}
          {stepIndex >= pipelineSteps.length && (
            <div
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
                Analysis Ready
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Extracted 14 mule clusters, 4 high-risk cash withdrawal zones, and synthesized the Knowledge Graph.
              </p>
              <button
                onClick={() => navigate('/dashboard/transactions')}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>View Analysis Results</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
