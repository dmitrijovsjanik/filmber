'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserAdd01Icon } from '@hugeicons/core-free-icons';
import { useAuthToken } from '@/stores/authStore';
import { useReferralStore } from '@/stores/referralStore';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Button } from '@/components/ui/button';
import { Muted } from '@/components/ui/typography';

export function ReferralSection() {
  const t = useTranslations('referral');
  const token = useAuthToken();
  const { webApp } = useTelegramWebApp();
  const { trackReferralInvite } = useAnalytics();

  const {
    stats,
    hasHydrated,
    isLoading,
    setStats,
    setLoading,
    isCacheValid,
  } = useReferralStore();

  useEffect(() => {
    if (!hasHydrated || !token) return;

    // If cache is valid, skip fetch
    if (isCacheValid()) return;

    setLoading(true);
    fetch('/api/referrals', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hasHydrated, token, isCacheValid, setStats, setLoading]);

  const handleInvite = () => {
    if (!stats?.referralLink) return;

    trackReferralInvite();
    const text = t('shareText');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${encodeURIComponent(text)}`;

    if (webApp) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  // Show skeleton only if no cached data AND loading
  if (!stats && (isLoading || !hasHydrated)) {
    return <div className="animate-pulse h-14 bg-muted/50 rounded-xl" />;
  }

  if (!stats || !stats.referralLink) return null;

  return (
    <div className="text-center">
      <Button
        onClick={handleInvite}
        variant="gradient"
        className="w-full"
        size="lg"
      >
        <HugeiconsIcon icon={UserAdd01Icon} size={24} />
        {t('inviteButton')}
      </Button>
      <Muted className="mt-2 text-sm">{t('inviteHint')}</Muted>
    </div>
  );
}
