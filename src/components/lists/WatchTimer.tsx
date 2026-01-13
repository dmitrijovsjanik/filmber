'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';

interface WatchTimerProps {
  watchStartedAt: string;
  runtime: number | null; // in minutes
}

const DEFAULT_RUNTIME = 120; // 2 hours default

function formatTimeRemaining(ms: number): string {
  const totalMinutes = Math.ceil(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function WatchTimer({ watchStartedAt, runtime }: WatchTimerProps) {
  const t = useTranslations('timer');
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  const watchDuration = (runtime || DEFAULT_RUNTIME) * 60 * 1000; // ms

  useEffect(() => {
    const updateProgress = () => {
      const startTime = new Date(watchStartedAt).getTime();
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(1, elapsed / watchDuration);
      const remaining = Math.max(0, watchDuration - elapsed);

      setProgress(currentProgress);
      setRemainingTime(remaining);
    };

    // Initial update
    updateProgress();

    // Update every minute
    const interval = setInterval(updateProgress, 60 * 1000);

    return () => clearInterval(interval);
  }, [watchStartedAt, watchDuration]);

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="w-full">
      {/* Progress bar */}
      <Progress value={progressPercent} />

      {/* Time info */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{progressPercent}%</span>
        {remainingTime > 0 && (
          <span>
            {t('remaining', { time: formatTimeRemaining(remainingTime) })}
          </span>
        )}
      </div>
    </div>
  );
}

export function useWatchProgress(watchStartedAt: string | null, runtime: number | null) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!watchStartedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsComplete(false);
      return;
    }

    const watchDuration = (runtime || DEFAULT_RUNTIME) * 60 * 1000;

    const checkProgress = () => {
      const startTime = new Date(watchStartedAt).getTime();
      const elapsed = Date.now() - startTime;
      setIsComplete(elapsed >= watchDuration);
    };

    checkProgress();

    const interval = setInterval(checkProgress, 60 * 1000);
    return () => clearInterval(interval);
  }, [watchStartedAt, runtime]);

  return isComplete;
}
