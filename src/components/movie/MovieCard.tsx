'use client';

import { useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { RatingBadge } from './RatingBadge';
import type { Movie } from '@/types/movie';

import 'overlayscrollbars/overlayscrollbars.css';

interface MovieCardProps {
  movie: Movie;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop?: boolean;
  locale?: string;
}

export interface MovieCardRef {
  swipe: (direction: 'left' | 'right') => void;
}

export const MovieCard = forwardRef<MovieCardRef, MovieCardProps>(function MovieCard(
  { movie, onSwipe, isTop = false, locale = 'en' },
  ref
) {
  useEffect(() => {
    console.log('[MovieCard] mounted/updated', { movieId: movie.tmdbId, isTop, hasRef: !!ref });
  }, [movie.tmdbId, isTop, ref]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  // Overlay opacity for like/skip indicators
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);

  const [isExpanded, setIsExpanded] = useState(false);

  const title = locale === 'ru' && movie.titleRu ? movie.titleRu : movie.title;
  const overview =
    locale === 'ru' && movie.overviewRu ? movie.overviewRu : movie.overview;

  // Animate card flying off screen then trigger callback
  const animateSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      console.log('[MovieCard] animateSwipe called', { direction, movieId: movie.tmdbId, isTop });
      const targetX = direction === 'right' ? 400 : -400;

      try {
        console.log('[MovieCard] Starting animation, x current value:', x.get());
        await animate(x, targetX, {
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1]
        });
        console.log('[MovieCard] Animation complete, x final value:', x.get());
        onSwipe(direction);
      } catch (error) {
        console.error('[MovieCard] Animation error:', error);
      }
    },
    [x, onSwipe, movie.tmdbId, isTop]
  );

  // Expose swipe method via ref for button clicks
  useImperativeHandle(ref, () => {
    console.log('[MovieCard] useImperativeHandle called, exposing swipe for movie:', movie.tmdbId);
    return { swipe: animateSwipe };
  }, [animateSwipe, movie.tmdbId]);

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      await animateSwipe('right');
    } else if (info.offset.x < -threshold) {
      await animateSwipe('left');
    }
  };

  return (
    <motion.div
      className="absolute w-full max-w-[340px] cursor-grab active:cursor-grabbing touch-none"
      style={{ x, rotate, opacity }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
    >
      <div className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-gray-900 shadow-2xl">
        {/* Poster */}
        <Image
          src={movie.posterUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="340px"
          priority={isTop}
        />

        {/* Like overlay */}
        <motion.div
          className="absolute inset-0 bg-green-500/20 flex items-center justify-center pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <div className="border-4 border-green-500 rounded-lg px-4 py-2 rotate-[-20deg]">
            <span className="text-4xl font-bold text-green-500">LIKE</span>
          </div>
        </motion.div>

        {/* Skip overlay */}
        <motion.div
          className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none"
          style={{ opacity: skipOpacity }}
        >
          <div className="border-4 border-red-500 rounded-lg px-4 py-2 rotate-[20deg]">
            <span className="text-4xl font-bold text-red-500">SKIP</span>
          </div>
        </motion.div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

        {/* Expanded description overlay */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/80 flex flex-col p-4 z-10 rounded-2xl"
            >
              <h2 className="text-xl font-bold text-white mb-2 line-clamp-2 flex-shrink-0">
                {title}
              </h2>

              {/* Ratings row */}
              <div className="flex gap-2 mb-2 flex-wrap flex-shrink-0">
                <RatingBadge source="TMDB" value={movie.ratings.tmdb} />
                {movie.ratings.imdb && (
                  <RatingBadge source="IMDb" value={movie.ratings.imdb} />
                )}
                {movie.ratings.rottenTomatoes && (
                  <RatingBadge source="RT" value={movie.ratings.rottenTomatoes} />
                )}
              </div>

              {/* Genres + year + runtime */}
              <div className="flex flex-wrap gap-1 mb-3 flex-shrink-0 items-center">
                {movie.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white"
                  >
                    {genre}
                  </span>
                ))}
                {movie.releaseDate && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                    {new Date(movie.releaseDate).getFullYear()}
                  </span>
                )}
                {movie.runtime && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                    {movie.runtime} min
                  </span>
                )}
              </div>

              <OverlayScrollbarsComponent
                className="flex-1 text-sm text-gray-200"
                options={{
                  scrollbars: {
                    visibility: 'visible',
                    autoHide: 'never',
                    theme: 'os-theme-light'
                  }
                }}
              >
                <div className="pr-3">{overview}</div>
              </OverlayScrollbarsComponent>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-sm text-blue-400 mt-3 hover:text-blue-300 transition-colors flex-shrink-0 text-left"
              >
                Скрыть
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {!isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">
            {title}
          </h2>

          {/* Ratings row */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <RatingBadge source="TMDB" value={movie.ratings.tmdb} />
            {movie.ratings.imdb && (
              <RatingBadge source="IMDb" value={movie.ratings.imdb} />
            )}
            {movie.ratings.rottenTomatoes && (
              <RatingBadge source="RT" value={movie.ratings.rottenTomatoes} />
            )}
          </div>

          {/* Genres + year + runtime */}
          <div className="flex flex-wrap gap-1 mb-3 items-center">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white"
              >
                {genre}
              </span>
            ))}
            {movie.releaseDate && (
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                {new Date(movie.releaseDate).getFullYear()}
              </span>
            )}
            {movie.runtime && (
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                {movie.runtime} min
              </span>
            )}
          </div>

          {/* Overview (truncated) */}
          <p className="text-sm text-gray-200 line-clamp-3">{overview}</p>

          {/* Show more button */}
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-blue-400 mt-1 hover:text-blue-300 transition-colors"
          >
            Показать больше
          </button>
        </div>
        )}
      </div>
    </motion.div>
  );
});
