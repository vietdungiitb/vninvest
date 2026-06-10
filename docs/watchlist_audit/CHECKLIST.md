# Checklist: Cổng Kiểm soát Chất lượng & Tự kiểm toán (PR Gates & Self-Audit)
## Watchlist SaaS-Native Upgrade Quality Constitution

Tài liệu này định nghĩa các quy tắc kiểm soát chất lượng bắt buộc mà mọi Pull Request (PR) liên quan đến tính năng Watchlist phải vượt qua trước khi được phép merge vào nhánh chính của dự án.

---

## 1. Cổng Kiểm soát Tự động (Automated PR Gates)

Đội ngũ phát triển phải thiết lập các bước kiểm tra tự động trên CI/CD workflow với tiêu chuẩn nghiêm ngặt sau:

### 1.1 Kiểm tra Cú pháp & Tĩnh (Static Analysis & Linting)
* [ ] **PASS Gate**: Lệnh kiểm tra cú pháp và định dạng hoạt động không có lỗi:
  - Frontend: `npm run lint --prefix packages/web` trả về mã thoát $0$ (zero warnings/errors).
  - Backend: `flake8 packages/core` và `black --check packages/core` hoạt động sạch sẽ.
* [ ] **FAIL Gate**: Có bất kỳ cảnh báo định dạng chưa tuân thủ chuẩn coding standards của dự án.

### 1.2 Kiểm toán An toàn Thông tin (Security & Credentials Scan)
* [ ] **PASS Gate**: Công cụ quét mã nguồn (như GitGuardian hoặc Trufflehog) xác nhận $0$ trường hợp rò rỉ credential (password, API keys, Bearer tokens) trong code và tài liệu.
* [ ] **FAIL Gate**: Phát hiện bất kỳ chuỗi văn bản tĩnh nào (plaintext string) có dạng mật khẩu hoặc khóa kết nối — ví dụ credential dạng `<username>/<password>` — trong commit diffs.

### 1.3 Kiểm tra Rào chắn Cô lập Tenant (Multi-Tenant Isolation Verify)
* [ ] **PASS Gate**: Kiểm tra toàn bộ mã nguồn backend, đảm bảo mọi truy vấn thao tác trên các bảng `Watchlist`, `WatchlistItem`, `TrackedSymbol`, và `PriceAlert` đều có điều kiện lọc ghép bắt buộc:
  ```python
  Watchlist.objects.filter(user=request.user, tenant=request.tenant)
  ```
  100% test cases trong `test_user_workspace_tenant_isolation.py` chạy thành công.
* [ ] **FAIL Gate**: Tồn tại bất kỳ câu lệnh truy vấn thô nào (`.objects.all()` hoặc `.objects.get(id=...)`) không đi kèm lọc `user` và `tenant`.

---

## 2. Danh mục Kiểm toán Thủ công (Manual Audit Checklist)

Lập trình viên và kiểm thử viên phải trực tiếp xác minh các tiêu chuẩn sau trên giao diện thực tế:

### 2.1 Hiệu năng Rendering & Mật độ Bloomberg-Style
* [ ] **PASS Gate**: Số lượng khung hình duy trì ổn định $\ge 58$ FPS khi mở danh sách watchlist chứa 120 mã nhận dữ liệu tick liên tục từ WebSocket. Bật chuyển đổi mượt mà giữa chế độ Compact và Comfortable.
* [ ] **FAIL Gate**: Xảy ra hiện tượng giật màn hình, dropped frames (khung hình rớt xuống $< 45$ FPS) khi nhận luồng dữ liệu thời gian thực có tần suất cao.

### 2.2 Đọc đúng Nguồn sự thật (Single Source of Truth)
* [ ] **PASS Gate**: Dữ liệu hiển thị trên bảng `SmartRadarTable` khớp hoàn toàn về mã và ghi chú của danh sách theo dõi lưu trữ trên backend API native (`/core/v1/workspace/watchlists/`).
* [ ] **FAIL Gate**: Xuất hiện các mã rác hoặc mất đồng bộ dữ liệu so với dữ liệu lưu trên DB thực tế của người dùng.

### 2.3 Ranh giới Quy tắc Whale Icon và Fallback Connection
* [ ] **PASS Gate**: Icon cá mập hiển thị trên dòng quote của bảng chỉ đóng vai trò cờ trạng thái nhận trực tiếp từ backend feed. Cơ chế fallback sang HTTP Short-polling (30s) được tự động kích hoạt ngay khi ngắt kết nối WebSocket thử nghiệm (Circuit Breaker mở).
* [ ] **FAIL Gate**: Cố tình áp dụng logic viewport render nến 10% của KLineChart vào bảng quote gây nặng trình duyệt, hoặc client bị mất giá hoàn toàn khi mất mạng mà không có fallback.

---

## 3. Điều kiện Rollback & Hoàn trả Trạng thái (Rollback Gates)

Đội vận hành (Ops) sẽ lập tức thực hiện hoàn trả phiên bản (Rollback) về trạng thái sử dụng trang shell baseline nếu xuất hiện bất kỳ dấu hiệu nào sau đây:

* [ ] **Downtime Migration**: Quá trình chạy di trú cơ sở dữ liệu (Database Migration) gây khóa bảng kéo dài $> 5$ giây trên môi trường sản xuất.
* [ ] **Quá tải Tài nguyên**: CPU của API Server tăng vọt $> 85\%$ liên tục do lưu lượng HTTP short-polling tăng đột ngột khi WebSocket gặp sự cố.
* [ ] **Trải nghiệm Xuất hiện Lỗi nghiêm trọng**: Người dùng nhận phản hồi chậm hoặc lỗi 500 khi thực hiện thêm/xóa mã chứng khoán khỏi danh sách cá nhân.
