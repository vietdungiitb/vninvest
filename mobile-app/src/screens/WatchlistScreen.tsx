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
import {
  addTrackedSymbol,
  deleteTrackedSymbol,
  getTrackedSymbols,
  getWatchlistGroups,
} from '../services/watchlistApi';
import { colors } from '../theme/colors';
import { useLocaleStore } from '../store/localeStore';
import type { TrackedSymbolItem, WatchlistGroup } from '../types/watchlist';

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPct = (value: number | string | undefined | null): string => {
  const num = toNumber(value);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
};

export function WatchlistScreen() {
  const t = useLocaleStore((s) => s.t);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbolItem[]>([]);
  const [watchlistGroups, setWatchlistGroups] = useState<WatchlistGroup[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [newSymbol, setNewSymbol] = useState('');
  const [flashBySymbol, setFlashBySymbol] = useState<Record<string, 'up' | 'down'>>({});

  const prevChangePctRef = useRef<Record<string, number>>({});
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadData = useCallback(async () => {
    setErrorMessage('');
    const [tracked, groups] = await Promise.all([
      getTrackedSymbols(),
      getWatchlistGroups(),
    ]);

    setTrackedSymbols(tracked);
    setWatchlistGroups(groups);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadData();
    } catch {
      setErrorMessage(useLocaleStore.getState().t('watchlist.error_load'));
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } catch {
      // silent - already shows data
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

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
      await loadData();
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
      await loadData();
      setInfoMessage(t('watchlist.info_removed'));
    } catch {
      setErrorMessage(t('watchlist.error_remove'));
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
          <Text style={styles.title}>{t('watchlist.title')}</Text>
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
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{item.symbol}</Text>
                  </View>
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
  error: {
    color: '#fca5a5',
    fontSize: 12,
  },
  info: {
    color: '#86efac',
    fontSize: 12,
  },
});