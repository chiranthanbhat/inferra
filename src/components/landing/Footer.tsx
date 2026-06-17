import { Layers } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white">INFERRA</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#security" className="hover:text-white transition">Security</a>
            <a href="#" className="hover:text-white transition">Docs</a>
            <a href="#" className="hover:text-white transition">Blog</a>
          </div>

          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Inferra. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
