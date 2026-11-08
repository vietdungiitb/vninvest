# PM Audit Fix Implementation Plan

> **For agentic workers:** REQUIRED skills: `workflow-dev-loop` (B3/B4/B8 verdict + B5 claim + B7 gates) + `test-driven-development` (B6 TDD) + `staff-engineer-review` (B8 re-audit). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix all open ERROR/GAP/RISK from PM review rev1 (M1–M10) so W0 closes and W1 retail activation can start, with no owner questions left.

**Architecture:** Single Django backend (16 apps) + React frontend (69 routes) + contract gate is source of truth. Fix order: W0 data-honesty + contract + security guards → W1 retail activation → W2 AI technique. Each task is independently testable, TDD red→green, one commit per task.

**Tech Stack:** Django 6 (REST) + Celery beat + React 19/Vite + `vninvestcharts-widget@1.2.5` (vendor) + `route-contract.test.js` (631 routes manifest) + VPS staging (no local Docker).

**Spec:** `docs/PM_FUNCTIONAL_TREE_20261108.md` (L0–L4 tree) + `docs/PM_BUG_GAP_MATRIX_20261108.md` (rev1 matrix M1–M10) + `docs/PM_ROADMAP_UPGRADE_20261108.md` (W0–W5). Architecture decisions D1–D8 in `docs/MASTER_TRACKING_2026Q4.md:90-101`.

**Lessons applied:** [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-V09]

## Global Constraints

- Runtime: retail-first, phase 1 FREE (brand name, no MRR) — `MASTER_TRACKING:90-101` D8.
- AI = technical analysis only, NO BUY/SELL/HOLD, NO order placement (keep `paper` dry_run) — D2.
- Depth chart = "estimated" label everywhere (D6) — depth is synthetic, never present as real order book.
- Push = future feature — never return True when key missing (D7).
- No `npm/pip install`, no migration by hand (`makemigrations` only), no touching deny-list (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`), no `git checkout --`, no fake PASS.
- Frontend SOC: tokens → `soc.tokens.css`, classes → `soc.components.css`, **never** `soc.module.css` (3-line barrel 0 token).
- i18n: use `t(key, { defaultValue })`; W2-1 must claim-check `vi.js/en.js` before editing (see W2-1 step) — do not parallel-edit locales.
- Security: fail-closed on missing config (`ImproperlyConfigured` in prod), no `SECRET_DEMO` in prod.
- Test env: VPS staging `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`), BE needs `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`, DB per agent `ag_<name>`. No local Docker.

## Baseline exit-code tại HEAD (B2 — đo thật, không đoán)

| Cổng | Lệnh (HEAD) | Exit / Output |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | 0 PASS (0 lỗi, 178 claim) |
| Lessons | `node scripts/check-lessons.mjs` | 0 (14 file \| 57/60) |
| Type | `npx tsc --noEmit` (packages/web) | 0 |
| Contract | `npm run test -- route-contract --run` (VPS staging §12.4) | CHƯA CHẠY tại HEAD |
| BE full | `manage.py test` (VPS staging, baseline cũ `3468/12/224` + Entry 415 VPS) | CHƯA CHẠY tại HEAD — so với baseline, không kỳ vọng 0 fail |
| FE vitest | `npm run test:components` (VPS) | CHƯA CHẠY tại HEAD |

> Baseline BE/FE số cũ là `docs/MASTER_TRACKING_2026Q4.md:267` (`3468/12/224`) + Entry 415 VPS (`427+620+1074+508+314+32 OK`) — cả hai đều là số đã ghi, chưa chạy lại tại HEAD. Ghi CHƯA CHẠY, không báo PASS (L-G02).

## Review Focus

1. Depth series `is_mock: True` + `data_quality: 'estimated'` — badge must show “Estimates — delayed” everywhere, chart widget must not swallow `is_mock`.
2. `/ai/agents/` 404 on UI (allowlist `gap-3`) — after UI removal, `route-contract.test.js` must pass with 0 allowlist entries.
3. Partner double-mount `/core/v1/partner/partner/` 110 duplicates — after fix manifest must drop from 631 to ~521.
4. `CORE_AD_SIGNING_SECRET` default fallback on prod — unsigned ad metrics must be rejected, not signed with dev secret.
5. `SUPPORTED_PROTOCOLS=()` OpenClaw 503 leaking as generic error — distinguish “support not configured” vs “AI main down”.
6. VNPay demo secret in dev — `DEBUG=1` must still warn, prod must `raise` (already correct — regression-verify only, Task W0-9).
7. SAML `strict` raise in prod (no python3-saml) — fail-closed with clear reason, not 500 (§8 verify-only; real verify in W1.8).
8. NOOP beat `market_serving.materializers.materialize_unified_alerts` alongside real `signal_intelligence` task — double materialization must be removed.
9. FCM missing key returns `False` (not `True`) — UI must show “Not configured” not “Sent”.
10. Envelope `KNOWN_UNREADABLE` skipping 5 broker endpoints — after fix, invariant must cover them.

---

## Brainstorming result — approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| A. Big-bang rewrite (all W0–W2 in one PR) | Single review, but mixes security + UI + data — violates 3-round rule, hard to bisect | **Rejected** |
| B. W0→W1→W2 waves, one task = one commit, TDD red→green | Reviewable, each task independently testable, fits multi-agent file-disjoint rules | **Chosen (Ponytail full, Impeccable harden)** |
| C. Minimal patch only (badge + allowlist) | Fast but leaves partner double-mount, SAML, AI contract, CI gaps | **Rejected** |

**Chosen principles (Ponytail full + Impeccable):** shortest diff that fully solves, reuse existing helpers (`route-contract`, `envelope.js`, `resolve_tenant`, `Idempotency-Key`), no new abstraction/dep, FE correctness over decoration, harden every error/empty state, i18n `defaultValue`, a11y focus + contrast AA, verify by screenshot.

**Defaults for open Qs (so dev team never needs to ask):**
- Q2 (depth): keep synthetic + label “Estimates — not a live book” everywhere (D6). No new data vendor in W0.
- Q3 (secrets/billing): secrets rotated only on prod/public exposure; CI billing is [X] — not blocking W0/W1. Document as deferred.
- Q5: `/ai/agents/` → remove UI + allowlist (do not build BE); SAML → CLI verify via `xmlsec1` in W1.8 (no image rebuild yet); mobile → keep scaffold, not in prod roadmap.
- **Order notes (Objection 3):** W0-3 gỡ `gap-3` sớm **vì** là dead UI 100% (không hành vi thật để bảo vệ) và allowlist được xóa cùng commit manifest-regen — không chờ W2.1. W0-8 kéo NOOP từ W1.4 lên W0 **vì** task thật đã chạy `settings.py:871-875` ("Overrides the NOOP"), xóa entry NOOP `:669-673` downside ~0 và dọn double schedule càng sớm càng tốt. `workspace.js` bị W0-3 và W1-1 chạm tuần tự — **cấm 2 agent claim `workspace.js` đồng thời**. W2-1 sửa `vi.js/en.js` phải khai claim và kiểm tra `docs/CLAIMS.md` trước, **danh sách key là CHƯA XÁC MINH** (giao bước grep liệt kê trước khi sửa, kèm CLAMS kiểm tra).

---

### Task W0-1: Partner double-mount fix

**Files:**
- Modify: `packages/core/backend/src/identity_access/urls.py:75` (remove `path('partner/', include(...))` duplicate)
- Modify: `packages/web/src/adapters/core/__tests__/core-route-manifest.json` (regenerate)
- Test: `packages/web/src/adapters/core/__tests__/route-contract.test.js`

**Interfaces:**
- Consumes: `identity_access.partner_urls` (110 `path()`) mounted once at `/core/v1/`
- Produces: manifest without `/core/v1/partner/partner/*` (110 duplicates removed)

**Acceptance (Given/When/Then):** Given HEAD manifest has 110 `/partner/partner/` routes, When implementer runs `npm run test -- route-contract --run` on VPS staging, Then FAIL (assert no `/partner/partner/` exists) before the echo state; after removing duplicate include + regen, same command PASS and core count drops.

- [ ] **Step 1: Write the failing assertion**
```js
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
- Modify: `packages/web/src/components/workstation/StockOrderBookWidget.jsx:153-161` (badge đã có — verify + strengthen, không thêm file mới)
- Modify: `packages/web/src/components/workstation/hooks/useOrderBook.js:19-80` (consumer thật của `getRealtimeDepthChart`)
- Modify: `packages/web/src/pages/StockDetailPage.tsx:225,309` (đường render `useOrderBook` → `StockOrderBookWidget`)
- Test: `packages/web/src/components/workstation/StockOrderBookWidget.estimated.component.test.tsx` (create, render test)
- **CHƯA XÁC MINH [X]:** external widget vendor `vninvestcharts-widget` có nuốt `is_mock` không — cần đọc vendor README/tick khi implement, không đoán. **`chartAdapter.js:154` `subscribeToOrderbook` không có caller production** (dead path) — không test adapter cho task này.
- Modify: `packages/core/backend/src/market_serving/native_views.py:515-527` (doc only, no new field)

**Interfaces:**
- Consumes: DepthChart returns `{is_mock: true, data_quality: 'estimated', source: 'synthetic_from_snapshot', note: 'UOC TINH ...'}` (`native_views.py:522-526`). **No** `estimated`/`delta_seconds` field exists — do not add it. Badge reads `is_mock && data_quality === 'estimated'`.
- Produces: `StockOrderBookWidget.jsx:153-161` badge hiển thị khi `is_mock:true`, ẩn khi `false` (đã có — task là verify + thêm test render, không tính là red→green mới).

**Acceptance (Given/When/Then):** Given `useOrderBook` trả `is_mock:true`, When `StockOrderBookWidget` render, Then badge hiển thị (đã có tại `:153-161`); When `is_mock:false`, không badge. Nếu badge đã đủ thì task kết thúc ở verify-only + component test, không sửa BE.

- [ ] **Step 1: Write failing render test (new)**
```js
render(<StockOrderBookWidget data={{ is_mock: true }} />); expect(screen.getByText(/Estimates/)).toBeTruthy(); // fails if badge missing
```
- [ ] **Step 2: Run (FAIL or PASS?)** `npm run test -- StockOrderBookWidget.estimated --run` — EXPECT: PASS already (badge tồn tại). Nếu PASS thì ghi verify-only, không sửa code; nếu FAIL thì sửa `StockOrderBookWidget.jsx` (tokens `--soc-text-muted`, `role="note"` + `aria-label`, i18n `t('chart.depth.estimated', { defaultValue: 'Estimates — not live book' })`, AA ≥ 4.5:1, screenshot 360/768/1280)
- [ ] **Step 3: Record external-widget [X] note** in `docs/evidence/w0-2-depth-external.md` (file vendor cần đọc là gì) — **CHƯA XÁC MINH** đến khi đọc vendor file.
- [ ] **Step 4: Commit (only if code changed)** `fix(chart): depth estimated badge everywhere`

---

### Task W0-3: `/ai/agents/` gap-3 removal (D4)

**Files:**
- Modify: `packages/web/src/adapters/core/workspace.js:719-728`
- Modify: `packages/web/src/adapters/core/__tests__/route-contract.test.js:168-171` (remove allowlist)
- Modify: `packages/web/src/adapters/core/__tests__/core-route-manifest.json` (regenerate, no `/ai/agents/`)

**Interfaces:**
- Produces: UI no longer calls `/ai/agents/`; allowlist entry removed; contract passes with 0 `gap-3`.

**Acceptance (Given/When/Then):** Given `workspace.js` calls `/ai/agents/`, When `route-contract` runs, Then FAIL (path not in manifest) before; after deleting methods + allowlist + regen, PASS with 0 `gap-3` entries.

Steps flow as W0-1 (FAIL on `/ai/agents/` present, delete, regen, PASS, commit `fix(ai): remove dead ai-agents calls, gap-3 closed`).

---

### Task W0-4: SAML — verify-only regression (BL-01b deferred to W1.8)

**Files:**
- Test only: `packages/core/backend/src/identity_access/tests/test_saml_signature_mode.py`
- No runtime code change in W0 (strict already raises at `saml_service.py:396-400`).

**Interfaces:**
- Consumes: strict already raises `SAMLSignatureError` when `python3-saml` missing.
- Produces: verified green + ticket W1.8 (real `xmlsec1` CLI verify or image rebuild).

**Acceptance (Given/When/Then):** Given `signature_mode=strict` without `python3-saml`, When `test_saml_signature_mode` runs, Then PASS (raises, not 500) — acceptance is **still green** after re-measure, not red→green. If it ever fails, stop and file blocker (do not invent heuristic fix).

- [ ] **Step 1: Run (PASS)** `manage.py test test_saml_signature_mode` on VPS staging. Expected: PASS.
- [ ] **Step 2: Record evidence** in `docs/evidence/w0-4-saml-verify.md` (libxml2 mismatch note). No code commit if green.

---

### Task W0-5: Advisory pricing timezone — already fixed, regression-verify only

**Files:**
- Test only: `packages/core/backend/src/vninvest_core/tests/test_no_timezone_utc.py`
- No runtime code (pricing already `datetime.UTC` at `:17,160-161`).

**Interfaces:**
- Consumes: `grep timezone\.utc` in `advisory` = 0 hits.
- Produces: verified green.

**Acceptance (Given/When/Then):** Given `pricing.py:17` imports `UTC` and `:160` uses `make_aware(..., UTC)`, When guard test runs, Then PASS. If any `timezone.utc` found, stop (do not add new code without file:line).

- [ ] **Step 1: Run (PASS)** `grep -r "timezone\\.utc" packages/core/backend/src/advisory` → 0 hits; `test_no_timezone_utc` PASS on VPS staging. No commit if green.

---

### Task W0-6: Ads signing secret guard

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/env_validation.py` (add `CORE_AD_SIGNING_SECRET` required in prod — new check near `:99-129`)
- Test: `packages/core/backend/tests/test_ad_signing_secret.py` (create)

**Interfaces:**
- Produces: prod without `CORE_AD_SIGNING_SECRET` raises `ImproperlyConfigured`.

**Acceptance (Given/When/Then):** Given `DEBUG=False` without `CORE_AD_SIGNING_SECRET`, When startup checks run, Then FAIL (`ImproperlyConfigured`); with secret set, PASS.

- [ ] **Step 1: Write failing test (new)** asserting prod guard raises.
- [ ] **Step 2: Run (FAIL)** `manage.py test test_ad_signing_secret` on VPS staging.
- [ ] **Step 3: Implement** in `env_validation.py`.
- [ ] **Step 4: Run (PASS)** same command.
- [ ] **Step 5: Commit** `fix(ads): signing secret guard`.

---

### Task W0-7: Envelope broker KNOWN_UNREADABLE

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py:129` (`_methods_of()` for ViewSet actions) + `:612` (`KNOWN_UNREADABLE` shrink)
- Test: same file

**Interfaces:**
- Produces: **5 endpoint `user_workspace.views_broker`** (tên cụ thể **CHƯA XÁC MINH** — giao bước `grep -n "KNOWN_UNREADABLE" -A 15 packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py` trước khi sửa) move from `KNOWN_UNREADABLE` to checked.

**Acceptance (Given/When/Then):** Given `KNOWN_UNREADABLE` still skips 5 broker views, When envelope invariant runs, Then those 5 are skipped (FAIL for coverage before); after fixing `_methods_of()`, same run checks them (PASS). Run: `manage.py test test_api_envelope_schema` on VPS staging.

Steps: failing = assert broker endpoints checked (FAILS before), fix `_methods_of()`, PASS, commit `fix(envelope): broker endpoints readable`.

---

### Task W0-8: NOOP beat removal

**Files:**
- Modify: `packages/core/backend/src/vninvest_core/settings.py:669-673` (delete NOOP `market_serving...materialize_unified_alerts`)
- Keep: `signal_intelligence...` at `:871-875`
- Test: `packages/core/backend/tests/test_beat_unified_alerts.py` (create, assert single `materialize_unified_alerts`)

**Interfaces:**
- Produces: exactly one `materialize_unified_alerts` beat entry.

**Acceptance (Given/When/Then):** Given beat schedule contains 2 entries for same task name, When `manage.py test test_beat_unified_alerts` runs, Then FAIL (count == 2) before; after rm, PASS (count == 1).

Steps: create test, run FAIL, delete NOOP, run PASS, `manage.py check`, commit `fix(beat): remove NOOP materialize_unified_alerts`.

---

### Task W0-9: VNPay — already fail-closed, regression-verify only

**Files:**
- Test only: `packages/core/backend/tests/test_vnpay_ipn_security.py:51-78`
- No runtime code (`vnpay_service.py:28-42` already prod `raise`).

**Interfaces:**
- Consumes: prod raises, dev warns + demo.
- Produces: verified green.

**Acceptance (Given/When/Then):** Given `DEBUG=False` + demo code, When IPN test runs, Then PASS (raise, not silent accept). If it ever fails, stop.

- [ ] **Step 1: Run (PASS)** `manage.py test test_vnpay_ipn_security` on VPS staging. No commit if green.

---

### Task W1-1: Portfolio summary wiring + broker hub separation (D3) — verify-only broker

**Files:**
- Modify: `packages/web/src/pages/portfolio/manage/usePortfolioManage.ts:105` (đã gọi `getPortfolioSummary` — verify)
- Modify: `packages/web/src/pages/portfolio/PortfolioOverviewPage.tsx:59` (đã gọi — verify)
- Modify: `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:87` (đã gọi — verify) (không phải `context/WatchlistContext.tsx` — file không tồn tại)
- Verify-only: `packages/web/src/app/routeCatalog.js:215-223` (`broker` `/broker`) + `:238-248` (`portfolios-manage-broker` deprecated → `/broker`) — **đã tồn tại**, không khai FAIL-before
- Modify (chỉ khi phát hiện wire thật còn thiếu tại file trên, ghi tên file:line cụ thể): `packages/web/src/adapters/core/workspace.js:195` (keep `getPortfolioSummary(portfolioId)` — không phải `:183`)

**Interfaces:**
- Consumes: `getPortfolioSummary` returns `{total_market_value, total_cost, unrealized_pnl}` from `portfolio_analytics_views.py:369-383`.
- Produces: `/portfolios/manage` KPI đã nối (không cần “implement route split” chung chung — nếu broker hub đã resolve thì không sửa).

**Acceptance (Given/When/Then):** Given rows loaded, When `usePortfolioManage.ts:105` runs, Then `getPortfolioSummary` called per row (test expectations đã green — acceptance là no regression). When navigate `/broker` và `/portfolios/manage/broker`, Then route resolve + redirect về `/broker` (verify-only, không FAIL→PASS nhân tạo). Nếu tìm được call-site thật còn thiếu (nêu file:line), task thêm 1 RED test cho điểm đó.

Steps: chạy existing `usePortfolioManage` test (PASS expected), chạy route-contract/route resolve verify (PASS expected), screenshot, commit nếu có diff thật `feat(portfolio): wire summary + separate broker hub` (nếu không có diff, chỉ ghi verify không commit code).

---

### Task W2-1: AI contract D2 (LLM schema)

**Files:**
- Modify: `packages/core/backend/src/advisory/orchestrator.py:722-726` (`signal: BUY|SELL|HOLD` + `target_price` + `recommendation`)
- Modify: `packages/core/backend/src/advisory/tests/test_advisory_orchestrator_contract.py` (existing file — grep exact test names first)
- Modify: `packages/web/src/i18n/vi.js` + `en.js` — **claim-check `docs/CLAIMS.md` first**, list every key touched (do not “~35” — list them)
- Test: same contract file (add positive assertion)

**Interfaces:**
- Consumes: existing contract file `test_advisory_orchestrator_contract.py` (not `test_advisory_refresh_never_uses...` which does not exist).
- Produces: LLM output has no `signal`/`target_price`/`recommendation`; UI says “Phân tích kỹ thuật”.

**Acceptance (Given/When/Then):** Given orchestrator prompt requests `signal: BUY|SELL|HOLD`, When contract test asserts output has none of those fields, Then FAIL before / PASS after. Run: `manage.py test test_advisory_orchestrator_contract` + `npm run test -- ai-cc --run` on VPS staging. If `tenantreg-d` holds `vi.js/en.js` in-progress, run W2-1 **sequentially** after it.

Steps: grep key list, claim-check, failing test (FAIL before), prompt-schema fix, i18n updates with `defaultValue`, run BE+FE, commit `fix(ai): D2 technical schema, no recommendation`.

---

## Gates (run after every task)

```bash
node packages/web/scripts/check-multi-agent.mjs      # exit 0
node scripts/check-lessons.mjs                        # exit 0
npx tsc --noEmit                                      # in packages/web, exit 0
npm run test -- route-contract --run                  # PASS (VPS staging §12.4)
node scripts/normalize-eol.mjs docs                   # exit 0
```

BE tests only on VPS staging (`14.225.255.47`, no local Docker). Full BE baseline on VPS: `3468 / 12 / 224` (2026-10-22) + Entry 415 VPS (`427+620+1074+508+314+32 OK`) — compare, do not expect 0 failures.

## Self-Review

- Spec coverage: all M1–M10 items have at least one task above (M9 folded into W1-1, M10 gates are global; W0-4/W0-5/W0-9 are verify-only because HEAD already green — no fake red).
- Step scan: each step is one action with expected FAIL/PASS; no `TODO`/`handle edge` placeholders.
- Type consistency: interfaces use existing names (`route-contract`, `envelope.js`, `resolve_tenant`, `Idempotency-Key` header).
- Review Focus: 10 items mapped to owning tasks (badge→W0-2, gap-3→W0-3, partner→W0-1, ads→W0-6, envelope→W0-7, VNPay→W0-9, SAML→W0-4, NOOP→W0-8, OpenClaw 503→W2-1 doc, FCM→W0-2 subtitle).
- Proportion: tasks are bite-sized commits, not a code transcript — signatures + assertions only.

**Lessons applied:** [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-V09] — claim before edit, no shared-file commit, gate after rebase, no fake PASS, every measurement has control, root-cause needs reproduction, follow `include` indirection (L-V09).

## Execution Handoff

Plan complete and saved to `docs/PLAN_PM_AUDIT_FIX_20261108.md`. For this plan I recommend **Subagent-driven** (tasks depend on shared manifest + tenant middleware; shipped mistake costs tenant data) — does the plan capture what you want, and which approach should we use?
