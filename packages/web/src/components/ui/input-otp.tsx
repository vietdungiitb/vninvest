import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputOtpProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /**
   * Nhan cho tung o. Mac dinh `Digit`. Caller nen truyen ban i18n
   * (vi du `t('auth.otpDigit')`) thay vi chuoi hardcode.
   */
  digitLabel?: string;
}

const InputOtp = React.forwardRef<HTMLDivElement, InputOtpProps>(
  ({ length = 6, value = '', onChange, disabled, className, digitLabel, ...props }, ref) => {
    const inputsRef = React.useRef<HTMLInputElement[]>([]);

    const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (!/^\d*$/.test(newValue)) return;

      const values = value.split('');
      values[index] = newValue;
      const joined = values.join('');
      onChange?.(joined);

      // Auto-focus next input
      if (newValue && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text');
      if (/^\d{6}$/.test(pasted)) {
        onChange?.(pasted);
        inputsRef.current.forEach((input, i) => {
          input.value = pasted[i];
        });
        inputsRef.current[length - 1]?.focus();
      }
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed', className)}
        {...props}
      >
        {Array.from({ length }).map((_, index) => (
          <input aria-label={`${digitLabel ?? 'Digit'} ${index + 1}`}
            key={index}
            ref={el => { inputsRef.current[index] = el!; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={e => handleChange(index, e)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={cn(
              'h-10 w-10 text-center text-lg rounded-md border border-slate-700 bg-slate-900/50 text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        ))}
      </div>
    );
  }
);
InputOtp.displayName = 'InputOtp';

const InputOtpGroup = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2', className)} {...props}>{children}</div>
);
InputOtpGroup.displayName = 'InputOtpGroup';

const InputOtpSlot = ({
  className,
  slotLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { slotLabel?: string }) => {
  // W3-1 (AC-1.1): `InputOtpSlot` chi spread `{...props}` nen caller quen truyen
  // `aria-label` thi o so co accessible name rong. `slotLabel` cho primitive mot
  // ten mac dinh; `aria-label` cua caller van thang.
  const ariaLabel = (props['aria-label'] as string | undefined) ?? slotLabel;
  return (
    <input aria-label={ariaLabel}
      className={cn(
        'h-10 w-10 text-center text-lg rounded-md border border-slate-700 bg-slate-900/50 text-slate-100 placeholder:text-slate-500',
        'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
};
InputOtpSlot.displayName = 'InputOtpSlot';

const InputOtpSeparator = ({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('text-slate-500', className)} {...props}>{children || '•'}</span>
);
InputOtpSeparator.displayName = 'InputOtpSeparator';

export { InputOtp, InputOtpGroup, InputOtpSlot, InputOtpSeparator };