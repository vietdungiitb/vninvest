# Taskboard: Nâng cấp Watchlist Page sang SaaS-Native Core (Smart Watchlist Radar)
## Dev Handoff - Slices & Detailed Tasks Breakdown

Tài liệu này phân rã toàn bộ nghiệp vụ nâng cấp thành các lát cắt công việc (Slices) độc lập, có thể bàn giao trực tiếp cho đội ngũ lập trình viên tiến hành code, kiểm thử và bàn giao.

---

## 1. Bản đồ Lát cắt Công việc (Slices Matrix)

```
[Slice 1: Backend Foundation] ──> [Slice 2: Frontend Base & UI] ──> [Slice 3: Realtime & Indicators] ──> [Slice 4: Cutover & Cleanup]
- Native REST APIs            - Page Registry Swap             - WebSocket Connection          - Tenant Rollout (Canary)
- Technicals Bulk API         - Glassmorphic Layout            - Backend RSI/MA20 Integration  - Decommission Legacy Shims
```

---

## 2. Chi tiết công việc theo Lát cắt (Detailed Tasks)

### 2.1 Slice 1: Backend Domain Foundation & Optimization
*Mục tiêu: Đảm bảo toàn bộ data layer và API layer hoạt động thuần native core, tối ưu hóa truy vấn và bảo vệ cô lập tenant tuyệt đối.*

* [x] **Task 1.1: Chuẩn hóa Schema và Khai báo Model Native**
  * Tác vụ: Đảm bảo các models `Watchlist`, `WatchlistItem`, `TrackedSymbol`, và `PriceAlert` trong `packages/core/backend/src/user_workspace/models.py` có đầy đủ các ràng buộc, trường theo dõi di trú (`legacy_group_id`, `legacy_rule_id`), và trường tenant (`tenant_id`).
  * Acceptance Criteria: Chạy `python manage.py makemigrations --check` và `python manage.py migrate` thành công mà không phát sinh lỗi khóa bảng hoặc xung đột khóa ngoại.
* [x] **Task 1.2: Mở rộng & Kiểm chứng Endpoint Phân tích Kỹ thuật Gộp (Technicals Bulk API)**
  * Tác vụ: Endpoint `GET /core/v1/market-data/technicals/bulk/` đã tồn tại tại `market_data/urls.py`. **Không tạo lại.** Kiểm chứng response hiện tại có đủ các trường `rsi_14`, `rvol`, `ma20_distance_pct`, `updated_at` hay chưa. Nếu thiếu, bổ sung vào serializer và view tương ứng trong `market_data/views.py`.
  * Acceptance Criteria: Response JSON đủ 4 fields nêu trên, gọn nhẹ dưới 50KB cho 100 mã. Tốc độ trưy vấn dưới 80ms.
* [x] **Task 1.3: Cấu hình Tác vụ Đồng bộ tự động ngầm (CPS Background Scheduler)**
  * Tác vụ: Tích hợp logic CPS Scheduler để định kỳ (5 phút trong phiên giao dịch) tự động quét và làm mới giá cho các symbol active trong watchlist người dùng. **QUY ĐỊNH CỨNG:** Phải plug into hệ thống CPS đã có theo thiết kế trong `docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_BACKEND_DESIGN_20260517.md`. Tụt đối việc tạo CPS implementation riêng song song. Đọc AGENTS.md §12 trước khi code.
  * Acceptance Criteria: Logs nền ghi nhận hoạt động đều đặn, không bị trôi luồng và không có hiện tượng N+1 query lên DB.
* [x] **Task 1.4: Thêm Task 1.0 [SECURITY - Bắt buộc trước Shadow Run]: Vá lỗ Tenant Isolation trong Legacy Shim**
  * Tác vụ: `StockManagementGroupsView` tại `market_data/legacy_views.py` đang lọc `Watchlist.objects.filter(user=request.user)` mà không có `tenant=request.tenant`. Bổ sung `TenantScopePermission` vào permission_classes và thêm bộ lọc tenant trước khi chạy Shadow Run.
  * Acceptance Criteria: Test cross-tenant access trả về 403/404 đối với `StockManagementGroupsView`.
* [x] **Task 1.4 (cũ): Tích hợp Ràng buộc Cô lập Tenant (Multi-Tenant Double-Filter)**
  * Tác vụ: Áp dụng class `TenantScopePermission` và double-filter bắt buộc (`user=request.user AND tenant=request.tenant`) trên các REST Views trong `user_workspace/views.py`.
  * Acceptance Criteria: 100% test cases trong `test_user_workspace_tenant_isolation.py` PASS.

---

### 2.2 Slice 2: Frontend Base Layout & UI Component
*Mục tiêu: Xây dựng cấu trúc giao diện mật độ cao (Bloomberg-style) và tích hợp an toàn vào Page Registry của SaaS Web.*

* [x] **Task 2.1: Thiết kế Thiết lập Giao diện WatchlistPage.css**
  * Tác vụ: Viết file CSS phong cách neon dark, hỗ trợ chế độ tương phản cao, thiết lập glassmorphism và các keyframe animation cho hiệu ứng Flash giá tăng/giảm.
  * Acceptance Criteria: Kích thước file css gọn nhẹ, không dùng CSS ad-hoc bừa bãi.
* [x] **Task 2.2: Lập trình WatchlistPage.js - Khung sườn Giao diện**
  * Tác vụ: Tạo file React component mới gồm 2 cột chính: Sidebar quản lý danh sách (watchlists) và khu vực chính hiển thị bảng danh sách chứng khoán (SmartRadarTable) cùng Phân hệ cảnh báo giá (PriceAlertPanel).
  * Acceptance Criteria: Giao diện mount thành công, có bộ điều khiển chế độ mật độ: **Compact** (Gọn) và **Comfortable** (Thoáng) hoạt động mượt mà.
* [x] **Task 2.3: Đăng ký Trang mới vào pageRegistry.js**
  * Tác vụ: Đăng ký route ID `"core-watchlist"` trỏ tới `WatchlistPage.js`. Giữ nguyên route baseline `"watchlist"` cũ làm điểm kiểm tra phân quyền. Nếu cấu hình tenant bật cờ `"watchlist_saas_native"`, hệ thống tự động định tuyến sang `"core-watchlist"`.
  * Acceptance Criteria: Bấm chuyển hướng `/watchlist` trên trình duyệt hoạt động trơn tru.

---

### 2.3 Slice 3: Realtime WebSocket & Indicator Integration
*Mục tiêu: Kết nối luồng dữ liệu thời gian thực WebSocket và đồng bộ hóa các chỉ báo động trực quan.*

* [ ] **Task 3.1: Viết Realtime WebSocket Adapter Hook (`useRealtimeWS`) — Hook mới trong `packages/web`**
  * Tác vụ: Tạo file mới `packages/web/src/hooks/useRealtimeWS.js`. **Đây là hook mới** không liên quan đến `useRealtimeFeed` cũ trong legacy `frontend/`. Hook kết nối độc lập tới `/ws/realtime/`, sử dụng access token từ `authTokenStorage` làm tham số handshake. URL WebSocket phải được xây dựng động (không hardcode localhost).
  * Acceptance Criteria: Kết nối thiết lập thành công. Tự động parse payload ticks và cập nhật state của bảng giá dưới 10ms.
* [ ] **Task 3.2: Triển khai Cơ chế Fallback sang HTTP Short-Polling**
  * Tác vụ: Nếu kết nối WebSocket bị đứt liên tục hoặc server bảo trì, hook tự động kích hoạt chế độ dự phòng Short-polling (gửi request lấy dữ liệu gộp mỗi 30 giây) để giao diện không bị mất giá.
  * Acceptance Criteria: Khi mô phỏng mất kết nối WS (mở Circuit Breaker), client tự động chuyển sang gọi HTTP gộp đều đặn.
* [ ] **Task 3.3: Hiển thị Biểu đồ xu hướng mini (SVG Sparklines)**
  * Tác vụ: Vẽ biểu đồ xu hướng biến động giá trong ngày dạng vector SVG siêu nhẹ ngay trên dòng của bảng chứng khoán.
  * Acceptance Criteria: Không gây giật lag khi nhận ticks dữ liệu liên tục. Dữ liệu mượt mà, render tức thì.
* [ ] **Task 3.4: Tích hợp Chỉ báo kỹ thuật từ Backend & Whale Icons**
  * Tác vụ: Map kết quả từ Endpoint Technicals Bulk (RSI, RVOL, MA20) và hiển thị Whale Alert Icon tĩnh dựa trên dữ liệu feed/snapshot thực tế từ backend.
  * Acceptance Criteria: Hiển thị đúng số liệu kỹ thuật, icon cá mập hiển thị đúng theo trạng thái được backend phân tích.

---

### 2.4 Slice 4: Cutover, Validation & Decommissioning
*Mục tiêu: Thực hiện chuyển đổi hệ thống an toàn và dọn dẹp triệt để các mã nguồn legacy cũ.*

* [ ] **Task 4.1: Shadow Run & Parity Verification**
  * Tác vụ: Triển khai chạy ngầm trên môi trường staging, client tiến hành so khớp dữ liệu danh sách theo dõi giữa cơ sở dữ liệu core và legacy (Parity Checking).
  * Acceptance Criteria: Ghi nhận logs trùng khớp 100% dữ liệu danh sách chứng khoán theo từng tài khoản.
* [ ] **Task 4.2: Canary Rollout & Feature Flag Activation**
  * Tác vụ: Kích hoạt cờ capability `"watchlist_saas_native"` cho nhóm 10% tenants (Canary). Theo dõi sát khung hình UI (ổn định $\ge 58$ FPS) và dung lượng payload.
  * Acceptance Criteria: Chạy ổn định trong 48 giờ liên tiếp.
* [ ] **Task 4.3: 100% Cutover & Redirection**
  * Tác vụ: Bật cờ capability cho 100% người dùng của hệ thống. Cập nhật route redirection hoàn tất sang `"core-watchlist"`.
  * Acceptance Criteria: Toàn bộ người dùng truy cập trang watchlist đều sử dụng mã nguồn native mới.
* [ ] **Task 4.4: Decommission Legacy Code & Shim Layers**
  * Tác vụ: Gỡ bỏ hoàn toàn `StockManagementGroupsView`, `TrackedSymbolsView` tại `packages/core/backend/src/market_data/legacy_views.py` và dọn dẹp các route shim tương ứng trong `market_data/` URL config (không phải `user_workspace/urls.py`). Đồng thời gỡ bỏ `SecuritiesGroupListCreateView`, `TrackedSymbolListCreateView` khỏi `user_workspace/legacy_views.py` sau khi xác nhận không còn có route nào trỏ vào.
  * Acceptance Criteria: Hệ thống biên dịch và vượt qua toàn bộ unit test suite mà không còn bất kỳ dòng code legacy nào liên quan tới groups/tracked-symbols cũ.
