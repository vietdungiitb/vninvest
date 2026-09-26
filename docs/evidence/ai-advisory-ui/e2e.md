# E2E — bằng chứng chạy thật trên container

Lệnh dùng để tái lập: `docker exec -w /app/src vninvest-dev-core-api python /tmp/<script>.py`
(script nằm ở `%TEMP%\opencode\`, nội dung tóm tắt ở từng mục).

---

## 1. Root cause gốc — trước khi sửa

Probe DB (`/tmp/db_probe.py`, `/tmp/db_probe2.py`):

```
AdvisoryRecord total: 1
by status: [{'status': 'failed', 'n': 1}]
structured_output key frequency: {}
NO record with non-empty structured_output

error_message: synthesis provider_status=404
effective_ai_context: ai_provider = gemini, ai_model = gpt-4o-mini
```

Ba nguyên nhân chồng nhau:
1. `ai_provider=gemini` + `ai_model=gpt-4o-mini` → `orchestrator.py` trỏ endpoint
   OpenAI-compat của Google, gửi tên model OpenAI → **404**.
2. `signal` / `confidence_score` không bao giờ được ghi (xem `tasks.py:_build_structured_output`
   và `orchestrator.py` return dict) → `serializers.py` trả `None` vĩnh viễn.
3. `views.py` regex `[^A-Z ]` xoá dấu tiếng Việt.

## 2. Bằng chứng parser sai (14 case, chạy đúng regex production)

| input | regex cũ | `signal_norm` mới |
|---|---|---|
| `BÁN` | `None` | `SELL` |
| `BÁN LỤC` | `None` | `SELL` |
| `GIỮ` | `None` | `HOLD` |
| `BÁN (giảm tỷ trọng)` | `None` | `SELL` |
| `KHÔNG MUA` | **`BUY`** | `UNKNOWN` |
| 9 case còn lại | đúng | giữ nguyên |

## 3. W0 verify trong container sau khi deploy (`/tmp/verify_w0.py`)

```
SCHEMA_VERSION = 2
BÁN -> SELL | BÁN LỤC -> SELL | GIỮ -> HOLD | THEO DÕI -> HOLD | KHÔNG MUA -> UNKNOWN
gemini+gpt-4o-mini valid = False        (case từng hỏng production)
gemini+gemini-2.5-flash valid = True
29 serializer fields; signal/side/confidence_score/risk_level/target_price/
  feature_attribution/input_snapshot/schema_version/matched_value/is_discovery/
  whale_intensity/error_code/user_message/components/ai_provider đều OK
sanitize list: api_key -> 'sk-proj-••••••••EEEE'   (R0.7)
unique index = ('uniq_advisory_session_user_symbol_date',)   (R0.8)
401 -> provider_auth_failed / 404 -> provider_model_not_found
429 -> provider_rate_limited / 500 -> provider_unavailable   (R0.10)
```

## 4. Nguyên nhân sâu thứ hai — provider 503 + response bị cắt cụt

Probe trực tiếp endpoint Google OpenAI-compat (`/tmp/key_probe.py`, `/tmp/json_probe.py`):

```
gemini-2.5-flash  200   (key hợp lệ)
gemini-3.8-flash  503   "This model is currently experiencing high demand"
gemini-2.0-flash  404   "no longer available"
gemini-1.5-flash  404   "is not found for API version v1main"
```

Hai phát hiện dẫn tới sửa trong W0:

1. **3 sub-agent gọi song song** → cả 3 trả 503. Một request nhỏ **tuần tự** trả 200.
   → thêm retry có backoff, chỉ retry lỗi tạm thời (`408/429/5xx`), **không** retry `4xx`
   cấu hình. Hằng số `PROVIDER_RETRY_ATTEMPTS` / `PROVIDER_RETRY_BASE_SECONDS`.
2. **`max_tokens` quá nhỏ làm JSON hỏng**:

```
max_tokens=800   status=200  finish_reason=length  content_len=44   JSON PARSE: FAIL
max_tokens=1000  status=200  finish_reason=length  content_len=62   JSON PARSE: FAIL
max_tokens=2000  status=200  finish_reason=stop    content_len=1039 JSON PARSE: OK
```

Trước đây code dùng thẳng `max_tokens` của người dùng (mặc định `1000`) nên advisory **luôn**
fail, và lỗi bị gán nhầm thành HTTP 500 → thông điệp "Dịch vụ AI gặp sự cố tạm thời" gây
hiểu nhầm. Sửa:
- `SYNTHESIS_MAX_TOKENS_FLOOR = 2000` cho lời gọi synthesis.
- Tách mã lỗi `provider_response_truncated` (khi `finish_reason == 'length'`) và
  `provider_invalid_response` (JSON sai định dạng), tách khỏi lỗi HTTP.

> Ghi chú: `SystemAISettings.ModelChoices` còn liệt kê `gemini-1.5-flash` (đã 404) và
> `gemini-pro`. Danh sách model cần cập nhật theo provider — ghi backlog, nằm ngoài
> phạm vi W0 vì là thay đổi dữ liệu chứ không phải UI.

## 5. Error path end-to-end (sau khi thêm `error_code` vào DB)

```
status      : failed
error       : Dịch vụ AI gặp sự cố tạm thời. Thử lại sau.
structured  : {"error": {"error_code": "provider_unavailable",
                         "user_message": "Dịch vụ AI gặp sự cố tạm thời. Thử lại sau.",
                         "provider_status": 500}}
```

Không còn chuỗi raw của provider trong thông điệp hiển thị. Đây là dữ liệu mà
`AIAdvisoryWarningBanner` / error banner của FE dùng để hiển thị (DoD A6).

## 6. Happy path end-to-end — SAU KHI SỬA (bằng chứng quan trọng nhất)

`/tmp/e2e_gen.py` gọi thật `generate_advisory_task` với credential của user `admin`
(`gemini` + `gemini-2.5-flash`):

```
status      : generated
error       :
signal             = HOLD
side               = HOLD
confidence_score   = 0.6          <-- TRƯỚC ĐÂY LUÔN LUÔN None
risk_level         = medium
target_price       = None
summary            = VIC đang trong giai đoạn tích lũy với các tín hiệu kỹ thuật và dòng tiền trung lập...
rationale          = Phân tích kỹ thuật cho thấy VIC đang giao dịch trong biên độ hẹp...
components         = 5 item(s)   <-- AdvisoryComponent đã được wire vào API (R0.9)
session rows       = 1
```

`structured_output` thực tế:

```json
{"signal": "HOLD", "summary": "...", "rationale": "...", ...}
```

Đối chiếu "trước": `structured_output` rỗng `{}`, `signal=None`, `confidence=None`,
`side=UNKNOWN` ⇒ order ticket bị chặn vĩnh viễn, backtest 0 mẫu, UI hiện `ĐỘ TIN CÂY —`.

---

## 7. N2 — `gemini-3.8-flash` KHÔNG hỏng. Hạn mức API key đã hết.

Báo cáo của người dùng: "AI không hoạt động, 3.8-flash không chạy". Điều tra bằng
probe (`/tmp/n2_isolate.py`, `/tmp/n2_quota.py`, `/tmp/n2_probe.py`).

### 7.1 Chạy full pipeline với 3.8-flash — fail, nhưng retry hoạt động đúng

```
[WARNING] Synthesis gap loi tam thoi (status=429); thu lai lan 2/3 sau 2.0s
[WARNING] Synthesis gap loi tam thoi (status=429); thu lai lan 3/3 sau 4.0s
[ERROR]   Advisory generation failed: provider_rate_limited provider_status=429
```

Ba sub-agent gọi song song **thành công**; chỉ bước synthesis 429. Tức 3.8-flash
**có** phản hồi. Điều này loại trừ giả thuyết "model chết".

### 7.2 Tách biến: model hay hạn mức?

| model | sub-agent (prompt nhỏ, 1024 tok) | synthesis (prompt dài, 2000 tok) |
|---|---|---|
| `gemini-3.8-flash` | 429 | **200**, len=813 |
| `gemini-2.5-flash` | 429 | **200**, len=1514 |
| `gemini-2.5-flash-lite` | **200**, len=2 | **200**, len=1012 |

Cả 3 model đều 429 ở request nhỏ nhưng 200 ở request lớn — **vô lý** nếu là
giới hạn tốc độ theo request. Đó là dấu hiệu hạn mức tài khoản bị đo theo token,
và có thể đã cạn.

### 7.3 Bằng chứng quyết định

Prompt **1 từ** ("Say OK"), `max_tokens=64`, 3 request **giống hệt nhau**, cách
nhau 3s, trên `gemini-3.8-flash`:

```
#1 status=429  retry_after=-
#2 status=429  retry_after=-
#3 status=429  retry_after=-
message: "You exceeded your current quota, please check your plan and billing details."
```

Không có header `Retry-After`. Kịch bản tải cao (`3 sub-agent + 1 synthesis`
= 4 request/advisory) đẩy tổng token vượt hạn mức.

**Kết luận: đây là vấn đề thanh toán/hạn mức của API key, KHÔNG phải lỗi model
hay lỗi code.** Chỉ cần nạp tiền hoặc đổi gói là dùng lại được — không cần sửa
`gemini-3.8-flash`.

### 7.4 Hai lỗi thật tìm được trong lúc điều tra (đã sửa)

**(a) Hai metric chết — không có nguồn ghi.**
`git grep matched_value|whale_intensity -- packages/core/backend/src/advisory`
cho thấy trong app `advisory` **chỉ có chỗ đọc, không có chỗ ghi**. Serializer đọc
`structured_output['matched_value']` và `['whale_intensity']` — hai key không
bao giờ được ai đặt vào. Hậu quả: 2/4 metric tiêu đề trên UI (`Cường độ dòng
tiền`, `Giá trị tham chiếu`) **luôn hiện `—`** mà không có lỗi nào để debug.
Trong khi dữ liệu thật thì có đủ, chỉ là nằm ở app khác (`signal_intelligence`,
`SessionFacts`).

Sửa: `AdvisoryOrchestrator.run()` tính deterministic từ `SymbolSnapshot` +
`SessionFacts`, cố ý **không** nhờ LLM (số liệu phải tái lập được, không được bịa):
- `matched_value` = `reference_price`
- `whale_intensity` = `institutional_strength` (đúng tiền lệ đã dùng ở
  `portfolio_analytics_views.py:1957`)
- kèm `input_snapshot` (đúng những số đã đưa cho LLM) + `feature_attribution`
  + cờ `is_stale`.
Thiếu dữ liệu → `None`, **không** phải `0` (vì `0` bị hiểu là "giá trị bằng 0").

**(b) Rò rỉ dữ liệu cũ — record fail vẫn trả component của phiên trước.**
`AdvisorySession` KHÔNG có FK tới `AdvisoryRecord`; nó định danh bằng
`(user, symbol, session_date)` (unique). Nên khi record MỚI fail (429), session
của lần chạy thành công trước vẫn được `_resolve_session` trả về. Probe thấy
`components = 5` với nội dung phân tích của phiên cũ, trong khi record hiện tại
`status=failed`. Với sản phẩm tài chính, hiển thị khuyến nghị mua/bán của phiên
cũ ngay sau khi người dùng bấm "làm mới" và bị báo lỗi là rủi ro nặng hơn lỗi
hiển thị.

Sửa: `get_components` chỉ đọc component materialize khi record **thực sự có
kết quả** (`signal != UNKNOWN`). `structured_output['components']` thuộc chính
record nên vẫn an toàn. Kiểm chứng trên container: `components 5 → 0`.

**(c) 429 gộp chung hai nguyên nhân.** Thêm mã lỗi
`provider_quota_exceeded` (không retry — chờ bao lâu cũng vậy) tách khỏi
`provider_rate_limited` (có retry). Thông điệp cũ "thử lại sau ít phút" khiến
người dùng retry vô hạn trong khi nguyên nhân thật là phải nạp tiền.

Kèm: tôn trọng header `Retry-After` khi provider gửi kèm (Gemini không gửi cho
ca hết hạn mức, nhưng provider khác có thể gửi), và sửa thứ tự raise trong
synthesis để `synth_code` không bị nhánh `synth_error is not None` nuốt mất.

### 7.5 Xác minh trên container sau khi sửa

```
error_code    = provider_quota_exceeded          (trước: provider_rate_limited)
user_message  = Đã hết hạn mức sử dụng của nhà cung cấp AI. Cần kiểm tra gói/thanh toán...
components    = 0                                  (trước: 5, là dữ liệu cũ)
```

## 8. CHƯA CHỤP ĐƯỢC: ảnh "data" của B4

Vì hạn mức Gemini hết (§7.3) nên **không có** bản ghi `AdvisoryRecord
status=generated` nào trong DB để hiển thị. Ảnh `advisory-{light,dark}-data.png`
vì thập thể cũng là empty state — và điều đó được nói thẳng trong docstring của
spec thay vì để tên file gợi ý sai. Khi hạn mức còn, đặt biến môi trường
`ADVISORY_DATA_SYMBOL` sang mã đã có tư vấn là spec tự chụp được ảnh có dữ liệu.
