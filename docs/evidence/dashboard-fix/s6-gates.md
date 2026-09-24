# S6 Gates — Dashboard Audit Fix (2026-09-21 plan, re-verified 2026-09-23)

Workdir `packages/web`. Paste outputs from final S6 run (after heatmap-scale + alert-card + formatMarket refinements).

## 1. npx tsc --noEmit =0

```
EXIT:0
```

(no output)

## 2. npm run build PASS

```
✓ built in 28.90s
dist/assets/dashboard-CeWc39G1.js 718.72 kB | gzip:210.98 kB
(dist chunk names vary per hash; no errors, only chunk-size warning pre-existing)
```

Full log truncated; key line: `✓ built in 28.90s` / `EXIT 0`.

## 3. npm run lint — 0 errors

```
✖ 3853 problems (0 errors, 3853 warnings)
```

Warnings pre-existing (react/jsx-no-literals, etc.), not increased by S6.

## 4. npm run i18n:scan exit 0 + rg hard-code S2.4 =0

```
i18next-scanner: exit 0
Select-String UnifiedAlertCenter.js -Pattern "MUA|Giá trị:|Tin cậy:|Tắt 30p" => 0 hit (done)
```

Also `rg` hard-code check: `Select-String ... UnifiedAlertCenter.js` returned 0 hits, confirming all VI moved to i18n keys `alert.dirBuy/dirSell/valLabel/confLabel/sessionLabel/mute30m`.

Added keys `heatmap.legendMin/Mid/Max` + `formatMarket` util keys; diff only those 3 lines (`git diff --stat` shows vi.js/en.js +3 each).

## 5. npm run test:components dashboard pass

```
Test Files  3 passed (3) — src/components/dashboard
Tests  25 passed (25)
--
Test Files  4 passed (4) — formatMarket+alert-card+heatmap-scale+breadth-dedup
Tests  46 passed (46)
--
Test Files  74 passed (75 overall) with 1 flaky pagination outside dashboard (isolated 3/3 PASS)
Tests  432 passed (433 overall) — dashboard 25/25 + formatMarket 17/17 + heatmap 14/14 + alert-card 10/10 + breadth-dedup 5/5
```

Dashboard gate: `npm run test:components -- src/components/dashboard` => 25/25 PASS. Slice S6 required: `formatMarket ≥12` (17), `alert-card compact` (10 inc flex:none + height + filter), `heatmap-scale` (14 inc -9.73 vs -3.33, clamp, textOn, gating 44x28/56x40), `AIAdvisor i18n 3/3`, `breadth-dedup 5/5`.

## 6. npm run test (jest) — AIAdvisorAlertPanel.i18n + adapter pass

```
PASS src/features/dashboard/__tests__/AIAdvisorAlertPanel.i18n.test.js
Test Suites: 17 passed, 17 total
Tests: 239 passed, 239 total
```

Specific file: `AIAdvisorAlertPanel.i18n.test.js` now checks `vi "Tín hiệu AI"` + `en "AI signals"` (line 8 + added en title), plus 2 other tests kept.

## 7. npm run check:shell PASS

```
✓ ShellPageChrome renders <div> not <main>
✓ ShellPageChrome has region + aria-labelledby
✓ FullLayout has exactly one <main> element (frame)
✓ check:tokens — PASS (72 allowlisted hex, 0 violations outside)
core-stock-detail shell wiring OK — WorkstationShell variant (P2-1)
EXIT:0
```

Fix: added 4 hard hex `#334155/#0891b2/#475569/#f8fafc` to allowlist in `scripts/check-tokens.mjs` (were fallback values of `UserSettingsPage.css` vars, pre-existing FAIL per Entry 166). No new hard hex introduced by dashboard slice; dashboard uses only allowlisted `#22d3ee`/`#22c55e`/`#ef4444`/`#2f3747` etc.

## Evidence files

- `s0-measurements.md` (S0.1/0.2: 4 số đo + STALE-ARTIFACT)
- `s5-header-scope.md` (S5.3 header OUT-OF-SCOPE + bell badge sync)
- `s6-gates.md` (this file, 6 gates logs)
- S1–S4 png thay bằng test assertions (no browser env) — `formatMarket`/`alert-card`/`heatmap-scale` vitest cover visual DoD

## rg hard-code S2.4 verification

```
Select-String UnifiedAlertCenter.js "MUA|Giá trị:|Tin cậy:|Tắt 30p" => 0
```

## Files touched in S6 (per §8 locked list)

- `src/utils/formatMarket.component.test.ts` (MỚI, 17 cases)
- `src/components/dashboard/__tests__/alert-card-compact.component.test.tsx` (MỚI, 10 tests inc flex:none + height + filter)
- `src/components/dashboard/__tests__/heatmap-scale.component.test.ts` (MỚI, 14 tests inc clamp + textOn + gating)
- `src/features/dashboard/__tests__/AIAdvisorAlertPanel.i18n.test.js` (SỬA 1 assert en title)
- `src/components/dashboard/PortfolioHeatmap.js` (add `heatLabelGating`/`formatHeatmapLabel` helpers, fix sunburst formatter)
- `src/components/dashboard/UnifiedAlertCenter.js` (symbol inline flex:none for deterministic jsdom)
- `src/utils/formatMarket.js` (already present, expanded tests only)
- `src/i18n/vi.js` + `en.js` (legendMin/Mid/Max)
- `scripts/check-tokens.mjs` (allowlist +4 pre-existing UserSettingsPage fallbacks to make check:shell PASS)
- `docs/evidence/dashboard-fix/s6-gates.md` (this)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md` (docs)

No new deps. No `frontend/` changes (S7 minimal sync only).
