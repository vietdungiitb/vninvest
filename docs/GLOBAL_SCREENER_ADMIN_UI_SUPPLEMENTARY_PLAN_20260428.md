# KẾ HOẠCH BỔ SUNG & KHẮC PHỤC (SUPPLEMENTARY HANDOFF & AUDIT PLAN)
## TÍNH NĂNG: GLOBAL SCREENER ADMIN UI & SSOT FIX

**Ngày ban hành:** 2026-04-28
**Phạm vi:** Dành cho Đội lập trình (Dev Team / AI Sessions)

---

## PHẦN 1: MỤC TIÊU CÔNG VIỆC (OBJECTIVES)
Kế hoạch bổ sung này giải quyết 2 nhiệm vụ cốt lõi:
1. **Khắc phục lỗi SSOT (Critical Bug Fix)**: Bổ sung dữ liệu Whale Buy/Sell (Dòng tiền Cá mập) và Dark Money Flow (Dòng tiền ẩn) vào hàm gom dữ liệu `precompute_market_snapshot` tại backend, nhằm hoàn thiện động cơ Screener.
2. **Xây dựng Giao diện Quản trị (Admin UI)**: Xây dựng một Panel chuyên biệt nằm trong trang `AdminOps` để quản trị viên có thể thêm/sửa luật Global, chỉnh lịch Cron, tắt tính năng User Screener và bấm nút chạy thủ công.

---

## PHẦN 2: KẾ HOẠCH THỰC THI (EXECUTION PLAN)

### Slice 1: Khắc Phục Lỗi SSOT tại Backend (Hotfix)
- **Tập tin:** `backend/portfolio/services_global_screener.py`
- **Hành động:** 
  - Trong hàm `precompute_market_snapshot`, sau khi lấy giá trị giá và technical indicators, cần gọi `OrderFlowHistory` hoặc `services_whale_analytics_snapshot` để lấy điểm số Whale.
  - Gọi `DarkMoneyHistory` (hoặc view tương ứng) để lấy tín hiệu dòng tiền ẩn.
  - Hợp nhất (Merge) các thông số này vào biến `row` trước khi lưu vào Redis Cache. Nhờ đó bộ luật Screener của Admin có thể thiết lập các điều kiện như `whale_buy > 0` hoặc `dark_money_signal == 'STRONG_BUY'`.

### Slice 2: Xây Dựng Admin APIs (Backend)
- **Tập tin:** `backend/portfolio/views_screener_admin.py` (TẠO MỚI)
  - Viết 4 API Views: `AdminScreenerConfigView` (GET/PUT), `AdminGlobalScreenerRuleListView` (GET/POST), `AdminGlobalScreenerRuleDetailView` (PUT/DELETE), và `AdminGlobalScreenerRunManualView` (POST). 
  - Đảm bảo tất cả đều bọc `permission_classes = [IsAdminUser]`.
- **Tập tin:** `backend/portfolio/urls.py`
  - Bổ sung các route: `admin/screener/config/`, `admin/screener/rules/`, `admin/screener/run-manual/`.

### Slice 3: Xây Dựng Admin API Client (Frontend)
- **Tập tin:** `frontend/src/api/client.js`
  - Bổ sung các hàm gọi Axios tương ứng với 4 APIs vừa tạo ở trên (ví dụ: `getAdminScreenerConfig`, `runAdminGlobalScreenerManual`, v.v...).

### Slice 4: Giao Diện Quản Trị Global Screener (Frontend)
- **Tập tin:** `frontend/src/components/adminops/GlobalScreenerAdminPanel.jsx` (TẠO MỚI)
  - Phân khu 1: **Cấu hình Hệ thống (System Config)**: Form cập nhật Cron Expression và checkbox bật/tắt User Screener.
  - Phân khu 2: **Quét Thủ Công (Manual Trigger)**: Nút bấm lớn màu xanh dương. Khi bấm, gọi hàm manual scan và có Loading spinner, không cần đợi trả về kết quả quét ngay lập tức, chỉ cần thông báo "Đã gửi lệnh quét nền thành công".
  - Phân khu 3: **Quản lý Luật (Rules Management)**: Danh sách bảng các luật Global ScreenerRule, nút Thêm/Sửa/Xóa.
- **Tập tin:** `frontend/src/pages/AdminOps.jsx`
  - Bổ sung tab điều hướng (Button ngang) mang tên `Global Screener`.
  - Khi `activePage === 'global_screener'`, render component `<GlobalScreenerAdminPanel />`.

---

## PHẦN 3: BẢNG THEO DÕI CÔNG VIỆC (TASKBOARD)
*(Lập trình viên đánh dấu `[x]` sau khi hoàn thành)*

- `[x]` 1. Sửa hàm `precompute_market_snapshot` để lấy thêm dữ liệu Whale & Dark Money.
- `[x]` 2. Tạo `views_screener_admin.py` và viết 4 APIs.
- `[x]` 3. Khai báo URLs backend.
- `[x]` 4. Khai báo Axios client trong `api/client.js`.
- `[x]` 5. Tạo component `GlobalScreenerAdminPanel.jsx`.
- `[x]` 6. Tích hợp tab `Global Screener` vào `AdminOps.jsx`.

---

## PHẦN 4: GIAO THỨC KIỂM THỬ & KIỂM TOÁN LẠI TỔNG THỂ (AUDIT PROTOCOL)

Sau khi đội code làm xong, cần tiến hành Audit lại toàn bộ tính năng theo trình tự sau:

1. **Kiểm tra SSOT (Dữ liệu nền tảng):**
   - Đọc dữ liệu từ Redis Cache `global_screener_master_snapshot`.
   - **Đạt nếu:** Từng mã chứng khoán trong Snapshot phải có chứa các trường dữ liệu liên quan đến dòng tiền (Whale/Dark Money) chứ không chỉ đơn thuần là Close Price.
2. **Kiểm tra API Security:**
  - Dùng tài khoản User thường gọi thử API `/api/portfolio/admin/screener/config/`.
   - **Đạt nếu:** Hệ thống trả về HTTP 403 Forbidden.
3. **Kiểm tra UI AdminOps:**
   - Đăng nhập quyền Admin, vào trang `/admin-ops`.
   - **Đạt nếu:** Chuyển sang Tab "Global Screener" không bị crash màn hình trắng (White screen of death). Dữ liệu cấu hình load lên form thành công.
4. **Kiểm tra Data Flow của Quét Thủ Công:**
   - Tại Tab Global Screener, bấm nút "Quét thủ công".
   - Kiểm tra log Terminal/Celery.
   - **Đạt nếu:** Dòng chữ `Global screener scheduled run completed: symbol_count=X matched=Y` xuất hiện trên log, và kênh WebSocket nhận được tín hiệu cảnh báo.
