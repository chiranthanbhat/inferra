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
    default: 'bg-white/10 text-gray-300',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    primary: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
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
