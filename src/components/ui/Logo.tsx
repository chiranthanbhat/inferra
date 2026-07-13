import { cn } from '../../lib/utils';

/**
 * Inferra mark — an abstract routing glyph: one input node
 * fanning out to the optimal path. Cyan → ice, hairline construction.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-[11px] flex-shrink-0',
        'bg-gradient-to-br from-brand-400/95 to-accent-500/95',
        'shadow-[0_6px_20px_-8px_rgba(77,238,234,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12h5"
          stroke="white" strokeWidth="2" strokeLinecap="round"
        />
        <path
          d="M9 12c3 0 3.5-5.5 7-5.5M9 12c3 0 3.5 5.5 7 5.5"
          stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round"
        />
        <path d="M9 12h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18.5" cy="12" r="2" fill="white" />
        <circle cx="17.5" cy="6.5" r="1.4" fill="white" fillOpacity="0.55" />
        <circle cx="17.5" cy="17.5" r="1.4" fill="white" fillOpacity="0.55" />
      </svg>
    </span>
  );
}

export function Wordmark({
  size = 36,
  showSub = false,
  sub = 'Infrastructure',
  className,
}: {
  size?: number;
  showSub?: boolean;
  sub?: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[1.05rem] font-semibold tracking-tight text-white font-display">
          Inferra
        </span>
        {showSub && (
          <span className="text-[9px] uppercase tracking-[0.2em] text-ink-3 mt-1">{sub}</span>
        )}
      </span>
    </span>
  );
}
