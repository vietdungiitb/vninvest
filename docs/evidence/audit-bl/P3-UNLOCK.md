# P3 unlock criteria (2026-09-24) — KHÔNG làm khi chưa đo

## Baseline hiện tại (bằng chứng)
- API p95 ≤70ms qua nginx (BL-13, dev), fail-rate 0%.
- `pg_stat_activity` = 143 conns lúc đo; pooler pool 20 (BL-05, không dùng cho tới khi deploy prod).
- Queue: LLEN monitor sẵn có (SOC), chưa có sustained-breach nào ghi nhận đợt này.

## Ngưỡng mở khóa (ghi trước, bất kỳ ai cũng verify được)
- **BL-21 read replica**: DB CPU >70% sustained 7 ngày HOẶC p95 endpoint list >500ms do query (EXPLAIN đính kèm).
- **BL-22 tách 1 service**: 1 queue depth sustained vượt ngưỡng alert 7 ngày + worker CPU bão hòa, hoặc deploy monolith gây đau đo được (lead-time/deploy-fail rate).
- **BL-23 K8s**: cần multi-node hoặc autoscale theo lịch/tải (sự kiện thật, không dự báo).
- **Feature product mới**: BL-24 decision + telemetry chứng minh nhu cầu.

Deny-list giữ nguyên: microservices toàn phần, Kafka thay Celery, Next.js/RSC, GraphQL, NFT.
