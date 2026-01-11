'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useUser } from '@/stores/authStore';
import { ReferralSection } from '@/components/referral';
import { H3, Muted } from '@/components/ui/typography';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Globe02Icon, Notification01Icon, Settings02Icon } from '@hugeicons/core-free-icons';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const router = useRouter();
  const user = useUser();

  return (
    <AuthGuard>
      <div className="flex-1 bg-background p-4">
        <div className="mx-auto max-w-[280px]">
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
            <H3 className="text-foreground">
              {user?.firstName} {user?.lastName}
            </H3>
            {user?.username && (
              <Muted className="mt-1">@{user.username}</Muted>
            )}
          </header>

          {/* Referral Section */}
          <div className="mb-8">
            <ReferralSection />
          </div>

          {/* Menu */}
          <div className="overflow-hidden rounded-xl bg-muted/50">
            <MenuButton
              onClick={() => {}}
              icon={<HugeiconsIcon icon={Globe02Icon} size={20} />}
              label={t('language', { defaultValue: 'Language' })}
              disabled
            />
            <div className="mx-4 border-t border-border" />
            <MenuButton
              onClick={() => router.push('/profile/notifications')}
              icon={<HugeiconsIcon icon={Notification01Icon} size={20} />}
              label={t('notifications', { defaultValue: 'Notifications' })}
            />
            <div className="mx-4 border-t border-border" />
            <MenuButton
              onClick={() => router.push('/profile/deck')}
              icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
              label={t('deckSettings', { defaultValue: 'Deck Settings' })}
            />
          </div>

          {/* Version */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t('version', { defaultValue: 'Filmber v0.2.0' })} •{' '}
            {t('madeWith', { defaultValue: 'Made with' })} ❤️{' '}
            <a
              href="https://t.me/ovsjanik"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @ovsjanik
            </a>
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
      className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent'
      }`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 font-medium text-foreground">{label}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted-foreground" />
    </button>
  );
}
