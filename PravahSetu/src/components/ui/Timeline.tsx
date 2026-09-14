import React from 'react';
import { TimelineEvent } from '../../types';
import { Check, Clock, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className }) => {
  return (
    <div className={cn('relative pl-6 sm:pl-8 space-y-6 sm:space-y-8', className)}>
      {/* Continuous vertical timeline line */}
      <div className="absolute top-3 bottom-3 left-[15px] sm:left-[19px] w-0.5 bg-slate-200" />

      {events.map((event, idx) => {
        const isCompleted = event.status === 'completed';
        const isCurrent = event.status === 'current';
        const isPending = event.status === 'pending';

        return (
          <div key={event.id || idx} className="relative group text-left">
            {/* Step Marker */}
            <div
              className={cn(
                'absolute -left-[24px] sm:-left-[28px] top-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10',
                isCompleted && 'bg-cyber-600 border-cyber-600 text-white shadow-md shadow-cyber-600/20',
                isCurrent && 'bg-white border-cyber-600 text-cyber-600 ring-4 ring-cyber-100 shadow-glow-sm',
                isPending && 'bg-slate-100 border-slate-300 text-slate-400'
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : isCurrent ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyber-600" />
                </span>
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
            </div>

            {/* Event Content Card */}
            <div
              className={cn(
                'rounded-xl p-4 sm:p-5 border transition-all duration-200',
                isCurrent
                  ? 'bg-cyber-50/40 border-cyber-200 shadow-sm'
                  : isCompleted
                  ? 'bg-white border-slate-200 shadow-subtle'
                  : 'bg-slate-50/60 border-slate-200/60 opacity-75'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded',
                      isCompleted && 'bg-cyber-100 text-cyber-800',
                      isCurrent && 'bg-cyber-600 text-white',
                      isPending && 'bg-slate-200 text-slate-600'
                    )}
                  >
                    STEP {event.stage}
                  </span>
                  <h4
                    className={cn(
                      'text-sm font-bold tracking-tight',
                      isCurrent ? 'text-cyber-900' : isCompleted ? 'text-slate-900' : 'text-slate-500'
                    )}
                  >
                    {event.title}
                  </h4>
                </div>
                {event.timestamp && (
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {event.timestamp}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1">
                {event.description}
              </p>

              {/* Citizen-Safe Authority Note */}
              {event.officerNote && (
                <div className="mt-3 p-3 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-cyber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-cyber-800">
                      Official Citizen Status Note
                    </p>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                      {event.officerNote}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
