import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants (high contrast)
        watched: "border-transparent bg-emerald-500/20 text-emerald-700",
        watching: "border-transparent bg-yellow-500/20 text-yellow-700",
        wantToWatch: "border-transparent bg-blue-500/20 text-blue-700",
        // Platform rating variants
        tmdb: "border-transparent bg-emerald-500 text-white",
        imdb: "border-transparent bg-yellow-500 text-white",
        rt: "border-transparent bg-red-500 text-white",
        kinopoisk: "border-transparent bg-orange-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
