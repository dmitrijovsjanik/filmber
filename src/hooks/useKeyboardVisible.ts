'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect virtual keyboard visibility on mobile devices.
 * Uses the Visual Viewport API for reliable keyboard detection.
 *
 * @param threshold - Pixel difference threshold to consider keyboard open (default: 150)
 * @returns boolean indicating if keyboard is visible
 */
export function useKeyboardVisible(threshold = 150): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // Use visualViewport API for reliable keyboard detection
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // If viewport height is significantly less than window height, keyboard is likely open
      const heightDiff = window.innerHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > threshold);
    };

    viewport.addEventListener('resize', handleResize);
    handleResize(); // Check initial state

    return () => viewport.removeEventListener('resize', handleResize);
  }, [threshold]);

  return isKeyboardVisible;
}
