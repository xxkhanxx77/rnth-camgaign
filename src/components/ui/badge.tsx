import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'glass-control inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'glass-fill-primary',
        secondary: 'text-secondary-foreground',
        outline: 'text-foreground',
        accent: 'glass-fill-orange',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
