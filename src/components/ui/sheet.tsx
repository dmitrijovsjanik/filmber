"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

// Context for sheet state
interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

const useSheetContext = () => {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a Sheet");
  }
  return context;
};

// Main Sheet component - handles state and animations
interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Sheet = ({ children, open: controlledOpen, onOpenChange }: SheetProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  }, [isControlled, onOpenChange]);

  return (
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
};

// Trigger button
interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ children, asChild, onClick, ...props }, ref) => {
    const { onOpenChange } = useSheetContext();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      onOpenChange(true);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          (children as React.ReactElement<any>).props.onClick?.(e);
          onOpenChange(true);
        },
      });
    }

    return (
      <button ref={ref} onClick={handleClick} {...props}>
        {children}
      </button>
    );
  }
);
SheetTrigger.displayName = "SheetTrigger";

// Close button
const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { onOpenChange } = useSheetContext();

  return (
    <button
      ref={ref}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    />
  );
});
SheetClose.displayName = "SheetClose";

// Sheet content variants
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom: "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

// Get transform for closed state
const getClosedTransform = (side: "top" | "bottom" | "left" | "right") => {
  switch (side) {
    case "top": return "translateY(-100%)";
    case "bottom": return "translateY(100%)";
    case "left": return "translateX(-100%)";
    case "right": return "translateX(100%)";
  }
};

interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetVariants> {
  onClose?: () => void;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, onClose, ...props }, ref) => {
    const { open, onOpenChange } = useSheetContext();
    // State machine: hidden → entering → visible → exiting → hidden
    const [renderState, setRenderState] = React.useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
    const [mounted, setMounted] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement>(null);

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

    // Handle entering animation - use double rAF to ensure DOM is ready
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

    // Handle closing - trigger exit animation
    // The key insight: we need to ensure the browser has painted the current (open) state
    // before we apply the exit transform. We do this by:
    // 1. First render cycle: detect close request, stay in 'visible' state
    // 2. Next animation frame: browser has painted, now safe to transition
    React.useEffect(() => {
      if (!open && (renderState === 'visible' || renderState === 'entering')) {
        // Schedule state change for next frame to ensure current state is painted
        const frameId = requestAnimationFrame(() => {
          // Double rAF ensures we're past the paint
          requestAnimationFrame(() => {
            setRenderState('exiting');
          });
        });
        return () => cancelAnimationFrame(frameId);
      }
    }, [open, renderState]);

    // Handle exiting animation complete
    React.useEffect(() => {
      if (renderState === 'exiting') {
        const timer = setTimeout(() => {
          setRenderState('hidden');
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [renderState]);

    const handleClose = React.useCallback(() => {
      onClose?.();
      onOpenChange(false);
    }, [onClose, onOpenChange]);

    // Handle escape key
    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, handleClose]);

    // Lock body scroll when sheet is open
    React.useEffect(() => {
      if (renderState !== 'hidden') {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }, [renderState]);

    // Apply Telegram safe area insets based on sheet position
    const safeAreaClass = side === "bottom"
      ? "tg-safe-area-bottom"
      : side === "top"
      ? "tg-safe-area-top"
      : "tg-safe-area-inset";

    // Don't render if hidden or not mounted
    if (!mounted || renderState === 'hidden') return null;

    // Determine visual state based on renderState
    // Only 'visible' shows the open position, all other states show closed
    const isAnimatedOpen = renderState === 'visible';
    const overlayOpacity = isAnimatedOpen ? "opacity-100" : "opacity-0";
    const contentTransform = isAnimatedOpen ? "translate(0, 0)" : getClosedTransform(side!);

    const content = (
      <>
        {/* Overlay */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-black/80 transition-opacity duration-300",
            overlayOpacity
          )}
          onClick={handleClose}
        />
        {/* Content */}
        <div
          ref={(node) => {
            // Handle both internal ref and forwarded ref
            contentRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={cn(sheetVariants({ side }), safeAreaClass, "will-change-transform", className)}
          style={{
            transform: contentTransform,
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          {...props}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close</span>
          </button>
          {children}
        </div>
      </>
    );

    return createPortal(content, document.body);
  }
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

// For backwards compatibility
const SheetPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export {
  Sheet,
  SheetPortal,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
