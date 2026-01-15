'use client';

import { useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { H3, H4, Small } from '@/components/ui/typography';
import { MovieBadges } from '@/components/molecules/MovieBadges';
import { calculateAverageRating } from '@/lib/utils/rating';
import { translateGenres } from '@/lib/genres';
import type { Movie } from '@/types/movie';

import 'overlayscrollbars/overlayscrollbars.css';

// Stack depth configuration
const STACK_CONFIG = {
  scaleDecrement: 0.04,  // Each card behind is 4% smaller
  yOffset: 10,           // Each card behind is 10px lower
};

interface MovieCardProps {
  movie: Movie;
  onSwipe: (direction: 'left' | 'right', movieId: number) => void;
  isTop?: boolean;
  locale?: string;
  stackIndex?: number; // 0 = top card, 1 = second, 2 = third
}

export interface MovieCardRef {
  swipe: (direction: 'left' | 'right') => void;
}

export const MovieCard = forwardRef<MovieCardRef, MovieCardProps>(function MovieCard(
  { movie, onSwipe, isTop = false, locale = 'en', stackIndex = 0 },
  ref
) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  // Overlay opacity for like/skip indicators
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Calculate stack transforms
  const stackScale = 1 - (stackIndex * STACK_CONFIG.scaleDecrement);
  const stackY = stackIndex * STACK_CONFIG.yOffset;

  const title = locale === 'ru' && movie.titleRu ? movie.titleRu : movie.title;
  const overview =
    locale === 'ru' && movie.overviewRu ? movie.overviewRu : movie.overview;
  const genres = translateGenres(movie.genres, locale);
  const averageRating = calculateAverageRating(movie.ratings);

  // Use ref to always have latest onSwipe callback
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  // Animate swipe for button clicks (with blocking)
  const animateSwipe = async (direction: 'left' | 'right') => {
    if (isSwiping) return; // Already swiping - ignore repeated clicks

    setIsSwiping(true);
    setExitDirection(direction);
    const targetX = direction === 'right' ? 150 : -150;
    await animate(x, targetX, { duration: 0.15, ease: 'easeOut' });
    onSwipeRef.current(direction, movie.tmdbId);
  };

  // Expose swipe method via ref for button clicks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({ swipe: animateSwipe }), [movie.tmdbId, isSwiping]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (isSwiping) return; // Already swiping - ignore

    const threshold = 100;
    if (info.offset.x > threshold) {
      setIsSwiping(true);
      setExitDirection('right');
      onSwipeRef.current('right', movie.tmdbId);
    } else if (info.offset.x < -threshold) {
      setIsSwiping(true);
      setExitDirection('left');
      onSwipeRef.current('left', movie.tmdbId);
    }
  };

  return (
    <motion.div
      className="absolute left-0 right-0 top-0 bottom-0 cursor-grab active:cursor-grabbing touch-none origin-bottom"
      style={{ x, rotate, opacity }}
      initial={{
        scale: stackScale - 0.05,
        y: stackY + 40,
        opacity: 0,
      }}
      animate={{
        scale: stackScale,
        y: stackY,
        opacity: stackIndex === 0 ? 1 : 0.95,
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      }}
      exit={{
        x: exitDirection === 'right' ? 500 : -500,
        y: -50,
        rotate: exitDirection === 'right' ? 25 : -25,
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
    >
      <div
        className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-900 transition-shadow duration-300"
        style={{
          boxShadow: stackIndex === 0
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : `0 ${15 - stackIndex * 5}px ${30 - stackIndex * 10}px -12px rgba(0, 0, 0, ${0.3 - stackIndex * 0.1})`,
        }}
      >
        {/* Poster */}
        <Image
          src={movie.posterUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 372px) calc(100vw - 32px), 340px"
          priority={isTop}
          draggable={false}
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

        {/* Stack depth overlay - white tint for cards behind the top one (must be after gradient) */}
        <motion.div
          className="absolute inset-0 bg-white pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: stackIndex === 0 ? 0 : stackIndex === 1 ? 0.08 : 0.18 }}
          transition={{ duration: 0.3 }}
        />

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

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0 items-center">
                <MovieBadges
                  variant="card"
                  mediaType={movie.mediaType}
                  releaseDate={movie.releaseDate}
                  runtime={movie.runtime}
                  numberOfSeasons={movie.numberOfSeasons}
                  numberOfEpisodes={movie.numberOfEpisodes}
                  genres={genres}
                  averageRating={averageRating}
                  showMediaType={movie.mediaType === 'tv'}
                />
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

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-3 items-center">
            <MovieBadges
              variant="card"
              mediaType={movie.mediaType}
              releaseDate={movie.releaseDate}
              runtime={movie.runtime}
              numberOfSeasons={movie.numberOfSeasons}
              numberOfEpisodes={movie.numberOfEpisodes}
              genres={genres}
              averageRating={averageRating}
              showMediaType={movie.mediaType === 'tv'}
            />
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
