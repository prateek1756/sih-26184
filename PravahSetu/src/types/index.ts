export type ComplaintStatus = 
  | 'SUBMITTED' 
  | 'UNDER_REVIEW' 
  | 'ASSIGNED_FOR_INVESTIGATION' 
  | 'INVESTIGATION_IN_PROGRESS' 
  | 'RESOLVED';

export type CrimeCategory = 
  | 'UPI_PAYMENT_FRAUD'
  | 'PHISHING'
  | 'INVESTMENT_SCAM'
  | 'FAKE_CUSTOMER_CARE'
  | 'SOCIAL_MEDIA_FRAUD'
  | 'IDENTITY_THEFT'
  | 'JOB_SCAM'
  | 'ONLINE_SHOPPING_FRAUD'
  | 'HACKING'
  | 'EMAIL_FRAUD'
  | 'OTHER';

export interface TimelineEvent {
  id: string;
  stage: string;
  title: string;
  description: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'pending';
  officerNote?: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadedAt: string;
}

export interface Complaint {
  id: string;
  citizenName: string;
  citizenMobile: string;
  citizenEmail: string;
  state: string;
  district: string;
  preferredLanguage: string;
  
  category: CrimeCategory;
  categoryLabel: string;
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
  
  status: ComplaintStatus;
  statusLabel: string;
  submittedAt: string;
  lastUpdatedAt: string;
  timeline: TimelineEvent[];
  assignedAuthority?: string;
}

export interface User {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  isVerified: boolean;
}

export interface AwarenessArticle {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  shortDesc: string;
  iconName: string;
  severity: 'high' | 'critical' | 'medium';
  redFlags: string[];
  immediateActions: string[];
  preventionTips: string[];
  faq: { question: string; answer: string }[];
}

export interface FilterOptions {
  searchQuery: string;
  status?: string;
  category?: string;
  sortBy?: 'newest' | 'oldest' | 'amount';
}
