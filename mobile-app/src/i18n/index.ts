import vi from './vi';
import en from './en';
import type { Translations } from './vi';

export type { Translations };
export type Locale = 'vi' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['vi', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇬🇧 English',
};

export const LOCALE_TAGS: Record<Locale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
};

const LOCALES: Record<Locale, Translations> = { vi, en };

export function getLocaleTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.vi;
}

export function formatNumber(
  value: number | string | undefined | null,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  const parsed = Number(value ?? 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat(getLocaleTag(locale), options).format(safeValue);
}

export function formatTime(
  value: string | number | Date | undefined | null,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) {
    return '--:--:--';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleTimeString(getLocaleTag(locale), options);
}

/**
 * Returns a typed translator function for the given locale.
 * Usage: const t = createTranslator('vi'); t('dashboard.total_value')
 * Supports {param} substitution: t('dashboard.greeting', { name: 'Hung' })
 */
export function createTranslator(locale: Locale) {
  const dict = LOCALES[locale] ?? LOCALES.vi;
  return function t(key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    let node: unknown = dict;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') {
        return key;
      }
      node = (node as Record<string, unknown>)[part];
    }
    let result = typeof node === 'string' ? node : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };
}
