'use client';

import { useImperativeHandle, forwardRef, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { Badge } from '@/components/ui/badge';
import { H3, H4, Small } from '@/components/ui/typography';
import type { Movie } from '@/types/movie';

import 'overlayscrollbars/overlayscrollbars.css';

interface MovieCardProps {
  movie: Movie;
  onSwipe: (direction: 'left' | 'right', movieId: number) => void;
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

  // Use ref to always have latest onSwipe callback - update synchronously on every render
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe; // Always sync to latest

  // Animate card flying off screen then trigger callback
  const animateSwipe = async (direction: 'left' | 'right') => {
    const targetX = direction === 'right' ? 400 : -400;
    await animate(x, targetX, { duration: 0.3, ease: [0.4, 0, 0.2, 1] });
    onSwipeRef.current(direction, movie.tmdbId);
  };

  // Expose swipe method via ref for button clicks
  useImperativeHandle(ref, () => ({ swipe: animateSwipe }), [movie.tmdbId]);

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
              <H4 className="text-white mb-2 line-clamp-2 flex-shrink-0">
                {title}
              </H4>

              {/* All badges in one container */}
              <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0 items-center">
                {movie.releaseDate && (
                  <Badge className="bg-white/20 text-white border-transparent hover:bg-white/30">
                    {new Date(movie.releaseDate).getFullYear()}
                  </Badge>
                )}
                {movie.runtime && (
                  <Badge className="bg-white/20 text-white border-transparent hover:bg-white/30">
                    {movie.runtime} min
                  </Badge>
                )}
                {movie.genres.slice(0, 2).map((genre) => (
                  <Badge key={genre} className="bg-white/20 text-white border-transparent hover:bg-white/30">
                    {genre}
                  </Badge>
                ))}
                <Badge variant="tmdb">TMDB {movie.ratings.tmdb}</Badge>
                {movie.ratings.imdb && (
                  <Badge variant="imdb">IMDb {movie.ratings.imdb}</Badge>
                )}
                {movie.ratings.rottenTomatoes && (
                  <Badge variant="rt">RT {movie.ratings.rottenTomatoes}</Badge>
                )}
              </div>

              <OverlayScrollbarsComponent
                className="flex-1"
                options={{
                  scrollbars: {
                    visibility: 'visible',
                    autoHide: 'never',
                    theme: 'os-theme-light'
                  }
                }}
              >
                <Small className="pr-3 text-gray-200 leading-normal font-normal">{overview}</Small>
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
          <H3 className="text-white mb-2 line-clamp-2">
            {title}
          </H3>

          {/* All badges in one container */}
          <div className="flex flex-wrap gap-1.5 mb-3 items-center">
            {movie.releaseDate && (
              <Badge className="bg-white/20 text-white border-transparent hover:bg-white/30">
                {new Date(movie.releaseDate).getFullYear()}
              </Badge>
            )}
            {movie.runtime && (
              <Badge className="bg-white/20 text-white border-transparent hover:bg-white/30">
                {movie.runtime} min
              </Badge>
            )}
            {movie.genres.slice(0, 2).map((genre) => (
              <Badge key={genre} className="bg-white/20 text-white border-transparent hover:bg-white/30">
                {genre}
              </Badge>
            ))}
            <Badge variant="tmdb">TMDB {movie.ratings.tmdb}</Badge>
            {movie.ratings.imdb && (
              <Badge variant="imdb">IMDb {movie.ratings.imdb}</Badge>
            )}
            {movie.ratings.rottenTomatoes && (
              <Badge variant="rt">RT {movie.ratings.rottenTomatoes}</Badge>
            )}
          </div>

          {/* Overview (truncated) */}
          <Small className="text-gray-200 line-clamp-3 font-normal leading-normal">{overview}</Small>

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
