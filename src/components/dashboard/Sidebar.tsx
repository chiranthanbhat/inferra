import {
  LayoutDashboard,
  Terminal,
  History,
  MessageSquare,
  BarChart3,
  GitBranch,
  DollarSign,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Plug,
  Zap,
  Lock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { LogoMark } from '../ui';
import { signOut } from '../../lib/firebase';
import { getPlan, planAllows, featureMinPlanName, type FeatureKey } from '../../lib/plans';
import { usageSnapshot } from '../../lib/subscription';
import { OrgSwitcher } from './OrgSwitcher';
import { useOrganization } from '../../lib/orgContext';
import { useTeamAccess } from '../../lib/teamAccess';
import type { ResourceKey } from '../../types';

type DashboardTab = 'overview' | 'command' | 'chats' | 'requests' | 'analytics' | 'routing' | 'cost' | 'teams' | 'integrations' | 'settings';

// Every nav item declares the resource it needs (role/team visibility) and an
// optional plan `feature` gate. Role-hidden items disappear; PLAN-locked items
// stay visible with a lock + "Upgrade to X" (they never vanish — spec).
const navSections: { label: string; items: { id: DashboardTab; label: string; icon: any; resource: ResourceKey; feature?: FeatureKey }[] }[] = [
  {
    label: 'Operate',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, resource: 'dashboard' },
      { id: 'command', label: 'Command Center', icon: Terminal, resource: 'commandCenter' },
      { id: 'chats', label: 'Chat Sessions', icon: MessageSquare, resource: 'chat' },
      { id: 'requests', label: 'Request History', icon: History, resource: 'commandCenter' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'analytics', label: 'Analytics', icon: BarChart3, resource: 'analytics' },
      { id: 'routing', label: 'Smart Routing', icon: GitBranch, resource: 'routing' },
      { id: 'cost', label: 'Cost Intelligence', icon: DollarSign, resource: 'analytics' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'teams', label: 'Teams', icon: Users, resource: 'teams', feature: 'teams' },
      { id: 'integrations', label: 'Integrations', icon: Plug, resource: 'integrations', feature: 'integrations' },
      { id: 'settings', label: 'Settings', icon: Settings, resource: 'settings' },
    ],
  },
];

export function Sidebar() {
  const {
    dashboardTab,
    setDashboardTab,
    user,
    organization,
    sidebarOpen,
    toggleSidebar,
    logout,
    openPlans,
    setCurrentView,
  } = useStore();
  const { organizationRole } = useOrganization();
  const { canAccess } = useTeamAccess();

  const handleLogout = async () => {
    await signOut();
    logout();
  };

  const plan = getPlan(organization?.plan ?? 'free');
  const usage = usageSnapshot(organization);
  const { used, limit, unlimited, percent: pct } = usage;

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-bg/80 backdrop-blur-xl border-r border-white/[0.06] flex flex-col transition-all duration-300 z-40',
      sidebarOpen ? 'w-64' : 'w-20'
    )}>
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06]">
        {/* Logo = Home. Navigates to the landing page WITHOUT touching the
            session — auth, org, chats and history all stay intact. */}
        <button
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-2.5 overflow-hidden text-left group"
          title="Back to home"
        >
          <LogoMark size={34} />
          {sidebarOpen && (
            <div className="overflow-hidden leading-none">
              <h1 className="text-base font-semibold text-white tracking-tight font-display group-hover:text-brand-200 transition-colors">Inferra</h1>
              <p className="text-[9px] text-ink-3 uppercase tracking-[0.2em] mt-1">Console</p>
            </div>
          )}
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-white/5 text-ink-3 hover:text-white transition"
        >
          <ChevronLeft size={18} className={cn('transition-transform', !sidebarOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation — items are resource-gated; empty sections collapse away. */}
      <nav className="flex-1 p-3 overflow-y-auto hide-scrollbar">
        {navSections
          .map((section) => ({ ...section, items: section.items.filter((i) => canAccess(i.resource)) }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
          <div key={section.label} className="mb-5">
            {sidebarOpen && (
              <p className="px-3 mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink-3/70">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = dashboardTab === item.id;
                // PLAN-locked: role allows it but the current plan doesn't —
                // show the item locked and route the click to the upgrade flow.
                const planLocked = !!item.feature && !planAllows(plan.id, item.feature);
                if (planLocked) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => openPlans('upgrade')}
                      title={`Upgrade to ${featureMinPlanName(item.feature!)}`}
                      className="group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-3/70 hover:text-white hover:bg-white/[0.04] transition-all"
                    >
                      <Icon size={17} className="flex-shrink-0 opacity-70" />
                      {sidebarOpen && (
                        <>
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto inline-flex items-center gap-1 text-[0.6rem] text-warning-400/90 flex-shrink-0">
                            <Lock size={11} />
                            <span className="hidden group-hover:inline">{featureMinPlanName(item.feature!)}</span>
                          </span>
                        </>
                      )}
                    </button>
                  );
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => setDashboardTab(item.id)}
                    className={cn(
                      'group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-ink-3 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-brand-400 to-accent-500" />
                    )}
                    <Icon size={17} className={cn('flex-shrink-0 transition-colors', isActive ? 'text-brand-300' : 'group-hover:text-ink-2')} />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Organization switcher */}
      {organization && (
        <div className="p-3 border-t border-white/[0.06]">
          <OrgSwitcher collapsed={!sidebarOpen} />
        </div>
      )}

      {/* Plan + usage */}
      {sidebarOpen && organization && (
        <div className="px-3 pb-3">
          <div className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.05]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-3 uppercase tracking-wide">Plan</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[0.66rem] font-medium capitalize border border-brand-500/25">
                {plan.name}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex justify-between text-[0.66rem] text-ink-3 mb-1">
                <span>Requests</span>
                <span className="tabular">{unlimited ? `${used.toLocaleString()} · ∞` : `${used.toLocaleString()} / ${limit.toLocaleString()}`}</span>
              </div>
              {!unlimited && (
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-error-400' : pct >= 80 ? 'bg-warning-400' : 'bg-gradient-to-r from-brand-400 to-accent-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-[0.6rem] text-ink-3 mt-1.5">
                <span className="tabular">{unlimited ? 'Unlimited requests' : `${usage.remaining.toLocaleString()} remaining`}</span>
                <span>{usage.resetLabel}</span>
              </div>
            </div>
            {plan.id !== 'enterprise' && (
              <button
                onClick={() => openPlans('upgrade')}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] text-xs font-semibold hover:brightness-110 transition"
              >
                <Zap size={12} /> Upgrade plan
              </button>
            )}
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            {user?.name?.charAt(0) || '?'}
          </div>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-ink-3 truncate">
                  {organizationRole && <span className="capitalize mr-1.5">{organizationRole} ·</span>}
                  <span className="truncate">{user?.email || ''}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-white/5 text-ink-3 hover:text-white transition"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
