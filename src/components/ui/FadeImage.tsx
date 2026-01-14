'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Global cache to track images that have been loaded in this session
// This prevents fade animation from replaying when components remount
const loadedImages = new Set<string>();

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
  wrapperClassName?: string;
}

/**
 * Image component with fade-in animation on load.
 * Shows a skeleton/fallback while loading, then fades in the image.
 * Skips animation for already-loaded images (browser cache or session cache).
 */
export function FadeImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  onLoad,
  onError,
  ...props
}: FadeImageProps) {
  // Only work with string src (not Blob)
  const srcString = typeof src === 'string' ? src : undefined;

  // Check if image was already loaded in this session
  const isAlreadyLoaded = srcString ? loadedImages.has(srcString) : false;

  const [isLoaded, setIsLoaded] = useState(isAlreadyLoaded);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if image is already cached by browser (complete before onLoad fires)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0 && srcString) {
      loadedImages.add(srcString);
      setIsLoaded(true);
    }
  }, [srcString]);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (srcString) {
        loadedImages.add(srcString);
      }
      setIsLoaded(true);
      onLoad?.(e);
    },
    [onLoad, srcString]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setHasError(true);
      onError?.(e);
    },
    [onError]
  );

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)}>
      {/* Skeleton background - visible until image loads */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Image with fade-in */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}
