'use client';

import { useState, useCallback } from 'react';
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
 * Internal component that handles the actual image rendering.
 * Using a separate component allows React to reset state when src changes via key prop.
 */
function OptimizedFadeImageInner({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  onLoad,
  onError,
  fill,
  srcString,
  ...props
}: OptimizedFadeImageProps & { srcString: string }) {
  // Check if image was already loaded in this session
  const isAlreadyLoaded = srcString ? loadedImages.has(srcString) : false;

  const [isLoaded, setIsLoaded] = useState(isAlreadyLoaded);
  const [hasError, setHasError] = useState(false);

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
  ...props
}: OptimizedFadeImageProps) {
  const srcString = typeof src === 'string' ? src : '';

  // Use key to reset internal component state when src changes
  return (
    <OptimizedFadeImageInner
      key={srcString}
      src={src}
      srcString={srcString}
      {...props}
    />
  );
}
