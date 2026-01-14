'use client';

import { ReactNode, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';

interface ProfilePageLayoutProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePageLayout({
  title,
  children,
  headerAction,
  isOpen,
  onClose,
}: ProfilePageLayoutProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/80 transition-opacity duration-500 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[100] w-full bg-background flex flex-col shadow-lg transition-transform duration-500 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 min-h-16 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-full"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </Button>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          {headerAction}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
