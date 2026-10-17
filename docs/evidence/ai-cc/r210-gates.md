# R2.10 gates — danh mục model theo tài khoản + cache TTL (2026-10-17)

Branch `feat/ai-r210-catalog` ← `dev`. Claim `ai-r210`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1008-1033`.

## Fail-before
- `ModuleNotFoundError: No module named 'advisory.catalog'` (worktree VPS tại commit
  chỉ có claim) + endpoint `.../providers/<provider>/models/` không tồn tại.

## Thực hiện
- `advisory/catalog.py` (mới): `fetch_catalog()`, `ttl_seconds_for()`, `provider_note()`,
  `clear_catalog_cache()`. Khoá cache = `provider + sha256(credential)` — **không lưu key**.
- Endpoint `GET /core/v1/workspace/ai-command-center/providers/<provider>/models/`
  (`PortfolioAIProviderCatalogView`) + route `workspace-ai-cc-provider-models`.
- `test-connection`: provider **không** phải openai/gemini nay chạy qua `client.probe()`
  ⇒ **đóng nợ R2.4** (trước đó `copilot` rơi vào nhánh `else`, gửi token GitHub tới
  `api.openai.com` ⇒ 401 + thông điệp sai).
- `orchestrator._resolve_retry_policy()` — **đóng nợ R2.9**: giờ `RetryPolicy.from_deployment()`
  thật sự được gọi; truyền `policy=` xuống `call_agent_async` + synthesis.

## Quyết định (đã ghi)
- **Rỗng/lỗi/thiếu key ⇒ `models=[]` + `catalog_source="unavailable"`.** Không thay bằng
  danh sách tự chế ra. Endpoint có credential nhưng **giải mã hỏng** cũng rơi vào nhánh này
  (không làm 500) — user vẫn mở được trang cấu hình.
- **openai/gemini giữ probe chat-completions** (mạnh hơn `GET /models`), chỉ provider
  lệch chuẩn mới đi qua client. Đổi cả hai sẽ là thay đổi hành vi ngoài phạm vi slice.
- **Khoá cache theo credential**: danh sách của user A không lẫn user B. Có test chốt
  khoá cache **không chứa** bản thân key.
- TTL: copilot 1500s (bám vòng đời session token), khác 86400s.

## AC8 — CHƯA CHẠY (có bằng chứng, không đoán)

Yêu cầu: probe thật `gemini-3.8-flash` trên **hai** endpoint. Đã thử trong container
staging. Kết quả:

```
$ docker inspect vninvest-core-api → OPENAI_API_KEY/GEMINI_API_KEY/ANTHROPIC_API_KEY/
  COPILOT_TOKEN/GH_TOKEN/OPENCLAW_API_KEY: KHONG co (tat ca)

$ psql: advisory_useraicredential → 1 dong, ai_provider=gemini, encrypted_api_key<>''

$ python /tmp/probe-gemini38.py   (trong container staging, key giai ma tu DB)
ERROR identity_access.security: "Giải mã API Key thất bại: Khóa giải mã hoặc
        chữ ký Fernet không hợp lệ."
{"model": "gemini-3.8-flash", "credential_rows": 1,
 "error": "giai ma that bai: RuntimeError"}
```

⇒ **Cả hai vế đều không probe được**:
- Google trực tiếp: không có khoá dùng được (dòng DB **có** khoá nhưng Fernet của container
  staging không giải được ⇒ khoá được mã hoá bằng khoá khác, hoặc đã rotate).
- Copilot: không có token GitHub OAuth `ghu_` ⇒ không đổi được sang session token, không
  gọi được `{endpoints.api}/models`.

Không suy đoán kết quả. Câu hỏi audit "gemini-3.8-flash chưa ai probe" **vẫn mở** sau R2.10.

**Phát hiện phụ đáng lưu ý (vận hành):** staging có một `UserAICredential` mà **không giải
mã được**. Code xử lý đúng (log + trả `unavailable`, không 500), nhưng credential đó chết
mà không ai được báo. Nên có một luồng phát hiện credential hỏng — **ngoài phạm vi R2.10**,
ghi ra đây để không mất.

## AC4 / AC9 — CHƯA LÀM (nói rõ)
- **AC4 (UI nhóm "Đã xác minh"/"Chưa xác minh" + nút "Tải lại danh mục")**: FE. Endpoint đã
  sẵn sàng, chưa có UI.
- **AC9 (nhãn "chỉ dùng qua provider Copilot")**: **cơ chế BE đã có** — `provider_note()`
  + 3 test. Chưa có nơi gọi trong luồng thật vì cần kết quả AC8 để biết model nào chỉ có ở
  Copilot.

## Bẫy đã gặp
- **Lớp mới chèn sai chỗ nuốt `@extend_schema` của lớp kề** ⇒ schema của PolicyView đổi
  sang của lớp mới. `manage.py check` **vẫn xanh**; chỉ `openapi-budget` mới bắt.
- **`git checkout -- <file>` chỉ revert về HEAD, mà HEAD đã chứa bản chưa đúng** ⇒ chèn
  lần hai thành **hai lớp trùng tên**. Phải `git checkout origin/dev -- <file>`.
- Gate `openapi-budget` **chặn tăng lỗi schema** ⇒ endpoint mới phải khai
  `@extend_schema`; không nâng baseline.
- Regex `node -e` với `\r?\n[\s\S]*?` trong PowerShell **xoá mất tham số hàm**
  (`call_agent_async` mất signature) — dùng `edit` cho code Python.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **19/19** · ai_clients 7/7 · copilot 25/25 · breaker 20/20 · routing 22/22 ·
  pricing 22/22 · budget 21/21 · usage 6/6 · mgmt 30/30 · config 9/9 · policy 9/9 ·
  r06 5/5 · advisory_budget 12/12 = **207 test**.
- `manage.py check` 0 · `makemigrations --check` 0 · pre-push 23/23 · openapi-budget
  **NO CON: Errors=32** (đúng baseline) · normalize-eol OK.

## CHƯA CHẠY
- AC4 (UI) · AC8 (probe thật, xem trên) · AC9 (nơi gọi `provider_note`) · FE: nút "Tải lại
  danh mục", `providerModels.ts`, i18n.
- AC5 (FE): test-connection **tự động điền model từ danh mục** — phần BE đã đóng (provider
  lệch chuẩn probe qua client), phần chọn model trong UI chưa làm.
- full BE ngoài scope · ruff · E2E · staging deploy.