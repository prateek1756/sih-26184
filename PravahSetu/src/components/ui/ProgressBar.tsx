import React from 'react';
import { cn } from '../../utils/cn';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className,
}) => {
  return (
    <div className={cn('w-full', className)}>
      {/* Desktop & Tablet View */}
      <div className="hidden md:flex items-center justify-between relative">
        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute top-5 left-8 h-0.5 bg-cyber-600 transition-all duration-300 -z-0"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!onStepClick || step.id > currentStep}
              onClick={() => onStepClick && onStepClick(step.id)}
              className={cn(
                'flex flex-col items-center group relative z-10 focus:outline-none',
                onStepClick && step.id <= currentStep ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-200 bg-white',
                  isCompleted && 'border-cyber-600 bg-cyber-600 text-white shadow-sm',
                  isCurrent && 'border-cyber-600 text-cyber-600 ring-4 ring-cyber-100 shadow-md',
                  !isCompleted && !isCurrent && 'border-slate-300 text-slate-400 bg-white'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : step.id}
              </div>
              <span
                className={cn(
                  'mt-2.5 text-xs font-semibold tracking-tight transition-colors',
                  isCurrent ? 'text-cyber-700' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Compact View */}
      <div className="flex md:hidden flex-col gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500">
            Step {currentStep} of {steps.length}
          </span>
          <span className="font-bold text-cyber-700">
            {steps[currentStep - 1]?.label}
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-cyber-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
