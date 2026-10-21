# TEST REPORT — UI Standardization W0

> **Nhánh:** `feat/uistd-w0` @ `10c5c7acc` · **Base:** `dev` @ `e7b008f25`
> **Ngày chạy:** 2026-10-21 · **Máy:** Windows (PowerShell 5.1) · **Node:** v24.14.1
> **Cách chạy:** từ `packages/web` trừ khi ghi khác. **Mọi exit code dưới đây là số thật** — lệnh chưa chạy ghi `CHƯA CHẠY`, không ghi "PASS".

## 1. Baseline gốc (đo trên `dev` sạch, trước khi code)

| Gate | Baseline `dev` | Ghi chú |
|---|---|---|
| `tsc --noEmit` | 0 | |
| `lint` | 0 error / 4191 warning | |
| `jest` | **1** (3 suite / 9 test FAIL nền) | ⇒ **delta-only** |
| `vitest` | 0 (168 file / 1142 test) | |
| `build` | 0 | |
| `check:dom-landmarks` | 0 | |
| `check:contrast` | 0 | gate không đọc file CSS |
| `check:tokens` | **1** (1 lỗi nền `brokerData.css #c4b5fd`) | ⇒ **delta-only** |
| `i18n:scan:strict` | 0 | |
| `check-lessons` | 0 | |
| `check-multi-agent` | 0 | |
| `normalize-eol` | 0 | |

## 2. Kết quả trên `feat/uistd-w0` (đã merge S3 → S1 → S2)

| # | Lệnh | Exit | Kết quả | Delta so với baseline |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | không in gì | 0 ⇒ 0 ✔ |
| 2 | `npx eslint src --format compact` | **0** | 4251 problems, **0 error** | 0 err ✔ · **+60 warning** `react/jsx-no-literals` (S1) |
| 3 | `npx vitest run --reporter dot` | **0** | **169 file / 1162 test PASS** | **+1 file / +20 test** (file test của S1) ✔ |
| 4 | `npm run test` (jest) | **1** | 3 failed / 18 passed (21 total) · 9 failed / 259 passed (268 total) | **3/9 = đúng baseline** ⇒ **delta 0** ✔ |
| 5 | `npm run build` (tsc && vite build) | **0** | `✓ built in 29.47s` | 0 ⇒ 0 ✔ |
| 6 | `npm run check:tokens` | **1** | đúng 1 lỗi nền `src\components\brokerData\brokerData.css: #c4b5fd` | 1 ⇒ 1 ⇒ **delta 0** ✔ |
| 7 | `npm run check:contrast` | **0** | `PASS (7 tone pairs × 2 modes >= 4.5:1)` | 0 ⇒ 0 ✔ |
| 8 | `npm run check:dom-landmarks` | **0** | `PASS (static gate)` | 0 ⇒ 0 ✔ |
| 9 | `node ../../scripts/i18n-scan-strict.mjs` | **0** | `code sach, exit 0` | 0 ⇒ 0 ✔ |
| 10 | `node scripts/check-lessons.mjs` | **0** | 45/60 lesson, 11 file sạch | 0 ⇒ 0 ✔ |
| 11 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | 0 lỗi, 0 trùng số migration | 0 ⇒ 0 ✔ |
| 12 | `node scripts/normalize-eol.mjs` | **0** | 0 file thay đổi, khớp blob gốc | 0 ⇒ 0 ✔ |
| 13 | `node scripts/pre-push-gate.mjs` (repo root) | **0** | **28 PASS / 0 FAIL / 0 SKIP** (main tree) | +5 dòng `ui-check-*` ✔ |
| 14 | `git diff --numstat e7b008f25..HEAD` | — | mọi dòng đều `+`; `scripts/pre-push-gate.mjs` = 39/0 | không file nào bị viết lại ✔ |

## 3. 5 gate UI mới (S2)

| # | Lệnh (cwd = `packages/web`) | Exit | Output thật |
|---|---|---|---|
| G1 | `node scripts/check-token-conflict.mjs` | **0** | 13 vi phạm · baseline 13 · `✓ khong co vi pham MOI` |
| G2 | `node scripts/check-focus-ring.mjs` | **0** | 8 vi phạm / 415 file · baseline 8 · `✓ khong co vi pham MOI` |
| G3 | `node scripts/check-heading-contract.mjs` | **0** | 25 vi phạm / 99 file · baseline 25 · `✓ khong co vi pham MOI` |
| G4 | `node scripts/check-theme-contrast.mjs` | **0** | 32 cặp · baseline 32 · `✓ khong co vi pham MOI` |
| G5 | `node scripts/check-a11y-runtime.mjs --advisory` | **0** | **ADVISORY** (app sống ⇒ tập vi phạm đổi theo dữ liệu: 113 → 141 → 173 trên cùng build) — báo cáo delta, **không chặn** |
| G5b | `node scripts/check-a11y-runtime.mjs` (không cờ) | **1** | chặn khi có vi phạm mới — dùng khi chạy độc lập/CI trên staging **có dữ liệu đóng** |
| ST | `--self-test` × 5 gate | **0** | 4 + 6 + 5 + 4 + 8 = **27 case** PASS |
| PR | probe suite (17 đường lách của audit vòng 1) | **0** | **17/17 bắt** (exit 1) — fixture ngoài repo, baseline đo trên fixture **SẠCH** rồi mới mutate |

## 4. Chế độ "chưa chạy được" (AC-2 câu 5)

| Lệnh | Exit | Output thật |
|---|---|---|
| `A11Y_BASE_URL=https://127.0.0.1:9 node scripts/check-a11y-runtime.mjs` | **0** | `CHUA CHAY: connect ECONNREFUSED 127.0.0.1:9` + `(khong phai '0 vi pham' — mau chua do duoc, khong ket luan)` |
| `A11Y_BASE_URL=https://127.0.0.1:9 node scripts/check-theme-contrast.mjs` | **0** | `CHUA CHAY: connect ECONNREFUSED …` rồi kết luận theo phép đo **tĩnh** (thiết kế đã ghi trong header script) |

## 5. Test mới (S1)

| Lệnh | Exit | Kết quả |
|---|---|---|
| `npx vitest run src/components/__tests__/commercial-page.component.test.tsx` | **0** | **20/20 PASS** — 20 case assert **contract** (1 `<h1>`, `role="region"`, 0 `<main>`, `aria-busy` ≠ vùng live, `<caption>` + `scope="col"/"row"`, `<dl>/<dt>/<dd>`, không hex trong CSS+JSX, prefix `.cm-`, **parity 2 chiều** class↔CSS) |

## 6. CHƯA CHẠY (không giả vờ)

| # | Mục | Lý do |
|---|---|---|
| 1 | `npm run test:visual` (Playwright visual) | **CHƯA CHẠY** — W0 không thêm/sửa test visual; baseline của plan ghi `CHƯA CHẠY` |
| 2 | BE test (Django) | **CHƯA CHẠY** — W0 là frontend-only; `agent-sync.ps1` bỏ qua khi không set `CORE_DATABASE_URL` (Docker Desktop hay tắt ⇒ Postgres 127.0.0.1:5434 không luôn khả dụng) |
| 3 | Chạy gate trên **worktree** | **KHÔNG ÁP DỤNG** — `verify-global-config` so **byte** ⇒ worktree checkout ra LF còn main tree CRLF ⇒ `global-config-drift` FAIL **chỉ ở worktree** (L-G08). Đã **đối chứng**: main tree `7 OK / 6 cập đổi byte` = PASS, `sha256(HEAD) == sha256(dev) == sha256(worktree disk)` ở cả hai ⇒ **không khác biệt code** ⇒ push thực hiện từ main tree |

## 7. Bằng chứng chống xanh giả

| Cơ chế | Kết quả |
|---|---|
| 5 gate × `--self-test` | 27 case, mọi case đều là **vi phạm đã biết** ⇒ gate bắt lỗi thật |
| Probe suite (audit vòng 1) | 17/17 đường lách đã bị chặn; 3 probe CONTROL xanh đúng khi có vi phạm mới |
| Control tương phản | `#ffffff/#000000` = 21.00:1 ✔ · `#777777/#ffffff` = 4.48:1 ✔ (in ra trong output `check-theme-contrast`) |
| Baseline **không** bị nâng để giấu hồi quy | 4/4 baseline **tái-key** với **tập vi phạm gốc giữ nguyên** (thêm 0, bớt 0 — kiểm bằng script so tập); `check-focus-ring` 2 → 8 là **gate chặt hơn phát hiện 6 vi phạm thật** (đã liệt kê trong `SUMMARY_uistd-w0-gates.md` §10.4 + ticket W1) |
| Staging không khả dụng | gate in `CHUA CHAY` + **không** kết luận xanh (đã kiểm bằng `A11Y_BASE_URL` trỏ vào cổng đóng) |
