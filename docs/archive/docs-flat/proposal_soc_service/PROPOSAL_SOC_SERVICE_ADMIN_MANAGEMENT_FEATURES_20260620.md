# ĐỀ XUẤT THIẾT KẾ: TÍNH NĂNG QUẢN TRỊ DỊCH VỤ TRÊN TRANG SOC (OPERATIONS CENTER)

- **Ngày tạo:** 2026-06-20
- **Trạng thái:** Dự thảo thảo luận (Draft)
- **Tác giả:** Antigravity (AI Coding Assistant)
- **Dự án:** VNInvest - Service Operations Center (SOC)

---

## 1. TỔNG QUAN & MỤC TIÊU

Trang **Service Operations Center (SOC)** hiện tại chủ yếu đóng vai trò là một bảng giám sát (monitoring dashboard) hiển thị trạng thái sức khỏe (health status) và cấu hình tĩnh của các dịch vụ nền.

Để nâng cao tính hữu dụng và biến SOC thành một **trung tâm điều hành thực thụ (Control Plane)**, chúng ta cần bổ sung các công cụ quản trị tương tác trực tiếp cho phép người vận hành (operator) có quyền `staff`/`superuser`:

1. **Bật / Tắt dịch vụ (Toggle Service Active/Inactive)**: Kịp thời cô lập hoặc kích hoạt lại các pipeline/scheduler khi xảy ra sự cố.
2. **Chạy thử dịch vụ (Manual Health Probe Trigger)**: Kích hoạt kiểm tra trạng thái tức thời không cần chờ chu kỳ kiểm tra tự động (60 giây).
3. **Chỉnh sửa cấu hình trực tuyến (Live Config Editor)**: Thay đổi các thông số runtime (như timeouts, retry counts, profiles) trực tiếp qua JSON Editor có chạy validator.
4. **Khôi phục cấu hình mặc định (Reset to Default)**: Đưa cấu hình dịch vụ về trạng thái mặc định của hệ thống một cách nhanh chóng khi cấu hình mới gặp lỗi.

---

## 2. KIẾN TRÚC & ĐẶC TẢ API (BACKEND)

Tất cả các thay đổi API sẽ nằm hoàn toàn trong service SaaS native: `packages/core/backend/src/service_ops/`.

### 2.1. Thay đổi hành vi Danh sách Dịch vụ
Hiện tại, `OverviewSummaryView` và `ServiceListView` chỉ lọc các dịch vụ có `is_active=True`.
* **Thay đổi:** Loại bỏ điều kiện lọc `is_active=True` ở API để trả về toàn bộ dịch vụ đã đăng ký trong Registry.
* **Serializer:** Thêm trường `is_active` vào `ServiceSummaryRowSerializer` để Frontend hiển thị trạng thái bật/tắt của từng thẻ dịch vụ.

### 2.2. API Bật / Tắt dịch vụ (Toggle is_active)
Sử dụng phương thức `PATCH` tại endpoint chi tiết dịch vụ có sẵn:
* **Endpoint:** `PATCH /api/soc/services/{service_key}/` (hoặc alias `/api/soc/overview/{service_key}/`)
* **Request Body:**
  ```json
  {
    "is_active": false
  }
  ```
* **Quyền hạn:** Yêu cầu `IsAuthenticated` và `IsAdminUser`.
* **Phản hồi:** Trả về chi tiết dịch vụ sau khi cập nhật (200 OK).

### 2.3. API Chỉnh sửa cấu hình (Edit Configuration)
Sử dụng phương thức `POST` tại endpoint cấu hình hiện tại:
* **Endpoint:** `POST /api/soc/services/{service_key}/config/` (hoặc alias `/api/soc/overview/{service_key}/config/`)
* **Request Body:**
  ```json
  {
    "config_payload": {
      "timeout": { "connect": 10.0, "read": 30.0 }
    },
    "change_reason": "Tăng timeout do mạng chập chờn"
  }
  ```
* **Logic xử lý:**
  1. Kiểm tra tính ghi được của domain (ownership write mode).
  2. Ánh xạ class cấu hình (ví dụ: `VnbrokerDomainConfig`) và thực hiện validate dữ liệu.
  3. Tạo mới bản ghi `ServiceConfig` với `is_current=True` (tự động de-activate bản ghi cũ).
  4. Ghi nhận lịch sử vào `ConfigChangeAudit` trail để phục vụ truy vết.

### 2.4. API Reset Cấu hình về Mặc định (Reset Config)
* **Endpoint:** `POST /api/soc/services/{service_key}/config/reset/` (hoặc alias `/api/soc/overview/{service_key}/config/reset/`)
* **Logic xử lý:**
  1. Tìm kiếm cấu hình mặc định (baseline) trong registry hệ thống. Nếu không định nghĩa mặc định, sử dụng `{}`.
  2. Thực hiện ghi đè cấu hình hiện tại và ghi nhận lịch sử vào `ConfigChangeAudit` với lý do `"Khôi phục cấu hình mặc định hệ thống"`.

---

## 3. THIẾT KẾ UX/UI (FRONTEND)

Toàn bộ phần giao diện sẽ được viết dạng SaaS-native bằng Vanilla CSS trong component:
`packages/web/src/pages/admin/ShellOperationsCenterPage.js`

### 3.1. Bố cục tổng quan mới
Component sẽ hiển thị danh sách các card dịch vụ theo Domain.
Mỗi card dịch vụ sẽ có:
1. **Header**: Tên dịch vụ, domain, và **Huy hiệu Trạng thái**.
   - Nếu `is_active=False`: Hiển thị huy hiệu màu xám: **ĐÃ TẮT**.
   - Nếu active: Hiển thị theo trạng thái sức khỏe thực tế (Khỏe mạnh, Suy giảm, Nguy cấp, Chưa rõ).
2. **Khu vực Chỉ số nhanh**: Độ trễ (ms) và thời gian kiểm tra cuối cùng.
3. **Khu vực Hành động nhanh (Quick Actions Bar)**:
   - Một switch gạt (Toggle Switch) cho trạng thái **Bật / Tắt**.
   - Nút **Chạy thử** (icon Sét/Play) kích hoạt manual health probe.
   - Nút **Reset cấu hình** (icon Reset) khôi phục cấu hình mặc định.
   - Nút **Cấu hình** (icon Gear/Sửa) mở trình chỉnh sửa JSON.

### 3.2. Thiết kế Trình chỉnh sửa cấu hình trực tuyến (JSON Config Editor)
Khi bấm vào nút "Cấu hình", card dịch vụ sẽ trượt mở rộng xuống phía dưới (hoặc hiển thị Modal) cung cấp:
* Một khung Textarea chứa mã JSON cấu hình hiện tại được thụt lề định dạng đẹp (pretty-printed).
* Một ô nhập liệu văn bản để operator ghi chú **Lý do thay đổi**.
* Cảnh báo Validation trực quan nếu người dùng nhập sai định dạng JSON hoặc vi phạm quy tắc cấu hình.
* Nhóm nút bấm **Lưu cấu hình** và **Hủy bỏ**.

---

## 4. KẾ HOẠCH BẢO MẬT & KIỂM THỬ

### 4.1. Phân quyền và Bảo mật
* Tất cả API cập nhật trạng thái/cấu hình bắt buộc phải đi kèm Bearer Token của tài khoản có quyền vận hành (`is_staff=True` hoặc `is_superuser=True`).
* Các domain được cấu hình ở chế độ `read-only` trong Ownership Registry sẽ bị chặn cập nhật từ phía Backend (trả về lỗi `403 Forbidden - OWNERSHIP_WRITE_DENIED`).

### 4.2. Kế hoạch Kiểm thử Tự động (Automated Tests)
Chúng ta sẽ viết thêm các case test trong `packages/core/backend/src/service_ops/tests/test_soc_api_overview.py`:
1. `test_toggle_service_active_state`: Kiểm tra gửi PATCH toggle `is_active` hoạt động đúng và làm thay đổi kết quả danh sách dịch vụ.
2. `test_reset_service_config_to_baseline`: Kiểm tra reset cấu hình đưa payload về đúng mặc định trong registry.
3. `test_post_invalid_config_payload_returns_400`: Kiểm tra validation schema hoạt động khi nhập sai kiểu dữ liệu cấu hình.
4. `test_unauthorized_post_returns_403`: Kiểm tra chặn các user không có quyền staff cập nhật cấu hình.

---

## 5. CHI TIẾT TRIỂN KHAI (IMPLEMENTATION DETAILS)

### 5.1. Backend Changes

#### 5.1.1. `packages/core/backend/src/service_ops/serializers.py`
- Thêm trường `is_active` vào `ServiceSummaryRowSerializer` (đã có sẵn trong `ServiceDefinitionSerializer`)

#### 5.1.2. `packages/core/backend/src/service_ops/views/overview.py`
- **OverviewSummaryView**: Loại bỏ filter `is_active=True` trong queryset
- **ServiceListView**: Loại bỏ filter `is_active=True` trong queryset
- **ServiceDetailView**: Thêm method `patch()` để toggle `is_active`
- **ServiceCurrentConfigView**: Thêm method `post()` để apply config mới
- **ServiceCurrentConfigView**: Thêm method `post()` cho endpoint `/config/reset/` để reset về mặc định

#### 5.1.3. `packages/core/backend/src/service_ops/urls.py`
- Thêm route cho `config/reset/` endpoint

### 5.2. Frontend Changes

#### 5.2.1. `packages/web/src/pages/admin/ShellOperationsCenterPage.js`
- Render danh sách service cards theo domain
- Mỗi card hiển thị: status badge, metrics, quick actions (toggle, manual probe, config, reset)
- Expandable config editor với JSON validation
- Integration với API endpoints hiện có

---

## 6. TRẠNG THÁI HIỆN TẠI CỦA CODEBASE (CẬP NHẬT 2026-06-20)

### Đã hoàn thành:
- ✅ Celery beat schedule cho health check 60s (`service-ops-health-check-60s`)
- ✅ DNSE Intraday Quarterly Backfill service trong registry (27 services total)
- ✅ Migration từ legacy `SOCPage` sang `ShellOperationsCenterPage` via `OperationsCenterShellHost`
- ✅ Registry bootstrap tạo `ServiceDefinition`, `ServiceHealth`, `ServiceConfig`, `OwnershipRecord`
- ✅ ConfigApplyMixin cho validation và audit trail
- ✅ Domain configs typed schema (Vnbroker, Prefetch, Signals, Screener, Matrix)
- ✅ Ownership matrix với `can_apply` flag

### Cần triển khai:
- ⬜ `is_active` field trong ServiceSummaryRowSerializer
- ⬜ Bỏ filter `is_active=True` trong OverviewSummaryView và ServiceListView
- ⬜ PATCH endpoint cho toggle `is_active`
- ⬜ POST endpoint cho config edit
- ⬜ POST endpoint cho config reset
- ⬜ Frontend UI components trong ShellOperationsCenterPage.js
- ⬜ Automated tests