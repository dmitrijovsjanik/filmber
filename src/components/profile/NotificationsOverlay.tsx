'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ProfilePageLayout } from '@/components/layout/ProfilePageLayout';
import { useAuthToken } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
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

  const handleToggle = async () => {
    if (!token) return;
    const newValue = !watchReminders;
    await updateSettings(token, { watchReminders: newValue });
    trackNotificationsToggle(newValue);
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
                  onCheckedChange={handleToggle}
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
