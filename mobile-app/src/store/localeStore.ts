import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createTranslator, SUPPORTED_LOCALES } from '../i18n';
import type { Locale } from '../i18n';

const STORAGE_KEY = 'vninvest_language';

type LocaleState = {
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
  bootstrap: () => Promise<void>;
  setLocale: (l: Locale) => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'vi',
  t: createTranslator('vi'),

  bootstrap: async () => {
    try {
      const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as Locale | null;
      const resolved: Locale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : 'vi';
      set({ locale: resolved, t: createTranslator(resolved) });
    } catch {
      // Storage unavailable — fallback to Vietnamese
    }
  },

  setLocale: async (nextLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) {
      return;
    }
    set({ locale: nextLocale, t: createTranslator(nextLocale) });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Storage error — locale still updated in memory for this session
    }
  },
}));
