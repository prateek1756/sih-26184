import React from 'react';
import { Shield, CheckCircle2, Server, Database, Lock, Eye, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

export const About: React.FC = () => {
  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-12 sm:py-16 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-12">
        {/* Mission Statement Hero */}
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyber-50 text-cyber-700 border border-cyber-200 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-cyber-600" />
            <span>Citizen Trust & Digital Safety</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-navy-900 tracking-tight leading-tight">
            Democratizing Cyber Incident Reporting for Every Indian Citizen
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            As India's digital economy expands with UPI, fast mobile connectivity, and instantaneous banking, citizens require an accessible, reliable channel to report digital fraud and secure their hard-earned assets.
          </p>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            <strong className="text-navy-900 font-semibold">Pravah Setu</strong> bridges the critical gap between distressed citizens and law enforcement authorities by streamlining digital evidence collection, offering transparent status tracking, and eliminating technical barriers.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border-slate-200/80 shadow-subtle p-6 hover:shadow-card transition-all duration-300 rounded-2xl bg-white">
            <div className="w-12 h-12 rounded-xl bg-cyber-50 text-cyber-600 flex items-center justify-center font-bold mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Secure & Confidential</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Every citizen complaint and attached evidence file is encrypted end-to-end, safeguarding sensitive data and preserving evidentiary integrity.
            </p>
          </Card>

          <Card className="border-slate-200/80 shadow-subtle p-6 hover:shadow-card transition-all duration-300 rounded-2xl bg-white">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-4">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Transparent Tracking</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Real-time multi-stage status telemetry empowers citizens to monitor complaint verification, nodal bank freezes, and investigation progress.
            </p>
          </Card>

          <Card className="border-slate-200/80 shadow-subtle p-6 hover:shadow-card transition-all duration-300 rounded-2xl bg-white">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Enterprise Ready</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Engineered with standardized REST protocols to seamlessly interface with relational datastores and law enforcement intelligence platforms.
            </p>
          </Card>
        </div>

        {/* System Architecture Section */}
        <Card className="border-slate-200/90 shadow-card p-6 sm:p-8 space-y-6 rounded-2xl bg-white">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              System Architecture & Data Flow
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Strict isolation between Citizen Reporting Frontend and Law Enforcement Investigation Systems
            </p>
          </div>

          <div className="p-5 rounded-xl bg-navy-950 text-white font-mono text-xs sm:text-sm space-y-3 shadow-inner">
            <div className="flex items-center gap-3 text-cyber-400">
              <Server className="w-4 h-4 shrink-0" />
              <span className="font-bold">[Citizen Portal (Pravah Setu)]</span>
            </div>
            <div className="text-slate-400 pl-7 text-xs">↓ Secure REST API (256-bit Encrypted HTTPS)</div>
            <div className="flex items-center gap-3 text-emerald-400">
              <Database className="w-4 h-4 shrink-0" />
              <span className="font-bold">[Central Ingestion Engine & Audit Datastore]</span>
            </div>
            <div className="text-slate-400 pl-7 text-xs">↓ Role-Based Access Control (RBAC) & LEA Auth</div>
            <div className="flex items-center gap-3 text-purple-400">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="font-bold">[Law Enforcement Predictive Analytics & Investigation Portal]</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Pravah Setu is dedicated exclusively to citizen-facing intake, evidence uploading, and incident tracking. Internal law enforcement telemetry, suspect analysis, and predictive models operate independently behind strict security boundaries.
          </p>
        </Card>

        {/* Call to Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-navy-900 to-navy-950 text-white shadow-card">
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white tracking-tight">Have you experienced a cyber incident?</h4>
            <p className="text-xs sm:text-sm text-slate-400">Report fraudulent transactions immediately to initiate the recovery workflow.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link to="/report">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                File Complaint
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
