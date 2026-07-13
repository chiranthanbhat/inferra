// ============================================
// LEGAL CONTENT (Privacy / Terms)
// Rendered as an in-page modal from the landing footer — production launch
// requirement. Content is a solid baseline; have counsel review before launch.
// ============================================

import { AnimatePresence, motion } from 'framer-motion';
import { X, ScrollText, ShieldCheck } from 'lucide-react';

export type LegalDoc = 'privacy' | 'terms';

const LAST_UPDATED = 'July 2026';

const CONTENT: Record<LegalDoc, { title: string; sections: { h: string; p: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: '1. What we collect', p: 'Account data (name, email, organization), billing metadata via Razorpay (we never store card numbers), usage records (requests, tokens, model routed, cost, latency) and the prompts you submit for routing. Prompts are processed to perform the service and are not used to train models.' },
      { h: '2. How we use it', p: 'To operate the routing pipeline, enforce plan limits, bill subscriptions, secure accounts, send transactional email (invitations, receipts, quota alerts) and produce aggregate, de-identified analytics.' },
      { h: '3. Sub-processors', p: 'Google Firebase (authentication, database, functions hosting), Razorpay (payments), and the AI providers your requests are routed to (OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral, OpenRouter). Each receives only what is necessary to perform its function.' },
      { h: '4. Security', p: 'Provider API keys are held server-side only. All traffic is encrypted in transit. Access to production data is restricted and audited; every organization-scoped action writes an immutable audit log.' },
      { h: '5. Data retention & deletion', p: 'Usage and audit records are retained for the life of the organization plus 90 days. You may delete chats at any time, and organization owners may delete the organization from Settings, which soft-deletes tenant data pending purge.' },
      { h: '6. Your rights', p: 'You may request access, correction, export or erasure of your personal data at privacy@inferra.ai. We respond within 30 days.' },
      { h: '7. Contact', p: 'Inferra, Inc. · privacy@inferra.ai' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { h: '1. The service', p: 'Inferra analyses, optimizes and routes AI requests to third-party model providers and reports the associated costs and savings. Estimates are informational; actual provider charges are set by the providers.' },
      { h: '2. Accounts & organizations', p: 'You must provide accurate information and keep credentials secure. Organization owners control membership, roles and billing; actions taken by members within an organization are the organization’s responsibility.' },
      { h: '3. Subscriptions & billing', p: 'Paid plans renew monthly via Razorpay until cancelled. Cancelling keeps access until the end of the paid cycle. Request quotas reset monthly and unused requests do not roll over. Prices may change with 30 days’ notice.' },
      { h: '4. Acceptable use', p: 'No unlawful content, no attempts to bypass usage limits or security controls, no reselling of the service without written consent, and no use that violates the acceptable-use policies of the underlying model providers.' },
      { h: '5. Availability & changes', p: 'The service is provided “as is” without warranty of uninterrupted availability. We may modify features with reasonable notice; material reductions entitle you to a pro-rated refund of prepaid fees.' },
      { h: '6. Liability', p: 'To the maximum extent permitted by law, Inferra’s aggregate liability is limited to the fees you paid in the 12 months preceding the claim. We are not liable for the outputs of third-party models.' },
      { h: '7. Termination', p: 'You may stop using the service at any time. We may suspend accounts that violate these terms, with notice where practicable. Sections 4–6 survive termination.' },
      { h: '8. Contact', p: 'Inferra, Inc. · legal@inferra.ai' },
    ],
  },
};

export function LegalModal({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const active = doc ? CONTENT[doc] : null;
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm grid place-items-center p-4 sm:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
            className="glass-card rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/[0.07] flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/25 text-brand-300">
                {doc === 'privacy' ? <ShieldCheck size={17} /> : <ScrollText size={17} />}
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">{active.title}</h2>
                <p className="text-[0.7rem] text-ink-3">Last updated {LAST_UPDATED}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition"><X size={16} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              {active.sections.map((s) => (
                <div key={s.h}>
                  <h3 className="text-sm font-semibold text-white mb-1.5">{s.h}</h3>
                  <p className="text-sm text-ink-2 leading-relaxed">{s.p}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
