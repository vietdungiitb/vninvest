import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface I18nContextValue {
  locale: string;
  localeTag: string;
  setLanguage: (value: string) => Promise<string>;
  t: (key: string, options?: { defaultValue?: string; [key: string]: any }) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (number: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  formatPriceVND: (number: number) => string;
  formatQuotePrice: (price: number) => string;
  formatQuoteVolume: (volume: number) => string;
  formatQuoteInteger: (value: number) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

const LangContext = createContext<I18nContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }): JSX.Element;

export function useI18n(): I18nContextValue;