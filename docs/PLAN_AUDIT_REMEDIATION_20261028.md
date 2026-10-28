# Plan Triển Khai Khắc Phục Audit Codebase 2026-10-28

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa codebase từ trạng thái "build xanh nhưng test đỏ / hạ tầng test thiếu" về trạng thái production-ready theo audit `docs/AUDIT_CODEBASE_20261028.md`.

**Architecture:** Không thay đổi kiến trúc; chỉ dọn dẹp, bổ sung test infra, sửa test fail, chuẩn hóa lint/style, và refactor các god file theo domain. Giữ nguyên SOC glassmorphism + i18n + adapter pattern.

**Tech Stack:** React 19 + Vite + TypeScript + Jest/Vitest (FE); Django 5.2 + Postgres + pytest-style `manage.py test` (BE); ruff; Docker staging.

**Spec:** `docs/AUDIT_CODEBASE_20261028.md`

## Global Constraints

- Không commit thẳng vào `dev`; mọi thay đổi qua branch `feat/<slice>-<agent>` + PR.
- Không commit 10 file shared (AGENTS.md §2); ledger được phép append.
- BE test bắt buộc Postgres (`CORE_DATABASE_URL`); SQLite không dùng được (migration `array_agg`).
- FE: `npx tsc --noEmit` sau mỗi sub-step; `npm run build` cuối mỗi phase.
- Báo trạng thái gate: `PASS` / `FAIL` / `CHƯA CHẠY` — không suy ra.
- Vietnamese labels full dấu; i18n qua `LangContext`.
- Lessons áp dụng: [L-G01, L-G02, L-G03, L-G04, L-F01, L-F09, L-F10] — thứ tự rebase → check migration → gate; không báo PASS cho thứ chưa chạy; gate trên máy agent không đại diện cho máy khác; không suy ra số liệu từ scanner mà không kiểm chứng.

## Review Focus

1. Dirty working tree có thể che mất file đang bị giữ (AGENTS.md cạm bẫy).
2. BE test "xanh giả" do chạy sai DB engine.
3. Lint/ruff số liệu lớn có thể bị thổi phồng (L-G04) — cần phân loại trước khi sửa.
4. Refactor god file có thể phá contract SOC nếu không có test regression.
5. i18n duplicate keys silently override → sai ngôn ngữ.

---

## Phase 0 — Repo Hygiene (Must)

### Task 0.1: Commit working tree hiện tại vào branch riêng

**Files:**
- Modify (already): `packages/web/src/adapters/core/soc.js`, `packages/web/src/adapters/coreApiAdapter.d.ts`, `packages/web/src/components/soc/DataOpsContext.tsx`, `packages/web/src/components/soc/SocDataOpsPanel.tsx`, `packages/web/src/components/soc/SocRuntimeKpiPanel.tsx`, `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx`

- [ ] **Step 1:** Tạo branch `feat/soc-dataops-polling-cleanup` từ `dev` (đã rebase).
- [ ] **Step 2:** Review diff từng file (đặc biệt DataOpsContext polling 15s + visibility).
- [ ] **Step 3:** Commit với message mô tả; push; mở PR.
- [ ] **Step 4:** Verify `git status` sạch.

**Interfaces:** Không có API mới; chỉ hygiene.

---

## Phase 1 — Test Infrastructure BE (Must)

### Task 1.1: Dựng Postgres + env local

**Files:**
- Create/modify: `packages/core/backend/.env` (từ `.env.example` / `compose.staging.env.example`)

- [ ] **Step 1:** Kiểm tra Postgres service (local hoặc Docker `my-postgres`).
- [ ] **Step 2:** Tạo `.env` với `CORE_DATABASE_URL=postgres://...` và `DJANGO_DEBUG=1`.
- [ ] **Step 3:** Chạy `python manage.py migrate` → verify exit 0.
- [ ] **Step 4:** Ghi baseline vào docs (số test pass/fail) — không đoán.

### Task 1.2: Chạy full BE suite baseline

**Files:**
- Modify: `docs/AUDIT_CODEBASE_20261028.md` (cập nhật số thực)

- [ ] **Step 1:** `cd packages/core/backend && python run_tests.py` (full).
- [ ] **Step 2:** Ghi số label pass/fail/errors + tên test fail đầu tiên.
- [ ] **Step 3:** Commit baseline doc.

---

## Phase 2 — Fix FE Test Failures (Must)

### Task 2.1: Fix jest ESM `__dirname` trong field-contract test

**Files:**
- Modify: `packages/web/src/adapters/core/__tests__/field-contract.test.js`

- [ ] **Step 1:** Viết/điều chỉnh test để dùng `import.meta.url` + `fileURLToPath` (hoặc chuyển sang CommonJS).
- [ ] **Step 2:** Run `npm test -- field-contract` → expect PASS.
- [ ] **Step 3:** Commit.

### Task 2.2: Fix WorkstationLayout.test.jsx (9 fail)

**Files:**
- Modify: `packages/web/src/components/workstation/WorkstationLayout.test.jsx`
- Possibly: `packages/web/src/components/workstation/WorkstationLayout.*`

- [ ] **Step 1:** Đọc test fail để xác định contract mới (không đoán).
- [ ] **Step 2:** Sửa component hoặc test theo contract thật; ưu tiên sửa code nếu test đúng.
- [ ] **Step 3:** Run `npm test -- WorkstationLayout` → PASS.
- [ ] **Step 4:** Commit.

### Task 2.3: Fix vitest commercial-page contract (3 fail)

**Files:**
- Modify: `packages/web/src/components/__tests__/commercial-page.component.test.tsx` (chỉ nếu test sai)
- Modify: component commercial page liên quan

- [ ] **Step 1:** Xóa hex cứng → dùng token CSS.
- [ ] **Step 2:** Chuyển chuỗi tiếng Việt hardcode → i18n `t()`.
- [ ] **Step 3:** Sửa error state: `role=alert` + nút "Thử lại" + text hướng khắc phục.
- [ ] **Step 4:** Run vitest → PASS.

### Task 2.4: Fix i18n duplicate keys (2 fail)

**Files:**
- Modify: `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`

- [ ] **Step 1:** Chạy scanner để liệt kê duplicate nested keys.
- [ ] **Step 2:** Dedupe (giữ bản đúng theo locale).
- [ ] **Step 3:** Cập nhật baseline test nếu cần (có lý do).
- [ ] **Step 4:** Run vitest `tenantreg-dup-i18n-keys` → PASS.

---

## Phase 3 — Standardization (Should)

### Task 3.1: Lint cleanup FE (4.416 warnings)

**Files:**
- Modify: các file shell/admin SOC có hardcoded strings (ưu tiên `soc/`).

- [ ] **Step 1:** Phân loại warnings theo L-G04: thật / tương đối / không phải lỗi. Ghi số thực.
- [ ] **Step 2:** Migrate chuỗi sang i18n cho file SOC DataOps trước.
- [ ] **Step 3:** Run `npm run lint` → giảm đáng kể; `npm run i18n:scan:strict`.
- [ ] **Step 4:** Commit theo batch nhỏ.

### Task 3.2: Ruff cleanup BE (3.280 errors)

**Files:**
- Modify: `packages/core/backend/src/**`

- [ ] **Step 1:** Chạy `ruff check --fix` trên branch riêng; review diff (auto-fix an toàn).
- [ ] **Step 2:** Xử lý lỗi còn lại thủ công (encoding, import).
- [ ] **Step 3:** Run ruff → 0 errors (hoặc ghi lý do còn lại).
- [ ] **Step 4:** Commit.

---

## Phase 4 — Refactor & Type Safety (Should)

### Task 4.1: Tách god files theo domain (BE)

**Files:**
- Modify: `stock_mgmt_native_views.py`, `portfolio_analytics_views.py`, `data_ingest/tasks.py`

- [ ] **Step 1:** Xác định ranh giới domain (module) cho mỗi file.
- [ ] **Step 2:** Tách thành sub-module, giữ nguyên public API.
- [ ] **Step 3:** Chạy BE tests liên quan → PASS.
- [ ] **Step 4:** Commit.

### Task 4.2: Tách SOC panel god files (FE)

**Files:**
- Modify: `SocSignalsPanel.tsx` (2.454), `SocVnbrokerPanel.tsx` (1.410), `SocOverviewPanel.tsx` (1.174)

- [ ] **Step 1:** Tách sub-component theo tab/section.
- [ ] **Step 2:** Thêm component test regression (polling, error banner).
- [ ] **Step 3:** Run vitest → PASS; tsc → PASS.

### Task 4.3: Type safety adapter layer

**Files:**
- Modify: `packages/web/src/adapters/coreApiAdapter.d.ts`

- [ ] **Step 1:** Thay `any` bằng type cho endpoint SOC DataOps trước.
- [ ] **Step 2:** tsc → PASS.
- [ ] **Step 3:** Commit.

---

## Phase 5 — Verification & Staging (Must)

### Task 5.1: Full gate local

- [ ] **Step 1:** `npx tsc --noEmit` → PASS.
- [ ] **Step 2:** `npm run build` → PASS.
- [ ] **Step 3:** `npm run lint` → 0 errors.
- [ ] **Step 4:** `npx vitest run` → 0 fail.
- [ ] **Step 5:** `npm test` → 0 fail.
- [ ] **Step 6:** BE `run_tests.py` → baseline pass.

### Task 5.2: Staging deploy verify

- [ ] **Step 1:** PR merge → deploy staging `bash scripts/deploy-staging.sh --verify`.
- [ ] **Step 2:** Ghi evidence vào ledger Entry mới.
- [ ] **Step 3:** Cập nhật `docs/AUDIT_CODEBASE_20261028.md` với số thực.

---

## Lessons áp dụng

Lessons áp dụng: [L-G01, L-G02, L-G03, L-G04, L-F01, L-F09, L-F10].

MANDATORY CHECKLIST:
- [ ] Rebase → check migration → gate theo thứ tự.
- [ ] Không báo PASS cho thứ chưa chạy.
- [ ] Gate chạy lại sau rebase trên đúng môi trường.
- [ ] Phân loại số liệu scanner trước khi báo cáo.
- [ ] Đo bundle bằng cạnh import tĩnh (nếu đụng bundle).
- [ ] Object literal của hook ở cấp module.
- [ ] Ghi lesson mới nếu mắc lỗi tốn thời gian.

---

## Rủi ro & rollback

- Nếu Phase 2/3 làm test đỏ hơn → rollback theo commit nhỏ; không revert cả lot (L-G06).
- Nếu refactor god file phá contract → giữ API cũ, tách dần.
- Nếu staging fail → redeploy `dev` trước đó, ghi ledger.
