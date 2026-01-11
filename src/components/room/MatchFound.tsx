'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { H1, Large, Muted } from '@/components/ui/typography';
import type { Movie } from '@/types/movie';

interface MatchFoundProps {
  movie: Movie;
}

// Pre-generated static heart animations to avoid Math.random() during render
const HEART_ANIMATIONS = [
  { x: 150, y: 600, scale: 0.7, duration: 3.5, delay: 0.1, repeatDelay: 1.5, left: '10%' },
  { x: -120, y: 600, scale: 0.9, duration: 2.8, delay: 0.3, repeatDelay: 1.8, left: '25%' },
  { x: 80, y: 600, scale: 0.6, duration: 3.2, delay: 0.0, repeatDelay: 2.0, left: '40%' },
  { x: -180, y: 600, scale: 0.8, duration: 2.5, delay: 0.4, repeatDelay: 1.2, left: '55%' },
  { x: 100, y: 600, scale: 0.5, duration: 3.8, delay: 0.2, repeatDelay: 1.7, left: '70%' },
  { x: -50, y: 600, scale: 0.75, duration: 3.0, delay: 0.35, repeatDelay: 1.4, left: '85%' },
  { x: 170, y: 600, scale: 0.65, duration: 2.7, delay: 0.15, repeatDelay: 1.9, left: '15%' },
  { x: -140, y: 600, scale: 0.85, duration: 3.3, delay: 0.45, repeatDelay: 1.1, left: '35%' },
  { x: 60, y: 600, scale: 0.55, duration: 2.9, delay: 0.25, repeatDelay: 1.6, left: '60%' },
  { x: -90, y: 600, scale: 0.95, duration: 3.6, delay: 0.05, repeatDelay: 1.3, left: '80%' },
];

export function MatchFound({ movie }: MatchFoundProps) {
  const t = useTranslations('match');
  const locale = useLocale();
  const title = locale === 'ru' && movie.titleRu ? movie.titleRu : movie.title;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 p-6 text-center"
    >
      {/* Celebration animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        className="text-6xl"
      >
        🎉
      </motion.div>

      {/* Match text */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <H1 className="bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
          {t('found')}
        </H1>
      </motion.div>

      {/* Movie card */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative w-[200px] h-[300px] rounded-xl overflow-hidden shadow-2xl"
      >
        <Image
          src={movie.posterUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="200px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <Large className="text-white line-clamp-2">{title}</Large>
          <Muted className="text-gray-300">
            {movie.releaseDate && new Date(movie.releaseDate).getFullYear()}
          </Muted>
        </div>
      </motion.div>

      {/* Movie title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Large className="text-muted-foreground font-normal">
          {t('enjoy')}
        </Large>
      </motion.div>

      {/* Hearts decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {HEART_ANIMATIONS.map((heart, i) => (
          <motion.div
            key={i}
            initial={{
              x: heart.x,
              y: heart.y,
              opacity: 1,
              scale: heart.scale,
            }}
            animate={{
              y: -100,
              opacity: 0,
            }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              repeat: Infinity,
              repeatDelay: heart.repeatDelay,
            }}
            className="absolute text-2xl"
            style={{ left: heart.left }}
          >
            ❤️
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
