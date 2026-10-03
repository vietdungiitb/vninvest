# AI CC Slice B rest + F6a — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Rev.3  
**Ledger**: Entry 204  
**Scope**: B rest (nav hub + anchors + back-link) + F6a (catalog `gemini-3.8-flash`)

---

## B rest — Acceptance

| AC | Claim | Result |
|----|-------|--------|
| B-AC1 | Hub nav 5 tabs in-page hash (`#overview`/`#runtime`/`#audit`) + route (`/settings/ai/agents`, `/settings/ai/usage`) | **PASS** — `AICommandCenterPage.tsx:328-353` |
| B-AC2 | Anchors wrap Overview/Runtime/Audit sections | **PASS** — `id="overview"` :357, `id="runtime"` :410, `id="audit"` :595 |
| B-AC3 | Back-link on Agents + Usage pages → `/settings/ai` | **PASS** — `AIAgentFederationPage.tsx:17`, `AIUsageAnalyticsPage.tsx:17` |
| B-AC4 | i18n keys `tabOverview/tabRuntime/tabAudit/tabAgents/tabUsage/backToHub` vi+en | **PASS** — `vi.js:5170-5175`, `en.js:5082-5087` |
| B-AC5 | CSS `hubNav`/`hubNavLink`/`hubNavLinkActive`/`hubBackLink` | **PASS** — `aiSettings.module.css` |

**Test fix**: `AICommandCenterPage.component.test.js` wrap `MemoryRouter` (page calls `useLocation`).

## F6a — Acceptance

| AC | Claim | Result |
|----|-------|--------|
| F-AC6a | FE catalog `gemini-3.8-flash` first in `PROVIDER_MODELS.gemini` | **PASS** — `providerModels.ts` |
| F-AC6b | BE `ModelChoices.GEMINI_38_FLASH` + migration `0008` SystemAISettings only | **PASS** — `models.py`, `0008_systemaisettings_gemini_38_flash.py` |
| F-AC6c | `google-genai` NOT in requirements (comment marker only, C5) | **PASS** — `requirements.txt` comment |
| F-AC6d | `makemigrations --check` clean (C1: UserAICredential no choices) | **PASS** |

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npx tsc --noEmit` | **0** |
| Build | `npm run build` | **PASS** (52.14s / 52.92s) |
| ESLint (touched) | `npx eslint AICommandCenterPage + AIAgentFederationPage + AIUsageAnalyticsPage + test` | **0 err** |
| Vitest | `npx vitest run AICommandCenterPage + AIUsageDashboard` | **2 files / 9 tests PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| i18n placeholder | `grep __STRING_NOT_TRANSLATED__ src/i18n/{vi,en}.js` | **0 hit** |
| i18n diff | intentional keys only (+17/file), scanner writes to gitignored `.json` | **clean** |
| BE check | `manage.py check` | **0 issues** |
| BE migrations | `manage.py makemigrations --check --dry-run` | **No changes detected** |
| Grep old ns | `t("usage.` / `t("agentFederation.` in `packages/web/src` | **0 hit** |

## Notes

- Scanner `savePath` → `src/i18n/{{lng}}.json` (gitignored `packages/web/.gitignore:5-6`); `.js` files untouched by scan.
- EN `fallbackReset` corrected `'Resets'` → `'Reset'`.
- F6b remains blocked on proxy test C2 (see plan Rev.3 §F6b).

---

**Verdict**: B rest + F6a **APPROVED**. Next: Slice E (i18n hardcode + polish U-01…U-08) → G → F.
