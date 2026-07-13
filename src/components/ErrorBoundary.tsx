import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { captureException } from '../lib/monitoring';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Top-level error boundary. Catches render-time crashes so a single broken
 * view never blanks the whole app. Hook `componentDidCatch` into a monitoring
 * service (Sentry, etc.) where indicated.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { componentStack: info.componentStack?.slice(0, 2000) }, 'boundary');
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-error-500/15 border border-error-500/25 text-error-400 mb-4">
            <AlertTriangle size={22} />
          </span>
          <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
          <p className="text-sm text-ink-3 mt-2 leading-relaxed">
            An unexpected error occurred. Your data is safe — try reloading the view.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-ink-3 mt-3 font-mono bg-black/30 border border-white/[0.06] rounded-lg p-2 break-words">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-2 justify-center mt-5">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] text-sm font-medium hover:brightness-110 transition"
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-ink-2 text-sm hover:text-white transition"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
