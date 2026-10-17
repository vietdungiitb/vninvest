# R2.6 gates — health check + auto-evict + routing (2026-10-17)

Branch `feat/ai-r26-routing` ← `dev`. Claim `ai-r26`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:913-935`.

## Fail-before
- `ModuleNotFoundError: No module named 'advisory.routing'` (chạy thật VPS: worktree
  tại commit `99e3a634f` + copy test vào).

## Thực hiện
- `advisory/models.py`: `AIHealthCheck` + `AIDeployment` thêm `latency_ms`, `cost_per_1k`,
  `consecutive_failures`, `consecutive_successes`, `auto_evicted`. Migration `0018` + `0019`.
  `AIAuditLog.ActionChoices` thêm `deployment_evicted` / `deployment_restored`.
- `advisory/routing.py` (mới): `choose_deployment` (latency/cost/weighted),
  `routing_decision` (AC5 payload), `NoHealthyDeploymentError` (AC6, `status_code=503`).
- `advisory/tasks.py`: `probe_deployments_health` (AC1) + `_apply_health_outcome` +
  `_apply_evict_or_restore` (AC2 3 lần tắt / AC3 2 lần bật).
- `orchestrator._resolve_routing()` dùng router trước khi gọi provider.
- `settings.CELERY_BEAT_SCHEDULE` + `queue_policy.py`: beat 5 phút
  (`probe-ai-deployments-health`).

## Quyết định (đã ghi)
- **`auto_evicted` là bắt buộc, không phải nicety.** Bản đầu lọc
  `filter(enabled=True)` ⇒ deployment bị evict **không bao giờ được probe lại** ⇒
  mất dịch vụ vĩnh viễn sau một sự cố nhất thời. Giờ probe
  `Q(enabled=True) | Q(auto_evicted=True)`; deployment quản trị **tắt tay**
  (`enabled=False, auto_evicted=False`) thì task không đụng tới — tôn trọng ý quản trị.
  Hai test khoá đúng điều này.
- **Thất bại lần đầu chỉ xuống `degraded`, chưa tắt** (đúng rủi ro plan nêu: evict
  nhanh lúc provider đang deploy).
- **Chỉ bật/tắt `enabled` ở MỘT chỗ** (`_apply_evict_or_restore`). Bản đầu tôi cho
  `_apply_health_outcome` tự bật lại *và* `_apply_evict_or_restore` cũng bật lại —
  hai nơi một việc, dễ lệch.
- **Chiến lược lạ ⇒ `ValueError`**, không rơi về mặc định trong im lặng.
- **Chưa có số đo ⇒ đẩy xuống cuối** (`latency_ms=0` / `cost=0` ⇒ +∞) để deployment mới
  không "thắng" do thiếu dữ liệu.
- **AC5**: payload có thêm `chosen_deployment_id` (test kiểm khoá **bắt buộc** ⊆ tập,
  không phải `==`).

## Bẫy đã gặp — nghiêm trọng
- **Tôi XOÁ MẤT `_write_advisory_usage_record`** khi splice block R2.6 vào `tasks.py`
  (marker chạy từ đầu block R2.6 tới `generate_advisory_task`, hàm nằm ở giữa).
  **Chỉ hồi quy mới bắt được** (`test_ai_pricing` 4 errors + `usage_instrumentation`
  2 failures). Khôi phục từ `git show 726249eab:.../tasks.py`.
  → Bài học: **không splice file bằng marker văn bản**; sửa bằng `edit` có đối chiếu.
- **`git show ... > file` trong PowerShell ghi UTF-16LE** ⇒ script đọc ra rỗng, phải
  chuyển `utf16le` → `utf8` trước.
- **Một lệnh PowerShell parse lỗi thì KHÔNG CHẠY gì cả** — tôi tưởng đã chạy
  `patch-tasks` nên `auto_evicted` không có trong file. Kiểm `git grep` sau khi patch.
- Test AC3 viết `outcomes=[False]*3` trong **một** lần gọi task, nhưng helper chạy task
  **một lần** ⇒ chỉ 1 probe. AC2 viết đúng (3 lần gọi) nên pass — dấu hiệu test sai âm
  thầm. Đã sửa.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **22/22** · pricing 22/22 · budget 21/21 · copilot 25/25 · breaker 20/20 ·
  ai_clients 7/7 · usage 6/6 · mgmt 30/30 · config 9/9 · policy 9/9 · r06 5/5 ·
  advisory_budget 12/12 · advisory_status 7/7 = **206 test**.
- `manage.py check` 0 · `makemigrations --check` 0 · pre-push 23/23 · normalize-eol OK.

## CHƯA CHẠY
- **Ghi `routing_decision` vào trace** — cần `AITrace` của R3.1. Hiện decision được
  trả về từ `_resolve_routing()` nhưng orchestrator **chưa** lưu vào đâu (AC5 mới chỉ
  kiểm được hình dạng payload).
- **`cost_per_1k` chưa được điền** từ `AICostRate` (R2.7 có bảng giá, chưa nối vào
  deployment) ⇒ chiến lược `cost` hiện đẩy tất cả xuống cuối.
- `AI_ROUTING_STRATEGY` đọc qua `getattr`, chưa khai trong `settings.py`.
- full BE ngoài scope · ruff · E2E · staging deploy · probe provider thật.