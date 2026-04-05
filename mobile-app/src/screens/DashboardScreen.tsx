import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { colors } from '../theme/colors';
import type { AllocationItem, HoldingItem, PortfolioSummary } from '../types/portfolio';

const toNumber = (value: number | string | undefined | null): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVnd = (value: number | string | undefined | null): string => {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
};

const formatPct = (value: number | string | undefined | null): string => {
  return `${toNumber(value).toFixed(2)}%`;
};

type DashboardScreenProps = {
  onOpenTransactions: () => void;
  refreshKey?: number;
};

export function DashboardScreen({ onOpenTransactions, refreshKey }: DashboardScreenProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [allocation, setAllocation] = useState<AllocationItem[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      setErrorMessage('Khong the tai dashboard. Vui long keo de thu lai.');
    } finally {
      setIsRefreshing(false);
    }
  }, [activePortfolioId]);

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
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const topHoldings = useMemo(() => holdings.slice(0, 6), [holdings]);
  const topAllocation = useMemo(() => allocation.slice(0, 6), [allocation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={loadDashboard} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Xin chao, {user?.username}</Text>
          <Text style={styles.subtitle}>{summary?.portfolio_name || 'Portfolio Dashboard'}</Text>
          <Text style={styles.meta}>Email: {user?.email || '-'}</Text>
          <Text style={styles.meta}>Plan: {user?.plan || '-'}</Text>
          {summary?.last_updated ? <Text style={styles.meta}>Last update: {summary.last_updated}</Text> : null}
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tong gia tri</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_market_value)} VND</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Unrealized P/L</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_unrealized_pl)} VND</Text>
            <Text style={styles.metricSub}>{formatPct(summary?.total_unrealized_pl_pct)}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Realized P/L</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_realized_pl)} VND</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Dividends</Text>
            <Text style={styles.metricValue}>{formatVnd(summary?.total_dividends)} VND</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Holdings</Text>
          {!topHoldings.length ? (
            <Text style={styles.emptyText}>Chua co holdings.</Text>
          ) : (
            topHoldings.map((item) => (
              <View key={item.symbol} style={styles.rowItem}>
                <Text style={styles.rowSymbol}>{item.symbol}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowMeta}>SL: {toNumber(item.quantity).toLocaleString('vi-VN')}</Text>
                  <Text style={styles.rowMeta}>MV: {formatVnd(item.market_value)} VND</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Allocation</Text>
          {!topAllocation.length ? (
            <Text style={styles.emptyText}>Chua co du lieu allocation.</Text>
          ) : (
            topAllocation.map((item) => (
              <View key={item.symbol} style={styles.rowItem}>
                <Text style={styles.rowSymbol}>{item.symbol}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowMeta}>{formatPct(item.percentage)}</Text>
                  <Text style={styles.rowMeta}>{formatVnd(item.value)} VND</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Dang xuat</Text>
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
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  meta: {
    color: colors.text,
    fontSize: 13,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  metricSub: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 4,
  },
  rowSymbol: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
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
  logoutButton: {
    borderRadius: 10,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});
