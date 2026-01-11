'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // If viewport height is significantly less than window height, keyboard is likely open
      const keyboardThreshold = 150;
      const heightDiff = window.innerHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > keyboardThreshold);
    };

    viewport.addEventListener('resize', handleResize);
    handleResize();

    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main
      className={cn(
        'h-full flex flex-col overflow-hidden transition-[padding] duration-150',
        isKeyboardVisible ? 'pb-0' : 'pb-navbar'
      )}
    >
      {children}
    </main>
  );
}
