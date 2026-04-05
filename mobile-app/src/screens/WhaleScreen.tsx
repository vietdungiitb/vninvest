import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatNumber, formatTime as formatLocaleTime } from '../i18n';
import { buildRealtimeWebSocketUrl } from '../services/realtime';
import { getAccessToken } from '../services/tokenStorage';
import {
  getAggregateWhaleFeed,
  getTrackedSymbols,
  getWhaleAdvisories,
  refreshWhaleAdvisory,
} from '../services/watchlistApi';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';
import type { TrackedSymbolItem, WhaleAdvisoryItem, WhaleAlertItem } from '../types/watchlist';

type ConnectionStatus = 'connected' | 'polling' | 'disconnected';

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVnd = (value: number | string | undefined | null, locale: 'vi' | 'en'): string =>
  formatNumber(value, locale, { maximumFractionDigits: 0 });

const formatTime = (value: string | undefined, locale: 'vi' | 'en'): string => {
  if (!value) {
    return '--:--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleTime(date, locale);
};

const normalizeWhaleAlert = (payload: Record<string, unknown>): WhaleAlertItem | null => {
  const symbolRaw = String(payload.symbol ?? '').trim().toUpperCase();
  if (!symbolRaw) {
    return null;
  }
  const matchedValue = toNumber(payload.matched_value as number | string | undefined);
  const ts = String(payload.ts ?? payload.created_at ?? new Date().toISOString());
  const id = Number(payload.id ?? Date.now());

  return {
    id: Number.isFinite(id) ? id : Date.now(),
    symbol: symbolRaw,
    ts,
    time: String(payload.time ?? ''),
    side: String(payload.side ?? '').toLowerCase(),
    price: toNumber(payload.price as number | string | undefined),
    volume: toNumber(payload.volume as number | string | undefined),
    matched_value: matchedValue,
    display_score: toNumber(payload.display_score as number | string | undefined),
    severity: String(payload.severity ?? ''),
    event_type: String(payload.event_type ?? 'whale_alert'),
  };
};

export function WhaleScreen() {
  const t = useLocaleStore((s) => s.t);
  const locale = useLocaleStore((s) => s.locale);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbolItem[]>([]);
  const [alerts, setAlerts] = useState<WhaleAlertItem[]>([]);
  const [advisories, setAdvisories] = useState<WhaleAdvisoryItem[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [sortMode, setSortMode] = useState<'ts' | 'matched_value'>('ts');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackedSymbolCodes = useMemo(
    () => trackedSymbols.map((item) => item.symbol).filter(Boolean),
    [trackedSymbols]
  );

  const loadWhaleSnapshot = useCallback(async (symbols: string[], mode: 'ts' | 'matched_value') => {
    const response = await getAggregateWhaleFeed({
      symbols,
      sort: mode,
      limit: 20,
    });
    setAlerts(response.results || []);
  }, []);

  const loadData = useCallback(async (mode: 'ts' | 'matched_value') => {
    setErrorMessage('');
    const [tracked, advisoryList] = await Promise.all([
      getTrackedSymbols(),
      getWhaleAdvisories().catch(() => []),
    ]);
    setTrackedSymbols(tracked);
    setAdvisories(advisoryList);
    await loadWhaleSnapshot(tracked.map((item) => item.symbol), mode);
  }, [loadWhaleSnapshot]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadData(sortMode);
    } catch {
      setErrorMessage(useLocaleStore.getState().t('whale.error_load'));
    } finally {
      setIsLoading(false);
    }
  }, [loadData, sortMode]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData(sortMode);
    } catch {
      // keep current data visible
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, sortMode]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const symbol = selectedSymbol.trim().toUpperCase();
    if (!symbol) {
      return;
    }
    const exists = trackedSymbols.some((item) => item.symbol === symbol);
    if (!exists) {
      setSelectedSymbol('');
    }
  }, [selectedSymbol, trackedSymbols]);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((symbols: string[], mode: 'ts' | 'matched_value') => {
    clearPolling();
    if (!symbols.length) {
      setConnectionStatus('disconnected');
      return;
    }
    setConnectionStatus('polling');
    pollingRef.current = setInterval(() => {
      loadWhaleSnapshot(symbols, mode).catch(() => undefined);
    }, 10000);
  }, [clearPolling, loadWhaleSnapshot]);

  useEffect(() => {
    clearPolling();
    closeSocket();

    if (!trackedSymbolCodes.length) {
      setConnectionStatus('disconnected');
      return;
    }

    let cancelled = false;

    const initSocket = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || cancelled) {
          startPolling(trackedSymbolCodes, sortMode);
          return;
        }

        const ws = new WebSocket(buildRealtimeWebSocketUrl(accessToken));
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            return;
          }
          setConnectionStatus('connected');
          ws.send(JSON.stringify({ action: 'subscribe', symbols: trackedSymbolCodes }));
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as Record<string, unknown>;
            const eventType = String(payload.event_type ?? '');

            if (eventType === 'whale_alert') {
              const nextAlert = normalizeWhaleAlert(payload);
              if (!nextAlert) {
                return;
              }
              setAlerts((prev) => {
                const deduped = prev.filter((item) => item.id !== nextAlert.id);
                return [nextAlert, ...deduped].slice(0, 30);
              });
              return;
            }

            if (eventType === 'whale_advisory') {
              const normalized: WhaleAdvisoryItem = {
                id: Number(payload.id ?? Date.now()),
                symbol: String(payload.symbol ?? '').toUpperCase(),
                matched_value: toNumber(payload.matched_value as number | string | undefined),
                side: String(payload.side ?? ''),
                threshold: toNumber(payload.threshold as number | string | undefined),
                ai_summary: String(payload.ai_summary ?? ''),
                ai_detail: String(payload.ai_detail ?? ''),
                ai_provider: String(payload.ai_provider ?? ''),
                created_at: String(payload.created_at ?? new Date().toISOString()),
              };
              setAdvisories((prev) => {
                const deduped = prev.filter((item) => item.id !== normalized.id);
                return [normalized, ...deduped].slice(0, 30);
              });
            }
          } catch {
            return;
          }
        };

        ws.onerror = () => {
          if (!cancelled) {
            setConnectionStatus('polling');
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            startPolling(trackedSymbolCodes, sortMode);
          }
        };
      } catch {
        startPolling(trackedSymbolCodes, sortMode);
      }
    };

    initSocket();

    return () => {
      cancelled = true;
      clearPolling();
      closeSocket();
    };
  }, [clearPolling, closeSocket, sortMode, startPolling, trackedSymbolCodes]);

  const filteredAlerts = useMemo(() => {
    const symbol = selectedSymbol.trim().toUpperCase();
    if (!symbol) {
      return alerts;
    }
    return alerts.filter((item) => item.symbol === symbol);
  }, [alerts, selectedSymbol]);

  const selectedAdvisories = useMemo(() => {
    const symbol = selectedSymbol.trim().toUpperCase();
    if (!symbol) {
      return advisories.slice(0, 6);
    }
    return advisories.filter((item) => item.symbol === symbol).slice(0, 6);
  }, [advisories, selectedSymbol]);

  const connectionText =
    connectionStatus === 'connected'
      ? t('whale.status_connected')
      : connectionStatus === 'polling'
        ? t('whale.status_polling')
        : t('whale.status_disconnected');

  const onRefreshAdvisory = async (symbol: string) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const result = await refreshWhaleAdvisory(symbol);
      setInfoMessage(result.message || t('whale.info_refreshed', { symbol }));
    } catch {
      setErrorMessage(t('whale.error_refresh_advisory'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('whale.title')}</Text>
          <Text style={styles.meta}>{t('whale.connection_prefix', { status: connectionText })}</Text>
          <Text style={styles.meta}>{t('whale.tracked_count', { count: trackedSymbols.length, symbol: selectedSymbol || t('whale.all_symbols') })}</Text>
          {!trackedSymbols.length ? <Text style={styles.meta}>{t('whale.empty_tracked')}</Text> : null}
        </View>

        {!!trackedSymbols.length && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('whale.symbol_filter', { symbol: selectedSymbol || t('whale.all_symbols') })}</Text>
            <View style={styles.chipWrap}>
              <Pressable
                style={[styles.chip, !selectedSymbol && styles.chipActive]}
                onPress={() => setSelectedSymbol('')}
              >
                <Text style={[styles.chipText, !selectedSymbol && styles.chipTextActive]}>{t('whale.all_symbols')}</Text>
              </Pressable>
              {trackedSymbols.map((item) => {
                const active = selectedSymbol === item.symbol;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedSymbol(active ? '' : item.symbol)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.symbol}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('whale.whale_hub_title')}</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.chip, sortMode === 'ts' && styles.chipActive]}
              onPress={async () => {
                setSortMode('ts');
                try {
                  await loadWhaleSnapshot(trackedSymbolCodes, 'ts');
                } catch {
                  setErrorMessage(t('whale.error_whale_time'));
                }
              }}
            >
              <Text style={[styles.chipText, sortMode === 'ts' && styles.chipTextActive]}>{t('whale.sort_time')}</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, sortMode === 'matched_value' && styles.chipActive]}
              onPress={async () => {
                setSortMode('matched_value');
                try {
                  await loadWhaleSnapshot(trackedSymbolCodes, 'matched_value');
                } catch {
                  setErrorMessage(t('whale.error_whale_value'));
                }
              }}
            >
              <Text style={[styles.chipText, sortMode === 'matched_value' && styles.chipTextActive]}>{t('whale.sort_value')}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={bootstrap}>
              <Text style={styles.ghostText}>{t('whale.refresh')}</Text>
            </Pressable>
          </View>

          {!filteredAlerts.length ? <Text style={styles.meta}>{t('whale.empty_alerts')}</Text> : null}

          {filteredAlerts.slice(0, 12).map((item) => (
            <View key={`${item.id}-${item.ts}`} style={styles.alertRow}>
              <View>
                <Text style={styles.alertSymbol}>{item.symbol}</Text>
                <Text style={styles.meta}>{t('whale.time_label', { time: formatTime(item.ts, locale) })}</Text>
                <Text style={styles.meta}>{t('whale.side_label', { side: (item.side || 'neutral').toUpperCase() })}</Text>
              </View>
              <View style={styles.alertRight}>
                <Text style={styles.alertValue}>{formatVnd(item.matched_value, locale)} VND</Text>
                <Text style={styles.meta}>{t('whale.score_label', { score: toNumber(item.display_score).toFixed(1) })}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('whale.whale_detail_title')}</Text>
          <Text style={styles.meta}>{t('whale.symbol_filter', { symbol: selectedSymbol || t('whale.all_symbols') })}</Text>

          {!selectedAdvisories.length ? <Text style={styles.meta}>{t('whale.empty_advisory')}</Text> : null}

          {selectedAdvisories.map((item) => (
            <View key={item.id} style={styles.advisoryRow}>
              <View style={styles.advisoryHeader}>
                <Text style={styles.alertSymbol}>{item.symbol}</Text>
                <Pressable style={styles.smallButton} onPress={() => onRefreshAdvisory(item.symbol)} disabled={isSaving}>
                  <Text style={styles.smallText}>{t('whale.refresh_ai')}</Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>{t('whale.advisory_meta', { side: item.side.toUpperCase(), time: formatTime(item.created_at, locale) })}</Text>
              <Text style={styles.meta}>{t('whale.matched_label', { value: formatVnd(item.matched_value, locale) })}</Text>
              <Text style={styles.advisorySummary} numberOfLines={2}>{item.ai_summary || t('whale.no_summary')}</Text>
              {item.ai_detail ? <Text style={styles.advisoryDetail} numberOfLines={3}>{item.ai_detail}</Text> : null}
            </View>
          ))}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#1b2a48',
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostText: {
    color: colors.muted,
    fontWeight: '600',
  },
  alertRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  alertSymbol: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  alertRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  alertValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  advisoryRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  advisoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advisorySummary: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  advisoryDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  error: {
    color: '#fca5a5',
    fontSize: 12,
  },
  info: {
    color: '#86efac',
    fontSize: 12,
  },
});