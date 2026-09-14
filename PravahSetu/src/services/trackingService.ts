import { ComplaintService } from './complaintService';
import { Complaint } from '../types';

export interface TrackingResult {
  found: boolean;
  complaint?: Complaint;
  message?: string;
}

export class TrackingService {
  static async trackComplaint(searchQuery: string): Promise<TrackingResult> {
    const query = searchQuery.trim();
    if (!query) {
      return { found: false, message: 'Please enter a valid Complaint ID or Mobile Number.' };
    }

    // Try fetching authoritative record from backend PostgreSQL
    try {
      const remote = await ComplaintService.fetchById(query);
      if (remote) {
        return { found: true, complaint: remote };
      }
    } catch {
      // ignore
    }

    // Try finding by Complaint ID from local fallback
    const byId = ComplaintService.getById(query);
    if (byId) {
      return { found: true, complaint: byId };
    }

    // Try finding by Mobile from local fallback
    const byMobile = ComplaintService.getByMobile(query);
    if (byMobile.length > 0) {
      return { found: true, complaint: byMobile[0] };
    }

    return {
      found: false,
      message: `No active complaint found matching "${query}". Please check the ID or verify your 10-digit mobile number.`,
    };
  }
}
