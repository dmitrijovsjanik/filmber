'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface MovieListSkeletonProps {
  count?: number;
}

export function MovieListSkeleton({ count = 5 }: MovieListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <MovieListItemSkeleton key={index} />
      ))}
    </div>
  );
}

export function MovieListItemSkeleton() {
  return (
    <div className="flex gap-3">
      {/* Poster skeleton */}
      <Skeleton className="h-28 w-20 flex-shrink-0 rounded-lg" />

      {/* Info skeleton */}
      <div className="flex flex-1 flex-col justify-center gap-2">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>

      {/* More icon placeholder */}
      <div className="flex items-center">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  );
}
