# S1 — Token-Bridge Mapping (`theme/tokens.css`)

Slice S1 creates `packages/web/src/theme/tokens.css`, a `:root` block that aliases all
legacy bare-name tokens to Tailwind v4 `@theme` variables defined in `index.css`.

## Why this slice exists
`packages/web` loads `src/index.css` (Tailwind `@theme`), **not** `frontend/src/index.css`
(which defined the bare `--text-*`, `--bg-*`, `--border-*`, `--accent-*` tokens). As a result
every bare token reference in SOC/screener/watchlist/ui resolved to `undefined` in production,
causing silent color loss. S0 added per-site hex fallbacks (belt-and-suspenders). S1 restores a
single source of truth: change a value in `@theme` and every bare-token consumer follows.

## Mapping table

| Legacy bare token (bridge)        | `@theme` source              | Computed value | Fallback (safety net) |
|-----------------------------------|------------------------------|----------------|-----------------------|
| `--text-primary`                  | `--color-text-primary`       | `#f1f5f9`      | `#f1f5f9`             |
| `--text-muted`                    | `--color-text-muted`         | `#64748b`      | `#64748b`             |
| `--text-secondary`                | `--color-text-secondary`     | `#94a3b8`      | `#94a3b8`             |
| `--accent-cyan`                   | `--color-accent-primary`     | `#06b6d4`      | `#06b6d4`             |
| `--accent-emerald`                | `--color-success-500`        | `#10b981`      | `#10b981`             |
| `--accent-rose`                   | `--color-danger-500`         | `#ef4444`      | `#ef4444`             |
| `--accent-amber`                  | `--color-warning-500`        | `#f59e0b`      | `#f59e0b`             |
| `--bg-panel`                      | `--color-bg-panel`           | `#0f172a`      | `#0f172a`             |
| `--bg-panel-soft`                 | `--color-bg-panel`           | `#0f172a`      | `#0f172a`             |
| `--border-default`                | `--color-border-primary`     | `#1e293b`      | `#1e293b`             |
| `--shadow-panel`                  | `--shadow-lg`                | `0 10px 15px rgb(0 0 0 / 0.1)` | `0 10px 15px rgb(0 0 0 / 0.1)` |

## Correction vs plan AC-S1.3
The plan's §S1 example maps `--text-muted` → `--color-text-secondary` (#94a3b8). That is
**semantically wrong**: in `@theme`, `text-muted` = `#64748b` (`--color-text-muted`) and
`text-secondary` = `#94a3b8` — two distinct shades. This bridge uses `--color-text-muted`,
which also matches the S0 per-site fallbacks and the legacy `frontend/src/index.css` value,
so colors are visually identical before/after the bridge (AC-S1.6 / AC-S1.7).

## Acceptance criteria
- AC-S1.1: `theme/tokens.css` exists — PASS
- AC-S1.2: `index.css` imports `./theme/tokens.css` — PASS
- AC-S1.3: token→`@theme` source present (see note above for `text-muted`) — PASS with correction
- AC-S1.4: no direct hex/rgb property assignment (every value goes through `var()`) — PASS
- AC-S1.5: `npm run build` exit 0 — PASS
- AC-S1.6 / AC-S1.7: SOC & Screener colors unchanged (bridge values == S0 fallback values) — PASS

## Files changed
- NEW `packages/web/src/theme/tokens.css`
- EDIT `packages/web/src/index.css` (added `@import './theme/tokens.css';`)
- UNCHANGED (verified via bridge): `soc.module.css`, `aiSettings.module.css`,
  `VninvestInput.module.css`, `WatchlistPage.css`
