import { Sidebar } from './Sidebar';
import { Overview } from './Overview';
import { CommandCenter } from './CommandCenter';
import { Requests } from './Requests';
import { Analytics } from './Analytics';
import { Teams } from './Teams';
import { Settings } from './Settings';
import { Integrations } from './Integrations';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function DashboardLayout() {
  const { dashboardTab, sidebarOpen } = useStore();

  const renderContent = () => {
    switch (dashboardTab) {
      case 'overview':
        return <Overview />;
      case 'command':
        return <CommandCenter />;
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

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      overview: 'Overview',
      command: 'Command Center',
      requests: 'Request History',
      analytics: 'Analytics',
      routing: 'Smart Routing',
      cost: 'Cost Intelligence',
      teams: 'Team Management',
      settings: 'Settings',
    };
    return titles[dashboardTab] || 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-navy-950">
      <Sidebar />
      
      <main className={cn(
        'transition-all duration-300',
        sidebarOpen ? 'ml-64' : 'ml-20'
      )}>
        {/* Top Bar */}
        <header className="h-16 border-b border-white/5 bg-navy-950/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="h-full px-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{getPageTitle()}</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
