import { createElement } from 'react';
import { cn } from '@/lib/utils';

const e = createElement;

interface FullLogoProps {
  className?: string;
  collapsed?: boolean;
}

export function FullLogo({ className, collapsed = false }: FullLogoProps) {
  return e(
    'div',
    { className: cn('flex items-center gap-2', className) },
    e(
      'div',
      {
        className: cn(
          'w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center',
          collapsed && 'mx-auto'
        )
      },
      e('span', { className: 'text-white font-bold text-lg' }, 'V')
    ),
    !collapsed && e(
      'span',
      { className: 'text-xl font-bold text-cyan-400 tracking-tight whitespace-nowrap' },
      'VNInvest'
    )
  );
}

export default FullLogo;