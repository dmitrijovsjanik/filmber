'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Muted } from '@/components/ui/typography';
import type { TMDBSeason, TMDBEpisode } from '@/types/movie';

interface SeasonsAccordionProps {
  tvId: number;
  numberOfSeasons: number;
}

interface SeasonData {
  season: TMDBSeason;
  loading: boolean;
  error: boolean;
}

export function SeasonsAccordion({ tvId, numberOfSeasons }: SeasonsAccordionProps) {
  const t = useTranslations('seasons');
  const locale = useLocale();
  const [seasonsData, setSeasonsData] = useState<Record<number, SeasonData>>({});

  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [locale]);

  const loadSeason = useCallback(async (seasonNumber: number) => {
    if (seasonsData[seasonNumber]?.season || seasonsData[seasonNumber]?.loading) {
      return;
    }

    setSeasonsData(prev => ({
      ...prev,
      [seasonNumber]: { season: {} as TMDBSeason, loading: true, error: false },
    }));

    try {
      const response = await fetch(`/api/tv/${tvId}/season/${seasonNumber}?locale=${locale}`);
      if (!response.ok) throw new Error('Failed to fetch season');
      const data = await response.json();

      setSeasonsData(prev => ({
        ...prev,
        [seasonNumber]: { season: data.season, loading: false, error: false },
      }));
    } catch (error) {
      console.error('Failed to load season:', error);
      setSeasonsData(prev => ({
        ...prev,
        [seasonNumber]: { season: {} as TMDBSeason, loading: false, error: true },
      }));
    }
  }, [tvId, locale, seasonsData]);

  const handleValueChange = useCallback((value: string) => {
    if (value) {
      const seasonNumber = parseInt(value, 10);
      loadSeason(seasonNumber);
    }
  }, [loadSeason]);

  // Generate season numbers (1 to numberOfSeasons, add 0 for specials at the end if exists)
  const seasonNumbers = Array.from({ length: numberOfSeasons }, (_, i) => i + 1);

  if (numberOfSeasons === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <Muted className="text-xs uppercase tracking-wider mb-2">{t('title')}</Muted>
      <Accordion type="single" collapsible onValueChange={handleValueChange}>
        {seasonNumbers.map((seasonNum) => {
          const data = seasonsData[seasonNum];
          const isLoading = data?.loading;
          const hasError = data?.error;
          const season = data?.season;
          const episodes = season?.episodes || [];

          return (
            <AccordionItem key={seasonNum} value={String(seasonNum)}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <span>
                  {t('season', { number: seasonNum })}
                  {season?.episode_count && (
                    <span className="ml-2 text-muted-foreground">
                      {t('episodeCount', { count: season.episode_count })}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {isLoading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                )}

                {hasError && (
                  <Muted className="text-destructive">{t('loadError')}</Muted>
                )}

                {!isLoading && !hasError && episodes.length > 0 && (
                  <div className="space-y-1">
                    {episodes.map((episode: TMDBEpisode) => (
                      <div
                        key={episode.episode_number}
                        className="flex items-start gap-2 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground w-6 flex-shrink-0">
                          {episode.episode_number}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="line-clamp-1">{episode.name}</span>
                          {episode.air_date && (
                            <Muted className="text-xs block">
                              {formatDate(episode.air_date)}
                            </Muted>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && !hasError && episodes.length === 0 && (
                  <Muted>{t('noEpisodes')}</Muted>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
