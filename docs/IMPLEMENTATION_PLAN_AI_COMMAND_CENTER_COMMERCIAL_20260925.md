# KẾ HOẠCH THỰC HIỆN — AI COMMAND CENTER (`/settings/ai`) ĐẠT CHUẨN THƯƠNG MẠI QUỐC TẾ

**Ngày lập:** 2026-09-25 · **Bản:** Rev.1 · **Bám sát:** `docs/AUDIT_AI_COMMAND_CENTER_20260925.md` (ledger Entry 228)
**Phạm vi:** 46 slice / 6 wave / **~130-165 engineer-day** (89-108 ed kỹ thuật thuần)
**Đối tượng bàn giao:** đội code BE + FE. Mọi quyết định kiến trúc đã khoá ở §1 — **không cần hỏi lại**.
**Chuẩn áp dụng:** OWASP ASVS 5.0 (Access Control / Validation / API families) · OWASP API Security Top 10 2023 · OWASP Top 10 2021 A10 SSRF · NIST AI RMF 1.0 · ISO/IEC 42001:2023 · ISO/IEC 23894:2023 · ISO/IEC 25010:2023 · ISO/IEC 25012:2008 · WCAG 2.2 AA · RFC 9457 · RFC 9110 · OpenAPI 3.1 · PIPL 13/2023 (Việt Nam)

---

## §0. QUY TẮC BẮT BUỘC CHO ĐỘI CODE

### 0.1 Thứ tự tuyệt đối

```
R0 (P0 an toàn + contract) → R1 (design system + i18n + gate) → R2 (failover + budget cost)
   → R3 (observability + eval) → R4 (governance tenant) → R5 (dọn nợ)
```

1. **R0.1, R0.2, R0.3 = CÙNG MỘT PR.** Tách ra sẽ tạo khoảng thời gian mà `ai_model` đúng nhưng `prompt_config` sai, hoặc ngược lại.
2. **Không mở ticket R1+ khi R0 chưa xanh toàn bộ.** Sửa UI trước khi sửa contract là xây trên nền móng sai.
3. **Mỗi slice = 1 PR, 1 entry ledger.** Không cherry-pick, không gộp wave.

### 0.2 Quy tắc code

| # | Quy tắc | Căn cứ |
|---|---|---|
| BR-01 | Mọi khẳng định trong PR description kèm `file:line` | AGENTS.md §Audit Framework, Nguyên tắc 1 |
| BR-02 | Không `alert()`; lỗi inline hoặc toast | Entry 87 (COC-38) |
| BR-03 | Mọi chuỗi qua `t()`; **không** dùng `t(k) \|\| "fallback"` | `i18n/index.js:41-42` trả `String(key)` ⇒ `\|\|` là dead code |
| BR-04 | Màu/khoảng cách qua design token; **không** hex trong TSX | `check-tokens.mjs` chỉ quét `.css` — TSX không bị gate bắt |
| BR-05 | BE: không validate ⇒ không nhận. Input → validate + `ValidationError` trước khi ghi DB | `portfolio_analytics_views.py:665-669` hiện `pass` nuốt lỗi |
| BR-06 | Test BE đặt **flat** trong `packages/core/backend/tests/test_*.py` | Entry 227 Blocker 1 |
| BR-07 | Migration **chỉ thêm file mới**, không sửa file đã chạy | Entry 227 Blocker 6 |
| BR-08 | Comment tiếng Việt giải thích **tại sao**, không **làm gì** | repo convention |
| BR-09 | Không nới throttle toàn cục; thêm scope riêng | `settings.py:262-284` |
| BR-10 | Không log/persist plaintext API key; không echo endpoint nội bộ cho user | `portfolio_analytics_views.py:894,906,989` đang làm ngược lại |

### 0.3 Cổng chất lượng — lệnh chính xác

**Host (packages/web):**
```powershell
npx tsc --noEmit
npm run lint
npx vitest run
npm run check:shell
npm run build
```

**Host (packages/core/backend — CẦN DATABASE):**
```powershell
$env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,testserver"
python manage.py check
python manage.py makemigrations --check --dry-run
python -m pytest tests/test_ai_*.py -q
```

**Container:**
```bash
docker compose -f docker-compose.dev.yml exec core-api python src/manage.py check
docker compose -f docker-compose.dev.yml exec core-api python src/manage.py test tests.test_ai_cc_config_isolation
```

> **Cảnh báo trung thực (Entry 228):** audit chạy `pytest` trên host **không kết nối được Postgres** → 71 errors. Đó là **hạ tầng**, không phải lỗi test. **Không được ghi "BE test PASS" nếu chưa chạy trên nơi có DB.** Báo cáo phải ghi rõ: `BE: PASS (container core-api)` hoặc `BE: NOT VERIFIED — no DB`.

Celery app: `celery -A vninvest_core` (`src/vninvest_core/celery.py:14`) — **không** dùng `celery -A config` (Entry 227 Blocker 3).

### 0.4 Định nghĩa "minh chứng" (bắt buộc mỗi slice)

Mỗi slice tạo `docs/evidence/ai-cc/<SLICE-ID>/gates.md` chứa:

1. **Output thật của từng lệnh gate** (copy stdout, không tóm tắt).
2. `git diff --stat` + `git diff --check` (0 whitespace error).
3. **Với finding P0/P1:** dán output **RED** (test fail chứng minh bug có thật) trước khi sửa, **GREEN** sau khi sửa. Không chấp nhận "tin tôi đã sửa".
4. **Với thay đổi security:** bảng vector đã thử bị chặn + response thật.
5. **Với thay đổi UI:** ảnh light + dark + EN + VI cho từng route bị ảnh hưởng.
6. **Đối chiếu ngược:** 1 dòng "claim này có thể sai vì…" hoặc "đã kiểm chứng vì…".

---

## §1. QUYẾT ĐỊNH KIẾN TRÚC ĐÃ KHOÁ (D-01 → D-07)

> Bảy câu hỏi mở của audit đã **quyết định sẵn** dựa trên bằng chứng code. Đội code **không cần hỏi lại**. Muốn đảo quyết định thì sửa §1 — các slice downstream đã tham chiếu.

### D-01 · Phân quyền: **BYOK self-service + system/policy staff-only**

| Lớp | Ai được phép | Nội dung |
|---|---|---|
| **A — Self-service** | mọi user xác thựn | provider, model, API key **của họ**, temperature, token/ngày, refresh interval, prompt config **của họ**, nhật ký **của họ** |
| **B — System/Policy** | staff hoặc `ai.policy.manage` | `SystemAISettings`, org policy, nhật ký tenant, danh mục model hệ thống, phím hệ thống |

**Bằng chứng:** `identity_access/views/helpers.py:148-150` — `WhaleAdvisory` chỉ cấp paid plan ⇒ tính năng người dùng tiêu thụ, không phải công cụ vận hành. `UserAICredential` là `OneToOneField(User)` (`advisory/models.py:213-218`) ⇒ BYOK vốn dĩ per-user. Menu FE đã là user-level (`sidebaritems.ts:36`).

**Phản biện & giải quyết.** *Entry 179 (audit tenant) ghi F5 "`/settings/ai` không staff-guard" là HIGH, và `helpers.py:193` chỉ expose route cho staff. Tại sao đảo ngược kết luận?*
→ Vì Entry 179 đọc **route exposure** làm tín hiệu ý định, audit này đọc **model dữ liệu** làm tín hiệu ý định. `UserAICredential` per-user là bằng chứng mạnh hơn một danh sách route. Kết luận của Entry 179 **không sai** — chỉ là **giải pháp khác**: tách lớp thay vì khoá cả trang. Đóng lỗ hổng mà không phá tính năng thương mại. Slice R0.9 hiện thực và test chứng minh 2 lớp có phạm vi khác nhau.

### D-02 · Shape chuẩn `ai_prompt_config` = **`{version: 2, sources: {...}}`**

`_get_default_prompt_config()` (`advisory_helpers.py:38-52`) là SSOT duy nhất. API **từ chối** shape phẳng với `400` + `error_code='prompt_config_invalid_shape'`. Migration sửa row phẳng đã tồn tại.

**Bằng chứng:** `orchestrator.py:127-128` → `_parse_prompt_config(...)["sources"]` là đường đọc duy nhất của runtime; nó yêu cầu `sources` (`advisory_helpers.py:99-101`).

**Phản biện & giải quyết.** *"Cứ để `_parse_prompt_config` fallback về default như hiện tại — ít việc hơn, user không mất gì vì default hợp lý."*
→ Sai. Đó chính là bug: hiện tại **mọi** cấu hình user đều bị thay bằng default mà không ai biết. Thêm nữa `test_ai_cc_config_isolation.py:60` và `test_ai_cc_prompt_history.py` **đang assert shape phẳng** — bộ test hiện tại đang *bảo vệ* bug. Sửa test cùng lúc; 18 assertion nằm trong budget R0.2.

### D-03 · Chính sách provider — **REV.2 (2026-09-25, ghi đè Rev.1)**

> **Lý do rev.** Bản Rev.1 đề xuất gỡ `openclaw` + `copilot`. **Đã bị phản biện và sai** — tôi chỉ nhìn `orchestrator.py` (3 nhánh endpoint) rồi kết luận "không hỗ trợ", bỏ sót hai bằng chứng ngược lại: (a) `advisory/model_choices.py:15-16` cố ý đặt `openclaw`/`copilot`/`local` vào `FREEFORM_PROVIDERS` với comment *"model do hạ tầng quyết định"*; (b) `docs/ADVISORY_OBSERVABILITY_ARCHITECTURE.md:154-155` đã có bảng alias `'copilot': 'openai/gpt-4.1-mini'`, `'openclaw': 'default'`. **Chưa có transport ≠ không nên có trong danh sách.** Cả hai provider **là thật và phải làm**, chỉ là chưa có client.

**Quyết định Rev.2: cả 6 provider đều giữ. Mỗi cái đi vào 1 slice riêng.**

| Provider | Trạng thái | Kết luận | Căn cứ |
|---|---|---|---|
| `openai` | CÓ client | giữ | `orchestrator.py:317` (nhánh else) |
| `gemini` | CÓ client | giữ | `orchestrator.py:314` |
| `local` | CÓ client | giữ + SSRF guard | `orchestrator.py:309` |
| `claude` | **thiếu client** | **giữ trong UI, tạm disabled + badge**, bật ở **R2.3**. Đã có validation (`model_choices.py:14,31` `CLAUDE_PREFIXES`) + downgrade map | Thiếu transport, ~3 ed |
| `copilot` | **thiếu client, đã xác nhận là provider thật** | **làm provider chuẩn đầy đủ ở R2.4**: token exchange + catalog sống theo tài khoản + enterprise base URL | Xem mục D-03b |
| `openclaw` | **thiếu client, là DỊCH VỤ NỘI BỘ THẬT** | **làm client thật ở R2.5 — BLOCKED chờ spec**, xem D-03c | Xem mục D-03c |

**Đồng thời bắt buộc (quan trọng hơn việc bật UI):**

1. **Sửa default provider.** `openclaw` đang là **default ở 6 nơi** — BE `portfolio_analytics_views.py:469`, `:472`; FE `AICommandCenterForm.tsx:129,171,174`; `AICommandCenterPage.tsx:66`; i18n `defaultAiProvider: 'openclaw'` (vi.js:4408, en.js:4396); migration `0004:63`. User mới → `openclaw` → `orchestrator.py:154-157` `is_mock` → `raise ValueError` khi `DEBUG=False`. Cho tới khi R2.5 xong, **default phải là `openai`**, và `openclaw` phải báo `state="unverified"` chứ không phải "Sẵn sàng".
2. **Xoá test khẳng định hành vi giả.** `tests/test_ai_management_center.py:283-286` (`test_openclaw_returns_success`) và `tests/test_ai_audit_logs.py:242-245` **đang khoá hành vi "luôn 200, latency 0"**. Phải đổi thành test buộc openclaw **probe thật** và trả `503` khi dịch vụ chưa cấu hình.
3. **Nối `model_choices.py` vào CC PUT.** Grep xác nhận: **không nơi nào import `model_choices`** — nó là **code chết** 108 dòng. R0.5 phải dùng nó thay vì viết validator mới.

#### D-03b · `copilot` là provider chuẩn — kỹ thuật bắt buộc (đã tra cứu, không đoán)

**KHông phải** OpenAI-compatible với khoá của bạn. Cần **2 bước**:

```
Bước 1 — đổi token:
  GET https://api.github.com/copilot_internal/v2/token
    Authorization: token <github_oauth_token_ghu_>
    (khuyến nghị thêm: User-Agent, Editor-Version, Editor-Plugin-Version,
     Copilot-Integration-Id: vscode-chat, X-GitHub-Api-Version: 2025-04-01)
  → 200 { token: "tid=...;exp=...", endpoints: { api: "https://api.githubcopilot.com" },
           expires_in: ~1500 (≈25 phút) }

Bước 2 — gọi model:
  POST {endpoints.api}/chat/completions        ← LẤY TỪ token response, KHÔNG hardcode
    Authorization: Bearer <session_token>
    Copilot-Integration-Id: vscode-chat        ← BẮT BUỘC, thiếu là 401
    Content-Type: application/json
    body: dạng OpenAI chat completions
```

**4 điểm bẫy đã xác minh, phải xử lý riêng (không được báo chung "API key không hợp lệ"):**

| Bẫy | Hiện tượng | Xử lý bắt buộc |
|---|---|---|
| **PAT không đổi được token** | `copilot_internal/v2/token` trả **404** với PAT thường | `error_code='copilot_token_exchange_failed'`, message nói rõ *"cần GitHub OAuth token (ghu_), không phải PAT"* — **không** dùng thông báo 401 chung |
| **Sai OAuth client_id** | GitHub App client_id cũng 404 dù có Copilot sub | Ghi rõ trong hướng dẫn UI: dùng OAuth client id `Iv1.b507a08c87ecfe98` (VS Code) |
| **Token hết hạn 25 phút** | Sau `expires_in` mọi request 401 | Cache session token, refresh **sớm 60 s**; `CopilotTokenManager` với `threading.Lock` |
| **Enterprise base URL khác** | `api.githubcopilot.com` bị chặn với Enterprise | **Bắt buộc** đọc `endpoints.api` từ token response; cho phép override qua `COPILOT_API_BASE_URL` |

**Model — trả lời câu hỏi của bạn (nguồn: `docs.github.com/copilot/reference/ai-models/supported-models`, tra cứu 2026-09-25):**

| Nhà cung cấp | Model trong Copilot (release status) |
|---|---|
| **OpenAI** | GPT-5 mini, GPT-5.3-Codex, GPT-5.4, GPT-5.4 mini, GPT-5.4 nano, **GPT-5.5**, **GPT-5.6 Luna**, **GPT-5.6 Sol**, **GPT-5.6 Terra** — tất cả GA |
| **Anthropic** | Claude Haiku 4.5, Claude Sonnet 4.5, **Claude Sonnet 5**, Claude Opus 4.5 / 4.6 / 4.7 / 4.8, **Claude Opus 5**, Claude Fable 5, Claude Fable 5.1 |
| **Google** | Gemini 3.1 Pro (public preview), Gemini 3.5 / 3.6 / 3.7 / **3.8 Flash** (GA) |
| **Microsoft** | MAI-Code-1-Flash, MAI-Code-1.1-Flash |
| **xAI** | Grok 4.5, Grok 4.6 |
| **Moonshot** | Kimi K2.7 Code, Kimi K3 |
| **Fine-tuned** | Raptor mini |

**Ba kết luận quan trọng từ bảng này:**

1. **Copilot là gateway đa nhà cung cấp.** Qua Copilot, bạn dùng được Claude/Gemini/Grok/Kimi mà không cần API key riêng. Đây là lý do nó đáng là provider chuẩn cho sản phẩm VN, nơi người dùng cá nhân sẵn có Copilot sub.
2. **Danh mục phụ thuộc GÓI + TÀI KHOẢN.** GitHub công bố bảng "Supported AI models per Copilot plan" (Pro / Pro+ / Max / Business / Enterprise) — tài liệu cũng nêu rõ không có danh sách cố định vì *"availability is gated by GitHub server-side based on subscription, org membership, and feature flags"*. ⇒ **Bắt buộc** lấy danh mục sống từ `GET {endpoints.api}/models` bằng session token, cache ~25 phút (cùng vòng đời token), lọc `policy.state` / `model_picker_enabled`. Hardcode danh sách trên vào `providerModels.ts` là **sai** — sẽ hiện model user không có quyền dùng.
3. **Về `gemini-3.8-flash` — minh bạch mức độ chắc chắn (sửa lần 2).**
   - **Model thuộc Google.** Gemini 3.8 Flash là model của Google, GA, có thật. Xuất hiện trong catalog Copilot vì Copilot là **gateway đa nhà cung cấp** (nó cũng phục vụ GPT của OpenAI, Claude của Anthropic, Grok của xAI, Kimi của Moonshot) — **không có nghĩa Copilot sở hữu model này**.
   - **Điều chưa xác minh, và cần nói đúng:** mỗi gateway có **bộ model ID riêng**, không nhất thiết trùng ID chính thức của hãng. Bằng chứng: đã gặp trường hợp `api.githubcopilot.com` **không** phục vụ các ID cũ (`claude-sonnet-4.5`, `claude-opus-4`, `gpt-5`, `o3-mini`), buộc phải sửa danh sách theo đúng ID Copilot trả về; kiến trúc alias kiểu `openai/gpt-4.1-mini` cũng đã có trong `ADVISORY_OBSERVABILITY_ARCHITECTURE.md:154`.
   - ⇒ **Chưa trả lời được:** endpoint Google trực tiếp `generativelanguage.googleapis.com/v1beta/openai/chat/completions` có chấp nhận đúng ID `gemini-3.8-flash` không. Entry 204 F6b ghi *"blocked proxy test"* — tức **chưa từng ai probe**. Đây là lý do R2.10-AC8 probe **cả hai** endpoint.
   - **Tự sửa lỗi diễn đạt của chính plan Rev.1:** Rev.1 và audit F-33 viết *"có thể không tồn tại"*. Audit **đúng** ở chỗ nó kết luận "cần probe"; nhưng Rev.1 diễn đạt thành **nghi ngờ model không tồn tại**, và bản sửa đầu tiên của tôi lại đẩy theo hướng ngược lại ("audit sai") — **cả hai đều diễn đạt quá**. Sự thật chỉ là: **chưa ai kiểm chứng**. Viết lại thành "chưa xác minh" thay vì "sai/đúng".
   - **Kết luận hành động (không phụ thuộc kết quả probe):** nếu Google trực tiếp **không** có mà Copilot **có** ⇒ **giữ model**, gắn nhãn *"chỉ dùng qua provider Copilot"*. Không xoá khỏi danh sách.

#### D-03c · `openclaw` — BLOCKED chờ spec, không phải chờ quyết định

Owner xác nhận đây là **dịch vụ nội bộ thật**. Tôi đã grep toàn repo: **45 khớp, tất cả chỉ là *tên* trong enum provider** ("system default", "không cần key"). **Không có** URL, env var, port, client, spec, hay package nào cho dịch vụ này.

Theo AGENTS.md (Nguyên tắc 2/3: không đoán, không bịa), tôi **không bịa endpoint**. Slice R2.5 được viết sẵn với đầy đủ AC, nhưng đánh dấu **BLOCKED** cho tới khi có 5 thông tin sau — đây là danh sách cần cho **bạn** cung cấp, không phải đội code tự suy:

| # | Cần biết | Ví dụ định dạng | Vì sao chặn |
|---|---|---|---|
| 1 | Base URL | `http://openclaw.internal:8000/v1` (nội bộ) hoặc public | Không có thì không gọi được |
| 2 | Giao thức | OpenAI-compatible `/chat/completions`? Anthropic `/v1/messages`? RPC riêng? | Quyết định viết adapter hay chỉ cấu hình endpoint |
| 3 | Xác thực | không cần key? Header cố định? OAuth? token nội bộ? | Quyết định có cần mục trong `UserAICredential` không |
| 4 | Danh mục model | endpoint `/models` trả về, hay danh sách tĩnh? | Quyết định `FREEFORM_PROVIDERS` còn đúng không |
| 5 | SLA + hạn mức | timeout, rate limit, auth key dùng chung hay BYOK | Quyết định có tách sang lớp B (system/policy) không |

**Nếu OpenClaw là dịch vụ nội bộ dùng chung (không phải BYOK):** nó thuộc **lớp B — system/policy staff-only** (theo D-01), key nằm ở `SystemAISettings.metadata`, không để user tự nhập. Đó là mô hình đúng và an toàn hơn. Nếu mỗi user có credential riêng trên dịch vụ nội bộ thì vẫn giữ lớp A.

**Trong lúc chờ (2 việc làm được ngay, không phụ thuộc spec):**
- Sửa default `openclaw` → `openai` (D-03 mục 1) — chặn P0 ngay.
- Sửa `test_openclaw_returns_success` thành test fail-closed (D-03 mục 2).



### D-04 · `ai_ready` = probe có TTL, không suy đoán

```json
{ "ai_ready": false,
  "ai_readiness": {
    "state": "unverified|ready|degraded|blocked",
    "reason_code": "missing_api_key|provider_not_supported|provider_model_mismatch|not_probed|ok",
    "checked_at": "2026-09-25T08:00:00Z",
    "expires_at": "2026-09-25T08:15:00Z",
    "latency_ms": 812, "detail": null } }
```

`ai_ready` boolean giữ tương thích. TTL mặc định 15 phút (`AI_READINESS_TTL_SECONDS`).

**Phản biện & giải quyết.** *"Probe thật tốn tiền và chậm — mỗi lần mở trang đều gọi provider."*
→ Đúng, nên probe **không** chạy trong request. R0.4 chỉ làm **validate tĩnh** + hiện `state="unverified"` trung thực kèm nút "Kiểm tra ngay" (đã có sẵn). Probe thật đặt ở R2.7 + task định kỳ. R0 không giả vờ có gì mà không có.

### D-05 · Budget: **cost (USD) là chính, token là phụ**

Thêm `AICostRate` (model → USD/1K token, snapshot theo ngày, `pricing_source`). UI hiển thị cả hai, quy đổi 2 chiều bằng bảng giá mới nhất.

**Bằng chứng:** `ai_analytics/models.py:23` (`cost` — `DecimalField(max_digits=12, decimal_places=6, verbose_name='Chi phí (USD)')`) cho thấy ý định USD đã có nhưng **chưa ai ghi**.

**Phản biện & giải quyết.** *"Thêm bảng giá là việc lớn, giá model đổi thường xuyên — sẽ sai."*
→ Nhân với giá sai thì sai; nhân với **không có giá** cũng sai và tệ hơn (hiện tại). Snapshot theo ngày + `pricing_source` rõ ràng + UI hiện "giá cập nhật lúc …". Trong R0, Usage hiển thị `$` kèm `pricing_available=false` khi chưa có bảng giá — **không bịa số 0**.

### D-06 · Quy ước lệnh test BE

| Môi trường | Lệnh |
|---|---|
| Host có DB | `cd packages/core/backend; $env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,testserver"; python -m pytest tests/test_ai_*.py -q` (pytest.ini ở `packages/core/pytest.ini`) |
| Container | `docker compose -f docker-compose.dev.yml exec core-api python src/manage.py test tests.test_ai_cc_...` |
| Celery | `celery -A vninvest_core` |

Entry 227 Blocker 1/2/3 đã ghi đúng 3 sai lầm này; Entry 228 tái hiện lỗi `ImproperlyConfigured: DJANGO_ALLOWED_HOSTS`.

### D-07 · Gate AI CC

1. Tạo `packages/web/scripts/check-ai-cc.mjs`: mọi `t()` literal trong 9 file AI CC tồn tại ở **cả** `vi.js` và `en.js`; 0 key chết; 0 `t(...) || "`; 0 hex trong AI CC `.tsx`/`.ts`; 8 testid form bắt buộc còn.
2. Nối vào `npm run check:shell` (sau `check:tokens`).
3. `check-shell.mjs`: xoá assert sai dòng 150 (`getPageComponent("ai-command-center") === ShellAiCommandCenterPage` — registry map `AICommandCenterPage`), chuyển assert AI CC còn lại sang vitest, gắn `DEPRECATED` như `check:shell:legacy`.

**Phản biện & giải quyết.** *"`i18n:scan` đã chạy rồi, thêm gate là thừa."*
→ `i18n:scan` chỉ quét **literal** trong source, không verify key tồn tại — bằng chứng `aiCommandCenter.loadError` thiếu ở cả 2 locale mà `i18n:scan` vẫn exit 0 và parity test vẫn xanh. Gate mới kiểm thứ `i18n:scan` không kiểm.

---

## §2. SLICE CATALOG

> Mỗi slice có 9 mục: **Yêu cầu · File · AC · Minh chứng · Phản biện · Tiêu chuẩn · Rủi ro · Ước lượng · Phụ thuộc**.
> Ước lượng = engineer-day, đã gồm test + gate + evidence, **không** gồm thời gian review.

---

## WAVE R0 — P0: AN TOÀN + CONTRACT (15.5-18.5 ed)

**Exit criteria:** 9 slice GREEN; test BE chạy trên môi trường có DB; 5 finding P0 có output RED→GREEN trong evidence.

### R0.1 · `ai_model` người dùng chọn phải được dùng khi sinh advisory

**Yêu cầu.** `effective_context['ai_model']` ưu tiên `UserAICredential.ai_model`, fallback `SystemAISettings.ai_model`. `effective_ai_model` trong GET/PUT lấy từ **cùng một nguồn** để UI không hiển thị sai.

**File.** `advisory/views.py:430-444` (dựng `effective_context`), `:535` (`AdvisorySession.ai_model`) · `advisory/tasks.py:72` · `portfolio_analytics_views.py:450,535,598,722-723` (3 chỗ đọc `model` → gộp về 1 helper) · **mới** `tests/test_ai_effective_model_contract.py`

**AC**

| # | Điều kiện kiểm chứng | Cách kiểm |
|---|---|---|
| AC1 | `UserAICredential(ai_model='gemini-2.5-pro')` + system `'gpt-4o-mini'` → `effective_context['ai_model'] == 'gemini-2.5-pro'` | `test_user_model_wins_over_system` — **RED trước fix** (pre-fix nhận `'gpt-4o-mini'`) |
| AC2 | `ai_model=''` → `'gpt-4o-mini'` | `test_empty_user_model_falls_back_to_system` |
| AC3 | `generate_advisory_task` nhận `ai_model` = giá trị user | mock `.delay()`, assert kwargs |
| AC4 | `AdvisorySession.ai_model` và `AdvisoryRecord.ai_model` = giá trị user | assert field sau POST `/advisory/<sym>/refresh/` |
| AC5 | GET CC trả `effective_ai_model` == `ai_model` khi có user_cred | `test_get_effective_model_matches_user_model` |
| AC6 | Không còn chỗ nào đưa `ai_settings.ai_model` vào effective context ngoài dòng fallback có comment | `grep -n "ai_settings.ai_model" src/advisory/` |

**Minh chứng.** Output RED của AC1 (nguyên văn) + GREEN sau fix; `git diff` `views.py:430-444`; xác nhận `tasks.py:72` không ghi đè bằng giá trị khác.

**Phản biện.** *"Đổi `ai_model` theo user là thay đổi hành vi sản phẩm — có thể làm hỏng advisory đang chạy tốt vì system model chọn kỹ hơn."*
→ Rủi ro thật. Giải quyết: (a) `UserAICredential.ai_model` mặc định `''` ⇒ **user chưa chọn gì thì hành vi y hệt hiện tại**, không regression; (b) feature flag `AI_ALLOW_USER_MODEL_OVERRIDE` (mặc định `true`, `env_validation.py` fail-closed nếu giá trị sai) để tắt nhanh; (c) AC4 đảm bảo lỗi lộ ra ở tầng record, không âm thầm.

**Tiêu chuẩn.** ISO/IEC 25010:2023 — *Functional suitability*. **Rủi ro.** Thấp. **Ước lượng:** 1.0 ed. **Phụ thuộc:** không (làm đầu tiên).

### R0.2 · Chuẩn hoá shape `ai_prompt_config` + migration + sửa 18 assertion

**Yêu cầu.** (1) Default BE dùng `_get_default_prompt_config()`. (2) PUT từ chối shape không có `sources` với `400` + `error_code='prompt_config_invalid_shape'`. (3) Migration `0011` chuyển row phẳng → `{version:2, sources:{…}}`, giữ nguyên `lookback`/`enabled`/`indicators`. (4) Sửa **18 assertion** đang bảo vệ shape phẳng.

**File.** `portfolio_analytics_views.py:422-439, 630-636` · `advisory_helpers.py` (thêm `is_valid_prompt_config(raw)`) · **mới** `advisory/migrations/0011_canonicalize_prompt_config.py` · sửa test `test_ai_cc_config_isolation.py:60,104-122,136,151,184` + `test_ai_cc_prompt_history.py:56,74,106,109,111,125,141,147-148` · **mới** `tests/test_ai_prompt_config_shape.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | GET khi user chưa có `UserAICredential` trả `version == 2` và `sources` dict đủ 8 key | `test_get_returns_canonical_shape` — **RED trước fix** (pre-fix không có `version`) |
| AC2 | PUT `{'ai_prompt_config': {'whale': {'lookback': 30}}}` → `400` + `error_code='prompt_config_invalid_shape'`, **`UserAICredential.prompt_config` không đổi** | `test_flat_shape_rejected_400_and_no_write` — **RED trước fix** (pre-fix 200) |
| AC3 | PUT shape hợp lệ → 200, `_parse_prompt_config(response)` **giữ nguyên** giá trị user | `test_valid_config_survives_parse` — test bảo vệ khỏi tái phát |
| AC4 | Sau migration: mọi `UserAICredential.prompt_config` có `sources`, `version == 2` | `MigratorTestCase` — `test_migration_converts_flat_rows` |
| AC5 | Row đã đúng shape không bị sửa (idempotent) | chạy migration 2 lần |
| AC6 | 18 assertion cũ đã đổi và PASS | `pytest tests/test_ai_cc_config_isolation.py tests/test_ai_cc_prompt_history.py -q` → OK, dán output |
| AC7 | `lookback_unit` không còn trong bất kỳ response nào | `grep -rn "lookback_unit" src/ packages/web/src` → 0 |
| AC8 | `makemigrations --check --dry-run` sạch | gate |

**Minh chứng.** RED của AC1+AC2+AC3 trước khi sửa; migration chạy trên copy DB dev, output `Applying advisory.0011... OK` + đếm row trước/sau; `makemigrations --check` exit 0.

**Phản biện.** *"Migration sửa dữ liệu production là việc rủi ro; sao không để `_parse_prompt_config` chịu lỗi như hiện tại?"*
→ Hiện tại **không** "chịu lỗi", nó **bỏ qua toàn bộ cấu hình**. Bỏ migration ⇒ row phẳng tồn tại và R0.3 phải xử lý 2 shape lâu dài. Giảm rủi ro: (a) migration chỉ đọc-ghi JSONField, không drop/add cột; (b) `--dry-run` báo cáo số dòng đổi trước khi commit; (c) `lookback` không parse được thì **giữ nguyên giá trị cũ** + set `enabled=True` — không xoá dữ liệu.

**Tiêu chuẩn.** ISO/IEC 25010 — *Data integrity*; ISO/IEC 23894:2023. **Rủi ro.** Trung bình. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R0.1 (cùng PR).

### R0.3 · FE chỉ gửi `ai_prompt_config` khi người dùng thực sự thay đổi

**Yêu cầu.** Bỏ `setPromptConfig(data.ai_prompt_config)` ở `handleFormSettingsChange`. Drawer **tự tải** config khi mở qua callback `onRequestConfig` (lazy) thay vì nhận qua props từ lúc load trang. Chỉ gửi field khi dirty. Chuẩn hoá merge về shape `{version, sources}`.

**File.** `AICommandCenterPage.tsx:94-100, 269-270` · `AICommandCenterForm.tsx:102-110` (prop `onRequestConfig`) · `AIAdvisoryPromptConfigDrawer.js:36-49, 172-177` · **mới** `__tests__/ai-cc-prompt-config-dirty.component.test.ts`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Mở `/settings/ai`, bấm "Lưu cấu hình" **không mở drawer** → payload PUT **không** chứa `ai_prompt_config` | mock adapter, assert key vắng — **RED trước fix** |
| AC2 | Mở drawer, đổi 1 slider, Lưu → payload **có** shape `{version:2, sources:{…}}` | assert shape |
| AC3 | Mở drawer, đóng không đổi, Lưu → payload **không** chứa field | test |
| AC4 | Drawer nhận config shape phẳng (user chưa migrate) vẫn hiện **giá trị thật** | input `{'whale':{lookback:180}}` → slider = 180 — **RED trước fix** (pre-fix hiện 30) |
| AC5 | Preset giữ `version: 2` | `test_preset_keeps_version` — **RED trước fix** (`:175` mất `version`) |
| AC6 | 2 sub-route không đổi hành vi | vitest regression |

**Minh chứng.** RED/GREEN AC1, AC4, AC5; `git diff` 4 file; ảnh drawer trước/sau.

**Phản biện.** *"Bỏ set state từ GET thì drawer mất dữ liệu để hiển thị — user sẽ thấy toàn default."*
→ Đúng nếu chỉ bỏ set. Giải pháp bắt buộc: drawer **tự tải** khi mở (lazy), vừa sửa AC1 vừa giữ AC4. Không được chỉ xoá dòng.

**Tiêu chuẩn.** ISO/IEC 25010 — *Functional suitability*, *Usability*. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R0.2 (cùng PR).

### R0.4 · Readiness thật: validate tĩnh + struct có cấu trúc

**Yêu cầu.** Thêm `ai_readiness` struct (D-04). `state="unverified"` khi chưa probe. Validate tĩnh cặp provider/model. `ai_ready` boolean giữ tương thích nhưng **không** dùng `provider in ('openclaw','local')`. UI hiện 4 trạng thái với `aria-live="polite"`.

**File.** `portfolio_analytics_views.py:490, 725` (thay bằng 1 helper) · `advisory/advisory_helpers.py` (mới: `resolve_ai_readiness()`) · `AICommandCenterForm.tsx` + `AICommandCenterPage.tsx:212` · i18n `aiCommandCenter.readiness.*` 8 key × 2 locale · `env_validation.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `gemini` + `gemini-3.8-flash` + có key → `state="unverified"` (không phải `"ready"`) | test — **RED trước fix** (pre-fix `ai_ready=True`) |
| AC2 | `claude` → `state="blocked"`, `reason_code="provider_not_supported"`, `ai_ready=false` | test |
| AC3 | `openai` + `model=""` + không key → `missing_api_key`; có key → `model_not_selected` | test 2 nhánh |
| AC4 | `checked_at` ISO-8601 UTC, `expires_at = checked_at + AI_READINESS_TTL_SECONDS` | test |
| AC5 | `ai_config_message` không còn là nguồn trạng thái | grep |
| AC6 | UI hiện 4 trạng thái, màu + nhãn riêng, `aria-live` | test component |
| AC7 | `AI_READINESS_TTL_SECONDS` đọc qua `get_optional_env`, giá trị sai → `ImproperlyConfigured` | test env_validation |

**Minh chứng.** RED của AC1; 4 ảnh badge light+dark.

**Phản biện.** *"Hiện 'Sẵn sàng' đúng 90% trường hợp; đổi sang 'Chưa kiểm tra' làm tỷ lệ hoàn thành giảm."*
→ Biết. Nhưng "đúng 90% và sai 10% nguy hiểm nhất" — 10% đó chính là các ca 401/404 audit đã chứng minh xảy ra thật. Giảm thiểu: `unverified` kèm nút "Kiểm tra ngay" gọi `test-connection` (đã có sẵn) ⇒ 1 click lấy trạng thái thật thay vì 1 nhãn xanh giả.

**Tiêu chuẩn.** NIST AI RMF 1.0 — **MEASURE 2.7** (disclose limitations); ISO/IEC 25010 — *Appropriateness*. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R0.5.

### R0.5 · Chính sách provider theo D-03 + validator cặp provider/model

**Yêu cầu.** (1) `claude` disabled + badge. (2) `copilot`, `openclaw` gỡ khỏi `PROVIDER_OPTIONS`. (3) PUT `ai_provider` ngoài `ProviderChoices` → 400. (4) `ai_model` phải thuộc danh sách hợp lệ của provider, hoặc bắt buộc chọn `custom`.

**File.** `providerModels.ts:26-32, 45-57` (bỏ copilot/openclaw; `supported: false` cho claude) · `AICommandCenterForm.tsx:227-243, 386-396` (option disabled + badge) · `portfolio_analytics_views.py:608-609, 621-622` · i18n `aiProviders.*` 6 key + `providerUnsupported` × 2 locale

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `PROVIDER_OPTIONS` không chứa `copilot`, `openclaw` | assert list — **RED trước fix** |
| AC2 | option `claude` có `disabled` + nhãn "Chưa hỗ trợ" | DOM `option[disabled]` + text |
| AC3 | Chọn `claude` (gọi handler trực tiếp) → không gọi PUT, hiện lỗi inline | test |
| AC4 | PUT `{'ai_provider':'foobar'}` → `400` | test — **RED trước fix** (pre-fix ghi thẳng DB) |
| AC5 | PUT `{'ai_model':'x'*100}` → `400` không phải 500 | test — **RED trước fix** |
| AC6 | PUT `{'ai_provider':'gemini','ai_model':'gpt-4o-mini'}` → `400` `provider_model_mismatch` | test — đúng cặp gây 404 |
| AC7 | Mọi model trong `PROVIDER_MODELS[gemini]` hợp lệ với `gemini` | test duyệt mảng |
| AC8 | `gemini-3.8-flash` có cờ `experimental: true` | test + UI badge "Chưa xác minh" |

**Minh chứng.** RED AC1/AC4/AC5/AC6; ảnh dropdown 3 provider + 1 disabled.

**Phản biện.** *"Gỡ `openclaw` sẽ phá test cũ và code đang gọi provider này."*
→ Đã kiểm tra: `openclaw` chỉ xuất hiện ở `advisory/views.py:383,389` (bỏ qua yêu cầu key) và `portfolio_analytics_views.py:490,618,725,867` — **không call site nào gọi API openclaw thật**. Gỡ khỏi UI là giảm rủi ro, không phá tính năng. Sửa test cũ nằm trong budget slice này.

**Tiêu chuẩn.** OWASP ASVS 5.0 — *Validation*; ISO/IEC 25010 — *Reliability*. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** không (lớp thấp nhất của R0 sau R0.1–R0.3 — **R0.4 phụ thuộc slice này**, không ngược lại).

### R0.6 · Đóng SSRF + throttle + không rò endpoint

**Yêu cầu.** (1) `validate_outbound_endpoint(url, allow_private=False)` dùng chung cho `test-connection` và orchestrator. (2) Throttle scope mới `ai_test_connection`. (3) Message lỗi không echo endpoint. (4) Bỏ `str(e)` raw.

**File.** **mới** `advisory/outbound_guard.py` · `portfolio_analytics_views.py:876-908, 891-908, 969-993` · `orchestrator.py:196-200` · `settings.py:262-284` (thêm `'ai_test_connection': '20/hour'`) · `env_validation.py` · **mới** `tests/test_ai_outbound_guard.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `validate_outbound_endpoint("http://169.254.169.254/latest/meta-data/")` → raise | unit test — **RED trước fix** (hàm chưa tồn tại) |
| AC2 | Chặn `169.254.0.0/16`, `10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `0.0.0.0`, `::ffff:127.0.0.1` | unit test 8 case |
| AC3 | Chặn scheme `file:`, `gopher:`, `ftp:`, `dict:` | unit test |
| AC4 | `local` + `AI_ALLOW_PRIVATE_ENDPOINT=true` + `http://127.0.0.1:11434/v1` → cho phép | unit test |
| AC5 | `local` + env mặc định + endpoint private → `400`, message **không chứa** chuỗi endpoint | API test `assert endpoint not in detail` |
| AC6 | Endpoint DNS resolve ra IP private (rebinding) → chặn | mock `socket.getaddrinfo` |
| AC7 | `test-connection` có `ScopedRateThrottle` scope `ai_test_connection`; gọi 21 lần → lần 21 trả `429` | API test — **RED trước fix** |
| AC8 | Message lỗi không chứa `"Traceback"` / `"httpx."` | API test |
| AC9 | `custom_endpoint` công cộng hợp lệ vẫn chạy (không vỡ chức năng cũ) | unit test mock httpx |

**Minh chứng.** Bảng vector bị chặn + response thật từng case; output 429.

**Phản biện.** *"Chặn IP private sẽ phá use case `local` — user chạy Ollama trên máy chủ VNInvest."*
→ Đúng, và đó là lý do có cờ `AI_ALLOW_PRIVATE_ENDPOINT` thay vì cấm tuyệt đối. Mặc định fail-closed, bật bằng env rõ ràng, log cảnh báo mỗi lần bật. Nếu sau này host Ollama thì bật cờ trong compose, không cần đổi code.

**Tiêu chuẩn.** OWASP Top 10 2021 **A10 SSRF**; OWASP API Security Top 10 2023 **API4**; OWASP ASVS 5.0 — *Communication*. **Rủi ro.** Trung bình. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R0.5.

### R0.7 · Đóng cross-tenant audit log + instrument `AIUsageRecord` + gỡ POST

> Gộp 3 finding P0 vì cùng bản chất "dữ liệu AI không tenant nào được thấy". Tách nhỏ sẽ tốn thêm migration.

**Yêu cầu.** (1) `AIAuditLog` + `user` FK + `tenant` FK. (2) Scope mọi truy vấn. (3) `actor__icontains` → `user_id` chính xác. (4) Instrument `generate_advisory_task` + `call_agent_async`. (5) Gỡ `POST /ai/usage/`. (6) Task nightly upsert `AIUsageSummary`.

**File.** `advisory/models.py:303-338` · **mới** `advisory/migrations/0012_aiauditlog_user_tenant.py` · `portfolio_analytics_views.py:1003-1043` (scope) + `:713-720, 811-818, 857-864, 892-904, 978-992` (truyền user/tenant khi create) · `advisory/tasks.py:26-80` · `orchestrator.py:80-115` (bắt `usage` từ response) · `ai_analytics/views.py:68-73, 76-97, 100-123` · **mới** `advisory/migrations/0013_aiusagerecord_indexes.py` (app `ai_analytics` → `0002`) · **mới** `tests/test_ai_audit_tenant_isolation.py`, `tests/test_ai_usage_instrumentation.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | User A `GET …/audit-logs/` **không** thấy log user B | 2-user test — **RED trước fix** |
| AC2 | Staff tenant A không thấy log tenant B | 2-tenant test — **RED trước fix** |
| AC3 | Mọi `AIAuditLog.objects.create` đều truyền `user=` và `tenant=` | grep + test source-scan `test_every_create_sets_user` |
| AC4 | `?actor=admin` không trả log của `administrator` | test — **RED trước fix** |
| AC5 | `POST /core/v1/ai/usage/` → `405` cho mọi user | API test — **RED trước fix** (pre-fix 201) |
| AC6 | 1 refresh + chạy task ⇒ `AIUsageRecord` có ≥ 1 bản ghi với `provider`, `model`, `tokens_in`, `tokens_out`, `latency_ms`, `status` khác 0/null | test orchestrator mock trả `usage` — **RED trước fix** (0 bản ghi) |
| AC7 | Lỗi provider (401/429) cũng ghi record với `status='error'` | test — lỗi mới là lúc cần quan sát nhất |
| AC8 | Task nightly sinh `AIUsageSummary` đúng `unique_together (date,user,action)`, chạy 2 lần không nhân đôi | test task |
| AC9 | `usage` lấy từ `prompt_tokens`/`completion_tokens` thật; provider không trả ⇒ `0` + cờ `usage_unavailable=true`, **không** bịa | unit test 2 nhánh |
| AC10 | `cost` tính từ `AICostRate` nếu có, ngược lại `0` + `pricing_available=false` | test |

**Minh chứng.** RED AC1/AC2/AC4/AC5/AC6 trước fix; sau R2.4 có bảng "1 advisory sinh N usage records" với số thật.

**Phản biện.** *"Thêm 2 FK sẽ phải backfill hàng nghìn dòng log cũ không có `user_id`."*
→ Đúng. Migration để cả 2 FK `null=True`; backfill qua tra cứu `actor` → `User.username` cho dòng khớp được; dòng không khớp giữ `NULL` + cột boolean `legacy_unattributed=True` để **không giả vờ biết**. Response có `total` + `legacy_unattributed_count` để FE hiển thị "N bản ghi (M bản ghi legacy chưa gán)". Trung thực thay vì gán sai owner.

**Tiêu chuẩn.** OWASP API Security Top 10 2023 **API1 BOLA** + **API3 BOPLA**; ISO/IEC 42001:2023; ISO/IEC 25010 — *Security*, *Accountability*. **Rủi ro.** Cao. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R0.9.

### R0.8 · Dọn trang chết + vá 2 assert sai + gate mới

**Yêu cầu.** (1) Xoá `shell-ai-command-center` khỏi `pageRegistry.js:201` + xoá `ShellAiCommandCenterPage.tsx` + 3 metric `"…"`. (2) Sửa assert sai `check-shell.mjs:150`. (3) Tạo `scripts/check-ai-cc.mjs`, nối vào `check:shell`. (4) Sửa path `ops_audit/tasks.py:139`.

**File.** `pageRegistry.js:201-202` · `pages/system/ShellAiCommandCenterPage.tsx` (xoá) · `__tests__/ai-cc-form-parity.component.test.ts:102` (bỏ tham chiếu file xoá) · `scripts/check-shell.mjs:150` · **mới** `scripts/check-ai-cc.mjs` · `package.json:11` · `ops_audit/tasks.py:139`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `grep -rn "ShellAiCommandCenterPage" packages/web/src` → 0 (trừ comment lịch sử) | grep |
| AC2 | `getPageComponent("shell-ai-command-center") === null` | vitest |
| AC3 | Xoá 1 key bất kỳ trong `vi.js` ⇒ `check:ai-cc` **fail** với tên key | test gate tự kiểm — **chứng minh gate có tác dụng** |
| AC4 | Thêm `t("aiCommandCenter.khongTonTai")` ⇒ `check:ai-cc` fail | như AC3 |
| AC5 | Thêm `t("x") \|\| "fallback"` ⇒ `check:ai-cc` fail | như AC3 |
| AC6 | Thêm hex trong 1 file AI CC `.tsx` ⇒ `check:ai-cc` fail | như AC3 |
| AC7 | `npm run check:shell` exit 0 và output **có** `check:ai-cc` | đọc output từng bước |
| AC8 | Xoá 1 testid trong `AI_CC_FORM_FIELD_TESTIDS` ⇒ `ai-cc-form-parity` fail | vitest |
| AC9 | `ops_audit` ghi service label `ai_agents` cho path thật | test mapping |

**Minh chứng.** Bảng "gate âm tính" — mỗi AC3-AC6 dán output gate FAIL trước khi hoàn nguyên. **Đây là minh chứng quan trọng nhất của slice: chứng minh gate thật sự bắt lỗi.**

**Phản biện.** *"Xoá `ShellAiCommandCenterPage` mất khả năng embed AI CC vào app khác (vip-app / shell cũ)."*
→ Đã kiểm tra: `packages/vip-app` không import; `main.tsx` không route; `index.js:21` chỉ re-export. Không có consumer. Nếu sau này cần embed thì dùng lại `AICommandCenterForm` (F8 tách sẵn đúng mục đích đó) — xoá trang, **giữ form**.

**Tiêu chuẩn.** ISO/IEC 25010 — *Maintainability*, *Analysability*; ISO/IEC 25012:2008 (sửa tên đúng; Entry 227 từng ghi nhầm 25012 là 2011 đã bị rút). **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** không (làm song song R0.1-R0.7).

### R0.9 · Hiện thực hoá D-01: tách lớp A/B + enforce ability

**Yêu cầu.** (1) Lớp A không đổi. (2) Trường hệ thống (`system_prompt_template`, system model, phím hệ thống) **không** trả về non-staff; thay bằng `system_policy.managed_by_platform = true`. (3) Endpoint `/workspace/ai-command-center/policy/` chỉ staff. (4) `helpers.py` expose `ai-command-center` cho mọi user (khớp menu) + subject `ai.policy.manage` cho staff. (5) `ai_config_message` bị loại khỏi contract.

**File.** `portfolio_analytics_views.py:525-547, 737-770` · **mới** endpoint `ai-command-center/policy/` · `identity_access/views/helpers.py:183-197` · `AICommandCenterPage.tsx:313-340` (system prompt panel → thông báo "do nền tảng quản lý" cho non-staff) · **mới** `tests/test_ai_cc_policy_gating.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | User thường: GET CC **không** có key `system_prompt_template`; có `system_policy.managed_by_platform = true` | 2-user test — **RED trước fix** |
| AC2 | Staff: GET CC có `system_prompt_template` | test |
| AC3 | `GET /…/ai-command-center/policy/` user thường → `403` | API test |
| AC4 | `PUT /…/ai-command-center/policy/` user thường → `403` | API test |
| AC5 | `helpers.py` route list chứa `ai-command-center` cho user thường | mở rộng `test_capabilities_soc` |
| AC6 | Ability `ai.policy.manage` chỉ ở staff | test |
| AC7 | `ai_config_message` không còn trong response | grep |
| AC8 | UI non-staff không render panel System prompt; staff thấy | test component 2 context |
| AC9 | **Không** thay đổi nào làm user mất quyền đọc/ghi cấu hình **của chính họ** | regression: 8 test `test_ai_cc_config_isolation` xanh |

**Minh chứng.** RED AC1/AC3/AC4; bảng **"role × surface × allowed"** trong `gates.md` — bảng nghiệm thu dễ soi nhất cho toàn bộ R0.

**Phản biện.** *"Ẩn `system_prompt_template` khỏi user thường làm mất tính năng 'xem system prompt' đã tài liệu hoá."*
→ Ở `portfolio_analytics_views.py:531` nó vốn đã đọc `config.prompt_template` (cấp hệ thống) và tài liệu ghi "chỉ đọc" — tức **chưa bao giờ chỉnh được**. User thấy nội dung hệ thống nhưng không dùng được. Giữ nguyên cho staff, thay bằng thông báo rõ ràng cho user thường là **thành thật hơn**. Cấu hình theo tenant thì mở lại ở R4.1.

**Tiêu chuẩn.** OWASP ASVS 5.0 — *Access Control*; ISO/IEC 42001:2023 — *organizational roles*. **Rủi ro.** Trung bình. **Ước lượng:** 1.5 ed. **Phụ thuộc:** không (định nghĩa *ai có thấy gì*; **R0.7 triển khai** định nghĩa đó, không ngược lại).

**Tổng R0: 9 slice, 15.5-18.5 ed.**

---

## WAVE R1 — NỀN TẢNG DESIGN SYSTEM + i18n + GATE (13.5-16.5 ed)

**Exit criteria:** 3 route × 2 theme × 2 locale đạt WCAG 2.2 AA ở điểm chính; 0 key chết; 0 hex trong TSX AI CC; `check:ai-cc` xanh.

### R1.1 · Đưa `--ai-*` ra `:root` — sửa mất token toàn trang

**Yêu cầu.** Chuyển 13 token `--ai-*` từ `.page` (`:51-64`) ra block `:root` (đã có ở `:7-28`). Giữ override `:root[data-theme="light"]` (`:31-49`). **Không** thêm `styles.page` vào hub page.

**File.** `aiSettings.module.css:51-64` · **mới** `__tests__/ai-settings-tokens.component.test.ts`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Mọi token `--ai-*` khai báo **ngoài** selector `.page` | test đọc file — **RED trước fix** |
| AC2 | `getComputedStyle(document.documentElement).getPropertyValue('--ai-border')` khác rỗng | vitest+jsdom; fallback assert source contract |
| AC3 | Override `:root[data-theme="light"]` còn nguyên | test source |
| AC4 | `.page` **không** bị áp vào hub page | grep `styles.page` chỉ còn 2 sub-route |
| AC5 | Visual QA: 3 route × 2 theme = 6 ảnh; input có viền rõ, focus ring hiện | 6 ảnh evidence |

**Minh chứng.** 6 ảnh; RED/GREEN AC1.

**Phản biện.** *"Chuyển ra `:root` áp token cho toàn bộ app — thêm kích thước CSS."*
→ Token chỉ được **đọc** khi nào rule CSS tham chiếu; grep xác nhận không rule nào ngoài `aiSettings.module.css` dùng `--ai-*`. 13 dòng khai báo không dùng ≈ 0.5 KB. Chấp nhận. Lý do **không** thêm `.page` vào hub: nó kéo `min-height:100vh` + `padding:24px 28px` + gradient, đè lên padding của `AppShell` → layout đứt. Ghi vào comment trong file.

**Tiêu chuẩn.** ISO/IEC 25010 — *Modularity*. **Rủi ro.** Thấp. **Ước lượng:** 0.5 ed. **Phụ thuộc:** R0.8.

### R1.2 · Migrate `AIAuditLogsPanel` sang token + a11y + export + filter

**Yêu cầu.** (1) Bỏ toàn bộ class Tailwind cứng. (2) Header row → `<button aria-expanded>` + phím Enter/Space. (3) Nút Refresh + Xuất CSV (cap 5000, BOM, escape, cờ `truncated`). (4) Bỏ `params._r`; debounce 300 ms; bỏ double-fetch. (5) Light mode đúng.

**File.** `AIAuditLogsPanel.tsx` (toàn bộ 273 dòng) · copy pattern `components/advisory/advisoryExport.js` · `aiSettings.module.css` (thêm `.auditRow`, `.auditBadge*`, `.auditActions`) · i18n `aiCommandCenter.export*` 5 key

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 0 class Tailwind cứng (`bg-slate-`, `text-cyan-`, `text-\[`) trong file | grep — **RED trước fix** |
| AC2 | Mọi mở-rộng dùng `<button aria-expanded>`; Enter/Space hoạt động | test `userEvent.keyboard` |
| AC3 | Filter debounce: đổi select 1 lần sau 300 ms chỉ **1** request | đếm số lần gọi adapter — **RED trước fix** (pre-fix 2) |
| AC4 | CSV: BOM `\uFEFF`, header đúng, `"` → `""`, ≤ 5000 dòng, > 5000 ⇒ cảnh báo | unit test `buildAiAuditCsv` |
| AC5 | Không còn request mang param `_r` | grep + test |
| AC6 | Light mode: mọi text ≥ 4.5:1, nền không tối | `check:contrast` mở rộng + 2 ảnh |
| AC7 | Lỗi tải hiện `t("aiCommandCenter.loadError")` (đã có ở R1.3), không phải raw key | assert text ≠ `"aiCommandCenter.loadError"` — **RED trước fix** |
| AC8 | `formatDate` guard ngày hỏng → `"—"` | unit test |

**Minh chứng.** RED AC1/AC3/AC7; 4 ảnh (light/dark × collapsed/expanded).

**Phản biện.** *"Migrate toàn bộ tốn công hơn là thêm `dark:` variant cho 5 class."*
→ Ngược lại. Vấn đề không chỉ là dark: 20+ class đó **không nằm trong hệ thống token** nên độ lệch tăng theo thời gian và không ai đo được. Thêm `dark:` chỉ chữa triệu chứng.

**Tiêu chuẩn.** WCAG 2.2 AA — 1.4.3 Contrast, 2.1.1 Keyboard, 4.1.2 Name/Role/Value. **Rủi ro.** Thấp. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R1.1.

### R1.3 · i18n sạch: 1 key thiếu + 18 key chết + bỏ mọi `|| "fallback"` + provider labels

**Yêu cầu.** (1) Thêm `aiCommandCenter.loadError` vi + en. (2) Xoá 18 key chết. (3) Bỏ **toàn bộ** mẫu `t(...) || "…"`. (4) `providerModels.ts` + `AGENT_TYPES` chuyển sang `t()`. (5) `AICommandCenterPage.tsx:237` `${n} giờ/lần` → `t()` có `{hours}`. (6) `AISettingsErrorBoundary` 3 fallback VI → `t()`.

**File.** `i18n/vi.js` · `i18n/en.js` · `AICommandCenterPage.tsx:237` · `providerModels.ts` · `AIAgentFederationPanel.tsx:10-17` · `AIAdvisoryPromptConfigDrawer.js:216,217,228,279,280,328,339,355,222` · `AISettingsErrorBoundary.tsx:41,42,48` · `AIUsageDashboard.tsx:279`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `t("aiCommandCenter.loadError")` khác rỗng ở `vi` và `en` | script parity |
| AC2 | 0 key chết trong 4 namespace AI CC | script `UNUSED_*` → 0 — **RED trước fix** (18) |
| AC3 | 0 occurrence `t(` kèm `\|\|` trong 9 file AI CC | grep — **RED trước fix** (8) |
| AC4 | 0 chuỗi hardcode trong JSX 9 file AI CC (eslint `jsx-no-literals` 0 warning) | `npx eslint <9 file>` → **0 warning** (hiện 20) |
| AC5 | Locale EN: không còn chuỗi tiếng Việt nào trong 3 route | test render với `createTranslator("en")` — **RED trước fix** |
| AC6 | Parity 4 namespace: 0 lệch key-set | script parity |
| AC7 | Preset labels lấy từ `promptConfig.presets.*`, không từ `aiCommandCenter.preset*` | grep |
| AC8 | `check:ai-cc` xanh | gate |

**Minh chứng.** Output script parity + 2 ảnh EN toàn trang (trước: "24 giờ/lần", "Mô hình tùy chỉnh…").

**Phản biện.** *"Xoá 18 key chết có thể phá code đang viết dở ở branch khác."*
→ Grep toàn repo: 0 nơi tham chiếu. Nếu sau này cần, lấy lại từ git history. Giữ key chết chính là điều Entry 208 (F-C6) chỉ ra: `t()` trả key nên `||` không bao giờ chạy ⇒ dùng `||` là **tự lừa mình**.

**Tiêu chuẩn.** ISO/IEC 25010 — *Localizability*; BCP 47. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R0.5, R0.8.

### R1.4 · Skeleton + `isDirty` + không mất thay đổi + không mất filter audit

**Yêu cầu.** (1) Skeleton theo shape thật (tối thiểu: **ẩn giá trị tới khi có data**). (2) `isDirty` + `beforeunload`. (3) Nút Lưu `disabled` khi không đổi. (4) `setTimeout` → `useRef` + `clearTimeout` trong cleanup. (5) `refreshAuditKey` remount → imperative `refresh()`.

**File.** `AICommandCenterPage.tsx:42-62, 105, 110-119, 139-158, 206-253` · `AICommandCenterForm.tsx:364-370` · `AIAuditLogsPanel.tsx` (prop `refreshKey` → `refresh()`)

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Trong lúc GET chưa xong: skeleton + `aria-busy="true"`, **không** hiện số `24/24/5000` | promise chưa resolve, assert không có `"24"` — **RED trước fix** |
| AC2 | Sửa 1 field → Lưu bật; bấm Lưu → tắt lại | test |
| AC3 | Rời trang khi `isDirty` → `beforeunload` được đăng ký | spy `window.addEventListener` |
| AC4 | Unmount trong 3 s sau notice → **không** warning setState-after-unmount | spy `console.error` |
| AC5 | Lưu thành công → audit panel làm mới **nhưng giữ filter + page** | set filter, lưu, assert còn nguyên — **RED trước fix** |
| AC6 | Không `setTimeout` không cleanup | grep + test cleanup |

**Minh chứng.** RED AC1/AC5; video thao tác lưu 3 lần liên tiếp.

**Phản biện.** *"Skeleton thêm code mà page chỉ 5 section — không đáng."*
→ Vấn đề là **số giả hiện ra rồi nhảy**: user đọc "Token/ngày 1000" rồi tưởng đã xong. Đây là lỗi trung thực dữ liệu hiển thị, không phải thẩm mỹ. Tối thiểu ẩn giá trị tới khi có data (rẻ hơn skeleton nhiều); skeleton đầy đủ là phương án B.

**Tiêu chuẩn.** ISO/IEC 25010 — *Usability*; Nielsen — *Visibility of system status*; WCAG 2.2 — 4.1.3. **Rủi ro.** Thấp. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R1.2.

### R1.5 · Filter `model`/`status` nhất quán cho records + summary + aggregate

**Yêu cầu.** 1 helper lọc dùng chung cho cả 3 view. Thêm `?action=` cho aggregate. FE gửi filter cho cả 3 request.

**File.** `ai_analytics/views.py:14-18, 27-34, 76-97, 100-123` · `AIUsageDashboard.tsx:128-132` (bỏ rút gọn `{days}` ở `:131`) · **mới** `tests/test_ai_usage_filters.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `?model=X` ⇒ `aggregate.total_requests` == số dòng records đã lọc cùng `model=X` | test 2 dataset — **RED trước fix** |
| AC2 | `?status=error` ⇒ `summary` chỉ có row `error` | test |
| AC3 | `?action=advisory` lọc cả 3 view | test |
| AC4 | 2 user: A không thấy số liệu B trên **cả 3** endpoint | test isolation |
| AC5 | `AIUsageSummaryView` có phân trang | test `?limit` |
| AC6 | FE: đổi filter ⇒ tổng + biểu đồ + bảng **cùng đổi** | test component 3 mock response |

**Minh chứng.** RED AC1/AC2; ảnh trước/sau khi lọc (mâu thuẫn nhìn thấy được).

**Phản biện.** *"User bình thường không cần lọc tổng theo model — giữ tổng toàn cục có giá trị quản trị."*
→ Có thể, nhưng UI hiện **gửi filter** cho aggregate mà BE **bỏ qua** ⇒ user tưởng đã lọc. Chọn (a) sửa BE cho nhất quán; nếu sau này cần tổng toàn cục thì thêm chế độ hiển thị riêng, không trộn hai nghĩa.

**Tiêu chuẩn.** ISO/IEC 25010 — *Functional suitability*, *Data accuracy*. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R0.7.

### R1.6 · Chart + system-prompt viewer theo token, có light mode + bảng số thay thế

**Yêu cầu.** (1) Thay hex/rgba trong chart bằng token. (2) Bỏ inline style hardcode ở `AICommandCenterPage.tsx:324-335, 360-366, 373-383`. (3) Chart có `aria-hidden` + bảng số thay thế (`.sr-only`). (4) Tô màu trạng thái dùng union thay vì ternary inline. (5) `formatNumber`/`formatCurrency` của app thay `.toLocaleString()` trần.

**File.** `AIUsageDashboard.tsx:292-305` · `AICommandCenterPage.tsx:324-335, 360-366, 373-383` · `aiSettings.module.css` (chart token)

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 0 hex/rgba literal trong chart props | `check-ai-cc` + grep — **RED trước fix** (6 mãu) |
| AC2 | Light mode: chart không còn nền tooltip tối | 2 ảnh |
| AC3 | Có bảng số thay thế `.sr-only` chứa đúng số liệu | test DOM |
| AC4 | Tất cả text trên nền mới ≥ 4.5:1 | `check:contrast` mở rộng |
| AC5 | Dùng `formatNumber`/`formatCurrency`, không `.toLocaleString()` trần | grep — **RED trước fix** |
| AC6 | Chi phí 1 chỗ tròn số (4 chữ số thập phân cho USD) | test |

**Minh chứng.** 4 ảnh (light/dark × usage/prompt panel); RED AC1/AC5.

**Phản biện.** *"`check:ai-cc` bắt hex trong TSX là mở rộng phạm vi gate, có thể chặn nhầm."*
→ Gate chỉ quét **9 file AI CC** + danh sách khai báo tường minh trong chính script. Mở rộng thêm là ticket riêng kèm allowlist. Không để gate lan.

**Tiêu chuẩn.** WCAG 2.2 AA — 1.4.3, 1.4.11 Non-text Contrast. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R1.1.

### R1.7 · Vá `useRetryableAsync`: AbortController + requestId + cleanup

**Yêu cầu.** (1) `AbortController` hủy request cũ. (2) `requestId` guard — chỉ apply response mới nhất. (3) `mountedRef.current = false` trong cleanup. (4) Bỏ `retryLoadData` khỏi nút refresh.

**File.** `hooks/useRetryableAsync.ts:34, 37-56, 58-59` · `AIUsageDashboard.tsx:226`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Đổi filter 2 lần trong 100 ms với response trễ khác nhau ⇒ kết quả cuối khớp filter cuối | resolver trễ tự điều khiển — **RED trước fix** (pre-fix bị `inFlightRef` bỏ qua) |
| AC2 | Request cũ bị `abort()` | spy `AbortController` |
| AC3 | Unmount trong lúc fetch ⇒ không `setState` sau unmount | spy `console.error` |
| AC4 | Bấm Refresh = **đúng 1** request | đếm số lần gọi adapter |
| AC5 | Không consumer nào khác bị hỏng | `grep useRetryableAsync` toàn repo → chạy test từng consumer |

**Minh chứng.** RED AC1; test từng consumer.

**Phản biện.** *"Hook dùng chung — sửa có thể phá 5 chỗ khác."*
→ Đã grep danh sách consumer, liệt kê ở AC5, kèm AC bắt buộc chạy test từng consumer. Sửa là **bắt buộc** vì hiện nó âm thầm nuốt request trong bất kỳ consumer nào — lỗi loại này không tự hiện.

**Tiêu chuẵn.** ISO/IEC 25010 — *Reliability*, *Fault tolerance*. **Rủi ro.** Trung bình. **Ước lượng:** 1.0 ed. **Phụ thuộc:** R1.4.

### R1.8 · 3 hệ thống token → 1; bỏ inline style; `AiHubNav` dùng chung 3 route

**Yêu cầu.** (1) Bỏ inline `style` ở `AICommandCenterPage.tsx:167`. (2) Tạo `AiHubNav` dùng chung: hub + 2 sub-route đều có tab bar, active state đúng. (3) 2 sub-route có `<h1>` + mô tả. (4) Comment CSS chỉ rõ token nào bridge `@theme`, token nào local.

**File.** `AICommandCenterPage.tsx:167, 177-203` · `AIUsageAnalyticsPage.tsx:15-20` · `AIAgentFederationPage.tsx:15-20` · **mới** `components/AiHubNav.tsx`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 0 `style={{` trong 3 page AI CC (trừ style động theo giá trị) | grep |
| AC2 | Cả 3 route render `AiHubNav`, active state đúng | test 3 route × tab |
| AC3 | `/settings/ai/usage` có `<h1>` + `<p>` mô tả | test DOM |
| AC4 | Bấm tab "Usage" rồi quay "Tổng quan" → filter audit còn nguyên | test |
| AC5 | Mỗi route chỉ còn **1** hệ thống token | `check:ai-cc` |
| AC6 | Comment trong CSS chỉ rõ token nào bridge, token nào local | review checklist |

**Minh chứng.** 6 ảnh (3 route × 2 theme).

**Phản biện.** *"3 hệ thống token là vấn đề toàn repo (Entry 213, 40+ file), gộp riêng AI CC là nửa vời."*
→ Đúng, và đó là lý do slice này **chỉ** gộp trong phạm vi AI CC, đồng thời ghi ở §9 rằng Wave toàn repo là ticket riêng. Gộp phạm vi hẹp nghiệm thu được; gộp phạm vi rộng sẽ trượt deadline và không ai nhận.

**Tiêu chuẩn.** ISO/IEC 25010 — *Modularity*, *Consistency*. **Rủi ro.** Thấp. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R1.1, R1.2.

### R1.9 · Diff preview + optimistic lock (409) cho AI CC

**Yêu cầu.** (1) `expected_updated_at` trên PUT → `409` `error_code='ai_config_conflict'` nếu lệch. (2) FE modal diff trước khi lưu, copy pattern `SocConfigPreviewModal` + `lib/diffUtil.js`. (3) Lệch → 2 lựa chọn rõ ràng: tải bản mới rồi ghi đè có chủ đích, hoặc huỷ.

**File.** `portfolio_analytics_views.py:550-771` · **mới** `components/AiConfigPreviewModal.tsx` · `AICommandCenterPage.tsx` · **mới** `tests/test_ai_cc_concurrency.py` + test FE

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 2 client đọc cùng `updated_at=T`; A PUT → 200; B PUT `expected_updated_at=T` → `409` | test — **RED trước fix** |
| AC2 | B PUT `expected_updated_at=<mới>` → 200 | test |
| AC3 | Không gửi `expected_updated_at` → hành vi cũ (tương thích ngược) | test |
| AC4 | Modal diff liệt kê đúng field đổi; Cancel không gửi PUT | test |
| AC5 | 409 hiển thị thông báo có hành động, không lỗi thô | test |

**Minh chứng.** RED AC1; ảnh modal diff.

**Phản biện.** *"Optimistic lock khiến user phải bấm Lưu 2 lần — trải nghiệm tệ."*
→ Đúng nếu chặn cứng. Thiết kế: 409 **không** chặn vĩnh viễn — UI cho 2 lựa chọn rõ ràng, không có chế độ "ghi đè mặc định". Với 1 người dùng (99% trường hợp) `expected_updated_at` luôn khớp nên không đổi trải nghiệm.

**Tiêu chuẩn.** ISO/IEC 25010 — *Consistency (avoiding lost update)*; RFC 9110 §9.3.2. **Rủi ro.** Trung bình. **Ước lượng:** 1.5 ed. **Phụ thuộc:** R0.2.

### R1.10 · Sửa nhãn quota ngược nghĩa + đếm ngược reset + nguồn quota

**Yêu cầu.** Nhãn "đã dùng" → "còn lại" đúng nghĩa; thêm `fallback_quota_used_today` + `fallback_quota_source`; đếm ngược giờ reset; thanh đổ đúng nghĩa. Dùng 1 dòng gọn: `"Còn 3/5 lượt · đã dùng 2 · reset 15:04"`.

**File.** `AICommandCenterPage.tsx:275-310` · `portfolio_analytics_views.py:544-546, 767-769` · i18n 4 key

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Response có `fallback_quota_remaining`, `_max`, `_used_today`, `_reset`, `_source` | test |
| AC2 | UI hiện "Còn 3/5 lượt · đã dùng 2" | test — **RED trước fix** (pre-fix "5 lượt / 5 lượt") |
| AC3 | Có đếm ngược "reset sau Xh Ym" | fake timer |
| AC4 | `0/5` → thanh đỏ + cảnh báo rõ | test |
| AC5 | Hiện nguồn quota (khoá cá nhân / hệ thống) | test |

**Minh chứng.** RED AC2; 3 ảnh trạng thái quota.

**Phản biện.** *"Nhãn cũ ngắn gọn; 2 dòng làm panel nặng."*
→ Trạng thái quota quyết định có dùng được AI hay không; hiểu sai là hỏng tính năng. Dùng 1 dòng gộp như đã chốt ở AC2.

**Tiêu chuẩn.** ISO/IEC 25010 — *Self-descriptiveness*; Nielsen. **Rủi ro.** Thấp. **Ước lượng:** 0.5 ed. **Phụ thuộc:** R0.7.

### R1.11 · Panel agent: nhãn đúng, notice tự tắt, kiểu dữ liệu trung thực

**Yêu cầu.** (1) Nút Lưu dùng `aiAgentFederation.saving` không phải `loading`. (2) Notice tự tắt sau 4 s + nút đóng `role="status"`. (3) `capabilities` khai báo đúng kiểu + tách hàm parse thành util có test. (4) Default form lấy từ `PROVIDER_MODELS` thay vì hardcode. (5) `handleProviderChange` không chọn nhầm `custom` làm model.

**File.** `AIAgentFederationPanel.tsx:47-55, 76-99, 141-159, 253` · **mới** `src/lib/capabilities.ts` + test

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Bấm Lưu → nhãn nút "Đang lưu…" (không phải "Đang tải…") | test — **RED trước fix** |
| AC2 | Notice tự tắt sau 4 s; có nút `×` với `aria-label` | fake timer + a11y |
| AC3 | `parseCapabilities("a, b ,,c")` → `["a","b","c"]` | unit test |
| AC4 | Đổi provider không có model ngoài `custom` → không tự điền `"custom"` làm model | test |
| AC5 | 0 eslint warning `jsx-no-literals` trong file | lint |

**Minh chứng.** RED AC1; lint output.

**Phản biện.** *"`AGENT_TYPES` label tiếng Anh là thuật ngữ chuyên ngành, tạm chấp nhận."*
→ Đồng ý một phần: "Stock Screener" giữ tiếng Anh được, nhưng `"Custom Agent"` thì phải dịch. Chuẩn repo là **mọi** chuỗi qua `t()`. Đưa hết sang `t('aiAgentFederation.agentTypes.*')`, giữ thuật ngữ Anh trong **giá trị** EN.

**Tiêu chuẩn.** ISO/IEC 25010 — *Localizability*, *Modularity*. **Rủi ro.** Thấp. **Ước lượng:** 0.5 ed. **Phụ thuộc:** R1.3.

**Tổng R1: 11 slice, 13.5-16.5 ed.**

---

## WAVE R2 — FAILOVER + BUDGET + 3 ADAPTER MỚI (28-33 ed)

**Exit criteria:** ≥ 2 deployment, failover tự động, budget theo USD 3 mức, retry + circuit breaker, **6/6 provider có client thật** (trong đó `copilot` + `claude` + `openclaw`), danh mục model sống theo tài khoản.

### R2.1 · Model `AIDeployment` + `AIFallbackChain`

**Yêu cầu.** `AIDeployment` (provider, model, credential_ref, weight, enabled, health_state, last_health_at). `AIFallbackChain` (thứ tự, theo user hoặc tenant). `UserAICredential.active_deployment` FK nullable — **NULL ⇒ dùng `SystemAISettings` như hiện tại ⇒ không regression**.

**File.** `advisory/models.py` (2 model mới) · migration `0014`, `0015` · `advisory/serializers.py` · admin registration

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Migration chạy sạch, `makemigrations --check` exit 0 | gate |
| AC2 | `active_deployment = NULL` → hành vi y hệt hiện tại | regression: 8 test `test_ai_cc_config_isolation` xanh |
| AC3 | Chain rỗng ⇒ không failover | unit test |
| AC4 | unique constraint `(name, owner_scope)` | test |
| AC5 | 2 user không chạm deployment của nhau | test isolation |
| AC6 | `weight` trong `[0,100]`, ngoài → validation | test |

**Minh chứng.** Output migration + 8 test regression.

**Phản biện.** *"Mô hình mới chưa dùng là YAGNI."*
→ Đúng nếu chỉ cần 1 provider. Nhưng `ai_ready` giả (R0.4) và provider sai (R0.5) đều bắt nguồn từ việc chỉ có **một đường đi**. Đây là nền cho failover (R2.9) và routing (R2.6). Muốn cắt scope: làm R2.1 nhưng **hoãn R2.6**; khi đó R2.1 chỉ dùng cho multi-credential, không routing.

**Tiêu chuẩn.** ISO/IEC 25010 — *Modularity*, *Extensibility*. **Rủi ro.** Thấp. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R0.1.

### R2.2 · `get_ai_client(provider)` factory + interface chuẩn + gỡ if/elif khỏi orchestrator

**Yêu cầu.** Interface duy nhất cho mọi provider:

```
AiClient.complete(system, user, *, model, temperature, max_tokens, timeout)
  -> { text, usage: {input, output} | None, raw }
AiClient.catalog()  -> [ {id, provider, api, context_window, state} ] | None
AiClient.probe()    -> { ok, latency_ms, error_code, detail }
```

Tách `base.py` (abstract + retry/backoff + usage parse) + `openai_compat.py` (dùng cho `openai`, `gemini`, `local`, và `openclaw` **nếu** OpenAI-compatible). Orchestrator gọi qua factory, **không** còn nhánh `if provider ==`.

**File.** **mới** `advisory/ai_clients/{__init__,base,openai_compat}.py` · `orchestrator.py:80-115, 295-320` (thay 3 nhánh) · **mới** `tests/test_ai_clients.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 3 adapter `openai`/`gemini`/`local` × 3 fixture response ⇒ `text` + `usage` parse đúng | test |
| AC2 | `usage` lấy từ `prompt_tokens`/`completion_tokens`; provider không trả ⇒ `usage=None` **không bịa 0** | test 2 nhánh — nối R0.7-AC9 |
| AC3 | `orchestrator.py` grep không còn `if provider ==` | grep — **RED trước fix** (hiện có 3 nhánh `:262,:309,:314`) |
| AC4 | Provider không cấu hình ⇒ `FactoryError` rõ ràng, **không** rơi về OpenAI im lặng | test |
| AC5 | Mỗi adapter timeout riêng qua tham số | test |
| AC6 | Thêm provider mới = thêm 1 file, **không** sửa orchestrator | review checklist (kiểm bằng cách thêm adapter giả trong test) |

**Minh chứng.** Bảng 3×3 fixture; output grep AC3.

**Phản biện.** *"Tách ra là refactor lớn, rủi ro regression cho 3 provider đang chạy."*
→ Đúng, nên AC2 yêu cầu regression suite `test_ai_advisory_*` xanh trước khi coi xong. Bù lại: nếu không tách, R2.3/R2.4/R2.5 sẽ phải thêm 3 nhánh `if` nữa vào đúng chỗ đó. Refactor 1 lần có test, rẻ hơn sửa 3 lần không test.

**Tiêu chuẩn.** ISO/IEC 25010 — *Modularity*, *Interoperability*. **Rủi ro.** Trung bình. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R0.5.

### R2.3 · Adapter `anthropic` → bật provider `claude`

**Yêu cầu.** Native `/v1/messages`: header `x-api-key` + `anthropic-version: 2023-06-01`, **không** dùng `Authorization: Bearer`. Usage ở `usage.input_tokens`/`output_tokens`. Nối `model_choices.CLAUDE_PREFIXES` (đã có, đang là code chết) vào validation.

**File.** **mới** `advisory/ai_clients/anthropic.py` · `advisory/views.py` (bật provider) · `providerModels.ts:26-32` (bỏ `disabled`) · env `AI_ENABLE_ANTHROPIC`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Header đúng: có `x-api-key` + `anthropic-version`, **không** có `Authorization` | test assert header — **RED trước fix** (pre-fix gửi Bearer tới api.openai.com) |
| AC2 | `usage.input_tokens`/`output_tokens` parse đúng | test fixture |
| AC3 | Endpoint `https://api.anthropic.com/v1/messages` | test assert URL |
| AC4 | 401 từ Anthropic ⇒ `error_code='provider_auth_failed'` (không phải 404 như khi model lệch) | test |
| AC5 | Cặp `claude` + model `gpt-*` bị chặn 400 `provider_model_mismatch` (dùng `model_choices`) | test |
| AC6 | Probe thật: `probe()` gọi 1 request tối thiểu tới Anthropic, trả latency | test mock |
| AC7 | Đổi `AI_ENABLE_ANTHROPIC=false` ⇒ orchestrator từ chối provider này với message rõ, không im lặng gọi nhầm | test |

**Phản biện.** *"Dùng SDK `anthropic` chính thức làm dependency."*
→ Repo dùng `httpx` thuần cho OpenAI-compatible (`orchestrator.py:235`). Thêm SDK cho 1 provider là nợ phụ thuộc + thêm bề mặt cấp phép. Giữ `httpx`, 1 file adapter. Nếu sau này thêm Azure/Bedrock mà cần abstraction riêng thì cân nhắc lại.

**Tiêu chuẩn.** ISO/IEC 25010 — *Interoperability*. **Rủi ro.** Thấp. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R2.2, R0.5.

### R2.4 · Adapter `copilot` — token exchange + catalog sống + enterprise URL

**Yêu cầu.** (1) `CopilotTokenManager`: `GET https://api.github.com/copilot_internal/v2/token` với `Authorization: token <ghu_>`; cache `{token, endpoints.api, expires_at}`; refresh **sớm 60 s**; `threading.Lock` chống stampede. (2) `complete()` gọi `POST {endpoints.api}/chat/completions` với `Authorization: Bearer <session>` + `Copilot-Integration-Id: vscode-chat` (bắt buộc) + `Content-Type`. (3) `catalog()` gọi `GET {endpoints.api}/models` bằng session token. (4) Enterprise: đọc `endpoints.api` từ token response, cho phép override `COPILOT_API_BASE_URL`. (5) 4 bẫy ở D-03b → 4 `error_code` riêng. (6) Bật `copilot` trong UI + `model_choices` + `providerModels` fallback.

**File.** **mới** `advisory/ai_clients/copilot.py` + `advisory/copilot_tokens.py` · `portfolio_analytics_views.py:940-943` (bỏ nhánh else cho copilot) · `providerModels.ts:45-47` (thay danh sách hardcode 1 model `custom` bằng nhóm + nút "Tải lại") · `env_validation.py` · i18n `aiProviders.copilot.*` 6 key × 2 locale · **mới** `tests/test_ai_client_copilot.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Exchange thành công ⇒ lưu `token`, `endpoints.api`, `expires_at` | test mock HTTP — **RED trước fix** (chưa có module) |
| AC2 | 2 request trong `expires_in` ⇒ **chỉ 1** lần exchange (cache) | test đếm số lần gọi |
| AC3 | Còn < 60 s ⇒ refresh trước khi hết hạn | test fake clock |
| AC4 | 10 request đồng thời ⇒ **chỉ 1** exchange (lock chống stampede) | test `threading` |
| AC5 | `complete()` dùng `Bearer <session>` + `Copilot-Integration-Id: vscode-chat` | test assert header — **bắt buộc, thiếu là 401** |
| AC6 | Endpoint lấy từ `endpoints.api`, **không** hardcode | test: token trả base URL riêng ⇒ dùng base URL đó |
| AC7 | Enterprise: `COPILOT_API_BASE_URL` override được | test |
| AC8 | Exchange trả **404** ⇒ `error_code='copilot_token_exchange_failed'`, message nói rõ *"cần GitHub OAuth token (ghu_), không phải PAT"*, **không** dùng thông báo 401 chung | test assert `error_code` + assert message **không** chứa "API key không hợp lệ" |
| AC9 | `catalog()` trả danh sách model thật, lọc `policy.state` + `model_picker_enabled` | test fixture |
| AC10 | Catalog rỗng / lỗi ⇒ `catalog_source="unavailable"` + `[]`, **không** trả list giả | test |
| AC11 | Exchange fail nhưng raw token gọi được `/models` ⇒ fallback raw token cho catalog | test — đây là hành vi đã thấy ở tool thật |
| AC12 | Token hết hạn giữa chừng lúc đang generate ⇒ 1 lần retry với token mới, không retry lặp | test |
| AC13 | UI: nút "Kiểm tra kết nối" báo đúng 4 trạng thái của 4 bẫy, có link hướng dẫn lấy `ghu_` token | test component |
| AC14 | `copilot` trong `ProviderChoices` + `model_choices` không còn là `FREEFORM` nữa (nếu đã có model cụ thể) | test |

**Minh chứng.** Bảng 4 bẫy: input → HTTP status → `error_code` → message; bằng chứng AC2/AC3/AC4 bằng test đếm số lần gọi.

**Phản biện.** *"`copilot_internal/v2/token` là endpoint nội bộ của IDE plugin, không phải API công khai — phụ thuộc không ổn định, sao dùng?"*
→ Đúng, và bằng chứng ngoài đời rất rõ: có dự án đã bỏ nó hẳn sang GitHub Models API (`models.inference.ai.azure.com`, nhận PAT trực tiếp). Giải phất 2 nhánh, cả hai đều đưa vào kế hoạch:
- **Nhánh A (mặc định, theo yêu cầu của bạn):** dùng Copilot token exchange → đúng nghĩa "dùng Copilot của tôi", dùng được toàn bộ catalog đa nhà cung cấp. Rủi ro: endpoint có thể đổi.
- **Nhánh B (dự phòng):** `env AI_COPILOT_TRANSPORT=github_models` ⇒ gọi `models.inference.ai.azure.com` với PAT, không cần exchange. Ít model hơn nhưng ổn định.
AC6/AC7 đã tách endpoint ra khỏi adapter để thêm nhánh B chỉ tốn ~1 ed mà không phải viết lại. **Nếu token exchange hỏng, bật nhánh B trong 1 biến env, không cần deploy code.**

**Tiêu chuẩn.** ISO/IEC 25010 — *Interoperability*, *Fault tolerance*; OWASP ASVS 5.0 — *Authentication* (token lifecycle); NIST SP 800-63B (token expiry/refresh, dùng như khung). **Rủi ro.** Trung bình (phụ thuộc API ngoài). **Ước lượng:** 4.0 ed. **Phụ thuộc:** R2.2, R0.5.

### R2.5 · Adapter `openclaw` (dịch vụ nội bộ) — **BLOCKED chờ spec D-03c**

**Yêu cầu (viết sẵn, chờ 5 thông tin).** Client theo đúng protocol của dịch vụ; nếu OpenAI-compatible thì kế thừa `openai_compat.py` chỉ ~0.5 ed; nếu protocol riêng thì viết adapter mới. Nếu dịch vụ dùng chung (không BYOK) ⇒ key ở `SystemAISettings.metadata`, provider thuộc **lớp B** (D-01), user không tự nhập key.

**File.** **mới** `advisory/ai_clients/openclaw.py` + `env_validation.py` (`OPENCLAW_BASE_URL`, `OPENCLAW_API_KEY` tùy D-03c#3) · `advisory/views.py:391-398` (bỏ đoạn `pass # openclaw don't need a key` nếu cần key) · **mới** `tests/test_ai_client_openclaw.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `OPENCLAW_BASE_URL` thiếu khi provider=`openclaw` ⇒ `503 error_code='openclaw_not_configured'`, **không** âm thầm rơi về provider khác | test — thay thế hành vi "luôn sẵn sàng" |
| AC2 | `probe()` gọi dịch vụ thật, trả latency + `ok` | test mock |
| AC3 | Không có OPENCLAW_BASE_URL ⇒ `ai_ready=false` + `reason_code='not_probed'` | test |
| AC4 | **Xoá `test_openclaw_returns_success`** (`tests/test_ai_management_center.py:283-286`) và `test_openclaw_creates_success_audit_log` (`tests/test_ai_audit_logs.py:242-245`) → thay bằng test fail-closed | test — **2 test này đang khoá hành vi giả** |
| AC5 | Lỗi OpenClaw được ghi `AIUsageRecord` + `AITrace` như provider khác | test |
| AC6 | Nếu là lớp B: user thường không thấy `openclaw` trong dropdown, staff thấy | test |
| AC7 | Failover: OpenClaw fail ⇒ thử deployment kế tiếp theo `AIFallbackChain` | test |

**Minh chứng.** Output 5 thông tin spec đã nhận (lưu vào `gates.md` kèm nguồn) + AC1-AC7.

**Phản biện & STOP condition.** *Slice này không làm được nếu thiếu spec.* → Đây là **STOP condition §3.4 mới (mục 6)**: không đoán base URL/protocol. Trong lúc chờ, **2 việc đã gộp vào R0.5** và không phụ thuộc spec: (a) sửa default `openclaw` → `openai`; (b) sửa 2 test khẳng định hành vi giả ở AC4. Như vậy wave R0 vẫn chạy trọn vẹn trong khi R2.5 chờ.

**Tiêu chuẩn.** ISO/IEC 25010 — *Availability*, *Fault tolerance*. **Rủi ro.** Trung bình (phụ thuộc spec + dịch vụ nội bộ). **Ước lượng:** 0.5-3.0 ed (**0.5** nếu OpenAI-compatible, **3.0** nếu protocol riêng). **Phụ thuộc:** R2.2 + **spec D-03c**.

### R2.6 · Health check định kỳ + auto-evict + routing strategy có decision log

**Yêu cầu.** `AIHealthCheck` record; task định kỳ probe deployment `enabled` qua `AiClient.probe()`; `health_state ∈ healthy/degraded/unhealthy`; routing theo `latency` / `cost` / `weighted`; ghi `routing_decision`.

**File.** **mới** `advisory/health.py` + task đăng ký trong `CELERY_BEAT_SCHEDULE` · `orchestrator.py` (dùng router) · **mới** `tests/test_ai_routing.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Task probe đúng số deployment `enabled` | test |
| AC2 | `unhealthy` **3 lần liên tiếp** ⇒ `enabled=False` + audit log + cảnh báo | test — 3 lần chống false-positive lúc provider đang deploy |
| AC3 | `healthy` 2 lần ổn định ⇒ bật lại | test |
| AC4 | 3 chiến lược × 5 deployment ⇒ kết quả **deterministic** với seed cố định | test |
| AC5 | Mỗi request ghi `{strategy, candidates, chosen, reason}` vào trace | test |
| AC6 | Không deployment nào healthy ⇒ `503 no_healthy_deployment`, **không** im lặng rơi về provider hỏng | test |
| AC7 | `AI_ROUTING_DISABLED` tắt toàn bộ về hành vi 1 deployment | test |
| AC8 | Task health check **dùng chung** `probe()` ⇒ copilot token được cache dùng lại, không đổi token mỗi lần probe | test đếm số exchange |

**Phản biện.** *"Auto-evict có thể chạy nhanh lúc provider đang deploy, gây mất dịch vụ."*
→ Đúng, nên AC2 yêu cầu 3 lần liên tiếp + cooldown, AC3 yêu cầu 2 lần ổn định. AC7 cờ tắt khẩn cấp.

**Tiêu chuẩn.** ISO/IEC 25010 — *Availability*, *Fault tolerance*; NIST AI RMF — **MANAGE 2.2**. **Rủi ro.** Trung bình. **Ước lượng:** 4.0 ed. **Phụ thuộc:** R2.1, R2.2, R2.4.

### R2.7 · `AICostRate` + snapshot giá + `pricing_source`

**Yêu cầu.** `AICostRate(model, provider, usd_per_1k_input, usd_per_1k_output, effective_from, pricing_source ∈ manual/openrouter/litellm/copilot_tier)`, unique `(model, provider, effective_from)`. `AIUsageRecord.cost` điền từ bảng giá; thêm cột `pricing_available`.

**Lưu ý Copilot:** giá qua Copilot **không tính theo token của bạn mà theo hạn mức subscription** ⇒ `pricing_source='copilot_tier'` + `cost=0` + `pricing_available=false` cho provider `copilot`, hiển thị *"đang dùng hạn mức Copilot của bạn"*. Không bịa giá 0 như thật.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Bảng giá rỗng ⇒ `cost=0`, `pricing_available=false`, UI hiện "chưa có bảng giá" — **không** hiện `$0.00` như thật | test |
| AC2 | Có giá ⇒ `cost` đúng 6 chữ số thập phân | test |
| AC3 | Giá cũ **không** ghi đè giá của record đã lưu | test |
| AC4 | UI hiện thời điểm + nguồn giá | test |
| AC5 | Import từ file JSON idempotent | test |
| AC6 | `provider='copilot'` ⇒ `pricing_available=false` + nhãn riêng, **không** á giá token | test — chống báo cáo chi phí sai |

**Phản biện.** *"Giá model thay đổi thì sao?"*
→ Đó là lý do có `effective_from` + snapshot **tại thời điểm ghi**: số tiền đã ghi không bao giờ đổi. Báo cáo "chi phí tháng này" dùng giá của từng record, không dùng giá hôm nay. Riêng Copilot dùng AC6 vì mô hình tính tiền khác hẳn.

**Tiêu chuẵn.** ISO/IEC 25010 — *Data accuracy*. **Rủi ro.** Thấp. **Ước lượng:** 2.5 ed. **Phụ thuộc:** R0.7.

### R2.8 · Budget 3 mức theo cost + token, soft 80% / hard 100%

**Yêu cầu.** `AIBudget(user nullable, tenant nullable, model nullable, period, max_cost_usd, max_tokens, soft_ratio=0.8)`. `resolve_budget(user, tenant, model)` theo thứ tự **model → user → tenant → system**, lấy **mức chặt nhất**. Hard ⇒ `429` + `error_code='ai_budget_exhausted'`; soft ⇒ cảnh báo (đã có `budget_soft_warning` ở `advisory/views.py:321`).

**Quyết định mã lỗi:** dùng `429` + `error_code` thay vì `412` của Portkey — `412 Precondition Failed` không còn ý nghĩa HTTP hiện đại, client/proxy dễ xử lý sai. **Deviation có chủ đích.**

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 4 tầng, lấy mức chặt nhất — ma trận 2×2×2 | unit test |
| AC2 | Biên 79/80/99/100/101% | test 5 case |
| AC3 | Hard ⇒ `429` + body có `budget{used,limit,pct,source}` | API test |
| AC4 | Soft ⇒ `201` + `budget_soft_warning` | API test |
| AC5 | `budget_source` trả đúng tầng quyết định | test |
| AC6 | Tenant A không tiêu budget tenant B | test isolation |
| AC7 | **Đổi sang model không có budget riêng vẫn bị giới hạn bởi tầng cha** | test — chống lỗ hổng |
| AC8 | Provider `copilot` dùng `max_requests`/hạn mức request thay vì cost | test — vì billing Copilot theo request/subscription |
| AC9 | Migration không backfill (default = hành vi hiện tại) | test |

**Phản biện.** *"Budget theo model ⇒ dễ bị vô hiệu hoá bằng cách đổi model."*
→ AC7 là bắt buộc vì thế. AC8 vì Copilot không tính tiền theo token của bạn.

**Tiêu chuẩn.** ISO/IEC 25010 — *Resource utilization*. **Rủi ro.** Trung bình. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R2.7, R0.9.

### R2.9 · Retry + exponential backoff + circuit breaker

**Yêu cầu.** Mỗi deployment có `num_retries`, `backoff_base_ms`, `cooldown_seconds`. Retry **chỉ** cho `429/5xx/timeout`; **không** cho `401/403/400`. Circuit breaker mở sau N lỗi liên tiếp, đóng lại sau cooldown.

**File.** `advisory/ai_clients/base.py` · `advisory/health.py` · env `AI_ADVISORY_DEADLINE_SECONDS`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `429` 3 lần rồi thành công ⇒ tổng 3 request, kết quả thành công | test |
| AC2 | `401` ⇒ **không** retry, fail ngay, **đúng 1** request | test đếm = 1 |
| AC3 | Backoff tăng dần | fake clock |
| AC4 | Breaker mở ⇒ không gọi provider, trả `503 provider_circuit_open` | test |
| AC5 | Breaker đóng lại sau cooldown | test |
| AC6 | Tổng thời gian có trần `AI_ADVISORY_DEADLINE_SECONDS` | test |
| AC7 | 3 sub-agent song song ⇒ retry ở tầng client, **không** 3× | test — tránh 9 request với 1 key |
| AC8 | **Copilot: token hết hạn KHÔNG tính là lỗi để retry/backoff** — phải refresh token 1 lần rồi retry, không retry 3 lần với token chết | test — nếu không, mỗi lỗi 401 của Copilot sẽ nhân 3 |

**Phản biện.** *"3 sub-agent chạy song song; retry ở tầng nào?"*
→ Retry ở tầng **client** (R2.2), không ở `asyncio.gather` — nếu không, 3 agent × 3 retry = 9 request với 1 key. AC7 kiểm. AC8 là chi tiết riêng của token-based provider.

**Tiêu chuẩn.** ISO/IEC 25010 — *Fault tolerance*, *Recoverability*; OWASP API Top 10 2023 **API4**. **Rủi ro.** Trung bình. **Ước lượng:** 2.5 ed. **Phụ thuộc:** R2.2, R2.4.

### R2.10 · Danh mục model động theo tài khoản — **bắt buộc cho Copilot**

**Yêu cầu.** Endpoint `GET /workspace/ai/providers/<provider>/models` proxy `AiClient.catalog()`, cache theo `provider + credential-hash`, TTL = vòng đời token (copilot ~25 phút) hoặc 24 h cho provider khác. UI: nút "Tại lại danh mục", nhóm "Đã xác minh" / "Chưa xác minh".

**Vì sao bắt buộc (không phải tuỳ chọn):** tài liệu GitHub nêu rõ danh mục Copilot phụ thuộc *"subscription, org membership, and feature flags"* theo tài khoản. Hardcode danh sách 30+ model vào `providerModels.ts` sẽ **hiện model user không có quyền dùng** ⇒ họ chọn xong mới nhận lỗi 404/403. Đây là cùng loại lỗi "hiển thị sai rồi mới vỡ" như `ai_ready` giả.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Endpoint trả danh mục provider thật qua `AiClient.catalog()` | test fixture — **RED trước fix** |
| AC2 | Rỗng/lỗi ⇒ `[]` + `catalog_source:"unavailable"`, **không** trả list hardcode giả | test |
| AC3 | Cache đúng TTL từng provider (copilot 25 phút, khác 24 h) | test số lần gọi provider |
| AC4 | UI dropdown có nhóm "Đã xác minh" / "Chưa xác minh" | test DOM |
| AC5 | Test-connection từ danh mục điền sẵn model | test |
| AC6 | Danh mục lọc theo `policy.state` + `model_picker_enabled` | test fixture |
| AC7 | Model có `context_window` hiển thị cạnh tên | test — giúp user chọn đúng cho context dài |
| AC8 | **`gemini-3.8-flash`: probe CẢ HAI endpoint** (Google trực tiếp `generativelanguage.googleapis.com` **và** Copilot `{endpoints.api}/models`), dán kết quả thật vào evidence | probe thật + ghi chứng minh |
| AC9 | Nếu Google trực tiếp **không** có mà Copilot **có** ⇒ **giữ model** trong danh mục, gắn nhãn *"chỉ dùng qua provider Copilot"* | test — **đính chính lỗi của audit Rev.1** |

**Minh chứng.** Output probe thật AC8 — **bằng chứng quan trọng nhất của R2**. Dán nguyên văn response của cả 2 endpoint, không tóm tắt.

**Phản biện.** *"Danh mục động có nghĩa gì khi hardcode 1 file được?"*
→ Nghĩa là khi provider thêm model mới, user không phải sửa code; và quan trọng hơn với Copilot, **user chỉ thấy đúng model tài khoản họ có quyền dùng**. Hardcode là cách chắc chắn sai với provider có gating theo tài khoản.

**Tiêu chuẩn.** ISO/IEC 25010 — *Maintainability*; NIST AI RMF — **MEASURE 2.5**. **Rủi ro.** Thấp. **Ước lượng:** 2.5 ed. **Phụ thuộc:** R2.2, R2.4, R0.6.

**Tổng R2: 10 slice, ~29.0-35.0 ed**



---

## WAVE R3 — OBSERVABILITY + EVAL (14-18 ed)

### R3.1 · `AITrace` + trace 4 bước mỗi advisory

**Yêu cầu.** `AITrace(trace_id UUID, advisory FK, user, symbol, session_date, step ∈ technical/flow/sentiment/synthesis, provider, model, prompt_hash, response_hash, tokens_in, tokens_out, latency_ms, status, error_code, created_at)`.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 1 refresh ⇒ **đúng 4** trace (3 sub + 1 synthesis) | test đếm 4, không 3, không 5 |
| AC2 | `prompt_hash`/`response_hash` là SHA-256, **không** lưu plaintext | test — quyết định PIPL |
| AC3 | `trace_id` giống nhau cho 4 bước | test |
| AC4 | Lỗi provider vẫn tạo trace `status='error'` | test |
| AC5 | Index theo `(user, session_date)` + `(trace_id)` | test introspection |
| AC6 | Retention task xoá > 90 ngày | test task |

**Minh chứng.** Bảng 4 trace của 1 advisory; test AC2 khẳng định không có plaintext.

**Phản biện.** *"Không lưu plaintext ⇒ không debug được vấn đề prompt."*
→ Đúng, và đây là đánh đổi có chủ đích với PIPL 13/2023. Bù lại: `prompt_template_version` + hash phát hiện được prompt nào sinh lỗi. Nếu cần đọc nội dung thì phải qua cơ chế redaction có kiểm soát (ticket riêng, có audit). **Ghi rõ giới hạn này trong tài liệu vận hành, đừng hứa là debug được.**

**Tiêu chuẩn.** PIPL 13/2023; ISO/IEC 42001:2023 — *data minimisation*; NIST AI RMF — **MEASURE 2.8**. **Rủi ro.** Thấp. **Ước lượng:** 2.5 ed. **Phụ thuộc:** R0.7.

### R3.2 · Trang "Traces" cạnh Usage

**Yêu cầu.** Waterfall 4 bước, diff prompt theo version, filter symbol/model/status.

**File.** **mới** `pages/AICommandTracesPage.tsx` + component + route + tab thứ 6 trong `AiHubNav` · adapter

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Route `/settings/ai/traces` + tab thứ 6 | test route |
| AC2 | Waterfall hiện latency từng bước + tổng | test DOM |
| AC3 | Click 1 bước ⇒ xem metadata (không xem plaintext) | test |
| AC4 | Filter hoạt động, có pagination | test |
| AC5 | Empty state trung thực: "chưa có trace nào — hãy chạy 1 lần tư vấn" | test — **không** hiện bảng rỗng |
| AC6 | User A không thấy trace user B | test isolation |
| AC7 | Loading skeleton; lỗi có nút Thử lại | test |

**Ước lượng:** 2.5 ed. **Phụ thuộc:** R3.1, R1.8.

### R3.3 · Dashboard SLO LLM

**Yêu cầu.** p50/p95/p99 latency, success rate, token/ngày, $/ngày, $/mã, theo model.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Percentile tính **trên DB** bằng window function, không kéo hết về Python | test 1000 bản ghi, so với giá trị tính tay |
| AC2 | `total=0` ⇒ hiện `—` chứ không phải `0%` | test |
| AC3 | `$` theo `pricing_available` | test |
| AC4 | Chart dùng token của R1.6 | `check-ai-cc` |
| AC5 | Range 7/30/90 ngày | test |
| AC6 | Cache 60 s; `document.hidden` thì không poll | test |

**Phản biện.** *"p95 chính xác cần toàn bộ dữ liệu — DB có scale được không?"*
→ Với `AIUsageRecord` đã index `(user, session_date)` và giới hạn 90 ngày retention (R3.1-AC6), `PERCENTILE_CONT` trên window function là đủ. Nếu vượt ~10M row, chuyển sang materialized aggregate theo ngày — ghi vào backlog R3.3b.

**Tiêu chuẩn.** ISO/IEC 25010 — *Performance efficiency*; SRE Workbook (Google) — *Service Level Indicators*. **Ước lượng:** 2.5 ed. **Phụ thuộc:** R3.1, R2.4.

### R3.4 · Feedback loop

**Yêu cầu.** Thumbs up/down + lý do trên advisory → `AIFeedback` → báo cáo tỉ lệ theo prompt version. **Chỉ báo cáo, chưa auto-đổi config.**

**File.** **mới** model + migration · `components/advisory/RecommendationCardExplainability.js` (thêm nút) · **mới** report

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Nút feedback có `aria-pressed` | test a11y |
| AC2 | 1 feedback / 1 record / 1 user (update được, không tạo bản trùng) | test unique constraint |
| AC3 | Báo cáo tỉ lệ theo `prompt_config` version | test |
| AC4 | Không feedback ⇒ hiện `—` (không phải 0%) | test |
| AC5 | Không tự đổi config (chỉ báo cáo) | review checklist — chống feedback loop tự khuếch đại |

**Tiêu chuẩn.** NIST AI RMF — **MEASURE 2.11 / MANAGE 4.1**. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R3.1.

### R3.5 · Alert ngưỡng

**Yêu cầu.** Email/webhook khi budget 80%/100%, provider fail ≥ N lần, p95 vượt ngưỡng. Dùng hệ thống alert **sẵn có** (`ops_audit` / SOC alert / `service_ops`), **không** tạo hệ thống thông báo mới.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Dùng kênh alert sẵn có (grep chứng minh không tạo dispatcher mới) | review checklist |
| AC2 | Ngưỡng cấu hình được | test |
| AC3 | Cảnh báo lặp có throttle, không spam | test: vượt 80% ⇒ 1 cảnh báo; vượt 81% ⇒ không thêm |
| AC4 | Kênh + người nhận cấu hình được, mặc định email user | test |

**Phản biện.** *"LiteLLM gửi webhook `threshold_crossed` ở 85% và 95% — có nên theo?"*
→ Theo **ngưỡng** (2 mốc) nhưng bỏ **kênh** webhook trong R3.5 vì repo chưa có webhook dispatcher cho AI và thêm mới là phạm vi riêng. Ghi vào backlog R3.5b.

**Ước lượng:** 1.5 ed. **Phụ thuộc:** R2.8, R3.3.

### R3.6 · PII redaction + guard chống prompt injection

**Yêu cầu.** Regex + heuristic cho PII (email, SĐT VN, CCCD 12/16 số, IBAN, mã số thuế) trước khi gửi prompt; guard phát hiện prompt injection trong input user.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 10 fixture PII ⇒ đã che trong prompt **và** trong `prompt_hash` | test |
| AC2 | **Không** phá câu hỏi bình thường có số (giá cổ phiếu, khối lượng) — 20 fixture số hợp lệ không bị che | test — rủi ro lớn nhất slice |
| AC3 | Guard injection ghi log + audit, **không** chặn cứng (false positive > false negative ở bước đầu) | test |
| AC4 | Tỉ lệ che ≥ 95% trên fixture PII, ≤ 1% che nhầm trên fixture số | test đo |
| AC5 | Cấu hình được tắt qua env | test |

**Minh chứng.** Bảng 10 fixture PII + 20 fixture số với kết quả che/không che.

**Phản biện.** *"Regex che CCCD 12 số sẽ che luôn giá 12 chữ số?"*
→ Vấn đề thật, và AC2 là bắt buộc vì thế. Thiết kế: chỉ che số **có ngữ cảnh** (sau từ khoá CCCD/CMND/MST) + checksum cơ bản cho CCCD; không che số trần. **Ghi rõ giới hạn: giảm, không loại bỏ rủi ro PII.**

**Tiêu chuẩn.** PIPL 13/2023; OWASP LLM Top 10 2025 (LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure) — dùng như khung tham chiếu, ghi rõ là tham chiếu. **Rủi ro.** Trung bình. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R3.1.

**Tổng R3: 6 slice, ~14-17 ed**

---

## WAVE R4 — GOVERNANCE ĐA TENANT (11-14 ed)

### R4.1 · Trang Tenant Admin → AI Policy

**Yêu cầu.** Admin tenant đặt giới hạn cấp tenant (max tokens/ngày, max cost/ngày, provider được phép, có cho phép BYOK không, giới hạn model). User chỉ override trong trần. Đây là nơi quyết định cuối cho D-01 ở cấp tenant.

**File.** **mới** `pages/admin/TenantAdminAIPolicyPage.tsx` + route trong `TenantAdminLayout` + menu `TenantAdminSidebar` · BE endpoint `ai-command-center/policy/` (đã tạo ở R0.9, giờ mở rộng payload) · `tests/test_ai_tenant_policy.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Route `/tenant-admin/ai-policy` trong layout + menu | test route |
| AC2 | Admin đặt `allow_byok=false` ⇒ user thường **không** lưu được API key; GET trả `system_policy.managed_by_platform=true` | test — **đây là AC quan trọng nhất của R4** |
| AC3 | User vượt trần ⇒ `422` + liệt kê field vượt | API test |
| AC4 | Tenant A không đọc/sửa policy tenant B | test isolation |
| AC5 | Staff thấy tổng quan đa tenant (read-only) | test |
| AC6 | Policy có version + audit mỗi lần đổi | test |
| AC7 | `allow_byok=false` **vẫn** cho user dùng khoá hệ thống trong `AI_FALLBACK_DAILY_QUOTA` | test — không chặn dịch vụ |

**Phản biện.** *"`allow_byok=false` chặn user không dùng AI thì mất doanh thu."*
→ AC7 bảo đảm họ vẫn dùng được qua khoá hệ thống trong hạn mức. Còn hơn là để user BYOK tự do khiến chi phí không kiểm soát và không audit được.

**Tiêu chuẩn.** ISO/IEC 42001:2023 — *organizational controls*; OWASP ASVS 5.0 — *Access Control*. **Ước lượng:** 3.0 ed. **Phụ thuộc:** R0.9, R2.8.

### R4.2 · Key scope + lịch xoay khoá

**Yêu cầu.** Scope `inference` vs `management`; `key_rotated_at`, `grace_until`; Fernet key version (`AI_CREDENTIAL_FERNET_KEY_V1` / `_V2`) để xoay không mất dữ liệu.

**File.** `identity_access/security.py:10-45` (`_get_fernet_key` hiện đọc 1 env) · `advisory/models.py` (`UserAICredential`) · **mới** migration · `tests/test_ai_key_rotation.py`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Scope `management` không gọi được API suy luận | test |
| AC2 | Xoay khoá: key cũ giải mã được trong `grace_until`, sau đó fail-closed | test |
| AC3 | Migration chấp nhận key hiện tại là V1; **thêm V2 không cần migration DB** | test |
| AC4 | Log cảnh báo khi đang dùng key quá hạn grace | test |
| AC5 | UI hiện thời điểm xoay kế tiếp | test |

**Phản biện.** *"Fernet hiện lấy key từ env; xoay khoá đòi hỏi đổi hạ tầng."*
→ Đúng, và đó là lý do tách `V1/V2` ngay từ migration: hôm nay `V1` = env hiện tại, ngày sau thêm `V2` mà **không cần** migration DB. AC3 đảm bảo đường nâng cấp không phá.

**Tiêu chuẩn.** ISO/IEC 25010 — *Security*; NIST SP 800-57 (key management, dùng như khung). **Ước lượng:** 2.5 ed. **Phụ thuộc:** R0.6.

### R4.3 · Audit append-only + retention + export theo tenant

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Không có API sửa/xoá log (grep chứng minh 0 endpoint) | grep + review |
| AC2 | Retention theo `AI_AUDIT_RETENTION_DAYS` (mặc định 365) | test task |
| AC3 | Export CSV cap 5000 + BOM + cờ `truncated` | unit test |
| AC4 | Staff tenant A export không chứa tenant B | test isolation |

**Ước lượng:** 2.0 ed. **Phụ thuộc:** R0.7, R1.2.

### R4.4 · `/settings/ai` vào `UserSettingsPage` dưới dạng mục con

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | `UserSettingsPage` render link tới `/settings/ai` trong nhóm "Trí tuệ nhân tạo" | test DOM |
| AC2 | Breadcrumb quay lại `/settings` trên mọi route AI CC | test 3 route |
| AC3 | Ảnh 3 mức điều hướng (`/settings` → `/settings/ai` → tab con) | 3 ảnh |

**Ước lượng:** 1.0 ed. **Phụ thuộc:** R1.8.

### R4.5 · `AiHubNav` mở rộng + phân quyền hiển thị tab

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 6 tab (thêm Traces) | test |
| AC2 | User thường không thấy tab cần staff | test 2 context |
| AC3 | Tab ẩn vẫn **không truy cập được bằng URL trực tiếp** (route guard, không chỉ ẩn UI) | test gõ URL — đây là AC chống "chỉ ẩn UI" |
| AC4 | Active state đúng trên 4 route | test |

**Ước lượng:** 1.5 ed. **Phụ thuộc:** R3.2, R0.9.

**Tổng R4: 5 slice, ~10-13 ed**

---

## WAVE R5 — DỌN NỢ + TAB CHẾT (6-8 ed)

### R5.1 · Quyết định số phận `AgentRegistry` (nối hoặc gỡ)

**Yêu cầu.** Không được để tiếp. Đo đạc trước khi quyết định:

| Phương án | Nội dung | Ước lượng | Rủi ro |
|---|---|---|---|
| **A — nối** | Orchestrator đọc agent theo `agent_type` để override system sub-agent prompt + model | 3.0 ed | Trung bình (thêm đường thực thi mới) |
| **B — gỡ** | Xoá tab Agents, model, endpoint, migration | 1.0 ed | Thấp |

**Tiêu chí chọn (ghi để không phải hỏi lại):** nếu roadmap 2 wave tới không dùng agent ⇒ chọn **B**. Bằng chứng hiện tại: `AGENT_TYPES` liệt kê 6 loại nhưng **không có kiến trúc nào dùng**; grep `AgentRegistry` toàn backend chỉ khớp trong chính `ai_agents` + `settings.py:90` + `db_router.py:34`. **Khuyến nghị: B.**

**AC (nếu chọn B).** AC1 grep `AgentRegistry` toàn repo → chỉ còn migration lịch sử; AC2 route `/settings/ai/agents` → 404 có trang thân thiện; AC3 menu bỏ tab; AC4 tab count 6 → 5; AC5 `check-ai-cc` xanh; AC6 `AICommandCenterForm` **giữ nguyên** (F8 tách cho 2 trang dùng chung — Shell dùng ở R0.8 đã xoá nhưng vip-app/embed có thể cần).

**Phản biện.** *"Gỡ là mất tài sản đã xây."*
→ Tài sản là 1 bảng CRUD chưa từng được đọc. Giữ nó là **chi phí bảo trì** (UI + endpoint + test + menu) cho một tính năng không có tác dụng. Nếu sau này cần, khôi phục từ git history + migration cũ. Nêu rõ điều này trong PR description để quyết định được ghi lại.

**Tiêu chuẩn.** ISO/IEC 25010 — *Maintainability*. **Ước lượng:** 1.0 ed. **Phụ thuộc:** R0.8.

### R5.2 · Sửa path `ops_audit`

`/core/v1/ai-agents/` → `/core/v1/ai/agents/` (`ops_audit/tasks.py:139`).
**AC.** Test mapping đúng; audit trail ghi `ai_agents` cho request thật.

### R5.3 · Hiện + sửa 4 system sub-agent prompt

**Yêu cầu.** `orchestrator.py:140-143` đọc `metadata['technical_agent_prompt'|'flow_agent_prompt'|'sentiment_agent_prompt'|'synthesis_agent_prompt']` — quyết định chất lượng nhưng **vô hình** trong UI.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | Staff thấy 4 prompt, sửa được, có version history (dùng cơ chế `prompt_config_history` sẵn có) | test |
| AC2 | User thường không thấy | test |
| AC3 | Sửa 1 prompt ⇒ trace đã tạo ghi `prompt_template_version` cũ | test |
| AC4 | Diff preview trước khi lưu (dùng component R1.9) | test |
| AC5 | Kiểm thử: 1 mã, 2 lần generate với prompt khác ⇒ `structured_output` **khác nhau** | test tích hợp có bằng chứng khác biệt, không khẳng định "tốt hơn" |

**Phản biện.** *"'tốt hơn' thì sao chứng minh được bằng test?"*
→ Không, và AC5 **cố tình** chỉ khẳng định "khác nhau". Đánh giá chất lượng cần eval dataset + người chấm (R3.4 chỉ mới gom feedback). Ghi rõ giới hạn này trong tài liệu vận hành.

**Tiêu chuẩn.** ISO/IEC 25010 — *Configurability*; NIST AI RMF — **MAP 2.3**. **Ước lượng:** 2.0 ed. **Phụ thuộc:** R0.9, R1.9, R3.1.

### R5.4 · Tách `PortfolioAICommandCenterView`

**Yêu cầu.** 380 dòng 1 view, 2 khối response lặp nguyên văn → service + serializer.

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | GET/PUT dùng chung 1 hàm dựng payload (không còn lặp) | test so key-set GET ≡ PUT |
| AC2 | View ≤ 120 dòng | đếm dòng |
| AC3 | 8 file test cũ vẫn xanh **không sửa** | pytest |
| AC4 | Coverage dòng mới ≥ 80% | coverage report |

**Ước lượng:** 2.0 ed. **Phụ thuộc:** R0.1, R0.2.

### R5.5 · `ai_readiness` có cấu trúc — dọn nốt `ai_config_message`

**AC**

| # | Điều kiện | Cách kiểm |
|---|---|---|
| AC1 | 0 tham chiếu `ai_config_message` ở FE lẫn BE | grep |
| AC2 | Mọi thông báo lỗi advisory đi qua `PROVIDER_ERROR_CODES` + `public_payload()` (`orchestrator.py:24-60`), không lộ raw | test |
| AC3 | Mọi `error_code` trong bảng đều có key i18n | script parity |

**Ước lượng:** 1.0 ed. **Phụ thuộc:** R0.4, R1.3.

**Tổng R5: 5 slice, ~7-8 ed**

---

## §3. DAG PHỤ THUỘC + LỊCH TRÌNH

### 3.1 DAG (46 nút, 61 cạnh, **0 cycle** — kiểm chứng bằng `npm run check:ai-cc-dag`)

```
R0.1 ─┬─► R0.2 ─┬─► R0.3
      │         └─► R1.9
      └─► R2.1 ──────────────────► R2.6 ◄── R2.4

R0.5 ─┬─► R0.4
      ├─► R0.6 ─┬─► R2.10 ◄── R2.4
      │         └─► R4.2
      └─► R2.2 ─┬─► R2.3 ─────────► (bật claude)
                ├─► R2.4 ─┬────────► R2.6
                │         └─► R2.9
                ├─► R2.10
                └─► R2.5 *BLOCKED* (cần spec D-03c)

R0.9 ──► R0.7 ─┬─► R1.5
              ├─► R1.10
              ├─► R2.7 ─┬─► R2.8 ◄── R4.1 ◄── R0.9
              │         │      │
              │         │      └──► R3.5 ◄── R3.3
              │         └─► R3.3
              ├─► R3.1 ─┬─► R3.2 ──► R4.5 ◄── R0.9
              │         ├─► R3.3
              │         ├─► R3.4
              │         ├─► R3.6
              │         └─► R4.3 ◄── R1.2
              └─► R5.3 ◄── R1.9, R3.1

R0.8 ─┬─► R1.1 ─┬─► R1.2 ─┬─► R1.4 ──► R1.7
      │         │          └─► R1.8 ◄──┘
      │         ├─► R1.6  │
      │         │          └─► R4.4
      │         └─► R1.3 ──► R1.11
      └─► R5.1
```

`*` **R2.5 (openclaw) là nút độc lập** — không chặn wave R2, vì 9/10 slice R2 không phụ thuộc nó.

**Kết quả kiểm chứng DAG (đã chạy script, không phải review bằng mắt):**

| Kiểm tra | Kết quả | Gate tái lập |
|---|---|---|
| Số slice trong §2 | **46** | `npm run check:ai-cc-dag` |
| Số cạnh (từ trường `Phụ thuộc`) | **61** | `npm run check:ai-cc-dag` |
| Chu trình (DFS 3 màu) | **0** | `npm run check:ai-cc-dag` |
| Cặp phụ thuộc vòng (dạng chu trình 2) | **0** | `npm run check:ai-cc-dag` |
| Tham chiếu tới slice không tồn tại | **0** | `npm run check:ai-cc-dag` |
| Slice không có đường vào | **0** | `npm run check:ai-cc-dag -- --verbose` |

> **Đính chính minh bạch (2 lần, cả 2 đều do tôi khai sai rồi tự sửa):**
> **(a) DAG.** Lần soạn đầu khai báo "0 cycle" **mà chưa kiểm chứng** — script DFS tìm ra 2 cặp vòng `R0.4 ↔ R0.5` và `R0.7 ↔ R0.9`. Đã sửa bằng cách đặt R0.5 (chính sách provider) và R0.9 (định nghĩa ai thấy gì) là lớp thấp hơn; R0.4 (readiness) và R0.7 (audit scope) **tiêu thụ** chính sách đó.
> **(b) Chính sách provider.** Rev.1 đề xuất **gỡ `openclaw` + `copilot`** — **sai**, đã bị phản biện và ghi đè ở **D-03 Rev.2**. Cả hai là provider thật, phải có client thật (R2.4, R2.5).
>
> Bảng trên là output **sau khi sửa cả hai lần**, chạy bằng script đã lưu trong repo: `packages/web/scripts/check-ai-cc-dag.mjs`.

**Gate đã kiểm chứng bằng test âm tính** (bằng chứng gate bắt lỗi thật, không phải gate "luôn xanh"):

| Test âm tính | Kết quả mong đợi | Kết quả thật |
|---|---|---|
| Tiêm cặp vòng `R0.5 → R0.4` | exit 1 | `1 cycle(s): R0.5 -> R0.4` + `2 mutual pair(s)` + `edge count 55 != 53` |
| Tiêm tham chiếu treo `R0.8 → R9.9` | exit 1 | `1 dangling ref(s): R0.8 -> R9.9` |
| Plan nguyên trạng | exit 0 | `PASS (43 nodes, 53 edges, 0 cycle, 0 dangling, 5 roots)` |

Đây là bài học Entry 227 áp dụng: **claim phải kèm cách kiểm chứng, không kèm ý định kiểm chứng.**

### 3.2 Lịch trình theo wave (2 người: 1 BE + 1 FE)

| Wave | Slice | BE ed | FE ed | Gate ed | Tổng | Tuần (2 người) |
|---|---|---|---|---|---|---|
| **R0** | 9 | 9.5 | 3.0 | 3.0 | **15.5-18.5** | 2.0-2.5 |
| **R1** | 11 | 0.5 | 10.5 | 2.5 | **13.5-16.5** | 1.5-2.0 |
| **R2** | 10 | 18.0 | 7.0 | 2.0 | **29.0-35.0** | 3.5-4.0 |
| **R3** | 6 | 6.0 | 6.0 | 2.0 | **14.0-17.0** | 1.5-2.0 |
| **R4** | 5 | 6.0 | 3.0 | 1.0 | **10.0-13.0** | 1.0-1.5 |
| **R5** | 5 | 4.0 | 2.0 | 1.0 | **7.0-8.0** | 0.5-1.0 |
| **Tổng** | **46** | **44.0** | **31.5** | **12.0** | **89.0-108.0** | **10.0-13.5** |

> **Ước lượng thực tế có buffer:** **89-108 ed** là công sức kỹ thuật thuần (đã cộng đúng từ 6 dòng trên). Cộng thêm **review + QA + visual QA + fix vòng 2 + deploy** × 1.25-1.55 ⇒ **~130-165 engineer-day** như tiêu đề. Nếu **1 người** làm cả FE lẫn BE: **~16-21 tuần**. Nếu 3 người (2 BE + 1 FE): **~7-9 tuần** nhưng phải chia đúng R0 (1 BE + 1 FE) và R2 (2 BE) — 3 người giai đoạn R1 (chủ yếu FE) sẽ lãng phí.
>
> **R2 tăng từ 20-24 → 29-35 ed** vì thêm 2 adapter thật: `copilot` (R2.4, ~4 ed — có token exchange + catalog sống) và `openclaw` (R2.5, 0.5-3.0 ed tùy protocol). Đây là chi phí của việc **làm cho provider thật** thay vì giả vờ không có.
>
> **Đây là ƯỚC LƯỢNG, không phải cam kết.** Chưa có tiền lệ tương tự trong repo cho wave cỡ này. Nếu R0 vượt 18.5 ed ⇒ dừng, đo lại toàn plan, **không** cắt AC để vừa deadline (cắt AC là cắt tiêu chí nghiệm thu).

### 3.3 Mốc nghiệm thu (Gate milestone)

| Mốc | Sau wave | Điều kiện nghiệm thu |
|---|---|---|
| **M0** | R0 | 5 finding P0 của audit đóng; không còn data leak cross-tenant; không còn SSRF; mất-cấu-hình-âm-thầm đóng. **Đây là mốc bắt buộc — chưa đạt thì KHÔNG bán tính năng cho khách hàng.** |
| **M1** | R1 | 3 route đạt WCAG 2.2 AA; 0 key i18n chết; `check:ai-cc` xanh; `ai-cc-contract-smoke` thay bằng integration test thật |
| **M2** | R2 | Failover tự động chứng minh bằng test (giết deployment → request thành công qua deployment 2); budget USD chặn đúng ở biên |
| **M3** | R3 | 1 advisory sinh 4 trace; dashboard SLO có số thật; feedback lưu được |
| **M4** | R4 | Tenant A không tác động Tenant B ở **bất kỳ** AI CC endpoint nào (test ma trận đầy đủ) |
| **M5** | R5 | Không còn code chết trong phạm vi AI CC; 0 vi phạm gate |

### 3.4 Điều kiện dừng (STOP conditions)

Dừng và báo lại, **không tự quyết**, khi:

1. Test BE **không chạy được** vì môi trường (thiếu DB) — **đây là blocker hạ tầng, không phải lý do để ghi "PASS"**.
2. Một AC trong R0 **không đạt** sau 2 lần sửa — có thể phát hiện ra finding gốc sai, cần đánh giá lại.
3. Migration cần **sửa file đã chạy** (vi phạm BR-07) — dừng, tách migration repair thành ticket riêng.
4. Phát hiện thêm rò rỉ dữ liệu **ngoài** phạm vi audit (ví dụ: `WhaleAlertCanonical` cũng cross-tenant) — báo, **không tự mở rộng phạm vi**.
5. Chi phí provider tăng vọt khi chạy test probe — dừng, kiểm tra rate limit trước.
6. **R2.5 (openclaw) thiếu bất kỳ thông tin nào trong 5 mục D-03c** ⇒ đánh dấu `BLOCKED`, **không đoán** base URL / protocol / auth. Wave R2 vẫn chạy (9/10 slice không phụ thuộc). Việc chặn P0 liên quan (sửa default provider, xoá 2 test khẳng định hành vi giả) nằm ở R0.5 nên **không** bị chặn.
7. `copilot_internal/v2/token` trả 404 trong môi trường dev **và** token GitHub thật ⇒ báo, không tự chuyển sang luồng khác. Kích hoạt `AI_COPILOT_TRANSPORT=github_models` (R2.4 nhánh B) là **quyết định vận hành**, cần owner xác nhận — không tự bật trong prod.

---

## §4. TEST CATALOG

### 4.1 Nguyên tắc

| # | Quy tắc |
|---|---|
| T-01 | Mỗi AC trong §2 mã hoá thành **ít nhất 1 test tự động**. Không có "AC kiểm thủ công" trừ AC nêu rõ ảnh/screenshot. |
| T-02 | Với finding P0/P1: test phải **fail trước khi sửa** và output RED dán vào evidence. Đây là điều kiện nghiệm thu, không phải khuyến nghị. |
| T-03 | Test BE đặt flat trong `packages/core/backend/tests/test_*.py`, tên `test_ai_<mục đích>.py`. |
| T-04 | Test isolation bắt buộc cho mọi thay đổi scope dữ liệu: **2 user + 2 tenant** (AC1/AC2 của R0.7, R1.5, R2.5, R3.2, R4.1, R4.3, R4.4). |
| T-05 | Test FE: 3 route × 2 theme × 2 locale cho mọi thay đổi UI. |
| T-06 | **Test contract phải thật** — `ai-cc-contract-smoke.component.test.ts` hiện là tautology (so fixture với fixture). R1.8 phải thay bằng: đọc response thật từ integration test, hoặc sinh fixture từ OpenAPI schema. Không được giữ dạng tautology. |
| T-07 | Coverage dòng mới ≥ 80% (`.coveragerc` sẵn có, report-only — tăng lên gate sau khi hết pre-existing). |

### 4.2 Danh mục file test mới

| File | Slice | Nội dung |
|---|---|---|
| `backend/tests/test_ai_effective_model_contract.py` | R0.1 | AC1-6 |
| `backend/tests/test_ai_prompt_config_shape.py` | R0.2 | AC1-5, 7 |
| `backend/tests/test_ai_outbound_guard.py` | R0.6 | AC1-4, 6, 9 (unit) |
| `backend/tests/test_ai_cc_ssrf.py` | R0.6 | AC5, 7, 8 (API + throttle) |
| `backend/tests/test_ai_audit_tenant_isolation.py` | R0.7 | AC1-4 (2 user + 2 tenant) |
| `backend/tests/test_ai_usage_instrumentation.py` | R0.7 | AC6-10 |
| `backend/tests/test_ai_cc_policy_gating.py` | R0.9 | AC1-9 |
| `backend/tests/test_ai_ai_cc_ops_mapping.py` | R0.8 | AC9 |
| `backend/tests/test_ai_cc_concurrency.py` | R1.9 | AC1-3 |
| `backend/tests/test_ai_usage_filters.py` | R1.5 | AC1-5 |
| `backend/tests/test_ai_clients.py` | R2.2 | AC1-3, 5 |
| `backend/tests/test_ai_routing.py` | R2.3 | AC1-7 |
| `backend/tests/test_ai_budget.py` | R2.5 | AC1-8 |
| `backend/tests/test_ai_circuit_breaker.py` | R2.6 | AC1-7 |
| `backend/tests/test_ai_model_catalog.py` | R2.7 | AC1-3 |
| `backend/tests/test_ai_traces.py` | R3.1 | AC1-6 |
| `backend/tests/test_ai_tenant_policy.py` | R4.1 | AC1-7 |
| `backend/tests/test_ai_key_rotation.py` | R4.2 | AC1-5 |
| `backend/tests/test_ai_pii_redaction.py` | R3.6 | AC1-5 |
| `web/scripts/check-ai-cc.mjs` | R0.8 | gate (AC3-7) |
| `web/src/components/__tests__/ai-cc-prompt-config-dirty.component.test.ts` | R0.3 | AC1-6 |
| `web/src/components/__tests__/ai-settings-tokens.component.test.ts` | R1.1 | AC1-4 |
| `web/src/components/__tests__/ai-audit-panel-a11y.component.test.tsx` | R1.2 | AC1-8 |
| `web/src/components/__tests__/ai-cc-form-dirty.component.test.tsx` | R1.4 | AC1-6 |
| `web/src/components/__tests__/ai-usage-filters.component.test.tsx` | R1.5 | AC6 |
| `web/src/components/__tests__/ai-hub-nav.component.test.tsx` | R1.8 | AC2-4 |
| `web/src/components/__tests__/ai-config-preview.component.test.tsx` | R1.9 | AC4-5 |
| `web/src/components/__tests__/ai-cc-contract-integration.test.ts` | R1.8 | **thay tautology** |
| `web/src/lib/__tests__/capabilities.test.ts` | R1.11 | AC3 |

**Tổng: 28 file test mới.** Mỗi file có AC-ID trong docstring để nghiệm thu đối chiếu ngược (T-01).

### 4.3 Script kiểm chứng (dùng cho gate lặp lại)

Lưu vào `packages/web/scripts/ai-cc/` để tái dùng:

| Script | Kiểm | Dùng ở |
|---|---|---|
| `check-i18n-keys.mjs` | mọi `t()` literal tồn tại ở cả `vi.js` + `en.js`; báo cả key chết | R0.8, R1.3 |
| `check-no-hex-tsx.mjs` | 0 hex/rgba trong danh sách file AI CC | R0.8, R1.6 |
| `check-no-fallback-or.mjs` | 0 mẫu `t(...) \|\| "` | R0.8, R1.3 |
| `check-testids.mjs` | 8 testid form bắt buộc còn trong source | R0.8 |
| `list-slice-ids.mjs` | liệt kê AC-ID trong §2 so với AC-ID trong docstring test | nghiệm thu cuối |

---

## §5. CỔNG CHẤT LƯỢNG (CÁCH CHẠY + KỲ VỌNG)

### 5.1 Gate bắt buộc mỗi slice

| Gate | Lệnh | Kỳ vọng | Ghi chú |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` | exit 0 | baseline hiện tại: 0 |
| Lint | `npm run lint` | **0 errors** | baseline: 3547 warnings (cả repo) — dùng làm tham chiếu, **không được tăng** |
| Lint scoped AI CC | `npx eslint <9 file AI CC>` | 0 errors, **0 warning** từ R1.3 xong (hiện 20) | |
| Test component | `npx vitest run` | không giảm so với baseline | |
| Token/landmark/contrast | `npm run check:tokens` / `check:dom-landmarks` / `check:contrast` | exit 0 | |
| Gate AI CC | `npm run check:ai-cc` | exit 0 | **mới ở R0.8** |
| Shell tổng | `npm run check:shell` | exit 0 | hiện **0 coverage AI CC** — sau R0.8 mới có |
| Build | `npm run build` | exit 0 | |
| BE check | `python manage.py check` | exit 0 | |
| Migration | `python manage.py makemigrations --check --dry-run` | exit 0 | chống BR-07 |
| BE test | `python -m pytest tests/test_ai_*.py -q` | OK | **cần DB** |

### 5.2 Trạng thái gate tại thời điểm lập kế hoạch (2026-09-25, đã chạy thật)

| Gate | Kết quả | Nguồn |
|---|---|---|
| `npx tsc --noEmit` | **exit 0** | audit Entry 228 |
| `npx eslint` 9 file AI CC | 0 errors / **20 warnings** | audit |
| `npx vitest run` 4 file AI CC | 4 files / **21 tests PASS** (nhưng contract test tautology) | audit |
| `npm run check:shell` | exit 0 (**0 coverage AI CC**) | audit |
| `npm run check:tokens` | PASS (72 hex allowlist) | audit |
| `npm run check:contrast` | PASS (7 tone × 2 mode) | audit |
| `npm run check:shell:legacy` | **exit 1 — CRASH** `ERR_UNKNOWN_FILE_EXTENSION ".css"` | audit |
| `npm run i18n:scan` | exit 0, idempotent (hash `vi.js` không đổi) | audit |
| BE tests | **NOT VERIFIED** — 71 errors, không connect Postgres | audit |

### 5.3 Gate mới phải có (nếu không có, R0.8 chưa xong)

1. `check:ai-cc` — AC3-AC6 của R0.8.
2. **Test contract thật** (T-06) — thay tautology.
3. **Gate "key i18n tồn tại"** — chặn F-09 tái phát.
4. **Test isolation chuẩn 2-user-2-tenant** — chặn F-04 tái phát.
5. **Test SSRF** — chặn F-05 tái phát.
6. **Test "config có tác dụng"** (R0.1-AC1) — chặn F-01 tái phát.

> **Đánh giá trung thực:** hiện **không** gate nào bắt được 6 loại lỗi trên. Đây là khoảng trống assurance nguy hiểm nhất của dự án, vì "gates xanh" đang che một hệ thống có rò rỉ dữ liệu cross-tenant. Ưu tiên tạo gate cao hơn ưu tiên làm thêm feature.

---

## §6. ÁNH XẠ TIÊU CHUẨN QUỐC TẾ

| Tiêu chuẩn | Điều khoản/đặc tính | Slice thực hiện | Minh chứng |
|---|---|---|---|
| **OWASP Top 10 2021** | A10 SSRF | R0.6 | `test_ai_outbound_guard.py` + `test_ai_cc_ssrf.py` |
| **OWASP API Security Top 10 2023** | API1 BOLA, API3 BOPLA, API4 Unrestricted Resource Consumption | R0.7, R0.6, R2.5 | test isolation + throttle test |
| **OWASP ASVS 5.0** | Access Control | R0.9, R4.1, R4.5 | `test_ai_cc_policy_gating.py` |
| **OWASP ASVS 5.0** | Validation | R0.5, R0.2, R1.9 | 400/422/409 test |
| **OWASP ASVS 5.0** | Communication | R0.6 | outbound guard |
| **NIST AI RMF 1.0** | MEASURE 2.7 (disclose limitations) | R0.4 | `ai_readiness` struct |
| **NIST AI RMF 1.0** | MEASURE 2.8 (provenance) | R3.1 | `prompt_hash`, `trace_id` |
| **NIST AI RMF 1.0** | MANAGE 2.2 (third-party risk) | R2.3 | health check + evict |
| **NIST AI RMF 1.0** | MAP 2.3 (system requirements) | R5.3 | 4 sub-agent prompt quản lý được |
| **ISO/IEC 42001:2023** | Data governance | R0.7, R4.3 | tenant scope + append-only |
| **ISO/IEC 42001:2023** | Organizational roles | R0.9, R4.1 | role × surface matrix |
| **ISO/IEC 42001:2023** | Data minimisation | R3.1, R3.6 | không lưu plaintext |
| **ISO/IEC 23894:2023** | Data quality risk | R0.2, R2.4 | shape chuẩn + giá snapshot |
| **ISO/IEC 25010:2023** | Functional suitability | R0.1, R1.5 | contract test |
| **ISO/IEC 25010:2023** | Data integrity | R0.2 | migration + validate |
| **ISO/IEC 25010:2023** | Reliability / Fault tolerance | R1.7, R2.3, R2.6 | retry + breaker + abort |
| **ISO/IEC 25010:2023** | Usability (appropriateness) | R1.4, R1.10 | skeleton + nhãn quota |
| **ISO/IEC 25010:2023** | Modularity / Maintainability | R1.1, R1.8, R2.2, R5.4 | token + adapter + service |
| **ISO/IEC 25010:2023** | Compatibility / Interoperability | R2.2, R2.7 | adapter + catalog |
| **ISO/IEC 25010:2023** | Security / Accountability | R0.6, R0.7, R4.2 | audit + key rotation |
| **ISO/IEC 25010:2023** | Localizability | R1.3 | i18n parity |
| **ISO/IEC 25010:2023** | Performance efficiency | R3.3 | SLO |
| **ISO/IEC 25012:2008** | Maintainability characteristics | R0.8, R5.1 | bỏ code chết |
| **WCAG 2.2 AA** | 1.4.3 Contrast (min), 1.4.11 Non-text | R1.2, R1.6 | `check:contrast` + ảnh |
| **WCAG 2.2 AA** | 2.1.1 Keyboard | R1.2 | test `userEvent.keyboard` |
| **WCAG 2.2 AA** | 4.1.2 Name/Role/Value, 4.1.3 Status Messages | R1.2, R1.4, R3.4 | `aria-expanded`, `aria-live` |
| **RFC 9457** | Problem Details for HTTP APIs | R0.2, R0.5, R1.9 | `error_code` cấu trúc |
| **RFC 9110** | §9.3.2 optimistic concurrency | R1.9 | `expected_updated_at` |
| **OpenAPI 3.1** | Schema là SSOT cho contract | R1.8 (T-06) | sinh fixture từ schema |
| **PIPL 13/2023** | Data minimisation, purpose limitation | R3.1, R3.6 | không lưu plaintext; redaction |
| **SemVer** | `/policy/` là endpoint mới → minor bump | R0.9, R4.1 | changelog |

**Deviation có chủ đích (ghi để không ai "sửa ngược"):**

| Deviation | Lý do |
|---|---|
| Dùng `429` + `error_code` thay vì `412` (Portkey) | `412 Precondition Failed` không còn ý nghĩa HTTP hiện đại; client/proxy dễ xử lý sai |
| Không lưu plaintext prompt/response (khác LangSmith mặc định) | PIPL 13/2023; đánh đổi có ghi trong R3.1 |
| `ai_readiness` cấu trúc thay vì boolean đơn | Trung thực trạng thái; boolean giữ tương thích |
| Gộp R0.7 (audit isolation + usage instrumentation + gỡ POST) | Cùng bản chất "dữ liệu AI không tenant nào thấy"; tách nhỏ tốn thêm migration |
| Chỉ scope R1 trong AI CC, không gộp token toàn repo | Gộp phạm vi rộng (Entry 213, 40+ file) sẽ trượt deadline |

---

## §7. MIGRATION, ROLI BACK, CANARY

### 7.1 Danh mục migration (thứ tự áp dụng, **chỉ thêm file mới**)

| # | File | App | Mục đích | Slice | Reversible |
|---|---|---|---|---|---|
| M1 | `advisory/migrations/0011_canonicalize_prompt_config.py` | advisory | Row phẳng → `{version, sources}` | R0.2 | **Có** (ghi shape cũ vào cột tạm, xem 7.3) |
| M2 | `advisory/migrations/0012_aiauditlog_user_tenant.py` | advisory | + `user`, `tenant`, `legacy_unattributed` | R0.7 | Không (dữ liệu audit chỉ tăng) |
| M3 | `ai_analytics/migrations/0002_aiusagerecord_indexes.py` | ai_analytics | Index cho truy vấn SLO | R0.7 | Có (drop index) |
| M4 | `advisory/migrations/0013_aideployment.py` | advisory | `AIDeployment` | R2.1 | Có (drop table, dữ liệu test) |
| M5 | `advisory/migrations/0014_aifallbackchain.py` | advisory | `AIFallbackChain` | R2.1 | Có |
| M6 | `advisory/migrations/0015_aicostrate.py` | advisory | `AICostRate` | R2.4 | Có |
| M7 | `advisory/migrations/0016_aibudget.py` | advisory | `AIBudget` | R2.5 | Có |
| M8 | `advisory/migrations/0017_aitrace.py` | advisory | `AITrace` | R3.1 | Có |
| M9 | `advisory/migrations/0018_aifeedback.py` | advisory | `AIFeedback` | R3.4 | Có |
| M10 | `advisory/migrations/0019_aihealthcheck.py` | advisory | `AIHealthCheck` | R2.3 | Có |
| M11 | `advisory/migrations/0020_credential_key_version.py` | advisory | `key_version`, `key_rotated_at`, `grace_until`, `scope` | R4.2 | Có |
| M12 | `advisory/migrations/0021_ai_tenant_policy.py` | advisory | `AITenantPolicy` | R4.1 | Có |

**Quy tắc:** mỗi migration có `RunPython` **reversible** trừ M2 (ghi chú lý do trong file). `makemigrations --check --dry-run` phải sạch sau mỗi migration.

### 7.2 Rủi ro migration

| Rủi ro | Giảm thiểu |
|---|---|
| M1 sửa dữ liệu cấu hình đang dùng | `--dry-run` báo cáo số dòng đổi; backup DB trước; xem 7.3 |
| M2 backfill `actor` → `user` sai owner | Dòng không khớp giữ `NULL` + `legacy_unattributed=True`; **không** đoán |
| Lock bảng khi backfill lớn | Dùng `apps.get_model` + batch 1000 + `select_for_update(skip_locked=True)` nếu Postgres ≥ 12 |
| Migration chạy lâu trên DB lớn | Đo trên copy DB dev trước; nếu > 60 s thì tách thành 2 migration |

### 7.3 Rủi ro riêng M1 (quan trọng nhất)

Vì M1 **sửa JSON đang được đọc bởi runtime**, cần:

1. Backup `advisory_useraicredential` (hoặc dùng snapshot có sẵn của hạ tầng).
2. Chạy `--dry-run`, dán output số dòng đổi.
3. Migration chỉ **bổ sung** `sources` từ key cũ; **không xoá** key cũ trong cùng lần chạy (giữ 1 release) ⇒ nếu cần rollback chỉ revert code, dữ liệu vẫn parse được theo cả 2 shape.
4. R0.2-AC3 (config hợp lệ sống sót qua parse) là bằng chứng bắt buộc cho bước 3.
5. Xoá key cũ ở **migration 0012-R** (sau 1 release, đã xác minh không còn dữ liệu phẳng).

### 7.4 Roli back

| Mức | Hành động | Điều kiện |
|---|---|---|
| **L1 — tắt feature** | `AI_ADVISORY_ENABLED=false` (thêm nếu chưa có) hoặc `AI_ROUTING_DISABLED=true` | Triệu chứng do R2/R3 |
| **L2 — revert code** | Revert commit wave đang deploy; migration đã áp **giữ nguyên** (thêm cột không phá) | Triệu chứng do R0/R1 |
| **L3 — rollback migration** | Chỉ M1, và chỉ khi đã giữ key cũ (7.3 bước 3) | M1 gây lỗi đọc |
| **L4 — restore DB** | Dùng snapshot hạ tầng | Mất dữ liệu không tái tạo được |

**Cấm:** sửa file migration đã chạy (vi phạm BR-07). Muốn sửa migration thì tạo file repair mới.

### 7.5 Canary

| Wave | Canary | Tiêu chí |
|---|---|---|
| R0 | 1 tenant nội bộ (plan `INTERNAL`) 24 h | 0 cross-tenant incident; 0 mất cấu hình (so `prompt_config` trước/sau cho 5 user); p95 latency không tăng > 10% |
| R1 | 10% user, 7 ngày | `check:ai-cc` xanh; không có issue visual/a11y mới; bundle size +< 3 KB |
| R2 | 1 tenant có ≥ 2 deployment, 14 ngày | failover test tự động xanh; cost report khớp với hoá đơn provider (spot-check 5 ngày) |
| R3 | 10% user, 14 ngày | trace 4 bước cho ≥ 95% advisory; PII redaction không che nhầm > 1% |
| R4 | tenant `INTERNAL` → 1 tenant trả phí | ma trận isolation 2 tenant xanh ở **mọi** AI CC endpoint |
| R5 | toàn bộ | không có ticket liên quan AI CC trong 7 ngày |

**Tiêu chí rollback tự động:** canary fail bất kỳ tiêu chí nào ⇒ revert, **không** sửa tiếp trên production.

---

## §8. REGISTER RỦI RO

| ID | Rủi ro | Khả năng | Tác động | Giảm thiểu | Slice |
|---|---|---|---|---|---|
| RSK-01 | Đổi `ai_model` theo user làm advisory lỗi rộng rãi | Trung bình | Cao | Feature flag `AI_ALLOW_USER_MODEL_OVERRIDE`; canary 24 h; AC4 lộ lỗi ở tầng record | R0.1 |
| RSK-02 | Migration M1 sửa mất cấu hình đang dùng | Trung bình | Cao | Backup + `--dry-run` + **giữ key cũ 1 release** + AC3 bằng chứng | R0.2 |
| RSK-03 | SSRF guard chặn nhầm endpoint hợp lệ | Trung bình | Trung bình | Cờ `AI_ALLOW_PRIVATE_ENDPOINT`; AC4 cho case hợp lệ; allowlist theo từng provider | R0.6 |
| RSK-04 | Bỏ `openclaw` làm người dùng mất cấu hình đang chạy | Cao | Trung bình | Kiểm tra dữ liệu thật trước khi gỡ (grep + query `UserAICredential.objects.filter(ai_provider='openclaw').count()`); nếu > 0 thì chuyển `openclaw` → `local` thay vì xoá, kèm hướng dẫn | R0.5 |
| RSK-05 | Audit isolation phá admin đang dùng để debug | Trung bình | Trung bình | Cung cấp `?scope=tenant` cho staff; ghi rõ `legacy_unattributed_count`; có tài liệu migration cho support | R0.7 |
| RSK-06 | Sửa hook dùng chung phá consumer khác | Trung bình | Trung bình | AC5 bắt buộc chạy test từng consumer; tách hook mới nếu cần | R1.7 |
| RSK-07 | Gate mới (`check:ai-cc`) false-positive chặn nhầm PR khác | Trung bình | Thấp | Danh sách file khai báo tường minh; có cờ `--warn` khi nghi ngờ; mở rộng phạm vi = ticket riêng | R0.8 |
| RSK-08 | Gộp 3 finding P0 trong 1 slice làm PR quá lớn, review miss bug | Trung bình | Trung bình | Tách 3 commit trong PR nhưng **không** tách deploy; checklist review theo 3 nhóm finding | R0.7 |
| RSK-09 | `gemini-3.8-flash` không tồn tại ⇒ phải sửa migration `0008` đã chạy (vi phạm BR-07) | Trung bình | Trung bình | **STOP condition §3.4-3**; nếu cần sửa `ModelChoices` thì dùng `choices` cập nhật được + `ALTER` không cần migration (Django không enforce choices ở DB) | R2.7 |
| RSK-10 | Auto-evict chạy nhầm lúc provider deploy ⇒ mất dịch vụ | Trung bình | Cao | 3 lần liên tiếp + cooldown + `AI_ROUTING_DISABLED`; AC2/AC3/AC7 | R2.3 |
| RSK-11 | Retry × 3 sub-agent = 9 request với 1 key ⇒ rate limit | Trung bình | Trung bình | Retry ở tầng client, AC7 chặn | R2.6 |
| RSK-12 | PII redaction che nhầm số (giá cổ phiếu) ⇒ hỏng advisory | Cao | Cao | **AC2 bắt buộc**: 20 fixture số hợp lệ không bị che; chỉ che số có ngữ cảnh; AC4 đo tỉ lệ ≤ 1% | R3.6 |
| RSK-13 | `allow_byok=false` chặn khách hàng trả phí | Thấp | Trung bình | AC7 bảo đảm vẫn dùng khoá hệ thống trong hạn mức | R4.1 |
| RSK-14 | Xoá tab Agents mất tài sản đã xây | Thấp | Thấp | Khôi phục được từ git history + migration cũ; ghi rõ trong PR | R5.1 |
| RSK-15 | Bảng giá model sai ⇒ báo cáo chi phí sai | Cao | Trung bình | `pricing_source` hiển thị; `pricing_available=false` khi chưa có; spot-check với hoá đơn provider ở canary R2 | R2.4 |
| RSK-16 | Ước lượng 80-87 ed thực tế thành 150+ ed | Trung bình | Trung bình | Mốc M0-M5 theo wave; cắt R2.1+R2.3 nếu cần; STOP condition §3.4-2 | toàn plan |

---

## §9. RACI + DEFINITION OF DONE

### 9.1 RACI

| Hoạt động | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Quyết định D-01 (phân quyền) | Tech Lead | CTO / Product Owner | Security, Support | Toàn team |
| R0 (an toàn + contract) | BE Lead | CTO | Security, QA | FE, Product |
| R1 (design + i18n + gate) | FE Lead | Design Lead | FE, QA | BE |
| R2 (failover + budget) | BE Lead | CTO | Finance (giá model), SRE | FE, Product |
| R3 (observability + eval) | BE Lead + FE Lead | CTO | Legal/Privacy (PIPL), Data | Product |
| R4 (governance) | BE Lead | CTO | Support, Sales (tenant policy) | FE |
| R5 (dọn nợ) | AiOwner | Tech Lead | FE, BE | QA |
| Canary + quyết định rollback | SRE On-call | CTO | BE, FE | Product |
| Đánh giá chất lượng prompt | Data/AI Owner | Product Owner | Support | toàn team |

### 9.2 Definition of Done (mỗi slice)

Một slice chỉ DONE khi **tất cả** đúng:

- [ ] Tất cả AC trong §2 của slice có test tự động hoặc minh chứng ảnh/script nêu rõ (T-01)
- [ ] Output **RED** trước khi sửa đã dán vào `gates.md` (với P0/P1) (T-02)
- [ ] Tất cả gate §5.1 chạy và xanh, output dán **nguyên văn**
- [ ] `git diff --check` = 0 whitespace error
- [ ] `python manage.py makemigrations --check --dry-run` sạch (nếu có model change)
- [ ] Không vi phạm BR-01..BR-10
- [ ] Comment giải thích **tại sao** cho mọi quyết định phi thường
- [ ] i18n đủ cả `vi.js` và `en.js`; 0 key chết; 0 `|| "fallback"`
- [ ] 0 hex mới trong TSX; mọi màu qua token
- [ ] Ảnh light + dark + EN + VI (nếu có thay đổi UI)
- [ ] Test isolation 2-user-2-tenant xanh (nếu có thay đổi scope)
- [ ] Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (1 entry) + `AGENTS.md`
- [ ] **Đối chiếu ngược đã viết**: 1 dòng "claim này có thể sai vì…" hoặc "đã kiểm chứng vì…"
- [ ] PR description có `file:line` cho mọi khẳng định

### 9.3 Định nghĩa "trung thực" bắt buộc trong báo cáo

Cấm tuyên bố PASS khi:

| Tình huống | Cách báo cáo ĐÚNG |
|---|---|
| Test BE không chạy được vì thiếu DB | `BE: NOT VERIFIED — no DB (env blocker)` + mô tả lỗi thật |
| Test mới chưa viết | `AC-n: MANUAL — chưa tự động hoá` + lý do + ticket hẹn ngày |
| Gate mới chưa tồn tại | `Gate check:ai-cc: CHƯA TẠO (R0.8 chưa xong)` |
| Đo bằng mắt | `Visual QA: 1 reviewer, chưa có chữ ký thứ 2` |
| Chỉ đọc code, không chạy | `Static analysis only — không chạy code` |
| Ước lượng | `ƯỚC LƯỢNG: 2.0 ed (chưa có lịch sử tương tự trong repo)` |

Đây là yêu cầu từ AGENTS.md Nguyên tắc 2 ("CHƯA XÁC MINH") và bài học Entry 194/196/198 (claim số liệu không khớp thực tế).

---

## §10. CHECKLIST BÀN GIAO

### 10.1 Trước khi bắt đầu (ngày 0)

- [ ] CTO / Product Owner **xác nhận D-01** (self-service vs staff-only). Plan đã giả định self-service cho BYOK. Nếu đổi, sửa §1 D-01 + R0.9 + R4.1.
- [ ] Owner dịch vụ nội bộ cung cấp **5 thông tin D-03c** cho `openclaw` (base URL · protocol · auth · nguồn danh mục model · SLA/hạn mức). **Thiếu thì R2.5 BLOCKED** — nhưng R0.5 vẫn chạy vì phần chặn P0 không phụ thuộc spec.
- [ ] Xác nhận **nhánh Copilot**: `AI_COPILOT_TRANSPORT=token_exchange` (mặc định) hay `github_models` (dự phòng). Và xác nhận `COPILOT_INTEGRATION_ID=vscode-chat`.
- [ ] Truy vấn `SELECT count(*) FROM advisory_useraicredential WHERE ai_provider='openclaw';` — **bắt buộc**, vì `openclaw` là **default provider ở 6 nơi** (`portfolio_analytics_views.py:469,472`; `AICommandCenterForm.tsx:129,171,174`; `AICommandCenterPage.tsx:66`; i18n `defaultAiProvider`). Nếu > 0 thì cần kế hoạch chuyển dữ liệu, không xoá.
- [ ] Bảo đảm môi trường test có Postgres. **Nếu không, đây là blocker #1 — dừng R0 cho tới khi có.**
- [ ] Tạo nhánh `feat/ai-cc-r0` … `feat/ai-cc-r5`.
- [ ] Tạo `docs/evidence/ai-cc/<SLICE-ID>/.gitkeep`.
- [ ] Đọc `AGENTS.md` §AI Audit Framework + `docs/AUDIT_AI_COMMAND_CENTER_20260925.md` §D (38 findings) + plan này §0-§1.
- [ ] Xác nhận quy ước lệnh test (D-06) chạy được ít nhất 1 lần **thành công** trước khi viết code.

### 10.2 Cuối mỗi wave

- [ ] Tất cả gate §5.1 xanh, output lưu vào evidence
- [ ] Mốc nghiệm thu tương ứng (§3.3) đạt
- [ ] `npm run build` PASS, đo **delta bundle size** (kỳ vọng R1: +< 3 KB)
- [ ] Ledger +1 entry, `AGENTS.md` cập nhật Progress
- [ ] Canary theo §7.5 cho wave đó, dán kết quả thật (kể cả khi **không** chạy được → ghi rõ)
- [ ] Danh sách **cái đã làm nhưng chưa xong** (nếu có) chuyển backlog, không giấu

### 10.3 Backlog sinh ra từ kế hoạch này (không làm trong scope)

| ID | Nội dung | Lý do tách |
|---|---|---|
| BL-AICC-01 | Gộp design token **toàn repo** (Entry 213, 40+ file) | R1.8 chỉ gộp trong AI CC |
| BL-AICC-02 | Trang Traces ở mức enterprise: sampling, search full-text, compare 2 trace | R3.2 làm bản cơ bản |
| BL-AICC-03 | Webhook dispatcher cho alert AI (như LiteLLM) | R3.5 chỉ dùng kênh sẵn có |
| BL-AICC-04 | Eval dataset + chấm chất lượng prompt bằng người | R3.4 chỉ gom feedback; AC5 của R5.3 chỉ khẳng định "khác nhau" |
| BL-AICC-05 | Azure OpenAI / Bedrock / Vertex adapters | R2.2 chỉ 4 provider |
| BL-AICC-06 | Materialized aggregate khi `AIUsageRecord` > 10M row | R3.3 dùng window function |
| BL-AICC-07 | Sửa `AdvisorySession` migration state gốc (Entry Entry-215 ghi `KeyError` khi AddConstraint) | Cần squash lịch sử migration |
| BL-AICC-08 | `check-tokens.mjs` mở rộng quét TSX toàn repo | R0.8 chỉ 9 file AI CC |
| BL-AICC-09 | `ops_audit` service label cho các path sai khác (audit chỉ 1 cái trong scope) | cần audit riêng `ops_audit` |

### 10.4 Bàn giao cho wave sau

Mỗi wave kết thúc phải cập nhật:
1. Bảng "trạng thái thực tế" (số AC đạt / tổng, số gate xanh) — **không** chỉ "xong".
2. Danh sách **AC không đạt** + lý do + kế hoạch xử lý.
3. **Phát hiện mới** phát sinh trong khi làm (kèm mức P0-P3) — đưa vào backlog, không sửa lén.
4. Ước lượng còn lại có còn đúng không (nếu sai, nói thật và điều chỉnh — đừng giữ con số cũ cho khớp).

---

## PHỤ LỤC A · BIẾN MÔI TRƯỜNG MỚI

| Env var | Mặc định | Validate | Dùng ở slice | Ý nghĩa |
|---|---|---|---|---|
| `AI_ALLOW_USER_MODEL_OVERRIDE` | `true` | `env_validation` | R0.1 | Tắt để user model không ghi đè system |
| `AI_READINESS_TTL_SECONDS` | `900` | `get_optional_env` + int check | R0.4 | TTL của probe |
| `AI_ALLOW_PRIVATE_ENDPOINT` | `false` | bool check + **cảnh báo log khi bật** | R0.6 | Cho phép endpoint private cho `local` |
| `AI_ENABLE_ANTHROPIC` | `false` | bool | R2.3 | Bật provider `claude` |
| `AI_ROUTING_DISABLED` | `false` | bool | R2.6 | Tắt routing về 1 deployment |
| `AI_ADVISORY_DEADLINE_SECONDS` | `120` | int check | R2.9 | Trần tổng thời gian |
| `AI_COST_PRICING_SOURCE` | `manual` | enum | R2.7 | Nguồn bảng giá |
| `AI_AUDIT_RETENTION_DAYS` | `365` | int | R4.3 | Retention audit log |
| `AI_PRICING_FILE` | *(trống)* | path tồn tại nếu set | R2.7 | File giá import |
| `COPILOT_EXCHANGE_URL` | `https://api.github.com/copilot_internal/v2/token` | URL hợp lệ | R2.4 | Cho phép trỏ endpoint khác (Enterprise/proxy) |
| `COPILOT_API_BASE_URL` | *(rỗng ⇒ lấy từ `endpoints.api` trong token response)* | URL hợp lệ nếu set | R2.4 | Override base URL cho Enterprise |
| `COPILOT_INTEGRATION_ID` | `vscode-chat` | non-empty | R2.4 | Header bắt buộc, thiếu ⇒ 401 |
| `COPILOT_TOKEN_REFRESH_MARGIN_SECONDS` | `60` | int > 0 | R2.4 | Refresh sớm trước khi hết hạn |
| `AI_COPILOT_TRANSPORT` | `token_exchange` | enum `token_exchange` \| `github_models` | R2.4 | Nhánh A (mặc định) / nhánh B dự phòng |
| `COPILOT_MODELS_API_BASE_URL` | `https://models.inference.ai.azure.com` | URL hợp lệ | R2.4 | Chỉ dùng khi `AI_COPILOT_TRANSPORT=github_models` |
| `OPENCLAW_BASE_URL` | *(chưa có — **BLOCKED D-03c**)* | URL hợp lệ nếu set | R2.5 | Endpoint dịch vụ nội bộ |
| `OPENCLAW_API_KEY` | *(chưa có — **BLOCKED D-03c**)* | non-empty nếu set | R2.5 | Chỉ cần nếu D-03c#3 trả lời "có xác thực" |

**Quy tắc chung (BR-09 + `env_validation.py`):** giá trị sai → `ImproperlyConfigured` (fail-closed), **không** fallback im lặng. Danh sách env phải thêm vào `docker-compose.dev.yml`, `docker-compose.prod.yml`, `.env.example`, và `DOCKER_STARTUP_GUIDE.md`.

**Riêng cho dịch vụ nội bộ (`openclaw`):** `OPENCLAW_BASE_URL` / `OPENCLAW_API_KEY` là **secret hạ tầng**, không đưa vào lớp A (BYOK của user). Nếu D-03c#3 xác nhận dùng chung ⇒ key nằm ở `SystemAISettings.metadata` + `env_validation`, provider thuộc **lớp B** (D-01), user thường **không** thấy trong dropdown. Đây là mô hình an toàn hơn và là mặc định đề xuất.

## PHỤ LỤC B · HỢP ĐỒNG API (contract sau R0, dùng để review)

| Method | Path | Ai được | Mã lỗi riêng |
|---|---|---|---|
| GET | `/core/v1/workspace/ai-command-center/` | mọi user (lớp A) | — |
| PUT | `/core/v1/workspace/ai-command-center/` | mọi user | `400 prompt_config_invalid_shape`, `400 provider_model_mismatch`, `400 invalid_provider`, `409 ai_config_conflict` |
| POST | `/core/v1/workspace/ai-command-center/test-connection/` | mọi user | `400 invalid_outbound_endpoint`, `429` throttle `ai_test_connection` |
| POST | `/core/v1/workspace/ai-command-center/prompt-config/rollback/` | mọi user | `400 version_not_found` |
| GET | `/core/v1/workspace/ai-command-center/audit-logs/` | user thấy log **của họ**; staff thấy log **tenant mình** | — |
| GET/PUT | `/core/v1/workspace/ai-command-center/policy/` | **staff** | `403` |
| GET | `/core/v1/workspace/ai-command-center/providers/<p>/models/` | mọi user | `200` với `catalog_source:"unavailable"` khi rỗng |
| GET | `/core/v1/workspace/ai-command-center/traces/` | user thấy trace **của họ** | — |
| ~~POST~~ | `/core/v1/ai/usage/` | **xoá (R0.7)** | `405` |

**Hợp đồng lỗi (RFC 9457):** mọi lỗi trả `{ type, title, status, detail, error_code, extra }`. `error_code` là **mã ổn định** để FE i18n; `detail` là thông báo tiếng Việt cho người dùng cuối; **không** bao giờ chứa endpoint nội bộ, stack trace, hay tên bảng.

## PHỤ LỤC C · SO SÁNH VỚI THƯƠNG MẠI (tiêu chí nghiệm thu R2/R3)

| Năng lực | LiteLLM | Portkey | OpenRouter | **Copilot** (GitHub) | Mục tiêu VNInvest | Slice đạt |
|---|---|---|---|---|---|---|
| Multi-deployment / virtual model | ✅ | ✅ | ✅ | ❌ | ✅ | R2.1 |
| Fallback chain khi provider fail | ✅ | ✅ | ⚠ | ❌ | ✅ | R2.2 + R2.9 |
| Health check + auto-evict | ✅ | ✅ | — | ❌ | ✅ | R2.6 |
| Routing strategy + **decision log** | ✅ | ✅ | ✅ | ❌ | ✅ | R2.6 |
| Budget theo **cost** + soft/hard | ✅ | ✅ | ✅ | ❌ (hạn mức sub) | ✅ cost + request | R2.8 |
| Budget phân tầng | ✅ | ✅ | ✅ | ❌ | ✅ 4 tầng | R2.8 + R4.1 |
| Retry + cooldown theo deployment | ✅ | ✅ | — | ❌ | ✅ | R2.9 |
| **Đa nhà cung cấp trong 1 khoá** | ✅ | ✅ | ✅ | **✅** (OpenAI+Anthropic+Google+xAI+Moonshot+Microsoft) | ⚠ hiện 1 hãng/khoá | R2.2-R2.4 |
| Token exchange / session token | ❌ | ⚠ | ❌ | **✅ bắt buộc** (2 bước, ~25 phút) | — | R2.4 |
| Enterprise base URL discovery | ✅ | ✅ | ✅ | ✅ (`endpoints.api`) | — | R2.4-AC6 |
| Observability token/latency theo model | ✅ | ✅ | ✅ | ⚠ | ✅ | R0.7 + R2.7 |
| Danh mục model **theo tài khoản** | ✅ | ✅ | ✅ | **✅ bắt buộc** (gating theo plan) | ✅ | R2.10 |
| **Trace + eval + feedback** | ✅ | ✅ | — | — | ✅ mức cơ bản | R3.1-3.4 |
| Test connection kiểm chứng thật | ✅ | ✅ | — | ✅ | ✅ | có sẵn + R2.10 |
| Key rotation + scope | ✅ | ✅ | — | ❌ (PAT/OAuth) | ✅ | R4.2 |
| Audit append-only theo tenant | ✅ | ✅ | ✅ | — | ✅ | R0.7 + R4.3 |
| SSRF guard trên endpoint người nhập | ✅ | ✅ | — | — | ✅ | R0.6 |
| Phân quyền theo vai trò/plan | ✅ | ✅ | ✅ | ✅ (gói Copilot) | ✅ 2 lớp | R0.9 + R4.1 |
| Diff preview + optimistic lock | ✅ | — | — | — | ✅ | R1.9 |
| Export CSV | ✅ | ✅ | ✅ | — | ✅ | R1.2 |
| Alert ngưỡng | ✅ 85/95% | ⚠ | ⚠ email | — | ✅ 80/100% | R3.5 |
| A/B / canary / shadow routing | ✅ | — | — | — | ❌ backlog | BL-AICC-02 |
| Data residency | ✅ | ⚠ | ✅ | ⚠ theo hãng | ❌ backlog | — |

**Điểm khác biệt cần nói rõ về Copilot:** Copilot là **cầu nối tới LLM đa nhà cung cấp bằng 1 khoá GitHub** — đây là lợi thế thật cho sản phẩm VN nơi người dùng cá nhân đã có Copilot sub nhưng không muốn mua 4 API key riêng. Nhưng nó **không thay thế** OpenAI/Gemini trực tiếp cho các trường hợp cần: giá theo token, SLA, region pinning, hay không muốn phụ thuộc GitHub. ⇒ **Vị trí đúng của Copilot là provider *bổ sung*, không phải provider *thay thế*** — giữ cả hai trong UI.

**Điểm mạnh VNInvest giữ nguyên (không được đánh đổi):** BYOK per-user + Fernet + mask `last4` + nút xoá key; 4 preset prompt có tên dễ hiểu; version history + rollback; probe kết nối thật; fallback quota theo ngày với thông báo hết hạn mức rõ ràng.

---

## PHỤ LỤC D · ÁNH XẠ TỪ FINDING → SLICE (để nghiệm thu ngược)

| Finding audit | Mức | Slice | AC chứng minh |
|---|---|---|---|
| F-01 `ai_model` không dùng | P0 | R0.1 | AC1-AC4 |
| F-02 prompt config mất âm thầm | P0 | R0.2, R0.3 | R0.2-AC1/AC2, R0.3-AC1 |
| F-03 4 nguồn default | P0 | R0.2, R0.3 | R0.2-AC1, R0.3-AC4 |
| F-04 audit cross-tenant | P0 | R0.7, R0.9 | R0.7-AC1-AC4, R0.9-AC3 |
| F-05 SSRF | P0 | R0.6 | AC1-AC8 |
| F-06 `ai_ready` giả / provider sai | P0 | R0.4, R0.5, **R2.2, R2.3, R2.4, R2.5** | R0.4-AC1/AC2, R0.5-AC1/AC4; adapter test từng provider (R2.2-AC4, R2.3-AC1, R2.4-AC5, R2.5-AC1) |
| F-07 Usage rỗng + POST bịa số | P0 | R0.7 | R0.7-AC5/AC6 |
| F-08 mất `--ai-*` token | P1 | R1.1 | AC1-AC5 |
| F-09 key i18n thiếu + 18 chết | P1 | R1.3, R0.8 | R1.3-AC1/AC2, R0.8-AC3/AC4 |
| F-10 chuỗi VI hardcode | P1 | R1.3 | AC3-AC5 |
| F-11 filter lệch một nửa | P1 | R1.5 | AC1/AC2/AC6 |
| F-12 filter bị nuốt im lặng | P1 | R1.7 | AC1/AC2 |
| F-13 audit panel token/a11y | P1 | R1.2 | AC1-AC8 |
| F-14 3 hệ thống token | P1 | R1.8 | AC1/AC5 |
| F-15 chart hardcode màu | P1 | R1.6 | AC1-AC5 |
| F-16 không skeleton / mất thay đổi | P1 | R1.4 | AC1-AC5 |
| F-17 không validate PUT | P1 | R0.5, R1.9 | R0.5-AC4/AC5 |
| F-18 không optimistic lock | P1 | R1.9 | AC1-AC3 |
| F-19 agent registry chết | P1 | R5.1 | AC1-AC6 (phương án B) |
| F-20 không enforce ability | P1 | R0.9 | AC3-AC6 |
| F-21 2 sub-route mất hub nav | P1 | R1.8 | AC2-AC4 |
| F-22 test tautology | P1 | R1.8 (T-06) | integration test thật |
| F-23 quota nhãn ngược | P2 | R1.10 | AC2/AC3 |
| F-24 `_log_test` sai status | P2 | *(nhỏ — gộp vào R0.5 vì cùng file)* | — |
| F-25 `ai_config_message` không bền | P2 | R0.9, R5.5 | R0.9-AC7, R5.5-AC1 |
| F-26 USD/làm tròn không nhất quán | P2 | R1.6 | AC5/AC6 |
| F-27 export không chặn trên | P2 | R1.2 | AC4 |
| F-28 filter model chỉ trang hiện tại | P2 | R1.5 | AC6 (danh sách từ catalog ở R2.7) |
| F-29 trang shell chết | P2 | R0.8 | AC1/AC2 |
| F-30 panel agent nhãn sai | P2 | R1.11 | AC1/AC2 |
| F-31 preset mất `version` | P2 | R0.3 | AC5 |
| F-32 thiếu a11y drawer/table | P2 | R1.2, R3.2 | AC2, R3.2-AC1/AC7 |
| F-33 model hardcode | P3 | R2.10, R0.5 | R2.10-AC1/AC2/AC8/AC9 — **với Copilot thì hardcode là sai tuyệt đối** vì danh mục gating theo gói tài khoản |
| F-34 không retry/breaker | P3 | R2.9 | R2.9-AC1-AC8 (AC8 riêng cho token-based provider) |
| F-35 không trace/eval/feedback | P3 | R3.1, R3.4 | AC1-AC6 |
| F-36 system prompt chỉ đọc + tối | P3 | R1.6, R5.3 | R1.6-AC1/AC2, R5.3-AC1 |
| F-37 không quản lý `SystemAISettings` | P3 | R0.9, R5.3 | R0.9-AC1/AC2 |
| F-38 `/settings` không liên kết | P3 | R4.4 | AC1-AC3 |

**Nghiệm thu ngược:** script `list-slice-ids.mjs` (T-05) đối chiếu bảng này với AC-ID có trong docstring test. Mỗi finding phải có **ít nhất 1 AC** trong test tương ứng. Đó là cách chứng minh "không bỏ sót finding" một cách máy đo, không phải bằng lời.

---

**Kết luận.** Kế hoạch này đóng được 38 finding của audit trong 46 slice, đưa AI Command Center từ **3.1/10** lên ngưỡng AI-gateway thương mại, với **6/6 provider có client thật** (thêm `copilot` và `openclaw` bên cạnh `claude`). Điều kiện tiên quyết tuyệt đối: **M0 (R0) phải xanh trước khi làm bất kỳ thứ gì khác** — vì trước M0, mọi thứ trên màn hình đều có thể không phản ánh cấu hình thật, và hệ thống đang có rò rỉ dữ liệu chéo tenant.

**Ba điều chỉnh so với Rev.1, đều do phản biện chứ không phải do tôi tự nhận ra:**

| # | Rev.1 | Rev.2 | Người phản biện |
|---|---|---|---|
| 1 | Gỡ `openclaw` + `copilot` khỏi UI | **Cả hai làm provider thật** (R2.4, R2.5) | Owner: "openclaw là dịch vụ nội bộ thật", "copilot tôi vẫn đang dùng" |
| 2 | Nói `gemini-3.8-flash` "có thể không tồn tại" | **"Chưa ai probe"** — không phải sai, cũng không phải đúng | Owner: "gemini-3.8-flash là của Gemini chứ sao của Copilot" |
| 3 | Chỉ 3 adapter (openai/gemini/local) | **6/6 provider có client**, `openclaw` BLOCKED chờ spec | Owner xác nhận openclaw là dịch vụ thật nhưng repo **không có** trace nào |

Cả 3 đều cho thấy điều tôi cần làm tốt hơn: **kiểm tra bằng chứng ngược trước khi kết luận "không hỗ trợ"**, và **ghi "chưa xác minh" thay vì suy đoán**.






