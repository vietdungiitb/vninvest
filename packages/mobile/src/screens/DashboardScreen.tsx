import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getAllocation, getHoldings, getPortfolios, getSummary } from '../services/portfolioApi';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';
import { formatNumber, LOCALE_LABELS } from '../i18n';
import type { AllocationItem, HoldingItem, PortfolioSummary } from '../types/portfolio';

const toNumber = (value: number | string | undefined | null): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVnd = (value: number | string | undefined | null, locale: 'vi' | 'en'): string => {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  });
};

const formatPct = (value: number | string | undefined | null): string => {
  return `${toNumber(value).toFixed(2)}%`;
};

const plColor = (value: number | string | undefined | null): string => {
  const num = toNumber(value);
  if (num > 0) return '#22c55e';
  if (num < 0) return '#f87171';
  return '#94a3b8';
};

type DashboardScreenProps = {
  onOpenTransactions: () => void;
  refreshKey?: number;
};

export function DashboardScreen({ onOpenTransactions, refreshKey }: DashboardScreenProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const t = useLocaleStore((s) => s.t);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [allocation, setAllocation] = useState<AllocationItem[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setErrorMessage('');
    setIsRefreshing(true);
    try {
      let portfolioId = activePortfolioId;
      if (!portfolioId) {
        const portfolios = await getPortfolios();
        if (!portfolios.length) {
          setSummary(null);
          setHoldings([]);
          setAllocation([]);
          return;
        }
        portfolioId = portfolios[0].id;
        setActivePortfolioId(portfolioId);
      }

      const [summaryData, holdingsData, allocationData] = await Promise.all([
        getSummary(portfolioId),
        getHoldings(portfolioId),
        getAllocation(portfolioId),
      ]);

      setSummary(summaryData);
      setHoldings(holdingsData);
      setAllocation(allocationData);
    } catch {
      setErrorMessage(t('dashboard.error_load'));
    } finally {
      setIsRefreshing(false);
    }
  }, [activePortfolioId, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Refresh khi quay lai tu Transactions
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (refreshKey !== undefined) {
      loadDashboard();
    }
  }, [refreshKey, loadDashboard]);

  const topHoldings = useMemo(() => holdings.slice(0, 8), [holdings]);
  const topAllocation = useMemo(() => allocation.slice(0, 8), [allocation]);

  const onOpenProfile = useCallback(() => {
    setIsMenuOpen(false);
    Alert.alert(
      t('dashboard.menu_profile'),
      t('dashboard.profile_info', {
        username: user?.username ?? '-',
        email: user?.email ?? '-',
      })
    );
  }, [t, user?.email, user?.username]);

  const onOpenSettings = useCallback(() => {
    setIsMenuOpen(false);
    Alert.alert(t('dashboard.menu_settings'), t('dashboard.settings_coming_soon'));
  }, [t]);

  const onToggleLanguage = useCallback(async () => {
    setIsMenuOpen(false);
    await setLocale(locale === 'vi' ? 'en' : 'vi');
  }, [locale, setLocale]);

  const onLogout = useCallback(() => {
    setIsMenuOpen(false);
    logout();
  }, [logout]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={loadDashboard} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>{t('dashboard.greeting', { name: user?.username ?? '' })}</Text>
            <Pressable
              style={[styles.menuTrigger, isMenuOpen && styles.menuTriggerActive]}
              onPress={() => setIsMenuOpen((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.menu_open')}
            >
              <Ionicons
                name={isMenuOpen ? 'close' : 'ellipsis-horizontal'}
                size={18}
                color={isMenuOpen ? '#f8fafc' : '#cbd5e1'}
              />
            </Pressable>
          </View>

          {isMenuOpen ? (
            <View style={styles.menuPanel}>
              <Pressable style={styles.menuItem} onPress={onOpenProfile}>
                <Text style={styles.menuItemText}>{t('dashboard.menu_profile')}</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onOpenSettings}>
                <Text style={styles.menuItemText}>{t('dashboard.menu_settings')}</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onToggleLanguage}>
                <Text style={styles.menuItemText}>{t('dashboard.menu_language')}: {LOCALE_LABELS[locale]}</Text>
              </Pressable>
              <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={onLogout}>
                <Text style={styles.menuItemDangerText}>{t('dashboard.menu_logout')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.subtitle}>{summary?.portfolio_name || t('dashboard.portfolio_fallback')}</Text>
          <Text style={styles.meta}>{t('dashboard.email_label')}: {user?.email || '-'}</Text>
          <Text style={styles.meta}>{t('dashboard.plan_label')}: {user?.plan || '-'}</Text>
          {summary?.as_of ? <Text style={styles.meta}>{t('dashboard.last_update')}: {summary.as_of}</Text> : null}
          {summary?.reconciliation_required ? (
            <Text style={styles.metricSub}>{t('dashboard.reconciliation_required')}</Text>
          ) : null}
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('dashboard.nav_label')}</Text>
            {/* `nav` stays `null` when the backend refused to compute it
                (missing `opening_balance`, no prices, ledger not backfilled).
                Showing 0 there would be a fabricated balance, so the reason is
                surfaced instead. */}
            {summary?.nav === null || summary?.nav === undefined ? (
              <Text style={styles.metricValue}>—</Text>
            ) : (
              <Text style={styles.metricValue}>{formatVnd(summary.nav, locale)} VND</Text>
            )}
            {summary?.nav_reason ? (
              <Text style={styles.metricSub}>{summary.nav_reason}</Text>
            ) : null}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('dashboard.total_value')}</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_market_value, locale)} VND</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('dashboard.unrealized_pl')}</Text>
            <Text style={[styles.metricValue, { color: plColor(summary?.total_unrealized_pl) }]}>{formatVnd(summary?.total_unrealized_pl, locale)} VND</Text>
            <Text style={[styles.metricSub, { color: plColor(summary?.total_unrealized_pl_pct) }]}>{formatPct(summary?.total_unrealized_pl_pct)}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('dashboard.realized_pl')}</Text>
            <Text style={[styles.metricValue, { color: plColor(summary?.total_realized_pl) }]}>{formatVnd(summary?.total_realized_pl, locale)} VND</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('dashboard.dividends')}</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_dividends, locale)} VND</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('dashboard.top_holdings')}</Text>
          {!topHoldings.length ? (
            <Text style={styles.emptyText}>{t('dashboard.empty_holdings')}</Text>
          ) : (
            topHoldings.map((item) => (
              <View key={item.symbol} style={styles.rowItem}>
                <Text style={styles.rowSymbol}>{item.symbol}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowMeta}>{t('dashboard.qty_label')}: {formatNumber(item.quantity, locale, { maximumFractionDigits: 0 })} | {t('dashboard.mv_label')}: {formatVnd(item.market_value, locale)} VND</Text>
                  <Text style={[styles.rowMeta, { color: plColor(item.unrealized_pl_pct) }]}>
                    {toNumber(item.unrealized_pl_pct) > 0 ? '+' : ''}{formatPct(item.unrealized_pl_pct)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('dashboard.top_allocation')}</Text>
          {!topAllocation.length ? (
            <Text style={styles.emptyText}>{t('dashboard.empty_allocation')}</Text>
          ) : (
            topAllocation.map((item) => (
              <View key={item.symbol} style={styles.rowItem}>
                <Text style={styles.rowSymbol}>{item.symbol}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowMeta}>{formatPct(item.percentage)} | {formatVnd(item.value, locale)} VND</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable style={styles.secondaryButton} onPress={onOpenTransactions}>
          <Text style={styles.secondaryText}>{t('dashboard.open_transactions')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuTrigger: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  menuTriggerActive: {
    backgroundColor: '#1e293b',
    borderColor: '#475569',
  },
  menuPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#0b1220',
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
    backgroundColor: '#3f1d1d',
  },
  menuItemDangerText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 2,
  },
  meta: {
    color: colors.text,
    fontSize: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  metricSub: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 2,
  },
  rowSymbol: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '700',
  },
});