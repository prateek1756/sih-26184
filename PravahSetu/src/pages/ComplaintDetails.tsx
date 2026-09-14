import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Printer,
  ShieldCheck,
  AlertCircle,
  Download,
  Eye,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Timeline } from '../components/ui/Timeline';
import { EmptyState } from '../components/ui/StateViews';
import { ComplaintService } from '../services/complaintService';
import { Complaint } from '../types';

export const ComplaintDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    if (id) {
      const found = ComplaintService.getById(id);
      if (found) {
        setComplaint(found);
      }
    }
  }, [id]);

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <EmptyState
          title="Complaint Record Not Found"
          description={`No active complaint was found matching ID "${id}".`}
          actionText="Back to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-8 sm:py-12 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full space-y-6">
        {/* Back Navigation & Print */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-cyber-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print Case Slip
          </button>
        </div>

        {/* Main Dossier Header */}
        <Card className="border-slate-200 shadow-card">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="font-mono text-xl font-black text-slate-900">{complaint.id}</span>
                <StatusBadge status={complaint.status} />
              </div>
              <p className="text-sm font-bold text-cyber-700">{complaint.categoryLabel}</p>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-500">
              <p>
                Filed On:{' '}
                <strong className="text-slate-800">
                  {new Date(complaint.submittedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </p>
              <p className="mt-0.5">
                Last Status Update:{' '}
                <strong className="text-slate-800">
                  {new Date(complaint.lastUpdatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </p>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Quick Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-medium">Complainant:</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                  {complaint.citizenName}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-medium">Incident Date:</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {complaint.incidentDate}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-medium">Financial Loss:</span>
                <span className="font-bold text-rose-600 text-sm mt-0.5 block">
                  {complaint.financialDetails?.amountLost
                    ? `₹${complaint.financialDetails.amountLost.toLocaleString('en-IN')}`
                    : 'Nil'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-medium">Jurisdiction:</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                  {complaint.district}, {complaint.state}
                </span>
              </div>
            </div>

            {/* Jurisdiction Officer Banner */}
            {complaint.assignedAuthority && (
              <div className="p-4 rounded-xl bg-cyber-50/50 border border-cyber-200 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-cyber-600 shrink-0" />
                <div className="text-xs">
                  <span className="text-cyber-800 font-bold block uppercase tracking-wider text-[10px]">
                    Investigating Unit Assigned
                  </span>
                  <span className="text-slate-800 font-semibold">{complaint.assignedAuthority}</span>
                </div>
              </div>
            )}

            {/* Narrative */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Detailed Incident Narrative
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                {complaint.incidentDescription}
              </p>
            </div>

            {/* Financial Details if loss */}
            {complaint.financialDetails && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Bank & Transaction Trace Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Mode:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.financialDetails.transactionType || 'UPI'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Bank / Wallet:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.financialDetails.bankOrWallet || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Transaction Reference:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.financialDetails.transactionId || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Suspect VPA:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.financialDetails.upiId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Evidence Gallery */}
            {complaint.evidence && complaint.evidence.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Submitted Proofs & Evidence ({complaint.evidence.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {complaint.evidence.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-cyber-600 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {file.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Case Timeline */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Case Status & Chronological Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <Timeline events={complaint.timeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
