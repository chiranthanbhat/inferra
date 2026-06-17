// ============================================
// INFERRA GLOBAL STATE STORE
// Zustand store for application state management
// ============================================

import { create } from 'zustand';
import type { 
  User, 
  Organization, 
  Team, 
  InferraPipelineResult,
  PlanType
} from '../types';

interface RequestHistoryItem {
  id: string;
  prompt: string;
  result: InferraPipelineResult;
  timestamp: Date;
}

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalSpend: number;
  totalSavings: number;
  requestsThisMonth: number;
  avgCostPerRequest: number;
  avgLatency: number;
}

interface InferraStore {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  
  // Organization
  organization: Organization | null;
  teams: Team[];
  
  // UI State
  currentView: 'landing' | 'auth' | 'dashboard' | 'admin';
  dashboardTab: 'overview' | 'command' | 'requests' | 'analytics' | 'routing' | 'cost' | 'teams' | 'integrations' | 'settings';
  sidebarOpen: boolean;
  
  // Request History
  requestHistory: RequestHistoryItem[];
  currentRequest: InferraPipelineResult | null;
  
  // Stats
  stats: UsageStats;
  
  // Actions
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentView: (view: 'landing' | 'auth' | 'dashboard' | 'admin') => void;
  setDashboardTab: (tab: InferraStore['dashboardTab']) => void;
  toggleSidebar: () => void;
  addRequestToHistory: (prompt: string, result: InferraPipelineResult) => void;
  setCurrentRequest: (result: InferraPipelineResult | null) => void;
  updateStats: (result: InferraPipelineResult) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  logout: () => void;
  initializeDemoData: (customUser?: Partial<User>) => void;
}

export const useStore = create<InferraStore>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
  organization: null,
  teams: [],
  currentView: 'landing',
  dashboardTab: 'overview',
  sidebarOpen: true,
  requestHistory: [],
  currentRequest: null,
  stats: {
    totalRequests: 0,
    totalTokens: 0,
    totalSpend: 0,
    totalSavings: 0,
    requestsThisMonth: 0,
    avgCostPerRequest: 0,
    avgLatency: 0,
  },

  // Actions
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false,
    currentView: user ? 'dashboard' : 'landing'
  }),

  setOrganization: (organization) => set({ organization }),

  setTeams: (teams) => set({ teams }),

  setCurrentView: (currentView) => set({ currentView }),

  setDashboardTab: (dashboardTab) => set({ dashboardTab }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  addRequestToHistory: (prompt, result) => {
    const newItem: RequestHistoryItem = {
      id: result.requestId,
      prompt,
      result,
      timestamp: new Date(),
    };
    
    set((state) => ({
      requestHistory: [newItem, ...state.requestHistory].slice(0, 100),
    }));
    
    get().updateStats(result);
  },

  setCurrentRequest: (currentRequest) => set({ currentRequest }),

  updateStats: (result) => {
    if (!result.success) return;
    
    set((state) => {
      const newTotal = state.stats.totalRequests + 1;
      const newTokens = state.stats.totalTokens + result.costIntelligence.routedCost.totalTokens;
      const newSpend = state.stats.totalSpend + result.costIntelligence.routedCost.totalCost;
      const newSavings = state.stats.totalSavings + result.costIntelligence.totalSavings.totalSaved;
      
      return {
        stats: {
          totalRequests: newTotal,
          totalTokens: newTokens,
          totalSpend: newSpend,
          totalSavings: newSavings,
          requestsThisMonth: state.stats.requestsThisMonth + 1,
          avgCostPerRequest: newSpend / newTotal,
          avgLatency: (state.stats.avgLatency * state.stats.totalRequests + result.processingTimeMs) / newTotal,
        },
      };
    });

    // Update organization usage if exists
    const { organization } = get();
    if (organization) {
      set({
        organization: {
          ...organization,
          usage: {
            ...organization.usage,
            requestsUsed: organization.usage.requestsUsed + 1,
            totalSpend: organization.usage.totalSpend + result.costIntelligence.routedCost.totalCost,
            totalSavings: organization.usage.totalSavings + result.costIntelligence.totalSavings.totalSaved,
            tokensProcessed: organization.usage.tokensProcessed + result.costIntelligence.routedCost.totalTokens,
          },
        },
      });
    }
  },

  setAuthLoading: (isLoading) => set({ isLoading }),

  setAuthError: (authError) => set({ authError }),

  logout: () => set({
    user: null,
    isAuthenticated: false,
    organization: null,
    teams: [],
    currentView: 'landing',
    requestHistory: [],
    currentRequest: null,
    stats: {
      totalRequests: 0,
      totalTokens: 0,
      totalSpend: 0,
      totalSavings: 0,
      requestsThisMonth: 0,
      avgCostPerRequest: 0,
      avgLatency: 0,
    },
  }),

  initializeDemoData: (customUser?: Partial<User>) => {
    const userId = customUser?.id || 'demo_user_001';
    const email = customUser?.email || 'demo@inferra.ai';
    const name = customUser?.name || customUser?.email?.split('@')[0] || 'Alex Chen';
    
    const demoUser: User = {
      id: userId,
      email,
      name,
      photoURL: customUser?.photoURL || undefined,
      organizationId: `org_${userId}`,
      role: customUser?.role || 'owner',
      teamIds: ['team_engineering', 'team_data'],
      isAdmin: false,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    const demoOrg: Organization = {
      id: demoUser.organizationId,
      name: customUser?.email ? `${name}'s AI Org` : 'Acme AI Corp',
      ownerId: demoUser.id,
      plan: 'growth' as PlanType,
      planLimits: {
        requestsPerMonth: 1000,
        usersLimit: 10,
        teamsLimit: 5,
      },
      usage: {
        requestsUsed: 347,
        totalSpend: 42.87,
        totalSavings: 156.32,
        tokensProcessed: 2847291,
      },
      settings: {
        defaultModel: 'gpt-4o-mini',
        enableOptimization: true,
        enableRouting: true,
        enableGovernance: true,
        piiPolicy: 'sanitize',
        secretPolicy: 'block',
      },
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    };

    const demoTeams: Team[] = [
      {
        id: 'team_engineering',
        organizationId: demoOrg.id,
        name: 'Engineering',
        description: 'Software development team',
        memberIds: [demoUser.id, 'user_2', 'user_3', 'user_4'],
        budget: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'team_data',
        organizationId: demoOrg.id,
        name: 'Data Science',
        description: 'Analytics and ML team',
        memberIds: [demoUser.id, 'user_5', 'user_6'],
        budget: 800,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'team_product',
        organizationId: demoOrg.id,
        name: 'Product',
        description: 'Product management',
        memberIds: ['user_7', 'user_8'],
        budget: 300,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    set({
      user: demoUser,
      isAuthenticated: true,
      isLoading: false,
      organization: demoOrg,
      teams: demoTeams,
      currentView: 'dashboard',
      stats: {
        totalRequests: 347,
        totalTokens: 2847291,
        totalSpend: 42.87,
        totalSavings: 156.32,
        requestsThisMonth: 347,
        avgCostPerRequest: 0.1236,
        avgLatency: 892,
      },
    });
  },
}));
