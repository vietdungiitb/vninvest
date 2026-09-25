# AI CC Slice F — F8 Shell Form Extract (Shared AICommandCenterForm) — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice F F8  
**Ledger**: Entry 211  
**AC**: F-AC8 — 0 field drift: SaaS page + Shell both import shared `AICommandCenterForm` (checklist field list).

---

## What changed

### FE — shared form extract

| File | Change |
|------|--------|
| **NEW** `components/AICommandCenterForm.tsx` | Shared form: `AISettings`, `PromptConfigHistoryEntry`, `AICommandCenterTransport` (getConfig/updateConfig/testConnection); export `AI_CC_FORM_FIELD_TESTIDS` (8); full field set + load/save/test/clear-key + prompt-config drawer; props `t`/`localeTag` override, `onSettingsChange/onSettingsSaved/onError/onNotice/onPromptConfigChange/getExtraPayload`, `showRefreshButton/showPromptConfigButton`; **banner ownership**: local `form-notice`/`form-error` only when parent does **not** pass `onNotice`/`onError` (avoids duplicate DOM text). |
| **REWRITE** `pages/AICommandCenterPage.tsx` | Uses shared form with `adapterTransport` (`coreApiAdapter`); keeps overview/policy/quota/system-prompt/prompt-history/audit/event-gate at page level; page banners own display when `onError`/`onNotice` provided. |
| **REWRITE** `pages/system/ShellAiCommandCenterPage.tsx` | Removes local form duplicate; imports `AICommandCenterForm` + `createTranslator("vi")` (`shellT`); transport via `fetchImpl` GET/PUT/test-connection `/core/v1/workspace/ai-command-center/`; `showRefreshButton=false`, `showPromptConfigButton=false`, `onSettingsSaved → handleRefresh`; form-local banners (no `onError`/`onNotice`). |
| **NEW** `components/__tests__/ai-cc-form-parity.component.test.ts` | F-AC8: checklist export (8 testids); render full fields (local+custom); source-contract — both pages import form; shell must not contain `handleSaveSettings`. |
| `declarations.d.ts` | += `rollbackAICommandCenterPromptConfig`, `testAICommandCenterConnection(data?)`. |

### Field checklist (F-AC8)

```
field-ai-provider, field-ai-model, field-custom-model, field-custom-endpoint,
field-api-key, field-max-tokens, field-refresh-interval, field-temperature
```

### Transport split

| Surface | Transport | i18n |
|---------|-----------|------|
| SaaS `AICommandCenterPage` | `coreApiAdapter` methods | `useI18n()` (LangProvider) |
| Shell `ShellAiCommandCenterPage` | `fetchImpl` + REST path | `createTranslator("vi")` (`shellT`) — no LangProvider |

---

## Acceptance

| ID | Criteria | Verify | Result |
|----|----------|--------|--------|
| F-AC8a | `AI_CC_FORM_FIELD_TESTIDS` exports full 8-field checklist | vitest parity | **PASS** |
| F-AC8b | Form renders every checklist field (local+custom conditional rows) + api-key-mask/clear/save/test | vitest parity | **PASS** |
| F-AC8c | SaaS page AND Shell both import `AICommandCenterForm`; Shell has no local `handleSaveSettings` | source-contract test | **PASS** |
| F-AC8d | Page tests still pass after extract (load/error/save/event-gate/mask/F5) | vitest page 8/8 | **PASS** |
| F-AC8e | Contract smoke still green | vitest contract | **PASS** |
| Banner ownership | No duplicate `getByText` (form local banner suppressed when parent `onError`/`onNotice` provided) | fixed after red run | **PASS** |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| FE type-check | `npx tsc --noEmit` | **0** |
| FE build | `npm run build` | **PASS 32.88s** |
| FE vitest | parity + page + contract-smoke | **3 files / 17 PASS** |
| FE eslint (touched, no max-warnings) | form + page + shell + parity + page-test | **0 errors** (19 `react/jsx-no-literals` warnings — Shell hardcoded VI labels, pre-existing shell pattern) |
| i18n:scan | `npm run i18n:scan` | **exit 0**, pollution `__STRING_NOT_TRANSLATED__` = **0** (F8 adds no new keys) |
| hardcode scan | `slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |
| check:shell | `npm run check:shell` | **exit 0** |

---

## Notes / fixes during F8

1. **Red run (pre-fix)**: 3 vitest failures — (a) `network down` found twice (form `form-error` + page `error-banner`); (b) `Đã xóa API Key.` twice (form `form-notice` + page `notice-banner`); (c) source-contract path `__dirname/..` pointed at `components/` not `src/`.
2. **Fix**: form local banner gated on `!onNotice` / `!onError`; parity test root `path.resolve(__dirname, "../..")`.
3. **Shell eslint**: 19 `react/jsx-no-literals` warnings — intentional (Shell has no LangProvider; labels hardcoded VI via `shellT` for form, chrome strings for shell chrome). Matches pre-existing shell page convention; 0 errors.
4. **No new i18n keys** for F8 — reuses existing `aiCommandCenter.*`.
5. **Not in scope F8**: F9 task routing, F6b proxy, manual E2E §3.3.

---

**Verdict**: F8 **DONE** (Entry 211). Remaining Slice F backlog: F9 routing; F6b blocked proxy C2; manual E2E §3.3 PENDING.
