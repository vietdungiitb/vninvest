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
    const template = getNestedValue(dictionary, key) ?? getNestedValue(fallbackDictionary, key) ?? key;
    if (typeof template !== 'string') {
      return key;
    }

    return Object.entries(vars).reduce((result, [name, value]) => {
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