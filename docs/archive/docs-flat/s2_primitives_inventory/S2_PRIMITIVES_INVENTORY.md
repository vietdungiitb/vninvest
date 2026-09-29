# S2 — Theme Primitives Inventory (`theme/theme.module.css`)

Slice S2 introduces a shared design-system module of CSS-Module primitives reused across
≥2 places. It is **consumed** by later slices (S4–S10); this slice only creates the module
and verifies the existing SOC / AI modules are untouched.

## Primitives created

| Primitive group | Classes | Token-driven? | Future consumers (later slices) |
|-----------------|---------|---------------|----------------------------------|
| Button | `.btn`, `.btnPrimary`, `.btnSecondary`, `.btnDanger`, `.btnGhost` | yes | SOC forms, Dashboard, Settings, TenantAdmin |
| Card / Panel | `.card`, `.panelSoft`, `.panelGlass` | yes (`color-mix` from `--bg-panel`) | SOC panels, Dashboard cards |
| Input / Select | `.input`, `.inputFocused`, `.inputError`, `.select`, `.selectTrigger` | yes | replaces `VninvestInput.module.css`, forms everywhere |
| Checkbox / Toggle | `.checkbox`, `.toggle`, `.toggleActive` | yes | SOC forms, Settings |
| Badge / Status | `.badge`, `.badgeSuccess`, `.badgeWarning`, `.badgeDanger`, `.statusDot` | yes | SOC + Dashboard |
| Alert | `.alert`, `.alertInfo`, `.alertSuccess`, `.alertWarning`, `.alertDanger` | yes | Global toasts, SOC ops |
| Tabs | `.tabs`, `.tab`, `.tabActive`, `.tabPanel` | yes | Dashboard, SOC subtabs |
| Modal / Drawer | `.modalOverlay`, `.modalContent`, `.drawerOverlay`, `.drawerContent` | yes | Modals across app |
| Table | `.table`, `.tableHeader`, `.tableRow`, `.tableCell` | yes | SOC tables, Watchlist, Portfolios |
| Skeleton | `.skeleton`, `.skeletonPulse` | yes | Loading states |
| Empty state | `.emptyState`, `.emptyStateIcon`, `.emptyStateText` | yes | Empty lists |
| Toolbar | `.toolbar`, `.toolbarGroup` | yes | Page headers, SOC toolbars |
| Metric | `.metric`, `.metricValue`, `.metricLabel` | yes | Dashboard + SOC metrics |

## Token usage (AC-S2.2)
Every `color` / `background-color` / `border-color` uses a bridged token via `var(--token, fallback)`.
Glassmorphism is achieved with `color-mix(in srgb, <token> <pct>, transparent)` so colors remain
token-driven — no hardcoded hex for color properties (grep result: 0). Fixed values are limited to
`box-shadow` (rgba / `var(--shadow-*)`) and `border-radius` (`var(--radius-*)), which the plan
explicitly permits.

## Import (AC-S2.4)
`theme.module.css` starts with `@import './tokens.css';` so the bridged tokens are available even
though `index.css` already loads them globally — keeps the module self-contained.

## Unchanged (AC-S2.3)
`components/soc/soc.module.css` and `components/aiSettings.module.css` are byte-for-byte unchanged
(`git diff` empty). They continue to work via the global token bridge from S1.

## Acceptance
- AC-S2.1 file exists — PASS
- AC-S2.2 no hardcoded color/background/border-color hex — PASS (0)
- AC-S2.3 SOC / AI modules unchanged — PASS (diff empty)
- AC-S2.4 imports tokens — PASS
- AC-S2.5 `tsc --noEmit` + `npm run build` exit 0 — PASS
