import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/80 focus:ring-2 focus:ring-ring focus:ring-offset-2",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-ring focus:ring-offset-2",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow transition-colors hover:bg-destructive/80 focus:ring-2 focus:ring-ring focus:ring-offset-2",
        outline: "text-foreground",
        // Status variants (high contrast, non-interactive)
        watched: "border-transparent bg-emerald-500/20 text-emerald-700",
        watching: "border-transparent bg-yellow-500/20 text-yellow-700",
        wantToWatch: "border-transparent bg-blue-500/20 text-blue-700",
        // Info variant (non-interactive, for year, runtime, genres)
        info: "border-transparent bg-secondary text-secondary-foreground",
        // Media type variants (non-interactive)
        movie: "border-blue-500/30 bg-blue-500/20 text-blue-600",
        tv: "border-purple-500/30 bg-purple-500/20 text-purple-600",
        // Swipe card variants (for dark backgrounds, non-interactive)
        cardTv: "border-transparent bg-purple-500/80 text-white",
        cardSecondary: "border-transparent bg-white/20 text-white",
        // Platform rating variants
        tmdb: "border-transparent bg-emerald-500 text-white",
        imdb: "border-transparent bg-yellow-500 text-white",
        rt: "border-transparent bg-red-500 text-white",
        kinopoisk: "border-transparent bg-orange-500 text-white",
        // Unified average rating
        rating: "border-transparent bg-amber-500 text-white font-semibold",
      },
      size: {
        sm: "h-4 px-1.5 text-[10px]",
        default: "h-5 px-2 text-xs",
        lg: "h-[24px] px-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
