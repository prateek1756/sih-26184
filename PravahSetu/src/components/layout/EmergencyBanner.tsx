import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const EmergencyBanner: React.FC = () => {
  return (
    <div className="bg-navy-950 text-slate-200 border-b border-navy-800 text-xs py-2 px-4 select-none relative z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-500/30">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>EMERGENCY 24×7</span>
          </span>
          <span className="text-slate-300 font-medium">
            Financial Cyber Fraud Helpline: <strong className="text-white font-bold tracking-wider">DIAL 1930</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
