'use client';

import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/ui/Loader';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback, loadingFallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isInitialized } = useAuth();

  // Show loading state while checking auth
  if (!isInitialized || isLoading) {
    return (
      loadingFallback || (
        <div className="flex min-h-screen items-center justify-center">
          <Loader size="lg" />
        </div>
      )
    );
  }

  // Show fallback if not authenticated
  if (!isAuthenticated) {
    return (
      fallback || (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-semibold">Authentication Required</h1>
          <p className="text-gray-400">
            Please open this app through Telegram to access this feature.
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
