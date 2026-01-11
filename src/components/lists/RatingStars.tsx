'use client';

import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon } from '@hugeicons/core-free-icons';

interface RatingStarsProps {
  rating: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: 24,
  md: 36,
  lg: 48,
};

export function RatingStars({
  rating,
  onChange,
  readonly = false,
  size = 'md',
}: RatingStarsProps) {
  const iconSize = sizeConfig[size];

  const handleClick = (newRating: number) => {
    if (readonly || !onChange) return;

    // Toggle off if clicking same rating
    if (rating === newRating) {
      onChange(0);
    } else {
      onChange(newRating);
    }
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((star) => {
        const isActive = rating !== null && star <= rating;
        return (
          <motion.button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={readonly}
            className={`transition-transform ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
            whileTap={readonly ? {} : { scale: 0.9 }}
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={iconSize}
              className={isActive ? 'text-yellow-400' : 'text-muted-foreground/20'}
              fill="currentColor"
              strokeWidth={0}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

// Compact display version
export function RatingBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
      {[1, 2, 3].map((star) => (
        <HugeiconsIcon
          key={star}
          icon={StarIcon}
          size={12}
          className={star <= rating ? 'text-yellow-400' : 'text-muted-foreground/40'}
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
    </span>
  );
}
