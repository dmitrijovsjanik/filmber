'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { ChangelogRelease, SectionType } from '@/lib/changelog/types';

interface ReleaseCardProps {
  release: ChangelogRelease;
  defaultOpen?: boolean;
}

const SECTION_ORDER: SectionType[] = [
  'added',
  'changed',
  'fixed',
  'removed',
  'deprecated',
  'security',
];

const SECTION_BADGE_VARIANTS: Record<SectionType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  added: 'default',
  changed: 'secondary',
  fixed: 'outline',
  removed: 'destructive',
  deprecated: 'secondary',
  security: 'destructive',
};

export function ReleaseCard({ release, defaultOpen = false }: ReleaseCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const t = useTranslations('changelog');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const sectionsWithContent = SECTION_ORDER.filter(
    (section) => release.sections[section]?.length
  );

  return (
    <Card className="overflow-hidden bg-accent/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-foreground">
            {release.title || `v${release.version}`}
          </span>
          <span className="text-sm text-muted-foreground">
            v{release.version} • {formatDate(release.date)}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={20}
            className="text-muted-foreground"
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="space-y-3 px-4 py-4">
              {sectionsWithContent.map((sectionType) => {
                const items = release.sections[sectionType]!;
                return (
                  <div key={sectionType}>
                    <Badge
                      variant={SECTION_BADGE_VARIANTS[sectionType]}
                      className="mb-1.5"
                    >
                      {t(sectionType)}
                    </Badge>
                    <ul className="space-y-1">
                      {items.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
