# R2.9 gates — retry + backoff + circuit breaker (2026-10-17)

Branch `feat/ai-r29-retry` ← `dev`. Claim `ai-r29`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:984-1007`.

## Fail-before
- `ModuleNotFoundError: advisory.health` / `RetryPolicy` / `complete_resilient` chưa có.

## Thực hiện
- `advisory/health.py` (mới): `CircuitBreaker` 3 trạng thái `closed/open/half_open`,
  `failure_threshold`, `cooldown_seconds`, `snapshot()` cho endpoint health R2.6.
- `advisory/ai_clients/base.py`:
  - `RetryPolicy` + `from_settings()` + `from_deployment()`; `delay_seconds()` tôn trọng
    `Retry-After`, thiếu thì luỹ thừa `base × 2^(n-1)`.
  - `RETRYABLE_STATUS` chỉ gồm lỗi **tạm thời** (408/425/429/5xx/529). 401/403/400
    **không** retry — đốt hạn mức rồi vẫn hỏng.
  - `ProviderCircuitOpenError` (`error_code='provider_circuit_open'`) + `reset_circuit_breakers()`.
  - `AiClient.complete_resilient()`: retry + breaker + deadline. `complete()` giữ nguyên là
    **primitive 1 lần**.
- `orchestrator.call_agent_async` + synthesis gọi `complete_resilient`; breaker mở ⇒ trả
  thông báo rõ ràng, không retry vô ích.
- `AIDeployment` + `num_retries` / `backoff_base_ms` / `cooldown_seconds` (NULL = settings).
  Migration `0017`.

## Quyết định (đã ghi)
- **AC7 chống 9 request nhờ breaker dùng chung theo provider**, không nhờ chia nhỏ hạn mức
  retry. Breaker lưu ở `_BREAKERS` (process-level, có `threading.Lock`) theo key
  `(provider, threshold, cooldown)`; nếu tạo breaker **theo instance** thì 3 client ⇒ 3
  breaker ⇒ AC7 hỏng.
- Retry vẫn chạy **trước** khi breaker mở: test AC7 chốt `calls ≤ 5` (không phải 9), vì
  ngưỡng mở = 3 lỗi nên 3 agent chia nhau ngân sách lỗi chứ không nhân.
- **AC8 không cần code riêng**: 401 không nằm trong `RETRYABLE_STATUS` nên tầng retry
  không đụng; `CopilotClient` tự refresh 1 lần ở R2.4. Test chốt: lỗi token ⇒ đúng 1
  request, không `sleep`.

## Bẫy đã gặp
- **Lỗi code thật**: `ProviderHTTPError.__init__` nhận `body`, tôi gọi `body_text` ⇒ 17
  error một lượt (cả trong code lẫn test).
- **Lỗi thiết kế thật**: `record_failure` chỉ mở breaker khi `_opened_at is None` ⇒ ở
  `half_open` thất bại thì **kẹt vĩnh viễn** ở `half_open`. Sửa: đang mở mà thất bại ⇒ mở
  lại với cooldown mới.
- **Module-level state ⇒ phải reset khi test**: breaker cache (`_BREAKERS`) và token cache
  (R2.4) đều dùng chung process đúng thiết kế production. Thiếu `reset` ở `setUp` làm
  18 test FAIL giả với `calls == 0`.
- **Đừng tin kết quả khi SSH bị `Connection reset`**: một lần script bị cắt giữa chừng báo
  FAIL giả (4 test/5 error) — chạy lại là 20/20 OK. Luôn xác nhận lại trước khi sửa code.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **20/20** · copilot 25/25 · ai_clients 7/7 · usage 6/6 · pricing 22/22 · budget 21/21 ·
  mgmt 30/30 = **131 test**.
- `manage.py check` 0 · `makemigrations --check` 0 · pre-push 23/23 · normalize-eol OK.

## CHƯA CHẠY
- `AIDeployment.num_retries/...` **chưa được truyền** vào `RetryPolicy.from_deployment()`
  từ orchestrator (hàm đã có + test, nhưng call site chưa nối — nối ở R2.6 khi có
  `resolve_active_deployment`).
- Settings `AI_PROVIDER_NUM_RETRIES` / `AI_PROVIDER_BACKOFF_BASE_MS` /
  `AI_PROVIDER_COOLDOWN_SECONDS` / `AI_PROVIDER_FAILURE_THRESHOLD` /
  `AI_ADVISORY_DEADLINE_SECONDS` **chưa khai** trong settings (đọc qua `getattr` nên chạy
  được với mặc định). Không sửa file `.env*` — nằm deny-list.
- Endpoints health cho R2.6 (dùng `CircuitBreaker.snapshot()`).
- full BE ngoài scope · ruff · E2E · staging deploy.