# AI CC Slice F — F3 Budget soft/hard — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice F F3  
**Ledger**: Entry 209  
**AC**: F-AC3 — soft warning 80%, hard block 100% (BE check), per-user budget respected.

---

## What changed

### BE

| File | Change |
|------|--------|
| `advisory/views.py` | `_resolve_advisory_token_budget(user)` — prefer `UserAICredential.max_tokens_per_day` (user) → system `ADVISORY_TOKEN_BUDGET` |
| `advisory/views.py` | `_advisory_budget_state(user, session_date)` — tokens used / budget / soft 80% / hard 100% / source / remaining / pct |
| `advisory/views.py` `AdvisoryRefreshView` | hard block → 429 + `budget_hard_exceeded` + `budget_source`; soft → 201 `budget_soft_warning` + `budget{}`; audit metadata += budget fields |

**Resolution rules:**
- `max_tokens_per_day > 0` → use user budget (`budget_source: "user"`)
- `null` / `0` / no credential → system `ADVISORY_TOKEN_BUDGET` (`budget_source: "system"`)
- soft: `used >= 0.8 * budget AND used < budget` → `soft_warning=True` (201 still accepted)
- hard: `used >= budget` → 429, no advisory created, audit `reason=token_budget`

### FE

| File | Change |
|------|--------|
| `useStockDetailPageModel.js` | pass `budget_soft_warning` + `budget` from refresh response into `advisoryFallbackFlags` |
| `StockDetailTabs.js` | forward `budgetSoftWarning` + `budget` → banner |
| `AIAdvisoryWarningBanner.js` | show budget warning (amber/red) even without key failure; `localeTag` for reset date (replaces `vi-VN`) |
| `i18n/vi.js` / `en.js` | `aiAdvisoryWarning.budgetSoftWarning` (VI+EN) |

---

## Acceptance

| ID | Criteria | Verify | Result |
|----|----------|--------|--------|
| F-AC3a | User budget override preferred over system | BE unit | **PASS** |
| F-AC3b | Soft warning at 80% on 201 + audit metadata | BE API | **PASS** |
| F-AC3c | Hard block 429 at 100%, no record, audit `token_budget` | BE API | **PASS** |
| F-AC3d | System fallback when no credential / null / 0 | BE unit+API | **PASS** |
| F-AC3e | FE surfaces soft warning in AIAdvisoryWarningBanner | tsc + vitest + manual | automated PASS (visual PENDING user) |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| BE check | `manage.py check` | **0 issues** |
| BE migrations | `makemigrations --check --dry-run` | **No changes detected** |
| BE tests F3 + regression | `test_advisory_budget test_advisory_api_routes test_ai_management_center` | **46 tests OK** |
| FE type-check | `npx tsc --noEmit` | **0** |
| FE build | `npm run build` | **PASS 28.09s** |
| FE eslint (touched) | 3 files `--max-warnings=0` | **0 errors** (3 pre-existing unused-import warnings, not F3) |
| FE vitest | stock-detail + i18n parity | **3 files / 16 PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| hardcode scan | `slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |

**Key parity**: `budgetSoftWarning` present in both `vi.js` and `en.js` (count=2).

---

## Notes

- **Not in scope F3**: model downgrade when budget low (`_resolve_model_for_budget` in advisory observability) — different subsystem; F3 is only soft/hard gate on trigger.
- **429 response shape** extended (`budget_source`, `budget_hard_exceeded`, `budget_soft_warning`) — additive, no break.
- **201 response** adds `budget_soft_warning` + `budget{}` — additive; existing FE ignores unknown keys until banner wired (now wired).
- Manual visual: banner shows on stock detail refresh when 80% threshold hit — **PENDING user screenshots**.

---

**Verdict**: F3 **DONE** (Entry 209). Remaining Slice F backlog: F7 version history, F8 shell extract, F9 routing; F6b blocked proxy C2; manual E2E §3.3 PENDING.
