# Global Alert Center Summary-Symbol Stats Parity Remediation — Handoff Master
**Ngày**: 2026-05-21  
**Status**: Approved for implementation handoff  
**Scope**: Khắc phục triệt để sai lệch số liệu giữa KPI tổng (`Tổng số alert`) và `Thống kê theo mã cổ phiếu`, đồng thời chuẩn hóa scope thời gian, contract API, thuật toán tổng hợp, và semantics UI.

---

## 1. Mục tiêu

1. Loại bỏ hoàn toàn tình trạng KPI tổng và bảng theo mã dùng hai scope dữ liệu khác nhau.
2. Chuẩn hóa `timeframe` thành server truth, không còn control giả ở UI.
3. Chuẩn hóa thống kê theo mã thành endpoint backend dedicated, không aggregate từ feed page sample.
4. Đảm bảo một bộ lọc duy nhất áp dụng đồng thời cho feed, summary, symbol-stats và context.
5. Thiết lập quality gates để ngăn tái phát regression.

---

## 2. Vấn đề đã xác nhận

1. `Tổng số alert` lấy từ summary toàn scope.
2. `Thống kê theo mã` đang tự cộng từ `alerts` của trang feed hiện tại (sample page).
3. Feed dùng cursor pagination, mặc định `page_size=50`, nên symbol table không đại diện cho toàn scope.
4. `timeframe` được gửi từ frontend nhưng backend filter chưa áp dụng.

---

## 3. Quyết định đã khóa

1. `Symbol stats` phải là server-side aggregate endpoint, không tính phía browser từ feed page.
2. `timeframe` là filter bắt buộc trong shared scope query builder.
3. Mọi widget trên Alert Center phải chia sẻ cùng `filter scope` (lane/symbol/alert_family/severity/session_date/timeframe).
4. UI phải hiển thị rõ scope và ngữ nghĩa số liệu (toàn scope vs trang hiện tại).
5. Invariant bắt buộc: `summary.total == sum(symbol_stats.count)` trong cùng scope.

---

## 4. Deliverables trong gói này

| # | Tài liệu | Đường dẫn |
|---|---|---|
| 1 | Handoff Master | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_HANDOFF_MASTER_20260521.md` |
| 2 | Implementation Plan | `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |
| 3 | Technical Spec | `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |
| 4 | Taskboard | `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |
| 5 | Traceability Matrix | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_TRACEABILITY_MATRIX_20260521.md` |
| 6 | Self Audit & Test Protocol | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260521.md` |
| 7 | Execution Evidence Template | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_EXECUTION_EVIDENCE_TEMPLATE_20260521.md` |
| 8 | Config Ownership Matrix | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_CONFIG_OWNERSHIP_MATRIX_20260521.md` |
| 9 | Code Quality Constitution | `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_CODE_QUALITY_CONSTITUTION_20260521.md` |
| 10 | Run Code Review | `docs/RUN_CODE_REVIEW_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |
| 11 | Run Integration Tests | `docs/RUN_INTEGRATION_TESTS_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |
| 12 | Run Spec Audit | `docs/RUN_SPEC_AUDIT_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md` |

---

## 5. Phạm vi file kỹ thuật mục tiêu

1. `packages/core/backend/src/signal_intelligence/views.py`
2. `packages/core/backend/src/signal_intelligence/urls.py`
3. `packages/core/backend/src/signal_intelligence/api_urls.py`
4. `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py`
5. `packages/web/src/adapters/coreApiAdapter.js`
6. `packages/web/src/adapters/coreApiAdapter.test.js`
7. `packages/web/src/pages/AlertCenterPage.js`

---

## 6. Định nghĩa thành công

Chương trình được coi là complete khi đồng thời đạt:

1. Cùng scope filter, KPI tổng luôn khớp tổng theo mã.
2. Chuyển `timeframe` làm thay đổi dữ liệu backend thực tế.
3. Không còn aggregate thống kê theo mã từ feed page sample.
4. UI ghi rõ ngữ nghĩa số liệu, không gây hiểu sai.
5. Test + audit gate pass và có evidence bàn giao đầy đủ.
