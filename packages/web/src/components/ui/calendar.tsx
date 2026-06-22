import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  mode?: 'single' | 'range' | 'multiple';
  selected?: Date | Date[] | null;
  onSelect?: (date: Date | Date[]) => void;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, mode = 'single', selected, onSelect, disabled, minDate, maxDate, ...props }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDates, setSelectedDates] = React.useState<Date[]>(selected ? (Array.isArray(selected) ? selected : [selected]) : []);

    const daysInMonth = React.useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInPrevMonth = new Date(year, month, 0).getDate();
      const startingDay = firstDay.getDay();
      const totalDays = lastDay.getDate();

      const days = [];
      // Previous month days
      for (let i = startingDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const date = new Date(year, month - 1, day);
        days.push({ date, isCurrentMonth: false, isToday: false, isSelected: false, isDisabled: true });
      }
      // Current month days
      const today = new Date();
      for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
        const isDisabled = (minDate && date < minDate) || (maxDate && date > maxDate);
        days.push({ date, isCurrentMonth: true, isToday, isSelected, isDisabled });
      }
      // Next month days to fill the grid
      const remainingCells = 42 - days.length;
      for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        days.push({ date, isCurrentMonth: false, isToday: false, isSelected: false, isDisabled: true });
      }
      return days;
    }, [currentMonth, selectedDates, minDate, maxDate]);

    const handleDayClick = (day: { date: Date; isDisabled: boolean }) => {
      if (day.isDisabled || disabled) return;

      let newSelected: Date[];
      if (mode === 'range') {
        if (selectedDates.length === 0 || selectedDates.length === 2) {
          newSelected = [day.date];
        } else if (selectedDates.length === 1) {
          const [first] = selectedDates;
          if (day.date < first) {
            newSelected = [day.date, first];
          } else {
            newSelected = [first, day.date];
          }
        } else {
          newSelected = [day.date];
        }
      } else if (mode === 'multiple') {
        const isAlreadySelected = selectedDates.some(d => d.toDateString() === day.date.toDateString());
        newSelected = isAlreadySelected
          ? selectedDates.filter(d => d.toDateString() !== day.date.toDateString())
          : [...selectedDates, day.date];
      } else {
        newSelected = [day.date];
      }

      setSelectedDates(newSelected);
      onSelect?.(mode === 'single' ? newSelected[0] : newSelected);
    };

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
      <div ref={ref} className={cn('rounded-md border border-slate-800 bg-slate-900 p-4', className)} {...props}>
        <div className="flex items-center justify-between mb-4">
          <button
            className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            disabled={disabled}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-100">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            disabled={disabled}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="h-9 w-9 text-xs font-medium text-slate-500 text-center">
              {day}
            </div>
          ))}
          {daysInMonth.map((day, index) => (
            <button
              key={index}
              className={cn(
                'h-9 w-9 rounded-md text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary-400',
                day.isCurrentMonth ? 'text-slate-100' : 'text-slate-500 opacity-50',
                day.isToday && 'bg-slate-800 text-primary-400',
                day.isSelected && 'bg-primary-500 text-slate-950',
                day.isDisabled && 'pointer-events-none opacity-50',
                !day.isDisabled && 'hover:bg-slate-800'
              )}
              onClick={() => handleDayClick({ date: day.date, isDisabled: day.isDisabled ?? false })}
              disabled={day.isDisabled || disabled}
              aria-selected={day.isSelected}
              aria-current={day.isToday ? 'date' : undefined}
              aria-label={day.date.toLocaleDateString()}
            >
              {day.date.getDate()}
            </button>
          ))}
        </div>
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';

const CalendarHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between mb-4', className)} {...props}>{children}</div>
);
CalendarHeader.displayName = 'CalendarHeader';

const CalendarTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm font-medium text-slate-100', className)} {...props}>{children}</div>
);
CalendarTitle.displayName = 'CalendarTitle';

const CalendarPrev = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400', className)} {...props}>
    {children || <ChevronLeft className="h-4 w-4" />}
  </button>
);
CalendarPrev.displayName = 'CalendarPrev';

const CalendarNext = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400', className)} {...props}>
    {children || <ChevronRight className="h-4 w-4" />}
  </button>
);
CalendarNext.displayName = 'CalendarNext';

const CalendarGrid = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid grid-cols-7 gap-1', className)} {...props}>{children}</div>
);
CalendarGrid.displayName = 'CalendarGrid';

const CalendarDay = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('h-9 w-9 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400', className)} {...props}>
    {children}
  </button>
);
CalendarDay.displayName = 'CalendarDay';

const CalendarWeekday = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('h-9 w-9 text-xs font-medium text-slate-500 text-center', className)} {...props}>{children}</div>
);
CalendarWeekday.displayName = 'CalendarWeekday';

export { Calendar, CalendarHeader, CalendarTitle, CalendarPrev, CalendarNext, CalendarGrid, CalendarDay, CalendarWeekday };