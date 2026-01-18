'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AuthGuard } from '@/components/auth';
import { useUser } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { ReferralSection } from '@/components/referral';
import {
  NotificationsOverlay,
  DeckSettingsOverlay,
  WhatsNewOverlay,
} from '@/components/profile';
import { H3, H4, Muted } from '@/components/ui/typography';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, LanguageSquareIcon, Notification01Icon, Settings02Icon, Tick02Icon, FavouriteIcon, SparklesIcon, User03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { FadeImage } from '@/components/ui/FadeImage';
import { localeNames, type Locale } from '@/i18n/config';
import { useLocaleSwitch } from '@/contexts/LocaleSwitchContext';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const user = useUser();
  const { isAuthenticated } = useAuth();
  const { switchLocale: globalSwitchLocale } = useLocaleSwitch();
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDeckSettingsOpen, setIsDeckSettingsOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === locale) return;
    globalSwitchLocale(newLocale as Locale);
    setIsLanguageSheetOpen(false);
  };

  const openTelegramBot = () => {
    const botUsername = 'filmberonline_bot';
    const url = `https://t.me/${botUsername}`;
    window.open(url, '_blank');
  };

  // Guest profile view
  if (!isAuthenticated) {
    return (
      <AuthGuard>
        <div className="flex-1 bg-background p-4 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-[280px]">
            {/* Header */}
            <header className="mb-8 text-center">
              {/* Avatar */}
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gray-400 to-gray-600">
                <HugeiconsIcon icon={User03Icon} size={48} className="text-white" />
              </div>

              {/* Name */}
              <H3 className="text-foreground">
                {tAuth('guestProfile', { defaultValue: 'Guest' })}
              </H3>
              <Muted className="mt-2 max-w-xs">
                {tAuth('guestProfileHint', {
                  defaultValue: 'Log in to save your movies and sync across devices',
                })}
              </Muted>
            </header>

            {/* Login Button */}
            <button
              onClick={openTelegramBot}
              className="min-h-12 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-[#0088cc] hover:bg-[#0077b5] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              {tAuth('loginButton', { defaultValue: 'Log in with Telegram' })}
            </button>

            {/* Auth benefits list */}
            <div className="mt-4 mb-8 space-y-2">
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={FavouriteIcon} size={18} className="text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tAuth('matchBenefitSave', { defaultValue: 'Save your favorite movies' })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={SparklesIcon} size={18} className="text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tAuth('matchBenefitPersonal', { defaultValue: 'Get personalized recommendations' })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={Notification01Icon} size={18} className="text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tAuth('matchBenefitNotify', { defaultValue: 'Get notified about new releases' })}
                </span>
              </div>
            </div>

            {/* Menu - language and what's new for guests */}
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
              <button
                onClick={() => setIsWhatsNewOpen(true)}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span className="text-muted-foreground">
                  <HugeiconsIcon icon={SparklesIcon} size={20} />
                </span>
                <span className="flex-1 font-medium text-foreground">
                  {t('whatsNew', { defaultValue: "What's New" })}
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted-foreground" />
              </button>
            </div>

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

        {/* What's New Overlay */}
        <WhatsNewOverlay
          isOpen={isWhatsNewOpen}
          onClose={() => setIsWhatsNewOpen(false)}
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex-1 bg-background p-4 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[280px]">
          {/* Header */}
          <header className="mb-8 text-center">
            {/* Avatar */}
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-blue-600">
              {user?.photoUrl ? (
                <FadeImage
                  src={user.photoUrl}
                  alt={user.firstName}
                  className="h-full w-full object-cover"
                  fallback={
                    <span className="text-4xl text-white">
                      {user?.firstName?.[0]?.toUpperCase() || '?'}
                    </span>
                  }
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
              onClick={() => setIsNotificationsOpen(true)}
              icon={<HugeiconsIcon icon={Notification01Icon} size={20} />}
              label={t('notifications', { defaultValue: 'Notifications' })}
            />
            <div className="mx-4 border-t border-border" />
            <MenuButton
              onClick={() => setIsDeckSettingsOpen(true)}
              icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
              label={t('deckSettings', { defaultValue: 'Deck Settings' })}
            />
            <div className="mx-4 border-t border-border" />
            <MenuButton
              onClick={() => setIsWhatsNewOpen(true)}
              icon={<HugeiconsIcon icon={SparklesIcon} size={20} />}
              label={t('whatsNew', { defaultValue: "What's New" })}
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

      {/* Profile Overlays */}
      <NotificationsOverlay
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
      <DeckSettingsOverlay
        isOpen={isDeckSettingsOpen}
        onClose={() => setIsDeckSettingsOpen(false)}
      />
      <WhatsNewOverlay
        isOpen={isWhatsNewOpen}
        onClose={() => setIsWhatsNewOpen(false)}
      />
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
