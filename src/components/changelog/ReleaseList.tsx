'use client';

import { useTranslations } from 'next-intl';
import { ReleaseCard } from './ReleaseCard';
import { ChangelogRelease } from '@/lib/changelog/types';
import { Muted } from '@/components/ui/typography';

interface ReleaseListProps {
  releases: ChangelogRelease[];
}

export function ReleaseList({ releases }: ReleaseListProps) {
  const t = useTranslations('changelog');

  if (releases.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Muted>{t('noChanges')}</Muted>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {releases.map((release, index) => (
        <ReleaseCard
          key={release.version}
          release={release}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}
