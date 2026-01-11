'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useAuthToken } from '@/stores/authStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { H4, Small, Muted } from '@/components/ui/typography';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

interface NotificationSettings {
  watchReminders: boolean;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const token = useAuthToken();
  const { trackNotificationsToggle } = useAnalytics();

  const [settings, setSettings] = useState<NotificationSettings>({
    watchReminders: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (!token) return;

    fetch('/api/notifications/settings', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.watchReminders !== undefined) {
          setSettings({ watchReminders: data.watchReminders });
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleToggle = async (key: keyof NotificationSettings) => {
    if (!token) return;

    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    setIsSaving(true);

    try {
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: newValue }),
      });
      trackNotificationsToggle(newValue);
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex-1 bg-background p-4">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <header className="mb-6 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10 rounded-full"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </Button>
            <H4 className="text-foreground">
              {t('title', { defaultValue: 'Notifications' })}
            </H4>
          </header>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bot Messages Section */}
              <section>
                <Small className="mb-3 block uppercase tracking-wider text-muted-foreground">
                  {t('botMessages', { defaultValue: 'Bot Messages' })}
                </Small>

                <div className="overflow-hidden rounded-xl bg-muted/50">
                  <ToggleItem
                    title={t('watchReminders', { defaultValue: 'Watch reminders' })}
                    description={t('watchRemindersDesc', {
                      defaultValue: 'Remind me to rate movies after watching',
                    })}
                    enabled={settings.watchReminders}
                    onChange={() => handleToggle('watchReminders')}
                    disabled={isSaving}
                  />
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
        </div>
      </div>
    </AuthGuard>
  );
}

function ToggleItem({
  title,
  description,
  enabled,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
