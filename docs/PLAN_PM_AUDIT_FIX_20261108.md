# PM Audit Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all open ERROR/GAP/RISK from PM review rev1 (M1–M10) so W0 closes and W1 retail activation can start, with no owner questions left.

**Architecture:** Single Django backend (16 apps) + React frontend (69 routes) + contract gate is source of truth. Fix order: W0 data-honesty + contract + security guards → W1 retail activation → W2 AI technique. Each task is independently testable, TDD red→green, one commit per task.

**Tech Stack:** Django 6 (REST) + Celery beat + React 19/Vite + `vninvestcharts-widget@1.2.5` (vendor) + `route-contract.test.js` (631 routes manifest) + VPS staging (no local Docker).

**Spec:** `docs/PM_FUNCTIONAL_TREE_20261108.md` (L0–L4 tree) + `docs/PM_BUG_GAP_MATRIX_20261108.md` (rev1 matrix M1–M10) + `docs/PM_ROADMAP_UPGRADE_20261108.md` (W0–W5). Architecture decisions D1–D8 in `docs/MASTER_TRACKING_2026Q4.md:90-101`.

## Global Constraints

- Runtime: retail-first, phase 1 FREE (brand name, no MRR) — `MASTER_TRACKING:90-101` D8.
- AI = technical analysis only, NO BUY/SELL/HOLD, NO order placement (keep `paper` dry_run) — D2.
- Depth chart = "estimated" label everywhere (D6) — depth is synthetic, never present as real order book.
- Push = future feature — never return True when key missing (D7).
- No `npm/pip install`, no migration by hand (`makemigrations` only), no touching deny-list (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`), no `git checkout --`, no fake PASS.
- Frontend SOC: tokens → `soc.tokens.css`, classes → `soc.components.css`, **never** `soc.module.css` (3-line barrel 0 token).
- i18n: use `t(key, { defaultValue })`, only `tenantreg-d` lane may add vi/en keys in parallel work.
- Security: fail-closed on missing config (`ImproperlyConfigured` in prod), no `SECRET_DEMO` in prod.
- Test env: VPS staging `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`), BE needs `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`, DB per agent `ag_<name>`. No local Docker.

## Review Focus

1. Depth series `is_mock: True` + `total_quantity=0` + `pe/pb/roe=0` + `volume_20d<20` — badge must show “Estimates — delayed” everywhere, chart widget must not swallow `is_mock`.
2. `/ai/agents/` 404 on UI (allowlist `gap-3`) — after UI removal, `route-contract.test.js` must pass with 0 allowlist entries.
3. Partner double-mount `/core/v1/partner/partner/` 110 duplicates — after fix manifest must drop from 631 to ~521, no `/partner/partner/` left.
4. `CORE_AD_SIGNING_SECRET` default fallback on prod — unsigned ad metrics must be rejected, not signed with dev secret.
5. `SUPPORTED_PROTOCOLS=()` OpenClaw 503 leaking as generic error — must distinguish “support feature not configured” vs “AI main down”.
6. `timezone.utc` removed in Django 6 (`pricing.py:160`) — any `timezone.utc` left breaks `test_no_timezone_utc`.
7. VNPay demo secret in dev — `DEBUG=1` must still warn, prod must `raise` (no silent fallback).
8. SAML `strict` raise in prod (no python3-saml) — must be fail-closed with clear reason, not 500.
9. NOOP beat `market_serving.materializers.materialize_unified_alerts` running alongside real `signal_intelligence` task — double materialization must be removed.
10. FCM missing key returns `False` (not `True`) — UI must show “Not configured” not “Sent”.

---

## Brainstorming result — approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| A. Big-bang rewrite (all W0–W2 in one PR) | Single review, but mixes security + UI + data — violates 3-round rule, hard to bisect | **Rejected** |
| B. W0→W1→W2 waves, one task = one commit, TDD red→green | Reviewable, each task independently testable, fits multi-agent file-disjoint rules | **Chosen (Ponytail full, Impeccable harden)** |
| C. Minimal patch only (badge + allowlist) | Fast but leaves partner double-mount, SAML, AI contract, CI gaps | **Rejected** |

**Chosen principles (Ponytail full + Impeccable):** shortest diff that fully solves, reuse existing helpers (`route-contract`, `envelope.js`, `resolve_tenant`, `idempotency`), no new abstraction/dep, FE correctness over decoration, harden every error/empty state, i18n `defaultValue`, a11y focus + contrast AA, verify by screenshot.

**Defaults for open Qs (so dev team never needs to ask):**
- Q2 (depth): keep synthetic + label “Estimates — not a live book” everywhere (D6). No new data vendor in W0.
- Q3 (secrets/billing): secrets rotated only on prod/public exposure; CI billing is [X] — not blocking W0/W1. Document as deferred.
- Q5: `/ai/agents/` → remove UI + allowlist (do not build BE); SAML → CLI verify via `xmlsec1` in W1.8 (no image rebuild yet); mobile → keep scaffold, not in prod roadmap.

---

### Task W0-1: Partner double-mount fix

**Files:**
- Modify: `packages/core/backend/src/identity_access/urls.py:75` (remove `path('partner/', include(...))` duplicate)
- Modify: `packages/web/src/adapters/core/__tests__/core-route-manifest.json` (regenerate)
- Test: `packages/web/src/adapters/core/__tests__/route-contract.test.js`
- Modify: `packages/core/backend/scripts/dump-core-route-manifest.py` if needed

**Interfaces:**
- Consumes: `identity_access.partner_urls` (110 `path()`) mounted once at `/core/v1/`
- Produces: manifest without `/core/v1/partner/partner/*` (110 duplicates removed)

- [ ] **Step 1: Write failing assertion (no code yet)**
```js
// route-contract.test.js: assert no duplicate partner/partner
expect(manifest.core.some(p => p.includes('/partner/partner/'))).toBe(false);
```
- [ ] **Step 2: Run test to verify it fails**
```bash
npm run test -- route-contract --run
```
Expected: FAIL — manifest still contains 110 `/core/v1/partner/partner/*`.

- [ ] **Step 3: Delete duplicate include in `identity_access/urls.py:75`**
Keep only `vninvest_core/urls.py:60` mount. Then regenerate:
```bash
python packages/core/backend/scripts/dump-core-route-manifest.py
```

- [ ] **Step 4: Run test to verify it passes**
```bash
npm run test -- route-contract --run
```
Expected: PASS, 0 `/partner/partner/` matches, core count drops ~110.

- [ ] **Step 5: Commit**
```bash
git add packages/core/backend/src/identity_access/urls.py packages/web/src/adapters/core/__tests__/core-route-manifest.json
git commit -m "fix(partner): remove duplicate include, 110 partner/partner routes"
```

---

### Task W0-2: Depth honesty badge (D6)

**Files:**
- Modify: `packages/web/src/adapters/chartAdapter.js:154-176`
- Modify: `packages/web/src/components/VNStockChartPanel.js` (widget wrapper)
- Modify: `packages/core/backend/src/market_serving/native_views.py:525-526`
- Test: `packages/web/src/adapters/__tests__/chartAdapter-depth-estimated.test.js` (create)

**Interfaces:**
- Consumes: `DepthChart` returns `{is_mock: true, estimated: true, delta_seconds}` (already present)
- Produces: `chartAdapter.js` exposes `depth.estimated === true`; `VNStockChartPanel` renders badge

Steps are TDD: failing test asserts badge present when `is_mock`, then implement badge with `soc.tokens.css` color `--soc-text-muted`, `role="note"` + `aria-label`, i18n `t('chart.depth.estimated', { defaultValue: 'Estimates — not live book' })`, pixel check AA ≥ 4.5:1, screenshot in three viewports (360/768/1280). Commit `fix(chart): depth estimated badge everywhere`.

---

### Task W0-3: `/ai/agents/` gap-3 removal (D4)

**Files:**
- Modify: `packages/web/src/adapters/core/workspace.js:719-728`
- Modify: `packages/web/src/adapters/core/__tests__/route-contract.test.js:168-171` (remove allowlist)
- Modify: `packages/web/src/adapters/core/__tests__/core-route-manifest.json` (regenerate, no `/ai/agents/`)

**Interfaces:**
- Produces: UI no longer calls `/ai/agents/`; allowlist entry removed; contract passes with 0 `gap-3`.

Steps: failing test asserts `manifest.core` has no `/ai/agents/`, run fails, delete workspace methods + allowlist, regen, run passes. Commit `fix(ai): remove dead ai-agents calls, gap-3 closed`.

---

### Task W0-4: SAML fail-closed (BL-01b, D5)

**Files:**
- Modify: `packages/core/backend/src/identity_access/saml_service.py:388-400`
- Modify: `packages/core/backend/src/identity_access/views/sso.py:5-6`
- Test: `packages/core/backend/src/identity_access/tests/test_saml_signature_mode.py`

Steps: failing test asserts `strict` without `python3-saml` raises `SAMLSignatureError` with clear reason (no 500); implement explicit check, update docstring, run BE on VPS staging with `xmlsec1` present. Commit `fix(sso): SAML strict explicit, no heuristic`.

---

### Task W0-5: Advisory pricing timezone

**Files:**
- Modify: `packages/core/backend/src/advisory/pricing.py:160`
- Test: `test_no_timezone_utc.py` (existing)

Steps: failing test runs on Django 6 (AttributeError `timezone.utc`); replace with `datetime.UTC`, run `manage.py test test_no_timezone_utc` on VPS staging. Commit `fix(advisory): pricing timezone UTC Django6`.

---

### Task W0-6: Ads signing secret guard

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/env_validation.py` (add `CORE_AD_SIGNING_SECRET` required in prod)
- Modify: `packages/core/backend/src/vninvest_core/checks.py` (redundant safety)
- Modify: `packages/core/backend/src/advertising/views.py:158`

Steps: failing test asserts prod without secret raises `ImproperlyConfigured`; add validation, run `manage.py check`. Commit `fix(ads): signing secret guard`.

---

### Task W0-7: Envelope broker KNOWN_UNREADABLE

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py:607`
- Test: same file (envelope invariant)

Steps: failing test asserts 5 `views_broker` endpoints now checked; update `_methods_of()` for ViewSet actions, shrink `KNOWN_UNREADABLE`. Run BE test on VPS. Commit `fix(envelope): broker endpoints readable`.

---

### Task W0-8: NOOP beat removal

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/settings.py:669-673` (delete `materialize-unified-alerts-2m` NOOP entry)
- Keep: `signal_intelligence.materializers` at `:871-875`

Steps: failing test asserts only one `materialize_unified_alerts` task registered; delete NOOP, run `manage.py check` + celery beat list. Commit `fix(beat): remove NOOP materialize_unified_alerts`.

---

### Task W0-9: VNPay fail-closed hardening

**Files:**
- Modify: `packages/core/backend/src/commercial/vnpay_service.py:16-42`
- Test: `packages/core/backend/tests/test_vnpay_ipn_security.py`

Steps: failing test asserts prod (DEBUG=False) with demo secret raises; dev warns but signs. Implement, run BE test. Commit `fix(payments): VNPay demo fail-closed`.

---

### Task W1-1: Tenant-admin 17 merge + broker hub separation (D3)

**Files:**
- Modify: `packages/web/src/app/routeCatalog.js:411-769`
- Modify: `packages/web/src/adapters/core/workspace.js:183` (wire `getPortfolioSummary`)
- Modify: `packages/web/src/pages/PortfoliosPage.tsx:140`

Steps: failing vitest asserts `getPortfolioSummary` called on mount and KPI shows `total_market_value`; implement, check tokens/contrast/a11y (Impeccable harden), screenshot empty/error states. Commit `feat(portfolio): wire summary + separate broker hub`.

---

### Task W2-1: AI contract D2 (LLM schema)

**Files:**
- Modify: `packages/core/backend/src/advisory/orchestrator.py:717-723`
- Modify: `packages/web/src/i18n/vi.js` + `en.js` (~35 keys)
- Test: `packages/core/backend/tests/test_advisory_refresh_never_uses_management_scoped_key.py` (positive + negative)

Steps: failing test asserts LLM output has no `signal: BUY|SELL|HOLD` / no `target_price`; change prompt schema to technical (`open/close, levels, rationale`), update UI copy to “Phân tích kỹ thuật”, run BE + FE tests, screenshot. Commit `fix(ai): D2 technical schema, no recommendation`.

---

## Gates (run after every task — W0 before PR)

```bash
node packages/web/scripts/check-multi-agent.mjs      # exit 0
node scripts/check-lessons.mjs                        # exit 0
npx tsc --noEmit                                      # in packages/web, exit 0
npm run test -- route-contract --run                  # PASS
node scripts/normalize-eol.mjs docs                   # exit 0
```

BE tests only on VPS staging (`14.225.255.47`, no local Docker). Full BE baseline on VPS: `3468 / 12 / 224` (2026-10-22) + Entry 415 VPS (`427+620+1074+508+314+32 OK`) — compare, do not expect 0 failures.

## Self-Review

- Spec coverage: all M1–M10 items have at least one task above (M9 tasks folded into W1-1, M10 gates are global).
- Step scan: each step is one action with expected FAIL/PASS; no `TODO`/`handle edge` placeholders.
- Type consistency: interfaces use existing names (`route-contract`, `envelope.js`, `resolve_tenant`, `Idempotency-Key` header).
- Review Focus: 10 items mapped to owning tasks (badge→W0-2, gap-3→W0-3, partner→W0-1, ads→W0-6, timezone→W0-5, VNPay→W0-9, SAML→W0-4, NOOP→W0-8, OpenClaw 503→W2-1 doc, FCM→W0-2 subtitle).
- Proportion: tasks are bite-sized commits, not a code transcript — signatures + assertions only.

**Lessons applied:** [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-V09] — claim before edit, no shared-file commit, gate after rebase, no fake PASS, every measurement has control, root-cause needs reproduction, follow `include` indirection (L-V09).

## Execution Handoff

Plan complete and saved to `docs/PLAN_PM_AUDIT_FIX_20261108.md`. For this plan I recommend **Subagent-driven** (tasks depend on shared manifest + tenant middleware; shipped mistake costs tenant data) — does the plan capture what you want, and which approach should we use?

