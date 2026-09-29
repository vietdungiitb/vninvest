# Run Spec Audit — Project Hardening Backend
**Ngày**: 2026-05-28

---

## 1. Audit objective

Xác nhận implementation hoặc doc update còn bám đúng spec đã khóa của pack này, đặc biệt ở 5 điểm dễ drift:

1. tenant isolation scope,
2. core-env bootstrap gate,
3. gateway throttling,
4. `build-community` packaging gate,
5. Phase 2 foundation reuse.

---

## 2. Audit questions

1. Slice này có còn nằm đúng boundary của sub-plan không?
2. Có evidence nào cho thấy migration muốn bypass orphan handling không?
3. QG-1 backend gate có thể được người khác tái lập chỉ từ runbook không?
4. Web packaging gate có còn dùng đúng `build-community` không?
5. Code/doc Phase 2 có mô tả `commercial/` như “blank greenfield” thay vì “greenfield extension on existing foundation” không?
6. Notification pipeline có đang cố tạo truth layer ở client hay route compat song song không?
7. AI cost control có quota/cache/router guardrails hay chỉ là ý tưởng mức cao?

---

## 3. Evidence expected from auditor

1. File list đã chạm.
2. Diff summary.
3. Validation commands đã chạy.
4. Findings theo severity: CRITICAL / HIGH / MEDIUM / LOW.
5. Kết luận: PASS / PASS WITH CONDITIONS / FAIL.

---

## 4. Automatic fail conditions

1. Phát hiện `system_tenant` fallback hoặc tenant auto-fill.
2. Không có bootstrap prerequisite nhưng vẫn claim backend QG-1 ready.
3. `build-community` bị thay bằng gate không đúng.
4. Gateway throttle là TODO nhưng taskboard hoặc evidence lại đánh DONE.
5. Phase 2 rewrite sai domain foundation của `commercial` hoặc `signal_intelligence`.
