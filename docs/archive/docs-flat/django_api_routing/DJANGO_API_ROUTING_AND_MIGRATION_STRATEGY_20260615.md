# Đề xuất Chuẩn hóa và Di chuyển Django Endpoints sang `/core/v1/`

Tài liệu này tổng hợp cấu trúc định tuyến (routing) hiện tại của Django API và đề xuất giải pháp chi tiết để tối đa hóa việc di chuyển các endpoints về dạng chuẩn `/core/v1/` nhằm phục vụ kiến trúc SaaS Native.

---

## 1. Bản đồ Định tuyến Hiện tại (Current Routing Matrix)

Hệ thống API hiện tại đang sử dụng các tiền tố (prefixes) sau cấu hình trong [vninvest_core/urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/urls.py):

| Tiền tố (Prefix) | Phạm vi & Mục đích | Trạng thái |
| :--- | :--- | :--- |
| **`/core/v1/`** | SaaS Core APIs (chính thức). Dành cho các tính năng được xác thực, phân quyền cô lập tenant (tenant isolation) và quản lý chặt chẽ theo OpenAPI. | **Active (Khuyến khích)** |
| **`/api/`** | Public APIs, Bootstrap, hoặc các route tương thích ngược hỗ trợ cho phiên bản cũ. | **Active (Duy trì hạn chế)** |
| **`/api/soc/`** | Cổng quản trị vận hành trung tâm (Security Operations Center) gom 6 domains ops. | **Active (Operator-Only)** |
| **`/api/admin-ops/`** | Các route admin cũ. | **Decommissioned (Trả về 410 Gone)** |
| **`/admin/`** | Trang Django Admin truyền thống của hệ thống. | **Active** |

---

## 2. Quy trình Di chuyển Endpoint sang `/core/v1/` tối đa

Để đưa một endpoint hiện tại (đang chạy dưới `/api/` hoặc legacy code) về dạng chuẩn `/core/v1/`, quy trình bao gồm 6 bước đồng bộ:

### Bước 1: Di chuyển logic về SaaS Native Domain Apps
Đảm bảo mã nguồn (Views, Serializers, Services) nằm trọn vẹn trong các domain app của core service tại `packages/core/backend/src/<domain_app>/`. Không để code mới/sửa đổi ở các thư mục legacy deprecated ở gốc dự án.

### Bước 2: Đăng ký Route con trong Domain App
Đăng ký các mẫu đường dẫn con tại `urls.py` chính của app thay vì các tệp alias public/api.
*Ví dụ:* Định nghĩa các path trong `packages/core/backend/src/user_workspace/urls.py`.

### Bước 3: Mount URL của app dưới `/core/v1/`
Trong root [vninvest_core/urls.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/vninvest_core/urls.py), sử dụng lệnh `include` trỏ vào namespace của app dưới tiền tố `/core/v1/`:
```python
path('core/v1/', include(('user_workspace.urls', 'user_workspace'), namespace='user_workspace')),
```

### Bước 4: Áp dụng hiến chương chuẩn hóa OpenAPI
Các endpoint dưới `/core/v1/` bắt buộc phải tuân thủ nghiêm ngặt hiến chương thiết kế [CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md](file:///c:/Mujoco%20Projects/vninvest/docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md):
- Khai báo Schema đầu vào/đầu ra đầy đủ để sinh tài liệu tự động.
- Áp dụng phân quyền cô lập dữ liệu theo Tenant (`IsTenantActive` hoặc `IsTenantOwnerOrAdmin`).
- Sử dụng cấu trúc báo lỗi Error Envelope chung và cơ chế phân trang (Pagination) bắt buộc cho danh sách.

### Bước 5: Cấu hình Base URL trên Frontend
Cấu hình môi trường của Frontend (`packages/web`) trỏ Base URL đến `/core/v1/` thông qua thiết lập biến môi trường:
```env
REACT_APP_CORE_API_BASE_URL=/core/v1
```
Đồng thời, cập nhật các API adapter (như `coreApiAdapter`) để định tuyến chính xác tất cả các request nghiệp vụ.

### Bước 6: Loại bỏ alias cũ (Decommission)
Sau khi hoàn tất kiểm thử tích hợp (Integration Tests) và chạy thử nghiệm (Soak run) thành công:
1. Gỡ bỏ/xóa các include của app tương ứng dưới nhánh `path('api/', ...)` trong tệp url gốc.
2. Thiết lập cơ chế trả về `410 Gone` đối với các admin route hoặc endpoint cũ để tránh việc client tiếp tục gọi sai đầu API.

---

## 3. Các vấn đề cần Thảo luận tiếp theo

Để chuẩn bị cho việc thực thi di chuyển hàng loạt, chúng ta cần thảo luận các điểm then chốt dưới đây:

### 💡 Chủ đề 1: Phân định ranh giới tuyệt đối giữa `/api/` và `/core/v1/`
*   **Vấn đề:** Những endpoint nào được phép giữ lại ở dạng `/api/` công khai?
*   **Gợi ý phân loại:**
    *   *Giữ lại dưới `/api/`:* Các API Bootstrap công khai không cần định danh (Public Health check `/api/health`, Public Market Data snapshot của các mã chứng khoán không bị giới hạn quota, hoặc API webhook liên kết bên ngoài).
    *   *Bắt buộc chuyển sang `/core/v1/`:* Tất cả API liên quan đến tài khoản người dùng, cấu hình danh mục đầu tư (portfolio), danh sách theo dõi (watchlist), hệ thống tín hiệu Whale Alert, và Advisory AI.

### 💡 Chủ đề 2: Lộ trình và Thứ tự Ưu tiên di chuyển (Phases)
*   **Vấn đề:** Di chuyển đồng loạt hay chia nhỏ theo từng Domain Service?
*   **Đề xuất lộ trình:**
    *   *Phase 1:* Chuẩn hóa và di chuyển các Core Domain thiết yếu: `identity_access` (Authentication/Authorization) và `user_workspace` (danh mục & settings).
    *   *Phase 2:* Chuyển dịch dữ liệu thị trường và tín hiệu: `market_data` và `signal_intelligence`.
    *   *Phase 3:* Chuyển dịch hệ tư vấn chuyên sâu: `advisory`.

### 💡 Chủ đề 3: Chiến lược giảm thiểu rủi ro Drift/Broken API trên Prod
*   **Vấn đề:** Làm thế nào để đảm bảo việc gỡ bỏ các route `/api/` cũ không làm sập ứng dụng Client (Web/Mobile) đang chạy thực tế?
*   **Phương án đề xuất:**
    *   **Shadow Rollout:** Duy trì đồng thời cả hai định dạng đường dẫn trên môi trường Staging/UAT trong vòng ít nhất 1 chu kỳ Sprint để theo dõi log truy cập (Run Logs).
    *   **Log Audit:** Kiểm tra log nginx/core-api xem còn request nào gửi tới đầu `/api/` trước khi tiến hành xóa hẳn route cũ.
