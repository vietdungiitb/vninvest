# MODULES/ai_analytics — AI Usage Analytics

> Tin cậy tổng: ❓ (sơ khởi). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Thống kê mức dùng AI (3 route `/core/v1/ai/usage`) — đầu vào cho quota/billing.
Ranh giới với `commercial` (quota) và `advisory` (sinh usage).

## 2. Models (2 — chi tiết ở `06.02`)

`AIUsageRecord`, `AIUsageSummary` (không tenant FK trực tiếp — ❓ thống kê theo
tenant bằng cách nào?).

## 3. API (3 route — chi tiết ở `07.02`)

Đều `IsAuthenticated`.

## 4. Job/signal

Không có file task/signal riêng (tổng hợp ở đâu? ❓).

## 5. Finding mở

- F-AIAN-01 (❓): nguồn ghi `AIUsageRecord` chưa trace (không code nào ghi theo
  audit cũ — cần xác minh lại, có thể đã đổi).

## 6. Test khóa + trạng thái

1 test file (`test_usage_permissions.py` — tồn tại đo được).
