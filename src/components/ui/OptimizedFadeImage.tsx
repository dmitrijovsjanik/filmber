'use client';

import { useState, useCallback, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

// Reuse the global cache from FadeImage for consistency
const loadedImages = new Set<string>();

type OptimizedFadeImageProps = Omit<ImageProps, 'onLoad' | 'onError'> & {
  fallback?: React.ReactNode;
  wrapperClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * Optimized Image component using next/image with fade-in animation.
 * Benefits over plain img:
 * - Automatic WebP/AVIF conversion
 * - Lazy loading by default
 * - Responsive sizing with sizes prop
 * - Blur placeholder support
 *
 * Note: For API route URLs (like /api/tmdb-image), use unoptimized={true}
 * since Next.js cannot optimize images served through API routes.
 */
export function OptimizedFadeImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  onLoad,
  onError,
  fill,
  ...props
}: OptimizedFadeImageProps) {
  const srcString = typeof src === 'string' ? src : '';

  // Check if image was already loaded in this session
  const isAlreadyLoaded = srcString ? loadedImages.has(srcString) : false;

  const [isLoaded, setIsLoaded] = useState(isAlreadyLoaded);
  const [hasError, setHasError] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    if (srcString && loadedImages.has(srcString)) {
      setIsLoaded(true);
      setHasError(false);
    } else {
      setIsLoaded(false);
      setHasError(false);
    }
  }, [srcString]);

  const handleLoad = useCallback(() => {
    if (srcString) {
      loadedImages.add(srcString);
    }
    setIsLoaded(true);
    onLoad?.();
  }, [srcString, onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  // Auto-detect if we should skip Next.js optimization
  // API routes cannot be optimized by Next.js Image
  const shouldSkipOptimization =
    props.unoptimized ?? srcString.startsWith('/api/');

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        fill ? 'h-full w-full' : '',
        wrapperClassName
      )}
    >
      {/* Skeleton background - visible until image loads */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Image with fade-in */}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        unoptimized={shouldSkipOptimization}
        {...props}
      />
    </div>
  );
}
