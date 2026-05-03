import { useLocaleStore } from '../store/localeStore';
import { colors } from '../theme/colors';
import {
  MOBILE_TAB_DEFS,
} from '../../../packages/mobile/src/index.js';
import { MobileBottomTabBar } from '../../../packages/mobile/src/components/MobileBottomTabBar.js';

export type TabKey = 'dashboard' | 'transactions' | 'watchlist' | 'whale' | 'profile';

type BottomTabBarProps = {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
};

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  const t = useLocaleStore((s) => s.t);

  return (
    <MobileBottomTabBar
      activeTab={activeTab}
      onTabPress={onTabPress}
      tabs={MOBILE_TAB_DEFS}
      translateLabel={t}
      theme={{
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        mutedColor: colors.muted,
        primaryColor: colors.primary,
      }}
    />
  );
}
