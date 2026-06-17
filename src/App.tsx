import { useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { useStore } from './store/useStore';

export default function App() {
  const { currentView, isLoading, setAuthLoading } = useStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [setAuthLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading INFERRA...</p>
        </div>
      </div>
    );
  }

  switch (currentView) {
    case 'dashboard':
    case 'admin':
      return <DashboardLayout />;
    case 'auth':
      return <AuthPage />;
    case 'landing':
    default:
      return <LandingPage />;
  }
}
