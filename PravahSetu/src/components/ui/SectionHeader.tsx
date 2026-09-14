import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  action?: ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  badge,
  title,
  subtitle,
  centered = false,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'mb-8 sm:mb-12',
        centered ? 'text-center max-w-3xl mx-auto' : 'flex flex-col sm:flex-row sm:items-end justify-between gap-4',
        className
      )}
    >
      <div className={centered ? 'mx-auto' : 'text-left'}>
        {badge && (
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5',
              'bg-cyber-50 text-cyber-700 border border-cyber-200/80 shadow-2xs'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-500" />
            <span>{badge}</span>
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            {subtitle}
          </p>
        )}
      </div>

      {!centered && action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
