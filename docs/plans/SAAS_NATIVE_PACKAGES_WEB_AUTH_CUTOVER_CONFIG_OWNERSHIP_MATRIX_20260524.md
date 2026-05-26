# CONFIG OWNERSHIP MATRIX - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

| Concern | Current owner | Transition owner | End-state owner | Notes |
|---|---|---|---|---|
| Public auth routes | frontend/src/App.jsx | packages/web route catalog | packages/web | host only remains in legacy during transition |
| Login/Register UI | frontend legacy components | packages/web auth pages | packages/web | legacy decommission after soak |
| Auth API calls | frontend/src/api/auth.js | coreApiAdapter | coreApiAdapter | no direct fetch in page layer |
| Token storage keys | mixed context usage | adapter runtime hooks | adapter runtime hooks | centralized ownership required |
| Redirect-on-401 behavior | legacy api client + contexts | package auth runtime | package auth runtime | avoid double redirect loops |
| i18n auth strings | frontend i18n files | packages/web i18n files | packages/web i18n files | Vietnamese default required |
