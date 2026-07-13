import { motion } from 'framer-motion';
import {
  ShieldCheck, Eye, FileCheck, KeyRound, AlertTriangle,
  ServerCog, Fingerprint, Lock, Check,
} from 'lucide-react';

const controls = [
  { icon: Lock, title: 'Secrets detection', description: 'Catch API keys, tokens, cloud credentials, and private keys before they ever leave.', details: ['OpenAI keys', 'AWS credentials', 'OAuth · SSH keys'] },
  { icon: Eye, title: 'PII detection', description: 'Identify and redact emails, SSNs, card numbers, and addresses in-flight.', details: ['Emails · SSNs', 'Card numbers', 'Configurable redaction'] },
  { icon: FileCheck, title: 'Compliance', description: 'Enforce regulatory frameworks. Block or flag requests that violate policy.', details: ['GDPR · HIPAA', 'PCI-DSS · SOC 2', 'CCPA'] },
  { icon: KeyRound, title: 'Policy engine', description: 'Custom rules: block keywords, restrict models, cap cost, require approvals.', details: ['Keyword rules', 'Model restrictions', 'Approval workflows'] },
  { icon: AlertTriangle, title: 'Risk scoring', description: 'Every request scored 0–100. High-risk traffic auto-blocks or escalates.', details: ['0–100 scale', 'Auto-blocking', 'Human review'] },
  { icon: ServerCog, title: 'Audit logging', description: 'Full trail of who sent what, when, to which model, with which flags.', details: ['Request logs', 'User attribution', 'SIEM export'] },
];

const certifications = [
  { name: 'SOC 2', status: 'In progress' },
  { name: 'GDPR', status: 'Compliant' },
  { name: 'HIPAA', status: 'Compliant' },
  { name: 'ISO 27001', status: 'Planned' },
];

const flow = [
  { icon: Fingerprint, label: 'Received' },
  { icon: Lock, label: 'Secret scan' },
  { icon: Eye, label: 'PII detection' },
  { icon: FileCheck, label: 'Compliance' },
  { icon: ShieldCheck, label: 'Risk score' },
];

export function Security() {
  return (
    <section id="security" className="relative py-28 md:py-36">
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <p className="eyebrow mb-4">AI governance</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.08]">
            Security and compliance, enforced before send.
          </h2>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed">
            Every request is inspected for secrets, PII, and policy violations the moment it
            arrives — and never reaches a provider until it's cleared.
          </p>
        </motion.div>

        {/* Controls grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {controls.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="group glass-card panel-hover rounded-2xl p-6"
              >
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-brand-300 mb-5 group-hover:border-brand-500/40 transition-colors">
                  <Icon size={19} />
                </span>
                <h3 className="text-[1.02rem] font-semibold text-white mb-1.5">{c.title}</h3>
                <p className="text-sm text-ink-3 leading-relaxed mb-4">{c.description}</p>
                <div className="space-y-1.5">
                  {c.details.map((d) => (
                    <div key={d} className="flex items-center gap-2 text-xs text-ink-3">
                      <Check size={12} className="text-success-400 flex-shrink-0" />
                      {d}
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Flow + decision */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="ring-gradient glass-card rounded-2xl p-6 sm:p-8 mb-12"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 flex items-center justify-between gap-2">
              {flow.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-brand-300">
                        <Icon size={18} />
                      </span>
                      <span className="text-[0.68rem] text-ink-3 whitespace-nowrap">{step.label}</span>
                    </div>
                    {i < flow.length - 1 && <div className="flex-1 h-px bg-gradient-to-r from-brand-500/30 to-transparent" />}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:w-72">
              <div className="bg-success-500/[0.08] border border-success-500/20 rounded-xl p-4 text-center">
                <Check size={20} className="text-success-400 mx-auto mb-1.5" />
                <p className="text-sm font-semibold text-success-400">Approved</p>
                <p className="text-[0.68rem] text-ink-3 mt-0.5">Cleared to send</p>
              </div>
              <div className="bg-error-500/[0.08] border border-error-500/20 rounded-xl p-4 text-center">
                <AlertTriangle size={20} className="text-error-400 mx-auto mb-1.5" />
                <p className="text-sm font-semibold text-error-400">Blocked</p>
                <p className="text-[0.68rem] text-ink-3 mt-0.5">Violation found</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {certifications.map((cert) => (
            <div key={cert.name} className="flex items-center gap-3 px-5 py-3 glass rounded-xl">
              <ShieldCheck size={18} className="text-brand-300" />
              <div>
                <p className="text-sm font-semibold text-white">{cert.name}</p>
                <p className="text-[0.7rem] text-ink-3">{cert.status}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
