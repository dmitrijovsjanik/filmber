'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ProfilePageLayout } from '@/components/layout/ProfilePageLayout';
import { useAuthToken } from '@/stores/authStore';
import { useNotificationsStore, type NotificationSettings } from '@/stores/notificationsStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Small, Muted } from '@/components/ui/typography';

interface NotificationsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsOverlay({ isOpen, onClose }: NotificationsOverlayProps) {
  const t = useTranslations('notifications');
  const token = useAuthToken();
  const { trackNotificationsToggle } = useAnalytics();

  const {
    watchReminders,
    upcomingAnnouncements,
    upcomingTheatricalReleases,
    upcomingDigitalReleases,
    seriesSeasonAnnouncements,
    seriesEpisodeReleases,
    appUpdates,
    isLoaded,
    isLoading,
    hasHydrated,
    loadSettings,
    updateSettings,
  } = useNotificationsStore();

  // Load settings when opened
  useEffect(() => {
    if (!isOpen || !token) return;
    // If hydrated and has cached data, show it immediately
    // loadSettings will skip fetch if cache is valid
    if (hasHydrated) {
      loadSettings(token);
    }
  }, [isOpen, token, hasHydrated, loadSettings]);

  const handleToggle = async (key: keyof NotificationSettings, currentValue: boolean) => {
    if (!token) return;
    const newValue = !currentValue;
    await updateSettings(token, { [key]: newValue });
    if (key === 'watchReminders') {
      trackNotificationsToggle(newValue);
    }
  };

  // Show skeleton only on initial load (no cached data)
  const showSkeleton = !hasHydrated || (!isLoaded && isLoading);

  return (
    <ProfilePageLayout
      title={t('title', { defaultValue: 'Notifications' })}
      isOpen={isOpen}
      onClose={onClose}
    >
      {showSkeleton ? (
        <NotificationsSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Bot Messages Section */}
          <section>
            <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
              {t('botMessages', { defaultValue: 'Bot Messages' })}
            </Small>

            <div className="overflow-hidden rounded-xl bg-muted/50">
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('watchReminders', { defaultValue: 'Watch reminders' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('watchRemindersDesc', {
                      defaultValue: 'Remind me to rate movies after watching',
                    })}
                  </p>
                </div>
                <Switch
                  checked={watchReminders}
                  onCheckedChange={() => handleToggle('watchReminders', watchReminders)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* Upcoming Movies Section */}
          <section>
            <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
              {t('upcomingMovies', { defaultValue: 'Upcoming Movies' })}
            </Small>

            <div className="divide-y divide-border overflow-hidden rounded-xl bg-muted/50">
              {/* Announcements */}
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('announcements', { defaultValue: 'New movie announcements' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('announcementsDesc', {
                      defaultValue: 'Get notified when new anticipated movies are added',
                    })}
                  </p>
                </div>
                <Switch
                  checked={upcomingAnnouncements}
                  onCheckedChange={() => handleToggle('upcomingAnnouncements', upcomingAnnouncements)}
                  disabled={isLoading}
                />
              </div>

              {/* Theatrical Releases */}
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('theatricalReleases', { defaultValue: 'Theatrical releases' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('theatricalReleasesDesc', {
                      defaultValue: 'Get notified when movies hit theaters',
                    })}
                  </p>
                </div>
                <Switch
                  checked={upcomingTheatricalReleases}
                  onCheckedChange={() => handleToggle('upcomingTheatricalReleases', upcomingTheatricalReleases)}
                  disabled={isLoading}
                />
              </div>

              {/* Digital Releases */}
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('digitalReleases', { defaultValue: 'Digital releases' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('digitalReleasesDesc', {
                      defaultValue: 'Get notified when movies become available online',
                    })}
                  </p>
                </div>
                <Switch
                  checked={upcomingDigitalReleases}
                  onCheckedChange={() => handleToggle('upcomingDigitalReleases', upcomingDigitalReleases)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* TV Series Section */}
          <section>
            <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
              {t('tvSeries', { defaultValue: 'TV Series' })}
            </Small>

            <div className="divide-y divide-border overflow-hidden rounded-xl bg-muted/50">
              {/* Season Announcements */}
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('seasonAnnouncements', { defaultValue: 'New seasons' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('seasonAnnouncementsDesc', {
                      defaultValue: 'Get notified when new seasons are available for your watched series',
                    })}
                  </p>
                </div>
                <Switch
                  checked={seriesSeasonAnnouncements}
                  onCheckedChange={() => handleToggle('seriesSeasonAnnouncements', seriesSeasonAnnouncements)}
                  disabled={isLoading}
                />
              </div>

              {/* Episode Releases */}
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('episodeReleases', { defaultValue: 'New episodes' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('episodeReleasesDesc', {
                      defaultValue: 'Get notified when new episodes are released (with dubbing delay)',
                    })}
                  </p>
                </div>
                <Switch
                  checked={seriesEpisodeReleases}
                  onCheckedChange={() => handleToggle('seriesEpisodeReleases', seriesEpisodeReleases)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* App Updates Section */}
          <section>
            <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
              {t('appUpdatesSection', { defaultValue: 'App Updates' })}
            </Small>

            <div className="overflow-hidden rounded-xl bg-muted/50">
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {t('appUpdates', { defaultValue: 'Release notes' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('appUpdatesDesc', {
                      defaultValue: 'Get notified about new app versions and features',
                    })}
                  </p>
                </div>
                <Switch
                  checked={appUpdates}
                  onCheckedChange={() => handleToggle('appUpdates', appUpdates)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </section>

          {/* Info */}
          <Muted className="block text-center">
            {t('info', {
              defaultValue:
                'Notifications are sent via Telegram bot. Make sure you have started the bot.',
            })}
          </Muted>
        </div>
      )}
    </ProfilePageLayout>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Bot Messages Section Skeleton */}
      <section>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="overflow-hidden rounded-xl bg-muted/50">
          <div className="flex min-h-12 items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      </section>

      {/* Upcoming Movies Section Skeleton */}
      <section>
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-muted/50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-52" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* TV Series Section Skeleton */}
      <section>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-muted/50">
          {[1, 2].map((i) => (
            <div key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* App Updates Section Skeleton */}
      <section>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="overflow-hidden rounded-xl bg-muted/50">
          <div className="flex min-h-12 items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      </section>

      <Skeleton className="mx-auto h-4 w-64" />
    </div>
  );
}
