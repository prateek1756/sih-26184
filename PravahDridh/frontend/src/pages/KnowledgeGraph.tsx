/**
 * PravahDridh — Simple Dynamic Knowledge Graph
 * Clean force-directed canvas: 10 nodes, 10 edges, live flow particles, drag + click.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw, ArrowRight, MapPin, Zap, Lock, Unlock, PlusCircle, Loader2 } from 'lucide-react';
import { mockGraphNodes, mockGraphEdges, GraphNode, GraphEdge } from '../services/mockData';
import { graphApi } from '../api';
import { SeverityBadge } from '../components/common/SeverityBadge';
import {
  renderRealImageNode,
  preloadAllGraphImages,
  resolveNodeImage,
  NODE_IMAGES,
} from '../services/graphImageResolver';

// ── Visual config per entity type ─────────────────────────────────────────────
const TYPE_CFG: Record<string, { color: string; radius: number; icon: string }> = {
  Person:        { color: '#c084fc', radius: 30, icon: '👤' },
  Account:       { color: '#00d4ff', radius: 28, icon: '🏦' },
  ATM:           { color: '#f97316', radius: 28, icon: '🏧' },
  Device:        { color: '#4ade80', radius: 26, icon: '📱' },
  Phone:         { color: '#facc15', radius: 26, icon: '📞' },
  Case:          { color: '#ef4444', radius: 28, icon: '⚖️' },
  Complaint:     { color: '#ef4444', radius: 28, icon: '📋' },
  Investigation: { color: '#8b5cf6', radius: 28, icon: '🔍' },
  Alert:         { color: '#eab308', radius: 26, icon: '⚡' },
  Prediction:    { color: '#06b6d4', radius: 26, icon: '🎯' },
  Location:      { color: '#38bdf8', radius: 28, icon: '📍' },
  Transaction:   { color: '#f43f5e', radius: 24, icon: '💸' },
};

interface Particle { id: number; edgeIdx: number; progress: number; speed: number; }

export const KnowledgeGraph: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const caseIdParam = searchParams.get('case_id');

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number | null>(null);
  const dragRef    = useRef<{ nodeId: string | null; hasMoved: boolean }>({ nodeId: null, hasMoved: false });
  const particlesRef = useRef<Particle[]>([]);
  // Always-fresh node positions for hit-testing (avoids stale-closure bug)
  const nodesRef   = useRef<GraphNode[]>([]);

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [zoom, setZoom]  = useState(1);
  const [pan,  setPan]   = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // Fetch real database knowledge graph
  useEffect(() => {
    let isMounted = true;
    async function fetchGraph() {
      setIsLoading(true);
      try {
        const resp = caseIdParam 
          ? await graphApi.getCaseGraph(caseIdParam)
          : await graphApi.getGraph(120);

        if (!isMounted) return;
        if (resp && resp.nodes && resp.nodes.length > 0) {
          const n = resp.nodes.length;
          const mappedNodes: GraphNode[] = resp.nodes.map((nd, i) => {
            const angle = (i / n) * Math.PI * 2;
            const dist = 180 + (i % 4) * 60;
            return {
              id: nd.id,
              label: nd.label,
              type: (nd.type in TYPE_CFG ? nd.type : 'Account') as any,
              riskScore: Math.round((nd.riskScore ?? (nd.isSuspicious ? 0.88 : 0.45)) * 100),
              x: 520 + Math.cos(angle) * dist,
              y: 340 + Math.sin(angle) * dist,
              vx: 0,
              vy: 0,
              amount: nd.properties?.amount || nd.properties?.reported_amount,
              details: nd.subType || nd.properties?.category || nd.properties?.bank_name || nd.properties?.atm_code || '',
              subNetwork: nd.properties?.victim_city || nd.properties?.city || 'NCR Network',
              status: nd.properties?.status || (nd.isSuspicious ? 'SUSPICIOUS' : 'ACTIVE'),
              imageUrl: resolveNodeImage(nd),
            };
          });

          const mappedEdges: GraphEdge[] = resp.edges.map(e => ({
            source: e.source,
            target: e.target,
            relationship: (e.label || e.type || 'Connected To') as any,
            amount: e.amount,
            isSuspicious: e.isSuspicious,
          }));

          setNodes(mappedNodes);
          setEdges(mappedEdges);
          setStats(resp.stats || {});
          setSelectedId(mappedNodes[0].id);
        } else {
          // Fallback to mock
          setNodes(mockGraphNodes);
          setEdges(mockGraphEdges);
          setSelectedId('PER-001');
        }
      } catch (err) {
        console.warn('Knowledge graph live fetch failed, using fallback:', err);
        setNodes(mockGraphNodes);
        setEdges(mockGraphEdges);
        setSelectedId('PER-001');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchGraph();
    return () => { isMounted = false; };
  }, [caseIdParam]);

  // Panning drag
  const panDrag = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false, sx: 0, sy: 0, px: 0, py: 0,
  });

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId]);

  const connectedIds = useMemo(() => {
    const s = new Set<string>([selectedId]);
    edges.forEach(e => {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    });
    return s;
  }, [selectedId, edges]);

  // ── Init flow particles ────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = edges.map((e, idx) => ({
      id: Math.random(),
      edgeIdx: idx,
      progress: Math.random(),
      speed: e.isSuspicious ? 0.007 + Math.random() * 0.005 : 0.003 + Math.random() * 0.003,
    }));
  }, [edges]);

  // ── Canvas resize helper ───────────────────────────────────────────────────
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const p = c.parentElement;
    if (p) { c.width = p.clientWidth; c.height = p.clientHeight; }
  }, []);

  // ── Main animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const canvas = canvasRef.current;
      const ctx    = canvas?.getContext('2d');
      if (!canvas || !ctx) { rafRef.current = requestAnimationFrame(tick); return; }

      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;

      // ── Physics update ─────────────────────────────────────────────────
      setNodes(prev => {
        const ns = prev.map(n => ({ ...n }));
        const byId = new Map(ns.map(n => [n.id, n]));

        // Repulsion
        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i], b = ns[j];
            const dx = (a.x ?? cx) - (b.x ?? cx);
            const dy = (a.y ?? cy) - (b.y ?? cy);
            const d2 = dx * dx + dy * dy + 1;
            if (d2 > 120000) continue;
            const f = 5000 / d2;
            const d = Math.sqrt(d2);
            if (a.id !== dragRef.current.nodeId && !a.isPinned) { a.vx = (a.vx ?? 0) + (dx / d) * f; a.vy = (a.vy ?? 0) + (dy / d) * f; }
            if (b.id !== dragRef.current.nodeId && !b.isPinned) { b.vx = (b.vx ?? 0) - (dx / d) * f; b.vy = (b.vy ?? 0) - (dy / d) * f; }
          }
        }

        // Spring attraction along edges
        edges.forEach(e => {
          const s = byId.get(e.source), t = byId.get(e.target);
          if (!s || !t) return;
          const dx = (t.x ?? cx) - (s.x ?? cx);
          const dy = (t.y ?? cy) - (s.y ?? cy);
          const d  = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const f  = (d - 140) * 0.04;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          if (s.id !== dragRef.current.nodeId && !s.isPinned) { s.vx = (s.vx ?? 0) + fx; s.vy = (s.vy ?? 0) + fy; }
          if (t.id !== dragRef.current.nodeId && !t.isPinned) { t.vx = (t.vx ?? 0) - fx; t.vy = (t.vy ?? 0) - fy; }
        });

        // Gravity + damping + integrate
        ns.forEach(n => {
          if (n.id === dragRef.current.nodeId || n.isPinned) return;
          n.vx = ((n.vx ?? 0) + (cx - (n.x ?? cx)) * 0.001) * 0.84;
          n.vy = ((n.vy ?? 0) + (cy - (n.y ?? cy)) * 0.001) * 0.84;
          n.x  = Math.max(40, Math.min(W - 40, (n.x ?? cx) + n.vx));
          n.y  = Math.max(40, Math.min(H - 40, (n.y ?? cy) + n.vy));
        });

        // ★ Keep nodesRef in sync so mouse handlers always have fresh coords
        nodesRef.current = ns;
        return ns;
      });

      // ── Advance particles ──────────────────────────────────────────────
      particlesRef.current.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
      });

      // ── Draw ───────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#080d18';
      ctx.fillRect(0, 0, W, H);

      // Subtle dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let gx = 0; gx < W; gx += 44) for (let gy = 0; gy < H; gy += 44) ctx.fillRect(gx, gy, 1.5, 1.5);

      ctx.save();
      ctx.translate(cx + panRef.current.x, cy + panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(-cx, -cy);

      // Get current snapshot for rendering — use ref for freshest coords
      const snap = nodesRef.current.length ? nodesRef.current : nodes;
      const byId = new Map(snap.map(n => [n.id, n]));

      // ── Draw Edges ─────────────────────────────────────────────────────
      edges.forEach(e => {
        const s = byId.get(e.source), t = byId.get(e.target);
        if (!s || !t || s.x === undefined || t.x === undefined) return;

        const isLit = connectedIds.has(s.id) && connectedIds.has(t.id);
        const fade  = connectedIds.size > 1 && !isLit;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x, t.y!);
        ctx.strokeStyle = fade
          ? 'rgba(255,255,255,0.05)'
          : e.isSuspicious
            ? (isLit ? '#f43f5e' : 'rgba(244,63,94,0.3)')
            : (isLit ? '#00d4ff' : 'rgba(0,212,255,0.18)');
        ctx.lineWidth = isLit ? 2.5 : 1.2;
        ctx.shadowBlur  = isLit ? 10 : 0;
        ctx.shadowColor = e.isSuspicious ? '#f43f5e' : '#00d4ff';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Tiny arrowhead mid-edge
        if (!fade) {
          const mx = (s.x + t.x) / 2, my = (s.y! + t.y!) / 2;
          const ang = Math.atan2(t.y! - s.y!, t.x - s.x);
          ctx.save();
          ctx.translate(mx, my); ctx.rotate(ang);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-7,-3); ctx.lineTo(-7,3); ctx.closePath();
          ctx.fillStyle = e.isSuspicious ? '#f43f5e' : '#00d4ff';
          ctx.fill();
          ctx.restore();
        }

        // Amount label
        if (isLit && e.amount) {
          const mx = (s.x + t.x) / 2, my = (s.y! + t.y!) / 2;
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText(`₹${(e.amount / 1000).toFixed(0)}k`, mx, my - 8);
        }
      });

      // ── Flow Particles ─────────────────────────────────────────────────
      particlesRef.current.forEach(p => {
        const e = edges[p.edgeIdx];
        if (!e) return;
        const s = byId.get(e.source), t = byId.get(e.target);
        if (!s || !t || s.x === undefined || t.x === undefined) return;

        const px = s.x + (t.x - s.x) * p.progress;
        const py = s.y! + (t.y! - s.y!) * p.progress;

        ctx.beginPath();
        ctx.arc(px, py, e.isSuspicious ? 4 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle   = e.isSuspicious ? '#fb7185' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur  = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ── Draw Nodes ─────────────────────────────────────────────────────
      snap.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        const cfg    = TYPE_CFG[node.type] ?? { color: '#00d4ff', radius: 28, icon: '●' };
        const isSel  = node.id === selectedId;
        const isConn = connectedIds.has(node.id);
        const fade   = connectedIds.size > 1 && !isConn;

        renderRealImageNode({
          ctx,
          node: {
            id: node.id,
            label: node.label,
            type: node.type,
            riskScore: node.riskScore,
            x: node.x,
            y: node.y,
            imageUrl: node.imageUrl,
          },
          radius: cfg.radius,
          color: cfg.color,
          isSelected: isSel,
          isConnected: isConn,
          isFaded: fade,
        });
      });

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, selectedId, connectedIds, resize]);

  // ── Canvas coord helper ────────────────────────────────────────────────────
  const toGraph = useCallback((ex: number, ey: number) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const cx = c.width / 2, cy = c.height / 2;
    return {
      x: (ex - r.left - cx - panRef.current.x) / zoomRef.current + cx,
      y: (ey - r.top  - cy - panRef.current.y) / zoomRef.current + cy,
    };
  }, []);

  // ★ Use nodesRef so we always test against the latest drawn positions
  const hitNode = useCallback((gx: number, gy: number) => {
    return nodesRef.current.find(n => {
      if (n.x === undefined) return false;
      const r = (TYPE_CFG[n.type]?.radius ?? 22) + 8; // +8 px generous hit-zone
      const dx = n.x - gx, dy = (n.y ?? 0) - gy;
      return dx * dx + dy * dy <= r * r;
    });
  }, []);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = toGraph(e.clientX, e.clientY);
    const h = hitNode(g.x, g.y);
    if (h) {
      dragRef.current = { nodeId: h.id, hasMoved: false };
      setSelectedId(h.id);
    } else {
      panDrag.current = { active: true, sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.nodeId) {
      dragRef.current.hasMoved = true;
      const g = toGraph(e.clientX, e.clientY);
      setNodes(prev => {
        const next = prev.map(n =>
          n.id === dragRef.current.nodeId ? { ...n, x: g.x, y: g.y, vx: 0, vy: 0, isPinned: true } : n
        );
        nodesRef.current = next;
        return next;
      });
    } else if (panDrag.current.active) {
      const dx = e.clientX - panDrag.current.sx;
      const dy = e.clientY - panDrag.current.sy;
      setPan({ x: panDrag.current.px + dx, y: panDrag.current.py + dy });
    } else {
      // ★ Change cursor to pointer when hovering over a node
      const g = toGraph(e.clientX, e.clientY);
      const h = hitNode(g.x, g.y);
      if (canvasRef.current) canvasRef.current.style.cursor = h ? 'pointer' : 'grab';
    }
  };

  const onMouseUp = () => {
    dragRef.current = { nodeId: null, hasMoved: false };
    panDrag.current.active = false;
  };

  const onDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = toGraph(e.clientX, e.clientY);
    const h = hitNode(g.x, g.y);
    if (h) setNodes(prev => prev.map(n => n.id === h.id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.35, z * (e.deltaY < 0 ? 1.1 : 0.91))));
  };

  // Discover new entity
  const onDiscover = () => {
    const id = `ACC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newNode: GraphNode = {
      id, label: `SBIN-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'Account', riskScore: Math.floor(82 + Math.random() * 15),
      details: 'Newly intercepted mule terminal via UPI velocity alert',
      status: 'SUSPICIOUS', subNetwork: 'Layer-3',
      x: 300 + Math.random() * 400, y: 200 + Math.random() * 300,
      vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6,
    };
    setNodes(p => [...p, newNode]);
    // edge from selected to new
    // edges are read-only state set once; use a local extend trick via particlesRef not needed
    // Just select it
    setSelectedId(id);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: 'var(--bg-primary)' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{
        width: '240px', flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        display: 'flex', flexDirection: 'column', gap: '0',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>
            KNOWLEDGE GRAPH
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 4px' }}>
            Syndicate Network
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Live force-directed mule ring — click a node to inspect.
          </p>
          {caseIdParam && (
            <div style={{
              marginTop: '10px', padding: '6px 10px',
              borderRadius: '4px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                CASE: {caseIdParam.slice(0, 10)}...
              </span>
              <button
                onClick={() => setSearchParams({})}
                style={{
                  background: 'none', border: 'none', color: '#fca5a5',
                  fontSize: '0.68rem', cursor: 'pointer', padding: '1px 4px',
                }}
              >
                ✕ Reset
              </button>
            </div>
          )}
        </div>

        {/* Node List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {nodes.map(n => {
            const cfg = TYPE_CFG[n.type] ?? { color: '#00d4ff', radius: 28, icon: '●' };
            const isSel = n.id === selectedId;
            const imgSrc = resolveNodeImage(n);
            const meta = NODE_IMAGES[n.id];
            return (
              <div
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                  marginBottom: '3px',
                  background: isSel ? `${cfg.color}18` : 'transparent',
                  border: `1px solid ${isSel ? cfg.color + '66' : 'transparent'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
                  <img
                    src={imgSrc}
                    alt={n.label}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `1.5px solid ${isSel ? '#ffffff' : cfg.color}`,
                      boxShadow: isSel ? `0 0 10px ${cfg.color}` : '0 2px 5px rgba(0,0,0,0.5)',
                    }}
                  />
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    fontSize: '9px', background: meta?.badgeBg || cfg.color,
                    borderRadius: '50%', width: 13, height: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}>
                    {meta?.badge || cfg.icon}
                  </span>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isSel ? '#ffffff' : 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {n.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: isSel ? cfg.color : 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    {n.type} · {n.riskScore}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onDiscover}
            style={{
              padding: '8px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.4)',
              color: 'var(--accent-cyan)', fontSize: '0.72rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <PlusCircle size={13} /> Discover Entity
          </button>
          <button
            onClick={() => { particlesRef.current.forEach(p => { p.speed *= 4; setTimeout(() => { p.speed /= 4; }, 2500); }); }}
            style={{
              padding: '8px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)',
              color: '#f87171', fontSize: '0.72rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <Zap size={13} color="#fbbf24" /> Laundering Burst
          </button>
        </div>
      </div>

      {/* ── CANVAS CENTER ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onDoubleClick={onDblClick}
          onWheel={onWheel}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
        />

        {/* Zoom Controls */}
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6, zIndex: 10 }}>
          {[
            { icon: <ZoomIn size={15} />,   action: () => setZoom(z => Math.min(2.5, z + 0.2)) },
            { icon: <ZoomOut size={15} />,  action: () => setZoom(z => Math.max(0.35, z - 0.2)) },
            { icon: <RotateCcw size={15} />, action: () => { setZoom(1); setPan({ x: 0, y: 0 }); } },
          ].map((b, i) => (
            <button key={i} onClick={b.action} style={{
              padding: 7, borderRadius: 6, cursor: 'pointer',
              background: 'rgba(10,14,26,0.88)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}>{b.icon}</button>
          ))}
        </div>

        {/* Bottom HUD */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          display: 'flex', gap: 14, alignItems: 'center',
          padding: '6px 14px', borderRadius: 6,
          background: 'rgba(10,14,26,0.88)', border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)', pointerEvents: 'none',
          fontSize: '0.68rem', fontFamily: 'JetBrains Mono',
        }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-cyan)' }}>
              <Loader2 size={13} className="animate-spin" /> Syncing PostgreSQL...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>LIVE DB</span>
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>Nodes <strong style={{ color: '#fff' }}>{nodes.length}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>Edges <strong style={{ color: '#fff' }}>{edges.length}</strong></span>
          {stats.accounts ? <span style={{ color: 'var(--text-muted)' }}>Accounts <strong style={{ color: '#00d4ff' }}>{stats.accounts}</strong></span> : null}
          {stats.atms ? <span style={{ color: 'var(--text-muted)' }}>ATMs <strong style={{ color: '#f97316' }}>{stats.atms}</strong></span> : null}
          <span style={{ color: 'var(--text-muted)' }}>Zoom <strong style={{ color: '#00d4ff' }}>{(zoom * 100).toFixed(0)}%</strong></span>
          <span style={{ color: '#475569' }}>Drag node · Double-click to pin</span>
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ──────────────────────────────────────────────── */}
      {selectedNode && (
        <div style={{
          width: '320px', flexShrink: 0,
          borderLeft: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', gap: 14,
          padding: '20px', overflowY: 'auto',
        }}>
          {/* Real Entity Photographic Profile Card */}
          <div style={{
            borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${TYPE_CFG[selectedNode.type]?.color || 'var(--accent-cyan)'}55`,
            background: 'var(--bg-card)', position: 'relative',
            boxShadow: `0 4px 16px ${TYPE_CFG[selectedNode.type]?.color || 'var(--accent-cyan)'}18`,
          }}>
            <div style={{ position: 'relative', width: '100%', height: 135 }}>
              <img
                src={resolveNodeImage(selectedNode)}
                alt={selectedNode.label}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(10,14,26,0.96) 0%, rgba(10,14,26,0.35) 60%, rgba(0,0,0,0.1) 100%)',
              }} />
              <div style={{
                position: 'absolute', top: 8, right: 8,
                padding: '2px 8px', borderRadius: 4,
                background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '0.62rem', fontFamily: 'JetBrains Mono', color: '#fff',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span>{NODE_IMAGES[selectedNode.id]?.badge || '●'}</span>
                <span>REAL ASSET</span>
              </div>
              <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                  {NODE_IMAGES[selectedNode.id]?.realEntityName || selectedNode.label}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>
                  {NODE_IMAGES[selectedNode.id]?.categoryLabel || `${selectedNode.type} Verified Node`}
                </div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono', color: TYPE_CFG[selectedNode.type]?.color || 'var(--accent-cyan)' }}>
                {selectedNode.type.toUpperCase()} ENTITY
              </span>
              <SeverityBadge severity={selectedNode.riskScore > 88 ? 'CRITICAL' : selectedNode.riskScore > 75 ? 'HIGH' : 'MEDIUM'} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {selectedNode.label}
            </h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>{selectedNode.id}</span>
              {selectedNode.status && (
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, fontFamily: 'JetBrains Mono',
                  padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(239,68,68,0.2)', color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.35)',
                }}>{selectedNode.status}</span>
              )}
            </div>
          </div>

          {/* Risk Card */}
          <div style={{
            padding: '12px 14px', borderRadius: 6,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mule Risk Score</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: selectedNode.riskScore > 85 ? '#ef4444' : '#f59e0b' }}>
                {selectedNode.riskScore}%
              </span>
            </div>
            {selectedNode.amount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Routed Funds</span>
                <span style={{ color: '#ffffff', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  ₹{selectedNode.amount.toLocaleString('en-IN')}
                </span>
              </div>
            )}
            {selectedNode.subNetwork && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network Cell</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{selectedNode.subNetwork}</span>
              </div>
            )}
            {selectedNode.details && (
              <p style={{
                fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 8,
                borderTop: '1px solid var(--border-subtle)', paddingTop: 8, lineHeight: 1.45,
              }}>{selectedNode.details}</p>
            )}
          </div>

          {/* Connected Edges */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
              CONNECTIONS ({edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {edges
                .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                .map((e, idx) => {
                  const otherId = e.source === selectedNode.id ? e.target : e.source;
                  const other   = nodes.find(n => n.id === otherId);
                  const out     = e.source === selectedNode.id;
                  const otherImg = resolveNodeImage(other || { id: otherId });
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedId(otherId)}
                      style={{
                        padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.72rem', gap: 8,
                      }}
                      onMouseEnter={el => (el.currentTarget.style.borderColor = 'var(--accent-cyan)')}
                      onMouseLeave={el => (el.currentTarget.style.borderColor = 'var(--border-subtle)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img
                          src={otherImg}
                          alt={other?.label || otherId}
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            objectFit: 'cover', flexShrink: 0,
                            border: '1px solid var(--border-subtle)',
                          }}
                        />
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{other?.label || otherId}</div>
                          <div style={{ color: out ? '#38bdf8' : '#a855f7', fontSize: '0.65rem', marginTop: 1 }}>
                            {out ? '→ outbound' : '← inbound'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: e.isSuspicious ? '#f87171' : 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                          {e.relationship}
                        </div>
                        {e.amount && (
                          <div style={{ color: '#64748b', fontSize: '0.65rem' }}>₹{e.amount.toLocaleString('en-IN')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedNode.type === 'Account' && (
              <button
                onClick={() => setNodes(p => p.map(n => n.id === selectedNode.id ? { ...n, status: n.status === 'FROZEN' ? 'SUSPICIOUS' : 'FROZEN' } : n))}
                style={{
                  padding: 9, borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'rgba(56,189,248,0.12)', border: '1px solid #38bdf855', color: '#38bdf8',
                }}
              >
                {selectedNode.status === 'FROZEN' ? <><Unlock size={13} /> Unfreeze Account</> : <><Lock size={13} /> Flag for Bank Freeze</>}
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard/forecast')}
              className="btn btn-primary"
              style={{ padding: 9, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              Withdrawal Forecast <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/dashboard/geo')}
              className="btn btn-ghost"
              style={{ padding: 8, fontSize: '0.78rem', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <MapPin size={14} color="var(--accent-cyan)" /> Locate on GIS Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
