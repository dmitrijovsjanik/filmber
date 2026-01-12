'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AuthGuard } from '@/components/auth';
import { useUser } from '@/stores/authStore';
import { ReferralSection } from '@/components/referral';
import { H3, Muted } from '@/components/ui/typography';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, LanguageSquareIcon, Notification01Icon, Settings02Icon, Tick02Icon, FavouriteIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { localeNames, type Locale } from '@/i18n/config';
import { useLocaleSwitch } from '@/contexts/LocaleSwitchContext';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const locale = useLocale();
  const router = useRouter();
  const user = useUser();
  const { switchLocale: globalSwitchLocale } = useLocaleSwitch();
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === locale) return;
    globalSwitchLocale(newLocale as Locale);
    setIsLanguageSheetOpen(false);
  };

  return (
    <AuthGuard>
      <div className="flex-1 bg-background p-4 overflow-y-auto overscroll-contain">
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
            <button
              onClick={() => setIsLanguageSheetOpen(true)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            >
              <span className="text-muted-foreground">
                <HugeiconsIcon icon={LanguageSquareIcon} size={20} />
              </span>
              <span className="flex-1 font-medium text-foreground">
                {t('language', { defaultValue: 'Language' })}
              </span>
              <span className="text-sm text-muted-foreground">
                {localeNames[locale as Locale]}
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted-foreground" />
            </button>
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

          {/* Support Button */}
          <Button
            asChild
            className="mt-4 h-12 w-full bg-[#FF5204]/15 text-base font-medium text-[#FF5204] hover:bg-[#FF5204]/25"
          >
            <a
              href="https://boosty.to/ovsjanik/donate"
              target="_blank"
              rel="noopener noreferrer"
            >
              <HugeiconsIcon icon={FavouriteIcon} size={24} className="!size-6" />
              {t('support')}
            </a>
          </Button>

          {/* Version & Copyright */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Filmber ver {process.env.NEXT_PUBLIC_BUILD_ID} • © {t('copyright')}
            <br />
            {t('madeWith')} ❤️{' '}
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

      {/* Language Sheet */}
      <Sheet open={isLanguageSheetOpen} onOpenChange={setIsLanguageSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>{t('language', { defaultValue: 'Language' })}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {Object.entries(localeNames).map(([loc, name]) => (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span className="font-medium text-foreground">{name}</span>
                {locale === loc && (
                  <HugeiconsIcon icon={Tick02Icon} size={20} className="text-primary" />
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
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
