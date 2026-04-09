import en from './en';
import vi from './vi';

export const DEFAULT_LOCALE = 'vi';

const dictionaries = { vi, en };
const localeTags = {
  vi: 'vi-VN',
  en: 'en-US',
};

function getNestedValue(source, path) {
  return String(path || '')
    .split('.')
    .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), source);
}

export function normalizeLocale(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(dictionaries, normalized) ? normalized : DEFAULT_LOCALE;
}

export function getLocaleTag(locale) {
  return localeTags[normalizeLocale(locale)] || localeTags[DEFAULT_LOCALE];
}

export function createTranslator(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const dictionary = dictionaries[normalizedLocale] || dictionaries[DEFAULT_LOCALE];
  const fallbackDictionary = dictionaries[DEFAULT_LOCALE];

  return function translate(key, vars = {}) {
    const hasDefaultValue = Object.prototype.hasOwnProperty.call(vars, 'defaultValue');
    const defaultValue = hasDefaultValue ? String(vars.defaultValue) : String(key);
    const template = getNestedValue(dictionary, key) ?? getNestedValue(fallbackDictionary, key) ?? defaultValue;
    if (typeof template !== 'string') {
      return defaultValue;
    }

    return Object.entries(vars).reduce((result, [name, value]) => {
      if (name === 'defaultValue') {
        return result;
      }
      return result.replaceAll(`{${name}}`, String(value));
    }, template);
  };
}

export function formatNumber(value, locale, options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat(getLocaleTag(locale), options).format(Number(value));
}

export function formatCurrency(value, locale, currency = 'VND', options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat(getLocaleTag(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  }).format(Number(value));
}

const QUOTE_LOCALE_TAG = 'en-US';

export function formatQuotePrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat(QUOTE_LOCALE_TAG, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatQuoteVolume(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat(QUOTE_LOCALE_TAG, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/**
 * Chuẩn hóa hiển thị giá chứng khoán VN.
 * Input : giá raw từ vnstock (đơn vị nghìn đồng, ví dụ 78.7)
 * Output: "78.700 VNĐ" (vi-VN) / "78,700 VNĐ" (en-US)
 * Không có số thập phân — làm tròn về VNĐ nguyên.
 */
export function formatPriceVND(value, locale) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const vnd = Math.round(Number(value) * 1000);
  return (
    new Intl.NumberFormat(getLocaleTag(locale), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(vnd) + ' VNĐ'
  );
}

export function formatDateTime(value, locale, options = {}) {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(getLocaleTag(locale), options).format(date);
}

export function formatDate(value, locale, options = {}) {
  return formatDateTime(value, locale, { year: 'numeric', month: '2-digit', day: '2-digit', ...options });
}

export function formatTime(value, locale, options = {}) {
  return formatDateTime(value, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', ...options });
}