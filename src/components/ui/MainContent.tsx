'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const { isAuthenticated, isInitialized } = useAuth();
  const isKeyboardVisible = useKeyboardVisible();
  const { isTelegramMiniApp } = useTelegramWebApp();

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
        // Apply Telegram safe area insets in fullscreen mode
        isTelegramMiniApp && 'tg-safe-area-top',
        needsNavbarPadding ? 'pb-navbar' : 'pb-0'
      )}
    >
      {children}
    </main>
  );
}
