import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  className 
}: BadgeProps) {
  const variants = {
    default: 'bg-white/[0.06] text-ink-2 border-white/10',
    success: 'bg-success-500/15 text-success-400 border-success-500/25',
    warning: 'bg-warning-500/15 text-warning-400 border-warning-500/25',
    danger: 'bg-error-500/15 text-error-400 border-error-500/25',
    info: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
    primary: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  };

  const sizes = {
    sm: 'text-[0.6875rem] px-2 py-0.5 tracking-wide',
    md: 'text-xs px-2.5 py-1 tracking-wide',
  };

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full border',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
}
