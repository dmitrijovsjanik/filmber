'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useAuthToken } from '@/stores/authStore';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { ArrowLeft, Film } from 'lucide-react';

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
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <header className="mb-6 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">
              {t('title', { defaultValue: 'Notifications' })}
            </h1>
          </header>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bot Messages Section */}
              <section>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {t('botMessages', { defaultValue: 'Bot Messages' })}
                </h2>

                <Card>
                  <CardContent className="p-0">
                    <ToggleItem
                      icon={<Film className="h-5 w-5" />}
                      title={t('watchReminders', { defaultValue: 'Watch reminders' })}
                      description={t('watchRemindersDesc', {
                        defaultValue: 'Remind me to rate movies after watching',
                      })}
                      enabled={settings.watchReminders}
                      onChange={() => handleToggle('watchReminders')}
                      disabled={isSaving}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Info */}
              <p className="text-center text-sm text-muted-foreground">
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
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-muted-foreground">{icon}</span>
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
