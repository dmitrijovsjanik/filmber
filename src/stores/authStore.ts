import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  isPremium?: boolean;
  createdAt?: string;
  referralCode: string | null;
}

interface AuthState {
  // User data
  user: AuthUser | null;
  token: string | null;
  expiresAt: string | null;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  hasHydrated: boolean;

  // Mini App context
  isTelegramMiniApp: boolean;

  // Actions
  setAuth: (user: AuthUser, token: string, expiresAt: string) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setIsTelegramMiniApp: (is: boolean) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      token: null,
      expiresAt: null,
      isLoading: false,
      isInitialized: false,
      hasHydrated: false,
      isTelegramMiniApp: false,

      // Actions
      setAuth: (user, token, expiresAt) =>
        set({
          user,
          token,
          expiresAt,
          isLoading: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () =>
        set({
          user: null,
          token: null,
          expiresAt: null,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setInitialized: (isInitialized) => set({ isInitialized }),

      setIsTelegramMiniApp: (isTelegramMiniApp) => set({ isTelegramMiniApp }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'filmber-auth',
      // Persist token, user data, and isInitialized for faster initial load
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
        user: state.user,
        isInitialized: state.isInitialized,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user);
export const useAuthToken = () => useAuthStore((state) => state.token);
export const useIsTelegramMiniApp = () => useAuthStore((state) => state.isTelegramMiniApp);
