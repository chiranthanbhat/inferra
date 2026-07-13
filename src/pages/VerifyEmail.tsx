import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { Button, Wordmark } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { resendVerification, signOut } from '../lib/firebase';
import { useStore } from '../store/useStore';

// Polling window for auto-detection of verification without a page refresh.
const POLL_MS = 30_000;
// Enforce a 60s cooldown between "Resend link" clicks.
const RESEND_COOLDOWN_MS = 60_000;

export function VerifyEmail() {
  const { firebaseUser, reloadUser } = useAuth();
  const logout = useStore((s) => s.logout);
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  // Ref to always read the freshest value inside intervals (avoids stale closures).
  const cooldownRef = useRef(0);

  // Silent poll — runs while the tab is visible; skipped when hidden to avoid
  // wasted work + hitting auth/too-many-requests. Success flips the guard
  // (App.tsx re-renders once emailVerified becomes true).
  const silentCheck = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      await reloadUser();
    } catch {
      /* transient — the next tick will retry */
    }
  }, [reloadUser]);

  // Auto-verify polling. Uses a single interval that respects visibility.
  useEffect(() => {
    let interval: number | undefined;
    const start = () => {
      if (interval !== undefined) return;
      interval = window.setInterval(silentCheck, POLL_MS);
    };
    const stop = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Re-check immediately when the user tabs back in, then resume interval.
        void silentCheck();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Kick off immediately if we're visible right now.
    if (document.visibilityState === 'visible') start();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [silentCheck]);

  // Cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      const next = Math.max(0, cooldownRef.current - 1);
      cooldownRef.current = next;
      setCooldown(next);
      if (next === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const verified = await reloadUser();
      if (!verified) {
        toast({ title: 'Not verified yet', description: 'Click the link in your email, then try again.', variant: 'warning' });
      }
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const { error } = await resendVerification();
      if (error) {
        toast({ title: 'Could not resend', description: error, variant: 'error' });
      } else {
        toast({ title: 'Verification sent', description: 'Check your inbox for the new link.', variant: 'success' });
        cooldownRef.current = Math.ceil(RESEND_COOLDOWN_MS / 1000);
        setCooldown(cooldownRef.current);
      }
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    logout();
  };

  const resendDisabled = resending || cooldown > 0;
  const resendLabel = cooldown > 0 ? `Resend link (${cooldown}s)` : 'Resend link';

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="fixed inset-0 grid-bg" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md text-center"
      >
        <div className="flex justify-center mb-8"><Wordmark size={36} /></div>
        <div className="glass-card rounded-2xl p-8">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/25 text-brand-300 mb-4">
            <MailCheck size={22} />
          </span>
          <h2 className="text-lg font-semibold text-white">Verify your email</h2>
          <p className="text-sm text-ink-3 mt-2 leading-relaxed">
            We sent a verification link to{' '}
            <span className="text-ink-2 font-medium">{firebaseUser?.email}</span>. Click it to activate your account,
            then continue. This page will detect verification automatically within 30 seconds.
          </p>

          <Button onClick={handleCheck} isLoading={checking} disabled={checking} className="w-full mt-6">
            I've verified — continue
          </Button>

          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <button
              onClick={handleResend}
              disabled={resendDisabled}
              className="inline-flex items-center gap-1.5 text-brand-300 hover:text-brand-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-live="polite"
            >
              <RefreshCw size={13} className={resending ? 'animate-spin' : ''} /> {resendLabel}
            </button>
            <span className="text-ink-3">·</span>
            <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 text-ink-3 hover:text-white transition">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
