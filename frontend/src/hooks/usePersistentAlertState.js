import { useCallback, useMemo, useState } from 'react';

const READ_ALERTS_KEY = 'dashboard.alerts.read_ids';
const MUTED_SYMBOLS_KEY = 'dashboard.alerts.muted_symbols';
const ALERT_SOUND_KEY = 'dashboard.alerts.alert_sound';
const LEGACY_SOUND_ENABLED_KEY = 'dashboard.alerts.critical_sound_enabled';

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function loadReadAlertIds() {
  if (typeof window === 'undefined') return new Set();
  const parsed = safeParse(window.localStorage.getItem(READ_ALERTS_KEY) || '[]', []);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.map((item) => String(item)));
}

function loadMutedSymbols() {
  if (typeof window === 'undefined') return {};
  const parsed = safeParse(window.localStorage.getItem(MUTED_SYMBOLS_KEY) || '{}', {});
  if (!parsed || typeof parsed !== 'object') return {};

  const now = Date.now();
  const cleaned = {};
  Object.entries(parsed).forEach(([symbol, ts]) => {
    const until = Number(ts) || 0;
    if (until > now) {
      cleaned[symbol] = until;
    }
  });
  return cleaned;
}

function loadCriticalSoundEnabled() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(ALERT_SOUND_KEY);
  if (raw !== null) return raw === 'true';

  const legacyRaw = window.localStorage.getItem(LEGACY_SOUND_ENABLED_KEY);
  if (legacyRaw !== null) {
    window.localStorage.setItem(ALERT_SOUND_KEY, legacyRaw);
    return legacyRaw === 'true';
  }

  return true;
}

export default function usePersistentAlertState() {
  const [readAlertIds, setReadAlertIds] = useState(loadReadAlertIds);
  const [mutedSymbols, setMutedSymbols] = useState(loadMutedSymbols);
  const [criticalSoundEnabled, setCriticalSoundEnabled] = useState(loadCriticalSoundEnabled);

  const persistReadAlerts = useCallback((nextSet) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READ_ALERTS_KEY, JSON.stringify([...nextSet]));
  }, []);

  const persistMutedSymbols = useCallback((nextMutedSymbols) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MUTED_SYMBOLS_KEY, JSON.stringify(nextMutedSymbols));
  }, []);

  const markAlertAsRead = useCallback((alertId) => {
    if (!alertId) return;
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      next.add(String(alertId));
      persistReadAlerts(next);
      return next;
    });
  }, [persistReadAlerts]);

  const isMutedSymbol = useCallback((symbol) => {
    if (!symbol) return false;
    const mutedUntil = mutedSymbols[String(symbol).toUpperCase()];
    if (!mutedUntil) return false;
    return Date.now() < mutedUntil;
  }, [mutedSymbols]);

  const muteSymbolFor30m = useCallback((symbol) => {
    if (!symbol) return;
    const normalized = String(symbol).toUpperCase();
    setMutedSymbols((prev) => {
      const next = {
        ...prev,
        [normalized]: Date.now() + (30 * 60 * 1000),
      };
      persistMutedSymbols(next);
      return next;
    });
  }, [persistMutedSymbols]);

  const toggleCriticalSound = useCallback(() => {
    setCriticalSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        const serialized = String(next);
        window.localStorage.setItem(ALERT_SOUND_KEY, serialized);
        window.localStorage.setItem(LEGACY_SOUND_ENABLED_KEY, serialized);
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    readAlertIds,
    mutedSymbols,
    criticalSoundEnabled,
    markAlertAsRead,
    isMutedSymbol,
    muteSymbolFor30m,
    toggleCriticalSound,
  }), [
    readAlertIds,
    mutedSymbols,
    criticalSoundEnabled,
    markAlertAsRead,
    isMutedSymbol,
    muteSymbolFor30m,
    toggleCriticalSound,
  ]);

  return value;
}
