import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch {
      // error is surfaced via AuthContext.error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundImage:
          'radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.04) 0%, transparent 50%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              marginBottom: '16px',
            }}
          >
            <ShieldAlert size={28} color="var(--accent-cyan)" />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '6px',
            }}
          >
            PravahDridh
          </h1>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Cybercrime Forecast Intelligence Platform
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Ministry of Home Affairs / I4C Authorized
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}
          >
            Investigator Authentication
          </h2>
          <p
            style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px' }}
          >
            Access is restricted to authorized law enforcement personnel.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div>
              <label
                style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.04em' }}
              >
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@hermes.gov.in"
                  className="input-field"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.04em' }}
              >
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your secure credential"
                  className="input-field"
                  style={{ paddingLeft: '36px', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--sev-critical-bg)',
                  border: '1px solid var(--sev-critical-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--sev-critical-text)',
                  fontSize: '0.82rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={submitting || isLoading || !email || !password}
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', marginTop: '8px' }}
            >
              {submitting ? 'Authenticating...' : 'Access Intelligence Platform'}
            </button>
          </form>
        </div>

        {/* Disclaimer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '20px',
            lineHeight: 1.5,
          }}
        >
          Decision-support only. Not an autonomous enforcement system.
          <br />
          All intelligence assessments require human investigator review.
        </p>
      </div>
    </div>
  );
};
