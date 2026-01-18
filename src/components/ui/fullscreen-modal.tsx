"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// Animation directions
type SlideDirection = "left" | "right" | "top" | "bottom";

// Get transform for closed state based on direction
const getClosedTransform = (direction: SlideDirection) => {
  switch (direction) {
    case "left": return "translateX(-100%)";
    case "right": return "translateX(100%)";
    case "top": return "translateY(-100%)";
    case "bottom": return "translateY(100%)";
  }
};

interface FullscreenModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Direction the modal slides in FROM (default: "right" = slides in from right) */
  slideFrom?: SlideDirection;
  /** Show overlay behind modal (default: true) */
  showOverlay?: boolean;
  /** Close on overlay click (default: true) */
  closeOnOverlayClick?: boolean;
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Custom className for the modal container */
  className?: string;
  /** Z-index for the modal (default: 60) */
  zIndex?: number;
  /** Animation duration in ms (default: 500) */
  duration?: number;
}

export function FullscreenModal({
  open,
  onClose,
  children,
  slideFrom = "right",
  showOverlay = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  zIndex = 60,
  duration = 500,
}: FullscreenModalProps) {
  const [renderState, setRenderState] = React.useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [mounted, setMounted] = React.useState(false);

  // Handle mount for portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle opening
  React.useEffect(() => {
    if (open && (renderState === 'hidden' || renderState === 'exiting')) {
      setRenderState('entering');
    }
  }, [open, renderState]);

  // Handle entering animation
  React.useEffect(() => {
    if (renderState === 'entering') {
      const frameId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderState('visible');
        });
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [renderState]);

  // Handle closing
  React.useEffect(() => {
    if (!open && (renderState === 'visible' || renderState === 'entering')) {
      setRenderState('exiting');
    }
  }, [open, renderState]);

  // Handle exiting animation
  React.useEffect(() => {
    if (renderState === 'exiting') {
      const timer = setTimeout(() => {
        setRenderState('hidden');
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [renderState, duration]);

  // Handle escape key
  React.useEffect(() => {
    if (!closeOnEscape || !open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (renderState !== 'hidden') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [renderState]);

  // Don't render if hidden or not mounted
  if (!mounted || renderState === 'hidden') return null;

  // Determine animation state
  const isOpen = renderState === 'visible';
  const contentTransform = isOpen ? "translate(0, 0)" : getClosedTransform(slideFrom);

  const content = (
    <>
      {/* Overlay */}
      {showOverlay && (
        <div
          className={cn(
            "fixed inset-0 bg-black/80 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          style={{
            zIndex,
            transitionDuration: `${duration}ms`,
          }}
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
      )}
      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-0 bg-background transition-transform",
          className
        )}
        style={{
          zIndex,
          transform: contentTransform,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {children}
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// Header component for the modal
interface FullscreenModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  title?: string;
  showCloseButton?: boolean;
  showBackButton?: boolean;
}

export function FullscreenModalHeader({
  onClose,
  title,
  showCloseButton = true,
  showBackButton = false,
  className,
  children,
  ...props
}: FullscreenModalHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b",
        className
      )}
      style={{
        paddingTop: 'calc(0.75rem + var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))',
      }}
      {...props}
    >
      <div className="flex items-center gap-3">
        {showBackButton && onClose && (
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {children}
      </div>
      {showCloseButton && onClose && !showBackButton && (
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Body component for scrollable content
interface FullscreenModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function FullscreenModalBody({
  className,
  children,
  ...props
}: FullscreenModalBodyProps) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto", className)}
      style={{
        paddingBottom: 'calc(1rem + var(--tg-safe-area-inset-bottom, 0px))',
      }}
      {...props}
    >
      {children}
    </div>
  );
}
