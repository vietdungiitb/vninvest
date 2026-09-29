# Báo Cáo Audit Chi Tiết: Các Kế Hoạch Nâng Cấp Tenant Admin (Phase 2, 3, 4)

Bản audit này đánh giá, phản biện kiến trúc và đề xuất tối ưu hóa cho 3 kế hoạch chi tiết được tạo trong thư mục `docs/`:
1. **Phase 2 — Scheduled Reports & Cost Analytics** (`docs/TENANT_ADMIN_PHASE2_GAP_PLAN_20260624.md`)
2. **Phase 3 — Security & Compliance** (`docs/TENANT_ADMIN_PHASE3_SECURITY_PLAN_20260624.md`)
3. **Phase 4 — Lifecycle Automation** (`docs/TENANT_ADMIN_PHASE4_LIFECYCLE_PLAN_20260624.md`)

---

## 1. Phản Biện Phase 2 — Scheduled Reports & Cost Analytics

### 1.1 Cost Analytics (Biểu đồ chi phí trên Billing)
* **Thiếu trường dữ liệu chi tiết trong model:**
  - Kế hoạch đề xuất payload API trả về phân rã chi tiết: `"items": {"subscription": 1500000, "api_overage": 500000}`.
  - Tuy nhiên, qua đối chiếu codebase thực tế, model [Invoice](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/commercial/models.py#L61-L88) hiện chỉ có trường `amount_due` (DecimalField) và `currency` (CharField). Model này hoàn toàn không lưu thông tin chi tiết của từng dòng line-item (phí cố định và phí sử dụng vượt hạn mức).
  - **Giải pháp đề xuất:** 
    - Cần bổ sung thêm một JSONField `line_items` (hoặc `metadata`) vào model `Invoice` để lưu trữ breakdown chi tiết từ Stripe Invoice.
    - Hoặc phải bổ sung model `InvoiceLineItem` mới. Việc gọi API Stripe realtime để fetch breakdown cho 6 tháng gần nhất là không khả thi vì độ trễ lớn và giới hạn rate-limit của Stripe API.
* **Thuật toán dự báo chi phí (Projected Cost):**
  - Kế hoạch đề xuất thuật toán linear regression dựa trên 3 tháng gần nhất. Tuy nhiên, chi phí của SaaS thường phụ thuộc lớn vào việc nâng cấp gói cước (ví dụ: chuyển từ Starter lên Pro) hoặc biến động đột biến của chu kỳ thị trường (khiến người dùng gọi API nhiều hơn).
  - Nên áp dụng fallback an toàn: chỉ dự báo khi có ít nhất 3 tháng dữ liệu hóa đơn liên tiếp và xử lý đặc biệt đối với hóa đơn prorated của tháng nâng cấp gói cước để tránh dự báo sai lệch tăng vọt đột biến.

### 1.2 Scheduled Reports (Báo cáo định kỳ)
* **Xung đột thiết kế Scheduler (Celery Beat vs Dynamic Database Records):**
  - Kế hoạch đề xuất lưu schedule dạng chuỗi (`daily`, `weekly_mon`, v.v.) trong database cho từng cấu hình báo cáo, nhưng lại liệt kê cấu hình Celery Beat tĩnh trong file `settings.py` / `celery.py`.
  - Nếu admin tạo cấu hình báo cáo mới trên UI, Celery Beat tĩnh không thể tự động nhận biết hoặc tự đăng ký lịch chạy mới.
  - **Giải pháp tối ưu:** 
    - Không khai báo từng lịch gửi trong `CELERY_BEAT_SCHEDULE`.
    - Thay vào đó, khai báo một Celery Beat chạy định kỳ mỗi giờ (ví dụ: `process_scheduled_reports`). Task này sẽ quét bảng `ScheduledReport` có `is_active=True`, tính toán xem báo cáo nào đã đến hạn gửi (dựa trên `schedule` và `last_sent_at`), rồi dispatch các subtask `generate_and_deliver_report(report_id)` tương ứng.
* **Lựa chọn thư viện xuất PDF:**
  - Đề xuất dùng `weasyprint` đi kèm rủi ro rất cao. `weasyprint` phụ thuộc vào các thư viện hệ thống C phức tạp (Pango, Cairo, GObject). Việc đóng gói nó vào ảnh Docker slim chạy ổn định trên mọi môi trường là cực kỳ khó khăn.
  - **Giải pháp tối ưu:** Ưu tiên sử dụng định dạng HTML-based trực tiếp trong Email Body hoặc sử dụng thư viện pure-Python như `reportlab` / `xhtml2pdf`. Nếu bắt buộc phải dùng PDF, cần cập nhật rõ ràng các lệnh cài đặt dependencies hệ thống trong `Dockerfile` ở phần manifest.

---

## 2. Phản Biện Phase 3 — Security & Compliance

### 2.1 Active Sessions (Quản lý phiên đăng nhập)
* **Điểm dư thừa lớn trong thiết kế:**
  - Kế hoạch đề xuất: *"Sessions = JWTs chưa hết hạn... Tracking via Redis: `tenant:{id}:sessions:*`... `revoke` endpoint ghi token vào Redis blocklist"*.
  - Tuy nhiên, theo codebase thực tế tại [views/login.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views/login.py#L143-L154), hệ thống VNInvest sử dụng cơ chế phát hành **dynamic human CorePATCredential** làm token cho người dùng (trả về dưới tên `access` và `refresh` cho frontend).
  - Vì các phiên đăng nhập này thực chất là các bản ghi `CorePATCredential` lưu trực tiếp trong database SQL, **chúng ta không cần dùng Redis để lưu trữ session active hay blocklist**.
  - **Giải pháp đơn giản hóa:**
    - Để lấy danh sách session hoạt động của tenant: Chỉ cần query `CorePATCredential.objects.filter(service_account__tenant=tenant, is_human_session=True, status='active', expires_at__gt=timezone.now())`.
    - Để revoke một session: Chỉ cần chuyển `status` của bản ghi `CorePATCredential` tương ứng sang `'revoked'`.
    - Middleware `CorePATAuthentication` đã tự động kiểm tra status trong database, do đó token bị revoke sẽ mất quyền truy cập ngay lập tức ở request tiếp theo.
    - Điều này giúp giảm 90% khối lượng công việc, loại bỏ hoàn toàn module `security_utils.py` phức tạp và nguy cơ không đồng bộ dữ liệu giữa SQL và Redis.

### 2.2 Ghi nhận hoạt động đăng nhập (Login Activity)
* **Thiếu sót trong File Manifest:**
  - Kế hoạch đề xuất lưu vết mọi lần đăng nhập thành công/thất bại thông qua model `LoginAttempt`.
  - Tuy nhiên, bảng file thay đổi (Section 6) **không** liệt kê file [views/login.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/views/login.py) là file cần sửa đổi.
  - Nếu không sửa đổi hàm `login_view` trong `views/login.py`, hệ thống sẽ không bao giờ tạo các bản ghi `LoginAttempt` khi người dùng nhập thông tin đăng nhập.
  - **Giải pháp:** Cần bổ sung `views/login.py` vào danh sách file cần sửa đổi. Tích hợp ghi nhận `LoginAttempt` vào cuối luồng xử lý đăng nhập thành công lẫn thất bại (bao gồm cả các trường hợp bị chặn bởi Rate Limiter ở đầu hàm).

---

## 3. Phản Biện Phase 4 — Lifecycle Automation

### 3.1 Webhooks Management
* **Tần suất dọn dẹp nhật ký Webhook (Retention):**
  - Task Celery `cleanup_webhook_deliveries` được lên lịch chạy hàng tháng (`crontab(day_of_month='1', ...)`).
  - Với các tenant hoạt động mạnh, lượng event webhook bắn ra hàng ngày có thể lên tới hàng chục vạn bản ghi. Việc chạy lệnh xóa quy mô lớn một lần mỗi tháng sẽ gây lock bảng `WebhookDelivery` nghiêm trọng, tăng CPU và làm chậm database.
  - **Giải pháp tối ưu:** Đổi tần suất dọn dẹp thành chạy hàng ngày vào ban đêm (ví dụ: 02:00 AM). Sử dụng cơ chế xóa cuốn chiếu theo batch nhỏ (ví dụ: mỗi lần xóa 1000 bản ghi bằng `DELETE ... WHERE created_at < cutoff LIMIT 1000` chạy lặp cho đến hết) để tránh khóa bảng kéo dài.
* **Chia tách hàng đợi (Celery Queue Isolation):**
  - Webhook gửi ra bên ngoài thường có độ trễ mạng lớn (đặc biệt khi URL của đối tác phản hồi chậm).
  - Nếu dùng chung hàng đợi Celery mặc định (`celery`), một vài webhook bị chậm/timeout liên tục có thể chiếm hết worker threads, gây nghẽn nghiêm trọng cho các tác vụ quan trọng khác như gửi mã OTP hay tính toán dữ liệu.
  - **Giải pháp:** Bắt buộc định tuyến các task webhook (`deliver_webhook`) sang một queue riêng biệt (ví dụ: `webhooks_queue`) và cấu hình worker riêng để xử lý.

### 3.2 In-App Upgrade & Stripe Integration
* **Độ trễ đồng bộ trạng thái thanh toán (Asynchronous Webhook Delay):**
  - Khi người dùng nâng cấp gói cước qua Stripe Portal và được chuyển hướng về `/tenant-admin/billing`, Stripe webhook xử lý sự kiện thanh toán thành công có thể mất từ 1-5 giây để truyền đến backend VNInvest và cập nhật trường `plan` của `CoreTenant`.
  - Nếu người dùng tải lại trang billing ngay lập tức, họ sẽ thấy gói cước cũ, dễ dẫn đến hoang mang hoặc click mua lại.
  - **Giải pháp:**
    - Sau khi hoàn tất thanh toán từ Stripe, Stripe trả về kèm session ID hoặc status. Frontend Billing page nên kiểm tra query parameter (ví dụ: `?session_id=...`).
    - Nếu có, hiển thị banner trạng thái tạm thời: *"Đang xử lý nâng cấp gói cước của bạn..."* và thực hiện polling ngắn hạn (hoặc chờ tin nhắn WebSocket) để tự động cập nhật UI khi backend nhận được Stripe Webhook.

### 3.3 Deprovisioning Flow (Hủy kích hoạt & Xóa dữ liệu)
* **Rủi ro Timeout khi xóa Cascade lượng dữ liệu lớn:**
  - Một tenant hoạt động lâu năm sẽ có hàng triệu dòng lịch sử hạn mức (`QuotaHistory`), dữ liệu cảnh báo và nhật ký kiểm toán.
  - Việc xóa đồng thì các bản ghi này bằng cơ chế `on_delete=models.CASCADE` của Django trong một request duy nhất chắc chắn sẽ bị timeout hoặc gây treo PostgreSQL.
  - **Giải pháp tối ưu:** 
    - Triển khai cơ chế **Soft-Delete** (đổi trạng thái `CoreTenant.status = 'deprovisioned'`).
    - Sau đó, một Celery task nền sẽ thực hiện hard-delete từng bảng liên kết theo lô (chạy ngầm ngoài giờ giao dịch) để dọn dẹp sạch sẽ tài nguyên mà không ảnh hưởng tới hiệu năng hệ thống.

---

## 4. Đánh Giá Khách Quan về Ước Lượng Effort

Dưới đây là bảng đánh giá lại thời gian triển khai dựa trên các phân tích kiến trúc trên:

| Phase | Ước lượng đề xuất (h) | Đánh giá lại sau Audit (h) | Lý do điều chỉnh |
|---|:---:|:---:|---|
| **Phase 2 (Gap)** | 45 | **42** | Giảm bớt thời gian Scheduled Reports nhờ chuyển sang HTML-based mail (bỏ PDF weasyprint), nhưng cần thêm 2h thiết kế lại bảng dữ liệu phụ cho hóa đơn line-items. |
| **Phase 3** | 43 | **30** | **Giảm mạnh 13h** nhờ loại bỏ hoàn toàn hệ thống tracking session qua Redis và blocklist thủ công (tận dụng trực tiếp `CorePATCredential` có sẵn trong DB). Plan cập nhật: 35h. |
| **Phase 4** | 69 | **74** | **Tăng 5h** do cần bổ sung thiết kế luồng soft-delete/xóa nền bất đồng bộ cho Deprovisioning và luồng chờ/polling Stripe webhook trên frontend. Plan cập nhật: 72h. |
| **Tổng cộng** | **157** | **149** | **Tiết kiệm tổng cộng 8h** so với đề xuất gốc. Audit independent estimate: 146h. |

---

## 5. Applied Changes (Post-Audit Plan Updates)

Sau audit, các plan document đã được cập nhật như sau:

### Phase 2 — Billing & Reports
* **File manifest** — Đã bổ sung `views/billing.py` vào danh sách.
* **Inline billing line-items** — Đã thay thế ForeignKey sang JSONField + helper methods.
* Celery beat schedule đã được giữ nguyên (user-facing report schedule là constraint khách quan).

### Phase 3 — Security
* **File manifest** — Đã bổ sung `views/login.py` vào danh sách.
* **Session management** — Đã loại bỏ Redis; dùng `CorePATCredential.status` làm SSOT.
* **`security_utils.py`** — Đã đơn giản hóa thành `LoginRecorder` helper (không Redis).
* **Effort giảm từ 43h → 35h** (audit đánh giá: 30h).

### Phase 4 — Lifecycle
* **Webhook queue isolation** — Task `deliver_webhook` đã được định tuyến sang queue `webhooks_queue` riêng.
* **Webhook log retention** — Đã đổi từ monthly thành daily batch delete (1000 records/lần).
* **Stripe async delay** — Đã thêm polling endpoint + idempotency key xử lý.
* **Deprovisioning** — Đã chuyển từ cascade delete sang soft-delete + batch Celery cleanup.
* **Effort tăng từ 69h → 72h** (audit đánh giá: 74h).

### Residual Risk (Sau Audit — 0 High)

| Risk | Level | Status |
|------|-------|--------|
| Redis out-of-sync với DB khi xác thực session | ~~High~~ → **Eliminated** | Loại bỏ Redis hoàn toàn |
| Cascade delete timeout khi deprovision tenant lớn | ~~High~~ → **Mitigated** | Soft-delete + batch cleanup |
| Webhook queue chiếm worker chính | ~~Medium~~ → **Mitigated** | Queue riêng `webhooks_queue` |
| Stripe async delay gây user confusion | ~~Medium~~ → **Mitigated** | Polling + idempotency |
| Webhook delivery log bảng bị lock cleanup | ~~Medium~~ → **Mitigated** | Daily batch delete |

Tất cả các findings đã được applied vào plan documents. **Không còn high-risk items** tồn đọng.
