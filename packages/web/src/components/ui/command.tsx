import * as React from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ value, onValueChange, placeholder = 'Search...', className, children, ...props }, ref) => {
    // `placeholder` KHONG phai accessible name — fallback ve no de input luon
    // co ten khi caller khong truyen `aria-label`.
    const { ['aria-label']: ariaLabel, ...divProps } = props;
    return (
    <div ref={ref} className={cn('flex flex-col', className)} {...divProps}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900/50 pl-10 pr-10 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            onClick={() => onValueChange('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-2 max-h-[300px] overflow-y-auto overflow-x-hidden">{children}</div>
    </div>
    );
  }
);
Command.displayName = 'Command';

interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      // `placeholder` khong phai accessible name — fallback ve no khi caller
      // khong truyen `aria-label`, giong `Command` o tren.
      aria-label={props['aria-label'] ?? props.placeholder}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500',
        'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
CommandInput.displayName = 'CommandInput';

interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)} {...props} />
  )
);
CommandList.displayName = 'CommandList';

interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('py-6 text-center text-sm text-slate-500', className)} {...props} />
  )
);
CommandEmpty.displayName = 'CommandEmpty';

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-hidden p-1', className)} {...props} />
  )
);
CommandGroup.displayName = 'CommandGroup';

interface CommandSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CommandSeparator = React.forwardRef<HTMLDivElement, CommandSeparatorProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('-mx-1 h-px bg-slate-800', className)} {...props} />
  )
);
CommandSeparator.displayName = 'CommandSeparator';

interface CommandItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-slate-800 focus:text-slate-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'data-[selected]:bg-slate-800 data-[selected]:text-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
CommandItem.displayName = 'CommandItem';

interface CommandShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
}

const CommandShortcut = React.forwardRef<HTMLSpanElement, CommandShortcutProps>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
  )
);
CommandShortcut.displayName = 'CommandShortcut';

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator };