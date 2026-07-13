import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

const STYLES: Record<ToastVariant, { icon: ReactNode; ring: string }> = {
  default: { icon: <Info size={16} className="text-ink-2" />, ring: 'border-white/10' },
  success: { icon: <CheckCircle size={16} className="text-success-400" />, ring: 'border-success-500/30' },
  error: { icon: <XCircle size={16} className="text-error-400" />, ring: 'border-error-500/30' },
  warning: { icon: <AlertTriangle size={16} className="text-warning-400" />, ring: 'border-warning-500/30' },
  info: { icon: <Info size={16} className="text-accent-400" />, ring: 'border-accent-500/30' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((input: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, title: input.title, description: input.description, variant: input.variant ?? 'default' };
    setToasts((t) => [...t, item]);
    setTimeout(() => remove(id), input.duration ?? 4500);
  }, [remove]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
        <AnimatePresence>
          {toasts.map((t) => {
            const s = STYLES[t.variant];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.22 }}
                className={`glass-card rounded-xl border ${s.ring} p-3.5 flex items-start gap-3 shadow-lg`}
              >
                <span className="mt-0.5 flex-shrink-0">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{t.title}</p>
                  {t.description && <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{t.description}</p>}
                </div>
                <button onClick={() => remove(t.id)} className="text-ink-3 hover:text-white transition flex-shrink-0">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
