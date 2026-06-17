import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Layers } from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Security', href: '#security' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setCurrentView, initializeDemoData } = useStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = () => {
    setCurrentView('auth');
  };

  const handleDemo = () => {
    initializeDemoData();
    setCurrentView('dashboard');
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-rose-500 flex items-center justify-center shadow-lg shadow-teal-500/25 group-hover:shadow-teal-500/40 transition-shadow">
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">INFERRA</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={handleLogin}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition"
          >
            Log In
          </button>
          <Button size="sm" onClick={handleDemo}>
            Get Started Free
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/5 transition text-gray-300"
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
                className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 space-y-2">
              <button
                onClick={() => { setMobileOpen(false); handleLogin(); }}
                className="w-full px-4 py-3 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition text-left"
              >
                Log In
              </button>
              <Button 
                className="w-full" 
                onClick={() => { setMobileOpen(false); handleDemo(); }}
              >
                Get Started Free
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
