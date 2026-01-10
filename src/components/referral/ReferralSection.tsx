'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthToken } from '@/stores/authStore';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

interface Referral {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  referredAt: string;
}

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  referrals: Referral[];
}

export function ReferralSection() {
  const t = useTranslations('referral');
  const token = useAuthToken();
  const { webApp } = useTelegramWebApp();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAllReferrals, setShowAllReferrals] = useState(false);

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

  const handleCopy = async () => {
    if (!stats?.referralLink) return;

    try {
      await navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleShare = () => {
    if (!stats?.referralLink) return;

    const text = t('shareText');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${encodeURIComponent(text)}`;

    if (webApp) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-gray-800/50 rounded-xl" />;
  }

  if (!stats || !stats.referralLink) return null;

  const displayedReferrals = showAllReferrals
    ? stats.referrals
    : stats.referrals.slice(0, 5);

  return (
    <div className="rounded-xl bg-gray-800/50 p-4">
      {/* Header */}
      <h2 className="text-lg font-semibold text-white mb-4">
        {t('title')}
      </h2>

      {/* Stats */}
      <div className="flex items-center justify-center mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400">
            {stats.totalReferrals}
          </div>
          <div className="text-sm text-gray-400">{t('friendsInvited')}</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-900/50 p-3">
          <input
            type="text"
            value={stats.referralLink}
            readOnly
            className="flex-1 bg-transparent text-sm text-gray-300 outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-gray-700 text-sm text-white hover:bg-gray-600 transition-colors"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
      >
        <span>📤</span>
        {t('shareButton')}
      </button>

      {/* Referrals List */}
      {stats.referrals.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {t('yourReferrals')}
          </h3>
          <div className="space-y-2">
            {displayedReferrals.map((referral) => (
              <ReferralItem key={referral.id} referral={referral} />
            ))}
          </div>

          {stats.referrals.length > 5 && !showAllReferrals && (
            <button
              onClick={() => setShowAllReferrals(true)}
              className="w-full mt-3 py-2 text-sm text-emerald-400 hover:text-emerald-300"
            >
              {t('showAll').replace('{count}', String(stats.totalReferrals))}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReferralItem({ referral }: { referral: Referral }) {
  const displayName = [referral.firstName, referral.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/30">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center overflow-hidden">
        {referral.photoUrl ? (
          <img
            src={referral.photoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white font-medium">
            {referral.firstName[0]?.toUpperCase()}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">{displayName}</div>
        {referral.username && (
          <div className="text-sm text-gray-400 truncate">
            @{referral.username}
          </div>
        )}
      </div>
    </div>
  );
}
