# AI CC Slice A — F-C6 polish: strip `t()||"fallback"` — Gates Evidence (2026-09-24)

**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_SSAOT_20260924.md` Slice A / audit F-C6  
**Ledger**: Entry 208  
**Scope**: Bỏ `|| "VI hardcode"` sau `t("aiCommandCenter.*")` trên key đã guarantee trong catalogs (F-C6). Kèm fix hardcode `toLocaleDateString("vi-VN")` → `localeTag`.

---

## What changed

| File | Change |
|------|--------|
| `AICommandCenterPage.tsx` | **72** replacements: `t("aiCommandCenter.X") \|\| "..."` → `t("aiCommandCenter.X")` |
| `AIAgentFederationPage.tsx` | **1** (`backToHub`) |
| `AIUsageAnalyticsPage.tsx` | **1** (`backToHub`) |
| `AICommandCenterPage.tsx:47` | `useI18n()` → `{ t, localeTag }` |
| `AICommandCenterPage.tsx:620` | `toLocaleDateString("vi-VN")` → `toLocaleDateString(localeTag)` |

**Rationale**: i18next `t()` returns the **key** (truthy) when missing — never `""`/`undefined`. So `t(key) || "fallback"` never runs the fallback on miss; it only dead-codes a second VI string that can drift from the catalog. Tests (`TRANSLATIONS` mock returns `key ?? key`) already catch missing keys as raw keys.

**Grep proof** (0 remaining):

```
t\("aiCommandCenter\.[^"]+"\)\s*\|\|   → 0 in 3 files
toLocaleDateString\("vi-VN")            → 0 in AICommandCenterPage.tsx
```

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npx tsc --noEmit` | **0** |
| Build | `npm run build` | **PASS 49.73s** |
| ESLint (touched) | 3 pages `--max-warnings=0` | **0** |
| Vitest (CC + F regression) | CC page + usage + parity + contract + Slice E | **5 files / 26 tests PASS** |
| i18n:scan | `npm run i18n:scan` | **exit 0** |
| Hardcode scan | `node scripts/slice-e-hardcode-scan.mjs` | **TOTAL_HITS=0** |

---

## Acceptance

| ID | Criteria | Result |
|----|----------|--------|
| F-C6 | 0 × `t("aiCommandCenter.*")\|\|` in AI CC pages | **PASS** |
| E polish | no hardcode `vi-VN` date in CC page | **PASS** (`localeTag`) |

---

## Notes / still open

- **A-AC3** manual screenshot fallback reset — PENDING (user).
- Non-AI-CC pages (`PortfoliosPage`, `BillingCenterPage`) still have hardcode `vi-VN` dates — **out of scope** for F-C6 (separate i18n pass).
- `AIAdvisoryPromptConfigDrawer.js` still has `t(promptConfig.*)||` — **out of scope** (different namespace; F-C6 audit targeted `aiCommandCenter.*` in CC page).

---

**Verdict**: F-C6 **CLOSED**. Next: F6b (blocked proxy C2) / manual E2E §3.3 / F3–F9 backlog.
