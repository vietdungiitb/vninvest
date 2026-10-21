import { useCallback } from "react";
import { useI18n } from "../../context/LangContext.js";

export interface CommercialMessages {
  retry: string;
  retryHint: string;
  loading: string;
  emptyValue: string;
  emptyReason: string;
}


/**
 * Fallback catalog (EN). The VI strings live in `src/i18n/vi.js` and the EN ones in
 * `src/i18n/en.js` — the i18n dictionary is the SSOT, this file is only the
 * `defaultValue` when a key is missing (i18n/index.js:42 falls back to VI).
 */
const EN_MESSAGES: CommercialMessages = {
  retry: "Try again",
  retryHint: "If the problem persists, reload the page or contact your administrator.",
  loading: "Loading data...",
  emptyValue: "—",
  emptyReason: "No data to display yet.",
};

export interface CommercialTranslator {
  t: (key: string, defaultValue: string) => string;
  messages: CommercialMessages;
}

export function useCommercialTranslator(): CommercialTranslator {
  const { t, locale } = useI18n();
  // The dictionary decides the locale; this catalog is the fallback only.
  const messages = EN_MESSAGES;
  void locale;
  const translate = useCallback(
    (key: string, defaultValue: string) => t(key, { defaultValue }),
    [t],
  );
  return { t: translate, messages };
}
