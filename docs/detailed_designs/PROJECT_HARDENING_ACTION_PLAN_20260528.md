# KẾ HOẠCH HÀNH ĐỘNG CỦNG CỐ KIẾN TRÚC BACKEND (SAAS HARDENING SUB-PLAN)
**Mã tài liệu:** `VNI-PAP-20260528-v3.2`  
**Dự án:** VNInvest Enterprise SaaS Platform  
**Thư mục lưu trữ:** `docs/detailed_designs/`  
**Trạng thái:** AUDIT-SAFE & EXECUTION-READY (VERIFIED ANCHORS, GREEN BUILD, LOCKED CORE-ENV PREREQUISITES)  

---

## 1. MỐI LIÊN HỆ KIẾN TRÚC & PHẠM VI ÁP DỤNG (ARCHITECTURAL CONTEXT)

> [!IMPORTANT]
> **RANH GIỚI TÀI LIỆU (READ-FIRST BOUNDARY)**
> - Tài liệu này **không thay thế** lộ trình di trú tổng thể được quy định tại [SAAS_ARCHITECTURE_AUDIT_AND_CUTOVER_ROADMAP_20260522.md](file:///c:/Mujoco%20Projects/vninvest/docs/SAAS_ARCHITECTURE_AUDIT_AND_CUTOVER_ROADMAP_20260522.md).
> - Tài liệu này được định nghĩa là một **Hardening Sub-plan** (Kế hoạch củng cố kỹ thuật tầng sâu) nằm dưới roadmap tổng thể, tập trung dọn dẹp nợ kỹ thuật của các tệp lớn, xử lý cô lập dữ liệu backend và chuẩn hóa bảo mật.
> - Điểm nghẽn cutover chính thức của SaaS (như thiếu canonical workspace subaccount API, UI/build ownership chuyển dịch từ frontend cũ) vẫn tuân thủ theo đúng roadmap gốc và được thực thi song song.
> - Bộ tài liệu bàn giao thực thi đầy đủ cho sub-plan này được chuẩn hóa cùng thư mục tại `docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md` và 11 tài liệu kèm theo cùng prefix `PROJECT_HARDENING_BACKEND`.

---

## 2. GIAI ĐOẠN 1: CỦNG CỐ KIẾN TRÚC & SỬA CHỮA GAPS BẮT BUỘC (TUẦN 1 - TUẦN 4)

**Mục tiêu**: Hoàn tất di trú dữ liệu backend, thực thi cô lập Tenant tuyệt đối ở tầng cơ sở dữ liệu của `user_workspace`, kiểm chứng rate limiting và refactor các tệp cồng kềnh (Fat Files) theo chỉ số đo lường thực tế.

### Lát cắt 1.1: Hoàn Thành Database Migration Cutover & Enforce Tenant Isolation (Tuần 1 - Tuần 2)
* **Thực thi di trú & Shutdown Legacy DB**:
  * Thực thi kịch bản di trú dữ liệu toàn phần từ PostgreSQL 15 (`vninvest` legacy) sang PostgreSQL 16 (`vninvest_core` SaaS native) trên môi trường Staging/Production theo đúng schema SSOT.
  * Tắt hoàn toàn container `vninvest-backend` (legacy Django) và container `vninvest-db` (Postgres 15). Giải phóng tối thiểu **2.5GB RAM** trên hệ thống.
* **Hardening Tenant Isolation (Đặc tả chính xác phạm vi và line anchors trong `user_workspace/models.py`)**:
  * *Phạm vi thực tế:* Trong phân hệ `commercial/`, các model `Subscription` và `Invoice` đã được thiết kế bắt buộc trường `tenant` từ trước (`models.py:11, 21, 61, 70`). Nullable gap thực tế chỉ nằm ở phân hệ `user_workspace/` và ảnh hưởng đến toàn bộ 6 thực thể dưới đây.
  * *Hành động:* Tiến hành chạy lệnh migration cơ sở dữ liệu để sửa đổi cột `tenant_id` từ `null=True` sang **`NOT NULL`** tại:
    1. **`Portfolio`**: tenant nullable tại `models.py:34`.
    2. **`Transaction`**: tenant nullable tại `models.py:56` và `models.py:76`.
    3. **`Watchlist`**: tenant nullable tại `models.py:129`.
    4. **`TrackedSymbol`**: tenant nullable tại `models.py:193`.
    5. **`PriceAlert`**: bắt đầu ở `models.py:245` với tenant nullable tại `models.py:273`.
    6. **`SubAccount`**: tenant nullable tại `models.py:328` và `models.py:348`.
* **Chính sách xử lý bản ghi mồ côi (Orphan Records Rules - Bảo vệ tuyệt đối)**:
  * **TỐI KỊ KỸ THUẬT**: Tuyệt đối không tự động gán dữ liệu mồ côi về bất kỳ `system_tenant` hay tài khoản mặc định nào. Việc tự động ánh xạ này sẽ phá hủy hoàn toàn nguyên tắc Tenant Isolation khắt khe của `CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md:27` và có nguy cơ tạo ra ô nhiễm chéo dữ liệu giữa các Tenant.
  * **QUY TRÌNH QUARANTINE**:
    1. Viết script kiểm tra tiền di trú (Pre-migration audit) quét toàn bộ 6 bảng dữ liệu: `Portfolio`, `Transaction`, `Watchlist`, `TrackedSymbol`, `PriceAlert`, và `SubAccount`.
    2. Nếu phát hiện dữ liệu mồ côi ở bất kỳ bảng nào, **quarantine (cô lập)** dữ liệu lỗi này ra một bảng tạm độc lập (`quarantine_user_workspace_records`) để phục vụ Operator đối soát thủ công, đồng thời từ chối (reject) chạy migration cho đến khi dữ liệu được làm sạch triệt để.

### Lát cắt 1.2: API Security & Rate Limiting Hardening (Tuần 2)
* **Chuẩn hóa App-level Throttling**:
  * *Thực tế codebase:* Các auth endpoints cốt lõi trong `views_auth.py` hiện đã được thiết kế sẵn cơ chế rate limiting và kiểm chứng bằng test suite chuyên biệt trong `test_rate_limiting.py` (`views_auth.py:322, 363, 650, 663, 1059, 1075` và `test_rate_limiting.py:26, 113, 199`).
  * *Hành động:* Thực hiện audit, rà soát lại toàn bộ mã nguồn của các view auth này để đảm bảo decorator throttling được gắn đúng cách, không bị bỏ sót khi có các sửa đổi hoặc refactor.
* **Bổ dung Gateway-level Throttling**:
  * *Thực tế codebase:* Tập tin cấu hình Nginx (`nginx.conf` và `nginx-opencore.conf`) hiện chưa được kích hoạt cơ chế throttling ở tầng gateway.
  * *Hành động:* Thiết lập thuộc tính `limit_req_zone` và `limit_req` tại file cấu hình Nginx để lọc và từ chối các yêu cầu spam tần suất lớn từ cùng một địa chỉ IP (DDoS protection tầng Gateway).

### Lát cắt 1.3: Refactor Các Tệp Cồng Kềnh Theo Chỉ Số Đo Lường Thực Tế (Tuần 3 - Tuần 4)
Để giảm nợ kỹ thuật và cải thiện khả năng bảo trì hệ thống, thực hiện phân tách các tệp cồng kềnh dựa trên mốc đo lường dòng code thực tế hiện tại:

1. **`identity_access/views_auth.py` (Hiện trạng: 995 dòng)**:
   * *Hành động:* Tách biệt các luồng logic đăng ký, đổi mật khẩu và đăng nhập thông qua Google OAuth ra các controller chuyên biệt trong thư mục `identity_access/views/` nhằm giữ kích thước tệp dưới **600 dòng**.
2. **`service_ops/views/dataops.py` (Hiện trạng: 1169 dòng)**:
   * *Hành động:* Phân tách logic xử lý backfill và đồng bộ hóa ra lớp Service độc lập (`service_ops/services/backfill_service.py`), Views chỉ đóng vai trò nhận tham số và kiểm tra quyền.
3. **`packages/web/src/adapters/coreApiAdapter.js` (Hiện trạng: 1143 dòng)**:
   * *Hành động:* Phân rã thành các client API chuyên biệt theo Domain đặt tại `packages/web/src/adapters/core/` (`auth.js`, `billing.js`, `market.js`), giữ tệp cũ làm Facade re-export để giữ tương thích ngược.
4. **`packages/web/src/pages/AlertCenterPage.js` (Hiện trạng: 1645 dòng)**:
   * *Hành động:* Phân rã giao diện Alert Center thành các sub-components độc lập dưới 400 dòng trong thư mục `components/alert-center/`.

---

## 🚦 CỔNG KIỂM SOÁT CHẤT LƯỢNG 1 (QUALITY GATE 1 - EXPENDITURE THRESHOLD)

Quality Gate 1 (QG-1) đóng vai trò là chốt chặn kỹ thuật đối với nhánh **Hardening & Refactor Backend**. Cổng này **không block** tiến trình phát triển UI hoặc build/deploy cutover của roadmap tổng thể, nhưng là điều kiện bắt buộc để khởi động Phase 2 (Greenfield commercial features).

* **Đồng nhất Test Runner (Đường dẫn chạy chính xác)**:
  * Tránh áp đặt tuyệt đối `pytest` làm runner duy nhất cho toàn bộ backend khi repo chưa cấu hình baseline pytest thống nhất ở root.
  * **Bootstrap prerequisite bắt buộc cho Core Backend env**:
    * Dùng Python environment đã được đồng bộ dependency theo `packages/core/backend/requirements.txt`.
    * Nếu dùng shared venv `backend/.venv`, phải bootstrap trước bằng lệnh:
      ```powershell
      & "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" -m pip install -r packages/core/backend/requirements.txt
      ```
    * Nếu bootstrap dependency chạm private package (`vnbroker`, `stockchart`), phải chạy trong môi trường đã được cấp `VNBROKER_GITHUB_TOKEN` hoặc lane build nội bộ tương đương.
    * Tối thiểu phải khóa các biến môi trường runtime trước khi gọi test gate:
      ```powershell
      $env:DJANGO_DEBUG='true'
      $env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,testserver'
      ```
  * **Chốt công cụ chạy test chính thức**: Sử dụng bộ test runner mặc định của Django qua lệnh (`manage.py` thực tế nằm trực tiếp dưới thư mục backend `packages/core/backend/`):
    ```bash
    python packages/core/backend/manage.py test identity_access market_data user_workspace service_ops
    ```
* **Kiểm tra tính toàn vẹn của Frontend (Web build & runtime checks)**:
  * Đảm bảo các hoạt động refactor adapters và components của `packages/web` không làm vỡ quá trình đóng gói ứng dụng.
  * Local host build lane hiện bám `frontend/package.json`, vốn phụ thuộc sibling source `../../stockchart/...`; do đó lane build này chỉ được coi là hợp lệ khi môi trường đã có sibling repo `stockchart` hoặc workspace build image tương đương.
  * **Chốt công cụ đóng gói chính thức (100% Green Build verified)**:
    ```bash
    npm --prefix packages/web run build-community
    ```

---

## 3. GIAI ĐOẠN 2: PHÁT TRIỂN TÍNH NĂNG MỚI (TUẦN 5 - TUẦN 8)

*Điều kiện kích hoạt: Quality Gate 1 (QG-1) đã được xác nhận đạt trạng thái PASS.*

> [!NOTE]
> **ĐÁNH GIÁ THỰC TẾ NỖ LỰC (GREENFIELD DEVELOPMENT)**
> - Phân hệ Billing và Outbound Notification thực chất là một chương trình phát triển mới hoàn toàn (**Greenfield**) có quy mô rất lớn, không phải là phần mở rộng đơn giản của cấu trúc runtime hiện tại.
> - *Thực trạng commercial:* Phân hệ `commercial/` hiện tại đã có sẵn nền tảng subscription, quota (`QuotaRecord` tại `models.py:38`), hóa đơn (`Invoice` tại `models.py:61`) và api route (`urls.py:7`). Phần greenfield thực tế cần tập trung phát triển mới ở đây là **Cổng thanh toán VNPay và webhook xử lý IPN**.
> - *Thực trạng notifications:* Phân hệ `signal_intelligence/` hiện mới chỉ phục vụ hiển thị in-app thông qua WebSocket (`delivery_service.py` và `models.py:266, 301`). Outbound Notification (Email/FCM/WebPush) thực chất là viết mới 100% tầng phân phối tin nhắn.

### Lát cắt 2.1: Tích Hợp Cổng Thanh Toán VNPay & Quản Lý Subscription (Tuần 5 - Tuần 6)
* **Mô tả công việc**:
  * Phát triển các thực thể `PaymentTransaction` và `VNPayIPNLog` lưu lịch sử hóa đơn và webhook.
  * Xây dựng service sinh URL thanh toán có chữ ký bảo mật **HMAC-SHA512** gửi sang VNPay.
  * Viết view tiếp nhận webhook IPN từ VNPay (`/api/v1/commercial/payments/vnpay-ipn/`) sử dụng khóa hàng `select_for_update()` chống Race Condition.
  * Cấu hình các Celery Beat tasks chạy định kỳ hàng giờ để quản lý tự động vòng đời subscription (gia hạn, trễ hạn dunning, hạ cấp gói cước).

### Lát cắt 2.2: Outbound Notification Pipeline Đa Kênh (Tuần 7)
* **Mô tả công việc**:
  * Xây dựng module Firebase Cloud Messaging (FCM) để gửi thông báo đẩy đến ứng dụng di động di động (iOS/Android).
  * Triển khai giao thức VAPID keys (`pywebpush`) và Service Worker trên frontend để hiển thị thông báo đẩy trên trình duyệt của máy tính (Browser WebPush).
  * Tích hợp gửi email giao dịch, hóa đơn tự động qua SMTP/Gmail API động.

### Lát cắt 2.3: AI Advisory Cost Control & Semantic Cache (Tuần 8)
* **Mô tả công việc**:
  * Áp dụng quota giới hạn số lượt gọi AI tư vấn trên từng tài khoản Tenant dựa trên Plan (Starter, Pro, Enterprise).
  * Triển khai bộ nhớ đệm ngữ nghĩa (**Semantic Cache**) trên Redis để lưu trữ kết quả phân tích LLM trong 24 giờ. Trả kết quả trực tiếp từ Redis đối với các yêu cầu phân tích tương tự để tiết kiệm chi phí gọi API OpenAI/Claude.
  * Cấu hình **Multi-LLM Router** hỗ trợ tự động failover sang các mô hình dự phòng giá rẻ (GPT-4o-mini hoặc Gemini Flash) khi LLM chính gặp sự cố.

---

## 4. PHƯƠNG ÁN PHÒNG NGỪA RỦI RO & BẢO VỆ HỆ THỐNG (SAFETY & ROLLBACK)

### 4.1 Backup & Rollback trong Di trú Cơ sở Dữ liệu (Giai đoạn 1)
* **Rủi ro lớn nhất**: Quá trình thay đổi ràng buộc cột `tenant` thành `NOT NULL` bị từ chối do tồn tại dữ liệu thô không có tenant hoặc sai cấu trúc.
* **Biện pháp phòng ngừa**: Viết script quét toàn bộ DB tìm các bản ghi mồ côi (không có tenant hợp lệ) của cả 6 bảng dữ liệu đã nêu ở Slice 1.1 và thực hiện quarantine ra ngoài bảng tạm trước khi chạy migration.
* **Kịch bản Rollback**:
  * Thực hiện sao lưu snapshot cơ sở dữ liệu ngay trước thời điểm bảo trì (maintenance window). Nếu quá trình migrate lỗi, khôi phục lại DB từ file dump:
    ```bash
    pg_restore -U core_user -d vninvest_core /backups/pre_migration_snap.dump
    ```

### 4.2 Reconciliation & Webhook Replay trong Thanh Toán (Giai đoạn 2)
* **Rủi ro lớn nhất**: VNPay IPN webhook bị lỗi mạng không gửi đến được hệ thống, dẫn đến việc khách hàng đã bị trừ tiền ngân hàng nhưng tài khoản VNInvest chưa được nâng cấp.
* **Biện pháp phòng ngừa**: Lưu trữ toàn bộ query parameters thô từ VNPay vào bảng nhật ký bất biến `VNPayIPNLog` đầu tiên, độc lập với kết quả xử lý giao dịch.
* **Kịch bản xử lý**: 
  * Cung cấp tập lệnh chạy ngầm (Celery beat) đối soát chéo gọi API truy vấn giao dịch của VNPay (`vnpay_query_transaction`) sau 30 phút đối với các giao dịch PENDING. Cho phép vận hành viên (Operator) nhấn nút "Replay Webhook" từ admin panel để xử lý bù giao dịch dựa trên log thô an toàn.
