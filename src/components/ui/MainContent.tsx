'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const { isAuthenticated, isInitialized } = useAuth();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Check if navbar should be hidden (same logic as BottomNav)
  const hideOnPaths = ['/swipe', '/room/'];
  const shouldHideNavbar = hideOnPaths.some((path) => pathname.includes(path));
  const showNavbar = isInitialized && isAuthenticated && !shouldHideNavbar;

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // If viewport height is significantly less than window height, keyboard is likely open
      const keyboardThreshold = 150;
      const heightDiff = window.innerHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > keyboardThreshold);
    };

    viewport.addEventListener('resize', handleResize);
    handleResize();

    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

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
