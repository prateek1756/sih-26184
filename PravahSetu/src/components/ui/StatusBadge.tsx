import React from 'react';
import { ComplaintStatus } from '../../types';
import { STATUS_MAP } from '../../data/constants';
import { cn } from '../../utils/cn';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  className,
}) => {
  const meta = STATUS_MAP[status] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  const isLive = status === 'INVESTIGATION_IN_PROGRESS' || status === 'UNDER_REVIEW';

  const dotColors: Record<string, string> = {
    SUBMITTED: 'bg-blue-500',
    UNDER_REVIEW: 'bg-amber-500',
    ASSIGNED_FOR_INVESTIGATION: 'bg-purple-500',
    INVESTIGATION_IN_PROGRESS: 'bg-indigo-500',
    RESOLVED: 'bg-emerald-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full border',
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-1',
        meta.bg,
        meta.text,
        meta.border,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {isLive && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotColors[status] || 'bg-cyber-400'
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              dotColors[status] || 'bg-slate-400'
            )}
          />
        </span>
      )}
      <span>{meta.label}</span>
    </span>
  );
};
