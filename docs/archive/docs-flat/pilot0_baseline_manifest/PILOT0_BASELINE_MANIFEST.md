# Pilot-0 Baseline Manifest — 0 code capture

> **Commit**: `b98f9398` (chứa `7d6ad05c`) · **Branch**: `feature/ui-unified-p0` · **Phase**: P0-0 → Pilot-0 (HIGH4)  
> **File neo**: `packages/web/tests/visual/unified-layout-pilot.pilot0.spec.ts:1` · `playwright.config.ts:1` · `DOM_LAYOUT_CONTRACT.md:48`  
> **Ngày**: 2026-09-08

## 1. Mục đích

Khóa baseline visual trước khi chạm token (P0-1), để Pilot-1 diff chứng minh “không đổi pixel” nếu giữ private token (HIGH5).

## 2. Phạm vi baseline

| # | Route | Registry | File | Viewport | Project |
|---|-------|----------|------|----------|---------|
| 1 | `/dashboard` | `core-dashboard` | `DashboardPage.tsx:345` bento `1fr 1.5fr 1fr` | 1920,1440,1280,1024,768,390 | chromium |
| 2 | `/alert-center` | `alert-center` | `AlertCenterPage.tsx:239` `ShellPageChrome` | 6 | chromium |
| 3 | `/watchlist` | `core-watchlist` | `WatchlistPage.tsx:42` `240px 1fr` | 6 | chromium |
| 4 | `/stocks/HPG` | `core-stock-detail` | `StockDetailPage.tsx:324` `sdp-page` Workstation | 6 | chromium |

**Tổng**: 4 routes × 6 viewports = **24 screenshots** `pilot0-<route>-<vp>.png`.

## 3. Điều kiện chạy

| Mục | Giá trị |
|-----|---------|
| BaseURL | `http://localhost:4173` (`npm run preview` sau `npm run build`) hoặc `PLAYWRIGHT_BASE_URL` nếu có backend |
| Auth | `tests/visual/.auth/user.json` via `auth.setup.ts:1` (`testuser@vninvest.vn` / `TestPass123!`) |
| Seed / fixture | DB seed chứa holdings + watchlist + alert-center feed (nếu không có feed, screenshot vẫn PASS nhưng heatmap/whale rỗng) |
| Browser | `chromium` Desktop Chrome (baseline chính); `firefox`/`webkit` tùy chọn |
| Viewport matrix | **Riêng cho unified-layout** — không dùng default `Desktop Chrome`/`Pixel 5`/`iPhone 12` (`playwright.config.ts:19-49`) |
| Naming | `pilot0-<route>-<vp>.png` trong `tests/visual/unified-layout-pilot.pilot0.spec.ts-snapshots/` |
| Ownership | `feature/ui-unified-p0` branch, commit `b98f9398` |
| Checksum | Playwright snapshot SHA + `git rev-parse HEAD` |

## 4. Gate

- **Trước khi chạy**: `npx tsc --noEmit` PASS (P0-0c), `node scripts/check-dom-landmarks.mjs` PASS, `test:dom-landmarks` 4 tests PASS.
- **Trong test**: mỗi page assert `main` count 1 + `main main` null (DOM contract) trước khi screenshot.
- **Sau khi chạy**: 24 snapshots tồn tại, `maxDiffPixels` chưa áp (baseline = 0 diff).

## 5. Cách chạy

```bash
cd packages/web
npm run build
npx playwright test tests/visual/unified-layout-pilot.pilot0.spec.ts --update-snapshots --project=chromium
# hoặc với baseURL remote:
PLAYWRIGHT_BASE_URL=https://preview.edusuccess.vn npx playwright test tests/visual/unified-layout-pilot.pilot0.spec.ts --update-snapshots
```

## 6. Kết quả baseline (sẽ điền sau khi chạy)

| Route | 1920 | 1440 | 1280 | 1024 | 768 | 390 | Checksum |
|-------|------|------|------|------|-----|-----|----------|
| dashboard | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | — |
| alert-center | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | — |
| watchlist | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | — |
| stocks/HPG | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | — |

## 7. Trạng thái

- [x] Test file tạo: `unified-layout-pilot.pilot0.spec.ts:1`
- [ ] Baseline snapshots captured (24 files) — cần chạy lệnh §5 với preview server
- [ ] Checksum ghi vào manifest
- [ ] Chuyển sang **P0-1 token allowlist** (HIGH5) chỉ sau khi baseline lưu

> **Lưu ý audit**: Pilot-0 là **0 code change** — không sửa `FullLayout.tsx:72` hay `tokens.css:1`. Mọi diff ở Pilot-1 mới so với baseline này.
