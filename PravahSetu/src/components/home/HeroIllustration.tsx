import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, CheckCircle2, ShieldCheck, Key, Database, Zap } from 'lucide-react';

export const HeroIllustration: React.FC = () => {
  return (
    <div className="relative w-full max-w-lg mx-auto aspect-square flex items-center justify-center select-none">
      {/* Ambient background glow with subtle tricolor undertones */}
      <div className="absolute inset-0 bg-radial-gradient opacity-80 pointer-events-none" />
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute inset-8 bg-cyber-500/10 rounded-full blur-2xl animate-pulse-slow" />

      {/* Outer Rotating Cyber Grid Ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-4 border border-dashed border-cyber-400/20 rounded-full pointer-events-none"
      />

      {/* Middle Orbit with Digital Security Nodes */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-12 border border-cyber-500/30 rounded-full pointer-events-none"
      >
        {/* Node 1 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyber-400 shadow-glow" />
        {/* Node 2 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-glow" />
      </motion.div>

      {/* Connected Network Polygon (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full text-cyber-500/30"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="200" y1="60" x2="200" y2="340" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
        <line x1="60" y1="200" x2="340" y2="200" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
        <polygon points="200,80 310,140 310,260 200,320 90,260 90,140" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      </svg>

      {/* Central Interactive Cyber Core Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-56 h-64 sm:w-64 sm:h-72 rounded-3xl bg-gradient-to-b from-navy-900/90 via-navy-950/95 to-slate-950 p-6 border border-cyber-500/40 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-between text-center"
      >
        {/* Subtle Tricolor Accent at Top of Shield */}
        <div className="w-16 h-1 rounded-full bg-gradient-to-r from-[#FF7722] via-white to-[#128807] mb-2" />

        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyber-500 to-cyber-700 flex items-center justify-center text-white shadow-glow">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white p-1 rounded-full ring-4 ring-navy-950">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          </div>
        </div>

        <div>
          <h4 className="text-white font-black tracking-tight text-base sm:text-lg">
            Pravah Setu
          </h4>
          <p className="text-[11px] font-medium text-cyber-300 tracking-wide mt-0.5">
            256-BIT ENCRYPTED PORTAL
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="w-full py-1.5 px-3 rounded-xl bg-navy-900 border border-cyber-500/30 flex items-center justify-center gap-2 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-emerald-300 text-[11px]">System Active • 24×7</span>
        </div>
      </motion.div>

      {/* Floating Badge 1: Instant FIR & Nodal Notice */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-2 right-4 sm:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200 flex items-center gap-2.5"
      >
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-left pr-1">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">Fast Resolution</p>
          <p className="text-[10px] text-slate-500 font-medium">Bank Nodal Notification</p>
        </div>
      </motion.div>

      {/* Floating Badge 2: Citizen Privacy Assured */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -bottom-3 left-2 sm:-left-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200 flex items-center gap-2.5"
      >
        <div className="w-8 h-8 rounded-xl bg-cyber-100 text-cyber-700 flex items-center justify-center font-bold">
          <Lock className="w-4 h-4" />
        </div>
        <div className="text-left pr-1">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">100% Confidential</p>
          <p className="text-[10px] text-slate-500 font-medium">Data Privacy Guaranteed</p>
        </div>
      </motion.div>
    </div>
  );
};
