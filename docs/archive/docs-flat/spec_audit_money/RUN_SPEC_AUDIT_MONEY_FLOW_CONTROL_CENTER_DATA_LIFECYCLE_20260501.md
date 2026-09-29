# RUN SPEC AUDIT - Council of Three for Money Flow Control Center and Data Lifecycle

## 1. Mục tiêu

Dùng ba vòng audit độc lập để giảm nguy cơ bỏ sót bug loại `đúng-looking but wrong` ở chương trình Money Flow Control Center, facts-first route whale và lifecycle lưu trữ nhiều tầng.

## 2. Tài liệu bắt buộc cho mọi auditor

1. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
2. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
9. `AGENTS.md`

## 3. Council of Three roles

### Auditor A - Ownership and SSOT auditor

Tập trung vào:

- canonical writer matrix,
- deprecation semantics,
- raw retention owner,
- whale governance bridge,
- selected-session truth as a spec invariant.

### Auditor B - Backend lifecycle and runtime auditor

Tập trung vào:

- materialization/backfill/recompute services,
- facts-first route assembly,
- run registry,
- retention/forensic safety,
- fallback and degraded-state handling.

### Auditor C - Frontend operator and governance auditor

Tập trung vào:

- Money Flow Control Center IA,
- effective owner visibility,
- preview-before-apply,
- pagination/i18n compliance,
- evidence completeness và legacy-panel demotion.

## 4. Prompt template dùng cho từng auditor

```text
Bạn đang audit chương trình Money Flow Control Center and Data Lifecycle.

Hãy đọc các tài liệu bootstrap sau trước khi nêu finding:
1. docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md
2. docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md
3. docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md
4. docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md
5. docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md
6. docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md
7. docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md
8. docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md
9. AGENTS.md

Quy tắc audit:
- Chỉ nêu bug, risk, regression, missing safeguard, missing test.
- Mọi finding phải có file + line number.
- Nếu chưa chắc là bug, ghi QUESTION.
- Không nêu style-only feedback.

Các điểm phải soi kỹ:
- cùng một knob có đang có hơn một writer hợp lệ không?
- Money Flow Control Center có thực sự không tạo config store mới song song không?
- whale route có thật sự ưu tiên facts-first primary path không?
- selected-session truth có bị drift sau cutover không?
- raw retention owner có còn bị split không?
- forensic windows có bị biến thành raw retention trá hình không?
- preview-before-apply và effective owner có hiện đủ trên UI/API không?
- evidence package có đủ cho self-audit trước final audit không?
- legacy writer surface có còn hard-block đúng backend-side hay chỉ bị ẩn UI không?
- whale bridge có tạo pending/draft state và chờ approval/rollout trước khi active publish không?
- link-out tới Data Ops/Vnbroker có permission-gated hay vẫn render link chết cho người thiếu quyền không?
- forensic carve-out là physical copy/move sang L5 hay chỉ tagging trên raw L0?

Hãy trả kết quả theo thứ tự severity từ cao xuống thấp.
```

## 5. Triage rules

1. Một finding chỉ thành `CONFIRMED BUG` khi ít nhất 2 auditor đồng ý hoặc có regression test xác nhận.
2. Finding chỉ có 1 auditor nêu nhưng chưa có test/evidence thì gắn `NEEDS INVESTIGATION`.
3. Nếu cả 3 auditor đều bỏ qua một rủi ro đã ghi trong quality constitution hoặc ownership matrix, audit bị coi là chưa hoàn thành.
4. Mọi finding về hidden write surface chỉ được nâng lên `CONFIRMED BUG` khi có bằng chứng backend hard-block, không chỉ UI demotion.

## 6. Expected artifacts

Kết quả audit phải được lưu trong:

- `quality/spec_audits/`

Định dạng file gợi ý:

- `quality/spec_audits/2026-05-01-money-flow-auditor-a.md`
- `quality/spec_audits/2026-05-01-money-flow-auditor-b.md`
- `quality/spec_audits/2026-05-01-money-flow-auditor-c.md`
- `quality/spec_audits/2026-05-01-money-flow-triage-summary.md`

## 7. Final merge checklist

- [ ] Auditor A completed
- [ ] Auditor B completed
- [ ] Auditor C completed
- [ ] Triage summary completed
- [ ] Confirmed bugs mapped to task IDs or regression tests
- [ ] Residual risks sent back into taskboard / evidence template if unresolved