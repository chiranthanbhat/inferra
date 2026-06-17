import { motion } from 'framer-motion';
import { 
  FileText, 
  Shield, 
  Brain, 
  Zap, 
  GitBranch, 
  Sparkles, 
  DollarSign,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const layers = [
  {
    number: '01',
    icon: <Shield size={20} />,
    title: 'Security Scan',
    description: 'Detect API keys, passwords, PII, and compliance violations before they reach any AI provider.',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
  },
  {
    number: '02',
    icon: <Brain size={20} />,
    title: 'Intent & Complexity Analysis',
    description: 'Classify task type, detect complexity, extract goals, evaluate context needs and output requirements.',
    color: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
  },
  {
    number: '03',
    icon: <Zap size={20} />,
    title: 'Prompt Intelligence',
    description: 'Score quality, detect waste, find redundancy, evaluate structure and context quality.',
    color: 'from-yellow-500 to-orange-600',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
  },
  {
    number: '04',
    icon: <Sparkles size={20} />,
    title: 'Intelligent Optimization',
    description: 'Rewrite prompts to be shorter, clearer, and higher-information. Not compression — improvement.',
    color: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
  },
  {
    number: '05',
    icon: <GitBranch size={20} />,
    title: 'Smart Model Routing',
    description: 'Score every model on quality, reasoning, speed, cost, and context. Select the best fit.',
    color: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
  },
  {
    number: '06',
    icon: <FileText size={20} />,
    title: 'Model-Aware Rewriting',
    description: 'Rewrite the optimized prompt specifically for the selected model — GPT, Claude, Gemini, DeepSeek.',
    color: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    text: 'text-pink-400',
  },
  {
    number: '07',
    icon: <DollarSign size={20} />,
    title: 'Cost Intelligence',
    description: 'Calculate original cost, optimized cost, routed cost, and total savings with annual projections.',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-400',
  },
  {
    number: '08',
    icon: <CheckCircle size={20} />,
    title: 'Governance & Routing',
    description: 'Final policy check, compliance validation, and request delivery to the optimal model.',
    color: 'from-teal-500 to-cyan-600',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    text: 'text-teal-400',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 grid-bg" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
            <Zap size={14} />
            8-Layer Pipeline
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Every request passes through
            <br />
            <span className="gradient-text">8 intelligent layers</span>
          </h2>
          <p className="text-lg text-gray-400">
            From prompt input to model output, Inferra analyzes, optimizes, secures, and routes every request.
          </p>
        </motion.div>

        {/* Pipeline Steps */}
        <div className="space-y-4 max-w-4xl mx-auto">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.number}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group"
            >
              <div className={`glass-card rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300`}>
                <div className="flex items-start gap-5">
                  {/* Number + Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center text-white shadow-lg`}>
                      {layer.icon}
                    </div>
                    <p className={`text-xs font-bold ${layer.text} text-center mt-2`}>
                      {layer.number}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{layer.title}</h3>
                    <p className="text-sm text-gray-400">{layer.description}</p>
                  </div>

                  {/* Arrow connector */}
                  {i < layers.length - 1 && (
                    <div className="hidden md:flex items-center text-gray-600">
                      <ArrowRight size={16} />
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {i < layers.length - 1 && (
                <div className="flex justify-start pl-6 md:pl-[1.5rem] h-4">
                  <div className="w-px h-full bg-white/10" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Result */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="max-w-4xl mx-auto mt-12"
        >
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Result: Better Output, Lower Cost</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-3xl font-bold text-red-400">$0.21</p>
                <p className="text-sm text-gray-400">Original Cost</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-400">$0.02</p>
                <p className="text-sm text-gray-400">Inferra Cost</p>
              </div>
              <div>
                <p className="text-3xl font-bold gradient-text">90%</p>
                <p className="text-sm text-gray-400">Total Saved</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
