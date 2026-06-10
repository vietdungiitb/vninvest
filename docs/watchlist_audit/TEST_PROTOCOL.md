# Quy trình Kiểm thử & Xác minh: Watchlist SaaS-Native Core
## QA Test Matrix, Tenant Isolation & Parity Verification

Tài liệu này cung cấp các kịch bản kiểm thử tự động, thủ công và các bước kiểm chứng chất lượng cho đội ngũ kiểm thử (QA/QC) trước khi phát hành.

---

## 1. Ma trận Kiểm thử Tự động (Automated Test Matrix)

Lập trình viên và công cụ CI phải chạy thành công 100% các test suite sau đây. Nghiêm cấm sử dụng các đường dẫn kiểm thử thuộc thư mục legacy `/backend`.

### 1.1 Kiểm thử Nghiệp vụ Workspace Native (packages/core)
* **Câu lệnh**: `python -m pytest packages/core/backend/src/user_workspace/tests.py`
* **Mục tiêu**: Kiểm tra các hành vi cơ bản bao gồm thêm mã chứng khoán, xóa mã, tạo mới watchlist cá nhân trên môi trường backend core.
* **Môi trường**: Container local `core-api` hoặc local Python sử dụng SQLite.

### 1.2 Kiểm thử Bảo mật Cô lập Tenant (Multi-Tenant Security Isolation)
* **Câu lệnh**: `python -m pytest packages/core/backend/src/vninvest_core/tests/test_user_workspace_tenant_isolation.py`
* **Mục tiêu**: Bảo đảm an toàn thông tin dữ liệu tài chính. Xác minh rằng một người dùng thuộc Tenant A tuyệt đối không thể xem, thêm mã, hoặc xóa mã trong watchlist thuộc sở hữu của Tenant B.
* **Kịch bản chính**:
  1. Login dưới tài khoản Tenant A -> Request lấy watchlist của Tenant A (200 OK).
  2. Request lấy watchlist ID của Tenant B -> Trả về lỗi `403 Forbidden` hoặc `404 Not Found`.
  3. Thử thêm mã vào watchlist của Tenant B -> Bị chặn đầu ra với lỗi `403 Forbidden`.

### 1.3 Kiểm thử Component Giao diện (packages/web)
* **Câu lệnh**: `npm run test --prefix packages/web`
  > **Lưu ý:** Xác nhận script `"test"` tồn tại trong `packages/web/package.json` trước khi chạy.
* **Mục tiêu**: Kiểm tra quá trình render giao diện bảng biểu mật độ cao `SmartRadarTable.js`, bộ phân tách kết nối WebSocket và cơ chế fallback.

---

## 2. Kịch bản So khớp Dữ liệu di trú (Parity Verification Protocol)

Để đảm bảo không bị mất mát dữ liệu của người dùng khi nâng cấp từ hệ thống legacy cũ sang SaaS-native, QA phải thực hiện quy trình so khớp dữ liệu (Parity Check) theo các bước sau:

```
[Database Legacy] ──> Lấy danh sách watchlist cũ ──+
                                                   |
                                                   v (So khớp 100% về ID, Mã, Ghi chú)
                                                   ^
[Database Core]   ──> Lấy danh sách watchlist mới ──+
```

1. **Bước 1: Kết xuất dữ liệu nguồn (Legacy Export)**
   Truy vấn danh sách watchlist hiện có của người dùng từ bảng core (bảng `legacy_watchlist_groups` không tồn tại — legacy data đã được migrate vào `user_workspace_watchlist`):
   ```sql
   SELECT w.id, w.name, w.legacy_group_id
   FROM user_workspace_watchlist w
   WHERE w.user_id = 1 AND w.legacy_group_id IS NOT NULL
   ORDER BY w.legacy_group_id;
   ```
2. **Bước 2: Kết xuất dữ liệu đích (Core Export)**
   Truy vấn danh sách watchlist và items từ bảng core (có tương thích với cả SQLite và PostgreSQL):
   ```sql
   SELECT w.legacy_group_id, w.name,
          GROUP_CONCAT(i.symbol, ',') AS symbols
   FROM user_workspace_watchlist w
   LEFT JOIN user_workspace_watchlistitem i ON i.watchlist_id = w.id
   WHERE w.user_id = 1
   GROUP BY w.id, w.legacy_group_id, w.name
   ORDER BY w.legacy_group_id;
   ```
   > **PostgreSQL:** Thay `GROUP_CONCAT(i.symbol, ',')` bằng `string_agg(i.symbol, ',')`.
3. **Bước 3: Đối soát tự động (Parity Assert)**
   Chạy script đối soát, so sánh kết quả của hai câu lệnh. Đảm bảo toàn bộ các mã chứng khoán và tiêu đề danh sách trùng khớp 100%. Báo cáo lỗi nếu có bất kỳ sự thiếu hụt nào.

---

## 3. Danh sách Kịch bản Kiểm thử Thủ công (Manual Test Matrix)

Các kiểm thử viên (QA) thực hiện kiểm tra trực tiếp trên trình duyệt local để ký duyệt biên bản nghiệm thu:

| Mã Kịch bản | Tên Kịch bản | Các bước thực hiện | Kết quả mong đợi (PASS) |
| :--- | :--- | :--- | :--- |
| **TC-UI-01** | Bật tắt Mật độ (Density Change) | 1. Mở trang `/watchlist`<br>2. Bấm nút chuyển đổi chế độ mật độ | Ô giá tự động co hẹp diện tích (Compact) giúp quan sát $> 50$ mã mà không cần cuộn trang. |
| **TC-UI-02** | Hiệu ứng Flash giá thời gian thực | 1. Đợi nhận dữ liệu giá khớp mới từ luồng WebSocket<br>2. Quan sát ô giá của mã tương ứng | Viền của ô nhấp nháy xanh nhẹ khi giá tăng, đỏ nhẹ khi giá giảm trong vòng 300ms. |
| **TC-NET-01** | WebSocket Fallback Test | 1. Mở trang Watchlist để kết nối WebSocket hoạt động<br>2. Ngắt kết nối mạng giả lập hoặc ngắt luồng WS | Hệ thống tự động chuyển sang chế độ short-polling gọi HTTP lấy giá định kỳ mỗi 30 giây. |
| **TC-BI-01** | Tích hợp Liên kết (Click-to-Chart) | 1. Rê chuột vào một dòng mã chứng khoán trong bảng radar<br>2. Click chuột vào mã đó | Trình duyệt tự động chuyển hướng mượt mà sang biểu đồ kỹ thuật chi tiết của mã tại `/stocks/<symbol>`. |
