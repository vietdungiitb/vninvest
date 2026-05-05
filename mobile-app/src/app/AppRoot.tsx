import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { BottomTabBar, type TabKey } from '../components/BottomTabBar';
import { AuthScreen } from '../screens/AuthScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { WhaleScreen } from '../screens/WhaleScreen';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';
import { DEFAULT_ACTIVE_TAB } from '../../../packages/mobile/src/index.js';

export function AppRoot() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const localeBootstrap = useLocaleStore((state) => state.bootstrap);
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_ACTIVE_TAB);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => {
    bootstrap();
    localeBootstrap();
  }, [bootstrap, localeBootstrap]);

  useEffect(() => {
    if (!user) {
      setActiveTab(DEFAULT_ACTIVE_TAB);
    }
  }, [user]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onOpenTransactions={() => setActiveTab('transactions')}
            refreshKey={dashboardRefreshKey}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsScreen
            onBack={() => setActiveTab('dashboard')}
            onTransactionSaved={() => setDashboardRefreshKey((k) => k + 1)}
          />
        )}
        {activeTab === 'watchlist' && (
          <WatchlistScreen />
        )}
        {activeTab === 'whale' && (
          <WhaleScreen />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen />
        )}
      </View>
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
