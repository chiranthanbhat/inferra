import { Sidebar } from './Sidebar';
import { Overview } from './Overview';
import { CommandCenter } from './CommandCenter';
import { Requests } from './Requests';
import { ChatSessions } from './ChatSessions';
import { Analytics } from './Analytics';
import { Teams } from './Teams';
import { Settings } from './Settings';
import { Integrations } from './Integrations';
import { NotificationBell } from './NotificationBell';
import { useStore } from '../../store/useStore';
import { useTeamAccess } from '../../lib/teamAccess';
import { cn } from '../../lib/utils';
import { Lock } from 'lucide-react';
import type { ResourceKey } from '../../types';

// Every tab declares its resource — same registry the sidebar filters on.
const TAB_RESOURCE: Record<string, ResourceKey> = {
  overview: 'dashboard',
  command: 'commandCenter',
  chats: 'chat',
  requests: 'commandCenter',
  analytics: 'analytics',
  routing: 'routing',
  cost: 'analytics',
  teams: 'teams',
  integrations: 'integrations',
  settings: 'settings',
};

function NoAccess() {
  return (
    <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto mt-10">
      <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-ink-3 mb-4">
        <Lock size={22} />
      </span>
      <h3 className="text-base font-semibold text-white">No access to this area</h3>
      <p className="text-sm text-ink-3 mt-2 leading-relaxed">
        Your teams don't grant access to this resource. Ask an organization admin
        to add it to one of your teams' permissions.
      </p>
    </div>
  );
}

export function DashboardLayout() {
  const { dashboardTab, sidebarOpen } = useStore();
  const { canAccess } = useTeamAccess();

  const renderContent = () => {
    // Page-level resource guard — mirrors the sidebar filter, so a URL/tab
    // reached any other way still can't render a resource the user lacks.
    const required = TAB_RESOURCE[dashboardTab];
    if (required && !canAccess(required)) return <NoAccess />;

    switch (dashboardTab) {
      case 'overview':
        return <Overview />;
      case 'command':
        return <CommandCenter />;
      case 'chats':
        return <ChatSessions />;
      case 'requests':
        return <Requests />;
      case 'analytics':
        return <Analytics />;
      case 'routing':
        return <CommandCenter />;
      case 'cost':
        return <Analytics />;
      case 'teams':
        return <Teams />;
      case 'integrations':
        return <Integrations />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  const meta: Record<string, { title: string; sub: string }> = {
    overview: { title: 'Overview', sub: 'Real-time intelligence across every AI request' },
    command: { title: 'Command Center', sub: 'Run a request through the live pipeline' },
    chats: { title: 'Chat Sessions', sub: 'Resume and manage your routed conversations' },
    requests: { title: 'Request History', sub: 'Every routed request, fully attributed' },
    analytics: { title: 'Analytics', sub: 'Usage, cost, and quality trends' },
    routing: { title: 'Smart Routing', sub: 'Model selection and scoring' },
    cost: { title: 'Cost Intelligence', sub: 'Spend, savings, and projections' },
    teams: { title: 'Teams', sub: 'People, budgets, and usage' },
    integrations: { title: 'Integrations', sub: 'Providers, keys, and webhooks' },
    settings: { title: 'Settings', sub: 'Workspace and policy configuration' },
  };
  const m = meta[dashboardTab] || meta.overview;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />

      <main className={cn(
        'transition-all duration-300',
        sidebarOpen ? 'ml-64' : 'ml-20'
      )}>
        {/* Top Bar */}
        <header className="h-16 border-b border-white/[0.06] bg-bg/70 backdrop-blur-xl sticky top-0 z-30">
          <div className="h-full px-6 flex items-center justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white tracking-tight leading-none">{m.title}</h1>
              <p className="text-xs text-ink-3 mt-1 truncate">{m.sub}</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-xs text-ink-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse-soft" />
                Live · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="hidden sm:flex items-center rounded-lg glass overflow-hidden text-xs">
                {['24h', '7d', '30d'].map((r, i) => (
                  <button
                    key={r}
                    className={cn(
                      'px-3 py-1.5 transition-colors',
                      i === 1 ? 'bg-brand-500/20 text-brand-200' : 'text-ink-3 hover:text-white',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 max-w-[1500px] mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
