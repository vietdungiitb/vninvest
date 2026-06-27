# YÊU CẦU SỬA ĐỔI ĐỐI VỚI ĐỘI PHÁT TRIỂN THƯ VIỆN VNBROKER
**Mã tài liệu:** VNBROKER-REQ-TIMEOUT-20260627  
**Người yêu cầu:** Hệ thống vninvest  
**Mục tiêu:** Loại bỏ hoàn toàn lỗi kẹt tiến trình I/O socket do thiếu timeout trong thư viện `vnbroker` (v1.1.0 và các phiên bản tiếp theo).

---

## 1. Các điểm phát hiện lỗi thiếu timeout trong vnbroker (Phiên bản v1.1.0)

Qua rà soát mã nguồn thực tế của thư viện `vnbroker` trong môi trường cài đặt, chúng tôi phát hiện nhiều vị trí gọi request mạng trực tiếp mà không thiết lập tham số `timeout`:

### Hạng mục A: Các Explorers thông tin thị trường
Các API này gọi request trực tiếp thông qua thư viện `requests.get` hoặc `requests.post` nhưng bỏ qua tham số `timeout`:
1. **`vnbroker/explorer/misc/exchange_rate.py` (Dòng 29):**
   ```python
   response = requests.get(url)  # Thiếu timeout!
   ```
2. **`vnbroker/explorer/misc/gold_price.py` (Dòng 45 & 87):**
   ```python
   response = requests.post(url, headers=headers, data=payload)  # Thiếu timeout!
   # ...
   response = requests.get(url)  # Thiếu timeout!
   ```

### Hạng mục B: DNSE Connector (`connector/dnse/trade.py`)
Mã nguồn gọi API giao dịch và thông tin tài khoản DNSE sử dụng trực tiếp module `requests` và không cấu hình timeout ở rất nhiều dòng (mặc dù cấu hình http_client có trường timeout):
* **`vnbroker/connector/dnse/trade.py` (Dòng 285, 340, 371, 405, 441, 473, 577, 621, 665, 701, 731, 866, 890):**
  * Ví dụ dòng 285: `response = requests.get(url, headers=headers)`
  * Ví dụ dòng 340: `response = requests.post(url, headers=headers, json=payload)`
  * Các dòng này nên sử dụng `self.http_client` thay vì gọi trực tiếp `requests.get(...)` / `requests.post(...)`, hoặc bắt buộc phải bổ sung giá trị timeout mặc định lấy từ cấu hình connector.

---

## 2. Quy chuẩn bắt buộc đối với đội ngũ phát triển vnbroker

Đội ngũ phát triển `vnbroker` cần tuân thủ các quy tắc sau khi phát hành phiên bản tiếp theo (v1.2.0 hoặc patch release):

### Quy tắc 1: Không được phép gọi HTTP Request mà không có Timeout
* Bất kỳ dòng lệnh nào sử dụng `requests.get`, `requests.post`, `requests.request`, `httpx.get`, `httpx.post`, `httpx.Client`, `httpx.AsyncClient` **bắt buộc** phải truyền tham số `timeout`.
* Đối với `requests`:
  ```python
  # Khuyến nghị truyền tuple (connect_timeout, read_timeout)
  response = requests.get(url, headers=headers, timeout=(10.0, 30.0))
  ```
* Đối với `httpx`:
  ```python
  # Khai báo timeout rõ ràng
  response = httpx.get(url, timeout=30.0)
  ```

### Quy tắc 2: Đồng bộ hóa cấu hình Timeout từ Settings
* Thư viện `vnbroker` đã có class cấu hình trong `vnbroker/core/settings.py` (e.g. `self.timeout = int(os.getenv("VNBROKER_HTTP_TIMEOUT", 30))`).
* Các connectors và explorers cần kế thừa và áp dụng cấu hình này làm giá trị mặc định cho tham số `timeout` của tất cả các kết nối mạng:
  ```python
  from vnbroker.core.settings import settings as vnbroker_settings
  
  # Sử dụng cấu hình mặc định
  timeout_val = getattr(vnbroker_settings, 'timeout', 30)
  response = requests.get(url, timeout=timeout_val)
  ```

### Quy tắc 3: Bắt buộc cấu hình Client/Session Timeout ở cấp độ Module
* Khi khởi tạo `requests.Session` hoặc `httpx.Client`, bắt buộc phải cấu hình cấu trúc timeout cho toàn bộ session thay vì để mặc định:
  ```python
  # Với httpx Client
  self.client = httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0, read=45.0))
  ```

---

## 3. Khuyến nghị Kỹ thuật bổ sung cho vnbroker

1. **Thử nghiệm ngắt mạng (Chaos Testing):** Đội ngũ QA của `vnbroker` cần bổ sung ca kiểm thử tích hợp (integration tests) mô phỏng server API bị treo (ví dụ sử dụng các công cụ mock HTTP chậm hoặc proxy giới hạn băng thông) để kiểm tra xem thư viện có thoát ra và bắn lỗi kịp thời thay vì treo vĩnh viễn tiến trình.
2. **Cơ chế Retry thông minh:** Đi kèm với Timeout, hãy triển khai cơ chế retry với exponential backoff để tự động khôi phục khi gặp lỗi mạng tạm thời, thay vì trả về lỗi ngay lập tức.
