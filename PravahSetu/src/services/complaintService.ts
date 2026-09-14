import { Complaint, CrimeCategory, EvidenceFile } from '../types';
import { INITIAL_MOCK_COMPLAINTS } from '../data/mockComplaints';
import { CRIME_CATEGORIES } from '../data/constants';

const STORAGE_KEY = 'cyber_suraksha_complaints_v1';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export class ComplaintService {
  private static loadComplaints(): Complaint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MOCK_COMPLAINTS;
  }

  private static saveComplaints(complaints: Complaint[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
    } catch {
      // ignore storage quota errors
    }
  }

  static getAll(): Complaint[] {
    return this.loadComplaints();
  }

  static getById(id: string): Complaint | undefined {
    const list = this.loadComplaints();
    const cleanId = id.trim().toUpperCase();
    return list.find((c) => c.id.toUpperCase() === cleanId);
  }

  static getByMobile(mobile: string): Complaint[] {
    const list = this.loadComplaints();
    const cleanPhone = mobile.replace(/\D/g, '');
    return list.filter((c) => c.citizenMobile.replace(/\D/g, '').includes(cleanPhone));
  }

  /**
   * Fetch complaint directly from backend PostgreSQL via public tracking endpoint.
   */
  static async fetchById(idOrMobile: string): Promise<Complaint | undefined> {
    const cleanQuery = idOrMobile.trim();
    if (!cleanQuery) return undefined;

    try {
      const res = await fetch(`${API_BASE_URL}/complaints/track/${encodeURIComponent(cleanQuery)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        const c = json.data;
        if (c) {
          const nowFormatted = new Date(c.created_at || c.filed_at).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          const mapped: Complaint = {
            id: c.complaint_number,
            citizenName: c.complainant_name || 'Complainant',
            citizenMobile: c.complainant_contact || '',
            citizenEmail: '',
            state: c.victim_state || 'N/A',
            district: c.victim_district || c.victim_city || 'N/A',
            preferredLanguage: 'English',
            category: (c.subcategory || c.category || 'FINANCIAL_FRAUD') as CrimeCategory,
            categoryLabel: c.category,
            incidentDate: c.filed_at ? c.filed_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            incidentDescription: c.description || '',
            lostMoney: (Number(c.reported_amount) || 0) > 0,
            financialDetails: c.financial_details || undefined,
            evidence: Array.isArray(c.evidence_files) ? c.evidence_files : [],
            status: c.status ? c.status.toUpperCase() : 'SUBMITTED',
            statusLabel: c.status === 'open' ? 'Complaint Registered' : c.status,
            submittedAt: c.created_at || c.filed_at || new Date().toISOString(),
            lastUpdatedAt: c.updated_at || c.created_at || new Date().toISOString(),
            assignedAuthority: `Cyber Crime Cell, ${c.victim_district || c.victim_state || 'State'} Jurisdiction`,
            timeline: [
              {
                id: `t-${c.id}-1`,
                stage: '01',
                title: 'Complaint Submitted & Persisted in National Database',
                description: 'Complaint verified and recorded into central law enforcement database.',
                timestamp: nowFormatted,
                status: 'completed',
              },
              {
                id: `t-${c.id}-2`,
                stage: '02',
                title: 'Initial Scrutiny & Jurisdiction Verification',
                description: 'Assigned to jurisdictional cyber cell for beneficiary freeze inquiry.',
                status: c.status === 'open' ? 'current' : 'completed',
                officerNote: 'Queued for automated nodal bank notification and preliminary verification.',
              },
              {
                id: `t-${c.id}-3`,
                stage: '03',
                title: 'Investigation Officer Assignment',
                description: 'Forwarded to cyber police station for intelligence correlation.',
                status: c.status === 'under_investigation' ? 'current' : 'pending',
              },
              {
                id: `t-${c.id}-4`,
                stage: '04',
                title: 'Investigation in Progress',
                description: 'Action taken to freeze accounts, preserve server logs, and summon suspects.',
                status: 'pending',
              },
              {
                id: `t-${c.id}-5`,
                stage: '05',
                title: 'Case Resolution',
                description: 'Filing of final report or court recovery petition.',
                status: c.status === 'resolved' || c.status === 'closed' ? 'completed' : 'pending',
              },
            ],
          };

          // Cache in local list
          const existingList = this.loadComplaints();
          const filtered = existingList.filter((item) => item.id !== mapped.id);
          this.saveComplaints([mapped, ...filtered]);

          return mapped;
        }
      }
    } catch (err) {
      console.warn('Backend tracking request failed, falling back to local storage cache:', err);
    }

    // Fallback to local storage
    return this.getById(cleanQuery) || this.getByMobile(cleanQuery)[0];
  }

  /**
   * Submit new complaint to FastAPI Backend -> PostgreSQL.
   */
  static async createComplaint(data: {
    citizenName: string;
    citizenMobile: string;
    citizenEmail: string;
    state: string;
    district: string;
    preferredLanguage: string;
    category: CrimeCategory;
    incidentDate: string;
    incidentTime?: string;
    incidentDescription: string;
    suspectInfo?: string;
    suspectContact?: string;
    suspectUrl?: string;
    lostMoney: boolean;
    financialDetails?: {
      amountLost?: number;
      transactionType?: string;
      transactionId?: string;
      bankOrWallet?: string;
      upiId?: string;
    };
    evidence: EvidenceFile[];
  }): Promise<Complaint> {
    const categoryInfo = CRIME_CATEGORIES.find((c) => c.value === data.category);
    const categoryLabel = categoryInfo?.label || data.category;
    const amountLost = data.lostMoney && data.financialDetails?.amountLost ? data.financialDetails.amountLost : 0;

    const suspectParts: string[] = [];
    if (data.suspectInfo) suspectParts.push(`Info: ${data.suspectInfo}`);
    if (data.suspectContact) suspectParts.push(`Contact: ${data.suspectContact}`);
    if (data.suspectUrl) suspectParts.push(`URL: ${data.suspectUrl}`);
    const suspectInfoStr = suspectParts.join(' | ') || undefined;

    const payload = {
      category: categoryLabel,
      subcategory: data.category,
      description: data.incidentDescription,
      reported_amount: amountLost,
      victim_state: data.state,
      victim_city: data.district,
      victim_district: data.district,
      complainant_name: data.citizenName,
      complainant_contact: data.citizenMobile,
      suspect_info: suspectInfoStr,
      financial_details: data.financialDetails || null,
      evidence_files: data.evidence.map((e) => ({ name: e.name, size: e.size, type: e.type })),
      priority: amountLost > 100000 ? 'HIGH' : 'MEDIUM',
    };

    let backendData: any = null;
    try {
      const res = await fetch(`${API_BASE_URL}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || errJson?.detail || `Server returned HTTP ${res.status}`;
        throw new Error(msg);
      }

      const json = await res.json();
      backendData = json.data;
    } catch (err: any) {
      console.error('Failed to submit complaint to backend API:', err);
      throw err;
    }

    const officialComplaintId = backendData?.complaint_number || `CYB-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newComplaint: Complaint = {
      id: officialComplaintId,
      ...data,
      categoryLabel,
      status: 'SUBMITTED',
      statusLabel: 'Complaint Registered',
      submittedAt: backendData?.created_at || now,
      lastUpdatedAt: backendData?.updated_at || now,
      assignedAuthority: `Cyber Crime Cell, ${data.district || 'State'} Jurisdiction`,
      timeline: [
        {
          id: `t-${Date.now()}-1`,
          stage: '01',
          title: 'Complaint Submitted & Persisted in PostgreSQL',
          description: `Official grievance registered in National Cybercrime Database with reference ${officialComplaintId}.`,
          timestamp: nowFormatted,
          status: 'completed',
        },
        {
          id: `t-${Date.now()}-2`,
          stage: '02',
          title: 'Initial Scrutiny & Verification',
          description: 'Portal officer reviewing the submitted complaint and digital proofs for legal jurisdiction.',
          status: 'current',
          officerNote: 'Queued for automated nodal bank notification and preliminary verification.',
        },
        {
          id: `t-${Date.now()}-3`,
          stage: '03',
          title: 'Investigation Officer Assignment',
          description: 'Case will be forwarded to the respective district cyber crime police station.',
          status: 'pending',
        },
        {
          id: `t-${Date.now()}-4`,
          stage: '04',
          title: 'Investigation in Progress',
          description: 'Action taken to freeze accounts, preserve server logs, and summon suspects.',
          status: 'pending',
        },
        {
          id: `t-${Date.now()}-5`,
          stage: '05',
          title: 'Case Resolution',
          description: 'Filing of final report or court recovery petition.',
          status: 'pending',
        },
      ],
    };

    // Cache copy in localStorage for immediate client-side offline access
    const list = this.loadComplaints();
    const updated = [newComplaint, ...list];
    this.saveComplaints(updated);

    return newComplaint;
  }
}
