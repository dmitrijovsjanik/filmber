'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpDownIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { SortOption } from '@/types/movie';

const SORT_OPTIONS: SortOption[] = ['relevance', 'popularity', 'rating', 'date_desc', 'date_asc'];

interface SortMenuProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  disabled?: boolean;
}

export function SortMenu({ value, onChange, disabled = false }: SortMenuProps) {
  const t = useTranslations('search');
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback(
    (option: SortOption) => {
      onChange(option);
      setIsOpen(false);
    },
    [onChange]
  );

  const getSortLabel = (option: SortOption) => {
    const labels: Record<SortOption, string> = {
      relevance: t('sortRelevance'),
      popularity: t('sortPopularity'),
      rating: t('sortRating'),
      date_desc: t('sortNewest'),
      date_asc: t('sortOldest'),
    };
    return labels[option];
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          className={`h-9 w-9 ${
            value !== 'relevance'
              ? 'bg-pink-500 border-pink-500 hover:bg-pink-600 hover:border-pink-600'
              : ''
          }`}
        >
          <HugeiconsIcon
            icon={ArrowUpDownIcon}
            size={18}
            className={value !== 'relevance' ? 'text-white' : ''}
          />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('sortBy')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-1">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option}
              variant="ghost"
              onClick={() => handleChange(option)}
              className="flex items-center justify-between w-full h-12 px-3"
            >
              <span className={value === option ? 'font-medium' : 'font-normal'}>
                {getSortLabel(option)}
              </span>
              {value === option && (
                <HugeiconsIcon icon={Tick02Icon} size={16} className="text-primary" />
              )}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
