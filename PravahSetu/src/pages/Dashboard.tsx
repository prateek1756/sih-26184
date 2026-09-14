import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FilePlus,
  FileSearch,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Eye,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/StateViews';
import { useAuth } from '../context/AuthContext';
import { ComplaintService } from '../services/complaintService';
import { Complaint } from '../types';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    // Load persisted complaints (including any new ones filed by citizen)
    const list = ComplaintService.getAll();
    setComplaints(list);
  }, []);

  const totalCount = complaints.length;
  const activeCount = complaints.filter(
    (c) => c.status !== 'RESOLVED'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.incidentDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.status !== 'RESOLVED') ||
      (statusFilter === 'RESOLVED' && c.status === 'RESOLVED');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-8 sm:py-12 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-8">
        {/* Welcome Header & Quick Action CTAs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-cyber-950 text-white shadow-xl border border-navy-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-500/20 text-cyber-300 text-xs font-semibold mb-2 border border-cyber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Citizen Session</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome Back, {user?.fullName || 'Citizen'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Track your cyber incident cases, view jurisdictional cyber cell updates, and manage digital proofs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/report">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FilePlus className="w-4 h-4" />}
                className="shadow-md shadow-cyber-600/30"
              >
                + New Complaint
              </Button>
            </Link>
            <Link to="/track">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileSearch className="w-4 h-4" />}
                className="bg-navy-900 border-navy-700 text-white hover:bg-navy-800"
              >
                Track by ID
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistics Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="border-slate-200 shadow-subtle hover:shadow-card transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Complaints
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">{totalCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Filed across all incidents</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyber-50 text-cyber-600 flex items-center justify-center font-bold">
                <LayoutDashboard className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-subtle hover:shadow-card transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Inquiries
                </p>
                <p className="text-3xl font-black text-amber-600 mt-1">{activeCount}</p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                  Under police investigation
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-subtle hover:shadow-card transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Resolved Complaints
                </p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  Action completed & closed
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complaints Table & Filter Bar */}
        <Card className="border-slate-200 shadow-card overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Registered Cyber Complaints</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Official records registered under your citizen credentials
              </p>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search ID, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyber-500 bg-white"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 font-semibold rounded-lg transition ${
                    statusFilter === 'ALL' ? 'bg-white text-cyber-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1 font-semibold rounded-lg transition ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('RESOLVED')}
                  className={`px-3 py-1 font-semibold rounded-lg transition ${
                    statusFilter === 'RESOLVED'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Resolved ({resolvedCount})
                </button>
              </div>
            </div>
          </div>

          {filteredComplaints.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3.5 px-6">Complaint ID</th>
                      <th className="py-3.5 px-6">Incident Category</th>
                      <th className="py-3.5 px-6">Date Filed</th>
                      <th className="py-3.5 px-6">Current Status</th>
                      <th className="py-3.5 px-6">Loss Amount</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredComplaints.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900 text-xs">
                          {c.id}
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-semibold text-slate-800 text-xs">{c.categoryLabel}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {c.incidentDescription}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                          {new Date(c.submittedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge status={c.status} size="sm" />
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold text-slate-700">
                          {c.financialDetails?.amountLost ? (
                            <span className="text-rose-600 font-bold">
                              ₹{c.financialDetails.amountLost.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link to={`/complaint/${c.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Conversion View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredComplaints.map((c) => (
                  <div key={c.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">{c.id}</span>
                      <StatusBadge status={c.status} size="sm" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{c.categoryLabel}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {c.incidentDescription}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span>
                        Filed:{' '}
                        {new Date(c.submittedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {c.financialDetails?.amountLost && (
                        <span className="font-bold text-rose-600">
                          Loss: ₹{c.financialDetails.amountLost.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="pt-2">
                      <Link to={`/complaint/${c.id}`} className="w-full block">
                        <Button variant="outline" size="sm" className="w-full justify-center">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8">
              <EmptyState
                title="No Complaints Found"
                description="No complaints matched your active filter or search query. Click below to file a new cyber incident."
                actionText="File New Complaint"
                onAction={() => navigate('/report')}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
