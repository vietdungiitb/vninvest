# [DEPRECATED — Xem plan mới] Kế Hoạch Porting & Nâng Cấp Toàn Diện: SOC DataOps Tab (SaaS Native)

> ⚠️ Tài liệu này đã được thay thế bởi `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md` sau khi tiếp nhận 10 điểm phản biện (REVIEW) + 4 điểm phản biện bổ sung (triangulation). Vui lòng tham khảo bản consolidated.

Tài liệu này lưu trữ báo cáo rà soát toàn bộ các chức năng legacy cũ và kế hoạch triển khai porting 1:1, nâng cấp UI/UX cho màn hình **DataOps** thuộc **Service Operations Center (SOC)** sang giao diện mới SaaS native của dự án VNInvest.

---

## 1. Rà Soát Chi Tiết Các Chức Năng Legacy & Ánh Xạ API

Giao diện legacy cũ chứa **5 subtabs** chính với các logic backend tương ứng:

| Subtab Legacy | Mô Tả Chức Năng | API Endpoint Backend (`packages/core` / `operator_urls.py`) |
| :--- | :--- | :--- |
| **📦 Kho dữ liệu** | • Thống kê số lượng record, symbols, dates.<br>• Phân bổ record theo năm (DailyPrice).<br>• Bảng Coverage theo nhóm (VN30, HOSE, v.v.).<br>• Thống kê record theo Loại dữ liệu.<br>• Danh sách & Chi tiết Queue Tiers. | • `GET /core/v1/operator/soc/dataops/inventory/`<br>• `GET /core/v1/operator/scraping/dataops/queue-tiers/` |
| **⚡ Điều phối** | • **Backfill Center**: Checkbox datasets, Date range, Mode (missing/force), Run & Active Run Status + Abort.<br>• **Planner Console**: Nhập symbols tự do, Dataset checklist, Preview & Run, Danh sách Planned & Skipped items có phân trang. | • `GET /core/v1/operator/soc/dataops/backfill/runs/`<br>• `POST /core/v1/operator/soc/dataops/backfill/run-now/`<br>• `POST /core/v1/operator/scraping/dataops/planner/preview/`<br>• `POST /core/v1/operator/scraping/dataops/planner/run/`<br>• `POST /core/v1/operator/scraping/dataops/planner/run/<run_id>/abort/` |
| **🔍 Giám sát** | • **Live Matrix Cycle**: Bảng Heatmap trạng thái cào dữ liệu song song (Coordinated Parallel Scraping), chọn Group & Provider, Start/Abort Cycle.<br>• **Observability**: Fail rates (1h/24h), Parity Gates (24h/72h), Retention Health (Deleted, Retained + Biểu đồ deleted rows history), Backlog by dataset/tier, Starvation, Anomaly Guard (gap symbols, hot tier breach). | • `GET /core/v1/operator/scraping/matrix/monitor/`<br>• `POST /core/v1/operator/scraping/matrix/cycles/start/`<br>• `POST /core/v1/operator/scraping/matrix/cycles/<cycle_id>/abort/`<br>• `GET /core/v1/operator/scraping/dataops/observability/`<br>• `GET /core/v1/operator/scraping/dataops/coverage/` |
| **⏰ Lịch chạy** | • Bảng điều khiển quản trị Scheduler, bật tắt job, trigger chạy thử, theo dõi run log lịch sử Celery. | • `GET /core/v1/operator/scraping/dataops/scheduler/plan/`<br>• `GET /core/v1/operator/scraping/dataops/scheduler/health/`<br>• `POST /core/v1/operator/scraping/dataops/scheduler/jobs/<job_key>/actions/` |
| **⚙️ Cấu hình** | • Trình soạn thảo JSON cấu hình runtime DataOps, preview thay đổi, xem log hệ thống (run_logs, audit_trail), dọn log. | • `GET /core/v1/operator/scraping/dataops/runtime-config/`<br>• `POST /core/v1/operator/scraping/dataops/runtime-config/`<br>• `GET /core/v1/operator/soc/dataops/runtime-config/audit/` |

---

## 2. So Sánh Với Các Phần Mềm Thương Mại & Đề Xuất Nâng Cấp

Để trang DataOps của VNInvest vượt trội hơn bản legacy cũ và đạt tiêu chuẩn vận hành thương mại (tương tự **Apache Airflow**, **Snowflake**, và **Datadog**), chúng tôi đề xuất các nâng cấp sau:

1. **Airflow-style Gantt Chart cho Backfill Runs:** 
   * *Legacy:* Chỉ hiển thị danh sách dạng văn bản phẳng các run đang chạy.
   * *Nâng cấp:* Thêm thanh tiến trình mini (progress bar) đổi màu động (Glow) kèm trạng thái Celery Tasks, cho phép theo dõi trực quan các bước Hydrate, Reconcile, và Materialize.
2. **Datadog-style Parity & Retention Health Visualization:**
   * *Legacy:* Chỉ hiển thị số thô.
   * *Nâng cấp:* Tái cấu trúc biểu đồ cột xóa/giữ lại dữ liệu (retention histogram) sử dụng HTML/CSS mượt mà, có chú giải tooltip chi tiết cho từng cột (kích thước dữ liệu trước và sau khi dọn dẹp).
3. **Snowflake-style Data Inventory & Gap Score Heatmap:**
   * *Legacy:* Xem gap dạng danh sách dài.
   * *Nâng cấp:* Bổ sung **Gap Score indicator** dạng nhãn cảnh báo đỏ neon nhấp nháy cho các mã nằm trong diện "Hot Tier Breach" của Anomaly Guard để operator xử lý tức thì.
4. **Unified Control Center for Custom Groups:**
   * *Legacy:* Không quản lý được các nhóm mã tuỳ chỉnh trực tiếp cùng một nơi.
   * *Nâng cấp:* Tích hợp trình quản lý nhóm mã (Custom Symbol Groups CRUD Manager) ngay dưới kho dữ liệu, cho phép thêm nhanh mã và đồng bộ trực tiếp vào danh sách bộ lọc của tab Ops và tab Monitor.

---

## 3. Kế Hoạch Thay Đổi Code Cụ Thể (Proposed Implementation Steps)

Chúng ta sẽ chỉnh sửa các thành phần trong `packages/web` để tích hợp đầy đủ tính năng:

### Component & Context Layer

#### 1. [MODIFY] [DataOpsContext.tsx](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/DataOpsContext.tsx)
* Thêm toàn bộ các state cần thiết cho Live Matrix (cycle_id, status, providers, selected providers, selected groups).
* Thêm action và handler tích hợp:
  * `getSocSymbolGroups()`, `createSocSymbolGroup()`, `deleteSocSymbolGroup()`
  * `getSocMatrixMonitor()`, `startSocMatrixCycle()`, `abortSocMatrixCycle()`
  * `purgeSocDataOpsRunLogs()`
  * `getSocDataOpsRuntimeConfigAudit()`, `previewSocDataOpsRuntimeConfig()`

#### 2. [MODIFY] [SocDataInventorySection.tsx](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/SocDataInventorySection.tsx)
* **Year Distribution Bar Chart:** Thay thế các status badge bằng biểu đồ thanh ngang HTML/CSS hiển thị tỷ lệ % dữ liệu của năm so với năm cao nhất.
* **Coverage by Group Table:** Thiết kế bảng chi tiết hiển thị số lượng record, tỷ lệ bao phủ (emerald/yellow/gray), ngày đầu/cuối và số ngày lịch.
* **Dynamic Data Types:** Grid card hiển thị record thực tế và số mã của từng loại dữ liệu (`inventory.data_types`).
* **Custom Symbol Groups Manager [NEW UI Section]:** Form thêm nhóm mới (Tên, mô tả, danh sách mã) và bảng danh sách nhóm tự chọn có nút xóa.
* **Queue Tiers Accordion:** Port 1:1 danh sách các tier (Hot, Warm, Cold, Recovery) cùng tham số và ví dụ mã.

#### 3. [MODIFY] [SocDataOpsBackfillForm.tsx](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/SocDataOpsBackfillForm.tsx)
* Chia đôi tab Ops thành 2 phần:
  1. **Backfill Center (Bên trái):** Chọn datasets hỗ trợ, chọn Symbol Group (chứa cả predefined & custom groups), nhập Date Range, Mode, Execution và Dry-run. Nút Abort run đang chạy.
  2. **Planner Console (Bên phải):** Khung nhập text mã cổ phiếu, checkbox datasets, Preview & Run planner, Bảng Planned Items và Skipped Items có phân trang đầy đủ.

#### 4. [MODIFY] [SocDataOpsMonitorSection.tsx](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/SocDataOpsMonitorSection.tsx)
* **Live Snapshot Matrix (Phần trên):** Tích hợp trình chọn Providers (toggles), chọn nhóm mã (VN30, HOSE, v.v.), các nút Start/Abort và nhúng component Heatmap [MatrixScrapeMonitor](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/SocMatrixScrapeMonitor.tsx).
* **Parity Gates (24h/72h):** Hiển thị chi tiết tỷ lệ parity, so sánh delta trend, và danh sách các sequence history points mượt mà.
* **Retention Health:** Hiển thị số lượng records đã xóa gần nhất, tỷ lệ xóa trung bình, so sánh trend và **Retention Histogram** vẽ bằng các cột màu amber/emerald tự động co giãn chiều cao theo Peak Deleted.
* **Backlog & Starvation:** Bảng backlog chi tiết theo dataset và theo queue tier, cùng các cảnh báo Starvation Alert.
* **Anomaly Guard:** Panel cảnh báo màu cam neon, hiển thị bảng danh sách mã bị trễ dữ liệu nghiêm trọng (Critical Gap Symbols) và các mã vi phạm chu kỳ Hot Tier (Hot Tier Breach).

#### 5. [MODIFY] [SocDataOpsConfigSection.tsx](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/soc/SocDataOpsConfigSection.tsx)
* Tích hợp tab Lịch sử chạy Celery (Run Logs) có phân trang và Audit Trail nhật ký cấu hình.
* Thêm nút dọn dẹp log (Purge logs) gọi `purgeSocDataOpsRunLogs(50)`.

---

## 4. Kế Hoạch Xác Minh & Đo Lường (Verification Plan)

### Automated Tests
* Chạy build kiểm tra cú pháp và bundle của Vite:
  ```powershell
  npm run build
  ```

### Manual Verification
1. **Kiểm tra Tab Kho dữ liệu (Inventory):**
   * Xác nhận biểu đồ phân bổ năm hoạt động đúng tỉ lệ.
   * Tạo thử 1 Custom Symbol Group có tên `VN_TEST` với các mã `VCB, VNM, FPT`, xác nhận nhóm xuất hiện trong bảng Coverage và có thể xóa đi.
2. **Kiểm tra Tab Điều phối (Ops):**
   * Thử nghiệm nút "Preview Planner" với mã `FPT` cho dataset `daily_prices`. Xác nhận bảng Planned hiển thị đúng 1 dòng với recommended action.
3. **Kiểm tra Tab Giám sát (Monitor):**
   * Xác nhận biểu đồ Retention cột hiển thị đúng tooltip dữ liệu trước/sau dọn dẹp.
   * Thử nghiệm toggle các providers của Matrix và ấn "Bắt đầu chu kỳ", xác nhận Heatmap MatrixScrapeMonitor tải dữ liệu và cập nhật màu sắc các ô trạng thái.
4. **Kiểm tra Tab Cấu hình (Config):**
   * Xác nhận Audit Trail hiển thị đúng actor và hành động cấu hình gần nhất.
   * Nhấn "Dọn log" và xác nhận số lượng logs cũ được cắt bớt về 50.
