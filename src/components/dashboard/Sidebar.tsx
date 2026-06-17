import { 
  LayoutDashboard, 
  Terminal, 
  History, 
  BarChart3, 
  GitBranch,
  DollarSign,
  Users, 
  Settings, 
  LogOut,
  Layers,
  ChevronLeft,
  Plug
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'command', label: 'Command Center', icon: Terminal },
  { id: 'requests', label: 'Request History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'routing', label: 'Smart Routing', icon: GitBranch },
  { id: 'cost', label: 'Cost Intelligence', icon: DollarSign },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const { 
    dashboardTab, 
    setDashboardTab, 
    user, 
    organization,
    sidebarOpen,
    toggleSidebar,
    logout,
    setCurrentView
  } = useStore();

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-navy-950 border-r border-white/5 flex flex-col transition-all duration-300 z-40',
      sidebarOpen ? 'w-64' : 'w-20'
    )}>
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-rose-500 flex items-center justify-center flex-shrink-0">
            <Layers size={20} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-white tracking-tight">INFERRA</h1>
              <p className="text-[10px] text-teal-300 uppercase tracking-wider">Dashboard</p>
            </div>
          )}
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition"
        >
          <ChevronLeft size={18} className={cn('transition-transform', !sidebarOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = dashboardTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setDashboardTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Organization */}
      {sidebarOpen && organization && (
        <div className="p-3 border-t border-white/5">
          <div className="px-3 py-2.5 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Organization</p>
            <p className="text-sm font-semibold text-white truncate">{organization.name}</p>
            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium capitalize">
              {organization.plan} plan
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-white/5">
        <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0) || '?'}
          </div>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition"
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
