'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home09Icon,
  UserMultiple02Icon,
  Film02Icon,
  GridIcon,
  TelegramIcon,
  Notification03Icon,
} from '@hugeicons/core-free-icons';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home09Icon },
  { href: '/admin/users', label: 'Users', icon: UserMultiple02Icon },
  { href: '/admin/rooms', label: 'Rooms', icon: GridIcon },
  { href: '/admin/movies', label: 'Movies', icon: Film02Icon },
  { href: '/admin/bot', label: 'Bot', icon: TelegramIcon },
  { href: '/admin/notifications', label: 'Notifications', icon: Notification03Icon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Extract locale from pathname
  const locale = pathname.split('/')[1] || 'en';

  return (
    <AdminGuard>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <Link href={`/${locale}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to App
          </Link>
        </header>

        {/* Nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {navItems.map((item) => {
            const fullHref = `/${locale}${item.href}`;
            const isActive =
              item.href === '/admin'
                ? pathname === fullHref
                : pathname.startsWith(fullHref);

            return (
              <Link
                key={item.href}
                href={fullHref}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <HugeiconsIcon icon={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </AdminGuard>
  );
}
