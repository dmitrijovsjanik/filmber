'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ProfilePageLayout } from '@/components/layout/ProfilePageLayout';
import { useDeckSettingsStore } from '@/stores/deckSettingsStore';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Small, Muted } from '@/components/ui/typography';

interface DeckSettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeckSettingsOverlay({ isOpen, onClose }: DeckSettingsOverlayProps) {
  const t = useTranslations('deckSettings');
  const { showWatchedMovies, isLoaded, isLoading, hasHydrated, loadSettings, updateSettings } =
    useDeckSettingsStore();

  useEffect(() => {
    if (isOpen && hasHydrated) {
      loadSettings();
    }
  }, [isOpen, hasHydrated, loadSettings]);

  const handleToggleWatched = async (checked: boolean) => {
    await updateSettings({ showWatchedMovies: checked });
  };

  // Show skeleton only on initial load
  const showSkeleton = !hasHydrated || (!isLoaded && isLoading);

  return (
    <ProfilePageLayout
      title={t('title')}
      isOpen={isOpen}
      onClose={onClose}
    >
      {showSkeleton ? (
        <DeckSettingsSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Partner Recommendations Section */}
          <section>
            <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
              {t('sectionPartner')}
            </Small>

            <div className="overflow-hidden rounded-xl bg-muted/50">
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{t('showWatched')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('showWatchedDescription')}
                  </p>
                </div>
                <Switch
                  checked={showWatchedMovies}
                  onCheckedChange={handleToggleWatched}
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* Info */}
          <Muted className="block text-center">{t('info')}</Muted>
        </div>
      )}
    </ProfilePageLayout>
  );
}

function DeckSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <section>
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="overflow-hidden rounded-xl bg-muted/50">
          <div className="flex min-h-12 items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      </section>
      <Skeleton className="mx-auto h-4 w-48" />
    </div>
  );
}
