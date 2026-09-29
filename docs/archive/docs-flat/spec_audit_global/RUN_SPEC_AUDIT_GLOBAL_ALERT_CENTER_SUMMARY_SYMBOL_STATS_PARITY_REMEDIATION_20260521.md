# Run Spec Audit — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

---

## 1. Bootstrap

Đọc các file sau trước khi audit spec:

1. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_HANDOFF_MASTER_20260521.md`
2. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
3. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
4. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
5. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_TRACEABILITY_MATRIX_20260521.md`

---

## 2. Audit questions

### Scope
- Timeframe có được backend thực thi thật không?
- Feed/summary/symbol-stats/context có dùng cùng scope builder không?

### Aggregates
- Tổng KPI có khớp tổng theo mã trong cùng scope không?
- Unseen có khóa theo user hiện tại không?

### Frontend
- Bảng theo mã còn aggregate từ sample page không?
- UI có ghi rõ semantics toàn scope và page hiển thị không?

### Contracts
- Endpoint symbol-stats có schema/pagination rõ ràng không?
- Adapter đã cập nhật đủ method và test chưa?

---

## 3. Audit output format

1. Findings theo severity.
2. Requirement ID bị fail.
3. File/path evidence.
4. Test/evidence còn thiếu.
5. Recommendation ngắn gọn, actionable.
