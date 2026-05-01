# RUN CODE REVIEW - Money Flow Control Center and Data Lifecycle

## 1. Bootstrap files phải đọc trước khi review

1. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
2. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
9. `AGENTS.md`

## 2. Focus areas bắt buộc

### A. Writer ownership correctness

- có field nào đang được ghi từ hai surface khác nhau cho cùng business meaning không?
- control center mới có thật sự chỉ write-through vào whale mission-control cho whale governance không?
- raw retention owner có còn bị split giữa runtime policy và signal retention không?

### B. Facts-first route correctness

- `whale-alerts/:symbol` có thật sự ưu tiên bucket facts + session summaries + canonical events không?
- raw path có còn là primary path ngầm hoặc fallback không được giới hạn không?

### C. Selected-session truth preservation

- facts-first cutover có làm bubble, advisory, pane CVD/strength hoặc marker semantics drift khỏi selected session không?

### D. Materialization and recompute safety

- jobs materialization/backfill có đi qua run registry không?
- freshness/completeness flags có được cập nhật và tiêu thụ đúng không?

### E. Retention and forensic safety

- purge raw/facts có preview safety gate không?
- forensic windows có expiry và scope rõ không, hay đang biến thành raw retention trá hình?

### F. Admin control center architecture

- operator có thấy `effective owner` và `Nguồn chỉnh sửa chuẩn` rõ ràng cho các field read-only/link-out không?
- UI có tái sinh writer thứ hai qua form hoặc action button nào không?
- list lớn có dùng `PaginationBar` không?
- text mới có qua i18n tiếng Việt đầy đủ dấu không?

### G. Governance and evidence completeness

- evidence template có được điền đúng cho slice không?
- ledger/progress có sync không?
- residual risk notes có phản ánh đúng những phần còn tạm thời như compatibility field không?

## 3. Guardrails bắt buộc khi review

1. Line numbers là bắt buộc. Không có line number thì không được ghi finding.
2. Phải đọc body function/component, không review theo tên hàm hoặc import.
3. Nếu chưa chắc là bug, ghi `QUESTION` thay vì `BUG`.
4. Phải grep hoặc đối chiếu code trước khi kết luận `vẫn full-scan raw`, `vẫn có duplicate writer`, `thiếu effective owner`, `thiếu preview`, `selected session bị drift`.
5. Không đưa style nit, chỉ nêu bug, risk, regression, missing safeguard, missing test.

## 4. Review checklist theo rủi ro

### Checklist R1 - Single effective writer

- [ ] Mọi field có trong ownership matrix đều có canonical writer đúng như spec.
- [ ] Không có UI panel render nút apply cho field thuộc domain khác mà không phải write-through bridge.

### Checklist R2 - Facts-first route

- [ ] Snapshot service ưu tiên facts-first primary path.
- [ ] Fallback raw path có degraded/source marker rõ ràng.

### Checklist R3 - Selected-session truth

- [ ] Facts materialization và route assembly không làm drift bubble/advisory/flow panes khỏi selected session.

### Checklist R4 - Retention safety

- [ ] Purge raw/facts có preview safety gate.
- [ ] Forensic windows có reason và expiry.

### Checklist R5 - Operator UX unification

- [ ] Money Flow Control Center là narrative vận hành chính.
- [ ] Panel cũ chỉ còn link-out/read-only hoặc legacy forensic, không còn là write-path song song.

## 5. Regression test generation sau review

Nếu review nêu BUG findings, phải viết hoặc yêu cầu viết regression tests tương ứng theo nhóm sau:

1. effective-owner summary API test,
2. duplicate writer guard test,
3. facts-first whale snapshot parity test,
4. selected-session truth parity test,
5. retention preview safety gate test,
6. forensic expiry policy test,
7. control center effective-owner / link-out UI test.

## 6. Output format bắt buộc

Mỗi finding phải có đúng format:

1. Severity: `P0` / `P1` / `P2` / `QUESTION`
2. File + line number
3. Hành vi sai hoặc rủi ro
4. Tác động người dùng hoặc rủi ro hệ thống
5. Test/evidence thiếu hoặc cần bổ sung