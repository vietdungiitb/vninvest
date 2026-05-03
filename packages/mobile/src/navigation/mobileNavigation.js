export const MOBILE_TAB_DEFS = [
  { key: 'dashboard', labelKey: 'tabs.dashboard', icon: '◈' },
  { key: 'transactions', labelKey: 'tabs.transactions', icon: '⇄' },
  { key: 'watchlist', labelKey: 'tabs.watchlist', icon: '★' },
  { key: 'whale', labelKey: 'tabs.whale', icon: '≈' },
  { key: 'profile', labelKey: 'tabs.profile', icon: '◎' },
];

export const MOBILE_TAB_KEYS = MOBILE_TAB_DEFS.map((tab) => tab.key);
export const DEFAULT_ACTIVE_TAB = 'dashboard';

export function isMobileTabKey(value) {
  return MOBILE_TAB_KEYS.includes(String(value || ''));
}

export function findMobileTabDefinition(tabKey) {
  return MOBILE_TAB_DEFS.find((tab) => tab.key === tabKey) || null;
}