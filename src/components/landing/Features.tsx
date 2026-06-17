import { motion } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  Brain, 
  GitBranch, 
  DollarSign, 
  BarChart3,
  Lock,
  Users,
  Sparkles
} from 'lucide-react';

const features = [
  {
    icon: <Shield size={24} />,
    title: 'Security Engine',
    description: 'Detect API keys, passwords, PII, and compliance violations before they reach AI providers.',
    color: 'from-red-500 to-rose-600',
    details: ['API Key Detection', 'PII Scanning', 'Secret Filtering', 'GDPR/HIPAA Compliance'],
  },
  {
    icon: <Brain size={24} />,
    title: 'Prompt Intelligence',
    description: 'Analyze token waste, duplicate instructions, and poor structure to maximize efficiency.',
    color: 'from-blue-500 to-cyan-600',
    details: ['Quality Scoring', 'Waste Detection', 'Structure Analysis', 'Auto-Optimization'],
  },
  {
    icon: <Zap size={24} />,
    title: 'Prompt Optimization',
    description: 'Automatically remove redundancy, compress instructions, and preserve intent.',
    color: 'from-yellow-500 to-orange-600',
    details: ['Redundancy Removal', 'Filler Elimination', 'Token Compression', '40-60% Reduction'],
  },
  {
    icon: <GitBranch size={24} />,
    title: 'Smart Routing',
    description: 'Route every request to the optimal model based on cost, speed, quality, and complexity.',
    color: 'from-purple-500 to-violet-600',
    details: ['Multi-Model Support', 'Cost Optimization', 'Quality Matching', 'Auto-Fallback'],
  },
  {
    icon: <Sparkles size={24} />,
    title: 'Model-Aware Engineering',
    description: 'Rewrite prompts specifically optimized for each AI model&apos;s strengths.',
    color: 'from-pink-500 to-rose-600',
    details: ['GPT Optimization', 'Claude Tuning', 'Gemini Formatting', 'Provider-Specific'],
  },
  {
    icon: <DollarSign size={24} />,
    title: 'Cost Intelligence',
    description: 'Real-time visibility into cost per prompt, team, and department with savings tracking.',
    color: 'from-green-500 to-emerald-600',
    details: ['Cost Breakdown', 'Savings Tracking', 'Budget Alerts', 'ROI Analytics'],
  },
  {
    icon: <Lock size={24} />,
    title: 'Governance Engine',
    description: 'Enterprise-grade controls for compliance, security policies, and approval workflows.',
    color: 'from-indigo-500 to-blue-600',
    details: ['Policy Enforcement', 'Audit Logging', 'Role-Based Access', 'Approval Workflows'],
  },
  {
    icon: <BarChart3 size={24} />,
    title: 'Team Analytics',
    description: 'Track AI adoption, productivity, and ROI across teams and departments.',
    color: 'from-cyan-500 to-teal-600',
    details: ['Usage Dashboards', 'Team Comparison', 'Productivity Metrics', 'Trend Analysis'],
  },
  {
    icon: <Users size={24} />,
    title: 'AI Procurement Advisor',
    description: 'Analyze usage to recommend which AI subscriptions to keep, remove, or consolidate.',
    color: 'from-amber-500 to-yellow-600',
    details: ['Subscription Analysis', 'Cost Consolidation', 'Vendor Comparison', 'Annual Projections'],
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 grid-bg" />
      
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
            <Sparkles size={14} />
            10-Layer Pipeline
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything you need to
            <br />
            <span className="gradient-text">control AI spend</span>
          </h2>
          <p className="text-lg text-gray-400">
            Every AI request passes through our 10-layer intelligence pipeline before reaching any provider.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group glass-card rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-5 shadow-lg`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 mb-4">{feature.description}</p>
              <div className="space-y-1.5">
                {feature.details.map((detail) => (
                  <div key={detail} className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-1 h-1 rounded-full bg-purple-500" />
                    {detail}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
