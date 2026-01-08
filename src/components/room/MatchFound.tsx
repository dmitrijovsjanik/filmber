'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import type { Movie } from '@/types/movie';

interface MatchFoundProps {
  movie: Movie;
  locale?: string;
}

export function MatchFound({ movie, locale = 'en' }: MatchFoundProps) {
  const title = locale === 'ru' && movie.titleRu ? movie.titleRu : movie.title;

  const t = {
    match: locale === 'ru' ? 'Совпадение!' : "It's a Match!",
    enjoy: locale === 'ru' ? 'Приятного просмотра!' : 'Enjoy watching together!',
  };

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
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent"
      >
        {t.match}
      </motion.h1>

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
          <h3 className="text-lg font-bold text-white line-clamp-2">{title}</h3>
          <p className="text-sm text-gray-300">
            {movie.releaseDate && new Date(movie.releaseDate).getFullYear()}
          </p>
        </div>
      </motion.div>

      {/* Movie title */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-lg text-gray-600 dark:text-gray-300"
      >
        {t.enjoy}
      </motion.p>

      {/* Hearts decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * 400 - 200,
              y: 600,
              opacity: 1,
              scale: Math.random() * 0.5 + 0.5,
            }}
            animate={{
              y: -100,
              opacity: 0,
            }}
            transition={{
              duration: Math.random() * 2 + 2,
              delay: Math.random() * 0.5,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
            className="absolute text-2xl"
            style={{ left: `${Math.random() * 100}%` }}
          >
            ❤️
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
