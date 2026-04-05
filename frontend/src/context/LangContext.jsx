import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePortfolio } from './PortfolioContext';
import {
  DEFAULT_LOCALE,
  createTranslator,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  getLocaleTag,
  normalizeLocale,
} from '../i18n';

const LANG_STORAGE_KEY = 'lang';
const LangContext = createContext(null);

function getInitialLocale() {
  try {
    return normalizeLocale(localStorage.getItem(LANG_STORAGE_KEY));
  } catch (_) {
    return DEFAULT_LOCALE;
  }
}

export function LangProvider({ children }) {
  const { isAuthenticated, userConfig, updateUserConfig } = usePortfolio();
  const [locale, setLocaleState] = useState(getInitialLocale);

  useEffect(() => {
    const nextLocale = normalizeLocale(userConfig?.language);
    if (!userConfig?.language || nextLocale === locale) {
      return;
    }

    setLocaleState(nextLocale);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLocale);
    } catch (_) {
      // Ignore storage errors.
    }
  }, [locale, userConfig?.language]);

  const setLanguage = useCallback(async (value) => {
    const nextLocale = normalizeLocale(value);
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLocale);
    } catch (_) {
      // Ignore storage errors.
    }

    if (!isAuthenticated || userConfig?.language === nextLocale) {
      return nextLocale;
    }

    try {
      await updateUserConfig({ language: nextLocale });
    } catch (error) {
      console.error('Update language preference failed:', error);
    }

    return nextLocale;
  }, [isAuthenticated, updateUserConfig, userConfig?.language]);

  const t = useMemo(() => createTranslator(locale), [locale]);
  const localeTag = useMemo(() => getLocaleTag(locale), [locale]);

  const value = useMemo(() => ({
    locale,
    localeTag,
    setLanguage,
    t,
    formatNumber: (number, options) => formatNumber(number, locale, options),
    formatCurrency: (number, currency, options) => formatCurrency(number, locale, currency, options),
    formatDate: (value, options) => formatDate(value, locale, options),
    formatTime: (value, options) => formatTime(value, locale, options),
    formatDateTime: (value, options) => formatDateTime(value, locale, options),
  }), [locale, localeTag, setLanguage, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useI18n must be used inside LangProvider');
  }
  return context;
}