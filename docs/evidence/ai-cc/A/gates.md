# Slice A Gates — IC-SSOT-20260924

**Date:** 2026-09-24  
**Plan:** `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md`  
**Ledger:** Entry 197 (plan), Entry 198 (Slice A), Entry 199 (Rev.2)

## Files changed

```
packages/web/src/i18n/en.js                        |   3 +
packages/web/src/i18n/vi.js                        |   3 +
packages/web/src/pages/AICommandCenterPage.component.test.js | +tests
packages/web/src/pages/AICommandCenterPage.tsx     |  22 ++--
```

## i18n keys added

| Key | vi.js | en.js |
|-----|-------|-------|
| `aiCommandCenter.eyebrow` | Cài đặt | Settings |
| `aiCommandCenter.overview` | Tổng quan | Overview |
| `aiCommandCenter.fallbackReset` | Đặt lại | Resets |

Verified grep:
- vi: `eyebrow: 'Cài đặt'`, `overview: 'Tổng quan'` (block ~5164), `fallbackReset: 'Đặt lại'` (~5196)
- en: `eyebrow: 'Settings'`, `overview: 'Overview'` (~5078), `fallbackReset: 'Resets'` (~5110)

## Code fixes (`AICommandCenterPage.tsx`)

1. **G-10 policy sync after save** — after `setSettings(nextData)`:
   - `setRefreshIntervalDisplay(Number(nextData.advisory_refresh_interval_hours) || …)`
   - `setMaxAutoRefreshes(Number(nextData.advisory_max_auto_refreshes_per_day) || …)`
2. **R-02 quota guard** — IIFE computes `quotaRemaining = remaining ?? 0`, `quotaMax = max || 1`; no non-null `!`.

## G1 — typecheck

```
npx tsc --noEmit
TSC_EXIT=0
```

## G2 — vitest

```
npx vitest run src/pages/AICommandCenterPage.component.test.js
Test Files  1 passed (1)
Tests  6 passed (6)
```

| Test | AC |
|------|-----|
| load settings | existing |
| translated eyebrow/overview, no raw keys | A-AC1, A-AC2 |
| missing `fallback_quota_remaining` → `0 lượt / 5 lượt` | A-AC5 |
| save → `12 giờ/lần` without reload | A-AC4 |
| event gate toggle | existing |
| load fail resilience | existing |

Mock: `t: (key) => TRANSLATIONS[key] ?? key` (not bare `key => key`).

## G4 — i18n:scan

```
npm run i18n:scan → SCAN_EXIT=0
```

## AC checklist

| ID | Result |
|----|--------|
| A-AC1 | PASS (RTL) |
| A-AC2 | PASS (RTL) |
| A-AC3 | PENDING manual screenshot (fallback_reset line) |
| A-AC4 | PASS (vitest) |
| A-AC5 | PASS (vitest) |
| A-AC6 | PASS (TRANSLATIONS map — missing key → raw key assertion) |
| A-AC7 | PASS tsc + vitest + scan (lint/build optional same session) |

## Next

Slice B — SSOT hub nav + dual i18n namespace merge.
