import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  ArrowRight, 
  Lock, 
  Database,
  Cpu,
  ChevronRight,
  Globe,
  Radio,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  // Phase 0: 3D Point-Cloud Threat Sphere (Reference 2 & 3)
  const [stage, setStage] = useState<'3D_INTRO' | 'MAIN_LANDING'>('3D_INTRO');
  const introCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-transition to main landing after 7 seconds
  useEffect(() => {
    if (stage !== '3D_INTRO') return;
    const timer = setTimeout(() => {
      setStage('MAIN_LANDING');
    }, 7000);
    return () => clearTimeout(timer);
  }, [stage]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 3D ORBITAL GLOBE & POINT-CLOUD THREAT SPHERE (Images 2 & 3)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== '3D_INTRO') return;
    const canvas = introCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Enhanced 3D Digital Earth with Continent Landmass Detection & Realism
    interface Point3D {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      isLand: boolean;
      isThreat?: boolean;
      threatCity?: string;
      color?: string;
    }

    // Realistic global cyber threat hubs with geographic coordinates
    const threatCities = [
      { name: 'DELHI NCR [ACTIVE MULE HUB]', lat: 28.7, lon: 77.1, color: '#ef4444' },
      { name: 'MUMBAI FINANCIAL TERMINAL', lat: 19.0, lon: 72.8, color: '#f59e0b' },
      { name: 'LONDON APT INTELLIGENCE', lat: 51.5, lon: -0.1, color: '#38bdf8' },
      { name: 'NEW YORK COMPLIANCE GATEWAY', lat: 40.7, lon: -74.0, color: '#00d4ff' },
      { name: 'SINGAPORE CRYPTO ROUTER', lat: 1.35, lon: 103.8, color: '#10b981' },
      { name: 'MEXICO CITY CASH-OUT SYNDICATE', lat: 19.4, lon: -99.1, color: '#ef4444' },
      { name: 'DUBAI ESCROW NODE', lat: 25.2, lon: 55.3, color: '#f59e0b' },
    ];

    // Continental shape approximation function based on lat/lon
    const isContinentalLand = (lat: number, lon: number): boolean => {
      // North America
      if (lat >= 15 && lat <= 70 && lon >= -165 && lon <= -55) return true;
      // South America
      if (lat >= -55 && lat <= 12 && lon >= -82 && lon <= -35) return true;
      // Europe
      if (lat >= 36 && lat <= 71 && lon >= -10 && lon <= 42) return true;
      // Africa
      if (lat >= -35 && lat <= 37 && lon >= -18 && lon <= 51) return true;
      // Asia & India
      if (lat >= 5 && lat <= 75 && lon >= 42 && lon <= 150) return true;
      // Australia
      if (lat >= -45 && lat <= -10 && lon >= 112 && lon <= 154) return true;
      return false;
    };

    const sphereRadius = Math.min(width, height) * 0.35;
    const points: Point3D[] = [];
    const numPoints = 2400; // Much higher density for crisp resolution

    for (let i = 0; i < numPoints; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numPoints);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      const lat = 90 - (phi * 180) / Math.PI;
      const lon = ((theta * 180) / Math.PI) % 360 - 180;

      const isLand = isContinentalLand(lat, lon);

      // Only plot continental dots + sparse oceanic grid points for realistic digital twin
      if (isLand || i % 4 === 0) {
        const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
        const y = -sphereRadius * Math.cos(phi);
        const z = sphereRadius * Math.sin(phi) * Math.sin(theta);

        points.push({
          x, y, z,
          baseX: x, baseY: y, baseZ: z,
          isLand,
        });
      }
    }

    // Threat beacon points
    threatCities.forEach((city) => {
      const phi = ((90 - city.lat) * Math.PI) / 180;
      const theta = ((city.lon + 180) * Math.PI) / 180;
      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = -sphereRadius * Math.cos(phi);
      const z = sphereRadius * Math.sin(phi) * Math.sin(theta);

      points.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        isLand: true,
        isThreat: true,
        threatCity: city.name,
        color: city.color,
      });
    });

    let rotY = 1.2;
    let rotX = 0.22;
    let pulseVal = 0;

    const render3D = () => {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, width, height);

      rotY += 0.005;
      pulseVal += 0.04;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const cx = width > 900 ? width * 0.64 : width * 0.5;
      const cy = height * 0.5;

      // Draw Inner Globe Atmosphere Halo
      const atmoGrad = ctx.createRadialGradient(cx, cy, sphereRadius * 0.8, cx, cy, sphereRadius * 1.15);
      atmoGrad.addColorStop(0, 'rgba(0, 212, 255, 0.03)');
      atmoGrad.addColorStop(0.85, 'rgba(0, 212, 255, 0.12)');
      atmoGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Cyber Orbital Geodesic Rings (Reference 2 & 3)
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const tilt = 0.35 + r * 0.3;
        ctx.ellipse(cx, cy, sphereRadius * (1.28 + r * 0.12), sphereRadius * (0.62 + r * 0.08), tilt, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.12 + r * 0.05})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Project & sort 3D points
      const projected = points.map((p) => {
        // Rotate Y
        let x1 = p.baseX * cosY - p.baseZ * sinY;
        let z1 = p.baseZ * cosY + p.baseX * sinY;
        // Rotate X
        let y1 = p.baseY * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.baseY * sinX;

        const fov = 1000;
        const scale = fov / (fov + z2);
        const projX = cx + x1 * scale;
        const projY = cy + y1 * scale;

        return {
          ...p,
          projX,
          projY,
          scale,
          z2,
        };
      });

      // Sort by Z for true 3D depth rendering
      projected.sort((a, b) => a.z2 - b.z2);

      // Render points with realistic shading
      projected.forEach((p) => {
        const isFacing = p.z2 > -sphereRadius * 0.35; // Backface culling to keep front crisp and clear
        if (!isFacing && !p.isThreat) return;

        const depthAlpha = Math.max(0.1, Math.min(1, (p.z2 + sphereRadius) / (sphereRadius * 1.8)));

        if (p.isThreat) {
          if (p.z2 < -100) return; // Don't render threat labels when on the back side of globe

          const beaconSize = (6 + Math.sin(pulseVal) * 2) * p.scale;

          // Glowing radar shockwave
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, beaconSize * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = p.color + '33';
          ctx.fill();

          // Beacon center
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, beaconSize, 0, Math.PI * 2);
          ctx.fillStyle = p.color || '#ef4444';
          ctx.fill();

          // Crisp Technical HUD Callout
          const lineLength = 28 * p.scale;
          ctx.beginPath();
          ctx.moveTo(p.projX, p.projY);
          ctx.lineTo(p.projX + lineLength, p.projY - lineLength);
          ctx.lineTo(p.projX + lineLength + 70, p.projY - lineLength);
          ctx.strokeStyle = p.color || '#ef4444';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(p.threatCity || 'THREAT BEACON', p.projX + lineLength + 6, p.projY - lineLength - 4);
        } else if (p.isLand) {
          // Continental landmass points: Vibrant emerald / cyan digital matrix
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, 1.6 * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 230, 200, ${depthAlpha * 0.9})`;
          ctx.fill();
        } else {
          // Ocean grid points: Subtle navy/blue dots
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, 1.0 * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 150, 255, ${depthAlpha * 0.25})`;
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(render3D);
    };

    render3D();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, [stage]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STAGE 1 ANIMATED NETWORK CANVAS (Original Reference 1)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'MAIN_LANDING') return;
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 650);

    const onResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight || 650;
    };
    window.addEventListener('resize', onResize);

    const nodeTypes = [
      { type: 'Account', color: '#00d4ff', radius: 6 },
      { type: 'Person', color: '#6366f1', radius: 7 },
      { type: 'ATM', color: '#f59e0b', radius: 6 },
      { type: 'Device', color: '#10b981', radius: 5 },
      { type: 'Case', color: '#ef4444', radius: 8 },
      { type: 'Location', color: '#38bdf8', radius: 6 },
      { type: 'Transaction', color: '#94a3b8', radius: 4 },
    ];

    interface Node2D {
      x: number;
      y: number;
      vx: number;
      vy: number;
      type: string;
      color: string;
      radius: number;
      pulse: number;
    }

    const nodes: Node2D[] = Array.from({ length: 42 }, () => {
      const t = nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        type: t.type,
        color: t.color,
        radius: t.radius,
        pulse: Math.random() * Math.PI,
      };
    });

    const renderNetwork = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.05)';
      ctx.lineWidth = 1;
      [140, 260, 380].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        n1.x += n1.vx;
        n1.y += n1.vy;
        n1.pulse += 0.03;

        // Bounce at canvas outer boundaries
        if (n1.x < 30 || n1.x > width - 30) n1.vx *= -1;
        if (n1.y < 30 || n1.y > height - 30) n1.vy *= -1;

        // Repel nodes away from central hero text area to prevent text collision/overlap
        const textZoneRadiusX = Math.min(width * 0.38, 480);
        const textZoneRadiusY = 190;
        const dxCenter = n1.x - cx;
        const dyCenter = n1.y - cy;
        const normalizedDist = (dxCenter * dxCenter) / (textZoneRadiusX * textZoneRadiusX) + 
                               (dyCenter * dyCenter) / (textZoneRadiusY * textZoneRadiusY);

        if (normalizedDist < 1.0) {
          // Push node outward away from center text zone
          const angle = Math.atan2(dyCenter, dxCenter);
          n1.vx += Math.cos(angle) * 0.4;
          n1.vy += Math.sin(angle) * 0.4;
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.25;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            if (dist < 80 && (i + j) % 3 === 0) {
              const t = (Math.sin(n1.pulse) + 1) / 2;
              const px = n1.x + (n2.x - n1.x) * t;
              const py = n1.y + (n2.y - n1.y) * t;
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fillStyle = '#00d4ff';
              ctx.fill();
            }
          }
        }
      }

      nodes.forEach((n) => {
        // Fade out nodes slightly if they enter the near-center reading area
        const dxCenter = n.x - cx;
        const dyCenter = n.y - cy;
        const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        const textClearanceAlpha = Math.min(1, Math.max(0.15, distFromCenter / 280));

        const pulseSize = n.radius + Math.sin(n.pulse) * 1.5;
        const glow = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, pulseSize * 2.5);
        glow.addColorStop(0, n.color + '44');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseSize * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = textClearanceAlpha;
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(n.type, n.x + pulseSize + 4, n.y + 3);
        ctx.globalAlpha = 1.0;
      });

      animId = requestAnimationFrame(renderNetwork);
    };

    renderNetwork();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, [stage]);

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW RENDERER
  // ──────────────────────────────────────────────────────────────────────────

  if (stage === '3D_INTRO') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#050811' }}>
        {/* Fullscreen 3D Canvas */}
        <canvas ref={introCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Top Header Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            padding: '24px 48px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 20,
            background: 'linear-gradient(to bottom, rgba(5,8,17,0.9), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                PravahDridh
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setStage('MAIN_LANDING')}
              style={{
                padding: '7px 16px',
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '6px',
                color: 'var(--accent-cyan)',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Skip Intro</span>
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Launch Platform</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Left Side Content Overlay (Inspired by Reference Image 2 & 3) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '48px',
            transform: 'translateY(-50%)',
            maxWidth: '520px',
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--accent-cyan)',
              marginBottom: '18px',
            }}
          >
            <Radio size={12} className="animate-pulse" />
            <span>GLOBAL THREAT SURVEILLANCE MATRIX</span>
          </div>

          <h1
            style={{
              fontSize: '2.8rem',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#ffffff',
              letterSpacing: '-0.03em',
              marginBottom: '14px',
            }}
          >
            ENTER AI-POWERED CYBERCRIME INTELLIGENCE
          </h1>

          <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '28px' }}>
            Autonomous predictive telemetry tracking syndicate mule networks, ATM cash drains, and cross-state fraud vectors in real time.
          </p>

          {/* Reference 2 style tactical action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '380px' }}>
            <button
              onClick={() => setStage('MAIN_LANDING')}
              style={{
                padding: '12px 18px',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '6px',
                color: 'var(--accent-cyan)',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>360° WITHDRAWAL FORECAST ENGINE</span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 18px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #10b981',
                borderRadius: '6px',
                color: '#34d399',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>INVESTIGATE CONNECTED MULE NETWORKS</span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => navigate('/dashboard/alerts')}
              style={{
                padding: '12px 18px',
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                color: '#f87171',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>DISPATCH CRITICAL LEA INCIDENT ALERT</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Tactical Surveillance Telemetry Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '48px',
            right: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            backgroundColor: 'rgba(10, 14, 26, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            backdropFilter: 'blur(12px)',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                GLOBAL CYBERCRIME RADAR
              </span>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Mule Networks Tracked:</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                342 Clusters
              </span>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Forecast Accuracy:</span>
              <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                93.4% Hit Rate
              </span>
            </div>
          </div>

          {/* Right portion removed per request */}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN LANDING STAGE (Original Reference 1)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', overflowX: 'hidden' }}>
      {/* Top Navigation */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 48px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(10, 13, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em' }}>PravahDridh</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Financial Crime Intelligence & Predictive Analytics</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Lock size={13} color="var(--text-muted)" />
            <span>LEA Authorized</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            Launch Platform <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ position: 'relative', minHeight: '620px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        {/* Soft Radial Backdrop Vignette ensuring 100% text legibility */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '850px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(10, 13, 20, 0.92) 0%, rgba(10, 13, 20, 0.75) 55%, transparent 80%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Canvas Background */}
        <canvas
          ref={heroCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '960px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: '20px',
              marginBottom: '24px',
              fontSize: '0.75rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--accent-cyan)',
            }}
          >
            <Cpu size={14} />
            <span>NEURAL FRAUD FORECAST ENGINE ACTIVE</span>
          </div>

          <h1
            style={{
              fontSize: '3.4rem',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '16px',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Predict. Detect. Investigate.
          </h1>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 500,
              color: 'var(--accent-cyan)',
              marginBottom: '20px',
              letterSpacing: '-0.01em',
            }}
          >
            AI-Powered Financial Crime Intelligence
          </h2>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--text-secondary)',
              maxWidth: '740px',
              margin: '0 auto 36px auto',
              lineHeight: 1.6,
            }}
          >
            Analyze financial and cybercrime data, uncover hidden networks, identify high-risk
            locations, and forecast potential suspicious withdrawal activity before it happens.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{
                padding: '14px 28px',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 24px rgba(0, 212, 255, 0.35)',
              }}
            >
              Launch Intelligence Platform <ArrowRight size={18} />
            </button>
            <a
              href="#capabilities"
              className="btn btn-ghost"
              style={{
                padding: '14px 26px',
                fontSize: '0.95rem',
                border: '1px solid var(--border-subtle)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Explore Capabilities
            </a>
          </div>

          {/* Quick Metrics Strip */}
          <div
            style={{
              marginTop: '56px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              textAlign: 'left',
            }}
          >
            {[
              { label: 'SUSPICIOUS TRANSACTIONS', val: '14,820+', sub: 'Flagged by ML pipeline' },
              { label: 'CONNECTED NETWORKS', val: '342 Rings', sub: 'Multi-layer money mule clusters' },
              { label: 'PREDICTION ACCURACY', val: '93.4%', sub: '24h cash-out forecast hit rate' },
              { label: 'DECISION LATENCY', val: '< 180ms', sub: 'Real-time risk scoring stream' },
            ].map((m, idx) => (
              <div
                key={idx}
                className="glass-panel"
                style={{ padding: '16px 20px', borderLeft: '3px solid var(--accent-cyan)' }}
              >
                <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
                  {m.val}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: '60px 48px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
              INTELLIGENCE PIPELINE
            </span>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '6px' }}>How It Works</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {[
              { step: '01', title: 'Collect', desc: 'Ingest raw bank records, cyber complaints & transaction logs (CSV, XLSX, JSON).' },
              { step: '02', title: 'Analyze', desc: 'Extract accounts, validate schemas & detect structuring/velocity anomalies.' },
              { step: '03', title: 'Connect', desc: 'Construct full multi-hop Knowledge Graph across persons, cards & ATMs.' },
              { step: '04', title: 'Predict', desc: 'Forecast withdrawal hotspots & cash-out zones up to 7 days in advance.' },
              { step: '05', title: 'Act', desc: 'Dispatch actionable alerts, manage investigation dossiers & compile reports.' },
            ].map((s, idx) => (
              <div
                key={idx}
                className="glass-panel"
                style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
              >
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'rgba(0, 212, 255, 0.25)',
                    marginBottom: '8px',
                  }}
                >
                  {s.step}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" style={{ padding: '80px 48px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em' }}>
            TACTICAL MODULES
          </span>
          <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>
            Comprehensive Financial Crime Capabilities
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            {
              title: 'Transaction Intelligence',
              desc: 'High-throughput ingestion & filtering of millions of transactions with real-time risk classification.',
              tag: 'INGEST & FILTER',
            },
            {
              title: 'Knowledge Graph',
              desc: 'Interactive entity-relationship network mapping mules, accounts, shared phone numbers, and cross-bank ties.',
              tag: 'GRAPH TOPOLOGY',
            },
            {
              title: 'Geographic Risk GIS',
              desc: 'Spatial crime heatmaps distinguishing historical incident clusters from predictive withdrawal hotspots.',
              tag: 'SPATIAL HEATMAP',
            },
            {
              title: 'Predictive Analytics',
              desc: 'Explainable AI forecasts predicting exact ATM withdrawal hubs with confidence metrics and signal attribution.',
              tag: '7-DAY FORECAST',
            },
            {
              title: 'Real-Time Alerts',
              desc: 'Configurable automated alerts dispatched to LEA investigators, bank fraud units, and I4C officers.',
              tag: 'INSTANT DISPATCH',
            },
            {
              title: 'Investigation Workspace',
              desc: 'End-to-end evidence locker, case notes, complaint bridging, and one-click intelligence report generator.',
              tag: 'EVIDENCE DOSSIER',
            },
          ].map((c, idx) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: '28px',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/dashboard')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-cyan)',
                    padding: '2px 6px',
                    background: 'rgba(0, 212, 255, 0.08)',
                    borderRadius: '3px',
                  }}
                >
                  {c.tag}
                </span>
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {c.title}
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                {c.desc}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                <span>Access Module</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <div>PravahDridh · Financial Crime Intelligence Platform</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>Decision Support System</span>
          <span>·</span>
          <span>Human-in-the-Loop Architecture</span>
          <span>·</span>
          <span>Law Enforcement Authorized</span>
        </div>
      </footer>
    </div>
  );
};
