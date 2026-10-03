# RUN SPEC AUDIT - Council of Three for Global Signal Services Control Center

## 1. Mục tiêu

Dùng ba vòng audit độc lập để giảm nguy cơ bỏ sót bug loại `đúng-looking but wrong` ở chương trình global signal services và unified admin control center.

## 2. Tài liệu bắt buộc cho mọi auditor

1. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
3. `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
4. `docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
5. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md`
6. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_CODE_QUALITY_CONSTITUTION_20260428.md`
7. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
8. `docs/AI_CODING_REGULATION.md`

## 3. Council of Three roles

### Auditor A - Data and SSOT auditor

Tập trung vào:

- canonical store boundaries,
- user-independent detection,
- universe resolution,
- duplicate suppression,
- retention safety.

### Auditor B - Backend service and runtime auditor

Tập trung vào:

- Celery flows,
- run registry,
- cache/read-model reuse,
- distribution pipeline,
- failure recovery.

### Auditor C - Frontend admin and governance auditor

Tập trung vào:

- unified control center IA,
- preview-before-apply,
- pagination/i18n compliance,
- evidence completeness,
- old-panel deprecation and operator workflow completeness.

## 4. Prompt template dùng cho từng auditor

```text
Bạn đang audit chương trình Global Signal Services Control Center.

Hãy đọc các tài liệu bootstrap sau trước khi nêu finding:
1. docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_MASTER_20260428.md
2. docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md
3. docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md
4. docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md
5. docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md
6. docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_CODE_QUALITY_CONSTITUTION_20260428.md
7. docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md
8. docs/AI_CODING_REGULATION.md

Quy tắc audit:
- Chỉ nêu bug, risk, regression, missing safeguard, missing test.
- Mọi finding phải có file + line number.
- Nếu chưa chắc là bug, ghi QUESTION.
- Không nêu style-only feedback.

Các điểm phải soi kỹ:
- detection có thực sự độc lập với user không?
- whale canonical store có tách khỏi WhaleAdvisory không?
- dark-flow severity có còn flatten theo whale ratio không?
- distribution có resolve đủ tracked + watchlist không?
- retention purge có preview-before-apply không?
- admin control center có thực sự là trung tâm quản lý thống nhất không?
- pagination có dùng component chuẩn không?
- explicit consent gate có được tôn trọng không?

Hãy trả kết quả theo thứ tự severity từ cao xuống thấp.
```

## 5. Triage rules

1. Một finding chỉ thành `CONFIRMED BUG` khi ít nhất 2 auditor đồng ý hoặc có regression test xác nhận.
2. Finding chỉ có 1 auditor nêu nhưng chưa có test/evidence thì gắn `NEEDS INVESTIGATION`.
3. Nếu cả 3 auditor đều bỏ qua một rủi ro đã ghi trong quality constitution, audit bị coi là chưa hoàn thành.

## 6. Expected artifacts

Kết quả audit phải được lưu trong:

- `quality/spec_audits/`

Định dạng file gợi ý:

- `quality/spec_audits/2026-04-28-signal-center-auditor-a.md`
- `quality/spec_audits/2026-04-28-signal-center-auditor-b.md`
- `quality/spec_audits/2026-04-28-signal-center-auditor-c.md`
- `quality/spec_audits/2026-04-28-signal-center-triage-summary.md`

## 7. Final merge checklist

- [ ] Auditor A completed
- [ ] Auditor B completed
- [ ] Auditor C completed
- [ ] Triage summary completed
- [ ] Confirmed bugs mapped to task IDs or regression tests
- [ ] Residual risks sent back into evidence template / taskboard if unresolved