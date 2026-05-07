export const ALLOWED_SYMBOLS = ['VNM', 'FPT', 'VHM', 'ACB', 'TCB', 'MBB', 'VCB', 'HPG', 'SSI', 'VND'] as const;
export type AllowedSymbol = (typeof ALLOWED_SYMBOLS)[number];

export const ALLOWED_TIMEFRAMES = ['1d', '1w', '1m'] as const;
export type AllowedTimeframe = (typeof ALLOWED_TIMEFRAMES)[number];

const SYMBOL_PATTERN = /^[A-Z0-9]{1,10}$/;

export function normalizeSymbol(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

export function isAllowedSymbol(value: string | null | undefined): value is AllowedSymbol {
  const normalized = normalizeSymbol(value);
  return SYMBOL_PATTERN.test(normalized) && ALLOWED_SYMBOLS.includes(normalized as AllowedSymbol);
}

export function normalizeTimeframe(value: string | null | undefined): AllowedTimeframe {
  const normalized = (value ?? '1d').trim().toLowerCase();
  if (ALLOWED_TIMEFRAMES.includes(normalized as AllowedTimeframe)) {
    return normalized as AllowedTimeframe;
  }
  return '1d';
}

export function isAllowedTimeframe(value: string | null | undefined): value is AllowedTimeframe {
  return ALLOWED_TIMEFRAMES.includes((value ?? '').trim().toLowerCase() as AllowedTimeframe);
}
