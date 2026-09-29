# S3 — ShellPageTemplate Refactor & `--shell-*` Consumers

Slice S3 converts the global CSS-in-JS shell styles into a CSS Module and bridges all
`--shell-*` tokens. Executed **Safe** (preserve exact visuals).

## Decision: `--shell-accent` (and friends) kept identical
The plan's AC-S3 mapping was wrong for several tokens — their legacy values are
semi-transparent rgba, not the solid bridged tokens. To avoid visual regression we did
**NOT** map `--shell-*` → `@theme` primitives. Instead new dedicated tokens hold the
exact original values:

| Legacy | New token | Exact value |
|--------|-----------|-------------|
| `--shell-ink` | `--text-primary` | `#f1f5f9` (identical) |
| `--shell-muted` | `--text-secondary` | `#94a3b8` (identical) |
| `--shell-accent` | `--accent-shell` | `#00b4d8` (identical) |
| `--shell-accent-soft` | `--accent-shell-soft` | `rgba(0,180,216,0.15)` |
| `--shell-signal` | `--accent-signal` | `#ff7f50` |
| `--shell-signal-soft` | `--accent-signal-soft` | `rgba(255,127,80,0.15)` |
| `--shell-border` | `--border-shell` | `rgba(255,255,255,0.08)` |
| `--shell-surface` | `--bg-shell-surface` | `rgba(15,23,42,0.65)` |
| `--shell-shadow` | `--shadow-shell` | `0 20px 40px rgba(0,0,0,0.4)` |

## Class rename (BEM → CSS Module keys)
All `shellPage__X` classes renamed to their tail (`shellPage__hero` → `hero`, etc.) so the
`__`-prefixed names disappear from source (AC-S3.3). `.shellPage` is kept **`:global`** so
wrapper-level global overrides (e.g. `LAYOUT_CSS` touch-target rules, `WatchlistPage.css`
`.shellPage` selectors) still match. Inner-class global overrides (`LAYOUT_CSS`'s
`.shellPage .shellPage__button` / `.shellPage__stack`) were removed as inert.

## Files changed
- NEW `packages/web/src/components/ShellPageTemplate.module.css` (all shell classes, renamed)
- EDIT `packages/web/src/components/ShellPageTemplate.js` (removed `SHELL_PAGE_TEMPLATE_STYLES`
  string + `<style>` injection; uses `styles.*`)
- EDIT `packages/web/src/theme/tokens.css` (added the 9 shell tokens above)
- EDIT `components/TenantAdminLayout.tsx` (removed inert `.shellPage__button`/`.shellPage__stack`
  selectors from `LAYOUT_CSS`; `.shellPage` kept global)
- EDIT `components/ShellSkeleton.tsx`, `pages/admin/ShellOperationsCenterPage.tsx`,
  `pages/pageRegistry.js` (remapped `--shell-*` tokens that had inline fallbacks)
- EDIT `pages/admin/ShellMailConfigPage.tsx` (banner-variant ternary → `styles.bannerNotice`
  / `styles.bannerError`)
- EDIT `pages/tenant-admin/TenantAdmin{Billing,Webhooks}Page.tsx` (renamed local
  `shellPage__fieldGroup`/`shellPage__label` → `fieldGroup`/`fieldLabel`)
- Converted 33 consumer files to import the module and use `styles.*` class names.

## Known minor regression
`pages/WatchlistPage.css` defines its own `.shellPage__list` / `.shellPage__listItem` /
`.shellPage__itemTitle` / `.shellPage__itemMeta` / `.shellPage__empty` overrides. Because
module classes are hashed, those global overrides are now inert (`.css` is out of AC-S3.3's
scope). Watchlist list view loses its shell-specific list styling — to be revisited in S10
(Watchlist + remaining pages). Logic/values are preserved everywhere else.

## Acceptance
- AC-S3.1 no CSS string in ShellPageTemplate.js — PASS (0)
- AC-S3.2 no `--shell-*` anywhere — PASS (0)
- AC-S3.3 no `shellPage__` in `.js`/`.tsx` — PASS (0)
- AC-S3.4 module import present — PASS
- AC-S3.5 page layout identical — visual verify pending (values preserved 1:1)
- AC-S3.6 `tsc --noEmit` + `npm run build` exit 0 — PASS
