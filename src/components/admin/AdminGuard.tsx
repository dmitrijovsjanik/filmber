'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAdminStore } from '@/stores/adminStore';
import { useAuthStore } from '@/stores/authStore';
import { Loader } from '@/components/ui/Loader';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isInitialized } = useAuth();
  const token = useAuthStore((state) => state.token);
  const { isAdmin, isLoading: adminLoading, checkAdminStatus } = useAdminStore();

  useEffect(() => {
    if (isInitialized && isAuthenticated && token && isAdmin === null) {
      checkAdminStatus(token);
    }
  }, [isInitialized, isAuthenticated, token, isAdmin, checkAdminStatus]);

  // Loading state
  if (!isInitialized || authLoading || (isAuthenticated && isAdmin === null) || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="text-4xl">🔐</div>
        <h1 className="text-xl font-semibold">Authentication Required</h1>
        <p className="text-muted-foreground">
          Please open this app through Telegram to access this feature.
        </p>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="text-4xl">🚫</div>
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to access this page.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Go Home
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
