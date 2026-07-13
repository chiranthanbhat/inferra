import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 ease-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] select-none';

    const variants = {
      primary: 'text-[#04211f] bg-gradient-to-br from-brand-400 to-accent-500 hover:from-brand-300 hover:to-accent-400 shadow-[0_8px_24px_-10px_rgba(77,238,234,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_14px_34px_-10px_rgba(77,238,234,0.7),inset_0_1px_0_rgba(255,255,255,0.5)]',
      secondary: 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 hover:border-white/20 backdrop-blur-sm',
      ghost: 'bg-transparent hover:bg-white/[0.06] text-ink-2 hover:text-white',
      danger: 'bg-error-500 hover:brightness-110 text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,0.55)]',
      outline: 'bg-transparent border border-brand-500/40 text-brand-300 hover:bg-brand-500/10 hover:border-brand-400/70',
    };

    const sizes = {
      sm: 'text-xs px-3.5 py-2 gap-1.5',
      md: 'text-sm px-5 py-2.5 gap-2',
      lg: 'text-[0.95rem] px-7 py-3.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
