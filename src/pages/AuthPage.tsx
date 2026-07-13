import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, FlaskConical, Zap, UserPlus } from 'lucide-react';
import { Button, Input, Wordmark } from '../components/ui';
import { useStore } from '../store/useStore';
import { useAuth } from '../lib/auth';
import { DEV_EMAIL, DEV_PASSWORD } from '../lib/devAuth';
import { previewInvitationServer } from '../lib/functions';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, firebaseConfigured, MIN_PASSWORD_LENGTH } from '../lib/firebase';
import type { InvitationPreview } from '../types';

// Neutral copy used for BOTH success and failure paths of the reset flow so the
// UI never leaks whether an account exists (user-enumeration hardening).
const RESET_NEUTRAL_MESSAGE = 'If an account exists for that email, a reset link is on its way.';

// Very lightweight, RFC-5322-lite check — full validation belongs on the server.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage() {
  const { devMode, signInDev, signInDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState(devMode ? DEV_EMAIL : '');
  const [password, setPassword] = useState(devMode ? DEV_PASSWORD : '');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const setCurrentView = useStore((s) => s.setCurrentView);
  const pendingInvite = useStore((s) => s.pendingInvite);
  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(null);

  // Invitation deep link: load the token-gated preview, pre-fill + LOCK the
  // email, and default to Sign Up. Existing users switch to Sign In — the
  // email stays locked either way, guaranteeing the invited address is used.
  const emailLocked = !!pendingInvite && invitePreview?.status === 'pending';
  useEffect(() => {
    if (!pendingInvite || devMode) return;
    let cancelled = false;
    previewInvitationServer(pendingInvite.invitationId, pendingInvite.token)
      .then((p) => {
        if (cancelled) return;
        setInvitePreview(p);
        if (p.status === 'pending') {
          setEmail(p.email);
          setMode('signup');
        }
      })
      .catch(() => { if (!cancelled) setInvitePreview(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite?.invitationId, devMode]);

  const passwordTooShort = useMemo(
    () => mode === 'signup' && password.length > 0 && password.length < MIN_PASSWORD_LENGTH,
    [mode, password],
  );

  const clearFeedback = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (next: 'login' | 'signup' | 'reset') => {
    setMode(next);
    clearFeedback();
  };

  // ---- Development auth mode (VITE_DEV_AUTH=true) ----
  const handleDevContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // debounce re-submits
    clearFeedback();
    setLoading(true);
    try {
      const { error: err } = await signInDev(email, password);
      if (err) setError(err);
    } finally {
      setLoading(false);
    }
    // On success the store user is set → App routes straight to the dashboard.
  };

  const handleDemo = async () => {
    if (demoLoading || loading) return;
    clearFeedback();
    setDemoLoading(true);
    try {
      await signInDemo();
    } finally {
      setDemoLoading(false);
    }
  };

  if (devMode) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="fixed inset-0 grid-bg" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full max-w-md"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="cursor-pointer" onClick={() => setCurrentView('landing')}>
              <Wordmark size={40} />
            </div>
            <p className="text-ink-3 mt-4 text-sm">Sign in to your workspace</p>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-start gap-2 p-3 bg-warning-500/10 border border-warning-500/20 rounded-xl mb-6">
              <FlaskConical size={16} className="text-warning-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning-200 leading-relaxed">
                Development auth mode is on. OAuth is skipped — use <span className="font-mono">{DEV_EMAIL}</span> /{' '}
                <span className="font-mono">{DEV_PASSWORD}</span>, or continue as demo. Set{' '}
                <span className="font-mono">VITE_DEV_AUTH=false</span> to restore production sign-in.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-error-500/10 border border-error-500/20 rounded-xl mb-4">
                <AlertCircle size={16} className="text-error-400 flex-shrink-0" />
                <p className="text-sm text-error-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleDevContinue} className="space-y-4">
              <Input label="Email" type="email" placeholder={DEV_EMAIL} value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} />} autoComplete="email" />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={18} />}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[2.1rem] text-ink-3 hover:text-white transition" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Button type="submit" className="w-full" size="lg" isLoading={loading} disabled={loading || demoLoading}>
                Continue {!loading && <ArrowRight size={18} />}
              </Button>
            </form>

            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-ink-3 uppercase">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <Button variant="outline" className="w-full" size="lg" onClick={handleDemo} isLoading={demoLoading} disabled={loading || demoLoading}>
              <Zap size={16} /> Continue as Demo
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // On success, the AuthProvider's onAuthStateChanged listener loads the profile
  // and App re-routes to verification / plan selection / dashboard automatically.

  const handleGoogleLogin = async () => {
    if (loading) return;
    clearFeedback();
    setLoading(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // debounce
    clearFeedback();

    const emailTrim = email.trim();

    if (!emailTrim) return setError('Please enter your email.');
    if (!EMAIL_RE.test(emailTrim)) return setError('That email address is not valid.');
    if (mode !== 'reset' && !password) return setError('Please enter your password.');
    if (mode === 'signup') {
      if (!name.trim()) return setError('Please enter your name.');
      if (password.length < MIN_PASSWORD_LENGTH) {
        return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await signInWithEmail(emailTrim, password);
        if (err) setError(err);
      } else if (mode === 'signup') {
        const { error: err, verificationSendFailed } = await signUpWithEmail(emailTrim, password, name.trim());
        if (err) {
          setError(err);
        } else if (verificationSendFailed) {
          // Account created but the verification email couldn't be dispatched.
          // The verify-email page has a Resend button — nudge the user there.
          setSuccess("Account created, but we couldn't send the verification email. Use \"Resend link\" on the next screen.");
        }
      } else {
        const { error: err } = await resetPassword(emailTrim);
        // NEUTRAL response for BOTH success and account-not-found. Only surface
        // errors that don't leak account existence (e.g. quota, network).
        const code = (err ?? '').toLowerCase();
        const leaksExistence = code.includes('no account') || code.includes('user');
        if (err && !leaksExistence) setError(err);
        else setSuccess(RESET_NEUTRAL_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="fixed inset-0 grid-bg" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="cursor-pointer" onClick={() => setCurrentView('landing')}>
            <Wordmark size={40} />
          </div>
          <p className="text-ink-3 mt-4 text-sm">
            {mode === 'login' && 'Sign in to your workspace'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset your password'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {!firebaseConfigured && (
            <div className="flex items-start gap-2 p-3 bg-warning-500/10 border border-warning-500/20 rounded-xl mb-5">
              <AlertCircle size={16} className="text-warning-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning-200 leading-relaxed">
                Firebase isn't configured in this environment. Add your <span className="font-mono">VITE_FIREBASE_*</span> env vars
                (see <span className="font-mono">.env.example</span>) to enable sign-in.
              </p>
            </div>
          )}

          {/* Invitation context (deep link) */}
          {invitePreview && invitePreview.status === 'pending' && (
            <div className="flex items-start gap-2.5 p-3.5 bg-brand-500/10 border border-brand-500/25 rounded-xl mb-5">
              <UserPlus size={16} className="text-brand-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-ink-2 leading-relaxed">
                <span className="text-white font-medium">{invitePreview.invitedByName || 'A teammate'}</span> invited you to join{' '}
                <span className="text-white font-medium">{invitePreview.organizationName}</span> as{' '}
                <span className="text-brand-300">{invitePreview.role}</span>
                {invitePreview.teamName ? <> on the <span className="text-white font-medium">{invitePreview.teamName}</span> team</> : null}.
                {' '}Use <span className="font-mono text-brand-200">{invitePreview.email}</span> — the invitation is locked to it.
              </p>
            </div>
          )}
          {invitePreview && invitePreview.status !== 'pending' && (
            <div className="flex items-start gap-2.5 p-3.5 bg-warning-500/10 border border-warning-500/25 rounded-xl mb-5">
              <AlertCircle size={16} className="text-warning-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning-200 leading-relaxed">
                This invitation is {invitePreview.status}. Ask {invitePreview.invitedByName || 'the sender'} for a new one — you can still sign in normally below.
              </p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading || !firebaseConfigured}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl transition-all disabled:opacity-50 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? 'Please wait…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-ink-3 uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-500/10 border border-error-500/20 rounded-xl mb-4" role="alert">
              <AlertCircle size={16} className="text-error-400 flex-shrink-0" />
              <p className="text-sm text-error-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl mb-4" role="status">
              <p className="text-sm text-success-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input label="Full Name" type="text" placeholder="Alex Chen" value={name} onChange={(e) => setName(e.target.value)} icon={<Mail size={18} />} autoComplete="name" />
            )}

            <Input label="Email" type="email" placeholder="you@company.com" value={email}
              onChange={(e) => { if (!emailLocked) setEmail(e.target.value); }}
              disabled={emailLocked}
              icon={<Mail size={18} />} autoComplete="email" />

            {mode !== 'reset' && (
              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock size={18} />}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[2.1rem] text-ink-3 hover:text-white transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className={`text-xs mt-1.5 ${passwordTooShort ? 'text-warning-300' : 'text-ink-3'}`}>
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )}
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => switchMode('reset')} className="text-sm text-brand-300 hover:text-brand-200 transition">
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={loading} disabled={loading || !firebaseConfigured}>
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Link'}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {mode === 'login' && (
              <p className="text-sm text-ink-3">
                Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-brand-300 hover:text-brand-200 font-medium transition">Sign up</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-ink-3">
                Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="text-brand-300 hover:text-brand-200 font-medium transition">Sign in</button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-sm text-ink-3">
                Remember your password?{' '}
                <button onClick={() => switchMode('login')} className="text-brand-300 hover:text-brand-200 font-medium transition">Sign in</button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
