# Báo cáo Audit: Hiện trạng Code dở dang của tính năng Market Radar & Watchlist
*(Cập nhật ngày 15/06/2026)*

Báo cáo này đối chiếu tiến độ hoàn thành thực tế của mã nguồn (codebase) hiện tại so với tài liệu kế hoạch nâng cấp **Market Radar / Watchlist** để đánh giá những hạng mục đã đạt được và những khoảng trống còn dở dang.

---

## 1. Bảng Đối chiếu Tiến độ (Plan vs. Actual Codebase)

| Hạng mục kế hoạch | File liên quan | Trạng thái thực tế | Đánh giá & Bằng chứng từ codebase |
| :--- | :--- | :--- | :--- |
| **S1.1: Schema & Model Native** | `packages/core/backend/src/user_workspace/models.py` | **Hoàn thành** | Đã thêm model `ScreenerRule` ([models.py:L499](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/user_workspace/models.py#L499)) cô lập bằng khóa ngoại `tenant` an toàn. |
| **S1.2: Endpoint Sync Admin & Seed** | `packages/core/backend/src/market_data/admin_sync_views.py`<br>`packages/core/backend/src/identity_access/api_urls.py` | **Hoàn thành** | Đã viết view thật `AdminOpsMarketGroupsSyncView`, `AdminOpsMarketGroupsPreviewView` thay thế cho stub mock cũ; routes đã được khai báo tại [api_urls.py:L59-L61](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/api_urls.py#L59) và chạy kiểm thử an toàn. |
| **S1.2.1: Gom nhóm ngành mặc định (DRY)** | `packages/core/backend/src/market_data/default_groups.py` | **Một nửa (50%)** | Đã tạo file SSOT nhóm ngành mới [default_groups.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_data/default_groups.py); **tuy nhiên**, các file legacy views vẫn chưa được cập nhật để import từ file này (vẫn chứa mảng hardcode trùng lặp). |
| **S2.2: WatchlistPage.js (Frontend UI)** | `packages/web/src/pages/WatchlistPage.js` | **Dở dang / Lỗi nghiêm trọng** | File [WatchlistPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/WatchlistPage.js) **bị xoá sạch hoàn toàn nội dung cũ (754 dòng)** và chỉ còn 2 dòng lệnh test log. |
| **S3.1: Đấu nối Realtime WebSocket chung** | `packages/web/src/pages/WatchlistPage.js`<br>`packages/web/src/hooks/useRealtimeFeedCore.js` | **Chưa thực hiện** | Do trang `WatchlistPage.js` bị trống, logic đấu nối WebSocket hook chung `useRealtimeFeedCore` chưa được thực hiện. |

---

## 2. Chi tiết kết quả kiểm tra (Audit Details)

### 2.1. Backend (Đã đạt được 80% mục tiêu)
* **API Ingestion thật**: View [admin_sync_views.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_data/admin_sync_views.py) được code rất tốt. Nó lấy danh sách mã thật từ `vnbroker` qua `fetch_symbol_group_members()`, đồng bộ vào `GlobalSymbolRegistry`, và kích hoạt tự động `GlobalSymbolPlanner` để cào dữ liệu mà không cần chạy thủ công.
* **Bảo mật Tenant**: View mới thừa kế `TenantScopePermission` đúng theo yêu cầu an toàn dữ liệu, chống rò rỉ chéo giữa các tenants.
* **Kết quả Test Suite**: Toàn bộ 50 tests trong suite `market_data` đã chạy thành công qua Docker:
  ```bash
  Ran 50 tests in 9.492s
  OK
  ```

### 2.2. Frontend (Khoảng trống nghiêm trọng)
* **Mất code WatchlistPage**: Trang giao diện SaaS-native `WatchlistPage.js` hiện tại chỉ chứa:
  ```javascript
  // Test write
  console.log("test");
  ```
  Điều này khiến giao diện Radar thị trường mới bị trống rỗng hoàn toàn, không thể hiển thị bảng giá hay sidebar nhóm ngành.
* **Đầu nối Adapters**: Các hàm adapter như `syncAdminMarketGroups()`, `previewAdminMarketGroups()`, và `seedSystemDefaults()` đã được viết xong tại [market.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/adapters/core/market.js#L430) và sẵn sàng để frontend gọi.

---

## 3. Khuyến nghị & Giải pháp khắc phục nhanh

Để khôi phục và hoàn thành phần code dở dang của đội dev, chúng ta cần:

1. **Khôi phục lại giao diện WatchlistPage**: Khôi phục lại khung sườn của [WatchlistPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/WatchlistPage.js) từ lịch sử git (hoặc viết lại bản sạch) để có giao diện Bloomberg-style 2 cột.
2. **Refactor đấu nối WebSocket**: Thay thế kết nối WS tự viết bằng hook `useRealtimeFeedFromManager`.
3. **Cập nhật Legacy Views**: Sửa các view cũ tại `legacy_views.py` để import `_STOCK_MANAGEMENT_DEFAULT_GROUPS` từ [default_groups.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/market_data/default_groups.py) nhằm xóa bỏ hoàn toàn code lặp.
