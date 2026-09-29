# CODE QUALITY CONSTITUTION — SaaS Services Recovery

**Ngày**: 2026-05-11

## 1. Principles

1. Recovery-first: mọi thay đổi phải phục vụ trực tiếp mục tiêu phục hồi.
2. Small slices: mỗi PR tập trung vào một mục tiêu kỹ thuật rõ ràng.
3. Evidence-driven: không có evidence thì xem như chưa hoàn tất.
4. Safety over speed: ưu tiên ổn định và rollback an toàn trước tối ưu phụ.

## 2. Forbidden actions

1. Không merge thay đổi runtime khi chưa pass health gate.
2. Không chạy song song legacy/core cho cùng workload chính mà thiếu cơ chế tránh duplicate.
3. Không hardcode secrets hoặc bypass policy production.
4. Không đóng task khi chưa cập nhật ledger/progress.

## 3. Mandatory checks trước merge

1. Lint/type/syntax checks liên quan slice.
2. Integration tests theo run protocol.
3. Runtime smoke tests.
4. Evidence template điền đầy đủ.

## 4. Reliability gates

1. Gate A: data plane healthy.
2. Gate B: core runtime healthy.
3. Gate C: background jobs healthy.
4. Gate D: SaaS-only path validated.
5. Gate E: soak + SLO pass.

## 5. Documentation obligations

1. Update taskboard status theo slice.
2. Update `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
3. Update `PROGRESS_DASHBOARD.md`.
4. Attach command outputs trong evidence.

## 6. Quality sign-off

Mỗi phase chỉ đóng khi có:
1. Owner self-check pass.
2. Reviewer check pass.
3. QA/DevOps acceptance pass (nếu phase chạm runtime).
