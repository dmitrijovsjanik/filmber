'use client';

import { motion } from 'framer-motion';

interface RatingStarsProps {
  rating: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function RatingStars({
  rating,
  onChange,
  readonly = false,
  size = 'md',
}: RatingStarsProps) {
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
      {[1, 2, 3].map((star) => (
        <motion.button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          disabled={readonly}
          className={`${sizeClasses[size]} transition-transform ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
          whileTap={readonly ? {} : { scale: 0.9 }}
        >
          {rating !== null && star <= rating ? '⭐️' : '☆'}
        </motion.button>
      ))}
    </div>
  );
}

// Compact display version
export function RatingBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
      {'⭐️'.repeat(rating)}
    </span>
  );
}
