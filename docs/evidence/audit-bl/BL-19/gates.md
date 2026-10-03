# BL-19 gates — distributed tracing DECISION: defer (2026-09-24)

## Đánh giá
Hiện có: `request_id` xuyên suốt (response header + audit event + JSON logs BL-15), Sentry error tracking, Prometheus metrics, queue-depth observability. Hệ là modular monolith (1 process) → trace phân tán ít giá trị lúc này.

## Quyết định
DEFER Jaeger/Tempo. Mở lại khi: (a) p99 incident cần spans xuyên process (celery task → DB → redis), hoặc (b) tách service đầu tiên (BL-22), hoặc (c) >2 on-call than phiền thiếu trace trong postmortem.

## DoD tick
- [x] decision + unlock criteria ghi nhận (không code — đúng bản chất item).
