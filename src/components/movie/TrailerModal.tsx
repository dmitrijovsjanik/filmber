'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoKey: string | null;
  title?: string;
}

export function TrailerModal({ isOpen, onClose, videoKey, title }: TrailerModalProps) {
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[70] bg-black/90 transition-opacity duration-500 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center ease-in-out ${
          isOpen ? '' : 'translate-y-full'
        } transition-transform duration-500`}
      >
        {/* Header with gradient */}
        <div className="absolute top-0 left-0 right-0 z-10">
          {/* Gradient background for header */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Back button - with Telegram safe area padding */}
          <div className="relative px-4 flex items-center justify-between" style={{ paddingTop: 'calc(1rem + var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))' }}>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60 text-white"
              aria-label={tCommon('back')}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </button>

            {/* Title */}
            {title && (
              <h2 className="flex-1 text-center text-white font-medium truncate px-4">
                {title}
              </h2>
            )}

            {/* Spacer for centering */}
            <div className="w-10" />
          </div>
        </div>

        {/* Video container - 16:9 aspect ratio, centered */}
        <div className="w-full px-4 max-w-4xl">
          <div className="relative w-full aspect-video bg-neutral-900 rounded-lg overflow-hidden">
            {isOpen && videoKey && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={title || 'Trailer'}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
