# SELF AUDIT & TEST PROTOCOL — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Scope**: Validation protocol cho từng slice `SD-01` → `SD-07`. Chạy ngay sau mỗi slice, không tích lũy đến cuối.

---

## 1. Validation principles

1. Sau edit thực chất đầu tiên của slice phải có focused validation ngay.
2. `VNStockChart` workspace là bề mặt cần được xác minh trước mọi panel phụ.
3. `npm run check:stock-detail-shell` là gate package-local bắt buộc.
4. `./start_dev.ps1` là gate runtime bắt buộc trước final evidence.
5. Nếu backend không bị chạm, bằng chứng phải chỉ ra rõ “no backend change needed”.

---

## 2. `SD-01` — Workspace contract & page architecture

### Validation commands

```powershell
Push-Location ./packages/web
npm run check:stock-detail-shell
Pop-Location

Select-String -Path "packages/web/src/pages/StockDetailPage.js" -Pattern "selectedSession|visibleRange|refreshBlocking|refreshDeferred"
Select-String -Path "packages/web/src/pages/market/ShellStockDetailPage.js" -Pattern "symbol|pathname|searchParams|route"
```

### Expected

1. Shell check pass.
2. `selectedSession` và `visibleRange` được quản trị ở page-level model.
3. `ShellStockDetailPage` không có fan-out business logic.

---

## 3. `SD-02` — Hero workspace frontend redesign

### Validation commands

```powershell
Push-Location ./packages/web
npm run build-community
Pop-Location

Push-Location ./frontend
npm run build
Pop-Location
```

### Manual smoke

1. Mở `/stocks/FPT` ở desktop.
2. Xác nhận order là: header → hero chart shell → order flow lane → context deck.
3. Xác nhận chart có toolbar, meta strip, price pane dominant, footer actions.
4. Xác nhận text mới có tiếng Việt đầy đủ dấu.

---

## 4. `SD-03` — Order flow lane & contextual modules

### Validation commands

```powershell
Select-String -Path "packages/web/src/pages/StockDetailPage.js" -Pattern "OrderFlowRadarPanel"
Select-String -Path "packages/web/src/pages/StockDetailPage.js" -Pattern "StockIntradayMatchedPanel|StockDepthOrLiquidityPanel|StockUserStatePanel"
```

### Manual smoke

1. Ở 1440px và 1366px, xác nhận `OrderFlowRadarPanel` nằm ngay dưới chart.
2. Đổi selected session trên chart và xác nhận order flow lane đổi theo.
3. Các module contextual không làm chart bị co hẹp thành card phụ.

---

## 5. `SD-04` — Insight deck native

### Validation commands

```powershell
Select-String -Path "packages/web/src/pages/StockDetailPage.js" -Pattern "StockAlertSummaryPanel|StockAdvisoryPanel|StockNewsPanelNative|StockFundamentalsPanelNative"
```

### Manual smoke

1. Đổi selected session trên chart và xác nhận advisory/alert summary đổi theo.
2. Với `news`/`financials` chưa có truth, UI phải hiển thị unavailable/degraded state rõ.
3. Xác nhận từng module có state riêng: loading, empty, stale, error.

---

## 6. `SD-05` — Adapter completion

### Validation commands

```powershell
Push-Location ./packages/web
npm test -- --runTestsByPath src/adapters/coreApiAdapter.test.js --watch=false
Pop-Location

Select-String -Path "packages/web/src/adapters/coreApiAdapter.js" -Pattern "addTrackedSymbol|removeTrackedSymbol|getPriceAlerts|createPriceAlert|getStockNews|getStockFinancials"
Select-String -Path "packages/web/src/**/*.js" -Pattern "fetch\(|frontend/src/api/client.js"
```

### Expected

1. Adapter tests PASS.
2. Không có `fetch(` trực tiếp trong stock-detail path thuộc `packages/web` ngoài adapter.
3. Không còn canonical dependency vào `frontend/src/api/client.js`.

---

## 7. `SD-06` — Core contract completion

### Validation commands

```powershell
Push-Location ./packages/core/backend
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_SECRET_KEY='test-secret'
$env:CORE_PAT_PEPPER='test-pepper'
..\..\..\.venv\Scripts\python.exe manage.py test tests.test_stock_management_api_routes market_data.tests.test_stock_management_native_api --keepdb
Pop-Location

Select-String -Path "packages/core/backend/src/**/*.py" -Pattern "from vnbroker|Vnbroker\(|Quote\(" -CaseSensitive
```

### Expected

1. Nếu backend touched, cả 2 suites đều PASS.
2. Không có direct provider shortcut mới.
3. Không có route business mới dưới legacy `/api/*`.

---

## 8. `SD-07` — Final gates

### Commands

```powershell
Push-Location ./packages/web
npm run check:stock-detail-shell
npm run build-community
npm test -- --runTestsByPath src/adapters/coreApiAdapter.test.js --watch=false
Pop-Location

Push-Location ./frontend
npm run build
Pop-Location

.\start_dev.ps1
```

### Browser smoke matrix

| Route | Expected |
|---|---|
| `/stocks/FPT` | chart shell đầy đủ + order flow lane đúng vị trí |
| `/stocks/HPG` | tracked/watchlist/alert actions usable |
| `/stocks/VCB` | contextual modules không lỗi, selected session sync đúng |
| `/stocks/INVALID` | not-found state đúng |

### Required evidence

1. Desktop screenshots.
2. Laptop screenshots.
3. Mobile screenshots.
4. Residual risk note.
5. Ledger/progress/modified-files/module-tree updated.

---

## 9. SaaS native architecture compliance checks

```powershell
Select-String -Path "packages/web/src/**/*.js" -Pattern "frontend/src/pages/StockDetail.jsx|frontend/src/api/client.js"
Select-String -Path "packages/web/src/**/*.js" -Pattern "fetch\(" 
Select-String -Path "packages/core/backend/src/**/*.py" -Pattern "/api/stock-management|/api/" 
```

### Pass conditions

1. Legacy path không được xem là end-state.
2. Temporary bridge nếu còn phải có owner + expiry + removal condition trong evidence.
3. Nếu backend changed, change phải nằm trong `packages/core/backend/` và có OpenAPI gate evidence.
