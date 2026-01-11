'use client';

import { useCallback, useEffect } from 'react';
import { useAuthStore, type AuthUser } from '@/stores/authStore';

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

interface SessionResponse {
  user: AuthUser;
}

export function useAuth() {
  const {
    user,
    token,
    isLoading,
    isInitialized,
    hasHydrated,
    setAuth,
    logout: storeLogout,
    setLoading,
    setInitialized,
  } = useAuthStore();

  // Initialize auth state on mount (after hydration)
  useEffect(() => {
    // Wait for hydration to complete before initializing
    if (!hasHydrated) return;
    if (isInitialized) return;

    const initAuth = async () => {
      if (!token) {
        setInitialized(true);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('/api/auth/session', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data: SessionResponse = await response.json();
          // Token is still valid, update user data
          useAuthStore.setState({ user: data.user });
        } else {
          // Token is invalid, clear it
          storeLogout();
        }
      } catch (error) {
        console.error('Failed to validate session:', error);
        storeLogout();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, [token, isInitialized, hasHydrated, setLoading, setInitialized, storeLogout]);

  // Authenticate with Telegram initData
  const authenticateWithTelegram = useCallback(
    async (initData: string): Promise<boolean> => {
      try {
        setLoading(true);

        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ initData }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Auth failed:', error);
          return false;
        }

        const data: AuthResponse = await response.json();
        setAuth(data.user, data.token, data.expiresAt);

        return true;
      } catch (error) {
        console.error('Auth error:', error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading]
  );

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      if (token) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      storeLogout();
    }
  }, [token, storeLogout]);

  // Refresh user data
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: SessionResponse = await response.json();
        useAuthStore.setState({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [token]);

  return {
    user,
    token,
    isLoading,
    // Consider initialized only after hydration AND initialization
    isInitialized: hasHydrated && isInitialized,
    isAuthenticated: !!user,
    authenticateWithTelegram,
    logout,
    refreshUser,
  };
}
