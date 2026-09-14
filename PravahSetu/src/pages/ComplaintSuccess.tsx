import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Copy,
  Check,
  FileSearch,
  LayoutDashboard,
  Printer,
  Download,
  ShieldCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import { Complaint } from '../types';

export const ComplaintSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Retrieve complaint passed via router state or fallback to default
  const complaint: Complaint = location.state?.complaint || {
    id: 'CYB-2026-001284',
    categoryLabel: 'UPI & Payment Fraud',
    submittedAt: new Date().toISOString(),
    citizenName: 'Citizen',
    district: 'Jurisdiction Area',
  };

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0066FF', '#10B981', '#FF9933'],
      });
    } catch {
      // ignore
    }
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(complaint.id);
    setCopied(true);
    showToast('success', 'Complaint ID Copied', 'Copied to clipboard for future tracking.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(complaint.submittedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="border-emerald-200/80 shadow-card overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white text-center relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl bg-white text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-900/20"
            >
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Complaint Registered Successfully
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1">
              Your grievance has been logged in the national cybercrime tracking registry.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6 text-left">
            {/* Complaint ID Prominent Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Official Complaint ID
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-navy-900 tracking-tight">
                  {complaint.id}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Save this number to check your investigation status anytime
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyId}
                leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                className="shrink-0 w-full sm:w-auto"
              >
                {copied ? 'Copied!' : 'Copy ID'}
              </Button>
            </div>

            {/* Summary Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 block font-medium">Incident Category:</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {complaint.categoryLabel}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 block font-medium">Submission Timestamp:</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formattedDate}
                </span>
              </div>
            </div>

            {/* Next Steps Guidance */}
            <div className="p-4 rounded-xl bg-cyber-50/70 border border-cyber-200 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyber-600" />
                What happens next?
              </h4>
              <ul className="space-y-1.5 text-xs text-cyber-950">
                <li className="flex items-start gap-1.5">
                  <span className="text-cyber-600 font-bold">1.</span>
                  <span>
                    Our cyber desk initiates formal preliminary verification within 2 to 4 hours.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyber-600 font-bold">2.</span>
                  <span>
                    If financial loss was reported, automated alert notices are queued for destination banks under the 1930 framework.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyber-600 font-bold">3.</span>
                  <span>
                    You will receive SMS alerts on your mobile whenever an officer updates your case file.
                  </span>
                </li>
              </ul>
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
              <Link to="/track" state={{ autoSearchId: complaint.id }} className="w-full sm:w-1/2">
                <Button
                  variant="primary"
                  className="w-full"
                  leftIcon={<FileSearch className="w-4 h-4" />}
                >
                  Track This Complaint
                </Button>
              </Link>

              <Link to="/dashboard" className="w-full sm:w-1/2">
                <Button
                  variant="outline"
                  className="w-full"
                  leftIcon={<LayoutDashboard className="w-4 h-4" />}
                >
                  Go to Citizen Dashboard
                </Button>
              </Link>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" /> Print or Save PDF Acknowledgment Slip
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
