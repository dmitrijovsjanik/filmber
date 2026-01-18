'use client';

import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/ui/Loader';

interface AuthGuardProps {
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function AuthGuard({ children, loadingFallback }: AuthGuardProps) {
  const { isLoading, isInitialized } = useAuth();

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

  // Now we always render children - pages handle guest state themselves
  return <>{children}</>;
}
