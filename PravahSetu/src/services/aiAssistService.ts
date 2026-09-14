export interface IncidentDraftParams {
  categoryLabel?: string;
  incidentDate?: string;
  roughNotes: string;
  suspectContact?: string;
  suspectUrl?: string;
  amountLost?: number;
}

export class AiAssistService {
  /**
   * Generates a coherent, legally precise incident narrative for the citizen
   * to review and approve before submission.
   */
  static generateIncidentDraft(params: IncidentDraftParams): string {
    const {
      categoryLabel = 'cyber fraud',
      incidentDate = 'recently',
      roughNotes,
      suspectContact,
      suspectUrl,
      amountLost,
    } = params;

    const dateClause = incidentDate ? `On or around ${incidentDate}` : 'Recently';
    const notesClean = roughNotes.trim();

    let narrative = `${dateClause}, I was targeted in an incident involving ${categoryLabel.toLowerCase()}. `;

    if (notesClean.length > 5) {
      narrative += `The sequence of events was as follows: ${notesClean}. `;
    } else {
      narrative += `The perpetrator contacted me under deceptive pretenses and induced me into taking unauthorized digital actions. `;
    }

    if (suspectContact) {
      narrative += `The communication originated from suspect contact details: ${suspectContact}. `;
    }

    if (suspectUrl) {
      narrative += `I was prompted to access the suspicious URL: ${suspectUrl}. `;
    }

    if (amountLost && amountLost > 0) {
      narrative += `As a direct consequence of this unauthorized deception, a total sum of ₹${amountLost.toLocaleString('en-IN')} was fraudulently debited from my account. `;
    }

    narrative += `I request the Cyber Crime Investigation Cell to kindly initiate appropriate legal inquiry, freeze the destination beneficiary trail, and take punitive action under the Information Technology Act, 2000.`;

    return narrative;
  }
}
