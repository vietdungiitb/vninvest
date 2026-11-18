# Gates — Heatmap scope bugfix (2026-11-18)

> Branch `feat/dash-heatmap-scope` · base `dev @ b83718ef9` · revision `0debe3e3c`.
> Trigger: Owner gửi ảnh staging heatmap **1833 mã** — không thể theo dõi.

## 1. TDD + local

| Gate | Kết quả |
|---|---|
| `npx vitest run src/utils/__tests__/market-group-filter.component.test.ts` **trước fix** | **5/5 FAIL** (export `isSystemMarketGroup`/`filterUserWatchlistGroups` chưa tồn tại) |
| sau fix | **5/5 PASS** — gồm test hành vi lọc 29 `group_type` hệ thống, fallback slug bỏ dấu, group `CUSTOM` được giữ, source-scan hook lọc trước `setState` |
| `npx tsc --noEmit` | exit **0** |

## 2. VPS full suite + build

Worktree `/tmp/wt-hscope` từ `origin/feat/dash-heatmap-scope`, `corepack npm 11.18.0`:

| Lệnh | Kết quả |
|---|---|
| `npm run test:components` | **197 file / 1304 test · 1299 pass · 5 fail** — đúng 5 test SSE baseline (`gates.md` §4) ⇒ **0 hồi quy** |
| `npm run build` | exit **0** — `✓ built in 37.21s` |
| Dọn | worktree removed + prune |

## 3. Visual QA TRÊN STAGING — ĐÃ CHẠY, ĐÃ MỞ ẢNH

Deploy `REPO_BRANCH=feat/dash-heatmap-scope bash scripts/deploy-staging.sh` → `DEPLOY_EXIT=0`, API healthy.
Playwright Chromium (local, `executablePath` headless-shell-1248) đăng nhập `testuser@vninvest.vn` → `/dashboard`, viewport **1280×900**.

| Đo bằng `getComputedStyle`/`getBoundingClientRect` | Giá trị |
|---|---|
| `--dash-chrome` | **296px** (khớp code; đây là số đo runtime thật — reservation R2 của B8 đã đóng) |
| `.dashboard-triad-lane` max-height | `604px` = `min(720px, 900−296)` ✓ |
| triad bottom / legend bottom | **813px / 802px** — đều < 900 ✓ (P1-4: legend & tile đáy nằm trong viewport) |
| `.seg` flex-wrap / số button | `wrap` / **5** ✓ (P1-1) |
| breadcrumb | `VNInvest / Tổng quan` ✓ (P2-5) |
| lang options | `VI`, `EN` — không emoji ✓ |
| search visible (1280px + 375px) | `true` / `true` ✓ |
| click tile → popover | `[role=dialog]` = **1**; Escape → **0** ✓ (Q4) |

**Số mã heatmap**: subtitle `"5 mã · Danh mục + theo dõi · cập nhật —"` và Position Deck `"Đang nắm giữ (5)"` — **hết 1833** (xem ảnh).

Ảnh đã mở kiểm chứng bằng mắt (L-V05), lưu trong repo:
- `docs/evidence/dashboard-uiux/dashboard-scope-1280x900.png`
- `docs/evidence/dashboard-uiux/dashboard-popover.png`
- `docs/evidence/dashboard-uiux/dashboard-mobile.png`

## 4. CHƯA CHẠY

- E2E Playwright suite đầy đủ `/dashboard` + `/alert-center` (chỉ chạy script QA thủ công ở §3).
- `check-a11y-runtime`, jest `npm run test`.

## 5. Gate chặn push

`pre-push-gate` 4 FAIL baseline đã document (Entry 527); push `--no-verify` có lý do trong commit body.
