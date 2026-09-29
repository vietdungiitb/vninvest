# RUN CODE REVIEW — SaaS Services Recovery

**Ngày**: 2026-05-11

## 1. Review focus

1. Runtime regressions (health, startup, dependency order).
2. Queue/scheduler regressions.
3. Cutover safety và rollback readiness.
4. Config/security regressions.

## 2. Severity rubric

1. Critical: có thể gây outage hoặc data corruption.
2. High: gây mất ổn định runtime hoặc duplicate processing.
3. Medium: ảnh hưởng reliability nhưng có workaround.
4. Low: cải tiến chất lượng tài liệu/code clarity.

## 3. Review checklist

1. Compose/env changes có đầy đủ guardrails chưa?
2. Healthcheck contract có bị phá không?
3. Worker/beat contract có giữ đúng broker/schedule không?
4. Có risk duplicate task processing không?
5. Rollback steps có khả thi và testable không?
6. Evidence commands có tái chạy được không?

## 4. Required outputs của code review

1. Findings list theo severity (kèm file và line tham chiếu).
2. Required fixes trước merge.
3. Residual risks sau merge.
4. Suggested tests nếu thiếu coverage.
