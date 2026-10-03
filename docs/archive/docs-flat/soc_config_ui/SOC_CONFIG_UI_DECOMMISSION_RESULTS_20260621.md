# Báo cáo kết quả — SOC Config UI & Admin-Ops Decommission

**Ngày**: 2026-06-21 | **Branch**: current working tree

---

## 1. Những gì đã hoàn thành

### 1.1 SOC Adapter (`packages/web/src/adapters/core/soc.js`)
- **67 functions** (tăng từ 63 → +4 service management), **10 domains**
- Service management mới: `updateSocService`, `triggerSocServiceHealthCheck`, `applySocServiceConfig`, `resetSocServiceConfig`
- Base URL: `/core/v1/operator/soc/…` và `/core/v1/operator/scraping/dataops/…`
- Functions per domain:

| Domain | Functions | Status |
|--------|-----------|--------|
| Overview | 6 | ✅ |
| VNBroker | 10 | ✅ |
| DataOps | 12 | ✅ |
| Scheduler | 4 | ✅ |
| Prefetch | 9 | ✅ |
| Signals (Read) | 7 | ✅ |
| Screener | 12 | ✅ |
| Matrix | 5 | ✅ |
| Symbol Groups | 4 | ✅ |
| Backfill Progress | 2 | ✅ |

### 1.2 Pages ported từ legacy → packages/web

| Page | File | Legacy | New | Route |
|------|------|--------|-----|-------|
| ScreenerPage | `ScreenerPage.jsx` | 414 lines | 14.49 kB chunk | `/screener` |
| UpgradePage | `UpgradePage.jsx` | 73 lines | mới tạo | `/upgrade` |
| AdminCrawlControlPage | `AdminCrawlControlPage.jsx` | 255 lines | 8.82 kB chunk | `/admin-crawl-control` |

### 1.3 ShellOperationsCenterPage refactor
- Removed 6 raw `fetchImpl` calls → SOC adapter methods
- Removed `baseUrl` variable
- Error handling qua `CoreApiRequestError.detail`
- Chunk size: 20.32 kB → 19.67 kB

### 1.4 Adapter extensions
- `advisory.js` — 16 functions (đã tồn tại)
- `crawl.js` — 5 functions (đã tồn tại, dùng bởi AdminCrawlControlPage)
- `coreApiAdapter.js` — wired `corePatch` cho SOC client

---

## 2. Build & Test status

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Pass (16s) |
| Adapter tests | ✅ N/A (SOC/crawl chưa có test file) |
| Pre-existing failures | ⚠️ 23 test files fail (missing `jsdom` — pre-existing, không liên quan) |

---

## 3. Pages còn ở legacy (chưa port)

| Page | Legacy path | Dòng | Độ phức tạp | Lý do |
|------|-------------|------|-------------|-------|
| WhaleAdvisoryPage | `frontend/src/pages/WhaleAdvisory.jsx` | 233 | 🔴 Rất cao | 10-15 component dependencies chain |
| WhaleAlertsDashboard | `frontend/src/pages/WhaleAlertsDashboard.jsx` | 25K | 🔴 Rất cao | Whale feature pack riêng |
| WhaleAlertsShellHost | `frontend/src/pages/WhaleAlertsShellHost.jsx` | 1K | 🟡 Trung bình | Shell host wrapper |
| AdminCore* (8 pages) | `frontend/src/pages/AdminCore*.jsx` | 13K-31K | 🟢 Thấp | Đã có tenant-admin equivalents |

---

## 4. Kế hoạch WhaleAdvisoryPage

File: `docs/WHALE_ADVISORY_PORT_PLAN_20260621.md`

Tóm tắt: **20 giờ ước tính**, 4 phase:
1. Core infra (hook migrate + adapter) — 4h
2. Leaf components — 6h
3. Complex components (CommandPanel, BubbleChart) — 8h
4. Page assembly — 2h

**Khuyến nghị**: Không port ngay, chờ có slice riêng.

---

## 5. Legacy frontend status

| Khu vực | Status | Hành động |
|---------|--------|-----------|
| `frontend/src/pages/ScreenerPage.jsx` | ✅ Đã port | Có thể xóa |
| `frontend/src/pages/Upgrade.jsx` | ✅ Đã port | Có thể xóa |
| `frontend/src/pages/AdminCrawlControl.jsx` | ✅ Đã port | Có thể xóa |
| `frontend/src/api/socApi.js` | ✅ Đã port (soc.js) | Có thể xóa |
| `frontend/src/api/client.js` (admin bridge fns) | ⏳ Một phần | Còn WhaleAdvisory dependencies |
| Phần còn lại | ❌ Giữ nguyên | Chưa có yêu cầu xóa |

**Lưu ý**: Giữ nguyên thư mục legacy frontend để đối chiếu.

---

## 6. Danh sách files đã thay đổi (24 files)

```
packages/web/src/adapters/core/soc.js            — +4 methods, +corePatch
packages/web/src/adapters/core/advisory.js        — existing (16 fns)
packages/web/src/adapters/core/crawl.js           — existing (5 fns)
packages/web/src/adapters/core/market.js          — extended
packages/web/src/adapters/core/workspace.js       — extended
packages/web/src/adapters/core/misc.js            — new
packages/web/src/adapters/core/operator.js         — new
packages/web/src/adapters/core/screener.js         — new
packages/web/src/adapters/core/dnse.js             — new
packages/web/src/adapters/coreApiAdapter.js       — wired SOC + corePatch
packages/web/src/pages/admin/ShellOperationsCenterPage.js  — refactored
packages/web/src/pages/ScreenerPage.jsx           — new (ported)
packages/web/src/pages/UpgradePage.jsx            — new (ported)
packages/web/src/pages/AdminCrawlControlPage.jsx  — new (ported)
packages/web/src/pages/pageRegistry.js            — +3 entries
packages/web/src/pages/PortfoliosPage.js          — refactored
packages/web/src/pages/TransactionsPage.js        — refactored
packages/web/src/pages/UserSettingsPage.js        — refactored
packages/web/src/pages/WhaleAlertsPage.js         — refactored
packages/web/src/main.js                          — +3 routes
.env.saas-prod.example                            — minor
docs/LEGACY_FRONTEND_ELIMINATION_PLAN_*.md        — plans
docs/WHALE_ADVISORY_PORT_PLAN_20260621.md          — new plan
frontend/Dockerfile.dev-package-shell              — minor
```

---

## 7. Residual risks

1. **SOC adapter chưa có unit test** — cần thêm test file cho soc.js
2. **AdminCrawlControlPage dùng hardcoded fallback data** — khi API trả về empty
3. **UpgradePage không dùng i18n** — hardcoded Vietnamese (matching convention)
4. **WhaleAdvisoryPage dependency chain** — 10-15 components cần port
5. **Legacy frontend chưa xóa** — có thể gây nhầm lẫn nếu ai đó vô tình sửa legacy
