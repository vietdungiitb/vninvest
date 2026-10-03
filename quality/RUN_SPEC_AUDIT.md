# RUN SPEC AUDIT - Council of Three for Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Mục tiêu

Dùng ba vòng audit độc lập để giảm nguy cơ bỏ sót bug loại “đúng-looking but wrong” ở feature pack này.

## 2. Tài liệu bắt buộc cho mọi auditor

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
5. `quality/QUALITY.md`

## 3. Council of Three roles

### Auditor A - Data semantics auditor

Tập trung vào:

- selected session truth,
- tooltip bucket correctness,
- flow compare semantics,
- heatmap semantics,
- session selector / payload contract,
- advisory context đúng phiên.

### Auditor B - Frontend architecture auditor

Tập trung vào:

- Kline route composition,
- Flow View Model parity,
- shark icon viewport logic,
- heatmap rendering semantics,
- cleanup dual-path chart cũ,
- Stock Detail radar relocation regression.

### Auditor C - Regression and governance auditor

Tập trung vào:

- immutable source file protection,
- docs bundle completeness,
- self-audit evidence completeness,
- ledger/progress synchronization,
- test gaps và rollback risk.

## 4. Prompt template dùng cho từng auditor

```text
Bạn đang audit feature pack Whale Alerts Symbol KLine Intelligence Upgrade.

Hãy đọc các tài liệu bootstrap sau trước khi nêu finding:
1. docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md
2. docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md
3. docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md
4. docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md
5. docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md
5. quality/QUALITY.md

Quy tắc audit:
- Chỉ nêu bug/risk/regression/missing test.
- Mọi finding phải có file + line number.
- Nếu chưa chắc là bug, ghi QUESTION.
- Không nêu style-only feedback.

Các điểm phải soi kỹ:
- Bubble source files của modern dashboard có bị sửa trực tiếp không?
- Flow View Model co thuc su la single truth cho tooltip/pane/heatmap/marker khong?
- Heatmap mode co dung semantics `Net/Buy/Sell` khong?
- Selected session có đi đúng từ Kline click sang bubble/advisory không?
- Tooltip có lấy đúng bucket dữ liệu không?
- Shark icons có tính theo viewport hay theo toàn dataset?
- Stock Detail có regress sau khi chuyển Radar không?

Hãy trả kết quả theo thứ tự severity từ cao xuống thấp.
```

## 5. Triage rules

1. Một finding chỉ thành `CONFIRMED BUG` khi ít nhất 2 auditor đồng ý hoặc có regression test xác nhận.
2. Finding chỉ có 1 auditor nêu nhưng chưa có test/evidence thì gắn `NEEDS INVESTIGATION`.
3. Nếu 3 auditor đều bỏ qua một bề mặt rủi ro đã nằm trong `QUALITY.md`, audit bị coi là chưa hoàn thành.

## 6. Expected artifacts

Kết quả audit phải được lưu trong:

- `quality/spec_audits/`

Định dạng file gợi ý:

- `quality/spec_audits/2026-04-28-kline-intelligence-auditor-a.md`
- `quality/spec_audits/2026-04-28-kline-intelligence-auditor-b.md`
- `quality/spec_audits/2026-04-28-kline-intelligence-auditor-c.md`
- `quality/spec_audits/2026-04-28-kline-intelligence-triage-summary.md`

## 7. Final merge checklist

- [ ] Auditor A completed
- [ ] Auditor B completed
- [ ] Auditor C completed
- [ ] Triage summary completed
- [ ] Confirmed bugs mapped to task IDs or regression tests
- [ ] Residual risks sent back into evidence template / taskboard if unresolved