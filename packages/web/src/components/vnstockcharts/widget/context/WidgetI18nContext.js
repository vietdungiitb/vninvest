import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { widgetMessagesEn } from "../i18n/messages.en.js";
import { widgetMessagesVi } from "../i18n/messages.vi.js";
function isWidgetLocale(value) {
    return value === "vi" || value === "en";
}
function resolveInitialLocale(locale) {
    if (isWidgetLocale(locale)) {
        return locale;
    }
    if (typeof document !== "undefined") {
        const documentLocale = document.documentElement.lang.trim().toLowerCase();
        if (documentLocale.startsWith("en")) {
            return "en";
        }
    }
    return "vi";
}
function interpolate(message, params) {
    if (!params) {
        return message;
    }
    return message.replace(/\{(\w+)\}/g, (_match, key) => {
        const value = params[key];
        return value === undefined ? `{${key}}` : String(value);
    });
}
const defaultValue = {
    locale: "vi",
    setLocale: () => { },
    t: (key) => widgetMessagesVi[key] ?? widgetMessagesEn[key] ?? key,
};
export const WidgetI18nContext = createContext(defaultValue);
export function WidgetI18nProvider({ children, locale, messages, onLocaleChange }) {
    const [internalLocale, setInternalLocale] = useState(() => resolveInitialLocale(locale));
    const resolvedLocale = isWidgetLocale(locale) ? locale : internalLocale;
    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        document.documentElement.lang = resolvedLocale;
    }, [resolvedLocale]);
    const setLocale = useCallback((nextLocale) => {
        if (!isWidgetLocale(nextLocale)) {
            return;
        }
        if (!isWidgetLocale(locale)) {
            setInternalLocale(nextLocale);
        }
        onLocaleChange?.(nextLocale);
    }, [locale, onLocaleChange]);
    const t = useCallback((key, params) => {
        const primaryDictionary = resolvedLocale === "en" ? widgetMessagesEn : widgetMessagesVi;
        const secondaryDictionary = resolvedLocale === "en" ? widgetMessagesVi : widgetMessagesEn;
        const template = messages?.[key] ?? primaryDictionary[key] ?? secondaryDictionary[key] ?? key;
        return interpolate(template, params);
    }, [messages, resolvedLocale]);
    const value = useMemo(() => ({ locale: resolvedLocale, setLocale, t }), [resolvedLocale, setLocale, t]);
    return _jsx(WidgetI18nContext.Provider, { value: value, children: children });
}
export function useWidgetI18n() {
    return useContext(WidgetI18nContext);
}
