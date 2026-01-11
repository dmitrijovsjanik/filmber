'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollFadeContainerProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function ScrollFadeContainer({ children, className, innerClassName }: ScrollFadeContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const threshold = 10;

    setFadeTop(scrollTop > threshold);
    setFadeBottom(scrollTop + clientHeight < scrollHeight - threshold);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check
    updateFades();

    // Listen to scroll
    el.addEventListener('scroll', updateFades, { passive: true });

    // Listen to resize and content changes
    const resizeObserver = new ResizeObserver(updateFades);
    resizeObserver.observe(el);

    // Also observe children for dynamic content
    const mutationObserver = new MutationObserver(updateFades);
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', updateFades);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateFades]);

  return (
    <div
      className={cn(
        'scroll-fade-container flex-1 min-h-0 relative',
        fadeTop && 'fade-top',
        fadeBottom && 'fade-bottom',
        className
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          'h-full overflow-y-auto overscroll-contain',
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
