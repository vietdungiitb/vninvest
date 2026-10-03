# AI CC Slice F — Competitive upgrade (F1/F2/F4/F5/F6 subset) — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Rev.3 Slice F  
**Ledger**: Entry 207  
**Scope (this tranche)**: F1 chart, F2 model/status filters, F4 masked key + clear, F5 system prompt viewer, F6 catalog expansion (beyond F6a).  
**Deferred / blocked**: F3 budget soft/hard, F7 version history, F8 shell extract, F9 task routing, F6b (blocked proxy C2), F-C6 polish.

---

## Scope map

| Item | Status | Notes |
|------|--------|-------|
| F1 Usage chart | **DONE** | Real API `getAIUsageSummary` → `buildChartData` → recharts BarChart (not mock) |
| F2 Filter model/status | **DONE** | FE selects + BE `?model=&status=` server filters |
| F3 Budget soft/hard | **DEFERRED** | Separate BE slice |
| F4 Masked key + clear | **DONE** | BE `ai_api_key_masked` + FE clear button; full key never in GET response |
| F5 System prompt template | **DONE** | BE `system_prompt_template` + FE read-only panel |
| F6 Catalog 2025–26 | **DONE (subset)** | openai gpt-4.1/o3, gemini-2.5, claude-4 in `providerModels.ts` |
| F6a gemini-3.8-flash | **DONE** (Entry 204) | already shipped |
| F6b service layer | **BLOCKED** | needs proxy C2 verdict |
| F7 version history | **DEFERRED** | backlog |
| F8 shell form extract | **DEFERRED** | backlog |
| F9 task routing | **DEFERRED** | optional if >2d |
| Accent-color (from E defer) | **VERIFY OK** | `aiSettings.module.css:467,474,891` already has `accent-color: var(--ai-accent)` |

---

## F1 — Usage chart (real API)

**File**: `packages/web/src/components/AIUsageDashboard.tsx`

- `UsageSummaryRow` + `buildChartData()` aggregates `total_tokens_in` by date (slice 10 days).
- Parallel fetch: aggregate + records + **summary** (`getAIUsageSummary`).
- recharts: `ResponsiveContainer > BarChart > CartesianGrid/XAxis/YAxis/Tooltip/Bar`.
- Empty state: `aiUsageAnalytics.chartEmpty`.
- `data-testid="usage-chart"`; CSS `.chartWrap` in `aiSettings.module.css:937`.

**TS note**: recharts + `createElement` overload — components cast `as React.ComponentType<…>` (`Bar` via `as unknown as`).

**Tests**: `AIUsageDashboard.component.test.js` — ResizeObserver polyfill + summary mock; chart renders with data.

**Result**: PASS (part of 5-file vitest).

---

## F2 — Filter by model + status

**BE**: `packages/core/backend/src/ai_analytics/views.py:27-34`

```
model_filter = request.query_params.get('model', '').strip()
if model_filter: queryset = queryset.filter(model=model_filter)
status_filter = request.query_params.get('status', '').strip()
if status_filter: queryset = queryset.filter(status=status_filter)
```

**FE**: `AIUsageDashboard.tsx` — `modelFilter`/`statusFilter` state; filter bar `data-testid="usage-filters" | "filter-model" | "filter-status"`; applied to records + export CSV; options from current rows + `STATUS_OPTIONS=["success","error"]`.

**BE tests**: `ai_analytics/tests/test_usage_permissions.py` `AIUsageModelStatusFilterTests` — model, status, combined (3).

**Tests**: FE filter-params test PASS.

**Result**: PASS.

---

## F4 — Masked API key + clear

**BE** (`portfolio_analytics_views.py`):

- GET `:530` + PUT `:720` → `ai_api_key_masked` = `••••••••{last4}` (decrypt via `identity_access.security.decrypt_user_api_key`, fallback raw; short key → `••••••••`).
- GET still returns `ai_api_key: ''` (`:528`) — full key never in response body.
- PUT clear: `ai_api_key:""` only clears for BYOK providers — **local/openclaw preserved** (pre-existing test `test_put_preserves_api_key_for_local_provider`).

**FE** (`AICommandCenterPage.tsx`):

- Interface += `ai_api_key_masked?: string`.
- Mask row `data-testid="api-key-mask"` when configured && masked && `!aiApiKey`.
- Clear button `data-testid="clear-api-key"` → `handleClearApiKey` PUT `{ai_api_key:""}`.
- Input `type="password"`; state `aiApiKey` stays `""` until user types a new key.

**BE tests** (`test_ai_management_center.py`):

- GET mask assert `'••••••••test'` + not `sk-test` (`:158-159`).
- `test_put_clear_api_key_for_openai_provider` (`:247`) — after clear, mask `''` (`:261`).

**Result**: PASS (F-AC4 — no full key in DOM / GET body).

---

## F5 — System prompt template viewer

**BE**: GET `:531` + PUT `:721` → `system_prompt_template: config.prompt_template or ''`.

**FE**: ShellPanel `data-testid="system-prompt-template"` (pre read-only) or `system-prompt-empty`.

**BE tests**: `test_get_exposes_system_prompt_template` (`:161-166`).

**Result**: PASS (F-AC5 read-only panel).

---

## F6 — Provider catalog 2025–26 (subset)

**File**: `packages/web/src/shared/providerModels.ts`

| Provider | Added |
|----------|-------|
| openai | `gpt-4.1`, `gpt-4.1-mini`, `o3`, `o3-mini` |
| gemini | `gemini-2.5-pro`, `gemini-2.5-flash` (+ F6a `gemini-3.8-flash` already present) |
| claude | `claude-opus-4`, `claude-sonnet-4` |

`UserAICredential.ai_model` has no choices (free string) → user path OK. SystemAISettings choices only via F6a migration 0008.

**Result**: PASS (F-AC6 list correct in FE select).

---

## i18n keys (vi + en, intentional)

### `aiCommandCenter.*` (+7)

| Key | vi | en |
|-----|----|----|
| `apiKeyMaskedLabel` | API Key hiện tại | Current API Key |
| `clearApiKey` | Xóa key | Clear key |
| `apiKeyCleared` | Đã xóa API Key. | API Key cleared. |
| `apiKeyClearFailed` | Không thể xóa API Key. | Could not clear API Key. |
| `systemPromptTitle` | System prompt template | System prompt template |
| `systemPromptDesc` | Template system prompt cấp hệ thống (chỉ đọc). | System-level system prompt template (read-only). |
| `systemPromptEmpty` | Chưa có system prompt template. | No system prompt template yet. |

### `aiUsageAnalytics.*` (+6)

| Key | vi | en |
|-----|----|----|
| `filterModel` | Mô hình | Model |
| `filterStatus` | Trạng thái | Status |
| `filterAll` | Tất cả | All |
| `chartTitle` | Token theo ngày | Tokens by day |
| `chartTokensIn` | Token vào | Tokens in |
| `chartEmpty` | Chưa có dữ liệu biểu đồ. | No chart data yet. |

Parity: `ai-cc-i18n-parity.component.test.ts` covers all 3 namespaces → PASS.

---

## Contract smoke update

`ai-cc-contract-smoke.component.test.ts`:

- `BE_CC_GET_KEYS` += `ai_api_key_masked`, `system_prompt_template`.
- `feConsumed` += both keys → assertion 6 still green.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npx tsc --noEmit` | **0** |
| Build | `npm run build` | **PASS 18.80s** |
| ESLint (touched) | `npx eslint <F files> --max-warnings=0` | **0** |
| Vitest (F + regression) | usage + CC page + parity + contract + Slice E | **5 files / 26 tests PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| Hardcode scan | `node scripts/slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |
| i18n placeholder | `__STRING_NOT_TRANSLATED__` vi/en `.js` | **0 hit** |
| BE check | `manage.py check` | **0 issues** |
| BE makemigrations | `--check --dry-run` | **No changes detected** |
| BE tests | `ai_analytics.tests.test_usage_permissions` + `tests.test_ai_management_center` | **42 tests OK** |

---

## Acceptance Criteria

| ID | Criteria | Result |
|----|----------|--------|
| F-AC1 | Chart non-empty with data mock (real summary API) | **PASS** |
| F-AC2 | Filter changes rows (model/status) | **PASS** |
| F-AC4 | No full key in DOM / GET response | **PASS** (mask + type=password + `ai_api_key:''`) |
| F-AC5 | System prompt read-only panel | **PASS** |
| F-AC6 | Provider catalog list correct | **PASS** (+F6a gemini-3.8-flash) |

---

## Notes / Deferrals

- **F3 / F7 / F8 / F9**: out of this tranche — backlog per plan.
- **F6b**: blocked on proxy C2 (`GEMINI_API_KEY` missing / need live curl).
- **F-C6** (`t()||` polish): still open, separate.
- **Manual E2E §3.3 / E-AC6 screenshots**: PENDING (user).
- Accent-color already present in CSS — no change needed this slice.

---

**Verdict**: Slice F (F1/F2/F4/F5/F6 subset) **APPROVED**. Next: optional F6b when proxy available, or manual sign-off §3.3.
