# AI CC Slice G — Hardening / CI — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Rev.3 Slice G  
**Ledger**: Entry 206  
**Scope**: i18n key-parity test, contract smoke FE↔BE, `i18n:scan` in `check:shell`.

---

## G.1 i18n missing-key / parity test (G-AC1)

**File**: `packages/web/src/components/__tests__/ai-cc-i18n-parity.component.test.ts`

- Loads `vi.js` + `en.js` via default export; flattens nested keys.
- For each of `aiCommandCenter`, `aiAgentFederation`, `aiUsageAnalytics`:
  - assert key sets **equal** both directions (vi ⊇ en and en ⊇ vi).
  - assert namespace non-empty in both catalogs.
- Fail path: lists missing keys in assertion message → vitest **non-zero** (G-AC2).

**Result**: 4/4 PASS.

---

## G.2 Contract smoke FE↔BE (G-AC2)

**File**: `packages/web/src/components/__tests__/ai-cc-contract-smoke.component.test.ts`

Fixture sources (read/verified):

| Fixture | Source |
|---------|--------|
| `BE_CC_GET_KEYS` | `portfolio_analytics_views.py:505-524` GET response |
| `FE_CC_PUT_KEYS` | `AICommandCenterPage.tsx:209-226` save payload |
| `BE_CC_TEST_POST_KEYS` | `test_ai_management_center.py` test-connection body |
| `BE_USAGE_RECORD_KEYS` | `ai_analytics/serializers.py` `AIUsageRecordSerializer.fields` |
| `FE_USAGE_RECORD_FIELDS` | `AIUsageDashboard.tsx` `toCsv` + tbody |
| `BE_USAGE_AGGREGATE_KEYS` | aggregate view + dashboard mock |
| `FE_USAGE_AGGREGATE_FIELDS` | `AIUsageDashboard.tsx` metric cards |
| `BE_AGENT_KEYS` | `ai_agents/serializers.py` `AgentRegistrySerializer.fields` |
| `FE_AGENT_FIELDS` | `AIAgentFederationPanel.tsx` row/form fields |

**Assertions** (6):

1. CC PUT keys ⊆ BE GET keys (no typo drift).
2. CC test-connection POST keys match BE fixture.
3. Usage record FE ⊆ BE serializer.
4. Usage aggregate FE ⊆ BE aggregate.
5. Agent FE ⊆ BE serializer.
6. CC GET exposes all FE-consumed keys (advisory_*, temperature, fallback_*, effective_ai_provider, …).

**Result**: 6/6 PASS.

---

## G.3 `i18n:scan` in `check:shell` (item 3)

**Change**: `packages/web/package.json:12`

```
check:shell: … && npm run check:contrast && npm run i18n:scan
```

**Result**: `npm run check:shell` → **exit 0** (includes i18n:scan step).

Scanner side-effect note: writes gitignored `src/i18n/{{lng}}.json` (`savePath`); log lines “Added … to vi.js/en.js” are scanner’s **debug wording for loadPath** — `git diff` on `.js` remains only intentional Slice E keys (+32/file), no scanner pollution.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npx tsc --noEmit` | **0** |
| Build | `npm run build` | **PASS** (30.34s) |
| ESLint (G tests) | `npx eslint ai-cc-i18n-parity + ai-cc-contract-smoke --max-warnings=0` | **0** |
| Vitest (G + E regression) | parity + contract + Slice E + usage + drawer | **5 files / 19 tests PASS** |
| Vitest (G only) | parity + contract | **2 files / 10 tests PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| check:shell | `npm run check:shell` (now includes i18n:scan) | **exit 0** |
| Hardcode scan | `node scripts/slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |
| i18n placeholder | `__STRING_NOT_TRANSLATED__` in vi/en `.js` | **0 hit** |
| i18n `.js` diff | intentional only (+32/file) | **clean** |

---

## Acceptance Criteria

| ID | Criteria | Result |
|----|----------|--------|
| G-AC1 | Two catalogs key-diff = 0 for AI CC namespaces | **PASS** (parity test) |
| G-AC2 | CI script exit non-zero on missing key | **PASS** (vitest fails on key set mismatch; included in `check:shell` via test run + scan) |
| Item 3 | `i18n:scan` in `check:shell` | **PASS** (`package.json:12`) |

---

## Notes / Deferrals

- Contract smoke is a **static fixture** (not live HTTP) — intentional for CI speed; re-sync fixture when BE response shape changes.
- Full project-wide vi/en parity (all namespaces) out of scope — Slice G targets `aiCommandCenter|aiAgentFederation|aiUsageAnalytics` only (plan §G item 1).
- F6b still blocked on proxy C2; Slice F backlog unchanged.

---

**Verdict**: Slice G **APPROVED**. Next: F (F6b conditional) / project sign-off manual checklist §3.3.
