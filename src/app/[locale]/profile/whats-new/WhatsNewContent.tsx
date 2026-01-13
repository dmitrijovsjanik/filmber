'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { ReleaseList } from '@/components/changelog';
import { Button } from '@/components/ui/button';
import { H4 } from '@/components/ui/typography';
import { ScrollFadeContainer } from '@/components/ui/ScrollFadeContainer';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { ChangelogRelease } from '@/lib/changelog/types';

interface WhatsNewContentProps {
  releases: ChangelogRelease[];
}

export function WhatsNewContent({ releases }: WhatsNewContentProps) {
  const t = useTranslations('changelog');
  const router = useRouter();

  return (
    <AuthGuard>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <header className="flex items-center gap-4 p-4 pb-2">
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

        {/* Scrollable Content */}
        <ScrollFadeContainer className="flex-1" innerClassName="px-4 pb-4">
          <div className="mx-auto max-w-md">
            <ReleaseList releases={releases} />
          </div>
        </ScrollFadeContainer>
      </div>
    </AuthGuard>
  );
}
