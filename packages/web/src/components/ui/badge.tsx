import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-slate-950',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-500 text-slate-950 hover:bg-primary-400',
        secondary: 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700',
        destructive: 'border-transparent bg-rose-500 text-slate-50 hover:bg-rose-400',
        outline: 'border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800',
        success: 'border-transparent bg-emerald-500 text-slate-50 hover:bg-emerald-400',
        warning: 'border-transparent bg-amber-500 text-slate-50 hover:bg-amber-400',
        info: 'border-transparent bg-blue-500 text-slate-50 hover:bg-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };