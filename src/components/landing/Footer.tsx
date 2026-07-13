import { useState } from 'react';
import { Wordmark } from '../ui';
import { LegalModal, type LegalDoc } from './LegalModal';

const columns = [
  { title: 'Product', links: ['Routing engine', 'Optimization', 'Cost intelligence', 'Governance', 'Analytics'] },
  { title: 'Developers', links: ['Documentation', 'API reference', 'SDKs', 'Status', 'Changelog'] },
  { title: 'Company', links: ['About', 'Careers', 'Security', 'Blog', 'Contact'] },
];

export function Footer() {
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  return (
    <footer className="relative border-t border-white/[0.07]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark size={36} />
            <p className="mt-5 text-sm text-ink-3 max-w-xs leading-relaxed">
              The AI infrastructure layer. Know the cost, latency, and risk of every request
              before a token is spent.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-ink-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse-soft" />
              All systems operational
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-ink-3 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-ink-3">© {new Date().getFullYear()} Inferra, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-ink-3">
            <button onClick={() => setLegalDoc('privacy')} className="hover:text-white transition">Privacy</button>
            <button onClick={() => setLegalDoc('terms')} className="hover:text-white transition">Terms</button>
            <a href="#" className="hover:text-white transition">SOC 2</a>
          </div>
        </div>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </footer>
  );
}
