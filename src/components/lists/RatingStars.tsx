'use client';

import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { SmileIcon, NeutralIcon, Sad01Icon } from '@hugeicons/core-free-icons';

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

// Rating config: 1 = sad (red), 2 = neutral (gray), 3 = smile (green)
const ratingConfig = [
  { value: 1, icon: Sad01Icon, activeColor: 'text-red-500', bgColor: 'bg-red-500/20' },
  { value: 2, icon: NeutralIcon, activeColor: 'text-gray-500', bgColor: 'bg-gray-500/20' },
  { value: 3, icon: SmileIcon, activeColor: 'text-green-500', bgColor: 'bg-green-500/20' },
];

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
    <div className="flex gap-2">
      {ratingConfig.map((config) => {
        const isActive = rating === config.value;
        return (
          <motion.button
            key={config.value}
            type="button"
            onClick={() => handleClick(config.value)}
            disabled={readonly}
            className={`transition-transform ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
            whileTap={readonly ? {} : { scale: 0.9 }}
          >
            <HugeiconsIcon
              icon={config.icon}
              size={iconSize}
              className={isActive ? config.activeColor : 'text-muted-foreground/30'}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

// Compact display version - emoji icon
export function RatingBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;

  const config = ratingConfig.find((c) => c.value === rating);
  if (!config) return null;

  return (
    <HugeiconsIcon
      icon={config.icon}
      size={20}
      className={config.activeColor}
    />
  );
}
