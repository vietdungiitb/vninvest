# Thiết kế Backend: Watchlist SaaS-Native Core
## Architectural Blueprint - Data Schemas & REST APIs

Tài liệu này cung cấp thiết kế chi tiết lớp Backend cho tính năng Watchlist thuộc phân hệ `user_workspace` trong package `packages/core`.

---

## 1. Thiết kế Mô hình Cơ sở Dữ liệu (Database Schema Design)

Lớp dữ liệu tuân thủ nghiêm ngặt nguyên tắc **Multi-Tenant Isolation** thông qua liên kết khóa ngoại trực tiếp tới `CoreTenant`. Không sử dụng liên kết ngầm định.

```
+-----------------------------------+        +-----------------------------------+
|       identity_access.CoreTenant  |        |        django.contrib.auth.User   |
+-----------------------------------+        +-----------------------------------+
                  |                                           |
                  +-------------------+   +-------------------+
                                      |   |
                                      v   v
                        +-------------------------------+
                        |     user_workspace.Watchlist  |
                        +-------------------------------+
                        | - id (PK)                     |
                        | - tenant (FK to CoreTenant)   |
                        | - user (FK to User)           |
                        | - name (VARCHAR)              |
                        | - description (TEXT)          |
                        | - is_default (BOOLEAN)        |
                        +-------------------------------+
                                        |
                                        v (1-to-many)
                        +-------------------------------+
                        |   user_workspace.WatchlistItem|
                        +-------------------------------+
                        | - id (PK)                     |
                        | - watchlist (FK to Watchlist) |
                        | - symbol (VARCHAR, Index)     |
                        | - note (VARCHAR)              |
                        +-------------------------------+
```

### 1.1 Model: Watchlist
Đại diện cho nhóm danh sách theo dõi của người dùng.
* `id`: `AutoField` (Primary Key).
* `user`: `ForeignKey` trỏ tới `django.contrib.auth.models.User` (on_delete=CASCADE).
* `tenant`: `ForeignKey` trỏ tới `identity_access.models.CoreTenant` (on_delete=CASCADE, null=False).
* `name`: `CharField(max_length=100)`, tiêu đề của danh sách.
* `description`: `TextField(blank=True, default='')`, mô tả chi tiết.
* `is_default`: `BooleanField(default=False)`, xác định danh sách mặc định.
* `legacy_group_id`: `IntegerField(null=True, blank=True)`, lưu ID cũ của database legacy phục vụ đối soát di trú.

### 1.2 Model: WatchlistItem
Đại diện cho các mã chứng khoán nằm trong từng Watchlist.
* `id`: `AutoField` (Primary Key).
* `watchlist`: `ForeignKey` trỏ tới `Watchlist` (on_delete=CASCADE, related_name='items').
* `symbol`: `CharField(max_length=32, db_index=True)`, mã chứng khoán (luôn lưu dạng UPPERCASE).
* `note`: `CharField(max_length=255, blank=True, default='')`, ghi chú nhanh của người dùng.
* **Constraints**: `unique_together = [('watchlist', 'symbol')]` đảm bảo không bị trùng lặp mã trong một danh sách.

---

## 2. Thiết kế REST API Contracts

### 2.1 Endpoint Phân tích Kỹ thuật Gộp (Technicals Bulk API)
* **Đường dẫn**: `GET /core/v1/market-data/technicals/bulk/`
* **Xác thực**: Bắt buộc (Bearer JWT Token).
* **Tham số Query**:
  - `symbols` (String, required): Danh sách các mã cách nhau bằng dấu phẩy (Ví dụ: `symbols=ACB,VNM,SSI`).
* **Mô tả**: Backend thực hiện gộp và tính toán nhanh các chỉ báo kỹ thuật dựa trên dữ liệu giá OHLCV lịch sử trong cơ sở dữ liệu. Giảm tải hoàn toàn việc tính toán ở phía client.
* **Phản hồi mẫu (200 OK)**:
  ```json
  {
    "count": 3,
    "results": [
      {
        "symbol": "ACB",
        "rsi_14": 58.42,
        "ma20_distance_pct": 2.15,
        "rvol": 1.24,
        "updated_at": "2026-05-30T17:15:00Z"
      },
      {
        "symbol": "VNM",
        "rsi_14": 42.15,
        "ma20_distance_pct": -1.45,
        "rvol": 0.85,
        "updated_at": "2026-05-30T17:15:00Z"
      },
      {
        "symbol": "SSI",
        "rsi_14": 64.88,
        "ma20_distance_pct": 4.12,
        "rvol": 2.01,
        "updated_at": "2026-05-30T17:15:00Z"
      }
    ]
  }
  ```

---

## 3. Quy tắc Ràng buộc Cô lập Multi-Tenant (Tenant Isolation Rules)

Để tránh rò rỉ thông tin dữ liệu tài chính nhạy cảm giữa các tổ chức/doanh nghiệp sử dụng hệ thống (Tenants), toàn bộ các lớp nghiệp vụ phải tuân thủ nghiêm ngặt các quy tắc sau:

### 3.1 Double-Filtering Rule
Mọi lệnh truy vấn SQL hoặc ORM thao tác với Watchlist đều bắt buộc phải đính kèm đồng thời 2 tham số lọc:
```python
# Lọc kép bảo vệ an toàn dữ liệu
watchlists = Watchlist.objects.filter(
    user=request.user,
    tenant=request.tenant
).order_by('name')
```
* Nghiêm cấm hoàn toàn việc truy vấn thông tin chỉ dựa trên `user_id` mà không chỉ định `tenant_id`.

### 3.2 Tenant Scope Verification Middleware
* Sử dụng `TenantScopePermission` làm lớp bảo vệ (permission classes) trên các View Sets. 
* Middleware tự động trích xuất `tenant_id` từ token JWT đã ký số và gán vào đối tượng `request.tenant`. Nếu ID của đối tượng yêu cầu không thuộc sở hữu của tenant đang gửi yêu cầu, hệ thống sẽ trả về mã lỗi `403 Forbidden` hoặc `404 Not Found` để che giấu sự tồn tại của dữ liệu.
