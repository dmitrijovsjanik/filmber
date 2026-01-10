'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useAuthToken } from '@/stores/authStore';
import { Switch } from '@/components/ui/Switch';

interface NotificationSettings {
  watchReminders: boolean;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const token = useAuthToken();

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
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <header className="mb-6 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-white transition-colors hover:bg-gray-700"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-white">
              {t('title', { defaultValue: 'Notifications' })}
            </h1>
          </header>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bot Messages Section */}
              <section>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
                  {t('botMessages', { defaultValue: 'Bot Messages' })}
                </h2>

                <div className="overflow-hidden rounded-xl bg-gray-800/50">
                  <ToggleItem
                    icon="🎬"
                    title={t('watchReminders', { defaultValue: 'Watch reminders' })}
                    description={t('watchRemindersDesc', {
                      defaultValue: 'Remind me to rate movies after watching',
                    })}
                    enabled={settings.watchReminders}
                    onChange={(value) => handleToggle('watchReminders')}
                    disabled={isSaving}
                  />
                </div>
              </section>

              {/* Info */}
              <p className="text-center text-sm text-gray-500">
                {t('info', {
                  defaultValue:
                    'Notifications are sent via Telegram bot. Make sure you have started the bot.',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function ToggleItem({
  icon,
  title,
  description,
  enabled,
  onChange,
  disabled,
}: {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onChange={onChange}
        disabled={disabled}
        size="md"
      />
    </div>
  );
}
