'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, Archive02Icon, User03Icon } from '@hugeicons/core-free-icons';

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

  const navItems: NavItem[] = [
    {
      href: `/${locale}`,
      labelKey: 'home',
      icon: Home01Icon,
    },
    {
      href: `/${locale}/lists`,
      labelKey: 'lists',
      icon: Archive02Icon,
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

  // Hide navbar for unauthenticated users or while auth is initializing
  if (shouldHide || !isInitialized || !isAuthenticated) {
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

          return (
            <Link
              key={item.href}
              href={item.href}
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
