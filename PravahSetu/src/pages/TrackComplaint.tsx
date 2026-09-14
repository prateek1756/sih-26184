import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch,
  Search,
  Clock,
  ShieldCheck,
  AlertCircle,
  Building2,
  Calendar,
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Timeline } from '../components/ui/Timeline';
import { TrackingService, TrackingResult } from '../services/trackingService';
import { Complaint } from '../types';

export const TrackComplaint: React.FC = () => {
  const location = useLocation();
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);

  // Check if passed via navigation state (e.g. from success screen)
  useEffect(() => {
    const passedId = location.state?.autoSearchId;
    if (passedId) {
      setSearchId(passedId);
      performTrack(passedId);
    } else {
      // Default to demo complaint for instant impressive demonstration
      performTrack('CYB-2026-001284');
    }
  }, [location.state]);

  const performTrack = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await TrackingService.trackComplaint(query);
      setResult(res);
    } catch {
      setResult({ found: false, message: 'Failed to retrieve complaint details from server.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      performTrack(searchId);
    }
  };

  const handleQuickDemoClick = (id: string) => {
    setSearchId(id);
    performTrack(id);
  };

  const complaint = result?.complaint;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-50 text-cyber-700 border border-cyber-200 text-xs font-bold uppercase tracking-wider">
            <FileSearch className="w-3.5 h-3.5" />
            <span>Citizen Status Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Track Your Complaint
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
            Enter your 14-digit Complaint ID (e.g., CYB-2026-001284) or registered 10-digit mobile number to view live progress.
          </p>
        </div>

        {/* Search Box */}
        <Card className="shadow-card border-slate-200">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter Complaint ID (CYB-2026-XXXXXX) or Mobile Number"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyber-500 focus:border-transparent font-medium"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSearching}
                rightIcon={<Search className="w-4 h-4" />}
                className="px-6 py-3 shrink-0"
              >
                Track Status
              </Button>
            </form>

            {/* Quick Demo Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyber-500" /> Try demo cases:
              </span>
              <button
                type="button"
                onClick={() => handleQuickDemoClick('CYB-2026-001284')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-cyber-50 hover:text-cyber-700 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200 transition"
              >
                CYB-2026-001284 (UPI Fraud)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoClick('CYB-2026-002195')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200 transition"
              >
                CYB-2026-002195 (Resolved Phishing)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoClick('CYB-2026-003412')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200 transition"
              >
                CYB-2026-003412 (Under Verification)
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Results Area */}
        <AnimatePresence mode="wait">
          {result && result.found && complaint ? (
            <motion.div
              key={complaint.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Status Header Card */}
              <Card className="border-slate-200 shadow-card overflow-hidden">
                <div className="p-6 sm:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-mono font-bold text-lg text-slate-900">
                        {complaint.id}
                      </span>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700">
                      {complaint.categoryLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Dossier
                    </button>
                  </div>
                </div>

                <CardContent className="p-6 sm:p-7 bg-slate-50/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-left">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-medium">Filing Date:</span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {new Date(complaint.submittedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-medium">Last Officer Action:</span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {new Date(complaint.lastUpdatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-medium">Reported Loss:</span>
                      <span className="font-bold text-rose-600 text-sm mt-0.5 block">
                        {complaint.financialDetails?.amountLost
                          ? `₹${complaint.financialDetails.amountLost.toLocaleString('en-IN')}`
                          : 'No Loss (Advisory)'}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-medium">Jurisdiction:</span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                        {complaint.district}, {complaint.state}
                      </span>
                    </div>
                  </div>

                  {complaint.assignedAuthority && (
                    <div className="mt-4 p-3.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5 text-xs text-left">
                      <Building2 className="w-4 h-4 text-cyber-600 shrink-0" />
                      <div>
                        <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider">
                          Investigating Cyber Unit
                        </span>
                        <span className="font-bold text-slate-800">
                          {complaint.assignedAuthority}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Investigation Lifecycle Timeline */}
              <Card className="border-slate-200 shadow-card">
                <CardHeader className="border-b border-slate-100 text-left">
                  <CardTitle>Investigation Progress Timeline</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized citizen transparency view. Confidential tactical intelligence is excluded.
                  </p>
                </CardHeader>
                <CardContent className="p-6 sm:p-8">
                  <Timeline events={complaint.timeline} />
                </CardContent>
              </Card>

              {/* Citizen Incident Narrative Preview */}
              <Card className="border-slate-200 shadow-card text-left">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-base">Submitted Incident Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {complaint.incidentDescription}
                  </p>
                  {complaint.evidence && complaint.evidence.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-600 mb-2">
                        Attached Digital Evidence ({complaint.evidence.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {complaint.evidence.map((ev) => (
                          <span
                            key={ev.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700"
                          >
                            <FileText className="w-3.5 h-3.5 text-cyber-600" />
                            <span>{ev.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : result && !result.found ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 text-center rounded-2xl bg-white border border-rose-200 shadow-subtle text-left max-w-md mx-auto"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 text-center">
                No Record Found
              </h3>
              <p className="text-xs text-slate-500 mt-1 text-center leading-relaxed">
                {result.message}
              </p>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => handleQuickDemoClick('CYB-2026-001284')}
                  className="text-xs font-bold text-cyber-600 hover:underline"
                >
                  Click here to view a sample active complaint
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};
