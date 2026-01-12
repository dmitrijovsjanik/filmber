'use client';

import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

interface MovieListSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MovieListSearchBar({
  value,
  onChange,
  placeholder,
}: MovieListSearchBarProps) {
  const t = useTranslations('lists');

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder || t('searchPlaceholder', { defaultValue: 'Search movies...' })}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="min-h-12 w-full rounded-xl border border-input bg-background px-4 py-3 pl-10 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:border-primary"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <HugeiconsIcon icon={Search01Icon} size={20} />
      </span>
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={20} />
        </button>
      )}
    </div>
  );
}
