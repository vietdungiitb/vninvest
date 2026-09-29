# RUN SPEC AUDIT — SaaS Services Recovery

**Ngày**: 2026-05-11

## 1. Mục đích

Đảm bảo implementation không lệch so với:
1. Handoff master.
2. Implementation plan.
3. Tech spec.
4. Taskboard và traceability matrix.

## 2. Phương pháp audit

1. Spec-to-code mapping theo Req IDs (`SSR-REQ-*`).
2. Code-to-spec reverse check cho mỗi thay đổi runtime.
3. Runtime-to-spec check qua integration test results.

## 3. Audit checklist

1. Có requirement nào chưa có task hoặc test không?
2. Có task nào hoàn tất nhưng thiếu evidence không?
3. Có thay đổi runtime nào ngoài phạm vi spec không?
4. Có gate nào bị skip không?
5. Rollback path có tương thích implementation thực tế không?

## 4. Quyết định audit

1. PASS: full alignment, residual risk chấp nhận được.
2. CONDITIONAL PASS: có mismatch nhỏ, cần follow-up ticket.
3. FAIL: mismatch critical, chưa đủ điều kiện merge/cutover.

## 5. Output bắt buộc

1. Bảng mismatch theo mức độ.
2. Danh sách action required.
3. Trạng thái cuối cùng: PASS/CONDITIONAL PASS/FAIL.
