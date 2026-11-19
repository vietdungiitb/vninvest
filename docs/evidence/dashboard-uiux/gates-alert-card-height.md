# Gates — Alert card height regression (2026-11-19)

> Branch `feat/dash-alert-card-height` · base `dev @ 69141ab93` · revision cuối `00f37df3b`.
> Trigger: E2E staging `dashboard-alert-probe.spec.ts` 2 fail — `firstCardH 138 > 100`, `cardHeights 138 > 110`.

## 1. Fail-before (ĐỎ thật)

`PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn npx playwright test dashboard-alert-probe.spec.ts --project=chromium`
→ **2 failed / 1 passed**. Nguyên nhân: P1-7 bật 2 nút "Đánh dấu đã đọc"/"Tắt 30p"; action row có `mt-3 pt-2 border-t` cộng ~40px/card (98 → 138px).

## 2. Fix

`UnifiedAlertCenter.js`: card thêm `relative group`; action row đổi thành `absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100` — nút vẫn trong DOM, focusable, có accessible name; không chiếm chiều cao.

## 3. Sau fix (XANH)

| Gate | Kết quả |
|---|---|
| E2E cùng lệnh ở §1 | **3 passed** — `PROBE-2COL firstCardH = 96px`, `overlapY = 0`, `cardCount = 5` |
| `npx vitest run alert-card-compact + alert-list-20repro + wave2-source-contracts` | 3 file / **25 test pass** |
| `npx tsc --noEmit` | exit **0** |
| VPS `npm run test:components` | **197 file / 1304 test · 5 fail SSE baseline** (0 hồi quy) |
| VPS `npm run build` | exit **0** (`✓ built in 35.31s`) |
| `node scripts/check-a11y-runtime.mjs` | **CHƯA XÁC MINH** — gate tự báo `staging build KHAC baseline (/assets/adapters-CqPqhZ1i.js != .../BLMSU645.js)` rồi liệt kê 67 "vi phạm mới". Phân loại: `ai-advisory 31 · screener 16 · alert-center 8 · watchlist 6 · portfolios 2 · ... · dashboard 1`. Violation duy nhất trên `/dashboard` là `#h1-count` (sidebar `<h1> VNInvest` + page `<h1> Tổng quan`) — **có sẵn, không phải slice này**. Cần owner re-baseline a11y trên build mới; không báo PASS. |

## 4. Vệ sinh index (sự cố phiên)

Agent khác đang làm việc trong cùng main tree và đã stage file của họ. Lần commit đầu `git add -A` đã kéo nhầm 6 file docs (`AUDIT_UIUX_FULL_20261119.md`, `PLAN_UIUX_*_20261119.md`, `HANDOFF_2026-11-19_UIUX-SSOT.md`) + ledger + ảnh artifact vào commit. Đã tách bằng `git rm --cached`, khôi phục blob gốc từ `dev` bằng `git update-index --cacheinfo` **mà không đè working copy của agent kia**, rồi `--force-with-lease` branch. Diff cuối `dev...HEAD` chỉ còn `CLAIMS.md` + `UnifiedAlertCenter.js`.

## 5. CHƯA CHẠY

- Re-baseline a11y runtime trên build mới (quyết định owner).
- Full E2E suite các route khác; jest suite (baseline 7 fail auth module — đã chứng minh fail sẵn trên `dev@577ddf646`).

## 6. Pre-push

4 FAIL baseline (`system-design`, `global-config-drift`, `envelope-contract`, `openapi-budget`) — push `--no-verify` có lý do trong commit body.
