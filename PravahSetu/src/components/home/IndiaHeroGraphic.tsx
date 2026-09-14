import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock } from 'lucide-react';

export const IndiaHeroGraphic: React.FC = () => {
  return (
    <div className="relative w-full h-[480px] lg:h-[520px] flex items-center justify-center select-none overflow-visible">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Safe India text on left of shield */}
      <div className="absolute left-2 sm:left-4 top-1/3 z-20 text-left font-mono tracking-wider pointer-events-none">
        <p className="text-[11px] font-bold text-sky-400 uppercase leading-snug">CYBER SAFE</p>
        <p className="text-[11px] font-bold text-white uppercase leading-snug">INDIA</p>
        <p className="text-[11px] font-bold text-sky-400 uppercase leading-snug">STRONGER INDIA</p>
      </div>

      {/* Right side vertical text strip */}
      <div className="absolute right-4 sm:right-8 top-16 z-20 text-right font-mono tracking-widest pointer-events-none border-r-2 border-sky-400/80 pr-2.5 space-y-1">
        <p className="text-[10px] font-bold text-slate-300 uppercase">PEOPLE</p>
        <p className="text-[10px] font-bold text-slate-300 uppercase">AWARENESS</p>
        <p className="text-[10px] font-bold text-sky-300 uppercase">TECHNOLOGY</p>
        <p className="text-[10px] font-bold text-sky-400 uppercase">SAFER TOMORROW</p>
      </div>

      {/* Dotted Map Pattern of India behind Shield */}
      <svg
        className="absolute inset-0 w-full h-full text-sky-400/30 pointer-events-none"
        viewBox="0 0 600 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stylized Dotted Grid for India Geographic Shape */}
        <g fill="currentColor" opacity="0.65">
          {/* North */}
          <circle cx="300" cy="80" r="2.5" />
          <circle cx="310" cy="75" r="2.5" />
          <circle cx="320" cy="90" r="2.5" />
          <circle cx="300" cy="100" r="2" />
          <circle cx="285" cy="110" r="2.5" />
          <circle cx="315" cy="115" r="2" />
          <circle cx="330" cy="110" r="2.5" />

          {/* West & Central */}
          <circle cx="240" cy="180" r="2.5" />
          <circle cx="255" cy="170" r="2" />
          <circle cx="270" cy="185" r="2" />
          <circle cx="225" cy="210" r="2.5" />
          <circle cx="245" cy="225" r="2" />
          <circle cx="260" cy="210" r="2" />
          <circle cx="280" cy="200" r="2.5" />
          <circle cx="300" cy="180" r="2" />
          <circle cx="320" cy="195" r="2" />
          <circle cx="340" cy="185" r="2.5" />
          <circle cx="360" cy="175" r="2" />

          {/* East */}
          <circle cx="380" cy="190" r="2" />
          <circle cx="400" cy="180" r="2.5" />
          <circle cx="420" cy="170" r="2" />
          <circle cx="440" cy="165" r="2.5" />
          <circle cx="460" cy="180" r="2" />
          <circle cx="480" cy="175" r="2.5" />
          <circle cx="470" cy="200" r="2" />
          <circle cx="450" cy="210" r="2" />
          <circle cx="410" cy="220" r="2.5" />

          {/* South */}
          <circle cx="260" cy="260" r="2" />
          <circle cx="280" cy="275" r="2.5" />
          <circle cx="300" cy="290" r="2" />
          <circle cx="320" cy="280" r="2" />
          <circle cx="340" cy="270" r="2.5" />
          <circle cx="275" cy="320" r="2" />
          <circle cx="295" cy="335" r="2.5" />
          <circle cx="315" cy="330" r="2" />
          <circle cx="285" cy="370" r="2" />
          <circle cx="305" cy="385" r="2.5" />
          <circle cx="295" cy="420" r="2" />
        </g>
      </svg>

      {/* Central Glowing Shield with Padlock */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 flex flex-col items-center justify-center"
      >
        {/* Exterior Neon Cyan Glow Ring */}
        <div className="relative w-44 h-52 sm:w-52 sm:h-60 flex items-center justify-center">
          {/* Cyber Shield Outer Contour with Glow */}
          <svg
            className="absolute inset-0 w-full h-full filter drop-shadow-[0_0_25px_rgba(56,189,248,0.55)]"
            viewBox="0 0 200 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Cyan Border */}
            <path
              d="M100 12L176 44V124C176 174 138 214 100 230C62 214 24 174 24 124V44L100 12Z"
              fill="url(#shield-grad)"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Inner Light Bevel */}
            <path
              d="M100 26L164 54V124C164 165 132 199 100 214C68 199 36 165 36 124V54L100 26Z"
              fill="url(#inner-grad)"
              stroke="#0284c7"
              strokeWidth="2"
              strokeOpacity="0.8"
            />
            <defs>
              <linearGradient id="shield-grad" x1="100" y1="12" x2="100" y2="230" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0284c7" stopOpacity="0.85" />
                <stop offset="0.5" stopColor="#0369a1" stopOpacity="0.9" />
                <stop offset="1" stopColor="#0c4a6e" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="inner-grad" x1="100" y1="26" x2="100" y2="214" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" stopOpacity="0.3" />
                <stop offset="1" stopColor="#082f49" stopOpacity="0.7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Central Bright Padlock */}
          <div className="relative z-20 flex items-center justify-center">
            <svg
              className="w-20 h-20 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3V12.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm-3.25 5.25a3.25 3.25 0 016.5 0v3h-6.5v-3zm3.25 8.25a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Flowing Indian Tricolor Ribbon across right bottom */}
      <svg
        className="absolute right-0 bottom-6 w-72 sm:w-96 h-28 pointer-events-none z-10"
        viewBox="0 0 350 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 60C80 20 180 90 350 10"
          stroke="#FF7722"
          strokeWidth="8"
          strokeLinecap="round"
          strokeOpacity="0.95"
        />
        <path
          d="M0 68C80 28 180 98 350 18"
          stroke="#FFFFFF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />
        <path
          d="M0 76C80 36 180 106 350 26"
          stroke="#128807"
          strokeWidth="8"
          strokeLinecap="round"
          strokeOpacity="0.95"
        />
      </svg>

      {/* Bottom Indian Landmarks Silhouette (India Gate, Red Fort, Rashtrapati Bhavan) */}
      <div className="absolute bottom-0 left-0 right-0 h-20 z-10 pointer-events-none overflow-hidden opacity-65">
        <svg
          viewBox="0 0 1000 80"
          className="w-full h-full text-navy-950 fill-current"
          preserveAspectRatio="none"
        >
          {/* Skyline silhouette */}
          <path d="M0 80V60H80V50H95V35H110V50H125V60H220V55H240V30H260V55H310V45H325V25H345V45H360V60H520V50H535V30H555V20H575V30H595V50H610V60H740V50H755V35H775V22H795V35H815V50H830V60H920V52H940V38H960V52H1000V80H0Z" />
          {/* India Gate archway silhouette in center */}
          <path d="M680 80V40H740V80H725V55C725 50 695 50 695 55V80H680Z" fill="#040b17" />
        </svg>
      </div>

      {/* Script Text: Digital India / Secure India at bottom right */}
      <div className="absolute right-6 bottom-2 z-20 text-right pointer-events-none font-serif italic text-slate-300/80 text-xs sm:text-sm tracking-wide">
        Digital India <br />
        <span className="text-white font-sans font-bold not-italic text-xs tracking-wider">
          Secure India
        </span>
      </div>
    </div>
  );
};
