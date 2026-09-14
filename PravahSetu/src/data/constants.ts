import { CrimeCategory } from '../types';

export const CRIME_CATEGORIES: {
  value: CrimeCategory;
  label: string;
  shortDesc: string;
  iconName: string;
  badgeColor: string;
}[] = [
  {
    value: 'UPI_PAYMENT_FRAUD',
    label: 'UPI & Payment Fraud',
    shortDesc: 'Unauthorized debit, fake QR codes, or payment link scams',
    iconName: 'CreditCard',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    value: 'PHISHING',
    label: 'Phishing & Fake SMS',
    shortDesc: 'Deceptive messages, malicious links impersonating banks/Govt',
    iconName: 'MailWarning',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'INVESTMENT_SCAM',
    label: 'Investment / Trading Scam',
    shortDesc: 'High return promises on crypto, stocks, or bogus app schemes',
    iconName: 'TrendingDown',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    value: 'FAKE_CUSTOMER_CARE',
    label: 'Fake Customer Care',
    shortDesc: 'Fraudulent helpline numbers from search engines seeking remote access',
    iconName: 'Headphones',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'SOCIAL_MEDIA_FRAUD',
    label: 'Social Media & Impersonation',
    shortDesc: 'Hacked profiles, fake accounts, extortion, or impersonation',
    iconName: 'Share2',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    value: 'IDENTITY_THEFT',
    label: 'Identity Theft & Aadhaar Fraud',
    shortDesc: 'Misuse of personal identity cards, SIM swaps, or biometric data',
    iconName: 'UserX',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    value: 'JOB_SCAM',
    label: 'Part-time / Work from Home Scam',
    shortDesc: 'Telegram rating tasks, registration fees for fake job offers',
    iconName: 'Briefcase',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    value: 'ONLINE_SHOPPING_FRAUD',
    label: 'Online Shopping Fraud',
    shortDesc: 'Fake eCommerce websites, non-delivery of prepaid products',
    iconName: 'ShoppingBag',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    value: 'HACKING',
    label: 'Hacking & Device Intrusion',
    shortDesc: 'Ransomware, remote RAT malware, unauthorized email access',
    iconName: 'Cpu',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'EMAIL_FRAUD',
    label: 'Business Email Compromise (BEC)',
    shortDesc: 'Spoofed vendor invoices and executive email deception',
    iconName: 'Mail',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    value: 'OTHER',
    label: 'Other Cyber Incident',
    shortDesc: 'Any other cyber harassment or digital offense',
    iconName: 'ShieldAlert',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi (NCT)',
  'Jammu & Kashmir',
  'Ladakh',
  'Chandigarh',
];

export const STATUS_MAP: Record<
  string,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  SUBMITTED: {
    label: 'Complaint Submitted',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    step: 1,
  },
  UNDER_REVIEW: {
    label: 'Under Verification',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    step: 2,
  },
  ASSIGNED_FOR_INVESTIGATION: {
    label: 'Assigned for Investigation',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    step: 3,
  },
  INVESTIGATION_IN_PROGRESS: {
    label: 'Investigation in Progress',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    step: 4,
  },
  RESOLVED: {
    label: 'Resolved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    step: 5,
  },
};
