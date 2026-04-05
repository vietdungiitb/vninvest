import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';

export type TabKey = 'dashboard' | 'transactions' | 'watchlist' | 'whale';

type Tab = {
  key: TabKey;
  labelKey: string;
  icon: string;
};

const TAB_DEFS: Tab[] = [
  { key: 'dashboard', labelKey: 'tabs.dashboard', icon: '◈' },
  { key: 'transactions', labelKey: 'tabs.transactions', icon: '⇄' },
  { key: 'watchlist', labelKey: 'tabs.watchlist', icon: '★' },
  { key: 'whale', labelKey: 'tabs.whale', icon: '≈' },
];

type BottomTabBarProps = {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
};

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  const t = useLocaleStore((s) => s.t);
  return (
    <View style={styles.container}>
      {TAB_DEFS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{t(tab.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  icon: {
    fontSize: 20,
    color: colors.muted,
  },
  iconActive: {
    color: colors.primary,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.primary,
  },
});
