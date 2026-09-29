# Run Code Review — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

---

## 1. Bootstrap

Đọc trước khi review:

1. `quality/QUALITY.md`
2. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_HANDOFF_MASTER_20260521.md`
3. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
4. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
5. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`
6. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_TRACEABILITY_MATRIX_20260521.md`
7. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_CONFIG_OWNERSHIP_MATRIX_20260521.md`
8. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_CODE_QUALITY_CONSTITUTION_20260521.md`
9. `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260521.md`

---

## 2. Review focus

### Scope review
- Verify `timeframe` được backend thực thi.
- Verify shared scope builder được tái sử dụng bởi feed/summary/symbol-stats/context.

### Aggregate review
- Verify summary aggregate không sai do join.
- Verify unseen aggregate đúng user scope.
- Verify symbol-stats aggregate chạy trên full scoped queryset.

### Frontend review
- Verify symbol table không dùng local `alerts.forEach` để aggregate.
- Verify labels rõ semantics.

### Contract review
- Verify adapter methods mới có test coverage.
- Verify endpoint docs/schema và params đồng nhất.

---

## 3. Grep checks hữu ích

```powershell
rg -n "timeframe" packages/core/backend/src/signal_intelligence/views.py packages/web/src/pages/AlertCenterPage.js
rg -n "symbols/stats|symbol-stats" packages/core/backend/src/signal_intelligence packages/web/src/adapters
rg -n "alerts\.forEach\(|symbolStats\s*=\s*\{" packages/web/src/pages/AlertCenterPage.js
rg -n "deliveries__delivery_state='new'|deliveries__user" packages/core/backend/src/signal_intelligence/views.py
```

---

## 4. Reject conditions

Reject ngay nếu phát hiện:

1. Bảng theo mã vẫn aggregate từ feed page sample.
2. `timeframe` không có tác động backend thực tế.
3. `summary.total` vẫn có thể lệch tổng theo mã trong cùng scope.
4. UI không ghi rõ phạm vi số liệu.
