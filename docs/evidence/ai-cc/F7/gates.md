# AI CC Slice F — F7 Prompt Config History + Rollback — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice F F7  
**Ledger**: Entry 210  
**AC**: F-AC7 — history append on save; GET old version; rollback restores it.

---

## What changed

### BE

| File | Change |
|------|--------|
| `advisory/models.py` | `UserAICredential.prompt_config_history` JSONField (`default=list`, cap 20 via helper) |
| `advisory/migrations/0009_useraicredential_prompt_config_history.py` | AddField |
| `advisory/advisory_helpers.py` | `PROMPT_CONFIG_HISTORY_LIMIT = 20`; `_append_prompt_config_history(user_cred, config, source=...)` |
| `user_workspace/portfolio_analytics_views.py` PUT | Detect `ai_prompt_config` change → append `{version, config, saved_at, source: save}` after first save |
| `user_workspace/portfolio_analytics_views.py` GET/PUT response | `ai_prompt_config_history` (full configs → F-AC7 GET old) |
| `user_workspace/portfolio_analytics_views.py` | `PortfolioAICommandCenterPromptConfigRollbackView` POST `{version}` → restore + append `source=rollback` + audit log |
| `user_workspace/urls.py` | `workspace/ai-command-center/prompt-config/rollback/` |

**History entry shape:**
```json
{ "version": 1, "config": { ... }, "saved_at": "ISO-8601", "source": "save" | "rollback" }
```

### FE

| File | Change |
|------|--------|
| `adapters/core/workspace.js` | `rollbackAICommandCenterPromptConfig(version)` → POST rollback |
| `AICommandCenterPage.tsx` | `promptHistory` state from GET; ShellPanel list + Restore button (`prompt-history-list` / `prompt-history-restore-N` / `prompt-history-empty`); notice on success |
| `i18n/vi.js` / `en.js` | `aiCommandCenter.promptHistory*` ×8 (Title, Desc, Empty, Version, Restore, Restoring, Restored, RestoreError) VI+EN |
| `components/__tests__/ai-cc-contract-smoke.component.test.ts` | BE fixture + FE consumed += `ai_prompt_config_history` |

---

## Acceptance

| ID | Criteria | Verify | Result |
|----|----------|--------|--------|
| F-AC7a | PUT changed config appends history (`source=save`, version+, full config) | BE test | **PASS** |
| F-AC7b | PUT identical config → no duplicate entry | BE test | **PASS** |
| F-AC7c | GET returns history with full config (rollback GET old) | BE test | **PASS** |
| F-AC7d | POST rollback version restores `prompt_config` + appends `source=rollback` | BE test | **PASS** |
| F-AC7e | History capped at 20 (oldest dropped) | BE test | **PASS** |
| F-AC7f | Invalid version → 400; history isolated per user | BE test | **PASS** |
| F-AC7g | FE renders history + Restore button | tsc + vitest page+contract | **PASS** |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| BE check | `manage.py check` | **0 issues** |
| BE migrations | `makemigrations --check --dry-run` | **No changes detected** |
| BE tests F7 + isolation + mgmt | `test_ai_cc_prompt_history test_ai_cc_config_isolation test_ai_management_center` | **45 tests OK** |
| FE type-check | `npx tsc --noEmit` | **0** |
| FE build | `npm run build` | **PASS 20.11s** |
| FE eslint (touched) | page + workspace + contract | **0 errors** |
| FE vitest | contract-smoke + AICommandCenterPage | **2 files / 14 PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| hardcode scan | `slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |
| check:shell | `npm run check:shell` | **exit 0** (admin SPA routes PASS) |

**Key parity**: `promptHistory*` present in both `vi.js` and `en.js` (count=8 keys × 2 files).

---

## Notes

- **Isolation**: history lives on `UserAICredential` — per-user, C-AC3 extension (test_f).
- **Cap**: `PROMPT_CONFIG_HISTORY_LIMIT=20` — append-only, front-trim.
- **Idempotent save**: same dict → no history growth (F-AC7b).
- **Audit**: rollback writes `AIAuditLog` `UPDATE_SETTINGS` with reason mentioning version.
- **Not in scope F7**: Shell extract (F8), task routing (F9), F6b proxy.

---

**Verdict**: F7 **DONE** (Entry 210). Remaining Slice F backlog: F8 shell extract, F9 routing; F6b blocked proxy C2; manual E2E §3.3 PENDING.
