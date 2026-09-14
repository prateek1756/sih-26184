import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  BookOpen,
  Users,
  BarChart3,
  CreditCard,
  Mail,
  TrendingDown,
  PhoneCall,
  User,
  Building,
  Key,
  Globe,
  Share2,
  Flag,
  Quote,
  Laptop,
} from 'lucide-react';
import { IndiaHeroGraphic } from '../components/home/IndiaHeroGraphic';
import { Modal } from '../components/ui/Modal';
import { AWARENESS_ARTICLES } from '../data/mockAwareness';
import { AwarenessArticle } from '../types';

export const Home: React.FC = () => {
  const [selectedArticle, setSelectedArticle] = useState<AwarenessArticle | null>(null);

  const fraudList = [
    {
      id: 'upi-payment-fraud',
      title: 'UPI & Payment Fraud',
      desc: 'Fake payment links, UPI collect requests',
      icon: CreditCard,
      iconBg: 'bg-amber-100 text-amber-600',
      arrowColor: 'text-amber-600',
    },
    {
      id: 'phishing-fake-sms',
      title: 'Phishing',
      desc: 'Fake emails and websites to steal information',
      icon: Mail,
      iconBg: 'bg-blue-100 text-blue-600',
      arrowColor: 'text-blue-600',
    },
    {
      id: 'investment-trading-scams',
      title: 'Investment Scams',
      desc: 'Fraudulent investment schemes and apps',
      icon: TrendingDown,
      iconBg: 'bg-pink-100 text-pink-600',
      arrowColor: 'text-pink-600',
    },
    {
      id: 'fake-customer-care',
      title: 'Fake Customer Care',
      desc: 'Impersonation of bank or service providers',
      icon: PhoneCall,
      iconBg: 'bg-rose-100 text-rose-600',
      arrowColor: 'text-rose-600',
    },
    {
      id: 'social-media-impersonation',
      title: 'Social Media Fraud',
      desc: 'Fake profiles, blackmail, impersonation',
      icon: User,
      iconBg: 'bg-purple-100 text-purple-600',
      arrowColor: 'text-purple-600',
    },
    {
      id: 'identity-theft-aadhaar',
      title: 'Identity Theft',
      desc: 'Misuse of personal documents and data',
      icon: Building,
      iconBg: 'bg-sky-100 text-sky-600',
      arrowColor: 'text-sky-600',
    },
  ];

  const handleOpenArticle = (id: string) => {
    const article = AWARENESS_ARTICLES.find((a) => a.id === id);
    if (article) setSelectedArticle(article);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-white">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#06142e] via-[#091e3d] to-[#040f24] text-white pt-12 pb-16 lg:pt-16 lg:pb-24">
        {/* Background Network Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-25 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 items-center">
            {/* Left Content Area */}
            <div className="lg:col-span-7 text-left space-y-6">
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/60 border border-sky-400/40 text-[11px] font-bold tracking-widest text-sky-300 uppercase shadow-inner">
                <span>A SAFER INDIA IN A DIGITAL WORLD</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                Report Cybercrime.{' '}
                <span className="text-[#38bdf8] block sm:inline">
                  Protect Yourself.
                </span>
              </h1>

              {/* Supporting Subtitle */}
              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed font-normal">
                A secure and easy-to-use platform to report cybercrime, track your complaint, and help build a safer digital India.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link to="/report">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-lg shadow-sky-600/30 transition-all active:scale-95 w-full sm:w-auto"
                  >
                    <Lock className="w-4 h-4 fill-current" />
                    <span>Report a Cybercrime</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>

                <Link to="/track">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-transparent hover:bg-white/10 text-white font-bold text-sm border border-slate-600 transition-all active:scale-95 w-full sm:w-auto"
                  >
                    <Search className="w-4 h-4 text-sky-400" />
                    <span>Track Complaint</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-semibold">Secure & Confidential</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-semibold">Government Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-semibold">Real-time Updates</span>
                </div>
              </div>
            </div>

            {/* Right Hero Graphic: Shield + India Map + Ribbon + Skyline */}
            <div className="lg:col-span-5 flex justify-center">
              <IndiaHeroGraphic />
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK ACTION SECTION (4 Cards matching UI reference) */}
      <section className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Report a Cybercrime (Peach / Red) */}
          <div className="bg-[#fef3f2] rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col justify-between text-left space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#fee4e2] text-rose-600 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Report a <span className="text-rose-600">Cybercrime</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                Submit your complaint with details and supporting evidence.
              </p>
            </div>
            <div>
              <Link to="/report">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#b42318] hover:bg-[#912018] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Start Reporting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Card 2: Track Your Complaint (Light Blue) */}
          <div className="bg-[#f0f9ff] rounded-2xl p-6 border border-sky-100 shadow-sm flex flex-col justify-between text-left space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#e0f2fe] text-sky-600 flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Track Your Complaint
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                Check the current status of your complaint using your Complaint ID.
              </p>
            </div>
            <div>
              <Link to="/track">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Track Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Card 3: Stay Informed (Light Mint Green) */}
          <div className="bg-[#f0fdf4] rounded-2xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between text-left space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#dcfce7] text-emerald-600 flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Stay Informed</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                Learn about common cyber threats and how to protect yourself.
              </p>
            </div>
            <div>
              <Link to="/awareness">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Explore Awareness</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Card 4: Quote Card (Soft Sky Blue) */}
          <div className="bg-[#f0f7ff] rounded-2xl p-6 border border-blue-100 shadow-sm flex flex-col justify-between text-left hover:-translate-y-1 transition-all duration-200">
            <div>
              <div className="text-sky-300 font-serif text-4xl leading-none mb-1">“</div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                A Safer Digital India is a Stronger India
              </h3>
            </div>
            <div className="pt-4 border-t border-blue-100/80">
              <p className="text-[11px] font-bold text-slate-700 leading-tight">
                — Ministry of Home Affairs
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Government of India</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STATISTICS HORIZONTAL STRIP (White Card matching UI reference) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-10">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 items-center text-left">
            {/* Metric 1 */}
            <div className="flex items-center gap-3.5 sm:px-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  2,45,678
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">Total Complaints</p>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex items-center gap-3.5 pt-4 md:pt-0 sm:px-4">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  78%
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">Resolved Cases</p>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex items-center gap-3.5 pt-4 md:pt-0 sm:px-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  24x7
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">Support Available</p>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="flex items-center gap-3.5 pt-4 md:pt-0 sm:px-4">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  1,28,340
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">Citizens Helped</p>
              </div>
            </div>

            {/* Metric 5 */}
            <div className="flex items-center gap-3.5 pt-4 md:pt-0 sm:px-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Building a</p>
                <p className="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Cyber Safe Nation
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMMON CYBER FRAUDS SECTION (6 Cards matching UI reference) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 text-left">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Common Cyber Frauds
            </h2>
            <p className="text-sm text-slate-500 mt-1">Be aware. Be safe.</p>
          </div>
          <Link
            to="/awareness"
            className="text-sm font-bold text-cyber-600 hover:text-cyber-700 flex items-center gap-1"
          >
            <span>See All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {fraudList.map((fraud) => {
            const Icon = fraud.icon;
            return (
              <div
                key={fraud.id}
                onClick={() => handleOpenArticle(fraud.id)}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${fraud.iconBg}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-cyber-600 transition-colors">
                    {fraud.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    {fraud.desc}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 group-hover:text-cyber-600 transition-colors">
                    Learn More
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 ${fraud.arrowColor} group-hover:translate-x-0.5 transition-transform`} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. "THINK BEFORE YOU CLICK" SAFETY BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between">
          {/* Visual: Realistic Laptop with Cyber Security Hologram */}
          <div className="w-full sm:w-44 md:w-48 lg:w-52 h-28 shrink-0 overflow-hidden relative bg-slate-950">
            <img
              src="/cyber-safety-banner.jpg"
              alt="Think Before You Click - Cyber Safety"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/10" />
          </div>

          {/* Headline and Supporting Text */}
          <div className="px-4 sm:px-5 py-3 flex-1 text-left min-w-[200px]">
            <h3 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
              Think Before You Click
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Small steps make a big difference in keeping you safe online.
            </p>
          </div>

          {/* 4 Feature Items in clean responsive layout (no truncation) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:flex 2xl:items-center gap-2.5 sm:gap-3 xl:gap-3.5 px-4 sm:px-5 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">
                Use strong passwords
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">
                Do not share OTP or PIN
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">
                Verify links before clicking
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Flag className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">
                Report suspicious activity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Modal for viewing clicked fraud details */}
      <Modal
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title}
        maxWidth="lg"
      >
        {selectedArticle && (
          <div className="space-y-4 text-left">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {selectedArticle.subtitle}
            </p>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">
                Red Flags To Watch Out For
              </h5>
              <ul className="space-y-1.5 text-xs text-rose-900">
                {selectedArticle.redFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span>•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                Immediate Action Steps
              </h5>
              <ul className="space-y-1.5 text-xs text-emerald-900">
                {selectedArticle.immediateActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span>✓</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Link to={`/awareness#${selectedArticle.id}`}>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Read Full Guide
                </button>
              </Link>
              <Link to="/report">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-cyber-600 text-white text-xs font-bold hover:bg-cyber-700 shadow-sm"
                >
                  Report Incident
                </button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
