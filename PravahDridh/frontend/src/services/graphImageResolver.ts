/**
 * PravahDridh — Syndicate Network Real Image Resolver & Canvas Renderer
 * Resolves authentic photographic portraits, real bank cards/logos, devices, ATMs,
 * and handles high-performance 60 FPS HTML5 Canvas caching & rendering.
 */

export interface EntityImageMeta {
  url: string;
  badge: string;
  badgeBg: string;
  realEntityName: string;
  categoryLabel: string;
}

// ── Master Image Manifest ───────────────────────────────────────────────────
export const NODE_IMAGES: Record<string, EntityImageMeta> = {
  // Suspects / Persons
  'PER-001': {
    url: '/images/vikas_verma.jpg',
    badge: '🎯',
    badgeBg: '#ef4444',
    realEntityName: 'Vikas Verma (Kingpin)',
    categoryLabel: 'Suspect Mugshot · NCRB Matched',
  },
  'PER-401': {
    url: '/images/ramesh_mule.jpg',
    badge: '👤',
    badgeBg: '#f59e0b',
    realEntityName: 'Ramesh K. (Primary Mule)',
    categoryLabel: 'Mule Bio-Identity · Verified KYC',
  },

  // Bank Accounts (Real Indian Banking Brands)
  'ACC-3341': {
    url: '/images/bank_hdfc.jpg',
    badge: '🏦',
    badgeBg: '#004c8f',
    realEntityName: 'HDFC Bank Ltd. (A/C: 9912-3341)',
    categoryLabel: 'Corporate Current Account · Tier-2 Mule',
  },
  'ACC-8819': {
    url: '/images/bank_sbi.jpg',
    badge: '🏦',
    badgeBg: '#1a4480',
    realEntityName: 'State Bank of India (A/C: 0442-8819)',
    categoryLabel: 'SBI Savings Account · Cash-Out Destination',
  },
  'ACC-7721': {
    url: '/images/bank_icici.jpg',
    badge: '🏦',
    badgeBg: '#bd3312',
    realEntityName: 'ICICI Bank Ltd. (A/C: 1102-7721)',
    categoryLabel: 'Direct Victim Transfer Account · Tier-1',
  },

  // Terminal ATM
  'ATM-04': {
    url: '/images/atm_kiosk.jpg',
    badge: '🏧',
    badgeBg: '#f97316',
    realEntityName: 'Rohini Sector-8 On-site ATM Kiosk',
    categoryLabel: 'Diebold Nixdorf ATM Terminal #ROH-04',
  },

  // Command Hardware / Mobile Device
  'DEV-704': {
    url: '/images/device_redmi.jpg',
    badge: '📱',
    badgeBg: '#10b981',
    realEntityName: 'Xiaomi Redmi Note 12 5G (IMEI Captured)',
    categoryLabel: 'Seized Remote Screen-Share Controller',
  },

  // Spoofed VoIP / Telecom SIM
  'PHN-771': {
    url: '/images/phone_sim.jpg',
    badge: '📶',
    badgeBg: '#eab308',
    realEntityName: 'Jio 5G SIM · Spoofed CBI Hotline (+91-98102-88190)',
    categoryLabel: 'Encrypted Burner Line · VoIP Layered',
  },

  // Legal FIR Docket
  'CAS-142': {
    url: '/images/fir_case.jpg',
    badge: '⚖️',
    badgeBg: '#ef4444',
    realEntityName: 'CBI Cyber Crime FIR #2026-00142',
    categoryLabel: 'Extortion & Digital Arrest Prosecution',
  },

  // GIS Location Hotspot
  'LOC-DEL': {
    url: '/images/location_corridor.jpg',
    badge: '📍',
    badgeBg: '#0284c7',
    realEntityName: 'Rohini Commercial Financial Corridor',
    categoryLabel: 'Satellite Reconnaissance · High Cash-Drain Zone',
  },
};

// ── Smart Fallback Resolver by Type / Name ──────────────────────────────────
export function resolveNodeImage(node: { id?: string; label?: string; type?: string; imageUrl?: string }): string {
  if (node.imageUrl) return node.imageUrl;
  if (node.id && NODE_IMAGES[node.id]) return NODE_IMAGES[node.id].url;

  const lbl = (node.label || '').toLowerCase();
  const typ = (node.type || '').toLowerCase();

  // Bank accounts by institution name
  if (lbl.includes('sbi') || lbl.includes('sbin')) return '/images/bank_sbi.jpg';
  if (lbl.includes('hdfc')) return '/images/bank_hdfc.jpg';
  if (lbl.includes('icic')) return '/images/bank_icici.jpg';
  if (typ === 'account') return '/images/bank_hdfc.jpg';

  // Persons by name
  if (lbl.includes('vikas') || lbl.includes('verma')) return '/images/vikas_verma.jpg';
  if (lbl.includes('ramesh')) return '/images/ramesh_mule.jpg';
  if (typ === 'person') return '/images/vikas_verma.jpg';

  // Hardware & Telecom
  if (typ === 'device' || lbl.includes('phone') || lbl.includes('note')) return '/images/device_redmi.jpg';
  if (typ === 'phone' || lbl.includes('+91')) return '/images/phone_sim.jpg';

  // Infrastructure & Law
  if (typ === 'atm' || lbl.includes('atm')) return '/images/atm_kiosk.jpg';
  if (typ === 'case' || typ === 'complaint' || lbl.includes('fir')) return '/images/fir_case.jpg';
  if (typ === 'location' || lbl.includes('corridor') || lbl.includes('sector')) return '/images/location_corridor.jpg';

  return '/images/bank_sbi.jpg';
}

// ── In-Memory HTML5 Canvas Image Preloader Cache ─────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();
const loadingSet = new Set<string>();

export function preloadAllGraphImages(onLoadCallback?: () => void) {
  const urls = [
    '/images/vikas_verma.jpg',
    '/images/ramesh_mule.jpg',
    '/images/bank_sbi.jpg',
    '/images/bank_hdfc.jpg',
    '/images/bank_icici.jpg',
    '/images/device_redmi.jpg',
    '/images/phone_sim.jpg',
    '/images/atm_kiosk.jpg',
    '/images/fir_case.jpg',
    '/images/location_corridor.jpg',
  ];

  urls.forEach((url) => {
    if (imageCache.has(url) || loadingSet.has(url)) return;
    loadingSet.add(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      imageCache.set(url, img);
      loadingSet.delete(url);
      if (onLoadCallback) onLoadCallback();
    };
    img.onerror = () => {
      loadingSet.delete(url);
    };
  });
}

// Auto-run preloading immediately on module evaluation
preloadAllGraphImages();

export function getCachedImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  if (!loadingSet.has(url)) {
    preloadAllGraphImages();
  }
  return null;
}

// ── Realistic Canvas Node Rendering Engine ─────────────────────────────────
export interface DrawNodeOptions {
  ctx: CanvasRenderingContext2D;
  node: {
    id: string;
    label: string;
    type: string;
    riskScore: number;
    x: number;
    y: number;
    imageUrl?: string;
  };
  radius: number;
  color: string;
  isSelected: boolean;
  isConnected: boolean;
  isFaded: boolean;
}

export function renderRealImageNode({
  ctx,
  node,
  radius,
  color,
  isSelected,
  isConnected,
  isFaded,
}: DrawNodeOptions) {
  const { x, y } = node;
  const imageUrl = resolveNodeImage(node);
  const img = getCachedImage(imageUrl);

  ctx.save();
  ctx.globalAlpha = isFaded ? 0.22 : 1.0;

  // 1. Double Outer Tactical Target Reticle (for Selected Node)
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 14, 0, Math.PI * 2);
    ctx.fillStyle = color + '22';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner targeting brackets
    const bSize = 6;
    const bOffset = radius + 16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x - bOffset, y - bOffset + bSize);
    ctx.lineTo(x - bOffset, y - bOffset);
    ctx.lineTo(x - bOffset + bSize, y - bOffset);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + bOffset - bSize, y - bOffset);
    ctx.lineTo(x + bOffset, y - bOffset);
    ctx.lineTo(x + bOffset, y - bOffset + bSize);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x - bOffset, y + bOffset - bSize);
    ctx.lineTo(x - bOffset, y + bOffset);
    ctx.lineTo(x - bOffset + bSize, y + bOffset);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + bOffset - bSize, y + bOffset);
    ctx.lineTo(x + bOffset, y + bOffset);
    ctx.lineTo(x + bOffset, y + bOffset - bSize);
    ctx.stroke();
  }

  // 2. High-Risk Threat Halo Pulse
  if (!isSelected && node.riskScore > 88) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 3. Drop Shadow & Dark Backing Disk
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0e1a';
  ctx.shadowColor = color;
  ctx.shadowBlur = isSelected ? 26 : isConnected ? 16 : 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 4. Render Real Photographic Entity Image with Circular Mask
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    // Fill with crisp image aspect-fill
    ctx.drawImage(img, x - radius + 2, y - radius + 2, (radius - 2) * 2, (radius - 2) * 2);

    // Subtle dark vignette gradient overlay for high visual depth
    const vignette = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.85, 'rgba(0, 0, 0, 0.25)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = vignette;
    ctx.fill();

    ctx.restore();
  } else {
    // Elegant fallback gradient if image is still streaming
    const fallbackGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    fallbackGrad.addColorStop(0, color + 'cc');
    fallbackGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = fallbackGrad;
    ctx.fill();
  }

  // 5. Metallic Protective Ring Rim
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = isSelected ? '#ffffff' : color;
  ctx.lineWidth = isSelected ? 2.5 : 2.0;
  ctx.stroke();

  // 6. Entity Type Micro-Badge Pill (Corner Emblem)
  const meta = NODE_IMAGES[node.id] || { badge: '●', badgeBg: color };
  const bRadius = 8;
  const bX = x + radius * 0.72;
  const bY = y - radius * 0.72;

  ctx.beginPath();
  ctx.arc(bX, bY, bRadius, 0, Math.PI * 2);
  ctx.fillStyle = meta.badgeBg;
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = '9px "Segoe UI Emoji", AppleColorEmoji, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(meta.badge, bX, bY + 0.5);

  // 7. Node Primary Name Label with High-Contrast Background Plaque
  ctx.font = isSelected ? 'bold 11px Inter, sans-serif' : '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const labelY = y + radius + 6;
  // Subtle text glow/shadow for readability over connection lines
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = isSelected ? '#ffffff' : '#f1f5f9';
  ctx.fillText(node.label, x, labelY);

  // 8. Node Subtitle: Risk Score & Type / Real Bank Name
  ctx.font = '700 8.5px JetBrains Mono, monospace';
  const riskColor = node.riskScore > 88 ? '#ef4444' : node.riskScore > 75 ? '#f59e0b' : '#38bdf8';
  ctx.fillStyle = riskColor;
  ctx.fillText(`${node.riskScore}%  ${node.type.toUpperCase()}`, x, labelY + 14);
  ctx.shadowBlur = 0;

  ctx.restore();
}
