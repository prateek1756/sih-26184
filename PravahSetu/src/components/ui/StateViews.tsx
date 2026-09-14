import React, { ReactNode } from 'react';
import { Button } from './Button';
import { AlertCircle, FileSearch, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 sm:p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-subtle flex flex-col items-center justify-center',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
        {icon || <FileSearch className="w-7 h-7" />}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className,
}) => {
  return (
    <div
      className={cn(
        'p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-subtle flex flex-col items-center justify-center min-h-[220px]',
        className
      )}
    >
      <div className="relative flex items-center justify-center mb-3">
        <div className="w-10 h-10 border-3 border-cyber-200 border-t-cyber-600 rounded-full animate-spin" />
      </div>
      <p className="text-sm font-semibold text-slate-700 tracking-tight">{message}</p>
      <p className="text-xs text-slate-400 mt-1">Connecting to Pravah Setu network...</p>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while retrieving the data. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 sm:p-12 text-center rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col items-center justify-center',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-rose-900 tracking-tight">{title}</h3>
      <p className="text-xs sm:text-sm text-rose-700 max-w-md mt-1.5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};
