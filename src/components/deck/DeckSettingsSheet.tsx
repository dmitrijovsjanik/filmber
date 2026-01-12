'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDeckSettingsStore } from '@/stores/deckSettingsStore';
import type { MediaTypeFilter } from '@/types/movie';

interface DeckSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeckSettingsSheet({ open, onOpenChange }: DeckSettingsSheetProps) {
  const t = useTranslations('deckSettings');
  const { mediaTypeFilter, isLoaded, loadSettings, updateSettings } = useDeckSettingsStore();

  useEffect(() => {
    if (open && !isLoaded) {
      loadSettings();
    }
  }, [open, isLoaded, loadSettings]);

  const handleMediaTypeChange = async (value: string) => {
    if (value && value !== mediaTypeFilter) {
      await updateSettings({ mediaTypeFilter: value as MediaTypeFilter });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          <p className="text-sm text-muted-foreground">
            {t('mediaTypeDescription')}
          </p>

          <ToggleGroup
            type="single"
            value={mediaTypeFilter}
            onValueChange={handleMediaTypeChange}
            className="justify-start"
          >
            <ToggleGroupItem value="all" className="px-4">
              {t('mediaTypeAll')}
            </ToggleGroupItem>
            <ToggleGroupItem value="movie" className="px-4">
              {t('mediaTypeMovie')}
            </ToggleGroupItem>
            <ToggleGroupItem value="tv" className="px-4">
              {t('mediaTypeTv')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
