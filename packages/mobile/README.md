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
