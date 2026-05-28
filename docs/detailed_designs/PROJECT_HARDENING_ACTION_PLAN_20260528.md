# KẾ HOẠCH HÀNH ĐỘNG CỦNG CỐ KIẾN TRÚC BACKEND (SAAS HARDENING SUB-PLAN)
**Mã tài liệu:** `VNI-PAP-20260528-v3.2`
**Dự án:** VNInvest Enterprise SaaS Platform
**Thư mục lưu trữ:** `docs/detailed_designs/`
**Trạng thái:** EXECUTED & CODE-ALIGNED (VERIFIED ANCHORS, TENANT ISOLATION DONE, REFACTOR COMPLETE)

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
  * *Hành động:* Thực tế trong code, cột `tenant_id` đã được cấu hình **`null=False`** tại các dòng sau trong `models.py`:
    1. **`Portfolio`**: `models.py:34`.
    2. **`Transaction`**: `models.py:56` và `models.py:76`.
    3. **`Watchlist`**: `models.py:129`.
    4. **`TrackedSymbol`**: `models.py:193`.
    5. **`PriceAlert`**: bắt đầu ở `models.py:245` với tenant tại `models.py:273`.
    6. **`SubAccount`**: tenant tại `models.py:328` và `models.py:348`.
    *(Lưu ý: Migration `0011_enforce_tenant_not_null.py` chỉ có vai trò tạo bảng QuarantineRecord. Quá trình enforce NOT NULL thực sự bằng lệnh `AlterField` được thực thi thông qua migration `0012_enforce_tenant_not_null_real.py` sau khi đã xóa sạch dữ liệu mồ côi.)*
* **Chính sách xử lý bản ghi mồ côi (Orphan Records Rules - Bảo vệ tuyệt đối)**:
  * **TỐI KỊ KỸ THUẬT**: Tuyệt đối không tự động gán dữ liệu mồ côi về bất kỳ `system_tenant` hay tài khoản mặc định nào. Việc tự động ánh xạ này sẽ phá hủy hoàn toàn nguyên tắc Tenant Isolation khắt khe của `CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md:27` và có nguy cơ tạo ra ô nhiễm chéo dữ liệu giữa các Tenant.
  * **QUY TRÌNH QUARANTINE**:
    1. Lệnh kiểm tra tiền di trú (Pre-migration audit) `audit_orphans` đã quét toàn bộ 6 bảng dữ liệu.
    2. Các bản ghi mồ côi đã được xử lý an toàn trước khi chạy migration `0012`.

### Lát cắt 1.2: API Security & Rate Limiting Hardening (Tuần 2)
* **Chuẩn hóa App-level Throttling**:
  * *Thực tế codebase:* Các auth endpoints cốt lõi hiện đã được phân tách và có sẵn cơ chế rate limiting tại `identity_access/views/login.py` và `register.py` (sử dụng cache keys tùy chỉnh), được kiểm chứng trong `test_login_upgrade.py` và `test_rate_limiting.py`. Code hiện đã chạy theo cơ chế throttle chuẩn mực của SaaS.
  * *Hành động:* Các cấu hình limit đều đã được tích hợp chặt chẽ mà không cần dùng đến facade `views_auth.py` cũ.
* **Bổ dung Gateway-level Throttling**:
  * *Thực tế codebase:* Tập tin cấu hình Nginx (`nginx.conf` và `nginx-opencore.conf`) đã được kích hoạt cơ chế throttling ở tầng gateway với `limit_req_zone`, `limit_req` và `limit_req_status 429`.
  * *Hành động:* Tiếp tục duy trì smoke-test cho HTTP 429 và không để refactor cấu hình làm mất gateway abuse-guard.

### Lát cắt 1.3: Refactor Các Tệp Cồng Kềnh Theo Chỉ Số Đo Lường Thực Tế (Tuần 3 - Tuần 4)
Để giảm nợ kỹ thuật và cải thiện khả năng bảo trì hệ thống, thực hiện phân tách các tệp cồng kềnh dựa trên mốc đo lường dòng code thực tế hiện tại:

1. **`identity_access/views_auth.py` (Hiện trạng: 8 dòng, đã thành facade import)**:
   * *Hành động:* Đã tách biệt các luồng logic đăng ký, đổi mật khẩu và đăng nhập ra các controller chuyên biệt trong thư mục `identity_access/views/`.
2. **`service_ops/views/dataops.py` (Hiện trạng: 7 dòng, đã thành facade import)**:
   * *Hành động:* Đã phân tách logic xử lý backfill và đồng bộ hóa ra độc lập.
3. **`packages/web/src/adapters/coreApiAdapter.js` (Hiện trạng: 56 dòng, re-export facade)**:
   * *Hành động:* Đã phân rã thành các client API chuyên biệt theo Domain đặt tại `packages/web/src/adapters/core/`.
4. **`packages/web/src/pages/AlertCenterPage.js` (Hiện trạng: 478 dòng)**:
  * *Hành động:* Đã phân rã phần lớn giao diện Alert Center thành các sub-components và hooks riêng; file page-level hiện vẫn giữ orchestration ở mức 478 dòng nhưng không còn là monolith 1800+ dòng như trước.

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
  * Thực tế code hiện đã có các thực thể `PaymentTransaction`, `VNPayIPNLog`, service ký URL `VNPayService`, và các endpoint `/core/v1/payments/create/`, `/core/v1/payments/vnpay-ipn/`, `/core/v1/payments/status/<txn_ref>/`.
  * View IPN hiện xử lý qua phương thức **GET** và dùng `select_for_update()` để chống race condition khi finalize giao dịch.
  * Phần còn lại của workstream này là reconciliation job (`vnpay_query_transaction`), replay-safe operator flow và lifecycle automation đầy đủ cho subscription.

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
  * Đây hiện là **backlog thiết kế còn lại**. Codebase chưa có evidence hoàn chỉnh cho `vnpay_query_transaction` hoặc nút vận hành viên `Replay Webhook`, nên mọi rollout production phải coi đây là phần cần bổ sung sau foundation hiện tại.`n