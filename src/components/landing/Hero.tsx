import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, TrendingDown, Sparkles } from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';

export function Hero() {
  const { setCurrentView, initializeDemoData } = useStore();

  const handleGetStarted = () => {
    initializeDemoData();
    setCurrentView('dashboard');
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-32">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 text-purple-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            The Intelligence Layer for AI Spend
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6"
        >
          <span className="text-white">The Operating System</span>
          <br />
          <span className="gradient-text animate-gradient">For AI Spend</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="max-w-3xl mx-auto text-xl md:text-2xl text-gray-400 leading-relaxed mb-10"
        >
          Analyze, optimize, secure, and route every AI request 
          <span className="text-white font-medium"> before a single token is spent.</span>
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Button size="lg" onClick={handleGetStarted} className="group">
            Start Saving AI Spend
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
            <Sparkles size={18} />
            See Interactive Demo
          </Button>
        </motion.div>

        {/* Trust Signals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-12"
        >
          {[
            { icon: <TrendingDown size={20} />, text: 'Save 30-70% on AI spend', color: 'text-green-400' },
            { icon: <Zap size={20} />, text: 'Sub-100ms routing', color: 'text-yellow-400' },
            { icon: <Shield size={20} />, text: 'Enterprise security', color: 'text-purple-400' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm font-medium text-gray-400">
              <span className={item.color}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </motion.div>

        {/* Pipeline Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-20"
        >
          <PipelineVisualization />
        </motion.div>
      </div>
    </section>
  );
}

function PipelineVisualization() {
  const steps = [
    { icon: '📝', label: 'Your Prompt', color: 'from-gray-500 to-gray-600' },
    { icon: '🔒', label: 'Security', color: 'from-red-500 to-red-600' },
    { icon: '🧠', label: 'Analysis', color: 'from-blue-500 to-blue-600' },
    { icon: '⚡', label: 'Optimization', color: 'from-yellow-500 to-yellow-600' },
    { icon: '🎯', label: 'Routing', color: 'from-purple-500 to-purple-600' },
    { icon: '💰', label: 'Savings', color: 'from-green-500 to-green-600' },
  ];

  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="glass-card rounded-2xl p-8 md:p-12">
        <div className="flex items-center justify-between gap-2 md:gap-4 overflow-x-auto hide-scrollbar">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8 + i * 0.1 }}
              className="flex flex-col items-center gap-2 min-w-[80px]"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl shadow-lg`}>
                {step.icon}
              </div>
              <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{step.label}</span>
              {i < steps.length - 1 && (
                <div className="absolute hidden md:block" style={{ left: `${(i + 1) * (100 / steps.length) - 2}%`, top: '50%', transform: 'translateY(-50%)' }}>
                  <ArrowRight size={16} className="text-gray-600" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Savings Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="mt-8 pt-6 border-t border-white/5"
        >
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-red-400">$0.21</p>
              <p className="text-xs text-gray-500 mt-1">Original Cost</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-400">$0.02</p>
              <p className="text-xs text-gray-500 mt-1">Inferra Cost</p>
            </div>
            <div>
              <p className="text-3xl font-bold gradient-text">90%</p>
              <p className="text-xs text-gray-500 mt-1">Saved</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
