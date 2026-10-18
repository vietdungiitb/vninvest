# MODULES/ai_agents — **ĐÃ GỠ (R5.1 phương án B, Owner duyệt 2026-10-18)**

> Ngày rà: **2026-10-18**.

## 0. Trạng thái: đã gỡ, giữ **chỉ lịch sử**

Toàn bộ code CRUD (`models/views/serializers/urls/admin/tests`) đã bị xoá; `AgentRegistry`
chỉ còn trong `ai_agents/migrations/0001_initial.py`. Giữ `migrations/` + app trong
`INSTALLED_APPS`/`db_router` là **có chủ đích**: cần để migration
`ai_agents/migrations/0003_delete_agentregistry.py` chạy được và drop bảng — xoá hẳn app
thì bảng thành mồ côi.

**Lý do gỡ (đo, không suy luận):** `AgentRegistry` **chưa từng được đọc** bởi
orchestrator/advisory/task nào; `AGENT_TYPES` mà plan nhắc tới **không tồn tại**; không có
wave R6 và R5.3–R5.5 không phụ thuộc nó. Dữ liệu seed trước khi drop đã lưu tại
`docs/evidence/ai-cc/r51-agent-registry-rows.md`.

## 1. Mô hẩu + ranh giới (lịch sử)

Registry các agent AI (CRUD qua 2 route `/core/v1/ai/agents`). Ranh giới với
`advisory` (thực thi pipeline) và `ai_analytics` (thống kê dữ liệu).

## 2. Models (chi tiết ở `06.02`)

`AgentRegistry` — **đã xoá** bởi `ai_agents/migrations/0003_delete_agentregistry.py`.

## 3. API (chi tiết ở `07.02`)

Đã bỏ `include('ai_agents.urls')` khỏi `vninvest_core/urls.py:71` ⇒ `/core/v1/ai/agents/`
**404**.

## 4. Job/signal

Không có file task/signal riêng (đo cấu trúc).

## 5. Finding mở

- F-AIA-01 (❓→**đã đóng bằng cách gỡ**): phạm vi tenant của registry chưa rõ.

## 6. Test khóa + trạng thái

**0 test còn lại** (file test của app đã xoá cùng code). Không có gì để khoá vì
không còn đường đọc/ghi nào.
