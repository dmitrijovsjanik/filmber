'use client';

import { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ProfilePageLayout } from '@/components/layout/ProfilePageLayout';
import { ReleaseList } from '@/components/changelog';
import { useChangelogStore } from '@/stores/changelogStore';
import { Skeleton } from '@/components/ui/skeleton';

interface WhatsNewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsNewOverlay({ isOpen, onClose }: WhatsNewOverlayProps) {
  const t = useTranslations('changelog');
  const locale = useLocale();
  const { releases, isLoaded, isLoading, hasHydrated, loadChangelog } = useChangelogStore();

  useEffect(() => {
    if (isOpen && hasHydrated) {
      loadChangelog(locale);
    }
  }, [isOpen, hasHydrated, locale, loadChangelog]);

  // Show skeleton only on initial load
  const showSkeleton = !hasHydrated || (!isLoaded && isLoading);

  return (
    <ProfilePageLayout
      title={t('title')}
      isOpen={isOpen}
      onClose={onClose}
    >
      {showSkeleton ? (
        <ChangelogSkeleton />
      ) : (
        <ReleaseList releases={releases} />
      )}
    </ProfilePageLayout>
  );
}

function ChangelogSkeleton() {
  return (
    <div className="space-y-6">
      {/* Release 1 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="space-y-2 pl-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>

      {/* Release 2 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2 pl-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      {/* Release 3 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 pl-4">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
