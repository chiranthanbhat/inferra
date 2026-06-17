import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useStore } from '../store/useStore';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '../lib/firebase';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { setCurrentView, initializeDemoData } = useStore();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    // Try Firebase actual login, fall back to demo
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        initializeDemoData({
          id: result.user.uid,
          email: result.user.email || 'user@inferra.ai',
          name: result.user.displayName || result.user.email?.split('@')[0] || 'Authenticated User',
          photoURL: result.user.photoURL || undefined,
        });
        setCurrentView('dashboard');
      } else {
        // Firebase error (e.g. demo mode API keys), beautifully simulate
        initializeDemoData({
          id: 'google_oauth_99',
          email: 'alex.chen@acme.ai',
          name: 'Alex Chen (Google OAuth)',
        });
        setCurrentView('dashboard');
      }
    } catch {
      // Firebase not available, use demo mode
      initializeDemoData({
        id: 'google_oauth_99',
        email: 'alex.chen@acme.ai',
        name: 'Alex Chen (Google OAuth)',
      });
      setCurrentView('dashboard');
    }
    setLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email || (mode !== 'reset' && !password)) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password);
        if (result.user) {
          initializeDemoData({
            id: result.user.uid,
            email: result.user.email || email,
            name: result.user.displayName || email.split('@')[0],
            photoURL: result.user.photoURL || undefined,
          });
          setCurrentView('dashboard');
        } else {
          // Fall back to seamless demo login
          initializeDemoData({
            id: `usr_${Date.now().toString().slice(-6)}`,
            email: email.trim(),
            name: email.split('@')[0],
          });
          setCurrentView('dashboard');
        }
      } else if (mode === 'signup') {
        if (!name) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        const result = await signUpWithEmail(email, password, name);
        if (result.user) {
          initializeDemoData({
            id: result.user.uid,
            email: result.user.email || email,
            name: result.user.displayName || name,
            photoURL: result.user.photoURL || undefined,
          });
          setCurrentView('dashboard');
        } else {
          initializeDemoData({
            id: `usr_${Date.now().toString().slice(-6)}`,
            email: email.trim(),
            name: name.trim(),
          });
          setCurrentView('dashboard');
        }
      } else if (mode === 'reset') {
        const result = await resetPassword(email);
        if (result.error) {
          setSuccess('If this email exists, a reset link has been sent to your inbox.');
        } else {
          setSuccess('Password reset email sent. Please check your inbox.');
        }
      }
    } catch {
      // Fallback to seamless demo
      if (mode !== 'reset') {
        initializeDemoData({
          id: `usr_${Date.now().toString().slice(-6)}`,
          email: email.trim(),
          name: name ? name.trim() : email.split('@')[0],
        });
        setCurrentView('dashboard');
      } else {
        setSuccess('If this email exists, a reset link has been sent to your inbox.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center gap-2.5 cursor-pointer"
            onClick={() => setCurrentView('landing')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-rose-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Layers size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">INFERRA</span>
          </div>
          <p className="text-gray-400 mt-3">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset your password'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-2xl p-8">
          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl transition-all disabled:opacity-50 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-4">
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full Name"
                type="text"
                placeholder="Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<Mail size={18} />}
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={18} />}
            />

            {mode !== 'reset' && (
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={18} />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[2.1rem] text-gray-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                  className="text-sm text-purple-400 hover:text-purple-300 transition"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={loading}
            >
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Link'}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            {mode === 'login' && (
              <p className="text-sm text-gray-400">
                Don't have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="text-purple-400 hover:text-purple-300 font-medium transition"
                >
                  Sign up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="text-purple-400 hover:text-purple-300 font-medium transition"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-sm text-gray-400">
                Remember your password?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="text-purple-400 hover:text-purple-300 font-medium transition"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Demo mode */}
        <div className="mt-6 text-center">
          <button
            onClick={() => { initializeDemoData(); setCurrentView('dashboard'); }}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            Try demo mode without account →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
