// ============================================
// INFERRA GLOBAL STATE STORE
// Auth-driven. The signed-in user/org are mirrored here by AuthProvider.
// No demo data, no client-side provider keys — usage + billing are
// server-authoritative (Cloud Functions + Firestore).
// ============================================

import { create } from 'zustand';
import type {
  User,
  Organization,
  Team,
  InferraPipelineResult,
  ChatSession,
  ChatMessage,
} from '../types';
import { createChatSession, loadPersistedChat, savePersistedChat } from '../lib/engine/chat';
import { clearDevSession } from '../lib/devAuth';

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
  authError: string | null;

  // Organization
  organization: Organization | null;
  teams: Team[];

  // UI State
  currentView: 'landing' | 'auth' | 'dashboard';
  dashboardTab: 'overview' | 'command' | 'requests' | 'analytics' | 'routing' | 'cost' | 'teams' | 'integrations' | 'settings' | 'chats';
  sidebarOpen: boolean;

  // Plan selection / upgrade overlay
  plansOpen: boolean;
  plansMode: 'onboarding' | 'upgrade';

  // Invitation deep-link context (?invite=<id>&token=<token>). Survives the
  // auth flow so acceptance runs automatically once the user is signed in.
  pendingInvite: { invitationId: string; token: string } | null;

  // Request History (session-local view cache)
  requestHistory: RequestHistoryItem[];
  currentRequest: InferraPipelineResult | null;

  // Chat continuation (active session; persisted to Firestore + localStorage cache)
  activeChat: ChatSession | null;

  // Command Center: the team the next request is attributed to (session-local).
  commandTeamId: string | null;

  // Stats (live session counters)
  stats: UsageStats;

  // Actions
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentView: (view: InferraStore['currentView']) => void;
  setDashboardTab: (tab: InferraStore['dashboardTab']) => void;
  openPlans: (mode?: InferraStore['plansMode']) => void;
  closePlans: () => void;
  setPendingInvite: (invite: InferraStore['pendingInvite']) => void;
  toggleSidebar: () => void;
  addRequestToHistory: (prompt: string, result: InferraPipelineResult) => void;
  setCurrentRequest: (result: InferraPipelineResult | null) => void;
  updateStats: (result: InferraPipelineResult) => void;
  startChat: (result: InferraPipelineResult) => ChatSession;
  pushChatMessage: (message: ChatMessage) => void;
  setActiveChat: (chat: ChatSession | null) => void;
  setCommandTeamId: (teamId: string | null) => void;
  endChat: () => void;
  setUsageCounters: (requestsUsed: number, requestsLimit: number) => void;
  setAuthError: (error: string | null) => void;
  logout: () => void;
}

const emptyStats: UsageStats = {
  totalRequests: 0,
  totalTokens: 0,
  totalSpend: 0,
  totalSavings: 0,
  requestsThisMonth: 0,
  avgCostPerRequest: 0,
  avgLatency: 0,
};

export const useStore = create<InferraStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  authError: null,
  organization: null,
  teams: [],
  currentView: 'landing',
  dashboardTab: 'overview',
  sidebarOpen: true,
  plansOpen: false,
  plansMode: 'upgrade',
  pendingInvite: null,
  requestHistory: [],
  currentRequest: null,
  activeChat: loadPersistedChat(),
  commandTeamId: null,
  stats: { ...emptyStats },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setOrganization: (organization) => set({ organization }),

  setTeams: (teams) => set({ teams }),

  setCurrentView: (currentView) => set({ currentView }),

  setDashboardTab: (dashboardTab) => set({ dashboardTab }),

  openPlans: (mode = 'upgrade') => set({ plansOpen: true, plansMode: mode }),

  closePlans: () => set({ plansOpen: false }),

  setPendingInvite: (pendingInvite) => set({ pendingInvite }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  addRequestToHistory: (prompt, result) => {
    const newItem: RequestHistoryItem = { id: result.requestId, prompt, result, timestamp: new Date() };
    set((state) => ({ requestHistory: [newItem, ...state.requestHistory].slice(0, 100) }));
    get().updateStats(result);
  },

  setCurrentRequest: (currentRequest) => set({ currentRequest }),

  startChat: (result) => {
    const session = createChatSession(result);
    savePersistedChat(session);
    set({ activeChat: session });
    return session;
  },

  pushChatMessage: (message) => {
    set((state) => {
      const c = state.activeChat;
      if (!c) return {};
      const updated: ChatSession = {
        ...c,
        messages: [...c.messages, message],
        totalInputTokens: c.totalInputTokens + message.inputTokens,
        totalOutputTokens: c.totalOutputTokens + message.outputTokens,
        totalCost: c.totalCost + message.cost,
        cumulativeSavings: c.cumulativeSavings + Math.max(0, message.baselineCost - message.cost),
      };
      savePersistedChat(updated);
      return { activeChat: updated };
    });
  },

  setActiveChat: (chat) => {
    savePersistedChat(chat);
    set({ activeChat: chat });
  },

  setCommandTeamId: (teamId) => set({ commandTeamId: teamId }),

  endChat: () => {
    savePersistedChat(null);
    set({ activeChat: null });
  },

  setUsageCounters: (requestsUsed, requestsLimit) => {
    // Billing/usage now lives on the Organization document — mirror the
    // response of executeRequest onto the store's organization so widgets that
    // read `organization.usage.requestsUsed` update immediately.
    set((state) => {
      if (!state.organization) return {};
      return {
        organization: {
          ...state.organization,
          usage: { ...state.organization.usage, requestsUsed },
          planLimits: { ...state.organization.planLimits, requestsPerMonth: requestsLimit },
        },
      };
    });
  },

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
  },

  setAuthError: (authError) => set({ authError }),

  logout: () => {
    savePersistedChat(null);
    clearDevSession();
    set({
      user: null,
      isAuthenticated: false,
      organization: null,
      teams: [],
      currentView: 'landing',
      requestHistory: [],
      currentRequest: null,
      activeChat: null,
      stats: { ...emptyStats },
    });
  },
}));
