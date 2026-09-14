import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  UploadCloud,
  Database,
  Search,
  Activity,
  AlertTriangle,
  Network,
  MapPin,
  BrainCircuit,
  TrendingUp,
  Bell,
  Briefcase,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  ExternalLink
} from 'lucide-react';
import { StatusIndicator } from '../common/StatusIndicator';
import { WebSocketStatus } from '../../hooks/useRiskWebSocket';

interface CommandLayoutProps {
  children: React.ReactNode;
  wsStatus?: WebSocketStatus;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const CommandLayout: React.FC<CommandLayoutProps> = ({ children, wsStatus = 'CONNECTED' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Intelligence Overview', path: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'DATA',
      items: [
        { id: 'ingestion', label: 'Data Ingestion', path: '/dashboard/ingestion', icon: UploadCloud, badge: 'NEW' },
        { id: 'sources', label: 'Data Sources', path: '/dashboard/sources', icon: Database },
      ],
    },
    {
      title: 'ANALYSIS',
      items: [
        { id: 'transactions', label: 'Transaction Analysis', path: '/dashboard/transactions', icon: Search },
        { id: 'patterns', label: 'Pattern Detection', path: '/dashboard/patterns', icon: Activity },
        { id: 'risk', label: 'Risk Analysis', path: '/dashboard/risk', icon: AlertTriangle },
      ],
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { id: 'graph', label: 'Knowledge Graph', path: '/dashboard/graph', icon: Network, badge: 'AI' },
        { id: 'geo', label: 'Geographic Intelligence', path: '/dashboard/geo', icon: MapPin },
        { id: 'ai', label: 'AI Intelligence', path: '/dashboard/ai', icon: BrainCircuit },
        { id: 'forecast', label: 'Withdrawal Forecast', path: '/dashboard/forecast', icon: TrendingUp },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'alerts', label: 'Alert Center', path: '/dashboard/alerts', icon: Bell, badge: 'LIVE' },
        { id: 'complaints', label: 'Complaints Intel', path: '/dashboard/complaints', icon: ShieldCheck },
        { id: 'investigations', label: 'Case Workspace', path: '/dashboard/investigations', icon: Briefcase },
        { id: 'reports', label: 'Intelligence Reports', path: '/dashboard/reports', icon: FileText },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', path: '/dashboard/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? '68px' : '250px',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={18} color="var(--accent-cyan)" />
            </div>
            {!collapsed && (
              <div>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  PravahDridh
                </span>
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.62rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  v2.4
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: collapsed ? 'none' : 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Collapsed toggle button if collapsed */}
        {collapsed && (
          <div style={{ padding: '8px 0', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setCollapsed(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {navSections.map((sec, sIdx) => (
            <div key={sIdx} style={{ marginBottom: '16px' }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    padding: '4px 10px',
                    textTransform: 'uppercase',
                  }}
                >
                  {sec.title}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'space-between',
                        padding: collapsed ? '10px 0' : '8px 12px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        backgroundColor: isActive ? 'rgba(0, 212, 255, 0.09)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                      title={collapsed ? item.label : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={17} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
                        {!collapsed && (
                          <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        )}
                      </div>
                      {!collapsed && item.badge && (
                        <span
                          style={{
                            fontSize: '0.6rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: item.badge === 'LIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 212, 255, 0.15)',
                            color: item.badge === 'LIVE' ? '#f87171' : 'var(--accent-cyan)',
                            border: `1px solid ${item.badge === 'LIVE' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 212, 255, 0.3)'}`,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer / Citizen Portal Link */}
        <div
          style={{
            padding: collapsed ? '12px 0' : '12px 14px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}
        >
          {!collapsed ? (
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.72rem',
              }}
            >
              <span>Citizen Portal (Ext)</span>
              <ExternalLink size={12} />
            </a>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <ExternalLink size={14} color="var(--text-muted)" />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '56px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flexShrink: 0,
            zIndex: 20,
          }}
        >
          {/* Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, maxWidth: '480px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search Account, Case #, Phone, ATM ID, or Node..."
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
          </div>

          {/* Top Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <StatusIndicator status={wsStatus} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 212, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={13} color="var(--accent-cyan)" />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Officer R. Sharma
                </div>
                <div style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                  I4C CYBER CELL · LEA
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '6px',
              }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dynamic Outlet / Content */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
