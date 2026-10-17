# R2 + M2 — đóng wave R2 (10/10 slice) (2026-10-17)

Nhánh `chore/ai-m2-closeout` ← `dev`. Claim `ai-m2`.
Mục đích: **đo lại trạng thái sau khi merge**, không tin số liệu từng slice báo.

## Vì sao có slice M2

Mỗi R2 slice đều GREEN riêng trên nhánh của nó. Nhưng `dev` là **hợp của 10 nhánh**,
mà R0.4 (readiness struct) và R2.5 (openclaw fail-closed) sửa **cùng một khái niệm**
(`ai_ready`) ở hai thời điểm cách nhau. Chỉ khi chạy trên code đã merge mới thấy mâu thuẫn.

**Đây là lỗi quy trình, không phải lỗi may mắn**: nếu M2 không chạy, R2 sẽ đóng với
`ai_ready` tự mâu thuẫn và 2 test khoá hành vi đã lỗi thời — mọi test vẫn xanh **vì
chưa ai chạy chúng cùng nhau**.

## 3 lỗi thật chỉ lộ khi merge (và 1 trong 3 là do chính tôi ở R2.5)

| # | Lỗi | Nguồn | Triệu chứng | Sửa |
|---|---|---|---|---|
| 1 | `ai_ready` có **hai nơi tính** khác nhau | R0.4 vs **R2.5 của tôi** | `test_get_has_readiness_struct_matching_ready`: `AssertionError: False != True` | `_ai_ready_flag()` + `readiness` tính **một lần**, dùng lại cho cả `ai_ready` lẫn `ai_readiness` |
| 2 | Test khoá `copilot` là "provider lạ" | R0.5 (gỡ copilot) vs R2.4 (bật lại) | `test_put_unknown_provider_400 (provider='copilot')`: `200 != 400` | `copilot` chuyển sang nhóm provider hợp lệ — **không bỏ assertion** |
| 3 | Allow-list `reason_code` thiếu `not_probed` | R0.4 (3 mã) vs R2.5 (thêm mã thứ 4) | `AssertionError: 'not_probed' not found in {...}` | Thêm `not_probed` — đây là hợp đồng R2.5 (plan `:207` đã liệt kê, `test_ai_client_openclaw.py:131,141` khẳng định 2 lần) |

Lỗi 1 là **regression do chính R2.5 của tôi**: `build_ai_readiness` đã đổi (openclaw
không còn "luôn sẵn sàng") nhưng hai chỗ tính `ai_ready` viết tay ở
`portfolio_analytics_views.py` không được sửa theo ⇒ R2.5 tự phá hợp đồng R0.4 mà
test R0.4 bắt được. **Đây là bằng chứng test của người khác bảo vệ được hợp đồng khi
tác giả mới không đọc lại.**

## Đo thật: 340 test / 27 module trên Postgres thật

Lần đầu **toàn bộ** test AI chạy trên kết quả merge (trước đó mỗi slice chỉ chạy
danh sách module của riêng nó):

```
bash /tmp/vps-m2-test.sh <27 module AI>     # DB ai_m2 @ 172.19.0.4, container vninvest-core-api:staging
Ran 340 tests — OK   (trước fix: FAILED failures=2 errors=5)
```

`errors=5` ban đầu **không phải bug** — tôi liệt kê 5 tên test theo *plan* thay vì tên
file thật (`ModuleNotFoundError`). Đã thay bằng danh sách 27 module có thật.

> Số liệu từng slice (69 · 91 · 104 · 146 · 131 · 206 · 207 · 230 · 273) **không cộng
> được và không so sánh được** — mỗi lần chạy một danh sách module khác nhau. 340 là
> con số duy nhất cùng cấu trúc so sánh được, và là baseline cho R3.

## 10/10 slice R2

| Slice | Nội dung | Entry | PR code | PR released | TDD RED → GREEN |
|---|---|---|---|---|---|
| R2.1 | `AIDeployment` + `AIFallbackChain` + resolver + admin | 352 | #205 | #206 | `ImportError` → 5/5 |
| R2.2 | `AiClient` + factory `get_ai_client` + `openai_compat` | 353 | #207 | #208 | `ModuleNotFoundError` → 6/6 |
| R2.3 | `AnthropicClient` native (mặc định **TẮT**) | 360 | #221 | #222 | `ModuleNotFoundError` + `FactoryError` → 22/22 |
| R2.4 | `CopilotTokenManager` + `CopilotClient` | 356 | #213 | #214 | `ModuleNotFoundError` → 25/25 |
| R2.5 | `OpenClawClient` **fail-closed** (STOP §3.4-6) | 361 | #223 | #224 | factory raise + readiness giả → 16/16 |
| R2.6 | `AIHealthCheck` + auto-evict + 3 chiến lược routing | 358 | #217 | #218 | `ModuleNotFoundError` → 22/22 |
| R2.7 | `AICostRate` + snapshot giá + `_resolve_cost` | 354 | #209 | #210 | `ModuleNotFoundError` → 22/22 |
| R2.8 | `AIBudget` 4 tầng × 3 chiều + soft_ratio 0.8 | 355 | #211 | #212 | module/model chưa có → 21/21 |
| R2.9 | `CircuitBreaker` + `RetryPolicy` + `complete_resilient()` | 357 | #215 | #216 | module chưa có → 20/20 |
| R2.10 | Endpoint danh mục model + cache TTL theo provider | 359 | #219 | #220 | `ModuleNotFoundError` + endpoint không tồn tại → 19/19 |

178 test mới trong R2. 20 PR (10 code + 10 released) · 10 commit claim trong `docs/CLAIMS.md`.

## Đổi hành vi user-facing (cố ý, ghi rõ)

User **không có** `UserAICredential` đi vào nhánh legacy
(`portfolio_analytics_views.py:1020`) với `provider` mặc định `'openclaw'`. Sau M2,
`ai_ready` của họ chuyển **`true` → `false`** với `reason_code='not_probed'`.

Đây đúng là ý R2.5: trước đó UI báo "sẵn sàng" cho dịch vụ **chưa từng được gọi**. FE đọc
`data.ai_ready` ở `AICommandCenterPage.tsx:110` và sẽ hiện trạng thái không sẵn sàng.
FE **không** switch theo `reason_code` (đã grep toàn `packages/web` — không có chỗ liệt
kê mã nào), nên **không cần sửa FE** cho lỗi này.

## Gate đã chạy (không suy diễn)

| Gate | Lệnh | Kết quả |
|---|---|---|
| BE test AI | `bash /tmp/vps-m2-test.sh <27 module>` (VPS Postgres) | **340/340 OK** |
| Django check | `manage.py check` (`PYTHONUTF8=1`) | 0 issue |
| pre-push | `git push` → `pre-push-gate` | **23 PASS / 0 FAIL** (gồm `openapi-budget` `Errors=32` không đổi) |
| Type-check | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0, `✓ built in 1m 5s` |
| DAG | `npm run check:ai-cc-dag` | PASS — 46 nút / 61 cạnh / 0 vòng / 0 dangling / 5 nút gốc |
| AI CC | `node scripts/check-ai-cc.mjs` | `check-ai-cc: SACH` |
| Lint | `npm run lint` | 0 error / 4067 warning (warning baseline có sẵn) |

## CHƯA CHẠY (không được báo là PASS)

- **R2.10 AC8** — probe thật `gemini-3.8-flash` (và endpoint Google trực tiếp): staging
  **không có** key trong env; dòng `UserAICredential` provider=gemini trong DB **không giải
  mã được** Fernet trong container staging; không có token `ghu_` nên không probe được
  Copilot. Câu hỏi "gemini-3.8-flash có thật sự còn dùng được không" **vẫn mở**.
- **R2.5 adapter openclaw thật** — chờ **D-03c** (5 thông tin từ Owner: base URL ·
  protocol · auth · nguồn danh mục · SLA). `SUPPORTED_PROTOCOLS = ()` cố ý.
- **Phần FE của R2** (AC4 nút "Tải lại danh mục", AC13 4 trạng thái + link `ghu_`,
  `providerModels.ts`, 6 i18n key × 2 locale, phần FE của AC5/AC9).
- `routing_decision` của R2.6 **chưa** ghi vào trace — chờ R3.1 `AITrace`.
- `cost_per_1k` chưa nối từ `AICostRate` (R2.7) sang budget (R2.8).
- Full BE ngoài advisory · `ruff` · E2E · staging deploy.
- Dòng credential gemini hỏng trong DB staging: **không có luồng nào báo** cho người dùng
  biết key của họ không giải mã được.

## Bẫy đã vấp trong slice này (đừng lặp lại)

1. **Chèn code giữa `@extend_schema` và `class`** ⇒ mất decorator ⇒
   `openapi-budget` FAIL `Errors 32 → 40`. `manage.py check` **không** bắt (decorator
   hỏng chỉ lộ khi spectacular dựng schema). Sửa bằng cách dời helper **lên trên**
   decorator; phải đọc lại `openapi-budget` sau mọi lần chèn hàm vào file view.
2. **`git grep`/PowerShell hiển thị tiếng Việt thành `?`** — đây là **giả** (console
   cp1252), file UTF-8 hoàn toàn đúng. Đã suýt sửa nhầm. Kiểm chứng bằng `read` tool
   hoặc đếm byte, **không** tin output console.
3. **Tên test trong plan không phải tên file thật** — 5 `ModuleNotFoundError` là do tôi
   liệt kê theo plan. Luôn `ls` thư mục test trước khi đặt danh sách.
4. `edit` khớp **lần xuất hiện đầu tiên** — mọi lần sửa Python phải đưa `oldString` đủ
   dài để không trúng chuỗi trùng (đã gặp ở R2.5: làm registry thành 4 phần tử).

## Kết luận

**R2 đóng: 10/10 slice, code đã merge `dev`, 340/340 test xanh trên Postgres thật.**
Đã sửa 3 lỗi chỉ lộ khi đo lại sau merge. Mở sang **R3.1 `AITrace`** — vừa là nơi nối
`routing_decision` (nợ R2.6), vừa là nền cho AC13/audit của R3.