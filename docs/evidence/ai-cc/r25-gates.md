# R2.5 gates — `openclaw` fail-closed (2026-10-17)

Branch `feat/ai-r25-openclaw` ← `dev`. Claim `ai-r25`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:889-907`.

## Fail-before
- `get_ai_client('openclaw')` ⇒ `FactoryError` ⇒ orchestrator không có đường nào
  dùng được provider này.
- `build_ai_readiness('openclaw')` ⇒ **`ready=True`, `reason_code='system_default_no_key_needed'`**
  ⇒ UI báo "sẵn sàng" cho dịch vụ chưa từng được gọi.
- `test-connection` openclaw ⇒ **HTTP 200 + `latency_ms: 0`** mà không có request nào ra ngoài.

## Vì sao fail-closed chứ không phải adapter thật
STOP condition §3.4-6: thiếu bất kỳ mục nào trong 5 thông tin **D-03c** (base URL ·
protocol · auth · nguồn danh mục · SLA) thì BLOCKED, **không đoán**. Repo không có trace
nào của protocol openclaw. Vì vậy adapter **cố tình không có nhánh gọi mạng**:

| Tình trạng | Kết quả |
|---|---|
| Thiếu `OPENCLAW_BASE_URL` | `503 openclaw_not_configured` (AC1) |
| Có base URL, `OPENCLAW_PROTOCOL` chưa khai | `503 openclaw_spec_missing` |
| Có base URL + protocol lạ | `503 openclaw_spec_missing` |

`SUPPORTED_PROTOCOLS = ()` — rỗng, cố ý. Khi Owner cấp D-03c chỉ cần khai protocol và
viết nhánh; **hợp đồng lỗi giữ nguyên** nên không phải sửa call site nào.

## Thực hiện
- `advisory/ai_clients/openclaw.py` (mới): `OpenClawClient` + `resolve_config()` +
  `OpenClawNotConfiguredError` (503) + `OpenClawSpecMissingError` (503).
- Registry `openclaw` (fail-closed client có mặt **để lỗi nói rõ**, không phải để giả
  lập gọi dịch vụ).
- `build_ai_readiness`: openclaw thiếu cấu hình ⇒ `ready=False` + `reason_code='not_probed'`.
- **Xoá nhánh `test-connection` "openclaw luôn sẵn sàng"** — đây là nguồn của HTTP 200 giả.

## AC4: 2 test đã khoá hành vi giả — đã thay
| Cũ | Mới |
|---|---|
| `test_openclaw_returns_success` (mgmt center) | `test_openclaw_not_configured_is_not_reported_as_success` |
| `test_openclaw_creates_success_audit_log` (audit) | `test_openclaw_unconfigured_creates_failure_audit_log` |

Test thứ hai **thêm** chốt `test_connection_success` **không** được ghi — audit success cho
provider chưa cấu hình là dấu hiệu "số liệu đẹp vì không đo gì cả".

## Test khác phải sửa theo (đã ghi)
- `test_ai_r06_no_echo_throttle.test_ac7_21st_probe_returns_429`: 20 lần đầu giờ là **400**
  (fail-closed) thay vì 200. Test vẫn giữ ý nghĩa: không outbound + lần 21 phải 429.
- `test_ai_clients` AC4: sau R2.5 **cả 6 provider đều có client** ⇒ thêm test chốt
  `ProviderChoices - factory = ∅` để không provider nào lặp lại lỗi "khai provider mà không
  có client" (đây chính là gốc rễ của F-06).

## Bẫy đã gặp (nghiêm trọng)
- **`edit` khớp LẦN XUẤT HIỆN ĐẦU TIÊN**: thêm `'OpenClawClient'` vào `__all__` mà
  chuỗi đó xuất hiện lần đầu ở **registry**, không phải `__all__` ⇒ tuple `claude` thành
  **4 phần tử** ⇒ `ValueError: too many values to unpack` ⇒ **mọi** `get_ai_client()` hỏng.
  Chỉ hồi quy mới bắt (`ai_clients` + `routing_anthropic` + `test_ai_clients`).
  → Luôn đưa **ngữ cảnh đủ dài** vào `oldString` khi sửa Python.
- **`edit` làm mất thụt lề** khi thay hàm trong class (`def` còn 0 space) ⇒
  `IndentationError` làm hỏng cả 2 file test lớn. Lưu ý: có thể chạy `manage.py check`
  mà **không** bắt được lỗi này vì test file không được Django import lúc check.
- **Gọi hàm `async` không `await`** ⇒ thân hàm không chạy ⇒ `assertRaises` không bắt được
  lỗi. Đã sửa bằng `asyncio.run` + thêm test đồng bộ trên `resolve_config()`.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **16/16** · mgmt 30/30 · audit 27/27 · ai_clients 9/9 · copilot 25/25 ·
  anthropic 22/22 · breaker 20/20 · routing 22/22 · catalog 19/19 · pricing 22/22 ·
  budget 21/21 · usage 6/6 · config 9/9 · r06 4/4 · advisory_budget 12/12 = **273 test**.
- `manage.py check` 0 · pre-push 23/23 · openapi-budget NO CON Errors=32 · normalize-eol OK.

## CHƯA CHẠY (cần Owner)
- **D-03c**: 5 thông tin. Tới lúc có, `SUPPORTED_PROTOCOLS` vẫn rỗng và openclaw **luôn**
  fail-closed — đây là hành vi **đúng**, không phải thiếu sót.
- Danh mục model openclaw (`/models` hay tĩnh?) = D-03c#4.
- Nợ FE tồn dọn: `providerModels.ts` (bỏ `disabled` cho claude — D-03 cần Owner),
  AC4 nhóm "Đã xác minh"/"Chưa xác minh", nút "Tải lại danh mục", AC13 4 trạng thái + link
  `ghu_`, i18n.
- full BE ngoài scope · ruff · E2E · staging deploy.