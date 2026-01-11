'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/stores/authStore';
import { ReferralSection } from '@/components/referral';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Globe, Bell, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { logout } = useAuth();
  const user = useUser();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <header className="mb-8 text-center">
            {/* Avatar */}
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-blue-600">
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.firstName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl text-white">
                  {user?.firstName?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-2xl font-bold text-foreground">
              {user?.firstName} {user?.lastName}
            </h1>
            {user?.username && (
              <p className="mt-1 text-muted-foreground">@{user.username}</p>
            )}
          </header>

          {/* Referral Section */}
          <div className="mb-8">
            <ReferralSection />
          </div>

          {/* Menu */}
          <Card className="mb-4">
            <CardContent className="p-0">
              <MenuButton
                onClick={() => {}}
                icon={<Globe className="h-5 w-5" />}
                label={t('language', { defaultValue: 'Language' })}
                disabled
              />
              <div className="mx-4 border-t border-border" />
              <MenuButton
                onClick={() => router.push('/profile/notifications')}
                icon={<Bell className="h-5 w-5" />}
                label={t('notifications', { defaultValue: 'Notifications' })}
              />
            </CardContent>
          </Card>

          {/* Logout */}
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            {t('logout', { defaultValue: 'Log Out' })}
          </Button>

          {/* Version */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Filmber v0.2.0 • Made with ❤️
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}

function MenuButton({
  onClick,
  icon,
  label,
  disabled = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:bg-accent'
      }`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 font-medium text-foreground">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
