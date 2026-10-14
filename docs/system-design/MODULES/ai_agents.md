# MODULES/ai_agents — AI Agents Registry

> Tin cậy tổng: ❓ (sơ khởi). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Registry các agent AI (CRUD qua 2 route `/core/v1/ai/agents`). Ranh giới với
`advisory` (thực thi pipeline) và `ai_analytics` (thống kê dùng).

## 2. Models (1 — chi tiết ở `06.02`)

`AgentRegistry` (không tenant FK trực tiếp — ❓ registry dùng chung hay theo tenant?).

## 3. API (2 route — chi tiết ở `07.02`)

Đều `IsAuthenticated`.

## 4. Job/signal

Không có file task/signal riêng (đo cấu trúc).

## 5. Finding mở

- F-AIA-01 (❓): phạm vi tenant của registry chưa rõ.

## 6. Test khóa + trạng thái

1 test file (`test_agent_ownership.py` — tồn tại đo được; phủ nội dung chưa rà).
