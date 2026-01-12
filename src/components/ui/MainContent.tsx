'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const { isAuthenticated, isInitialized } = useAuth();
  const isKeyboardVisible = useKeyboardVisible();

  // Check if navbar should be hidden (same logic as BottomNav)
  const hideOnPaths = ['/swipe', '/room/'];
  const shouldHideNavbar = hideOnPaths.some((path) => pathname.includes(path));
  const showNavbar = isInitialized && isAuthenticated && !shouldHideNavbar;

  // Only add navbar padding if navbar is shown and keyboard is hidden
  const needsNavbarPadding = showNavbar && !isKeyboardVisible;

  return (
    <main
      className={cn(
        'h-full flex flex-col overflow-hidden transition-[padding] duration-150',
        needsNavbarPadding ? 'pb-navbar' : 'pb-0'
      )}
    >
      {children}
    </main>
  );
}
