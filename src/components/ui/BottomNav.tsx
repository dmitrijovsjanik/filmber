'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, Film02Icon, User03Icon } from '@hugeicons/core-free-icons';
import { useTriggerClearSearch } from '@/stores/searchStore';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

interface NavItem {
  href: string;
  labelKey: 'home' | 'lists' | 'profile';
  icon: typeof Home01Icon;
}

export function BottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('nav');
  const { isAuthenticated, isInitialized } = useAuth();
  const isKeyboardVisible = useKeyboardVisible();
  const triggerClearSearch = useTriggerClearSearch();

  const navItems: NavItem[] = [
    {
      href: `/${locale}`,
      labelKey: 'home',
      icon: Home01Icon,
    },
    {
      href: `/${locale}/lists`,
      labelKey: 'lists',
      icon: Film02Icon,
    },
    {
      href: `/${locale}/profile`,
      labelKey: 'profile',
      icon: User03Icon,
    },
  ];

  // Don't show nav on swipe pages
  const hideOnPaths = ['/swipe', '/room/'];
  const shouldHide = hideOnPaths.some((path) => pathname.includes(path));

  // Hide navbar for unauthenticated users, while auth is initializing, or when keyboard is open
  if (shouldHide || !isInitialized || !isAuthenticated || isKeyboardVisible) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white safe-area-pb">
      <div className="mx-auto flex max-w-lg items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive =
            item.href === `/${locale}`
              ? pathname === `/${locale}` || pathname === `/${locale}/`
              : pathname.startsWith(item.href);

          const isListsTab = item.labelKey === 'lists';
          const isOnListsPage = pathname.startsWith(`/${locale}/lists`);

          // Handle click for lists tab - clear search and blur if already on page
          const handleClick = (e: React.MouseEvent) => {
            if (isListsTab && isOnListsPage) {
              e.preventDefault();
              triggerClearSearch();
              // Blur any focused input
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }
          };

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 py-4 transition-colors ${
                isActive
                  ? 'text-pink-500'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HugeiconsIcon icon={item.icon} size={24} />
              <span className="text-xs">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
