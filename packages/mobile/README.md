# packages/mobile

Purpose:
- Hold the future mobile package-track migration.
- Remain API-driven against core contracts.
- Own the mobile runtime config boundary before the screen migration lands.

Boundary rules:
- Do not couple directly to vip-app internals.
- Keep package-track work here instead of expanding legacy mobile-app for new architecture.

Current bootstrap surfaces:
- `src/runtimeConfig.js` exposes the shared API, websocket, and demo credential defaults.
- `scripts/check-mobile-config.mjs` smoke-checks the package boundary.
- `mobile-app/src/services/config.ts` re-exports the shared config module through a thin bridge.

Current navigation surfaces:
- `src/navigation/mobileNavigation.js` owns the tab catalog and default active tab.
- `src/components/MobileBottomTabBar.tsx` owns the package-side bottom navigation shell.
- `scripts/check-mobile-navigation.mjs` smoke-checks the package-side navigation contract.

Current shared auth surfaces:
- `src/i18n/index.ts` owns the shared mobile translations and formatting helpers.
- `src/theme/colors.ts` owns the shared mobile color tokens.
- `src/types/auth.ts`, `src/store/authStore.ts`, and `src/store/localeStore.ts` own the shared auth and locale state.
- `src/services/tokenStorage.ts`, `src/services/http.ts`, and `src/services/authApi.ts` own the shared auth transport and token persistence.
- `src/screens/AuthScreen.tsx` owns the package-side auth/login entrypoint.
- `src/screens/ProfileScreen.tsx` owns the package-side profile tab entrypoint.
- `src/screens/HomeScreen.tsx` owns the package-side static home tab entrypoint.
- `mobile-app/src/*` files now consume these surfaces through thin wrappers.

Current transaction/watchlist surfaces:
- `src/types/transaction.ts`, `src/services/transactionApi.ts`, and `src/screens/TransactionsScreen.tsx` own the transaction tab entrypoint.
- `src/types/watchlist.ts`, `src/services/watchlistApi.ts`, `src/services/realtime.ts`, `src/screens/WatchlistScreen.tsx`, and `src/screens/WhaleScreen.tsx` own the tracked-symbol and whale tabs.
- `mobile-app/src/*` files now consume these surfaces through thin wrappers.

Current portfolio surfaces:
- `src/types/portfolio.ts` owns the shared portfolio data contracts.
- `src/services/portfolioApi.ts` owns the shared portfolio read API.
- `src/screens/DashboardScreen.tsx` owns the package-side dashboard tab entrypoint.
