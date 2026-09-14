import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[] | string[];
  error?: string;
  helperText?: string;
  placeholder?: string;
  requiredIndicator?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      options,
      error,
      helperText,
      placeholder = 'Select an option',
      requiredIndicator,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || props.name || undefined;
    const errorId = selectId ? `${selectId}-error` : undefined;

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-slate-700 mb-1.5">
            {label}
            {requiredIndicator && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative rounded-xl">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            className={cn(
              'w-full appearance-none rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-cyber-500 focus:border-transparent cursor-pointer',
              error
                ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
                : 'border-slate-200 hover:border-slate-300',
              disabled && 'bg-slate-100 text-slate-400 cursor-not-allowed',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => {
              if (typeof opt === 'string') {
                return (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                );
              }
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            })}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
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

Select.displayName = 'Select';
