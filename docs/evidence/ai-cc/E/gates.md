# AI CC Slice E — i18n hardcode + polish — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Rev.3 Slice E  
**Ledger**: Entry 205  
**Scope**: 4 component files → `t()` + `localeTag` + EN RTL test. Defer E.1 item 3 (accent-color) + item 4 (API-key mask) → F (per plan note).  
**Shell page**: `ShellAiCommandCenterPage.tsx` still ships (`pageRegistry.js:203-204`) but ~100 strings remain hardcode — **DEFERRED** (separate slice; not in E scope per plan Files list “nếu còn ship” note). Evidence recorded.

---

## Files changed

```
packages/web/src/components/AIUsageDashboard.tsx                 | TABLE_HEADER_KEYS / CSV_HEADER_KEYS / PERIOD_KEYS / toCsv(localeTag) / thead props fix
packages/web/src/components/AIAgentFederationPanel.tsx           | placeholders :185/:225, yes/no :287, loading/actions keys
packages/web/src/components/AIAuditLogsPanel.tsx                 | actionOptions, actorPlaceholder, auditShowing, reasonPrefix, toLocaleString(localeTag), deps += t
packages/web/src/components/AIAdvisoryPromptConfigDrawer.js      | promptDrawerFooter :351
packages/web/src/i18n/vi.js                                      | +32 keys (Slice E + prior intentional)
packages/web/src/i18n/en.js                                      | +32 keys (parity)
packages/web/src/components/AISliceE.i18n.component.test.js      | NEW — EN locale RTL E-AC1/2/3
packages/web/scripts/slice-e-hardcode-scan.mjs                   | NEW — hardcode pattern scanner (node, UTF-8 safe)
packages/web/src/components/AIUsageDashboard.component.test.js   | keys → aiUsageAnalytics.* (B.4 namespace)
```

**Bug fix found by E-AC1**: `e("thead", e("tr", …))` passed `tr` as *props* (missing `null` args) → headers never rendered as children. Fixed to `e("thead", null, e("tr", null, …))` at `AIUsageDashboard.tsx:201`. Pre-existing latent bug (HEAD has same pattern); test previously passed only because it never asserted header cells under empty-records path.

**Test fix**: Agents panel calls `useConfirm()` → needs `ConfirmProvider`. Test mocks `./ConfirmModal.js` (`ConfirmProvider` passthrough + `useConfirm` resolved true) per convention used by 8 other component tests.

---

## i18n keys added (vi.js + en.js, intentional +32/file)

### `aiCommandCenter.*` (Slice E)

| Key | vi.js | en.js |
|-----|-------|-------|
| `actionAll` | `Tất cả hành động` (`:5166`) | `All actions` (`:5078`) |
| `actionUpdateSettings` | `Cập nhật cấu hình` | `Update settings` |
| `actionTestSuccess` | `Test kết nối thành công` | `Connection test succeeded` |
| `actionTestFailed` | `Test kết nối thất bại` | `Connection test failed` |
| `actorPlaceholder` | `VD: admin` | `e.g. admin` |
| `loadError` | `Không tải được audit logs.` | `Could not load audit logs.` |
| `auditShowing` | `{total} bản ghi — Trang {page}/{totalPages}` | `{total} records — Page {page}/{totalPages}` |
| `reasonPrefix` | `Lý do:` | `Reason:` |
| `promptDrawerFooter` | `Cấu hình được đồng bộ tự động và áp dụng cho lượt Làm mới tiếp theo.` | `Config syncs automatically and applies on the next refresh.` |

### `aiAgentFederation.*`

| Key | vi.js | en.js |
|-----|-------|-------|
| `yes` | `Có` (`:5248`) | `Yes` (`:5228`) |
| `no` | `Không` (`:5249`) | `No` (`:5229`) |
| (+ `loading`, `actions`) | present | present |

### `aiUsageAnalytics.*`

| Key | vi.js | en.js |
|-----|-------|-------|
| `prev` | `← Trước` (`:5290`) | `← Previous` (`:5270`) |
| `next` | `Sau →` (`:5291`) | `Next →` (`:5271`) |
| `pageOf` | `Trang {page} / {total}` (`:5292`) | `Page {page} / {total}` (`:5272`) |
| `perPage` | `Hiển thị:` (`:5293`) | `Show:` (`:5273`) |
| (+ `exporting`, `exportCsv`, `empty`, `showing`) | present | present |

Reuse existing keys (no new `col*`): `TABLE_HEADER_KEYS` maps to `createdAt|action|provider|model|tokensIn|tokensOut|cost|latency|status`; periods → `last7Days|last30Days|last90Days`.  
Old blocks `usage:` / `agentFederation:` remain DEPRECATED (F-C7 defer 1 sprint).

---

## Code changes detail

### 1. `AIUsageDashboard.tsx`
- `TABLE_HEADER_KEYS` / `CSV_HEADER_KEYS` / `PERIOD_KEYS` — header + CSV via `t(key)`.
- `toCsv(records, localeTag, t)` — dates `toLocaleString(localeTag)`; no `||` fallback on translated labels.
- Pagination `prev`/`next`/`pageOf`/`perPage` via keys; empty via `aiUsageAnalytics.empty`.
- **thead fix**: `e("thead", null, e("tr", null, …))`.

### 2. `AIAgentFederationPanel.tsx`
- Placeholders `:185` → `t("aiAgentFederation.placeholderName")`, `:225` → `placeholderCapabilities`.
- Yes/No `:287` → `t("…yes")` / `t("…no")`.

### 3. `AIAuditLogsPanel.tsx`
- `actionOptions` built from `t()` keys; `actorPlaceholder`; `reasonPrefix`; `auditShowing` for pager.
- `formatDate` → `toLocaleString(localeTag)` (was hardcoded `"vi-VN"`).
- `useEffect` deps += `t` so language switch re-renders filters.

### 4. `AIAdvisoryPromptConfigDrawer.js:351`
- Footer span → `t("aiCommandCenter.promptDrawerFooter")`.

---

## Acceptance Criteria

| ID | Criteria | Verify | Result |
|----|----------|--------|--------|
| E-AC1 | Locale **EN** Usage table full English (headers, periods, pagination); no VI hardcode | RTL vitest | **PASS** |
| E-AC2 | Locale **EN** Agents: Yes/No + EN placeholders; no `Có/Không`/`VD:` | RTL vitest | **PASS** |
| E-AC3 | Drawer footer EN key; no VI sync sentence | RTL vitest | **PASS** |
| E-AC4 | Hardcode pattern scan in 4 files = 0 | `node scripts/slice-e-hardcode-scan.mjs` | **PASS** (`TOTAL_HITS=0`) |
| E-AC5 | G1–G5 quality gates | see below | **PASS** |

**Manual screenshots (PENDING — user)**: side-by-side VI/EN for Usage table, Agents table, drawer footer.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npx tsc --noEmit` | **0** |
| Build | `npm run build` | **PASS** (19.30s) |
| ESLint (touched) | `npx eslint AIUsageDashboard + AIAgentFederationPanel + AIAuditLogsPanel + AISliceE test + scan script --max-warnings=0` | **0** |
| Vitest (Slice E + regression) | `npx vitest run AISliceE.i18n + AIUsageDashboard + AIAdvisoryPromptConfigDrawer` | **3 files / 9 tests PASS** |
| Vitest (Slice E only) | `npx vitest run AISliceE.i18n.component.test.js` | **3/3 PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| i18n placeholder | `__STRING_NOT_TRANSLATED__` in `vi.js`/`en.js` | **0 hit** |
| i18n diff | intentional keys only (+32/file), scanner → gitignored `.json` | **clean** |
| Hardcode scan | `node scripts/slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** exit 0 |

**Note**: pre-existing eslint warning `SOURCE_KEYS` unused in `AIAdvisoryPromptConfigDrawer.js:7` — **not introduced by Slice E**; excluded from gate (only `.tsx` + new test + scan script gated). Full-file lint left as pre-existing debt.

---

## Next

**Slice G** → **Slice F** (F6b still blocked on proxy test C2).

---

**Verdict**: Slice E **APPROVED** (code + tests + gates). Manual VI/EN screenshots PENDING. Shell page i18n DEFERRED (out of E scope).
