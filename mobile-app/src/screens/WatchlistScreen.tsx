import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getAccessToken } from '../services/tokenStorage';
import { buildRealtimeWebSocketUrl } from '../services/realtime';
import {
  addTrackedSymbol,
  deleteTrackedSymbol,
  getAggregateWhaleFeed,
  getTrackedSymbols,
  getWatchlistGroups,
  getWhaleAdvisories,
  refreshWhaleAdvisory,
} from '../services/watchlistApi';
import { colors } from '../theme/colors';
import { useLocaleStore } from '../store/localeStore';
import type { TrackedSymbolItem, WhaleAdvisoryItem, WhaleAlertItem, WatchlistGroup } from '../types/watchlist';

type ConnectionStatus = 'connected' | 'polling' | 'disconnected';

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVnd = (value: number | string | undefined | null): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(toNumber(value));

const formatPct = (value: number | string | undefined | null): string => {
  const num = toNumber(value);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
};

const formatTime = (value: string | undefined): string => {
  if (!value) {
    return '--:--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString('vi-VN');
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

export function WatchlistScreen() {
  const t = useLocaleStore((s) => s.t);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbolItem[]>([]);
  const [watchlistGroups, setWatchlistGroups] = useState<WatchlistGroup[]>([]);
  const [alerts, setAlerts] = useState<WhaleAlertItem[]>([]);
  const [advisories, setAdvisories] = useState<WhaleAdvisoryItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [newSymbol, setNewSymbol] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [sortMode, setSortMode] = useState<'ts' | 'matched_value'>('ts');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [flashBySymbol, setFlashBySymbol] = useState<Record<string, 'up' | 'down'>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevChangePctRef = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    const [tracked, groups, advisoryList] = await Promise.all([
      getTrackedSymbols(),
      getWatchlistGroups(),
      getWhaleAdvisories().catch(() => []),
    ]);

    setTrackedSymbols(tracked);
    setWatchlistGroups(groups);
    setAdvisories(advisoryList);

    const symbols = tracked.map((item) => item.symbol);
    await loadWhaleSnapshot(symbols, mode);
  }, [loadWhaleSnapshot]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadData(sortMode);
    } catch {
      setErrorMessage(useLocaleStore.getState().t('watchlist.error_load'));
    } finally {
      setIsLoading(false);
    }
  }, [loadData, sortMode]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData(sortMode);
    } catch {
      // silent - already shows data
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
    const existed = trackedSymbols.some((item) => item.symbol === symbol);
    if (!existed) {
      setSelectedSymbol('');
    }
  }, [selectedSymbol, trackedSymbols]);

  useEffect(() => {
    const nextPrev = { ...prevChangePctRef.current };

    trackedSymbols.forEach((item) => {
      const symbol = String(item.symbol || '').toUpperCase();
      if (!symbol) {
        return;
      }

      const nextValue = toNumber(item.change_pct);
      const prevValue = prevChangePctRef.current[symbol];

      if (prevValue !== undefined && prevValue !== nextValue) {
        const direction: 'up' | 'down' = nextValue > prevValue ? 'up' : 'down';
        setFlashBySymbol((prev) => ({ ...prev, [symbol]: direction }));

        if (flashTimeoutsRef.current[symbol]) {
          clearTimeout(flashTimeoutsRef.current[symbol]);
        }

        flashTimeoutsRef.current[symbol] = setTimeout(() => {
          setFlashBySymbol((prev) => {
            if (!prev[symbol]) {
              return prev;
            }
            const clone = { ...prev };
            delete clone[symbol];
            return clone;
          });
          delete flashTimeoutsRef.current[symbol];
        }, 1100);
      }

      nextPrev[symbol] = nextValue;
    });

    prevChangePctRef.current = nextPrev;
  }, [trackedSymbols]);

  useEffect(() => {
    return () => {
      Object.values(flashTimeoutsRef.current).forEach((id) => clearTimeout(id));
      flashTimeoutsRef.current = {};
    };
  }, []);

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

        const socketUrl = buildRealtimeWebSocketUrl(accessToken);
        const ws = new WebSocket(socketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            return;
          }
          setConnectionStatus('connected');
          ws.send(
            JSON.stringify({
              action: 'subscribe',
              symbols: trackedSymbolCodes,
            })
          );
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
              const normalized = {
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
                const filtered = prev.filter((item) => item.id !== normalized.id);
                return [normalized, ...filtered].slice(0, 30);
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
          if (cancelled) {
            return;
          }
          startPolling(trackedSymbolCodes, sortMode);
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
  }, [trackedSymbolCodes, sortMode, clearPolling, closeSocket, startPolling]);

  const onAddSymbol = async () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol || isSaving) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      await addTrackedSymbol(symbol);
      setNewSymbol('');
      await loadData(sortMode);
      setInfoMessage(t('watchlist.info_added', { symbol }));
    } catch {
      setErrorMessage(t('watchlist.error_add'));
    } finally {
      setIsSaving(false);
    }
  };

  const onDeleteSymbol = async (id: number) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      await deleteTrackedSymbol(id);
      await loadData(sortMode);
      setInfoMessage(t('watchlist.info_removed'));
    } catch {
      setErrorMessage(t('watchlist.error_remove'));
    } finally {
      setIsSaving(false);
    }
  };

  const onRefreshAdvisory = async (symbol: string) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const result = await refreshWhaleAdvisory(symbol);
      setInfoMessage(result.message || t('watchlist.info_refreshed', { symbol }));
    } catch {
      setErrorMessage(t('watchlist.error_refresh_advisory'));
    } finally {
      setIsSaving(false);
    }
  };

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
      ? t('watchlist.status_connected')
      : connectionStatus === 'polling'
        ? t('watchlist.status_polling')
        : t('watchlist.status_disconnected');

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
          <Text style={styles.title}>{t('watchlist.title')}</Text>
          <Text style={styles.meta}>{t('watchlist.connection_prefix', { status: connectionText })}</Text>
          <Text style={styles.meta}>{t('watchlist.tracked_count', { count: trackedSymbols.length, groups: watchlistGroups.length })}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('watchlist.add_symbol_title')}</Text>
          <View style={styles.rowButtons}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder={t('watchlist.symbol_placeholder')}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              value={newSymbol}
              onChangeText={setNewSymbol}
            />
            <Pressable style={styles.primaryButton} onPress={onAddSymbol} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('watchlist.add_button')}</Text>}
            </Pressable>
          </View>

          <View style={styles.chipWrap}>
            {trackedSymbols.map((item) => {
              const selected = selectedSymbol.toUpperCase() === item.symbol;
              const positive = toNumber(item.change_pct) >= 0;
              const flashDirection = flashBySymbol[String(item.symbol || '').toUpperCase()];
              return (
                <View
                  key={item.id}
                  style={[
                    styles.symbolRow,
                    flashDirection === 'up' && styles.symbolRowFlashUp,
                    flashDirection === 'down' && styles.symbolRowFlashDown,
                  ]}
                >
                  <Pressable
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setSelectedSymbol(selected ? '' : item.symbol)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.symbol}</Text>
                  </Pressable>
                  <Text style={[styles.meta, positive ? styles.positiveText : styles.negativeText]}>
                    {formatPct(item.change_pct)}
                  </Text>
                  <Pressable onPress={() => onDeleteSymbol(item.id)} disabled={isSaving}>
                    <Text style={styles.deleteText}>{t('watchlist.remove_button')}</Text>
                  </Pressable>
                </View>
              );
            })}
            {!trackedSymbols.length ? <Text style={styles.meta}>{t('watchlist.empty_symbols')}</Text> : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('watchlist.whale_hub_title')}</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.chip, sortMode === 'ts' && styles.chipActive]}
              onPress={async () => {
                setSortMode('ts');
                try {
                  await loadWhaleSnapshot(trackedSymbolCodes, 'ts');
                } catch {
                  setErrorMessage(t('watchlist.error_whale_time'));
                }
              }}
            >
              <Text style={[styles.chipText, sortMode === 'ts' && styles.chipTextActive]}>{t('watchlist.sort_time')}</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, sortMode === 'matched_value' && styles.chipActive]}
              onPress={async () => {
                setSortMode('matched_value');
                try {
                  await loadWhaleSnapshot(trackedSymbolCodes, 'matched_value');
                } catch {
                  setErrorMessage(t('watchlist.error_whale_value'));
                }
              }}
            >
              <Text style={[styles.chipText, sortMode === 'matched_value' && styles.chipTextActive]}>{t('watchlist.sort_value')}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={bootstrap}>
              <Text style={styles.ghostText}>{t('watchlist.refresh')}</Text>
            </Pressable>
          </View>

          {!filteredAlerts.length ? <Text style={styles.meta}>{t('watchlist.empty_alerts')}</Text> : null}

          {filteredAlerts.slice(0, 12).map((item) => (
            <View key={`${item.id}-${item.ts}`} style={styles.alertRow}>
              <View>
                <Text style={styles.alertSymbol}>{item.symbol}</Text>
                <Text style={styles.meta}>{t('watchlist.time_label', { time: formatTime(item.ts) })}</Text>
                <Text style={styles.meta}>{t('watchlist.side_label', { side: (item.side || 'neutral').toUpperCase() })}</Text>
              </View>
              <View style={styles.alertRight}>
                <Text style={styles.alertValue}>{formatVnd(item.matched_value)} VND</Text>
                <Text style={styles.meta}>{t('watchlist.score_label', { score: toNumber(item.display_score).toFixed(1) })}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('watchlist.whale_detail_title')}</Text>
          <Text style={styles.meta}>{t('watchlist.symbol_filter', { symbol: selectedSymbol || t('watchlist.all_symbols') })}</Text>

          {!selectedAdvisories.length ? <Text style={styles.meta}>{t('watchlist.empty_advisory')}</Text> : null}

          {selectedAdvisories.map((item) => (
            <View key={item.id} style={styles.advisoryRow}>
              <View style={styles.advisoryHeader}>
                <Text style={styles.alertSymbol}>{item.symbol}</Text>
                <Pressable style={styles.smallButton} onPress={() => onRefreshAdvisory(item.symbol)} disabled={isSaving}>
                  <Text style={styles.smallText}>{t('watchlist.refresh_ai')}</Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>Side: {item.side.toUpperCase()} | {formatTime(item.created_at)}</Text>
              <Text style={styles.meta}>{t('watchlist.matched_label', { value: formatVnd(item.matched_value) })}</Text>
              <Text style={styles.advisorySummary} numberOfLines={2}>{item.ai_summary || t('watchlist.no_summary')}</Text>
              {item.ai_detail ? <Text style={styles.advisoryDetail} numberOfLines={3}>{item.ai_detail}</Text> : null}
            </View>
          ))}
        </View>

        {!!watchlistGroups.length && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('watchlist.groups_title')}</Text>
            {watchlistGroups.map((group) => (
              <Text key={group.id} style={styles.meta}>• {group.name}</Text>
            ))}
          </View>
        )}

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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: '#0f172a',
  },
  flexInput: {
    flex: 1,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 74,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
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
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  symbolRowFlashUp: {
    backgroundColor: '#052e16',
  },
  symbolRowFlashDown: {
    backgroundColor: '#3f1d1d',
  },
  positiveText: {
    color: '#22c55e',
  },
  negativeText: {
    color: '#ef4444',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 6,
  },
  smallText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  info: {
    color: '#22c55e',
    fontSize: 13,
  },
});