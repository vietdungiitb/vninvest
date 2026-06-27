# BÁO CÁO SỰ CỐ & GIẢI PHÁP KHẮC PHỤC TREO DỊCH VỤ BACKFILL
**Ngày lập:** 2026-06-27  
**Phạm vi ảnh hưởng:** Backend (Dev & Prod)  
**Dịch vụ bị ảnh hưởng:** `daily-backfill-prices-1700` (`backfill_daily_prices`) & `dnse-quarterly-backfill-intraday` (`backfill_intraday_tick_system`)

---

## 1. Hiện tượng & Phân tích Nguyên nhân Gốc (Root Cause Analysis)

### Hiện tượng
Các dịch vụ backfill lịch sử giá hàng ngày và backfill dữ liệu intraday từ DNSE thỉnh thoảng bị kẹt ở trạng thái `running` (hoặc `degraded` trên giao diện SOC). Khi sự cố xảy ra:
1. Không thể kết thúc tác vụ đang chạy.
2. Không thể chạy lại thủ công (nút "Run Now" bị khóa do check inflight marker).
3. Người vận hành thực hiện nút "Abort" trên UI nhưng hệ thống không phản hồi, tiến trình con vẫn tiếp tục bị kẹt.

### Phân tích kỹ thuật
* **Treo Socket I/O vô hạn:** Tác vụ `backfill_daily_prices` sử dụng `ThreadPoolExecutor` để chạy song song nhiều luồng lấy dữ liệu từ các explorer của thư viện `vnbroker` (e.g., KBS, VCI). Một số hàm HTTP request trong gói `vnbroker` (hoặc các kết nối API DNSE) không được thiết lập tham số `timeout`. Khi server của đối tác bị treo hoặc nghẽn mạng, tiến trình con Python bị khóa ở tầng I/O hệ điều hành (Socket Read Block) và chờ đợi vô hạn.
* **Hạng mục ThreadPoolExecutor bị treo:** Khi các luồng bị kẹt trong context manager `with ThreadPoolExecutor(...) as pool:`, khối lệnh này sẽ bị block vĩnh viễn ở giai đoạn thoát (shutdown) để chờ các luồng con hoàn thành, khiến Celery worker không thể giải phóng.
* **Tín hiệu SIGTERM không hiệu quả:** Hành động "Abort" từ giao diện hiện tại gọi lệnh `revoke(..., terminate=True, signal='SIGTERM')`. Một tiến trình Python đang bị block ở mức I/O socket không thể xử lý hoặc phản hồi tín hiệu `SIGTERM` một cách bình thường, dẫn tới lệnh hủy tác vụ bị vô hiệu.
* **Trạng thái trôi dạt (Status Drift):** Task bị treo dẫn tới bản ghi `ServiceRunLog` bị kẹt ở trạng thái `running`. Tiến trình dọn dẹp định kỳ (`reconcile_stale_running_service_run_logs`) kiểm tra thấy task ID vẫn đang "active" trên Celery worker nên bỏ qua không thu hồi.

---

## 2. Giải pháp khắc phục tại Hệ thống vninvest (Mitigation Plan)

Để giải quyết ngay lập tức tình trạng treo mà không phụ thuộc vào việc sửa đổi thư viện bên thứ ba, chúng tôi triển khai giải pháp phòng thủ đa tầng tại codebase `vninvest-core`:

### Bước 1: Áp dụng Socket Timeout toàn cục (Global Socket Timeout)
Chúng tôi import module `socket` và gọi `socket.setdefaulttimeout(60.0)` tại toàn bộ các điểm khởi tạo ứng dụng:
* `packages/core/backend/src/vninvest_core/celery.py` (Cho các tiến trình Celery Worker/Beat)
* `packages/core/backend/src/vninvest_core/wsgi.py` (Cho WSGI Server - e.g., Gunicorn)
* `packages/core/backend/src/vninvest_core/asgi.py` (Cho ASGI Server - e.g., Daphne)
* `packages/core/backend/manage.py` (Cho các lệnh quản trị CLI)

**Hiệu quả:** Mọi kết nối socket mới được mở bởi bất kỳ thư viện nào (bao gồm cả `requests` và `httpx` của `vnbroker`) nếu không định nghĩa tham số timeout sẽ tự động ngắt sau **60 giây** nếu không nhận được phản hồi. Điều này ngăn chặn triệt để hiện tượng kẹt I/O vô hạn.

### Bước 2: Thiết lập Giới hạn thời gian chạy cho Celery Task (Time Limits)
Cấu hình các tham số giới hạn thời gian chạy trên decorator `@shared_task`:
1. **`backfill_daily_prices`:** 
   * `soft_time_limit = 10800` (3 giờ) - bằng thời gian chạy dự kiến tối đa.
   * `time_limit = 11400` (3 giờ 10 phút) - giới hạn cứng.
   * Bắt ngoại lệ `SoftTimeLimitExceeded` trong thân hàm để đóng kết nối, chuyển trạng thái DB (`ServiceRunLog` và `BackfillExecutionRun`) về `failed`, xóa cache marker `inflight` trước khi tắt.
2. **`enqueue_dnse_quarterly_backfill`:**
   * `soft_time_limit = 500` (~8.3 phút).
   * `time_limit = 600` (10 phút).
3. **`backfill_intraday_tick_system`:**
   * `soft_time_limit = 540` (9 phút).
   * `time_limit = 600` (10 phút).

**Hiệu quả:** Nếu một task chạy vượt quá thời gian cho phép, Celery sẽ tự động can thiệp để tắt task đó và báo lỗi thay vì để chạy vô hạn.

### Bước 3: Nâng cấp tín hiệu Abort lên Force Kill (`SIGKILL`)
Cập nhật xử lý action `abort` tại API điều khiển scheduler (`service_ops/views/scheduler.py`):
* Thay đổi tham số revoke: `celery_app.control.revoke(..., terminate=True, signal='SIGKILL')`.
* Tín hiệu `SIGKILL` là bắt buộc đối với hệ điều hành, lập tiếp chấm dứt tiến trình con của Celery đang chạy tác vụ kẹt mà không cần chờ tiến trình phản hồi.
* Khi tiến trình con bị kill, scheduler dọn dẹp định kỳ (`reconcile_stale_running_service_run_logs`) sẽ nhận thấy task ID không còn sống, tự động chuyển trạng thái DB sang `failed`, xóa cache marker khóa và mở lại hệ thống.

---

## 3. Liên hệ với tab Tổng quan (Overview Tab)

* Tab **Tổng quan** hiển thị trạng thái động của các tác vụ hệ thống thông qua `Scheduler Catalog`.
* Khi task bị kẹt ở backend, catalog sẽ liên tục ghi nhận trạng thái là `running` (đang chạy) hoặc `degraded` (chạy quá giờ). Do marker `inflight` trong Redis cache vẫn tồn tại, hệ thống sẽ chặn không cho phép kích hoạt chạy lại thủ công.
* Sau khi triển khai các bước khắc phục trên:
  * Nếu task bị lỗi timeout hoặc bị người vận hành bấm **Abort**, tiến trình con bị hủy ngay lập tức, DB chuyển sang `failed`, cache bị xóa.
  * Tab Tổng quan sẽ cập nhật tức thì trạng thái của job thành `idle` hoặc `failed`, mở khóa nút **Run Now** để người vận hành có thể tái khởi động dịch vụ sạch sẽ.
