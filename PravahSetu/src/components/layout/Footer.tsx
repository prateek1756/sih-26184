import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { AshokaEmblem } from '../ui/AshokaEmblem';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#061427] text-slate-300 border-t border-slate-800 select-none text-left mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 pb-12 border-b border-slate-800/80">
          {/* Column 1: Brand & Ministry of Home Affairs */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <AshokaEmblem className="w-8 h-10 shrink-0" variant="light" animated={false} />
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-700">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyber-500 to-cyber-700 flex items-center justify-center text-white shadow-sm">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-black text-white tracking-tight block leading-none">
                    PRAVAH SETU
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight block mt-1">
                    A Government of India Initiative
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight block">
                    Ministry of Home Affairs
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm pt-1">
              Dedicated national citizen portal to report cybercrimes, track investigation progress, and access rapid financial fraud assistance.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="text-slate-400 hover:text-white transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/report" className="text-slate-400 hover:text-white transition">
                  Report Crime
                </Link>
              </li>
              <li>
                <Link to="/track" className="text-slate-400 hover:text-white transition">
                  Track Complaint
                </Link>
              </li>
              <li>
                <Link to="/awareness" className="text-slate-400 hover:text-white transition">
                  Awareness
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-400 hover:text-white transition">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-white transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Help & Support */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Help & Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/awareness" className="text-slate-400 hover:text-white transition">
                  FAQs
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-400 hover:text-white transition">
                  User Guide
                </Link>
              </li>
              <li>
                <span className="text-sky-400 font-semibold">
                  Cyber Helpline: 1930
                </span>
              </li>
              <li>
                <Link to="/report" className="text-slate-400 hover:text-white transition">
                  Report Financial Fraud
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-white transition">
                  Grievance Redressal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Follow Us & Together for Safer India */}
          <div className="lg:col-span-3 space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 mb-2.5">
                Follow Us
              </h4>
              <div className="flex items-center gap-2">
                {/* X */}
                <span className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white text-xs font-bold cursor-pointer transition">
                  𝕏
                </span>
                {/* Facebook */}
                <span className="w-7 h-7 rounded-lg bg-[#1877f2] flex items-center justify-center text-white text-xs font-bold cursor-pointer transition">
                  f
                </span>
                {/* Instagram */}
                <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer transition">
                  📷
                </span>
                {/* YouTube */}
                <span className="w-7 h-7 rounded-lg bg-[#ff0000] flex items-center justify-center text-white text-xs font-bold cursor-pointer transition">
                  ▶
                </span>
                {/* LinkedIn */}
                <span className="w-7 h-7 rounded-lg bg-[#0a66c2] flex items-center justify-center text-white text-xs font-bold cursor-pointer transition">
                  in
                </span>
              </div>
            </div>

            {/* Together for a Safer Digital India */}
            <div className="pt-2">
              <p className="text-xs text-slate-300">Together for a</p>
              <p className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Safer Digital India</span>
                <span className="inline-block w-8 h-2 rounded-full bg-gradient-to-r from-[#FF7722] via-white to-[#128807]" />
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Legal Links */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Pravah Setu. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/contact" className="hover:text-slate-300 transition">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link to="/contact" className="hover:text-slate-300 transition">
              Terms of Use
            </Link>
            <span>|</span>
            <Link to="/contact" className="hover:text-slate-300 transition">
              Accessibility
            </Link>
            <span>|</span>
            <Link to="/contact" className="hover:text-slate-300 transition">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
