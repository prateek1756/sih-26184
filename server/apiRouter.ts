import { Router, Request, Response } from 'express';

export const apiRouter = Router();

// Standard response wrapper matching FastAPI StandardResponse schema
function standardResponse<T>(data: T, meta?: any) {
  return {
    status: 'success',
    data,
    meta: meta || null,
    error: null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 1. AUTHENTICATION & USERS
// ──────────────────────────────────────────────────────────────────────────
const mockUsers = [
  {
    id: 'usr-admin-01',
    email: 'admin@hermes.gov.in',
    full_name: 'Director R. K. Sharma, IPS',
    role: 'ADMIN',
    badge_number: 'IPS-77821',
    agency: 'I4C / Ministry of Home Affairs',
    is_active: true,
  },
  {
    id: 'usr-investigator-01',
    email: 'investigator@hermes.gov.in',
    full_name: 'Inspector Vikram Rathore',
    role: 'INVESTIGATOR',
    badge_number: 'DEL-INV-4402',
    agency: 'Delhi Police Cyber Cell',
    is_active: true,
  },
  {
    id: 'usr-analyst-01',
    email: 'analyst@hermes.gov.in',
    full_name: 'Dr. Ananya Sen',
    role: 'ANALYST',
    badge_number: 'CERT-AN-991',
    agency: 'Financial Intelligence Unit (FIU-IND)',
    is_active: true,
  },
  {
    id: 'usr-supervisor-01',
    email: 'supervisor@hermes.gov.in',
    full_name: 'ACP Priya Deshmukh',
    role: 'SUPERVISOR',
    badge_number: 'MUM-SUP-1209',
    agency: 'Maharashtra Cyber Intelligence Division',
    is_active: true,
  },
  {
    id: 'usr-ml-01',
    email: 'ml@hermes.gov.in',
    full_name: 'Dr. Arpit Joshi',
    role: 'ML_ENGINEER',
    badge_number: 'DRDO-AI-883',
    agency: 'Centre for Cyber Forensics & ML',
    is_active: true,
  },
];

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email } = req.body || {};
  const user = mockUsers.find((u) => u.email.toLowerCase() === (email || '').toLowerCase()) || mockUsers[1]; // default to investigator
  res.json(
    standardResponse({
      access_token: `mock-jwt-token-${user.id}-${Date.now()}`,
      refresh_token: `mock-refresh-token-${user.id}-${Date.now()}`,
      token_type: 'bearer',
      user,
    })
  );
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const matchedUser = mockUsers.find((u) => token.includes(u.id)) || mockUsers[1];
  res.json(standardResponse(matchedUser));
});

apiRouter.post('/auth/refresh', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      access_token: `mock-jwt-token-refreshed-${Date.now()}`,
      refresh_token: `mock-refresh-token-refreshed-${Date.now()}`,
      token_type: 'bearer',
      user: mockUsers[1],
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// 2. COMPLAINTS INTELLIGENCE
// ──────────────────────────────────────────────────────────────────────────
let complaints = [
  {
    id: 'cmp-ncrp-2026-88190',
    complaint_number: 'NCRP-2026-88190',
    filed_at: '2026-09-15T08:30:00Z',
    category: 'UPI / Digital Payment Fraud',
    subcategory: 'Mule Layering & P2P Diversion',
    reported_amount: 148500,
    victim_state: 'Delhi',
    victim_city: 'Delhi NCR',
    victim_district: 'North West Delhi',
    complainant_name: 'Rajesh Kumar Mehta',
    complainant_contact: '+91 98112-44910',
    suspect_info: 'Beneficiary accounts @ Axis & SBI; withdrawal targeted at Rohini ATM Cluster',
    financial_details: {
      source_account: 'SBIN-00192-3312',
      beneficiary_vpa: 'quickcash.mule@okaxis',
      disputed_amount: 148500,
    },
    priority: 'CRITICAL',
    status: 'UNDER_INVESTIGATION',
    description: 'Victim deceived via fake electricity bill disconnection notice with APK payload. Funds layered across 3 mule accounts in 18 minutes, rapid ATM withdrawal burst forecast in Rohini Sector 7.',
    created_at: '2026-09-15T08:32:10Z',
  },
  {
    id: 'cmp-ncrp-2026-88191',
    complaint_number: 'NCRP-2026-88191',
    filed_at: '2026-09-16T10:14:00Z',
    category: 'Part-Time Job / Telegram Task Fraud',
    subcategory: 'Crypto Escrow Routing',
    reported_amount: 320000,
    victim_state: 'Maharashtra',
    victim_city: 'Mumbai',
    victim_district: 'Mumbai Suburban',
    complainant_name: 'Sneha Patil',
    complainant_contact: '+91 98201-99214',
    suspect_info: 'Telegram group @DigitalMerchantEarn; ICICI mule accounts in Bandra-Kurla',
    financial_details: {
      source_account: 'HDFC-0421-9988',
      disputed_amount: 320000,
    },
    priority: 'CRITICAL',
    status: 'UNDER_INVESTIGATION',
    description: 'Victim lured into ratings investment scam. Siphoned capital split into ₹49,000 tranches to evade PMLA threshold alerts.',
    created_at: '2026-09-16T10:15:00Z',
  },
  {
    id: 'cmp-ncrp-2026-88192',
    complaint_number: 'NCRP-2026-88192',
    filed_at: '2026-09-16T14:45:00Z',
    category: 'Loan App Harassment & Extortion',
    subcategory: 'Predatory Instant Loan Ring',
    reported_amount: 85000,
    victim_state: 'Karnataka',
    victim_city: 'Bengaluru',
    victim_district: 'Bengaluru Urban',
    complainant_name: 'Anand Vardhan',
    complainant_contact: '+91 99014-11882',
    suspect_info: 'FinTech loan app "RupeeFastNow" connected to call center syndicate',
    priority: 'HIGH',
    status: 'ACTIVE',
    description: 'Victim blackmailed with morphed photo contacts. Extorted amount collected via UPI ID linked to ATM withdrawal hub in Koramangala.',
    created_at: '2026-09-16T14:48:22Z',
  },
  {
    id: 'cmp-ncrp-2026-88193',
    complaint_number: 'NCRP-2026-88193',
    filed_at: '2026-09-17T09:20:00Z',
    category: 'FedEx / Digital Arrest Impersonation',
    subcategory: 'Police / CBI Impersonation',
    reported_amount: 850000,
    victim_state: 'Delhi',
    victim_city: 'Delhi NCR',
    victim_district: 'South Delhi',
    complainant_name: 'Prof. Harish Chander',
    complainant_contact: '+91 98100-22119',
    suspect_info: 'Fake Skype call impersonating Mumbai Cyber Cell ACP',
    priority: 'CRITICAL',
    status: 'UNDER_INVESTIGATION',
    description: 'Senior citizen held in "Digital Arrest" for 36 hours. RTGS transferred to multiple mule accounts; cash-out underway at Connaught Place ATMs.',
    created_at: '2026-09-17T09:25:00Z',
  },
  {
    id: 'cmp-ncrp-2026-88194',
    complaint_number: 'NCRP-2026-88194',
    filed_at: '2026-09-17T11:05:00Z',
    category: 'SIM Swap / Banking Credential Phishing',
    subcategory: 'NetBanking Account Takeover',
    reported_amount: 195000,
    victim_state: 'Haryana',
    victim_city: 'Gurugram',
    victim_district: 'Gurugram',
    complainant_name: 'Kavita Singh',
    complainant_contact: '+91 97110-33441',
    suspect_info: 'Unauthorized eSIM conversion followed by instant IMPS transfer',
    priority: 'HIGH',
    status: 'ACTIVE',
    description: 'eSIM profile swapped at midnight. Funds dispersed to 4 accounts and scheduled for immediate ATM withdrawal in Cyber City.',
    created_at: '2026-09-17T11:08:45Z',
  },
];

apiRouter.get('/complaints', (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const per_page = parseInt(String(req.query.per_page || '20'), 10);
  const search = String(req.query.search || '').toLowerCase();
  const category = String(req.query.category || 'ALL');
  const status = String(req.query.status || 'ALL');

  let filtered = [...complaints];
  if (category && category !== 'ALL') {
    filtered = filtered.filter((c) => c.category.toLowerCase().includes(category.toLowerCase()));
  }
  if (status && status !== 'ALL') {
    filtered = filtered.filter((c) => c.status.toLowerCase().includes(status.toLowerCase()));
  }
  if (search) {
    filtered = filtered.filter(
      (c) =>
        c.complaint_number.toLowerCase().includes(search) ||
        (c.complainant_name && c.complainant_name.toLowerCase().includes(search)) ||
        (c.description && c.description.toLowerCase().includes(search)) ||
        (c.victim_city && c.victim_city.toLowerCase().includes(search))
    );
  }

  const total = filtered.length;
  const offset = (page - 1) * per_page;
  const paginated = filtered.slice(offset, offset + per_page);

  res.json(
    standardResponse(paginated, {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page),
    })
  );
});

apiRouter.get('/complaints/track/:id', (req: Request, res: Response) => {
  const identifier = req.params.id;
  const found = complaints.find(
    (c) => c.id === identifier || c.complaint_number.toLowerCase() === identifier.toLowerCase()
  );
  if (!found) {
    res.status(404).json({ status: 'error', error: { message: 'Complaint not found' } });
    return;
  }
  res.json(standardResponse(found));
});

apiRouter.get('/complaints/:id/intelligence', (req: Request, res: Response) => {
  const id = req.params.id;
  const complaint = complaints.find((c) => c.id === id || c.complaint_number === id) || complaints[0];

  res.json(
    standardResponse({
      complaint,
      linked_transactions: [
        {
          id: 'TXN-90241-A',
          transaction_id: 'TXN-90241-A',
          amount: 49500,
          currency: 'INR',
          source_account: 'SBIN-0442-8819',
          destination_account: 'MULE-ACC-8819-A1',
          transaction_type: 'ATM_WITHDRAWAL',
          timestamp: '2026-09-17T09:12:44Z',
          atm_code: 'ATM-ROH-04',
          bank_name: 'State Bank of India',
          city: 'Delhi NCR',
          risk_score: 94,
          is_flagged: true,
          flag_reason: 'Structuring threshold burst (< ₹50,000)',
        },
        {
          id: 'TXN-90242-B',
          transaction_id: 'TXN-90242-B',
          amount: 49000,
          currency: 'INR',
          source_account: 'SBIN-0442-8819',
          destination_account: 'MULE-ACC-8819-A1',
          transaction_type: 'ATM_WITHDRAWAL',
          timestamp: '2026-09-17T09:16:10Z',
          atm_code: 'ATM-ROH-04',
          bank_name: 'State Bank of India',
          city: 'Delhi NCR',
          risk_score: 92,
          is_flagged: true,
          flag_reason: 'Sequential rapid withdrawal within 4 minutes',
        },
      ],
      linked_accounts: [
        {
          id: 'ACC-MULE-8819',
          account_number: 'SBIN-****-8819',
          bank_name: 'State Bank of India',
          branch: 'Rohini Sector 7, Delhi',
          account_holder: 'Dinesh Kumar (Mule Identity)',
          is_mule: true,
          risk_score: 95,
          total_fraud_volume: 148500,
          status: 'FROZEN_PENDING_REVIEW',
        },
      ],
      correlated_predictions: [
        {
          id: 'pred-del-rohini-01',
          atm_id: 'ATM-ROH-04',
          atm_code: 'ATM-ROH-04',
          bank_name: 'State Bank of India',
          city: 'Delhi NCR',
          latitude: 28.7041,
          longitude: 77.1025,
          risk_score: 94,
          confidence: 0.93,
          severity: 'CRITICAL',
          predicted_window_start: '2026-09-17T12:00:00Z',
          predicted_window_end: '2026-09-18T12:00:00Z',
          prediction_basis: [
            '3 active mule accounts within 1.5km radius',
            'Structuring pattern detected across 2 bank accounts',
            'Historic withdrawal hotspot for APK credential harvesters',
          ],
        },
      ],
      summary: 'High correlation with NCRP #88190: 2 ATM withdrawals confirmed in Rohini Sector 7. LEA intercept alert active.',
    })
  );
});

apiRouter.post('/complaints', (req: Request, res: Response) => {
  const body = req.body || {};
  const randNum = Math.floor(10000 + Math.random() * 90000);
  const newCmp = {
    id: `cmp-ncrp-2026-${randNum}`,
    complaint_number: `NCRP-2026-${randNum}`,
    filed_at: new Date().toISOString(),
    category: body.category || 'Cyber Financial Fraud',
    subcategory: body.subcategory || 'Online Transaction Compromise',
    reported_amount: Number(body.reported_amount || 50000),
    victim_state: body.victim_state || 'Delhi',
    victim_city: body.victim_city || 'Delhi NCR',
    victim_district: body.victim_district || 'Central Delhi',
    complainant_name: body.complainant_name || 'Citizen Reporter',
    complainant_contact: body.complainant_contact || '+91 98000-00000',
    suspect_info: body.suspect_info || 'Under forensic tracing',
    priority: body.priority || 'HIGH',
    status: 'NEW',
    description: body.description || 'Cybercrime complaint submitted via Pravah reporting portal.',
    created_at: new Date().toISOString(),
  };
  complaints.unshift(newCmp);
  res.status(201).json(standardResponse(newCmp));
});

// ──────────────────────────────────────────────────────────────────────────
// 3. PREDICTIONS & WITHDRAWAL HOTSPOTS (ML PIPELINE)
// ──────────────────────────────────────────────────────────────────────────
const mockPredictions = [
  {
    id: 'pred-del-rohini-01',
    atm_id: 'ATM-ROH-04',
    rank: 1,
    atm_code: 'ATM-ROH-04',
    bank_name: 'State Bank of India',
    city: 'Delhi NCR',
    address: 'Plot 14, Main Market, Rohini Sector 7, Delhi 110085',
    latitude: 28.7041,
    longitude: 77.1025,
    risk_score: 94.2,
    confidence: 0.93,
    severity: 'CRITICAL',
    is_active: true,
    predicted_window_start: '2026-09-17T12:00:00Z',
    predicted_window_end: '2026-09-18T12:00:00Z',
    prediction_basis: [
      '3 mule accounts clustered within 1.8km radius',
      'Velocity burst: 4 rapid withdrawals under ₹50,000 threshold',
      'Model attribution: RF-v2.0 SHAP feature importance 0.44 on spatial mule proximity',
    ],
    factor_contributions: {
      mule_proximity: 0.92,
      velocity_anomaly: 0.89,
      structuring_pattern: 0.85,
    },
    atm: {
      id: 'ATM-ROH-04',
      atm_code: 'ATM-ROH-04',
      bank_name: 'State Bank of India',
      address: 'Plot 14, Main Market, Rohini Sector 7, Delhi',
      city: 'Delhi NCR',
      state: 'Delhi',
      latitude: 28.7041,
      longitude: 77.1025,
    },
  },
  {
    id: 'pred-del-laxmi-02',
    atm_id: 'ATM-LXN-11',
    rank: 2,
    atm_code: 'ATM-LXN-11',
    bank_name: 'Punjab National Bank',
    city: 'East Delhi',
    address: 'Vikas Marg, Laxmi Nagar Metro Gate 2, Delhi 110092',
    latitude: 28.6304,
    longitude: 77.2773,
    risk_score: 86.8,
    confidence: 0.88,
    severity: 'HIGH',
    is_active: true,
    predicted_window_start: '2026-09-17T14:00:00Z',
    predicted_window_end: '2026-09-18T14:00:00Z',
    prediction_basis: [
      'P2P UPI layering termination node detected',
      'Linked to NCRP Cyber Complaint #88190',
      'High footfall transit hub with multiple escape routes',
    ],
    factor_contributions: {
      upi_layering: 0.88,
      transit_hub_factor: 0.82,
    },
    atm: {
      id: 'ATM-LXN-11',
      atm_code: 'ATM-LXN-11',
      bank_name: 'Punjab National Bank',
      address: 'Vikas Marg, Laxmi Nagar Metro Gate 2, Delhi',
      city: 'East Delhi',
      state: 'Delhi',
      latitude: 28.6304,
      longitude: 77.2773,
    },
  },
  {
    id: 'pred-gur-cyber-03',
    atm_id: 'ATM-GUR-22',
    rank: 3,
    atm_code: 'ATM-GUR-22',
    bank_name: 'HDFC Bank',
    city: 'Gurugram',
    address: 'DLF Cyber City Building 10, Gurugram, Haryana 122002',
    latitude: 28.4817,
    longitude: 77.0807,
    risk_score: 79.4,
    confidence: 0.82,
    severity: 'HIGH',
    is_active: true,
    predicted_window_start: '2026-09-17T16:00:00Z',
    predicted_window_end: '2026-09-18T16:00:00Z',
    prediction_basis: [
      'Interstate travel velocity anomaly from Delhi to Haryana',
      'Account flagged by FIU-IND STR (Suspicious Transaction Report)',
    ],
    factor_contributions: {
      travel_velocity: 0.84,
      fiu_str_flag: 0.76,
    },
    atm: {
      id: 'ATM-GUR-22',
      atm_code: 'ATM-GUR-22',
      bank_name: 'HDFC Bank',
      address: 'DLF Cyber City Building 10, Gurugram',
      city: 'Gurugram',
      state: 'Haryana',
      latitude: 28.4817,
      longitude: 77.0807,
    },
  },
  {
    id: 'pred-mum-bandra-04',
    atm_id: 'ATM-MUM-09',
    rank: 4,
    atm_code: 'ATM-MUM-09',
    bank_name: 'ICICI Bank',
    city: 'Mumbai',
    address: 'Bandra Kurla Complex, Bandra East, Mumbai 400051',
    latitude: 19.0657,
    longitude: 72.8687,
    risk_score: 74.1,
    confidence: 0.80,
    severity: 'HIGH',
    is_active: true,
    predicted_window_start: '2026-09-17T18:00:00Z',
    predicted_window_end: '2026-09-18T18:00:00Z',
    prediction_basis: [
      'Corporate mule shell entity liquidation attempt',
      'Correlated with Task/Investment fraud ring',
    ],
    factor_contributions: {
      shell_company_score: 0.81,
      rapid_drain: 0.72,
    },
    atm: {
      id: 'ATM-MUM-09',
      atm_code: 'ATM-MUM-09',
      bank_name: 'ICICI Bank',
      address: 'BKC Bandra East, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.0657,
      longitude: 72.8687,
    },
  },
];

apiRouter.get('/predictions', (req: Request, res: Response) => {
  res.json(standardResponse(mockPredictions));
});

apiRouter.get('/predictions/hotspots/live', (req: Request, res: Response) => {
  res.json(standardResponse(mockPredictions));
});

apiRouter.get('/predictions/top-k', (req: Request, res: Response) => {
  const k = parseInt(String(req.query.k || '20'), 10);
  res.json(standardResponse(mockPredictions.slice(0, k)));
});

apiRouter.get('/predictions/hotspots', (req: Request, res: Response) => {
  const features = mockPredictions.map((pred) => {
    // Generate 6-point polygon around lat/lon
    const delta = 0.006;
    const coords = [
      [
        [pred.longitude, pred.latitude + delta],
        [pred.longitude + delta, pred.latitude + delta * 0.5],
        [pred.longitude + delta, pred.latitude - delta * 0.5],
        [pred.longitude, pred.latitude - delta],
        [pred.longitude - delta, pred.latitude - delta * 0.5],
        [pred.longitude - delta, pred.latitude + delta * 0.5],
        [pred.longitude, pred.latitude + delta],
      ],
    ];

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: coords,
      },
      properties: {
        prediction_id: pred.id,
        atm_id: pred.atm_id,
        risk_score: pred.risk_score,
        severity: pred.severity,
        confidence: pred.confidence,
        atm_code: pred.atm_code,
        bank_name: pred.bank_name,
        city: pred.city,
        reasons: pred.prediction_basis,
      },
    };
  });

  res.json(
    standardResponse({
      type: 'FeatureCollection',
      features,
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// 4. ALERTS & CASE DISPATCH
// ──────────────────────────────────────────────────────────────────────────
let alerts = [
  {
    id: 'ALT-2026-0041',
    alert_id: 'ALT-2026-0041',
    prediction_id: 'pred-del-rohini-01',
    title: 'High-Probability Cash-Out: Rohini Sector 7 ATM-04',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    risk_score: 94.2,
    atm_code: 'ATM-ROH-04',
    city: 'Delhi NCR',
    message: 'Rapid structuring burst: 3 mule accounts active within 2km. Immediate field patrol recommended.',
    assignee: mockUsers[1],
    created_at: '2026-09-17T09:15:00Z',
    prediction: mockPredictions[0],
  },
  {
    id: 'ALT-2026-0042',
    alert_id: 'ALT-2026-0042',
    prediction_id: 'pred-del-laxmi-02',
    title: 'UPI Layering Cash-Out Imminent: Laxmi Nagar Metro Hub',
    severity: 'HIGH',
    status: 'ACTIVE',
    risk_score: 86.8,
    atm_code: 'ATM-LXN-11',
    city: 'East Delhi',
    message: 'Linked to NCRP #88190. P2P UPI funds termination at ATM-LXN-11.',
    assignee: mockUsers[1],
    created_at: '2026-09-17T09:20:00Z',
    prediction: mockPredictions[1],
  },
  {
    id: 'ALT-2026-0043',
    alert_id: 'ALT-2026-0043',
    prediction_id: 'pred-gur-cyber-03',
    title: 'Interstate Cash-Mule Flight: Gurugram DLF Cyber City',
    severity: 'HIGH',
    status: 'ACKNOWLEDGED',
    risk_score: 79.4,
    atm_code: 'ATM-GUR-22',
    city: 'Gurugram',
    message: 'Velocity anomaly detected across state boundary within 45 minutes.',
    assignee: mockUsers[3],
    created_at: '2026-09-17T08:45:00Z',
    prediction: mockPredictions[2],
  },
  {
    id: 'ALT-2026-0038',
    alert_id: 'ALT-2026-0038',
    prediction_id: 'pred-mum-bandra-04',
    title: 'Task Fraud Shell Drain: BKC Terminal 09',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    risk_score: 74.1,
    atm_code: 'ATM-MUM-09',
    city: 'Mumbai',
    message: 'Telegram investment syndicate cash-out pattern matched.',
    assignee: mockUsers[3],
    created_at: '2026-09-16T18:10:00Z',
    prediction: mockPredictions[3],
  },
];

apiRouter.get('/alerts', (req: Request, res: Response) => {
  const status = String(req.query.status || 'ALL');
  const severity = String(req.query.severity || 'ALL');

  let filtered = [...alerts];
  if (status && status !== 'ALL') {
    filtered = filtered.filter((a) => a.status.toUpperCase() === status.toUpperCase());
  }
  if (severity && severity !== 'ALL') {
    filtered = filtered.filter((a) => a.severity.toUpperCase() === severity.toUpperCase());
  }

  res.json(
    standardResponse(filtered, {
      page: 1,
      per_page: 50,
      total: filtered.length,
      total_pages: 1,
    })
  );
});

apiRouter.get('/alerts/:id', (req: Request, res: Response) => {
  const found = alerts.find((a) => a.id === req.params.id || a.alert_id === req.params.id);
  if (!found) {
    res.status(404).json({ status: 'error', error: { message: 'Alert not found' } });
    return;
  }
  res.json(standardResponse(found));
});

apiRouter.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  const alert = alerts.find((a) => a.id === req.params.id || a.alert_id === req.params.id);
  if (alert) {
    alert.status = 'ACKNOWLEDGED';
  }
  res.json(standardResponse(alert));
});

apiRouter.post('/alerts/:id/assign', (req: Request, res: Response) => {
  const alert = alerts.find((a) => a.id === req.params.id || a.alert_id === req.params.id);
  if (alert) {
    alert.status = 'INVESTIGATING';
    alert.assignee = mockUsers[1];
  }
  res.json(standardResponse(alert));
});

apiRouter.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  const alert = alerts.find((a) => a.id === req.params.id || a.alert_id === req.params.id);
  if (alert) {
    alert.status = 'RESOLVED';
  }
  res.json(standardResponse(alert));
});

// ──────────────────────────────────────────────────────────────────────────
// 5. GEOSPATIAL & ATMS
// ──────────────────────────────────────────────────────────────────────────
const mockATMs = [
  { id: 'ATM-ROH-04', atm_code: 'ATM-ROH-04', bank_name: 'State Bank of India', address: 'Plot 14, Main Market, Sector 7, Rohini', city: 'Delhi NCR', state: 'Delhi', longitude: 77.1025, latitude: 28.7041 },
  { id: 'ATM-LXN-11', atm_code: 'ATM-LXN-11', bank_name: 'Punjab National Bank', address: 'Vikas Marg, Laxmi Nagar Metro Gate 2', city: 'East Delhi', state: 'Delhi', longitude: 77.2773, latitude: 28.6304 },
  { id: 'ATM-GUR-22', atm_code: 'ATM-GUR-22', bank_name: 'HDFC Bank', address: 'DLF Cyber City Building 10, Gurugram', city: 'Gurugram', state: 'Haryana', longitude: 77.0807, latitude: 28.4817 },
  { id: 'ATM-MUM-09', atm_code: 'ATM-MUM-09', bank_name: 'ICICI Bank', address: 'Bandra Kurla Complex, Bandra East', city: 'Mumbai', state: 'Maharashtra', longitude: 72.8687, latitude: 19.0657 },
  { id: 'ATM-BLR-03', atm_code: 'ATM-BLR-03', bank_name: 'Canara Bank', address: '80 Feet Road, 4th Block, Koramangala', city: 'Bengaluru', state: 'Karnataka', longitude: 77.6271, latitude: 12.9352 },
  { id: 'ATM-DEL-CP-01', atm_code: 'ATM-DEL-CP-01', bank_name: 'Bank of Baroda', address: 'Inner Circle, Connaught Place, New Delhi', city: 'Delhi NCR', state: 'Delhi', longitude: 77.2183, latitude: 28.6315 },
  { id: 'ATM-NOI-18', atm_code: 'ATM-NOI-18', bank_name: 'Axis Bank', address: 'Sector 18 Market, Metro Pillar 110', city: 'Noida', state: 'Uttar Pradesh', longitude: 77.3235, latitude: 28.5703 },
  { id: 'ATM-HYD-HITECH', atm_code: 'ATM-HYD-HITECH', bank_name: 'Kotak Mahindra Bank', address: 'Hitec City Main Road, Madhapur', city: 'Hyderabad', state: 'Telangana', longitude: 78.3820, latitude: 17.4483 },
];

apiRouter.get('/geo/atms', (req: Request, res: Response) => {
  const city = req.query.city ? String(req.query.city).toLowerCase() : null;
  const filtered = city ? mockATMs.filter((a) => a.city.toLowerCase().includes(city)) : mockATMs;

  const features = filtered.map((atm) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [atm.longitude, atm.latitude],
    },
    properties: {
      id: atm.id,
      atm_code: atm.atm_code,
      bank_name: atm.bank_name,
      address: atm.address,
      city: atm.city,
      state: atm.state,
    },
  }));

  res.json(
    standardResponse({
      type: 'FeatureCollection',
      features,
    })
  );
});

apiRouter.get('/geo/clusters', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      clusters: [
        {
          cluster_id: 'cluster-del-northwest',
          name: 'Rohini-Pitampura High-Density Cybercrime Corridor',
          center: [77.1025, 28.7041],
          atm_count: 14,
          predicted_risk_level: 'CRITICAL',
          primary_mule_density_per_sqkm: 4.8,
        },
        {
          cluster_id: 'cluster-east-delhi',
          name: 'Laxmi Nagar - Anand Vihar Transit Extraction Zone',
          center: [77.2773, 28.6304],
          atm_count: 9,
          predicted_risk_level: 'HIGH',
          primary_mule_density_per_sqkm: 3.2,
        },
      ],
    })
  );
});

apiRouter.get('/geo/atms/:id', (req: Request, res: Response) => {
  const atm = mockATMs.find((a) => a.id === req.params.id || a.atm_code === req.params.id) || mockATMs[0];
  res.json(standardResponse(atm));
});

// ──────────────────────────────────────────────────────────────────────────
// 6. TRANSACTIONS & MULE HOPS
// ──────────────────────────────────────────────────────────────────────────
const mockTransactions = [
  {
    id: 'TXN-90241-A',
    account: 'SBIN-0442-8819',
    amount: 49500,
    timestamp: '2026-09-17 09:12:44',
    location: 'Rohini Sector 7 ATM-04',
    type: 'ATM_WITHDRAWAL',
    riskScore: 94,
    status: 'FLAGGED',
    signals: ['Velocity threshold exceeded', 'ATM card cloned signature', 'Mule ring terminal'],
    bank_name: 'State Bank of India',
    city: 'Delhi NCR',
    is_mule_suspected: true,
  },
  {
    id: 'TXN-90240-B',
    account: 'SBIN-0442-8819',
    amount: 49000,
    timestamp: '2026-09-17 09:08:12',
    location: 'Rohini Sector 7 ATM-04',
    type: 'ATM_WITHDRAWAL',
    riskScore: 92,
    status: 'FLAGGED',
    signals: ['Structuring pattern (<50k limit)', 'Sequential rapid withdrawal'],
    bank_name: 'State Bank of India',
    city: 'Delhi NCR',
    is_mule_suspected: true,
  },
  {
    id: 'TXN-88102-C',
    account: 'PUNB-9912-4011',
    amount: 145000,
    timestamp: '2026-09-17 08:52:19',
    location: 'Laxmi Nagar East Delhi',
    type: 'UPI_TRANSFER',
    riskScore: 88,
    status: 'FLAGGED',
    signals: ['Multi-hop layering', 'Instant pass-through turnover within 3 minutes'],
    bank_name: 'Punjab National Bank',
    city: 'East Delhi',
    is_mule_suspected: true,
  },
  {
    id: 'TXN-76510-D',
    account: 'HDFC-1099-3321',
    amount: 250000,
    timestamp: '2026-09-17 07:30:11',
    location: 'DLF Cyber City ATM-22',
    type: 'IMPS_OUT',
    riskScore: 78,
    status: 'REVIEWED',
    signals: ['Interstate velocity hop', 'Dormant account sudden activation'],
    bank_name: 'HDFC Bank',
    city: 'Gurugram',
    is_mule_suspected: true,
  },
  {
    id: 'TXN-54120-E',
    account: 'ICIC-8821-9901',
    amount: 320000,
    timestamp: '2026-09-16 17:40:00',
    location: 'Bandra Kurla Complex',
    type: 'NEFT_IN',
    riskScore: 72,
    status: 'FLAGGED',
    signals: ['Telegram task scam payout', 'Shell company aggregation'],
    bank_name: 'ICICI Bank',
    city: 'Mumbai',
    is_mule_suspected: true,
  },
];

apiRouter.get('/transactions', (req: Request, res: Response) => {
  res.json(
    standardResponse(mockTransactions, {
      page: 1,
      per_page: 50,
      total: mockTransactions.length,
      total_pages: 1,
    })
  );
});

apiRouter.get('/transactions/:id', (req: Request, res: Response) => {
  const txn = mockTransactions.find((t) => t.id === req.params.id) || mockTransactions[0];
  res.json(
    standardResponse({
      ...txn,
      suspicious_indicators: [
        {
          indicator: 'STRUCTURING_UNDER_REPORTING_THRESHOLD',
          label: 'Structuring Under Threshold',
          severity: 'CRITICAL',
          observed_facts: { amount: txn.amount, threshold: 50000 },
          suspicious_interpretation: 'Intentional cash breakdown to evade automated CTR banking triggers.',
          evidence: { transaction_count_24h: 3 },
        },
        {
          indicator: 'MULE_PROXIMITY_CORRIDOR',
          label: 'Mule Extraction Hub',
          severity: 'HIGH',
          observed_facts: { terminal: txn.location },
          suspicious_interpretation: 'Known high-risk withdrawal cluster identified by DBSCAN geospatial model.',
          evidence: { cluster_id: 'cluster-del-northwest' },
        },
      ],
      recommendations: [
        {
          action_id: 'REC-FREEZE-01',
          priority: 'URGENT',
          target_entity: txn.account,
          title: 'Request Emergency Debit Freeze (Section 91 CrPC)',
          description: 'Submit instant freeze order to Nodal Officer at Bank.',
          rationale: 'Funds are actively being converted to cash via ATM burst.',
        },
      ],
    })
  );
});

apiRouter.get('/transactions/:id/mule-hops', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      transaction_id: req.params.id,
      hops: [
        {
          hop_level: 1,
          entity: 'Victim Account (Rajesh Mehta)',
          account: 'SBIN-00192-3312',
          bank: 'State Bank of India',
          amount: 148500,
          timestamp: '2026-09-17 08:30:00',
          channel: 'UPI NetBanking',
        },
        {
          hop_level: 2,
          entity: 'Primary Layering Mule (quickcash.mule@okaxis)',
          account: 'AXIS-9921-1120',
          bank: 'Axis Bank',
          amount: 148500,
          timestamp: '2026-09-17 08:41:12',
          channel: 'P2P UPI Hop',
        },
        {
          hop_level: 3,
          entity: 'Secondary Cash-Out Mule (Dinesh Kumar)',
          account: 'SBIN-0442-8819',
          bank: 'State Bank of India',
          amount: 98500,
          timestamp: '2026-09-17 09:05:00',
          channel: 'IMPS Intra-Bank',
        },
        {
          hop_level: 4,
          entity: 'Physical Cash Withdrawal (Rohini Sector 7 ATM-04)',
          account: 'CASH-WITHDRAWAL',
          bank: 'ATM-ROH-04',
          amount: 49500,
          timestamp: '2026-09-17 09:12:44',
          channel: 'ATM Terminal Cloned Card',
        },
      ],
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// 7. KNOWLEDGE GRAPH
// ──────────────────────────────────────────────────────────────────────────
apiRouter.get('/graph', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      nodes: [
        { id: 'PER-MULE-01', label: 'Dinesh K. (Mule)', type: 'Person', isSuspicious: true, riskScore: 94, severity: 'CRITICAL', properties: { role: 'Cash Courier' } },
        { id: 'ACC-8819', label: 'SBIN-****-8819', type: 'Account', isSuspicious: true, riskScore: 92, severity: 'CRITICAL', properties: { bank: 'SBI' } },
        { id: 'ATM-ROH-04', label: 'ATM-ROH-04 (Sector 7)', type: 'ATM', isSuspicious: true, riskScore: 94, severity: 'CRITICAL', properties: { city: 'Delhi' } },
        { id: 'PER-MULE-02', label: 'Sunil R. (Mule)', type: 'Person', isSuspicious: true, riskScore: 88, severity: 'HIGH', properties: { role: 'SIM Recruiter' } },
        { id: 'ACC-4011', label: 'PUNB-****-4011', type: 'Account', isSuspicious: true, riskScore: 88, severity: 'HIGH', properties: { bank: 'PNB' } },
        { id: 'DEV-IMEI-99', label: 'OnePlus Nord IMEI:8612..', type: 'Device', isSuspicious: true, riskScore: 90, severity: 'CRITICAL', properties: { location: 'Rohini' } },
        { id: 'CASE-88190', label: 'NCRP #88190', type: 'Case', isSuspicious: false, riskScore: 70, severity: 'HIGH', properties: { amount: 148500 } },
      ],
      edges: [
        { id: 'e1', source: 'PER-MULE-01', target: 'ACC-8819', type: 'Owns', label: 'Registered Holder', isSuspicious: true },
        { id: 'e2', source: 'ACC-8819', target: 'ATM-ROH-04', type: 'Withdraws', label: '₹49,500 Cash-Out', isSuspicious: true, amount: 49500 },
        { id: 'e3', source: 'PER-MULE-01', target: 'DEV-IMEI-99', type: 'Uses', label: 'Primary Handset', isSuspicious: true },
        { id: 'e4', source: 'ACC-4011', target: 'ACC-8819', type: 'Transfers', label: '₹98,500 Layering', isSuspicious: true, amount: 98500 },
        { id: 'e5', source: 'PER-MULE-02', target: 'ACC-4011', type: 'Owns', label: 'Mule Account', isSuspicious: true },
        { id: 'e6', source: 'CASE-88190', target: 'ACC-8819', type: 'Associated With', label: 'Disputed Capital Target', isSuspicious: true },
      ],
      stats: {
        totalEntities: 7,
        flaggedEntities: 6,
        highRiskRings: 2,
        totalTiedVolume: 345000,
      },
    })
  );
});

apiRouter.get('/graph/case/:caseId', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      nodes: [
        { id: 'CASE-88190', label: 'NCRP #88190', type: 'Case', isSuspicious: false, riskScore: 85 },
        { id: 'ACC-8819', label: 'SBIN-****-8819', type: 'Account', isSuspicious: true, riskScore: 92 },
        { id: 'ATM-ROH-04', label: 'ATM-ROH-04', type: 'ATM', isSuspicious: true, riskScore: 94 },
      ],
      edges: [
        { id: 'e1', source: 'CASE-88190', target: 'ACC-8819', type: 'Associated With', isSuspicious: true },
        { id: 'e2', source: 'ACC-8819', target: 'ATM-ROH-04', type: 'Withdraws', isSuspicious: true },
      ],
      stats: { totalEntities: 3, flaggedEntities: 2, highRiskRings: 1, totalTiedVolume: 148500 },
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// 8. INVESTIGATIONS WORKSPACE & CASE DOSSIERS
// ──────────────────────────────────────────────────────────────────────────
let investigations = [
  {
    id: 'inv-case-2026-091',
    case_number: 'CASE-2026-091',
    title: 'Operation Rohini Strike: P2P Mule Ring ATM Dispersal',
    alert_id: 'ALT-2026-0041',
    complaint_id: 'cmp-ncrp-2026-88190',
    lead_investigator_id: 'usr-investigator-01',
    lead_investigator: mockUsers[1],
    status: 'ACTIVE',
    priority: 'URGENT',
    findings: 'Physical intercept coordinated with Rohini North PCR unit. Beneficiary account frozen under Sec 91 CrPC. CCTV footage from ATM-ROH-04 requested from SBI Nodal Officer.',
    outcome: 'INTERVENTION_PREVENTED_CASHOUT',
    created_at: '2026-09-17T09:30:00Z',
    updated_at: '2026-09-17T11:45:00Z',
    notes: [
      {
        id: 'n-01',
        author_id: 'usr-investigator-01',
        author: mockUsers[1],
        note: 'Coordinated with PCR van 14 stationed at Madhuban Chowk. Patrolling ATM cluster Sector 7 & 8.',
        created_at: '2026-09-17T09:45:00Z',
      },
      {
        id: 'n-02',
        author_id: 'usr-analyst-01',
        author: mockUsers[2],
        note: 'Cross-referenced UPI VPA with 3 previous FIRs registered in Cyber Crime PS Dwarka.',
        created_at: '2026-09-17T10:20:00Z',
      },
    ],
  },
  {
    id: 'inv-case-2026-088',
    case_number: 'CASE-2026-088',
    title: 'Laxmi Nagar Metro Transit Syndicate',
    alert_id: 'ALT-2026-0042',
    complaint_id: 'cmp-ncrp-2026-88191',
    lead_investigator_id: 'usr-investigator-01',
    lead_investigator: mockUsers[1],
    status: 'UNDER_REVIEW',
    priority: 'HIGH',
    findings: 'PNB branch contacted to retrieve KYC video logs. SIM registered in Jamtara; operative active in East Delhi.',
    outcome: null,
    created_at: '2026-09-16T14:10:00Z',
    updated_at: '2026-09-16T16:20:00Z',
    notes: [],
  },
];

apiRouter.get('/investigations', (req: Request, res: Response) => {
  res.json(standardResponse(investigations));
});

apiRouter.post('/investigations', (req: Request, res: Response) => {
  const body = req.body || {};
  const randNum = Math.floor(100 + Math.random() * 900);
  const newInv = {
    id: `inv-case-2026-${randNum}`,
    case_number: `CASE-2026-${randNum}`,
    title: body.title || 'New Cybercrime Investigation Dossier',
    alert_id: body.alert_id || null,
    complaint_id: body.complaint_id || null,
    lead_investigator_id: 'usr-investigator-01',
    lead_investigator: mockUsers[1],
    status: 'ACTIVE',
    priority: body.priority || 'HIGH',
    findings: body.initial_findings || 'Investigation initiated via Intelligence Command Platform.',
    outcome: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
  };
  investigations.unshift(newInv);
  res.status(201).json(standardResponse(newInv));
});

apiRouter.get('/investigations/:id', (req: Request, res: Response) => {
  const inv = investigations.find((i) => i.id === req.params.id || i.case_number === req.params.id) || investigations[0];
  res.json(standardResponse(inv));
});

apiRouter.post('/investigations/:id/notes', (req: Request, res: Response) => {
  const inv = investigations.find((i) => i.id === req.params.id || i.case_number === req.params.id);
  if (inv) {
    const note = {
      id: `n-${Date.now()}`,
      author_id: 'usr-investigator-01',
      author: mockUsers[1],
      note: req.body.note || 'Case progress note recorded.',
      created_at: new Date().toISOString(),
    };
    inv.notes.push(note);
    res.json(standardResponse(note));
  } else {
    res.status(404).json({ status: 'error', error: { message: 'Investigation not found' } });
  }
});

apiRouter.patch('/investigations/:id', (req: Request, res: Response) => {
  const inv = investigations.find((i) => i.id === req.params.id || i.case_number === req.params.id);
  if (inv) {
    Object.assign(inv, req.body);
    inv.updated_at = new Date().toISOString();
    res.json(standardResponse(inv));
  } else {
    res.status(404).json({ status: 'error', error: { message: 'Investigation not found' } });
  }
});

apiRouter.post('/investigations/:id/outcome', (req: Request, res: Response) => {
  const inv = investigations.find((i) => i.id === req.params.id || i.case_number === req.params.id);
  if (inv) {
    inv.outcome = req.body.outcome || 'INTERVENTION_PREVENTED_CASHOUT';
    res.json(standardResponse(inv));
  } else {
    res.status(404).json({ status: 'error', error: { message: 'Investigation not found' } });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 9. RISK INTELLIGENCE & EVALUATION ENGINE
// ──────────────────────────────────────────────────────────────────────────
apiRouter.post('/risk/evaluate', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      atm_id: req.body.atm_id || 'ATM-ROH-04',
      composite_risk_score: 94.2,
      severity: 'CRITICAL',
      confidence: 0.93,
      alert_eligible: true,
      factor_contributions: {
        mule_proximity: 0.92,
        velocity_anomaly: 0.89,
        structuring_pattern: 0.85,
      },
    })
  );
});

apiRouter.get('/risk/atm/:atmId', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      atm_id: req.params.atmId,
      composite_risk_score: 91.5,
      severity: 'CRITICAL',
      confidence: 0.92,
      alert_eligible: true,
      factor_contributions: {
        mule_proximity: 0.90,
        velocity_anomaly: 0.88,
        structuring_pattern: 0.84,
      },
    })
  );
});

apiRouter.get('/risk/explanations/:atmId', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      atm_id: req.params.atmId,
      model_version: 'RandomForest-v2.0',
      timestamp: new Date().toISOString(),
      base_probability: 0.12,
      final_risk_score: 94.2,
      top_features: [
        { feature: 'mule_accounts_within_2km', importance: 0.42, observed_value: 3 },
        { feature: 'structuring_transactions_count', importance: 0.28, observed_value: 4 },
        { feature: 'velocity_burst_z_score', importance: 0.19, observed_value: 3.4 },
        { feature: 'transit_proximity_multiplier', importance: 0.11, observed_value: 1.6 },
      ],
      shap_summary: 'Extreme risk driven by 3 active mule accounts within 1.8km and 4 rapid withdrawals under ₹50,000 threshold.',
    })
  );
});

apiRouter.post('/risk/top', (req: Request, res: Response) => {
  res.json(standardResponse(mockPredictions));
});

apiRouter.post('/risk/ingest', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      timestamp: new Date().toISOString(),
      top_locations: mockPredictions,
      alert_updates: [alerts[0]],
      message: 'Transaction ingested and real-time forecast updated',
    })
  );
});

apiRouter.post('/risk/replay', (req: Request, res: Response) => {
  res.json(
    standardResponse({
      simulation_id: `sim-${Date.now()}`,
      processed_events: 1420,
      detected_hotspots: 4,
      alerts_generated: 4,
      precision: 0.934,
      recall: 0.912,
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// 10. AUDIT & MODEL REGISTRY
// ──────────────────────────────────────────────────────────────────────────
apiRouter.get('/audit/events', (req: Request, res: Response) => {
  res.json(
    standardResponse([
      {
        id: 'aud-01',
        event_type: 'ALERT_DISPATCHED',
        actor: 'ML_INFERENCE_ENGINE',
        resource_type: 'Alert',
        resource_id: 'ALT-2026-0041',
        timestamp: '2026-09-17T09:15:00Z',
        details: 'Critical alert dispatched for Rohini Sector 7 ATM-04',
      },
      {
        id: 'aud-02',
        event_type: 'INVESTIGATION_OPENED',
        actor: 'Inspector Vikram Rathore',
        resource_type: 'Investigation',
        resource_id: 'CASE-2026-091',
        timestamp: '2026-09-17T09:30:00Z',
        details: 'Operation Rohini Strike opened and PCR dispatched',
      },
    ])
  );
});

apiRouter.get('/models', (req: Request, res: Response) => {
  res.json(
    standardResponse([
      {
        id: 'mdl-rf-2.0',
        name: 'RandomForest-CashOut-v2.0',
        version: 'v2.0',
        status: 'PRODUCTION',
        accuracy: '93.4%',
        f1_score: 0.92,
        roc_auc: 0.96,
        description: 'Primary cash-out withdrawal forecast classifier with spatial A1 Robust Z-Score.',
      },
      {
        id: 'mdl-dbscan-1.1',
        name: 'DBSCAN-Spatial-Corridor-v1.1',
        version: 'v1.1',
        status: 'PRODUCTION',
        description: 'Geospatial density-based clustering identifying ATM mule corridors.',
      },
    ])
  );
});
