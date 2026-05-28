# Technical Audit Report — Project Hardening Backend
**Mã kiểm toán:** `VNI-AUDIT-20260528-v1.0`  
**Ngày**: 2026-05-28  
**Parent**: [docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md)  
**Trạng thái kiểm toán:** **PASS WITH CONDITIONS** (Đủ điều kiện bàn giao cho đội ngũ phát triển và vận hành)

---

## 1. Tổng quan kết quả kiểm toán (Executive Summary)

Quá trình rà soát và kiểm chứng thực tế cho thấy bộ tài liệu bàn giao đã giải quyết triệt để các rủi ro lệch pha kiến trúc (architectural drift) và sự mơ hồ về môi trường chạy (execution ambiguity) của các phiên bản trước. Bộ tài liệu đạt mức độ chi tiết cao, phân rã ranh giới rõ ràng giữa củng cố nền tảng (Giai đoạn 1) và phát triển tính năng mới (Giai đoạn 2), đồng thời đồng bộ hóa hoàn hảo với toàn bộ sổ quản lý thay đổi ở thư mục gốc của kho lưu trữ.

---

## 2. Đánh giá mức độ hoàn thiện của Bộ tài liệu (Doc-Pack Completeness)

Thư mục `docs/detailed_designs/` đã được kiểm chứng chứa đúng 16 tệp tài liệu, trong đó bao gồm trọn bộ 12 tài liệu bàn giao cốt lõi và các báo cáo phân tích chuyên sâu:

| # | Tên tài liệu | Tệp tin neo thực tế | Đánh giá tính nhất quán |
|---|---|---|---|
| 1 | Handoff Master | [PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md) | **Đạt** — Làm bản đồ chỉ dẫn tổng thể cho toàn bộ pack. |
| 2 | Implementation Plan | [IMPLEMENTATION_PLAN_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/IMPLEMENTATION_PLAN_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Sắp xếp thứ tự ưu tiên và phụ thuộc (PH00 - PH11) hợp lý. |
| 3 | Technical Spec | [TECH_SPEC_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/TECH_SPEC_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Định nghĩa rõ ràng các ràng buộc kỹ thuật bất biến (invariants). |
| 4 | Taskboard | [TASKBOARD_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/TASKBOARD_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Checklists rõ ràng cho từng chặng (Phase A - D) và Exit Criteria. |
| 5 | Traceability Matrix | [PROJECT_HARDENING_BACKEND_TRACEABILITY_MATRIX_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_TRACEABILITY_MATRIX_20260528.md) | **Đạt** — Bản đồ truy vết yêu cầu (R1 - R14) tới nhiệm vụ và kiểm chứng. |
| 6 | Self Audit Protocol | [PROJECT_HARDENING_BACKEND_SELF_AUDIT_AND_TEST_PROTOCOL_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_SELF_AUDIT_AND_TEST_PROTOCOL_20260528.md) | **Đạt** — Cung cấp checklist tự kiểm tra cho đội code trước khi thoát slice. |
| 7 | Evidence Template | [PROJECT_HARDENING_BACKEND_EXECUTION_EVIDENCE_TEMPLATE_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_EXECUTION_EVIDENCE_TEMPLATE_20260528.md) | **Đạt** — Mẫu báo cáo kết quả thực thi (metadata, diffs, payload, UI). |
| 8 | Config Ownership | [PROJECT_HARDENING_BACKEND_CONFIG_OWNERSHIP_MATRIX_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_CONFIG_OWNERSHIP_MATRIX_20260528.md) | **Đạt** — Phân định rõ quyền ghi/đọc cấu hình, ngăn chặn hotfix tùy tiện. |
| 9 | Quality Constitution | [PROJECT_HARDENING_BACKEND_CODE_QUALITY_CONSTITUTION_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/PROJECT_HARDENING_BACKEND_CODE_QUALITY_CONSTITUTION_20260528.md) | **Đạt** — Chỉ số chất lượng và kịch bản rủi ro (Scenario Q1 - Q4). |
| 10 | Run Code Review | [RUN_CODE_REVIEW_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_CODE_REVIEW_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Bộ chỉ lệnh `rg` và các điều kiện từ chối (reject conditions). |
| 11 | Run Integration Tests | [RUN_INTEGRATION_TESTS_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_INTEGRATION_TESTS_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Lộ trình và chỉ lệnh chạy test/build rõ ràng. |
| 12 | Run Spec Audit | [RUN_SPEC_AUDIT_PROJECT_HARDENING_BACKEND_20260528.md](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_SPEC_AUDIT_PROJECT_HARDENING_BACKEND_20260528.md) | **Đạt** — Hướng dẫn kiểm duyệt viên độc lập đối chiếu thực tế. |

---

## 3. Đối chiếu thực tế mã nguồn & Hướng triển khai (Technical Anchors)

### 3.1 Về Ràng Buộc Cô Lập Tenant (Tenant Isolation Hardening - Lát cắt 1.1)
- **Thực tế mã nguồn:** Cấu trúc model `user_workspace/models.py` hiện tại có đúng 6 thực thể cho phép cột `tenant` rỗng và khớp chính xác các dòng được neo trong tài liệu kỹ thuật:
  1. `Portfolio` (dòng 34)
  2. `Transaction` (dòng 56 và 76)
  3. `Watchlist` (dòng 129)
  4. `TrackedSymbol` (dòng 193)
  5. `PriceAlert` (khai báo dòng 245, tenant nullable dòng 273)
  6. `SubAccount` (dòng 328 và 348)
- **Cơ chế Quarantine:** Tài liệu đã cấm tuyệt đối việc gán dữ liệu mồ côi (orphan records) về `system_tenant` hoặc giá trị mặc định. Thay vào đó, quy trình kiểm toán tiền di trú (Pre-migration audit) buộc phải quarantine dữ liệu lỗi ra bảng tạm riêng `quarantine_user_workspace_records` và dừng migration nếu phát hiện dữ liệu thô chưa sạch. Điều này đảm bảo tính an toàn dữ liệu ở cấp độ cao nhất.

### 3.2 Về Hệ Thống Giới Hạn Tần Suất (Security & Throttling - Lát cắt 1.2)
- **Thực tế mã nguồn:** Throttling tầng ứng dụng (app-level) cho các endpoints cốt lõi đã có sẵn decorator hoạt động và test suite kiểm chứng trong `test_rate_limiting.py` (dòng 26, 113, 199).
- **Hardening:** Kế hoạch bổ sung `limit_req_zone` và `limit_req` tại cấu hình Nginx (`nginx.conf` và `nginx-opencore.conf`) để chặn tấn công spam ở tầng Gateway là hoàn toàn thực tế và lấp đầy khoảng trống bảo mật hiện hữu.

### 3.3 Về Kế Hoạch Tách Tệp Lớn (Fat Files Refactor - Lát cắt 1.3)
Tài liệu chỉ định chính xác 4 tệp cồng kềnh với số dòng thực tế hiện tại và đưa ra phương án phân rã kiến trúc (Clean Architecture) khả thi:
- `identity_access/views_auth.py` (995 dòng) $\rightarrow$ Tách luồng logic login/register/reset/oauth ra các view riêng trong `views/`.
- `service_ops/views/dataops.py` (1169 dòng) $\rightarrow$ Đẩy orchestration xử lý sang `backfill_service.py` và `materializer.py`.
- `packages/web/src/adapters/coreApiAdapter.js` (1143 dòng) $\rightarrow$ Phân rã thành module con theo domain đặt tại `adapters/core/`, giữ tệp gốc làm Facade tương thích ngược.
- `packages/web/src/pages/AlertCenterPage.js` (1645 dòng) $\rightarrow$ Tách sub-components trong `components/alert-center/`.

### 3.4 Về Phân Định Ranh Giới Giai Đoạn 2 (Phase 2 Greenfield Capabilities)
- **Tránh trùng lặp:** Tài liệu thừa nhận thực tế phân hệ `commercial/` đã có sẵn nền tảng `Subscription`, `QuotaRecord` (dòng 38) và `Invoice` (dòng 61). Phần phát triển mới (greenfield) chỉ tập trung tích hợp cổng VNPay và endpoint IPN sử dụng locking (`select_for_update`) chống Race Condition.
- **Outbound Notification:** Chuyển dịch từ in-app WebSocket sang email/FCM/WebPush bất đồng bộ sử dụng Celery, đảm bảo backend đóng vai trò là "Single Source of Truth" duy nhất cho trạng thái phân phối tin nhắn.

---

## 4. Khả năng vận hành của Cổng chặn chất lượng (QG-1 Gate Viability)

Cổng chất lượng QG-1 trong tài liệu đã phản ánh trung thực thực tế vận hành (Execution Reality) mà không che giấu lỗi môi trường cục bộ:

1. **Bootstrap Prerequisite bắt buộc:** Tài liệu ghi rõ lệnh cài đặt dependency cho core backend Python environment:
   ```powershell
   & "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" -m pip install -r packages/core/backend/requirements.txt
   ```
   Việc kiểm chứng thực tế cho thấy lệnh `manage.py test` hiện tại trên venv chung bị fail do thiếu `dj_database_url`. Do đó, điều kiện bắt buộc chạy bootstrap này trong runbook là **chính xác** và giúp đội ngũ code tự tái lập môi trường kiểm thử thành công.
2. **Đường build Frontend chính xác:** Lệnh đóng gói web shell được khóa chính xác là:
   ```bash
   npm --prefix packages/web run build-community
   ```
   Tránh lỗi gọi script `build` (không tồn tại trong package.json). Thử nghiệm thực tế xác nhận lệnh này chạy xanh và sinh đúng output tại `packages/web/dist/community/`.

---

## 5. Rủi ro còn lại & Khuyến nghị vận hành (Residual Risks & Operational Recommendations)

> [!WARNING]
> **RỦI RO VẬN HÀNH CÒN LẠI (OPERATIONAL RESIDUAL RISKS)**
>
> 1. **Sự phụ thuộc vào Upstream private:** Việc bootstrap core env Python phụ thuộc vào gói `vnbroker` và `stockchart` nội bộ. Đội ngũ phát triển cần được cấp `VNBROKER_GITHUB_TOKEN` hoặc chạy trên build image đã được cấu hình sẵn credentials để tránh lỗi phân giải gói trên CI/CD.
> 2. **Kiểm thử VNPay sandbox:** VNPay sandbox IP và SSL certs đôi khi không ổn định hoặc thay đổi mà không báo trước. Cần có cơ chế log thô độc lập (`VNPayIPNLog` thô) trước khi parse checksum để đảm bảo có thể replay thủ công khi cần.

---

## 6. Kết luận kiểm toán (Final Audit Verdict)

Bản hardening sub-plan và bộ 12 tài liệu bàn giao tại [docs/detailed_designs/](file:///c:/Mujoco%20Projects/vninvest/docs/detailed_designs/) đạt trạng thái **PASS WITH CONDITIONS**. 

**Điều kiện vận hành:**
- Cho phép xuất bản bộ tài liệu này làm **Technical SSOT** cho phân hệ hardening backend.
- Yêu cầu đội ngũ code tuân thủ nghiêm ngặt runbooks và nộp bằng chứng kiểm thử (evidence template) sau mỗi slice hoàn tất.
