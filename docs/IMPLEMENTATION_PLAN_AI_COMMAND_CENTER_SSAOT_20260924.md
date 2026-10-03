# KẾ HOẠCH THỰC HIỆN — AI COMMAND CENTER: SSOT + P0 FIX

**Mã:** `IC-SSOT-20260924`  
**Ngày ban hành:** 2026-09-24  
**Revision:** **Rev.2 — 2026-09-24** (sau audit độc lập `docs/AUDIT_AI_COMMAND_CENTER_SSOT_20260924.md` — đóng F-C1 stale plan)  
**Revision:** **Rev.3 — 2026-09-24** (F6a/F6b split theo `docs/AUDIT_F6_GEMINI_38_FLASH_20260924.md` C1–C5 — F6a APPROVED, F6b CONDITIONAL)  
**Trạng thái:** APPROVED + **A DONE** (198) + **D DONE** (200) + **B.4 DONE** (201) + **C DONE** (202) + **F6 plan Rev.3** + **B rest + F6a DONE** (204) + **E DONE** (205) + **G DONE** (206) + **F subset F1/F2/F3/F4/F5/F6/F7 DONE** (207+209+210) + **F-C6 DONE** (208) + **F8 DONE** (211; F9 backlog; F6b blocked proxy C2)  
**Đối tượng:** Đội code FE (`packages/web`) + BE (`packages/core/backend`)  
**Phụ thuộc audit:** `docs/AUDIT_AI_COMMAND_CENTER_SSOT_20260924.md` (F-C1…F-C8), `docs/AUDIT_F6_GEMINI_38_FLASH_20260924.md` (C1–C5), `docs/AUDIT_SETTINGS_AI_SAAS_NATIVE.md` + session 2026-09-24 (E/G/U/R/C)

### Rev.2 — Kết quả audit F-C1…F-C5 (đối chiếu 2026-09-24)

| Finding | Kết luận | Action trong plan |
|---------|----------|-------------------|
| **F-C1** plan stale Slice A | **CONFIRMED** — keys + policy sync + quota + test mock **đã DONE** (Entry 198) | A.1 đánh dấu DONE; chỉ giữ open item F-C6 (`\|\|` pattern) + A-AC3 manual |
| **F-C2** B.4 namespace FAIL | ~~CONFIRMED OPEN~~ | **DONE (Entry 201)** — call sites → target ns; grep 0; DEPRECATED old blocks |
| **F-C3** D1 IsCoreOperator | ~~CONFIRMED OPEN~~ | **DONE (Entry 200)** — `IsCoreOperator` removed; self-scope filter(user) + staff branch |
| **F-C4** D2 ownership | ~~CONFIRMED OPEN~~ | **DONE (Entry 200)** — list scoped; detail 404; PATCH/DELETE 403; UniqueConstraint+0002 |
| **F-C5** Slice C fields | ~~CONFIRMED OPEN~~ | **DONE (Entry 202)** — +5 field migration 0007; GET user-first; PUT no SystemAISettings write |

**Verdict audit:** Implementable; **không ship B/C/D** khi F-C2…F-C5 còn OPEN.

---

## 0. MỤC ĐÍCH & NGUYÊN TẮC BÀN GIAO

| Mục | Quy định |
|-----|----------|
| **Mục tiêu tổng** | `/settings/ai` thành **SSOT hub** cho mọi cấu hình AI người dùng; 0 raw key; multi-tenant isolation; permission nhất quán; test bắt được regression i18n |
| **Nguyên tắc** | Vertical slices; mỗi slice **có gates bắt buộc**; evidence ghi vào ledger; **không hỏi lại** khi đủ thông tin dưới đây |
| **Out-of-scope chung** | Refactor toàn app i18n `\|\|` pattern; rewrite AI Advisory core; mobile; legacy `frontend/` |
| **Working dir** | `packages/web` (FE), `packages/core/backend` (BE) |
| **Commit style** | 1 commit / slice, message `ai-cc(slice): …` |

### 0.1 Quy ước evidence (bắt buộc mỗi slice)

Ghi vào `docs/evidence/ai-cc/<slice>/`:

1. **Gate log** — copy stdout `tsc` / `vitest` / `build` / BE test
2. **Diff stat** — `git diff --stat`
3. **Manual proof** — screenshot trước/sau (nếu UI) hoặc curl (nếu API)
4. **Checklist AC** — đánh dấu PASS/FAIL từng dòng §3

### 0.2 Definition of Done (DOD) tổng — chỉ ship khi **tất cả** green

| # | Gate | Lệnh / cách | PASS |
|---|------|-------------|------|
| G1 | Typecheck | `cd packages/web && npx tsc --noEmit` → exit 0 | ☐ |
| G2 | Unit FE slice | `npx vitest run <files liên quan>` → 100% pass | ☐ |
| G3 | Build | `npm run build` → exit 0 | ☐ |
| G4 | i18n scan | `npm run i18n:scan` → exit 0 | ☐ |
| G5 | Lint | `npm run lint` → **0 error** (warn pre-existing OK) | ☐ |
| G6 | BE check | `python src/manage.py check` → 0 issues | ☐ |
| G7 | BE tests slice | `manage.py test <app.tests liên quan>` → OK | ☐ |
| G8 | Manual UI | Mở `/settings/ai` đúng AC | ☐ |
| G9 | Ledger | Entry mới trong `docs/CODE_CHANGE_AUDIT_LEDGER.md` | ☐ |
| G10 | Evidence folder | Đủ 4 loại file §0.1 | ☐ |

---

## 1. PHẠM VI — FINDINGS ĐÓNG THEO SLICE

| Slice | findings | Ước | Owner | **Status 2026-09-24** |
|-------|----------|-----|-------|------------------------|
| **A** P0 i18n + policy sync | E-01, E-02, E-06, G-10, R-02 | 0.5d | FE | **DONE** (Entry 198) — trừ F-C6 `\|\|` polish + A-AC3 screenshot |
| **B** SSOT hub UX + nav | G-01, G-02, U-09, U-10, C-2, ~~F-C2~~ | 1–1.5d | FE | **DONE (Entry 204)** — B.4 (201) + nav hub/anchors/back-link |
| **C** Multi-tenant config plane | E-03, E-05partial, C-3, R-03, G-04, ~~F-C5~~ | 2–3d | BE (+FE thin) | **DONE (Entry 202)** |
| **D** Permission + Agent security | E-04, E-05, R-06, C-4, ~~F-C3, F-C4~~ | 1–1.5d | BE+FE | **DONE (Entry 200)** |
| **E** i18n hardcode + polish | U-01…U-08, G-06partial | 1d | FE | **DONE (Entry 205)** — defer accent-color/API-key mask → F; Shell page out of scope |
| **F** Competitive upgrade | G-07, G-08, G-12, R-04, benchmark | 2–4d | FE+BE | **F1/F2/F4/F5/F6 DONE (Entry 207)** + **F6a DONE (204)**; F6b CONDITIONAL proxy C2; F3/F7–F9 BACKLOG |
| **G** Hardening / CI | R-01, R-05 | 0.5d | FE | **DONE (Entry 206)** |

**Thứ tự bắt buộc:** A ✅ → D ✅ → B.4 ✅ → C ✅ → B rest ✅ → **E ✅ (205)** → **G ✅ (206)** → **F subset ✅ (207)** → F6b (blocked proxy C2) / F3/F7–F9 backlog  
**Rev.2 reorder:** audit chốt F-C3/F-C4/F-C2 là security/correctness-critical — **ưu tiên D + B.4 trước C/nav polish**.  
**Rev.3 F6:** F6a (catalog gemini-3.8-flash + SystemAISettings choices migration) **có thể ship sớm** song song B rest/E; F6b **blocked** trên proxy test C2.

---

## 2. YÊU CẦU CHI TIẾT TỪNG SLICE

### SLICE A — P0 i18n hotfix + policy display sync

> **STATUS: DONE (2026-09-24) — Entry 198**  
> Audit F-C1: items 1, 3, 4, 5, 6 **đã implement**. Không lặp lại.  
> **F-C6 DONE (Entry 208)** — bỏ `t()||` 74 sites; còn open: **A-AC3** screenshot manual.

**Files (đã đổi):**

- `packages/web/src/i18n/vi.js` / `en.js` — +3 keys
- `packages/web/src/pages/AICommandCenterPage.tsx` — policy sync + quota guard
- `packages/web/src/pages/AICommandCenterPage.component.test.js` — TRANSLATIONS + 6 tests

#### A.1 Requirements — status

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Thêm `eyebrow`/`overview`/`fallbackReset` | **DONE** | `vi.js:5164-5165,5196`; `en.js:5078-5079,5110` |
| 2 | Bỏ `\|\|` trên 3 key đã có (F-C6) | **DONE (208)** | 74 sites stripped across 3 AI CC pages |
| 3 | `handleSaveSettings` set display states | **DONE** | `:235-238` setRefreshIntervalDisplay + setMaxAutoRefreshes |
| 4 | Quota `?? 0` / `\|\| 1` | **DONE** | `:525-526` quotaRemaining/quotaMax |
| 5 | Test mock TRANSLATIONS | **DONE** | test `:28-59` |
| 6 | Test eyebrow/overview no raw key | **DONE** | 6/6 vitest PASS |

#### A.1b Remaining polish (không blocker ship)

- **F-C6:** ~~bỏ `|| "fallback"`~~ **DONE (Entry 208)** — 74 replacements + `localeTag` date.
- **A-AC3:** screenshot fallback reset line trên live — still PENDING (user).

#### A.2 AC nghiệm thu (Slice A) — **đã PASS phần automate**

| ID | Tiêu chí | Verify | PASS |
|----|----------|--------|------|
| A-AC1 | Header eyebrow = `Cài đặt` | RTL | ☑ |
| A-AC2 | Overview = `Tổng quan` | RTL | ☑ |
| A-AC3 | Fallback reset no raw key | Manual screenshot | ☐ |
| A-AC4 | Save → policy card tức thì | vitest | ☑ |
| A-AC5 | Quota missing remaining no crash | vitest | ☑ |
| A-AC6 | Test fail nếu key catalog miss | TRANSLATIONS | ☑ |
| A-AC7 | G1–G5, G9, G10 | tsc/vitest/scan/ledger/evidence | ☑ (lint/build optional) |

#### A.3 Phản biện / A.4 Evidence

- Evidence: `docs/evidence/ai-cc/A/gates.md`
- Ledger: **Entry 198**

---

### SLICE B — SSOT hub: nav + link Agents/Usage + dual namespace

**Files:**

- `packages/web/src/pages/AICommandCenterPage.tsx` (header/tabs)
- `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts` (optional sub-item)
- `packages/web/src/components/AIAgentFederationPanel.tsx`
- `packages/web/src/components/AIUsageDashboard.tsx`
- `packages/web/src/i18n/vi.js` / `en.js`
- Tests: page-level + panel

#### B.1 Requirements — status (Rev.2)

1. **Hub subnav** — **OPEN** (chưa có trong AICommandCenterPage header):
   - `Tổng quan` / `Runtime` / `Nhật ký audit` (in-page)
   - `Agents` → `/settings/ai/agents`
   - `Usage` → `/settings/ai/usage`
   Active theo `useLocation().pathname`.

2. **Link ngược** từ Agents/Usage về hub — **OPEN**.

3. **Sidebar** — **PARTIAL**: entry `/settings/ai` đã có (`sidebaritems.ts:36` labelKey `layout.nav.aiCommandCenter`). Giữ 1 entry + hub tabs (không bắt buộc 3 children).

4. **Gộp i18n namespace — F-C2 BLOCKER, chưa làm:**
   - Catalog **đã có** both: `usage`/`agentFederation` **và** `aiUsageAnalytics`/`aiAgentFederation`  
     (`vi.js:5036,5051,5214,5242`; `en.js:5128,5143,5194,5222`)
   - **Call sites CHƯA migrate:**
     - `AIUsageDashboard.tsx:140,141,142,143,149,150,164,170,176,192,229` → `t("usage.*")`
     - `AIAgentFederationPanel.tsx:70,91,97,104,110,113,163…297` → `t("agentFederation.*")`
     - Tests: `AIUsageDashboard.component.test.js:62,64,74,84,89` assert key cũ
   - **Steps bắt buộc (B.4):**
     1. Diff key sets: `usage` vs `aiUsageAnalytics`, `agentFederation` vs `aiAgentFederation` — ensure target namespace đủ key (copy missing từ source).
     2. `replace` all call sites component + tests → target namespace.
     3. Grep proof (exit fail nếu ≠0):
        ```
        Select-String -Path src/components/AIUsageDashboard*.tsx,src/components/AIUsageDashboard*.js -Pattern 't\("usage\.'  # 0
        Select-String -Path src/components/AIAgentFederationPanel.tsx -Pattern 't\("agentFederation\.'  # 0
        ```
     4. **Chỉ khi** grep 0: giữ old blocks `usage`/`agentFederation` 1 sprint deprecated comment — **không xóa** (F-C7: xóa sau grep 0 + 1 sprint).
   - **Acceptance:** B-AC4 + B-AC5 PASS. **DONE (Entry 201)** — grep 0; DEPRECATED comments in place; F-C7 deferred 1 sprint.

5. Page chrome Agents/Usage — **OPEN**.

6. i18n nav keys `aiCommandCenter.tab*|backToHub` — **OPEN** (thêm VI+EN).

#### B.2 AC

| ID | Criteria | Verify | PASS |
|----|----------|--------|------|
| B-AC1 | Hub → Agents | Manual | ☐ |
| B-AC2 | Hub → Usage | Manual | ☐ |
| B-AC3 | Agents/Usage → back hub | Manual | ☐ |
| B-AC4 | `t("agentFederation.` call sites = 0 | Shell | ☑ PASS (Entry 201) |
| B-AC5 | `t("usage.` call sites in AI components = 0 | Shell | ☑ PASS (Entry 201) |
| B-AC6 | EN no raw keys | Manual | ☐ |
| B-AC7 | G1–G5 | Logs | ☐ |

#### B.3 Phản biện

- B.4 chưa 0-hit → **reject ship B**
- Xóa old i18n blocks trước khi call sites migrate → runtime miss key → reject (F-C7)

#### B.4 Evidence

- **DONE (Entry 201):** `docs/evidence/ai-cc/B4/gates.md` — grep 0-hit, tsc 0, vitest 3/3, i18n:scan 0.
- screenshot nav — remaining B nav (hub/link) still OPEN.

---

### SLICE C — Multi-tenant config plane (BE SSOT)

> **STATUS: DONE (2026-09-24) — Entry 202**  
> Evidence: `docs/evidence/ai-cc/C/gates.md` (8 isolation + 61 regression OK, C-AC1…7 PASS).

> **STATUS: NOT STARTED (F-C5)**  
> `UserAICredential` (`advisory/models.py:218-229`) **chỉ có**: `ai_provider`, `ai_model`, `encrypted_api_key`, `custom_endpoint`, `fallback_quota_*`, `is_active`.  
> **Thiếu 5 field:** `temperature`, `max_tokens_per_day`, `refresh_interval_hours`, `max_auto_refreshes_per_day`, `prompt_config`.  
> GET **vẫn** `config.temperature` / `config.max_tokens` + metadata dict: `portfolio_analytics_views.py:486-489`.  
> PUT **vẫn** ghi `metadata` + `config.max_tokens`/`temperature` (global) song song user cred — xem PUT block `:514+`.

**Files:**

- `packages/core/backend/src/advisory/models.py` + **new migration**
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` GET/PUT
- FE chỉ nếu response shape đổi (mặc định **giữ key response**)

#### C.1 Requirements (không hỏi lại) — OPEN

Bảng ownership như Rev.1 — **chưa implement**. Checklist:

| Step | Task | Status |
|------|------|--------|
| C.1.1 | AddField 5 field trên `UserAICredential` | ☑ DONE |
| C.1.2 | Migration + `makemigrations` | ☑ 0007 |
| C.1.3 | GET: prefer user field, fallback system defaults | ☑ |
| C.1.4 | PUT: **chỉ** ghi UserAICredential cho per-user fields; **không** `config.temperature`/`max_tokens`/metadata policy | ☑ |
| C.1.5 | Lazy default (không backfill mass) | ☑ |
| C.1.6 | Audit before/after reflects user rows | ☑ (+sanitize max_tokens fix) |
| C.1.7 | BE tests 2-user isolation ≥4 | ☑ 8 tests |

#### C.2 AC — **all PASS (Entry 202)**

| ID | Criteria | Status |
|----|----------|--------|
| C-AC1 | UserA temp ≠ UserB | ☑ PASS |
| C-AC2 | UserA tokens ≠ UserB | ☑ PASS |
| C-AC3 | UserA prompt ≠ UserB | ☑ PASS |
| C-AC4 | PUT không đổi SystemAISettings | ☑ PASS |
| C-AC5 | FE shape cũ | ☑ 18 keys stable |
| C-AC6 | check + migration | ☑ 0 + clean |
| C-AC7 | G6–G7 | ☑ 69 BE tests OK |

#### C.3 Phản biện / C.4 Evidence

- Chỉ thêm field không đổi PUT → reject
- Evidence: migration + 2-user BE test log

---

### SLICE D — Permission Usage + Agent ownership

> **STATUS: DONE (2026-09-24) — Entry 200**  
> Evidence: `docs/evidence/ai-cc/D/gates.md` (22/22 BE tests PASS, D-AC1…8 PASS).  
> Pre-existing latent bug fixed: `db_router._CORE_APPS` missing `ai_agents`/`ai_analytics`.

**Files:**

- `packages/core/backend/src/ai_analytics/views.py`
- `packages/core/backend/src/ai_agents/views.py`
- `packages/core/backend/src/ai_agents/models.py` (UniqueConstraint) + migration
- Tests BE

#### D.1 Requirements — **chưa implement (audit F-C3/F-C4)**

**D1 — Usage self-scope (F-C3 OPEN):**

| Current | Target |
|---------|--------|
| `permission_classes = [IsAuthenticated, IsCoreOperator]` ×3 (`:14,64,86`) | `[IsAuthenticated]` |
| `AIUsageRecordListView.get`: `AIUsageRecord.objects.all()` + optional `user_id` filter **bất kỳ** | Default `filter(user=request.user)`; if `request.user.is_staff` → allow full + optional `user_id` |
| `AIUsageSummaryView` / `AIUsageAggregateView`: all rows | same self-scope (Summary model: filter via join user or deny cross-user — implement: if model has no user FK, scope via related records or restrict list view only + document) |

*Implementation note:* Confirm `AIUsageSummary` has `user` FK or only aggregate — if no user dimension, **aggregate only current user's `AIUsageRecord`**.

**D2 — Agent ownership (F-C4 OPEN):**

| Op | Current | Target |
|----|---------|--------|
| GET list `:13` | `AgentRegistry.objects.all()` | staff → all; else `created_by=request.user` |
| POST `:27` | `created_by=request.user` ✅ | giữ |
| GET detail `:40` | no ownership | staff or created_by → else 404 |
| PATCH `:47-55` | no check `serializer.save()` | staff or `agent.created_by == request.user` → else **403** |
| DELETE `:57-62` | no check | same → else **403** |
| Model `unique name` | `unique=True` global | `UniqueConstraint(name, created_by)` + migration |

**SOC impact (audit Q4):** `IsCoreOperator` **chỉ** gỡ trên `ai_analytics/*` — **không đụng** `ops_audit`, `signal_intelligence/admin_views` (vẫn staff-only).

**D3 — FE route:** giữ 3 routes + capability; **không** StaffRoute usage (đã chốt self-scope).

#### D.2 AC — **tất cả FAIL hiện tại**

| ID | Criteria | Status |
|----|----------|--------|
| D-AC1 | Usage 200 self data | ☑ PASS |
| D-AC2 | Không leak user khác | ☑ PASS (self-scope + user_id ignored) |
| D-AC3 | UserA list không thấy agent UserB | ☑ PASS |
| D-AC4 | UserA PATCH/DELETE agent UserB → 403 | ☑ PASS |
| D-AC5 | 2 user same agent name OK | ☑ PASS (UniqueConstraint) |
| D-AC6 | Staff list all | ☑ PASS |
| D-AC7 | FE usage non-staff không 403 | ☑ PASS (BE 200) |
| D-AC8 | G6–G7 | ☑ check 0 + makemigrations clean + 22 tests |

#### D.3 Phản biện

- Gỡ IsCoreOperator **không** filter user → leak → reject
- Chặn FE mở BE open → reject
- SOC views bị gỡ nhầm → regression staff ops → chỉ đổi `ai_analytics`

#### D.4 Evidence

- BE test matrix 4 role
- curl 403/200 before/after

---

### SLICE E — i18n hardcode + UI polish

> **STATUS: DONE (2026-09-24, Entry 205)** — sau Entry 204 (B rest + F6a DONE).  
> Scope: 4 component files + `vi.js`/`en.js` keys mới + RTL EN locale test.  
> **Defer**: E.1 item 3 (accent-color) + item 4 (API-key mask) → F; `ShellAiCommandCenterPage.tsx` out of scope (separate).  
> Evidence: `docs/evidence/ai-cc/E/gates.md`.

**Files:**

- `AIUsageDashboard.tsx` (headers `:44-46`, table `:197`, pagination `:239-249`) ✅
- `AIAgentFederationPanel.tsx` (`:185,225` placeholders, `:287` Có/Không) ✅
- `AIAdvisoryPromptConfigDrawer.js:351` footer ✅
- `AIAuditLogsPanel.tsx:252` ✅
- `ShellAiCommandCenterPage.tsx` snapshot strings — **OUT OF SCOPE / DEFERRED** (still ships `pageRegistry:203-204`, ~100 strings separate slice)
- `vi.js`/`en.js` keys mới ✅ (+9 `aiCommandCenter` + `yes/no` + `prev/next/pageOf/perPage`)
- Tests: RTL EN locale không VI hardcode ✅ (`AISliceE.i18n.component.test.js` 3/3)

#### E.1 Requirements

1. Mọi string UI trong 4 component → `t("…")`; thêm keys — **DONE** (reuse `TABLE_HEADER_KEYS` → existing `createdAt/action/...`; new keys actionAll/auditShowing/reasonPrefix/promptDrawerFooter/yes/no/prev/next/pageOf/perPage).
2. Bỏ hardcode `toLocaleDateString("vi-VN")` → theo `localeTag` từ i18n context — **DONE** (`toCsv`, `formatDate` audit).
3. Checkbox/toggle accent-color — **DEFERRED → F**.
4. API key mask / `has_api_key` — **DEFERRED → F** (per plan note “chọn: defer mask UX đầy đủ sang F; E chỉ i18n”).

#### E.2 AC

| ID | Criteria | Verify | PASS |
|----|----------|--------|------|
| E-AC1 | Locale **EN** Usage table toàn English | RTL vitest | ☑ PASS |
| E-AC2 | Locale **EN** Agents không “Có/Không”/“VD:” | RTL vitest | ☑ PASS |
| E-AC3 | Drawer footer EN/VI đúng key | RTL vitest | ☑ PASS |
| E-AC4 | `rg`/node hardcode pattern trong 4 files ≈ 0 | `scripts/slice-e-hardcode-scan.mjs` | ☑ PASS (0) |
| E-AC5 | G1–G5 | gates.md | ☑ PASS (tsc/build/eslint/vitest/scan) |
| E-AC6 | Manual VI/EN screenshots | user | ☐ PENDING |

#### E.3 Phản biện

- Chỉ thêm keys en nhưng component vẫn hardcode → E-AC1 FAIL — mitigated by EN mock `t: (key) => EN_KEYS[key] ?? key` + `VI_HARDCODE` assertion list.
- Sweep key trùng tên khác namespace → missing key regression — mitigated: use target ns `aiUsageAnalytics.*` / `aiAgentFederation.*` / `aiCommandCenter.*`; old blocks DEPRECATED not deleted.

#### E.4 Evidence

- `docs/evidence/ai-cc/E/gates.md` (full gates + key tables + code detail).
- grep/node before/after: `TOTAL_HITS=0`.
- Manual screenshots PENDING (user).

---

### SLICE F — Competitive upgrade (sprint riêng, optional ship)

**Status 2026-09-24 (Entry 211):** F1 ✅ F2 ✅ F3 ✅ F4 ✅ F5 ✅ F6 ✅ F7 ✅ **F8 ✅** — F9 BACKLOG — F6b BLOCKED (proxy C2). Evidence `docs/evidence/ai-cc/F/gates.md` + `F3/gates.md` + `F7/gates.md` + `F8/gates.md`.

| ID | Requirement | AC | Status |
|----|-------------|-----|--------|
| F1 | Usage chart (line/bar 30d tokens+cost) — Recharts đã có trong app | F-AC1 render non-empty with data mock | **DONE (207)** real summary API |
| F2 | Filter by model/status/date + server filter if API supports | F-AC2 filter changes rows | **DONE (207)** model+status (date=days period已有) |
| F3 | Budget soft/hard: warning 80%, block gọi advisory khi hard > max (BE check) | F-AC3 integration | **DONE (209)** soft 80% + hard 100% + per-user budget |
| F4 | Masked key `sk-…last4` + “Xóa key” | F-AC4 không lộ full key trong DOM | **DONE (207)** |
| F5 | System prompt template viewer (`SystemAISettings.prompt_template`) | F-AC5 read-only panel | **DONE (207)** |
| F6 | Provider catalog 2025–26 (gpt-4.1/4o, o3, claude-4, gemini-2.5) in `providerModels.ts` | F-AC6 list đúng | **DONE (207)** |
| **F6a** | **Catalog-only: + `gemini-3.8-flash` FE `providerModels.ts` + BE `SystemAISettings.ModelChoices` + migration AlterField choices CHỈ SystemAISettings** | **F-AC6a** `gemini-3.8-flash` xuất hiện cả FE select + BE choices; `makemigrations --check` clean sau khi tạo 0008 | **DONE (204)** |
| **F6b** | **CONDITIONAL service layer** `advisory/gemini_client.py` + `google-genai` + param mapping C4 + centralized factory C3 — **chỉ implement nếu proxy C2 test FAIL** | **F-AC6b** (deferred until proxy verdict) | **BLOCKED** proxy C2 |
| F7 | Prompt config version history (JSON append on save) + rollback | F-AC7 rollback GET old | **DONE (210)** history cap 20 + POST rollback |
| F8 | Shell page: import shared form từ `AICommandCenterPage` extract `AICommandCenterForm` | F-AC8 0 field drift (checklist field list) | **DONE (211)** shared form + parity test |
| F9 | Task→model routing (advisory vs analysis) | optional — **defer nếu >2d** | BACKLOG |

#### F6a — Ship ngay (APPROVED theo audit `AUDIT_F6_GEMINI_38_FLASH_20260924.md`)

| Item | Detail | Audit finding |
|------|--------|---------------|
| FE | `packages/web/src/shared/providerModels.ts:13-18` — `PROVIDER_MODELS.gemini` += `gemini-3.8-flash` (giữ 1.5 + custom) | 5/5 CORRECT |
| BE | `advisory/models.py:26-27` `SystemAISettings.ModelChoices` += `GEMINI_38_FLASH = 'gemini-3.8-flash'` | C1 |
| Migration | **Chỉ** `SystemAISettings.ai_model` AlterField choices → `0008_*`. **KHÔNG** migration `UserAICredential.ai_model` (no choices, auto-accept) | **C1 LOW** |
| requirements | **KHÔNG** thêm `google-genai` (premature). Optional comment marker: `# google-genai>=1.0  # F6b pending` | **C5 LOW** |
| Effort / Risk | ~0.5d / LOW | — |

**F6a gates:** `npx tsc --noEmit` 0; `manage.py check` 0; `makemigrations --check` clean (sau khi tạo 0008); optional `npm run build`.

#### F6b — CONDITIONAL (blocked trên proxy C2)

**Gate trước khi code:** test proxy

```bash
curl -X POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Hello"}]}'
```

| Proxy verdict | Action |
|---------------|--------|
| **200 OK** | **F6b DEFERRED/deprecate** — catalog F6a đủ; ghi ledger + plan note |
| **4xx/5xx** | Implement F6b immediately |

**F6b requirements nếu proxy FAIL:**

1. `advisory/gemini_client.py` — lazy `from google import genai`; clear error if missing.
2. **C4 param mapping explicit** (Gemini native ≠ OpenAI):
   ```python
   def _map_to_gemini_params(openai_params: dict) -> dict:
       return {
           'temperature': openai_params.get('temperature', 0.7),
           'topP': openai_params.get('top_p', 1.0),
           'maxOutputTokens': openai_params.get('max_tokens', 1024),
           # frequency_penalty, presence_penalty → NOT SUPPORTED → drop
       }
   ```
3. **C3 centralized fallback** — `get_ai_client(provider)` factory (orchestrator/view một điểm quyết định SDK vs OpenAI-compat path); KHÔNG phân tán fallback.
4. `requirements.txt` += `google-genai>=1.0` **chỉ khi F6b ship**.
5. Wire: `orchestrator.py:194-195` + `portfolio_analytics_views.py:830-831` qua factory.
6. Tests: mock `google.genai`; param-map unit; fallback path.

**F6b gates (nếu chạy):** BE `manage.py check` 0; `makemigrations --check` clean; mock tests pass; FE `tsc` 0.

**Phản biện F:** chart mock-only không connect API → reject; mask chỉ CSS `•` mà value full key trong React state仍 render → reject (dùng type=password + không render value khi has_key).

---

### SLICE G — Hardening / CI

> **STATUS: DONE (2026-09-24, Entry 206)**  
> Evidence: `docs/evidence/ai-cc/G/gates.md`.

1. **i18n missing-key test:** unit test load `vi.js`+`en.js` — assert key set **equal** cho namespace `aiCommandCenter|aiAgentFederation|aiUsageAnalytics` — **DONE** (`ai-cc-i18n-parity.component.test.ts`, 4 tests).
2. **Contract smoke:** vitest fixture CC GET/PUT/test + usage record/aggregate + agent fields vs BE serializers/views — **DONE** (`ai-cc-contract-smoke.component.test.ts`, 6 tests).
3. `i18n:scan` trong `check:shell` — **DONE** (`package.json:12` += `&& npm run i18n:scan`).
4. AC: G-AC1 two catalogs key-diff = 0; G-AC2 CI script exit non-zero on missing — **PASS** (parity test fails on missing keys; run via `test:components` / vitest).

**Gates**: tsc 0; build 30.34s PASS; eslint 0; vitest G+E **5 files/19 PASS**; i18n:scan 0; `check:shell` exit 0.

---

## 3. TEST MATRIX TỔNG (nghiệm thu cuối dự án)

### 3.1 FE automated

| Suite | Count (tối thiểu) | Command |
|-------|-------------------|---------|
| `AICommandCenterPage.component.test.js` | ≥4 (3 cũ + 1 i18n) | vitest |
| `AIUsageDashboard.component.test.js` | ≥5 (update keys EN) | vitest |
| `AIAgentFederation` tests | ≥2 (load + forbidden msg) | vitest |
| i18n key-parity | 1 | vitest or node script |
| **Total new/rework** | **≥8** | |

### 3.2 BE automated

| Suite | Tests | Notes |
|-------|-------|-------|
| CC config isolation | ≥4 | 2-user matrix |
| Usage permission | ≥3 | self / other / staff |
| Agents ownership | ≥5 | list/post/patch/delete/name-unique |
| Audit still works | existing | no regression |
| **Total** | **≥12 new** + existing green | |

### 3.3 Manual E2E checklist (15' cho QA)

1. Login user A — open `/settings/ai` — **0 raw key**
2. Đổi interval + temperature + save — policy card khớp — reload khớp
3. Tab Agents — create — back hub
4. Login user B — usage chỉ data B — agents list trống/riêng
5. User B không sửa agent A
6. Switch EN — 0 VI hardcode trên 3 trang
7. Fallback quota render không crash
8. Test connection button vẫn hoạt động

---

## 4. BẢNG ĐỐI CHIẾU PLAN ↔ CODE (cho reviewer)

| Claim plan | file:line (HEAD audit 2026-09-24) | Status after Rev.2 |
|------------|-----------------------------------|---------------------|
| Thiếu `aiCommandCenter.eyebrow` | `vi.js:5164` **có** | **DONE F-C1** |
| `t()\|\|` ineffective | pattern `:319+` vẫn còn | **DONE Entry 208** — 0 remaining |
| Policy stale after save | `:235-238` **đã set** | **DONE F-C1** |
| Quota `!` | `:525-526` **đã fix** | **DONE F-C1** |
| Usage IsCoreOperator | ~~`ai_analytics/views.py:14,64,86`~~ | **DONE Entry 200** |
| Agent no ownership | ~~`ai_agents/views.py:13,54,61`~~ | **DONE Entry 200** (+0002 UniqueConstraint, db_router fix) |
| Global config write | ~~GET SystemAISettings; model thiếu 5 field~~ | **DONE Entry 202** (+0007, user-first GET/PUT) |
| Dual i18n call sites | ~~Dashboard+Panel old ns~~ | **DONE Entry 201** — target ns only |
| Catalog keys target ns | `aiUsageAnalytics`/`aiAgentFederation` **đã có** | chỉ migrate call sites |
| Sidebar `/settings/ai` | `sidebaritems.ts:36` | PARTIAL (entry yes, hub tabs no) |
| Test hides i18n | TRANSLATIONS mock **DONE** | **DONE F-C1** |

---

## 5. RISK & MITIGATION

| Risk | Mitigation |
|------|------------|
| Migration C break existing system default runtime | GET fallback chain: user → system; deploy order: migrate → dual-read → stop system write |
| FE field name break | Keep response keys stable (§C.1) |
| i18n mass rename miss a call site | `rg` gates B-AC4/5 before merge |
| Staff lose usage overview | Staff branch all-users (D-AC6) |
| Scope creep Slice F | Ship A–E+G first; F ticket riêng |
| F6b premature `google-genai` dep | C5: F6a chỉ comment marker; add package **chỉ khi** proxy C2 FAIL + F6b ship |
| F6a migration scope sai | C1: AlterField **chỉ** `SystemAISettings`; `UserAICredential.ai_model` no choices → skip |

---

## 6. MILESTONE & SIGN-OFF

| M | Scope | Exit criteria | Sign-off |
|---|-------|---------------|----------|
| **M1** | Slice A | A-AC1…7 + G1–5,9,10 | ☑ DONE automated (198); F-C6 (208); A-AC3 screenshot PENDING |
| **M1b** | D security | D-AC1…8 all PASS + BE tests | ☑ DONE (Entry 200) |
| **M2** | B.4 namespace + B nav | B-AC1…7 + B-AC4/5 = 0 | ☑ B.4 (201) + nav (204) |
| **M3** | Slice C | C-AC1…7 | ☑ DONE (Entry 202) |
| **M4** | Slice D | (gộp M1b) | ☑ (Entry 200) |
| **M5** | Slice E | E-AC1…5 | ☑ DONE (205); manual screenshots PENDING |
| **M6** | Slice G | G-AC* | ☑ DONE (206) |
| **M7** | Slice F | F-AC1…8; **F6a F-AC6a**; F6b F-AC6b if proxy FAIL | ☑ F1/F2/F3/F4/F5/F6/F7 + F6a + F8 (207,209,210,211); F6b blocked; F9 backlog |
| **SHIP** | A+D+B+C+E+G+F(subset)+F3+F-C6+F7+F8 | DOD all + §3 manual | ☑ automated (211); §3.3 manual PENDING |

**Phản biện tổng cuối (Gate Review — 3 câu hỏi bắt buộc):**

1. Mỗi E-0x/G-0x từ audit đã map đúng slice và AC?
2. Test có **fail khi revert fix** (mutation check từng P0)?
3. Evidence folder đủ §0.1 cho từng slice?

Trả lời **No** → không sign-off.

---

## 7. FILE INVENTORY CHẠY (checklist implementer)

```
[ ] packages/web/src/i18n/vi.js
[ ] packages/web/src/i18n/en.js
[ ] packages/web/src/pages/AICommandCenterPage.tsx
[ ] packages/web/src/pages/AICommandCenterPage.component.test.js
[ ] packages/web/src/components/AIAgentFederationPanel.tsx
[ ] packages/web/src/components/AIUsageDashboard.tsx
[ ] packages/web/src/components/AIAuditLogsPanel.tsx
[ ] packages/web/src/components/AIAdvisoryPromptConfigDrawer.js
[ ] packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts
[ ] packages/web/src/app/routeCatalog.js          # chỉ nếu nav meta
[ ] packages/web/src/shared/providerModels.ts     # F6a
[ ] packages/core/backend/requirements.txt        # F6b only (comment marker OK F6a)
[ ] packages/core/backend/src/advisory/gemini_client.py  # F6b only, conditional
[ ] packages/core/backend/src/advisory/models.py
[ ] packages/core/backend/src/advisory/migrations/00xx_*.py  # 0007 done; 0008 = F6a choices
[ ] packages/core/backend/src/advisory/orchestrator.py       # F6b wire (C3 factory)
[ ] packages/core/backend/src/user_workspace/portfolio_analytics_views.py
[ ] packages/core/backend/src/ai_analytics/views.py
[ ] packages/core/backend/src/ai_agents/views.py
[ ] packages/core/backend/src/ai_agents/models.py + migration
[ ] packages/core/backend/tests/test_ai_cc_config_isolation.py  # Slice C (path澄清 F-01)
[ ] docs/CODE_CHANGE_AUDIT_LEDGER.md
[ ] docs/evidence/ai-cc/<slice>/*
```

---

## 8. LỆNH GATES MẪU (copy-paste)

```bash
# FE
cd "packages/web"
npx tsc --noEmit
npx vitest run src/pages/AICommandCenterPage.component.test.js src/components/AIUsageDashboard.component.test.js
npm run lint
npm run i18n:scan
npm run build

# BE
cd "packages/core/backend"
python src/manage.py check
python src/manage.py test ai_analytics ai_agents user_workspace.tests.test_ai_management_center  # adjust names
python src/manage.py makemigrations --check
```

---

## 9. ĐỐI CHIẾU BENCHMARK (tham chiếu Slice F)

| Capability | Gold-standard (OpenAI/LangSmith/SA/TV) | VNInvest hiện tại | Slice |
|------------|----------------------------------------|-------------------|-------|
| Central hub + subnav | ✅ | ❌ Orphan | B |
| Per-user key + masked + rotate | ✅ | ⚠️ BYOK no mask | F4 |
| Usage by model/time + export | ✅ | ⚠️ Basic + permission clash | D + F1–2 |
| Budget/hard cap alerts | ✅ | ⚠️ global field only | C + F3 |
| Audit trail before/after | ✅ | ✅ | giữ |
| Multi-tenant isolation | ✅ | ❌ Global singleton + agent leak | C + D |
| Test connection + latency | ✅ | ✅ | giữ |

---

**Hết tài liệu plan `IC-SSOT-20260924`.**  
Sau mỗi slice: cập nhật ledger + evidence folder trước khi qua slice kế.
