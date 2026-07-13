import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-ink-2 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
              {icon}
            </div>
          )}
          <input
            ref={ref}
      className={cn(
        'w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-ink-3',
        'focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20',
        'transition-all duration-200',
        icon && 'pl-10',
        error && 'border-error-500/50',
        className
      )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-error-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-ink-2 mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-ink-3',
            'focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20',
            'transition-all duration-200 resize-none',
            error && 'border-error-500/50',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-error-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
