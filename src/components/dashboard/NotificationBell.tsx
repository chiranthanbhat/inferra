// ============================================
// IN-APP NOTIFICATION BELL
// Polls the user's notifications on mount + every 60s, renders an unread badge
// and a dropdown with mark-read / mark-all-read. Server writes the docs; the
// client may only flip the read flag (enforced by firestore.rules).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, Mail, Users, Zap, CreditCard, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DEV_AUTH } from '../../lib/devAuth';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/db';
import type { AppNotification, NotificationType } from '../../types';

const ICON: Partial<Record<NotificationType, React.ReactNode>> = {
  'invitation.received': <Mail size={14} className="text-brand-300" />,
  'member.joined': <Users size={14} className="text-success-400" />,
  'member.left': <Users size={14} className="text-ink-3" />,
  'member.removed': <Users size={14} className="text-error-400" />,
  'member.roleChanged': <Users size={14} className="text-accent-400" />,
  'usage.warning': <Zap size={14} className="text-warning-400" />,
  'usage.quotaReached': <AlertTriangle size={14} className="text-error-400" />,
  'subscription.activated': <CreditCard size={14} className="text-success-400" />,
  'subscription.paymentFailed': <CreditCard size={14} className="text-error-400" />,
  'subscription.cancelled': <CreditCard size={14} className="text-warning-400" />,
  'subscription.expiring': <CreditCard size={14} className="text-warning-400" />,
};

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export function NotificationBell() {
  const user = useStore((s) => s.user);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user || DEV_AUTH) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const list = await listNotifications(user.id);
        if (!cancelled) setItems(list);
      } catch { /* offline / unconfigured — bell stays empty */ }
    };
    void pull();
    const t = setInterval(pull, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const readOne = async (n: AppNotification) => {
    if (n.read) return;
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await markNotificationRead(n.id).catch(() => {});
  };

  const readAll = async () => {
    const prev = items;
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await markAllNotificationsRead(prev).catch(() => {});
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen((o) => !o)}
        className="relative grid place-items-center w-9 h-9 rounded-lg glass text-ink-3 hover:text-white transition"
        aria-label="Notifications">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-brand-400 to-accent-500 text-[#04211f] text-[0.6rem] font-bold grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,360px)] glass-card rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {unread > 0 && (
                <button onClick={readAll} className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200 transition">
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-3">You're all caught up.</p>
              ) : items.map((n) => (
                <button key={n.id} onClick={() => readOne(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-white/[0.04] transition hover:bg-white/[0.03] ${n.read ? 'opacity-60' : ''}`}>
                  <span className="mt-0.5 flex-shrink-0">{ICON[n.type] ?? <Bell size={14} className="text-ink-3" />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-white">{n.title}</span>
                    <span className="block text-xs text-ink-3 mt-0.5 leading-relaxed">{n.body}</span>
                    <span className="block text-[0.62rem] text-ink-3 mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="ml-auto mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
