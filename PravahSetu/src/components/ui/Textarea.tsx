import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  requiredIndicator?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      requiredIndicator,
      maxLength,
      value,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const textareaId = id || props.name || undefined;
    const errorId = textareaId ? `${textareaId}-error` : undefined;
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full text-left">
        {label && (
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={textareaId} className="block text-sm font-semibold text-slate-700">
              {label}
              {requiredIndicator && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
            </label>
            {maxLength && (
              <span className="text-xs text-slate-400">
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-xl border bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-cyber-500 focus:border-transparent min-h-[120px] resize-y',
            error
              ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20 text-rose-900'
              : 'border-slate-200 hover:border-slate-300',
            disabled && 'bg-slate-100 text-slate-400 cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error ? (
          <div id={errorId} className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-600 font-medium" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
