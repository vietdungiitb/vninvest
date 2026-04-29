# RUN CODE REVIEW - Global Signal Services Control Center

## 1. Bootstrap files phải đọc trước khi review

1. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
3. `docs/TECH_SPEC_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
4. `docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md`
5. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_TRACEABILITY_MATRIX_20260428.md`
6. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_CODE_QUALITY_CONSTITUTION_20260428.md`
7. `docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
8. `docs/AI_CODING_REGULATION.md`

## 2. Focus areas bắt buộc

### A. SSOT boundary correctness

- whale canonical store có thực sự là `WhaleAlertEvent` hay không?
- dark-flow path có thực sự giữ `OrderFlowSignal` làm canonical hay không?

### B. Universe resolution correctness

- admin curated, tracked, watchlist merge có đúng policy đã khóa không?
- preview có phản ánh effective universe thật không?

### C. Detection purity

- detector có còn đọc user-specific threshold để quyết định canonical event existence không?
- detector có tự làm audience/advisory side effects trong phase detect không?

### D. Whale duplicate suppression

- một trade có thể phát nhiều whale events do multi-threshold hay không?
- `event_id` có deterministic không?

### E. Distribution correctness

- tracked và watchlist audience có đều được resolve không?
- `UserAlertHistory` có được ghi tối thiểu cho event đã giao không?

### F. Retention safety

- purge raw tick có bị cho chạy mà không có preview safety gate không?
- read-model có còn phụ thuộc raw tick scan khi canonical store đã có không?

### G. Admin control center architecture

- UI mới có thật sự là trung tâm điều hành chính không?
- write actions có preview-before-apply không?
- pagination có dùng `PaginationBar` không?
- text mới có qua i18n tiếng Việt đầy đủ dấu không?

## 3. Guardrails bắt buộc khi review

1. Line numbers là bắt buộc. Không có line number thì không được ghi finding.
2. Phải đọc body function/component, không review theo tên hàm hoặc import.
3. Nếu chưa chắc là bug, ghi `QUESTION` thay vì `BUG`.
4. Phải grep hoặc đối chiếu code trước khi kết luận “thiếu preview”, “thiếu i18n”, “vẫn phụ thuộc raw tick”, “vẫn phụ thuộc user context”.
5. Không đưa style nit, chỉ nêu bug, risk, regression, missing safeguard, missing test.

## 4. Review checklist theo rủi ro

### Checklist R1 - Detection user independence

- [ ] Không có path quyết định existence của canonical event dựa trên `UserConfig` hoặc threshold riêng từng user.

### Checklist R2 - Canonical store integrity

- [ ] Whale global đọc từ `WhaleAlertEvent`.
- [ ] Dark-flow global không dùng `WhaleAdvisory` hay raw tick scan làm truth.

### Checklist R3 - Audience correctness

- [ ] Resolve đủ tracked + watchlist.
- [ ] Không giao duplicated alert do resolver chồng chéo.

### Checklist R4 - Preview-before-apply

- [ ] Config write có preview.
- [ ] Universe apply có preview delta.
- [ ] Retention purge có preview safety gate.

### Checklist R5 - Admin UI unification

- [ ] Control center không chỉ là tập hợp panel rời.
- [ ] Không còn write-path chính nằm ở panel whale cũ hoặc raw Django admin tables.

## 5. Regression test generation sau review

Nếu review nêu BUG findings, phải viết hoặc yêu cầu viết regression tests tương ứng theo nhóm sau:

1. universe resolver hybrid preview test,
2. whale duplicate suppression test,
3. dark-flow severity semantics test,
4. tracked + watchlist audience fan-out test,
5. preview-before-apply UI test,
6. retention safety gate test,
7. admin control center navigation and deprecation regression test.

## 6. Output format bắt buộc

Mỗi finding phải có đúng format:

1. Severity: `P0` / `P1` / `P2` / `QUESTION`
2. File + line number
3. Hành vi sai hoặc rủi ro
4. Tác động người dùng hoặc rủi ro hệ thống
5. Test/evidence thiếu hoặc cần bổ sung