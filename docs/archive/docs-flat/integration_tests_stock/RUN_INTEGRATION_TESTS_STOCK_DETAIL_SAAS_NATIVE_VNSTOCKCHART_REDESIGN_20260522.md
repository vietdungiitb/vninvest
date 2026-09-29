# RUN INTEGRATION TESTS — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Scope**: Package checks, consumer build, backend route sanity, runtime/browser smoke cho redesign stock detail.

---

## 1. Setup

```powershell
# 1. Refresh runtime
.\start_dev.ps1

# 2. Package shell + build sanity
Push-Location ./packages/web
npm run check:stock-detail-shell
npm run build-community
Pop-Location

# 3. Consumer frontend build sanity
Push-Location ./frontend
npm run build
Pop-Location
```

---

## 2. Suite A — Package-local stock-detail shell and adapter sanity

### Goal

Xác nhận `packages/web` tự khóa route shell, adapter contract và build sanity trước khi nhìn vào consumer app.

### Commands

```powershell
Push-Location ./packages/web
npm run check:stock-detail-shell
npm test -- --runTestsByPath src/adapters/coreApiAdapter.test.js --watch=false
Pop-Location
```

### Expected

1. Shell check PASS.
2. Adapter tests PASS.
3. Không có direct fetch bất ngờ trong stock-detail path.

---

## 3. Suite B — Backend API sanity

### Goal

Xác nhận redesign không ép backend đổi sai chỗ và, nếu backend có đổi, native routes vẫn xanh.

### Commands

```powershell
Push-Location ./packages/core/backend
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_SECRET_KEY='test-secret'
$env:CORE_PAT_PEPPER='test-pepper'
..\..\..\.venv\Scripts\python.exe manage.py test tests.test_stock_management_api_routes market_data.tests.test_stock_management_native_api --keepdb
Pop-Location
```

### Expected

1. `tests.test_stock_management_api_routes` PASS.
2. `market_data.tests.test_stock_management_native_api` PASS.
3. Không có route business mới dưới legacy `/api/*`.

---

## 4. Suite C — Desktop hero workspace smoke

### Steps

1. Open `/stocks/FPT` ở desktop 1440px.
2. Verify header + quote render đúng.
3. Verify chart shell có toolbar, meta strip, price pane dominant, pane stack và footer actions.
4. Verify `OrderFlowRadarPanel` nằm ngay dưới hero chart.
5. Verify context deck nằm sau order flow, không tranh chart.

### Expected

1. Chart là bề mặt số 1.
2. Không có layout kiểu fixed right rail làm chart hẹp.
3. User hiểu ngay phiên đang chọn là gì.

---

## 5. Suite D — Session truth sync smoke

### Steps

1. Trên `/stocks/HPG`, click ít nhất 2 session khác nhau trên chart.
2. Quan sát `OrderFlowRadarPanel`.
3. Quan sát alert/advisory summary.
4. Quan sát witness strip/meta strip.

### Expected

1. Order flow đổi theo selected session.
2. Advisory/alert summary đổi theo selected session.
3. Không có panel nào giữ session cũ.

---

## 6. Suite E — User-action flows

### Steps

1. Dùng `/stocks/VCB`.
2. Thử toggle tracked symbol.
3. Thử add/remove watchlist item.
4. Thử create/update/delete price alert nếu UI slice đã mở.

### Expected

1. Tất cả flows đi qua adapter/native route.
2. Không có call path rơi về legacy client như canonical dependency.

---

## 7. Suite F — Degraded states

### Steps

1. Với symbol hoặc session thiếu đủ data, kiểm tra context modules.
2. Với `news`/`financials` chưa có truth, kiểm tra degraded state.
3. Truy cập `/stocks/INVALID`.

### Expected

1. `loading`, `empty`, `stale`, `error` states rõ ràng.
2. `news`/`financials` không fake data.
3. Invalid symbol có not-found state rõ.

---

## 8. Suite G — Responsive matrix

| Viewport | Checks |
|---|---|
| 1440px | Chart full-width, order flow dưới chart, context deck 2-3 cột |
| 1366px | Không có fixed right rail làm chart hẹp |
| 1024px | Hierarchy giữ nguyên, toolbar không quá dày |
| 768px | Chart vẫn là bề mặt số 1, order flow vẫn nằm ngay dưới |
| 390px | Header → chart → order flow → context deck → deferred modules |

---

## 9. Suite H — SaaS-native architecture compliance

### Goal

Xác nhận implementation không dùng redesign này để lùi về kiến trúc legacy.

### Checks

1. Review diff for `packages/web` vs `frontend/` legacy.
2. Review diff for `packages/core/backend/` vs legacy `backend/`.
3. If bridge remains, verify owner + expiry + removal condition.
4. If backend changed, verify `/core/v1/*` + OpenAPI metadata/test evidence.

### Expected

1. Legacy path không được xem là canonical end-state.
2. SaaS-native path là accepted destination duy nhất.

---

## 10. Pass criteria

- [ ] Package shell + adapter sanity PASS
- [ ] Backend API sanity PASS
- [ ] Desktop hero workspace smoke PASS
- [ ] Session truth sync PASS
- [ ] User-action flows PASS
- [ ] Degraded states PASS
- [ ] Responsive matrix PASS
- [ ] SaaS-native architecture compliance PASS
