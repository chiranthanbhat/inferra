import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button, Wordmark } from '../ui';
import { useStore } from '../../store/useStore';

const navLinks = [
  { label: 'Product', href: '#how-it-works' },
  { label: 'Routing', href: '#routing' },
  { label: 'Governance', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setCurrentView, isAuthenticated, user } = useStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auth-aware CTAs: an existing session goes straight to the dashboard —
  // never back through the login screen.
  const handleLogin = () => {
    setCurrentView(isAuthenticated ? 'dashboard' : 'auth');
  };

  const handleDemo = () => {
    setCurrentView(isAuthenticated ? 'dashboard' : 'auth');
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-white/[0.07]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="group">
          <Wordmark size={34} />
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3.5 py-2 text-sm font-medium text-ink-2 hover:text-white rounded-lg hover:bg-white/[0.05] transition-all"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA — swaps with auth state */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Button size="sm" onClick={() => setCurrentView('dashboard')}>
                Go to Dashboard
              </Button>
              <button
                onClick={() => setCurrentView('dashboard')}
                title={user?.email ?? 'Your workspace'}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 grid place-items-center text-white text-xs font-semibold hover:brightness-110 transition"
              >
                {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleLogin}
                className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-white transition"
              >
                Log in
              </button>
              <Button size="sm" onClick={handleDemo}>
                Start Free
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/5 transition text-ink-2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden glass border-t border-white/5"
        >
          <div className="px-6 py-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-ink-2 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 space-y-2">
              {isAuthenticated ? (
                <Button className="w-full" onClick={() => { setMobileOpen(false); setCurrentView('dashboard'); }}>
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <button
                    onClick={() => { setMobileOpen(false); handleLogin(); }}
                    className="w-full px-4 py-3 text-sm font-medium text-ink-2 hover:text-white rounded-lg hover:bg-white/5 transition text-left"
                  >
                    Log In
                  </button>
                  <Button
                    className="w-full"
                    onClick={() => { setMobileOpen(false); handleDemo(); }}
                  >
                    Start Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
