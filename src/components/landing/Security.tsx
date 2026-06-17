import { motion } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Eye, 
  FileCheck, 
  Key, 
  AlertTriangle,
  CheckCircle,
  Server,
  Fingerprint
} from 'lucide-react';

const features = [
  {
    icon: <Lock size={22} />,
    title: 'Secret Detection',
    description: 'Automatically detects API keys, passwords, tokens, AWS credentials, and private keys before they reach any AI provider.',
    details: ['OpenAI keys', 'AWS credentials', 'Database URLs', 'OAuth secrets', 'SSH keys'],
  },
  {
    icon: <Eye size={22} />,
    title: 'PII Scanning',
    description: 'Identifies and optionally redacts personally identifiable information including emails, SSNs, credit cards, and more.',
    details: ['Email addresses', 'Social Security Numbers', 'Credit card numbers', 'Phone numbers', 'Physical addresses'],
  },
  {
    icon: <FileCheck size={22} />,
    title: 'Compliance Enforcement',
    description: 'Enforces compliance with major regulatory frameworks. Block or flag requests that violate data protection policies.',
    details: ['GDPR', 'HIPAA', 'PCI-DSS', 'SOX', 'CCPA'],
  },
  {
    icon: <Key size={22} />,
    title: 'Policy Engine',
    description: 'Define custom security policies. Block keywords, enforce model restrictions, set cost limits, and require approvals.',
    details: ['Keyword blocking', 'Model restrictions', 'Cost limits', 'Approval workflows', 'Working hours'],
  },
  {
    icon: <AlertTriangle size={22} />,
    title: 'Risk Scoring',
    description: 'Every request gets a security score from 0-100. High-risk requests are automatically blocked or flagged for review.',
    details: ['0-100 risk scale', 'Auto-blocking', 'Human review triggers', 'Risk trends', 'Team dashboards'],
  },
  {
    icon: <Server size={22} />,
    title: 'Audit Logging',
    description: 'Complete audit trail of every AI request. Who sent what, when, to which model, with what security flags.',
    details: ['Full request logs', 'User attribution', 'Security events', 'Compliance reports', 'Export to SIEM'],
  },
];

const certifications = [
  { name: 'SOC 2', status: 'In Progress' },
  { name: 'GDPR', status: 'Compliant' },
  { name: 'HIPAA', status: 'Compliant' },
  { name: 'ISO 27001', status: 'Planned' },
];

export function Security() {
  return (
    <section id="security" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-red-500/30 text-red-300 text-sm font-medium mb-6">
            <Shield size={14} />
            Enterprise Security
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Security-first
            <br />
            <span className="gradient-text">by design</span>
          </h2>
          <p className="text-lg text-gray-400">
            Every request is scanned for secrets, PII, and compliance violations before reaching any AI provider.
          </p>
        </motion.div>

        {/* Security Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-6 hover:border-red-500/20 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-red-500/20">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 mb-4">{feature.description}</p>
              <div className="space-y-1.5">
                {feature.details.map((detail) => (
                  <div key={detail} className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                    {detail}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security Flow */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <div className="glass-card rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Request Security Flow</h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {[
                { icon: <Fingerprint size={20} />, label: 'Request Received', color: 'from-blue-500 to-cyan-500' },
                { icon: <Lock size={20} />, label: 'Secret Scan', color: 'from-red-500 to-rose-500' },
                { icon: <Eye size={20} />, label: 'PII Detection', color: 'from-yellow-500 to-orange-500' },
                { icon: <FileCheck size={20} />, label: 'Compliance Check', color: 'from-purple-500 to-violet-500' },
                { icon: <Shield size={20} />, label: 'Risk Score', color: 'from-green-500 to-emerald-500' },
              ].map((step) => (
                <div key={step.label} className="flex flex-col items-center gap-2 min-w-[100px]">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}>
                    {step.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-400 text-center">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Decision */}
            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-300">Approved</p>
                <p className="text-xs text-gray-500 mt-1">Safe to send to AI provider</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-red-300">Blocked</p>
                <p className="text-xs text-gray-500 mt-1">Security violation detected</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {certifications.map((cert) => (
            <div key={cert.name} className="flex items-center gap-3 px-5 py-3 glass-card rounded-xl">
              <Shield size={18} className="text-green-400" />
              <div>
                <p className="text-sm font-bold text-white">{cert.name}</p>
                <p className="text-xs text-gray-500">{cert.status}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
