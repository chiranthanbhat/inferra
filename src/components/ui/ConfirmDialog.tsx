import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

/**
 * Design-system confirmation dialog — replaces the browser's native confirm()
 * so destructive actions get a premium, on-brand, keyboard-accessible prompt.
 * Controlled: render it always and flip `open`. Esc / backdrop cancel; the
 * confirm button auto-focuses and shows a loading state while `isLoading`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
      if (e.key === 'Enter' && !isLoading) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-6"
          onClick={() => { if (!isLoading) onClose(); }}
          role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card rounded-2xl p-6 w-full max-w-sm relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { if (!isLoading) onClose(); }}
              className="absolute top-4 right-4 text-ink-3 hover:text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded-lg"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <span className={`inline-grid place-items-center w-11 h-11 rounded-xl mb-4 ${
              tone === 'danger' ? 'bg-error-500/15 border border-error-500/25 text-error-400' : 'bg-brand-500/15 border border-brand-500/25 text-brand-300'
            }`}>
              <AlertTriangle size={20} />
            </span>

            <h3 id="confirm-title" className="text-base font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-ink-3 mt-1.5 leading-relaxed">{description}</p>}

            <div className="flex gap-2 mt-6">
              <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isLoading}>
                {cancelLabel}
              </Button>
              <Button
                ref={confirmRef}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                className="flex-1"
                isLoading={isLoading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
