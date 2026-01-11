'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserAdd01Icon } from '@hugeicons/core-free-icons';
import { useAuthToken } from '@/stores/authStore';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { Button } from '@/components/ui/button';
import { Muted } from '@/components/ui/typography';

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
}

export function ReferralSection() {
  const t = useTranslations('referral');
  const token = useAuthToken();
  const { webApp } = useTelegramWebApp();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch('/api/referrals', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleInvite = () => {
    if (!stats?.referralLink) return;

    const text = t('shareText');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${encodeURIComponent(text)}`;

    if (webApp) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }

    toast.success(t('linkCopied'));
  };

  if (isLoading) {
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
