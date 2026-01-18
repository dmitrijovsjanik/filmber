import { create } from 'zustand';

interface RetentionMetric {
  cohort: number;
  returned: number;
  rate: number;
}

interface AdminStats {
  users: {
    total: number;
    last24h: number;
    last7d: number;
    firstUser: string | null;
    latestUser: string | null;
  };
  sessions: {
    active: number;
  };
  movies: {
    cached: number;
    inLists: number;
  };
  rooms: {
    total: number;
    active: number;
  };
  activity: {
    swipesToday: number;
    matchesToday: number;
  };
  // New analytics metrics
  activeUsers: {
    dau: number;
    wau: number;
    mau: number;
  };
  retention: {
    d1: RetentionMetric;
    d7: RetentionMetric;
    d30: RetentionMetric;
  };
  virality: {
    totalReferrals: number;
    usersWithReferrals: number;
    kFactor: number;
  };
  growth: {
    daily: Array<{ date: string; count: number }>;
  };
  // Funnel conversion (guest to auth)
  funnel: {
    roomsWithConnection: number;
    roomsWithOneAuth: number;
    roomsWithBothAuth: number;
    authRate: number;
    bothAuthRate: number;
    // Guest to auth conversion
    usersWithSwipeSync: number;
    guestToAuthRate: number;
  };
  // Session depth
  sessionDepth: {
    avgSwipesPerRoom: number;
    avgSwipesPerUser: number;
    totalRoomSwipes: number;
    totalUserSwipes: number;
  };
  serverTime: string;
}

interface AdminState {
  isAdmin: boolean | null; // null = not checked yet
  isLoading: boolean;
  stats: AdminStats | null;

  // Actions
  setIsAdmin: (isAdmin: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setStats: (stats: AdminStats) => void;
  checkAdminStatus: (token: string) => Promise<boolean>;
  fetchStats: (token: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: null,
  isLoading: false,
  stats: null,

  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setLoading: (isLoading) => set({ isLoading }),
  setStats: (stats) => set({ stats }),

  checkAdminStatus: async (token: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const isAdmin = response.ok;
      set({ isAdmin, isLoading: false });

      if (isAdmin) {
        const data = await response.json();
        set({ stats: data });
      }

      return isAdmin;
    } catch {
      set({ isAdmin: false, isLoading: false });
      return false;
    }
  },

  fetchStats: async (token: string) => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        set({ stats: data });
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    }
  },
}));
