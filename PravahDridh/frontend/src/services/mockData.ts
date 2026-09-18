// Centralized mock and simulated data service for prototype demo
export interface TransactionRecord {
  id: string;
  account: string;
  amount: number;
  timestamp: string;
  location: string;
  type: 'ATM_WITHDRAWAL' | 'UPI_TRANSFER' | 'IMPS_OUT' | 'NEFT_IN';
  riskScore: number;
  status: 'FLAGGED' | 'REVIEWED' | 'CLEAR' | 'SUSPENDED';
  signals: string[];
}

export interface PatternRecord {
  id: string;
  name: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  affectedEntities: number;
  affectedTransactions: number;
  explanation: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'Person' | 'Account' | 'Transaction' | 'ATM' | 'Location' | 'Device' | 'Phone' | 'Case' | 'Complaint' | 'Investigation' | 'Alert' | 'Prediction';
  riskScore: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
  isPinned?: boolean;
  amount?: number;
  details?: string;
  subNetwork?: string;
  status?: string;
  imageUrl?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: 'Owns' | 'Transfers' | 'Withdraws' | 'Uses' | 'Located At' | 'Connected To' | 'Associated With' | 'Related Case' | 'Directs' | 'Operates';
  amount?: number;
  isSuspicious?: boolean;
}

export interface ComplaintRecord {
  id: string;
  category: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  linkedNetwork: string;
  status: 'Under Investigation' | 'New' | 'Closed';
  date: string;
  amountLost: number;
  complainant: string;
  summary: string;
}

export interface HotspotRecord {
  id: string;
  name: string;
  city: string;
  riskScore: number;
  confidence: number;
  predictionWindow: 'Next 24 Hours' | 'Next 48 Hours' | 'Next 7 Days';
  lat: number;
  lng: number;
  historicalIncidentCount: number;
  whyThisLocation: string;
  topEntities: string[];
}

export const mockTransactions: TransactionRecord[] = [
  {
    id: 'TXN-90241-A',
    account: 'SBIN-0442-8819',
    amount: 49500,
    timestamp: '2026-09-11 09:12:44',
    location: 'Rohini Sector 7 ATM-04',
    type: 'ATM_WITHDRAWAL',
    riskScore: 94,
    status: 'FLAGGED',
    signals: ['Velocity threshold exceeded', 'ATM card cloned signature', 'Mule ring terminal'],
  },
  {
    id: 'TXN-90240-B',
    account: 'SBIN-0442-8819',
    amount: 49000,
    timestamp: '2026-09-11 09:08:12',
    location: 'Rohini Sector 7 ATM-04',
    type: 'ATM_WITHDRAWAL',
    riskScore: 92,
    status: 'FLAGGED',
    signals: ['Structuring pattern (<50k limit)', 'Sequential rapid withdrawal'],
  },
  {
    id: 'TXN-88102-C',
    account: 'HDFC-9912-3341',
    amount: 185000,
    timestamp: '2026-09-11 08:44:20',
    location: 'Connaught Place Hub',
    type: 'UPI_TRANSFER',
    riskScore: 86,
    status: 'FLAGGED',
    signals: ['High-value layering from flagged victim complaint', 'Device fingerprint mismatch'],
  },
  {
    id: 'TXN-87401-D',
    account: 'ICIC-1102-7721',
    amount: 25000,
    timestamp: '2026-09-11 07:30:11',
    location: 'Laxmi Nagar Metro ATM',
    type: 'ATM_WITHDRAWAL',
    riskScore: 78,
    status: 'REVIEWED',
    signals: ['Known money mule node', 'SIM swap within 48h'],
  },
  {
    id: 'TXN-79402-E',
    account: 'PNBN-4402-9901',
    amount: 12000,
    timestamp: '2026-09-11 06:15:00',
    location: 'Dwarka Sector 10',
    type: 'IMPS_OUT',
    riskScore: 35,
    status: 'CLEAR',
    signals: ['Normal geographic pattern'],
  },
];

export const mockPatterns: PatternRecord[] = [
  {
    id: 'PAT-01',
    name: 'Rapid Sequential ATM Withdrawals',
    riskLevel: 'CRITICAL',
    confidence: 0.94,
    affectedEntities: 6,
    affectedTransactions: 18,
    explanation: 'Multiple accounts drained at identical ATM kiosks in sub-5 minute intervals under ₹50,000 regulatory radar.',
  },
  {
    id: 'PAT-02',
    name: 'Multi-Account Beneficiary Funneling',
    riskLevel: 'HIGH',
    confidence: 0.89,
    affectedEntities: 12,
    affectedTransactions: 42,
    explanation: 'Dispersed victim UPI inflows consolidated into 2 primary mule intermediary accounts within 20 minutes.',
  },
  {
    id: 'PAT-03',
    name: 'Geographic Terminal Hop Velocity',
    riskLevel: 'HIGH',
    confidence: 0.85,
    affectedEntities: 3,
    affectedTransactions: 9,
    explanation: 'Physical card withdrawals recorded across terminals 35km apart within 12 minutes (Impossible travel anomaly).',
  },
  {
    id: 'PAT-04',
    name: 'SIM Swap Layering Precursor',
    riskLevel: 'MEDIUM',
    confidence: 0.76,
    affectedEntities: 4,
    affectedTransactions: 7,
    explanation: 'Beneficiary contact numbers updated immediately prior to sudden surge in outward IMPS sweeps.',
  },
];

export const mockHotspots: HotspotRecord[] = [
  {
    id: 'HS-01',
    name: 'Rohini Sector 7 Cluster',
    city: 'New Delhi',
    riskScore: 92,
    confidence: 0.93,
    predictionWindow: 'Next 24 Hours',
    lat: 28.7041,
    lng: 77.1025,
    historicalIncidentCount: 44,
    whyThisLocation: 'Multiple high-risk mule entities connected to nearby active SIM clusters; historical withdrawal telemetry shows repetitive 09:00 - 13:00 cash drain behavior.',
    topEntities: ['SBIN-0442-8819', 'Mule Subject M-401', 'ATM-ROH-04'],
  },
  {
    id: 'HS-02',
    name: 'Laxmi Nagar Commercial Kiosk Zone',
    city: 'East Delhi',
    riskScore: 86,
    confidence: 0.88,
    predictionWindow: 'Next 48 Hours',
    lat: 28.6304,
    lng: 77.2773,
    historicalIncidentCount: 31,
    whyThisLocation: 'High influx of peer-to-peer UPI layering transfers terminating in cash withdrawals from 3 standalone off-site ATMs.',
    topEntities: ['ICIC-1102-7721', 'Subject V. Verma', 'ATM-LXN-11'],
  },
  {
    id: 'HS-03',
    name: 'MG Road Metro Perimeter',
    city: 'Gurugram',
    riskScore: 78,
    confidence: 0.82,
    predictionWindow: 'Next 7 Days',
    lat: 28.4817,
    lng: 77.0807,
    historicalIncidentCount: 19,
    whyThisLocation: 'Emerging cross-state money mule hop zone detected following cybercrime complaint surges in Haryana/Delhi border.',
    topEntities: ['HDFC-9912-3341', 'Device D-9902'],
  },
];

export const mockComplaints: ComplaintRecord[] = [
  {
    id: 'NCRP-2026-88190',
    category: 'Digital Arrest / Impersonation Fraud',
    risk: 'CRITICAL',
    linkedNetwork: 'Mule Ring Alpha-7',
    status: 'Under Investigation',
    date: '2026-09-11 06:30',
    amountLost: 450000,
    complainant: 'Sunita Mehra (Retired Teacher)',
    summary: 'Caller impersonated CBI official demanding RTGS/UPI transfer to clearing accounts.',
  },
  {
    id: 'NCRP-2026-88142',
    category: 'Part-Time Job / Telegram Scam',
    risk: 'HIGH',
    linkedNetwork: 'Mule Ring Beta-2',
    status: 'Under Investigation',
    date: '2026-09-10 18:15',
    amountLost: 180000,
    complainant: 'Aakash Verma',
    summary: 'Crypto rating platform deposit scam funneled through 3 mule intermediaries.',
  },
  {
    id: 'NCRP-2026-87994',
    category: 'Loan App Harassment / Extortion',
    risk: 'MEDIUM',
    linkedNetwork: 'Lender Net 44',
    status: 'New',
    date: '2026-09-10 11:20',
    amountLost: 45000,
    complainant: 'Rajesh Kumar',
    summary: 'Predatory lending app with malware permissions scraping contact lists.',
  },
];

export const mockGraphNodes: GraphNode[] = [
  { id: 'PER-001', label: 'Vikas Verma', type: 'Person',   riskScore: 98, details: 'Kingpin — operates Telegram mule network across Delhi-NCR & Haryana', subNetwork: 'Alpha Syndicate', status: 'WANTED', imageUrl: '/images/vikas_verma.jpg' },
  { id: 'PER-401', label: 'Ramesh K.', type: 'Person',     riskScore: 94, details: 'Primary mule; linked to 3 digital arrest incidents; final cash-out handler', subNetwork: 'Alpha Syndicate', status: 'FLAGGED', imageUrl: '/images/ramesh_mule.jpg' },
  { id: 'ACC-3341', label: 'HDFC-9912-3341', type: 'Account', riskScore: 91, amount: 820000, details: 'Intermediary layering account; splits funds across 4 private banks within minutes', subNetwork: 'Layer-2', status: 'SUSPICIOUS', imageUrl: '/images/bank_hdfc.jpg' },
  { id: 'ACC-8819', label: 'SBIN-0442-8819', type: 'Account', riskScore: 94, amount: 495000, details: 'Primary cash-out account; ₹4.95L inflow spike in 30 mins', subNetwork: 'Layer-3', status: 'FREEZE_PENDING', imageUrl: '/images/bank_sbi.jpg' },
  { id: 'ACC-7721', label: 'ICIC-1102-7721', type: 'Account', riskScore: 88, amount: 650000, details: 'Direct victim fund recipient — Digital Arrest complaint #88190', subNetwork: 'Layer-1', status: 'MONITORED', imageUrl: '/images/bank_icici.jpg' },
  { id: 'ATM-04',  label: 'Rohini ATM-04',  type: 'ATM',    riskScore: 92, details: 'Off-site kiosk; sequential sub-₹50K withdrawals to stay under reporting radar', subNetwork: 'Cash-out Zone 1', status: 'HIGH_ALERT', imageUrl: '/images/atm_kiosk.jpg' },
  { id: 'DEV-704', label: 'Redmi Note 12',  type: 'Device', riskScore: 90, details: 'Command device running UPI spoofing scripts & remote screen-share for mule control', subNetwork: 'Alpha Syndicate', status: 'ACTIVE', imageUrl: '/images/device_redmi.jpg' },
  { id: 'PHN-771', label: '+91-98102-88190', type: 'Phone', riskScore: 92, details: 'VoIP line spoofed as CBI Control Room; initiated digital arrest call on Sunita Mehra', subNetwork: 'Alpha Syndicate', status: 'DISCONNECTED', imageUrl: '/images/phone_sim.jpg' },
  { id: 'CAS-142', label: 'FIR #2026-00142', type: 'Case', riskScore: 96, details: 'CBI Cyber Crime case — impersonation + extortion of ₹45,00,000', subNetwork: 'Legal', status: 'INVESTIGATION', imageUrl: '/images/fir_case.jpg' },
  { id: 'LOC-DEL', label: 'Rohini Corridor', type: 'Location', riskScore: 85, details: 'Geographic hotspot with 8 flagged ATMs within 1.5 km radius', subNetwork: 'Delhi NCR', status: 'HOTSPOT', imageUrl: '/images/location_corridor.jpg' },
];

export const mockGraphEdges: GraphEdge[] = [
  // Command chain
  { source: 'PER-001', target: 'PER-401', relationship: 'Directs',       isSuspicious: true },
  { source: 'PER-001', target: 'DEV-704', relationship: 'Uses',           isSuspicious: true },
  { source: 'DEV-704', target: 'PHN-771', relationship: 'Associated With', isSuspicious: true },
  // Victim → Layering → Cash-Out
  { source: 'ACC-7721', target: 'ACC-3341', relationship: 'Transfers',   amount: 450000, isSuspicious: true },
  { source: 'ACC-3341', target: 'ACC-8819', relationship: 'Transfers',   amount: 280000, isSuspicious: true },
  // Mule owns the cash-out account
  { source: 'PER-401', target: 'ACC-8819', relationship: 'Owns',         isSuspicious: true },
  // Withdrawal at terminal
  { source: 'ACC-8819', target: 'ATM-04',  relationship: 'Withdraws',    amount: 49500, isSuspicious: true },
  // ATM location
  { source: 'ATM-04',  target: 'LOC-DEL', relationship: 'Located At' },
  // FIR links
  { source: 'PHN-771', target: 'CAS-142', relationship: 'Related Case',  isSuspicious: true },
  { source: 'ACC-8819', target: 'CAS-142', relationship: 'Related Case', isSuspicious: true },
];
