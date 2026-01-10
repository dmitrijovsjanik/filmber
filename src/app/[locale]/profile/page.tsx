'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/stores/authStore';
import { ReferralSection } from '@/components/referral';

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
      <div className="min-h-screen bg-gray-900 p-4">
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
            <h1 className="text-2xl font-bold text-white">
              {user?.firstName} {user?.lastName}
            </h1>
            {user?.username && (
              <p className="mt-1 text-gray-400">@{user.username}</p>
            )}
          </header>

          {/* Referral Section */}
          <div className="mb-8">
            <ReferralSection />
          </div>

          {/* Menu */}
          <div className="space-y-2">
            <MenuButton
              onClick={() => {}}
              icon="🌐"
              label={t('language', { defaultValue: 'Language' })}
              disabled
            />
            <MenuButton
              onClick={() => router.push('/profile/notifications')}
              icon="🔔"
              label={t('notifications', { defaultValue: 'Notifications' })}
            />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl bg-red-500/10 py-4 text-center font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            {t('logout', { defaultValue: 'Log Out' })}
          </button>

          {/* Version */}
          <p className="mt-8 text-center text-xs text-gray-600">
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
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl bg-gray-800/50 p-4 text-left transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:bg-gray-800'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="flex-1 font-medium text-white">{label}</span>
      <span className="text-gray-500">›</span>
    </button>
  );
}
