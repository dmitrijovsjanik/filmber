'use client';

import { useState, useEffect } from 'react';

const MIN_HEIGHT = 400;
const MAX_HEIGHT = 520;
const OFFSET = 200; // Space for header, buttons, etc.

/**
 * Hook to calculate card stack height based on viewport
 * Uses window.innerHeight with fallback for Telegram WebApp
 */
export function useCardStackHeight(): number {
  const [height, setHeight] = useState(MAX_HEIGHT);

  useEffect(() => {
    const calculateHeight = () => {
      // Try Telegram WebApp viewport first, fallback to window.innerHeight
      const viewportHeight =
        window.Telegram?.WebApp?.viewportStableHeight ||
        window.Telegram?.WebApp?.viewportHeight ||
        window.innerHeight;

      const calculated = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, viewportHeight - OFFSET));
      setHeight(calculated);
    };

    calculateHeight();

    // Update on resize
    window.addEventListener('resize', calculateHeight);

    // Telegram WebApp viewport change
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // @ts-expect-error - onEvent might not be typed
      tg.onEvent?.('viewportChanged', calculateHeight);
    }

    return () => {
      window.removeEventListener('resize', calculateHeight);
      // @ts-expect-error - offEvent might not be typed
      tg?.offEvent?.('viewportChanged', calculateHeight);
    };
  }, []);

  return height;
}
