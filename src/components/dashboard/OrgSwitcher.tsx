import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useOrganization } from '../../lib/orgContext';
import { useToast } from '../../lib/toast';
import { cn } from '../../lib/utils';

/**
 * Organization switcher. Renders the currently active org as a compact button;
 * clicking opens a dropdown of every org the user belongs to (from the
 * memberships mirror). Selecting an entry calls `switchOrganization` and
 * closes the dropdown on success.
 */
export function OrgSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { currentOrganization, memberships, switchOrganization, loading } = useOrganization();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!currentOrganization) return null;
  const showList = memberships.length > 1;

  const initials = (currentOrganization.name ?? '?').trim().charAt(0).toUpperCase() || '?';

  const onSelect = async (orgId: string) => {
    if (orgId === currentOrganization.id) { setOpen(false); return; }
    setBusyId(orgId);
    try {
      await switchOrganization(orgId);
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: 'Could not switch', description: (e as { message?: string } | null)?.message ?? 'Try again.', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => showList && setOpen((v) => !v)}
        disabled={!showList || loading}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition',
          'bg-white/[0.04] border border-white/[0.05]',
          showList ? 'hover:bg-white/[0.06]' : 'cursor-default',
          collapsed && 'justify-center px-2',
        )}
      >
        {currentOrganization.logo?.url ? (
          <img src={currentOrganization.logo.url} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
        ) : (
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-400 to-accent-500 grid place-items-center text-[10px] font-semibold text-[#04211f] flex-shrink-0">
            {initials}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-sm font-medium text-white truncate">{currentOrganization.name}</span>
            {showList && <ChevronDown size={14} className={cn('text-ink-3 transition', open && 'rotate-180')} />}
          </>
        )}
      </button>

      <AnimatePresence>
        {open && showList && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 left-0 right-0 rounded-xl bg-bg/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-3/70">Switch organization</div>
            <div className="max-h-64 overflow-y-auto py-1">
              {memberships.map((m) => {
                const active = m.organizationId === currentOrganization.id;
                const busy = busyId === m.organizationId;
                return (
                  <button
                    key={m.organizationId}
                    onClick={() => onSelect(m.organizationId)}
                    disabled={busy}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition',
                      active ? 'bg-white/[0.06] text-white' : 'text-ink-2 hover:bg-white/[0.04] hover:text-white',
                    )}
                  >
                    <Building2 size={14} className="text-ink-3 flex-shrink-0" />
                    <span className="flex-1 truncate">{m.organizationName || m.organizationId}</span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-3">{m.role}</span>
                    {active && <Check size={14} className="text-brand-300" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
