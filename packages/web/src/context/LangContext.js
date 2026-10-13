import { createContext, useCallback, useContext, useEffect, useMemo, useState, createElement } from 'react';
import { usePortfolio } from './PortfolioContext.js';
import {
  DEFAULT_LOCALE,
  createTranslator,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPriceVND,
  formatQuotePrice,
  formatQuoteVolume,
  formatQuoteInteger,
  formatTime,
  getLocaleTag,
  normalizeLocale,
} from '../i18n/index.js';

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
    formatPriceVND: (number) => formatPriceVND(number, locale),
    formatQuotePrice,
    formatQuoteVolume,
    formatQuoteInteger,
    formatDate: (value, options) => formatDate(value, locale, options),
    formatTime: (value, options) => formatTime(value, locale, options),
    formatDateTime: (value, options) => formatDateTime(value, locale, options),
  }), [locale, localeTag, setLanguage, t]);

  return createElement(LangContext.Provider, { value }, children);
}

/**
 * Fallback khi KHÔNG có `LangProvider` (test đơn vị render component trần).
 *
 * ⚠ PHẢI là HẰNG SỐ Ở CẤP MODULE — đây là bản sửa 2026-10-13 (claim
 * `pf-manage-rebuild`), không phải chỉ là refactor cho đẹp.
 *
 * Trước đây object này được tạo **mới mỗi lần render**. `t` vì thế có identity
 * khác nhau ở mỗi render ⇒ bất kỳ `useCallback`/`useMemo` nào liệt kê `t` (hoặc
 * bất kỳ hàm format nào) trong deps sẽ **đổi identity mỗi render** ⇒ effect theo
 * dep đó chạy lại vô hạn.
 *
 * Bằng chứng, không phải suy đoán: `DNSEConnectionPanel` sau khi i18n hoá
 * (`useDNSEStatus` dùng `useCallback(..., [t])`) **kẹt vĩnh viễn ở "Đang tải
 * trạng thái DNSE..."** và `dnse-order-mode-badge.component.test.js` đỏ 3/3 —
 * vì `reload` đổi identity mỗi render ⇒ effect `useEffect(..., [reload])` gọi
 * `getDNSEConfig()` lặp, `setLoading(true/false)` lặp, render lại. Panel cũ
 * không dính vì **không** dùng `t` ở đâu cả.
 *
 * Ở app thật `LangProvider` luôn bọc ngoài (`main.tsx:241`) nên nhánh này không
 * xảy ra — nhưng nó là bẫy cho mọi test và mọi component mới.
 */
const I18N_FALLBACK = {
  locale: 'vi',
  localeTag: 'vi-VN',
  t: (key, options) => {
    if (options && typeof options === 'object' && 'defaultValue' in options) {
      return options.defaultValue;
    }
    return key;
  },
  formatNumber: (n) => n?.toLocaleString('vi-VN') ?? '',
  formatCurrency: (n) => n?.toLocaleString('vi-VN') ?? '',
  formatPriceVND: (n) => n?.toLocaleString('vi-VN') ?? '',
  formatQuotePrice: (p) => p ?? '',
  formatQuoteVolume: (v) => v ?? '',
  formatQuoteInteger: (v) => v ?? '',
  formatDate: (d) => d ?? '',
  formatTime: (t) => t ?? '',
  formatDateTime: (dt) => dt ?? '',
};

export function useI18n() {
  const context = useContext(LangContext);
  return context ?? I18N_FALLBACK;
}
