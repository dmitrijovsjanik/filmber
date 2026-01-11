'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { useDeckSettingsStore } from '@/stores/deckSettingsStore';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { H4, Small, Muted } from '@/components/ui/typography';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

export default function DeckSettingsPage() {
  const t = useTranslations('deckSettings');
  const router = useRouter();
  const { showWatchedMovies, isLoaded, isLoading, loadSettings, updateSettings } =
    useDeckSettingsStore();

  useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  const handleToggleWatched = async (checked: boolean) => {
    await updateSettings({ showWatchedMovies: checked });
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
            <H4 className="text-foreground">{t('title')}</H4>
          </header>

          {!isLoaded ? (
            <div className="flex h-40 items-center justify-center">
              <Loader size="lg" />
            </div>
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
        </div>
      </div>
    </AuthGuard>
  );
}
