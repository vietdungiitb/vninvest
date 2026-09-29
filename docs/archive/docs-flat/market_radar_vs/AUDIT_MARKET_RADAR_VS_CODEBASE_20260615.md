# Báo cáo Audit: So sánh Kế hoạch Nâng cấp Market Radar với Codebase Hiện tại

**Ngày:** 15/06/2026  
**Phiên bản:** 1.0  
**Người thực hiện:** Blackbox AI Agent  
**Mục đích:** Cung cấp bằng chứng kỹ thuật từ codebase để hỗ trợ thảo luận, ra quyết định triển khai.

---

## 1. Tóm tắt Điều hành (Executive Summary)

Tài liệu `MARKET_RADAR_ANALYSIS_AND_UPGRADE_PLAN_20260615.md` **đúng hoàn toàn** trong việc xác định 3 nguyên nhân cốt lõi khiến Radar thị trường (Watchlist) hoạt động kém. Audit codebase xác nhận 100% các phát hiện này và phát hiện thêm các khoảng cách (gaps) kiến trúc quan trọng chưa được đề cập.

**Kết luận:** Hạ tầng dữ liệu realtime và quy hoạch toàn cầu (`GlobalSymbolRegistry`, `GlobalSymbolPlanner`, `useRealtimeFeedCore`) **đã sẵn sàng** trong `packages/core`. Vấn đề là **tính năng Watchlist frontend chưa được nối (wired) vào hạ tầng này**.

---

## 2. Xác minh 3 Nguyên nhân Cốt lõi (Root Cause Verification)

| # | Vấn đề trong Kế hoạch | Bằng chứng Codebase | Mức độ | File/Line |
|---|----------------------|---------------------|--------|-----------|
| **1.1** | Dữ liệu nhóm ngành hardcoded, chỉ ~100 mã | `_STOCK_MANAGEMENT_DEFAULT_GROUPS` (7 nhóm, ~100 mã) + `_LISTING_SEED_DATA` (60 mã) | **Critical** | `packages/core/backend/src/market_data/stock_mgmt_native_views.py:62`<br>`packages/core/backend/src/market_data/vnbroker_adapter.py:61` |
| **1.2** | Endpoint "Tự động lấy mã" là stub giả | `/admin-sync/stockprofile/` → `GenericEmptyStaffView` trả về `{"status": "accepted"}` ngay lập tức | **Critical** | `packages/core/backend/src/identity_access/api_urls.py:54`<br>`packages/core/backend/src/vninvest_core/utils/legacy_stubs.py:151` |
| **1.3** | WebSocket realtime bị ngắt, fallback chưa đồng bộ | `WatchlistPage.js` tự viết WS logic (line 173), chỉ connect khi `items.length > 0`, bypass `useRealtimeFeedCore` | **Critical** | `packages/web/src/pages/WatchlistPage.js:173-280`<br>`packages/web/src/hooks/useRealtimeFeedCore.js` (đã có sẵn giải pháp chuẩn) |

---

## 3. Các Khoảng cách (Gaps) Bổ sung Phát hiện được

### 3.1 Vi phạm nguyên tắc DRY: Dữ liệu hardcoded lặp lại 3 lần
```python
# File 1: stock_mgmt_native_views.py:62
_STOCK_MANAGEMENT_DEFAULT_GROUPS = [...]

# File 2: legacy_stubs.py:45  
_STOCK_MANAGEMENT_DEFAULT_GROUPS = [...]  # COPY HỆT

# File 3: legacy_views.py:45
_STOCK_MANAGEMENT_DEFAULT_GROUPS = [...]  # COPY HỆT
```
**Hệ quả:** Cập nhật nhóm ngành phải sửa 3 file, dễ gây inconsistency. Không có single source of truth.

### 3.2 Pipeline khám phá mã (Symbol Discovery) đã có nhưng không dùng
- `vnbroker_adapter.py` có `fetch_symbol_group_members()` → lấy đầy đủ mã theo sàn/ngành từ upstream
- `global_symbol_planner.py` + `global_symbol_registry.py` → hệ thống quy hoạch, ưu tiên, theo dõi coverage toàn thị trường
- **Nhưng:** Endpoint sync stub không gọi bất kỳ cái nào trong số này.

### 3.3 Phân mảnh kiến trúc WebSocket (Architecture Fragmentation)
| Thành phần | Trạng thái | Vấn đề |
|------------|------------|--------|
| `WatchlistPage.js` (lines 173-280) | **Custom implementation** | Tự implement: connect, reconnect, circuit breaker, token refresh, heartbeat |
| `useRealtimeFeedCore.js` (800+ lines) | **Shared infrastructure** | Đã giải quyết hết các vấn đề trên, dùng cho các feature khác |
| **Kết quả** | **Code trùng lặp, bug tiềm ẩn, khó maintain** | Cần xóa custom WS trong WatchlistPage, dùng hook chung |

### 3.4 Thiếu isolation Multi-tenant ở legacy stubs
- `legacy_views.py:StockManagementGroupsView` có filter `request.user` + `request.tenant`
- `legacy_stubs.py:GenericEmptyStaffView` **KHÔNG CÓ** tenant scoping
- Rủi ro rò rỉ dữ liệu giữa các tenant nếu stub được gọi nhầm.

---

## 4. So sánh Thực tế vs Kế hoạch vs Đối thủ (Reality Check)

| Tính năng | FireAnt / TCBS / SSI iBoard | Kế hoạch (Doc) | Codebase Hiện tại | Khoảng cách |
|-----------|----------------------------|----------------|-------------------|-------------|
| **Độ phủ mã** | 1,600+ (HOSE/HNX/UPCOM) | Giai đoạn 1: Global Planner | 60 mã hardcoded | **Rất lớn** |
| **Realtime** | Native WS + HTTP fallback | Giai đoạn 2: Circuit breaker + Polling | Custom WS broken, không fallback | **Lớn** |
| **Phân nhóm ngành** | ICB động từ DB | Giai đoạn 1: Admin groups từ DB | 7 nhóm hardcoded tĩnh | **Lớn** |
| **Auto-sync** | Lịch trình + Thủ công | Giai đoạn 1: CPS Planner | Stub endpoint (placebo) | **Hoàn toàn thiếu** |
| **Whale Flow / CVD** | Có (Order flow radar) | Giai đoạn 3: CVD + Sparkline | Chưa có | **Thiếu** |
| **UI Density** | Compact / Comfortable | Giai đoạn 3: SmartRadarTable | Bảng cơ bản | **Thiếu** |
| **Multi-timeframe** | Có | Giai đoạn 3 | Chưa tích hợp | **Thiếu** |

---

## 5. Đánh giá Sẵn sàng Triển khai (Implementation Readiness)

| Module | Tồn tại? | Sẵn sàng Production? | Ghi chú |
|--------|----------|---------------------|---------|
| `GlobalSymbolRegistry` | ✅ | ✅ | Priority tier (HOT/WARM/COLD/RECOVERY), demand scoring tốt |
| `GlobalSymbolCoverage` | ✅ | ✅ | Gap scoring, freshness tracking, missing ranges |
| `GlobalSymbolPlanner` | ✅ | ⚠️ | Cần verify Celery wiring, queue tiers |
| `vnbroker_adapter` | ✅ | ⚠️ | Có fetch symbol groups nhưng chưa được gọi |
| `useRealtimeFeedCore` | ✅ | ✅ | WS + Polling + Circuit breaker + Token refresh hoàn chỉnh |
| **WatchlistPage.js** | ✅ | ❌ | **CẦN VIẾT LẠI HOÀN TOÀN** - xóa custom WS, dùng hook |
| **Sync Endpoint** | ❌ | ❌ | Hiện là stub, cần implement thật |

---

## 6. Kế hoạch Hành động Đề xuất (Prioritized Action Plan)

### 🔴 Tuần 1: Sửa đường dẫn quan trọng (Critical Path Fixes)
1. **Gộp dữ liệu hardcoded** → Single source of truth trong `global_symbol_registry.py` (xóa 2 bản copy)
2. **Thay thế `GenericEmptyStaffView`** → View thật gọi `create_global_planner_run(symbols=all_symbols, datasets=['daily_prices', 'price_board_snapshot'])`
3. **Refactor `WatchlistPage.js`** → Xóa 100+ lines custom WS, dùng `useRealtimeFeedCore` hook

### 🟡 Tuần 2-3: Xây Pipeline Dữ liệu (Data Pipeline)
4. **Endpoint Sync Admin Groups** → `POST /core/v1/market-data/admin-groups/sync/` gọi `sync_admin_group_symbol_set()` từ vnbroker
5. **Kích hoạt Symbol Discovery** → Duyệt qua HOSE/HNX/UPCOM, upsert vào `GlobalSymbolRegistry`
6. **Seed System Default Groups** → VN30, VN100, HOSE, HNX, UPCOM từ registry

### 🟢 Tháng 1: Đạt chuẩn Thương mại (Commercial Parity)
7. **SmartRadarTable** → Compact/Comfortable density, virtualized rows
8. **Whale Flow Overlay** → CVD, Sparkline SVG, Order Flow Radar panel
9. **Multi-timeframe Technicals** → Tích hợp indicators 1m/5m/15m/1H/1D

---

## 7. Đánh giá Rủi ro (Risk Assessment)

| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|--------|----------|----------|------------|
| Phá vỡ frontend legacy khi refactor | **Cao** | **Cao** | Shadow run 72h + Canary 10% (theo doc Phase 1-2) |
| Rate limit vnbroker khi full sync lần đầu | Trung bình | Trung bình | Planner queue tiers (hot/warm/cold) + batch_size config |
| Storm kết nối WebSocket | Trung bình | Cao | Circuit breaker đã có trong `useRealtimeFeedCore` |
| Rò rỉ dữ liệu multi-tenant | Thấp | **Critical** | Enforce `TenantScopePermission` trên mọi endpoint mới |

---

## 8. Kết luận & Khuyến nghị

### ✅ Kế hoạch tài liệu: **CHUẨN XÁC, CÓ THỂ THỰC THI**
- Phân tích đúng bệnh, đúng thuốc
- Lộ trình 3 giai đoạn (Shadow → Canary → Cutover) hợp lý, an toàn
- Tiêu chí PASS/FAIL cụ thể, đo lường được

### 🎯 Ưu tiên số 1: **"Nối ống" (Connect the Plumbing)**
Hạ tầng cốt lõi (`packages/core`) **đã xây xong 80-90%**. Công việc chính không phải "viết mới" mà là **"kết nối"**:
- Frontend Watchlist → `useRealtimeFeedCore` (xóa custom WS)
- Sync Button → `GlobalSymbolPlanner` (thay stub)
- Admin Groups → `vnbroker_adapter.fetch_symbol_group_members()` (kích hoạt discovery)

### 💡 Khuyến nghị cho cuộc thảo luận
1. **Đồng ý scope Giai đoạn 1** như tài liệu (Shadow Run 72h parity check)
2. **Quyết định:** Viết mới `WatchlistPage.js` hay refactor? (Khuyên: viết mới component `SmartRadarPage` song song, switch feature flag)
3. **Resource allocation:** Cần 1 BE (sync endpoint, planner wiring) + 1 FE (WatchlistPage rewrite, SmartRadarTable) song song
4. **Definition of Done Giai đoạn 1:** Parity check pass + WebSocket live + Auto-sync thực sự chạy được

---

## 9. Phụ lục: Danh sách File Quan trọng Tham chiếu

| File | Vai trò | Trạng thái |
|------|---------|------------|
| `packages/core/backend/src/market_data/global_symbol_registry.py` | Single source of truth cho symbols, groups, priority | ✅ Sẵn sàng |
| `packages/core/backend/src/market_data/global_symbol_planner.py` | Orchestration sync dữ liệu toàn thị trường | ✅ Sẵn sàng |
| `packages/core/backend/src/market_data/vnbroker_adapter.py` | Adapter upstream (VCI/KBS/DNSE) | ✅ Sẵn sàng |
| `packages/web/src/hooks/useRealtimeFeedCore.js` | Shared WS infrastructure | ✅ Sẵn sàng |
| `packages/web/src/pages/WatchlistPage.js` | **Cần viết lại hoàn toàn** | ❌ Broken |
| `packages/core/backend/src/identity_access/api_urls.py` | Route stub cần thay thế | ❌ Stub |
| `packages/core/backend/src/vninvest_core/utils/legacy_stubs.py` | Stub implementations | ❌ Stub |

---

*Báo cáo này phục vụ cho cuộc thảo luận kỹ thuật. Không chứa code implementation.*