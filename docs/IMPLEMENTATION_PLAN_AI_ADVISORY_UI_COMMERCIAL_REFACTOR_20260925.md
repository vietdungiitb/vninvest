# KẾ HOẠCH REFACTOR TOÀN DIỆN AI ADVISORY — TIÊU CHUẨN THƯƠNG MẠI

- **Ngày**: 2026-09-25
- **Phạm vi**: `http://localhost:8080/ai-advisory` (route `whale-advisory` → `pages/signals/WhaleAdvisoryPage.tsx`) + toàn bộ contract BE của `advisory` app
- **Tài liệu liên quan**: `docs/IMPLEMENTATION_PLAN_AI_ADVISORY_COMMERCIAL_20250925.md` (Entry 215, S01–S15), `docs/DESIGN_TOKEN_AUDIT_20260924.md` (Entry 213), `AGENTS.md`
- **Trạng thái**: đề xuất được DUYỆT để triển khai. Không còn câu hỏi mở — mọi quyết định đã chốt ở §9.4
- **Người thực hiện**: đội FE + BE. Có thể chia 2 người song song sau W0

---

## §0. TÓM TẮT ĐIỀU HÀNH

Audit phát hiện **1 lỗi dữ liệu P0 chặn toàn bộ tính năng** và **6 nhóm lỗi giao diện**. Giao diện "nhìn hoàn chỉnh" nhưng **không có dữ liệu nào để hiển thị** vì 3 nguyên nhân xếp chồng:

1. **Cấu hình provider/model mâu thuẫn** → `ai_provider=gemini` nhưng `ai_model=gpt-4o-mini` → HTTP **404**, task fail. DB dev chỉ có **1 record `status=failed`**, `structured_output` rỗng. → *bằng chứng: `docker exec` probe, `error_message="synthesis provider_status=404"`*
2. **Contract `signal`/`confidence_score` không bao giờ được ghi** → orchestrator (`orchestrator.py:302-311`) không trả 2 key này; `tasks.py:45-47` chỉ copy key **nếu có** → `structured_output` chỉ có `summary`. Serializer `get_signal` (`serializers.py:92-94`) trả `None` vĩnh viễn. → *hệ quả: `side=UNKNOWN` cho 100% tín hiệu, order ticket luôn bị chặn, backtest 0 mẫu, CSV xuất cột rỗng*
3. **Parser side loại ký tự Unicode** → `_BACKTEST_STRIP_RE = re.compile(r'[^A-Z ]')` (`views.py:696`) xoá dấu tiếng Việt: `BÁN`→`None` (mất toàn bộ tín hiệu BÁN), và `KHÔNG MUA` ("không nên mua")→**`BUY`** (ngược chiều). → *bằng chứng: chạy trực tiếp regex hiện tại, 5/14 case MISMATCH*

Phía giao diện: **bubble chart là bản sao kém** (tự gọi 2 API dư, kéo 774 KB chunk, render "0 bubble"), **sidebar hiển thị số liệu bịa** (3 cột luôn 0 vì BE là stub `{'stats': []}`), **87 chuỗi Việt hardcode**, **light mode vỡ 24/25 nền tối**, **0/17 file dùng design token**, **15/17 file dùng `createElement` thay JSX**.

**Kết luận: refactor toàn diện là cần thiết, nhưng phải sửa tầng dữ liệu trước — sửa giao diện trên contract rỗng là mất công vô ích.**

---

## §1. PHƯƠNG PHÁP & CĂN CỨ

| Loại | Cách thu thập | Số lượng |
|---|---|---|
| Static analysis | `read`/`grep` toàn repo (không chỉ `.ts`/`.tsx` — cả `.css`, adapter, i18n, BE) | 17 file advisory + 8 file BE + 2 file config |
| Runtime probe | `docker exec vninvest-dev-core-api python` đọc DB thật | 2 probe |
| Token scan | Node script đếm `text-[Npx]`, `rounded-*`, `var(--*)`, `components/ui/` | 17 file |
| i18n scan | Node script quét chuỗi VI không qua `t()` | 17 file |
| Regex probe | Chạy đúng regex production với 14 case | 14 case |
| Quality gates | `tsc`, `lint`, `i18n:scan`, `vitest` | 4 |

**Câu lệnh tái lập toàn bộ bằng chứng**: xem §10.

---

## §2. BẢN ĐỒ HIỆN TRẠNG

### 2.1 FE (17 file, 1.908 dòng)

| File | Lines | Trách nhiệm | Vấn đề chính |
|---|---|---|---|
| `pages/signals/WhaleAdvisoryPage.tsx` | 397 | Layout, tabs, state | Nhúng bubble chart `:16,:279`; 2 shape data |
| `pages/signals/ShellAiAdvisoryPage.tsx` | 420 | — | **Chết**, chỉ export `index.js:19` |
| `components/advisory/WhaleAdvisoryCommandPanel.js` | 286 | Panel chính | 4 chuỗi hardcode; fake zeros `:115,:143`; empty state sai `:195` |
| `components/advisory/WhaleSymbolSidebar.js` | 203 | Danh sách mã | 3 chuỗi hardcode; số liệu bịa `:125,:128,:136`; LIVE giả `:195` |
| `components/advisory/TrustTelemetryPanel.js` | 121 | Telemetry | Đọc `localStorage` `:50-51` |
| `components/advisory/AdvisoryBacktestPanel.js` | 109 | Tab backtest | — |
| `components/advisory/AdvisoryOrderTicket.js` | 108 | Đặt lệnh | Luôn bị chặn do `side=UNKNOWN` |
| `components/advisory/RecommendationCardExplainability.js` | 144 | Explainability | 3 chuỗi hardcode |
| `components/advisory/AdvisoryAlertDialog.js` | 113 | Tạo cảnh báo | — |
| `components/advisory/RecommendationHistoryMini.js` | 109 | Lịch sử | 1 chuỗi hardcode |
| `components/advisory/ActionChecklist.js` | 96 | Checklist | 1 chuỗi hardcode |
| `components/advisory/WhaleAdvisoryBentoHeader.js` | 94 | Header | 1 chuỗi hardcode |
| `components/advisory/AgenticThoughtStream.js` | 81 | Dòng suy nghĩ | — |
| `components/advisory/RiskModeSelector.js` | 77 | Chế độ rủi ro | `defaultLabel` hardcode |
| `components/advisory/DataFreshnessBadge.js` | 75 | Độ tươi | 3 chuỗi hardcode |
| `components/advisory/AdvisoryCompareTable.js` | 77 | So sánh | — |
| `components/advisory/advisoryExport.js` | 74 | CSV + share | — |
| `components/FactsFirstWhaleBubbleChart.jsx` | 56 | Wrapper bubble | Hardcode `:27` |
| `components/WhaleBubbleChart.jsx` | 1818 | Chart thật | 25 chuỗi hardcode; tự fetch `:594,:642` |

### 2.2 BE

| File | Vị trí | Vấn đề |
|---|---|---|
| `advisory/orchestrator.py` | `:302-311` | Không trả `signal`/`confidence_score` |
| `advisory/orchestrator.py` | `:260-262` | Prompt chỉ yêu cầu `recommendation` + `summary` |
| `advisory/orchestrator.py` | `:201-204` | `gemini` + model OpenAI → 404 |
| `advisory/tasks.py` | `:45-47` | Copy key **nếu có** → mất `signal` |
| `advisory/tasks.py` | `:66-70` | `update_or_create` không có unique constraint |
| `advisory/serializers.py` | `:92-110` | `get_signal`/`get_confidence_score`/`get_rationale` trả None |
| `advisory/serializers.py` | `:41-51` | `sanitize_sensitive_fields` không đệ quy vào `list` |
| `advisory/views.py` | `:696` | `re.compile(r'[^A-Z ]')` xoá dấu Việt |
| `advisory/views.py` | `:694` | `_BACKTEST_FLAT_TOKENS` chứa `'GIU'`,`'THEO DOI'` không bao giờ match |
| `advisory/models.py` | `:160-192` | `AdvisoryComponent` có nhưng không ai đọc |
| `advisory/models.py` | `:88` | `structured_output` không validate key |
| `user_workspace/portfolio_analytics_views.py` | `:1534-1540` | `PortfolioAIAdvisoryListView` trả `{'items': []}` |
| `user_workspace/portfolio_analytics_views.py` | `:1543-1549` | `PortfolioAIAdvisorySymbolStatsView` trả `{'stats': []}` |
| `user_workspace/portfolio_analytics_views.py` | `:621-622` | `ai_model` nhận bất kỳ, không validate theo provider |
| `user_workspace/portfolio_analytics_views.py` | `:1001-1023` | `AIAuditLog.objects.all()` — lộ cross-tenant |

### 2.3 Số liệu đo được

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| File dùng design token `var(--*)` | **0 / 17** | token scan |
| File dùng `components/ui/*` | **0 / 17** (có sẵn 29 primitive) | token scan |
| File dùng `createElement` | **15 / 17** | token scan |
| Typography off-scale | **47** (`10px`×30, `9px`×15, `8px`×2) | token scan |
| Số giá trị radius khác nhau | **5** (`lg/xl/2xl/3xl/full`) vs token có 3 | token scan |
| Chuỗi Việt hardcode | **87** | i18n scan |
| Chuỗi nền tối không có override light | **25** (9 distinct) | grep `bg-slate-9xx` |
| Bundle kéo thêm để vẽ chart rỗng | **774 KB** (`dashboard-*.js`) | dist import graph |
| API call dư mỗi mã | **2** (`getWhaleAnalyticsSnapshot`, `getStockOrderFlow`) | `WhaleBubbleChart.jsx:594,642` |
| Test cover `WhaleSymbolSidebar`/`CommandPanel`/`Telemetry` | **0** | grep test |
| `i18n:scan` exit code khi parse fail | **0** (gate hỏng) | chạy thật |

---

## §3. CONTRADICTIONS

| # | Nguồn | Thực tế | Tác động |
|---|---|---|---|
| X1 | Yêu cầu: "bubble chart ở dashboard và stocks" | Component chỉ ở 2 nơi: `WhaleAdvisoryPage.tsx:279` + `WhaleAnalyticsTab.jsx:129`. Stock-detail dùng API khác (`useStockDetailPageModel.js:126`), **không** có bubble | Bỏ 1 chỗ, **không** ảnh hưởng `/stocks` |
| X2 | Entry 215 S11: "confidence 0-1→0-100 chuẩn hóa" | `confidence_score` luôn `None` (`tasks.py:45-47` + `serializers.py:96-98`) → UI luôn hiện `—` | Toàn bộ tính năng dựa trên confidence vô hiệu |
| X3 | Entry 215 S15: "i18n batch-2 parity" | 87 chuỗi hardcode; 4 nút user thấy trong ảnh 1/2 đều hardcode | EN mode vẫn ra tiếng Việt |
| X4 | Entry 215 S15: "light mode" | CSS override 2 class (`index.css:335-356`); 25 nền tối không override | Light mode vỡ |
| X5 | `useWhaleAdvisoryData.js:110-112` (snake) vs `:133-137` (camel) | 2 shape khác nhau trong 1 trang | Gộp nhầm dữ liệu |
| X6 | `whale-advisory-a11y.component.test.tsx:70-74` | Assert chuỗi trong file, không assert light mode đủ | Test xanh dù light mode hỏng |
| X7 | `models.py:160` `AdvisoryComponent` | Không serializer/view nào đọc; FE không dùng | Model chết ~33 dòng |
| X8 | `AdvisoryLatestView.delete` (Entry 215) | Xoá theo ngày mặc định hôm nay; không có "undo" | Mất dữ liệu vĩnh viễn |

---

## §4. TẦNG 0 — ROOT CAUSE (BẮT BUỘC TRƯỚC UI)

> Không slice UI nào có ý nghĩa nếu `signal`/`confidence_score` vẫn `None`. W0 là **blocker** cho W1–W6.

### R0.1 — Chuẩn hoá signal thành SSOT, Unicode-aware

- **Hiện trạng**: `_extract_backtest_side` (`views.py:700-723`) là bản duy nhất, dùng `_BACKTEST_STRIP_RE` (`:696`) xoá dấu.
- **Yêu cầu**: Tạo `packages/core/backend/src/advisory/signal_norm.py`:
  - `normalize_signal(raw: str | None) -> str` trả `BUY|SELL|HOLD|UNKNOWN`
  - Chuẩn hoá Unicode **trước** khi tokenize: `unicodedata.normalize('NFD', s.upper())` rồi bỏ category `Mn`
  - Giữ nguyên nguyên tắc fail-closed hiện có: >4 token → `UNKNOWN`; token phủ định → `UNKNOWN`; vừa BUY vừa SELL → `UNKNOWN`
  - Bổ sung token có dấu đã chuẩn hoá: `BAN LUC` từ `BÁN LỤC`, `GIU` từ `GIỮ`, `THEO DOI` từ `THEO DÕI`
  - Token phủ định bắt buộc gồm: `KHONG`, `KHONG NEN`, `NEN`, `TRANH`, `CHUA`, `DUNG`, `TUONG DOI`, `NOT`, `NO`, `AVOID`, `DONT`
- **AC**:
  - `BÁN`→`SELL`, `BÁN LỤC`→`SELL`, `GIỮ`→`HOLD`, `THEO DÕI`→`HOLD`
  - `KHÔNG MUA`→`UNKNOWN`, `KHÔNG NÊN MUA`→`UNKNOWN`
  - `MUA VÀ BÁN`→`UNKNOWN`, `nên mua nhẹ 5%`→`BUY`
  - 0 regression trên 14 case §10.4
- **Test**: `tests/test_advisory_signal_norm.py` — bảng case dạng data-driven, ≥20 case
- **Rollback**: revert 1 file

### R0.2 — Orchestrator trả đủ field + prompt yêu cầu enum

- **Hiện trạng**: `orchestrator.py:260-262` prompt chỉ yêu cầu `recommendation` + `summary`; `:302-311` return không có `signal`/`confidence_score`.
- **Yêu cầu**:
  - Sửa prompt `:260-262` yêu cầu JSON: `signal` (`BUY|SELL|HOLD`), `confidence_score` (số 0..1), `summary` (<100 từ), `rationale` (string), `target_price`, `risk_level` (`low|medium|high`)
  - Return thêm `signal`, `confidence_score`, `rationale`, `risk_level`, `target_price` tại `:302-311`
  - **Fail-closed**: `signal` lấy từ `normalize_signal(parsed_json['signal'] or parsed_json['recommendation'])`; nếu `UNKNOWN` → `advisory_text` vẫn ghi nhưng `status='failed'` với `error_message='advisory_signal_unparseable'` (không tạo tín hiệu giả)
  - `confidence_score` clamp `[0,1]`; thiếu → `None` (không tự bịa)
- **AC**: `POST /core/v1/advisory/refresh/<symbol>/` → `GET /core/v1/advisory/latest/<symbol>/` trả `signal ∈ {BUY,SELL,HOLD}` và `confidence_score ∈ [0,1]` hoặc `null`
- **Test**: `tests/test_advisory_orchestrator_contract.py` — mock HTTP, assert key trả về + fail-closed
- **Migration**: không

### R0.3 — tasks.py ghi đủ key, không mất signal

- **Hiện trạng**: `tasks.py:45-47` copy `('signal','confidence_score','summary','rationale','components')` **nếu key có**; thiếu `recommendation`.
- **Yêu cầu**:
  - Bỏ nhánh "copy nếu có", thay bằng build có kiểm soát: lấy `signal` (qua R0.1), `confidence_score`, `summary`, `rationale`, `risk_level`, `target_price`, `recommendation`, `feature_attribution`, `input_snapshot`
  - Parse JSON từ `advisory_text` chỉ khi **thực sự là JSON object** (hiện `:49-57` parse chuỗi summary → luôn fail, giữ nguyên nhưng thêm guard `isinstance` + log debug)
  - Bổ sung `metadata = {'schema_version': 2, 'normalized_by': 'signal_norm.normalize_signal'}`
- **AC**: sau 1 lần refresh thành công, `structured_output` có **đủ 8 key**; `signal` khác `UNKNOWN`
- **Test**: `tests/test_advisory_tasks.py` — assert key set, regression 8/8 hiện có

### R0.4 — Serializer expose đúng contract, không trả field chết

- **Hiện trạng**: `serializers.py:66-84` có 17 field; thiếu `ai_provider`, `risk_level`, `target_price`, `matched_value`, `feature_attribution`, `input_snapshot`, `is_discovery`, `discovery_bucket`, `whale_intensity`, `threshold_source`, `session_date` **không** có trong list (có rồi).
- **Yêu cầu**:
  - Thêm `ai_provider`, `risk_level`, `target_price`, `matched_value`, `feature_attribution`, `input_snapshot`, `is_discovery`, `discovery_bucket`, `whale_intensity`, `threshold_source`, `schema_version`
  - `get_signal` (`:92`) fallback sang `recommendation` + `normalize_signal`
  - Bỏ `get_rationale` trả None cứng → lấy từ structured
  - **Không** thêm `AdvisoryComponent` vào API ở wave này (xem R0.9)
- **AC**: contract smoke test FE↔BE assert **11 field mới** có mặt; không field nào trả `undefined` bắt buộc
- **Test**: `tests/test_advisory_api_contract.py`

### R0.5 — Validate `ai_model` theo `ai_provider`

- **Hiện trạng**: `portfolio_analytics_views.py:621-622` `user_cred.ai_model = str(payload.get('ai_model') or '').strip()` — không validate. Cho phép `ai_provider=gemini` + `ai_model=gpt-4o-mini` → 404.
- **Yêu cầu**:
  - Tạo `PROVIDER_MODEL_PREFIXES = {'gemini': ('gemini',), 'openai': ('gpt-','o1','o3','o4'), 'local': None}` trong `advisory/model_choices.py`
  - `PUT` validate: nếu provider có prefix bắt buộc và `ai_model` không khớp → `400 {'ai_model': 'Model không tương thích provider đã chọn.'}`
  - Kiểm tra cả 2 chiều: đổi `ai_provider` khi `ai_model` đang set → validate lại
  - Cho phép `local` bỏ qua (model tự do)
  - `SystemAISettings` cũng validate khi `is_active=True`
- **AC**: `PUT ai_provider=gemini, ai_model=gpt-4o-mini` → 400; `PUT ai_provider=gemini, ai_model=gemini-2.5-flash` → 200
- **Test**: `tests/test_ai_cc_config_isolation.py` — thêm 6 case matrix (bổ sung 9 case hiện có)

### R0.6 — Symbol stats thật (thay stub)

- **Hiện trạng**: `portfolio_analytics_views.py:1543-1549` trả `{'stats': []}` cố định → sidebar 3 cột **luôn 0** (`useWhaleAdvisoryData.js:182-189` → `buildFallbackSymbolStats` không advisories → `:133-137` tất cả 0).
- **Quyết định**: **implement thật** (không bỏ) — sidebar cần thứ hạng để sắp xếp mã quan tâm.
- **Yêu cầu**:
  - Aggregate từ `AdvisoryRecord` theo `user=request.user`, `session_date=hôm nay`
  - Trả `stats: [{symbol, side, confidence_score, updated_at, is_discovery}]`
  - **Không** trả `whale_intensity`/`buyCount`/`sellCount` (không có nguồn dữ liệu — bỏ hẳn thay vì trả 0)
  - `symbols` param tối đa 200
- **AC**: với 1 record `generated` hôm nay, `stats` có đúng 1 phần tử, `side` khác `UNKNOWN`; user khác → `[]`
- **Test**: `tests/test_advisory_symbol_stats.py` — 5 case (rỗng, 1 record, isolation, param cap, status filter)

### R0.7 — `sanitize_sensitive_fields` đệ quy vào list

- **Hiện trạng**: `serializers.py:41-51` chỉ đệ quy `dict`; `list` đi nhánh `else` (`:49-54`) → chuỗi trong list không qua `SENSITIVE_KEY_PATTERNS` nếu không phải key nhạy cảm.
- **Yêu cầu**: thêm nhánh `isinstance(value, list)` → map đệ quy từng phần tử
- **AC**: `{'components': [{'api_key': 'sk-proj-AAAABBBBCCCCDDDDEEEE'}]}` → giá trị bị mask
- **Test**: `tests/test_advisory_sanitize.py` — 5 case (dict, list, nested, non-secret, mask length ≤8)

### R0.8 — Unique constraint + chống race quota

- **Hiện trạng**: `tasks.py:66-70` `update_or_create` không có unique constraint → race tạo trùng; `AdvisoryRefreshView` đọc–ghi `AdvisorySession.tokens_used` không `select_for_update`.
- **Yêu cầu**:
  - Migration `advisory/0013_advisingsession_unique_user_symbol_date.py`: `UniqueConstraint(fields=['user','symbol','session_date'], name='uniq_advisory_session_user_symbol_date')`
  - Trước khi tạo: `AdvisoryRecord.objects.filter(user=,symbol=,session_date=).exists()` → trả 409 `advisory_already_exists`
  - `AdvisorySession` update dùng `select_for_update()` trong `transaction.atomic()`
- **AC**: 2 request refresh đồng thời → 1 thành công, 1 nhận 409; `tokens_used` không vượt `token_budget`
- **Test**: `tests/test_advisory_race.py` — dùng `TransactionTestCase`, 3 case
- **Migration check**: `makemigrations --check` phải sạch sau khi merge

### R0.9 — Bỏ `AdvisoryComponent` (model chết) hoặc wire

- **Hiện trạng**: `models.py:160-192` + `tasks.py:86-103` **có** ghi 4 component, nhưng không serializer/view nào đọc, FE không dùng.
- **Quyết định**: **giữ model, wire vào API** — đây là nguồn attribution có cấu trúc sẵn cho explainability. Thêm vào R0.4: `components` lấy từ `AdvisoryComponent.objects.filter(session__user=...)` khi có `session_id`, fallback `structured_output['components']`.
- **AC**: `GET /advisory/latest/` trả `components[]` có `component_type` ∈ {technical, whale, recommendation, summary} cho record đã sinh qua task
- **Nếu đội FE không dùng**: tối thiểu trả kèm để không lãng phí dữ liệu đã tồn

### R0.10 — Error message có mã + hành động

- **Hiện trạng**: `error_message` = `"synthesis provider_status=404"` (raw) — user thấy chuỗi kỹ thuật.
- **Yêu cầu**: `AdvisorySynthesisError` (`orchestrator.py:17-20`) mang `code` + `user_message`:
  - `provider_model_mismatch` → "Cấu hình model không tương thích với nhà cung cấp AI. Vào Cài đặt AI để chọn lại."
  - `provider_auth_failed` → "API key AI không hợp lệ hoặc hết hạn."
  - `provider_rate_limited` → "Nhà cung cấp AI đang giới hạn tốc độ. Thử lại sau."
  - `provider_unavailable` → "Dịch vụ AI tạm thời không khả dụng."
  - `advisory_signal_unparseable` → "Không đọc được khuyến nghị từ AI. Thử làm mới."
- **AC**: `error_message` trong DB **không chứa** chuỗi raw của provider; có `error_code` riêng trong `structured_output['error']`

### R0.11 — Đóng 2 cross-tenant/security blocker còn mở từ Entry 215

- **`PortfolioAICommandCenterAuditLogView`** (`portfolio_analytics_views.py:1001-1023`): `AIAuditLog.objects.all()` + `IsAuthenticated` → user đọc log AI của tenant khác. `AIAuditLog` (`models.py:303-330`) không có FK user/tenant.
  - Yêu cầu: thêm `actor` scoping — lọc `actor=request.user.username` hoặc chuyển sang `IsCoreOperator`; ghi rõ quyết định vào docstring
- **`dnse_place_order_api`**: xem ledger Entry 215 OPEN P0-1. **Không thuộc phạm vi trang này** nhưng **bắt buộc** vì R1.4 mở lại luồng đặt lệnh. Tối thiểu: validate server-side + không trả raw `str(exc)`.

### Gate W0

```
cd packages/core/backend
.venv\Scripts\python.exe manage.py check
.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.venv\Scripts\python.exe manage.py test advisory.tests.test_advisory_signal_norm advisory.tests.test_advisory_orchestrator_contract advisory.tests.test_advisory_api_contract advisory.tests.test_advisory_symbol_stats advisory.tests.test_advisory_sanitize advisory.tests.test_advisory_race advisory.tests.test_advisory_backtest advisory.tests.test_advisory_api_routes advisory.tests.test_advisory_status advisory.tests.test_advisory_budget
```
**Expected**: `Ran N tests` tất cả `OK`, exit 0, `check` 0, migrations sạch.
**E2E bắt buộc** (§10.2): sau khi sửa config, 1 refresh thật → record `status=generated`, `signal` ∈ {BUY,SELL,HOLD}, `confidence_score` ∈ [0,1].

---

## §5. KIẾN TRÚC ĐÍCH

### 5.1 Sơ đồ trang (3 tầng, mục tiêu ≤ 1.5 màn hình @1440px)

```
┌─ BentoHeader: tiêu đề + nguồn dữ liệu + trạng thái AI (giữ) ──────────┐
├─ BudgetBanner (giữ) + ErrorBanner (mới, có mã + Retry) ──────────────┤
├──────────────────────────────┬──────────────────────────────────────┤
│  A. DECISION BAR (mới)       │  SIDEBAR (thu gọn, sticky)          │
│  side · confidence · giá     │  Mã đang theo dõi                    │
│  · thời điểm · cảnh báo      │  [tìm kiếm]                         │
├──────────────────────────────┤  Ticker | Side | Conf | Cập nhật     │
│  B. AI THOUGHT + SUMMARY     │  ─────────────────────────────      │
│  (nâng lên từ tab)           │  (chỉ cột có dữ liệu thật — R2.3)   │
├──────────────────────────────┤  [+ SS] phân trang                  │
│  C. EXPLAINABILITY (nâng lên) │                                      │
│  attribution + input snapshot│                                      │
├──────────────────────────────┴──────────────────────────────────────┤
│  D. ACTION BAR: Checklist · Tạo cảnh báo · Đặt lệnh · Xuất · Share  │
├──────────────────────────────────────────────────────────────────────┤
│  E. 3 TAB: Rủi ro | Lịch sử | Backtest        (Telemetry → footer)  │
└──────────────────────────────────────────────────────────────────────┘
```

**Bỏ hoàn toàn**: khối bubble chart (`WhaleAdvisoryPage.tsx:276-286`), tab Telemetry (`:341-345`), hệ tab Tổng quan/Tín hiệu bên trong `WhaleBubbleChart.jsx:1568-1585`.

### 5.2 Chuẩn thiết kế — dùng hạ tầng đã có, không phát minh

| Nhu cầu | Dùng sẵn | Bằng chứng |
|---|---|---|
| Tab | `components/ui/tabs.tsx` | tồn tại |
| Card/Panel | `components/ui/card.tsx` | tồn tại |
| Button | `components/ui/button.tsx` | tồn tại |
| Badge/Skeleton/Table/Progress | `components/ui/badge.tsx`, `skeleton.tsx`, `table.tsx`, `progress.tsx` | tồn tại |
| Select/Dialog/Tooltip | `components/ui/select.tsx`, `dialog.tsx`, `tooltip.tsx` | tồn tại |
| Icon | `components/ui/lucide-icon.tsx` (whitelist) | tồn tại |
| Token màu/typography/spacing/radius | `theme/tokens.css` (`--fs-*`, `--sp-*`, `--r-*`, `--accent-*`) | tồn tại |
| Pattern tham chiếu | `pages/admin/adminUi.tsx` (Header/Panel/MetricCard/EmptyState) | tồn tại |
| Gating | `components/shared/Can.jsx` | đã dùng `CommandPanel.js:11` |

**Quy tắc**: advisory **không** được dùng `text-[Npx]` không nằm trong `--fs-*`, không `rounded-*` ngoài `--r-sm/md/lg`, không hex trực tiếp (hiện đã 0 — phải giữ 0).

### 5.3 Contract chuẩn hoá (kết quả R0)

```
GET  /core/v1/advisory/latest/<symbol>/         → AdvisoryRecord đầy đủ field
GET  /core/v1/advisory/history/<symbol>/        → list + phân trang
GET  /core/v1/advisory/status/<uuid>/           → trạng thái poll
GET  /core/v1/advisory/refresh-info/<symbol>/   → budget thật
GET  /core/v1/advisory/backtest/<symbol>/       → T+1/T+3/T+5
POST /core/v1/advisory/refresh/<symbol>/        → tạo + poll
DELETE /core/v1/advisory/latest/<symbol>/       → xoá ( có confirm + undo 5s )
GET  /portfolio/ai-advisory-symbol-stats/       → THẬT (R0.6)
GET  /portfolio/ai-advisory/                    → thật hoặc bỏ hẳn (R0.12)
```

### R0.12 — Quyết định `PortfolioAIAdvisoryListView`

- **Hiện trạng**: `:1534-1540` trả `{'items': []}`; FE dùng nó ở `useWhaleAdvisoryData.js:205` rồi mới fallback 20 mã (`:7,:16`).
- **Quyết định**: **implement thật** — trả `AdvisoryRecord` hôm nay của user (tối đa 200). Lý do: bỏ sẽ giữ fallback 20 mã, còn implement thì bỏ được 20 request/mã và giải quyết L13.
- **AC**: `GET /portfolio/ai-advisory/?contract=canonical` trả `items` khớp `AdvisoryRecord` của user hôm nay; user khác → `[]`
- **Test**: `tests/test_advisory_list_view.py` — 5 case

---

## §6. YÊU CẦU GIAO DIỆN & TÍNH NĂNG

### W1 — Bỏ bubble chart + code chết

| ID | Hiện trạng | Yêu cầu | AC |
|---|---|---|---|
| **R1.1** | `WhaleAdvisoryPage.tsx:16` import, `:276-286` render | Xoá import + khối render. Xoá `grid xl:grid-cols-3` cũ, thay theo layout §5.1 | `grep "FactsFirstWhaleBubbleChart" src/pages/signals` = 0 hit; `dist` không còn import `dashboard-*.js` từ chunk advisory |
| **R1.2** | `ShellAiAdvisoryPage.tsx` 420 dòng, chỉ export `index.js:19` | Xoá file + export. Cập nhật `whale-advisory-a11y.component.test.tsx:9,73` (đang đọc file này) | `git grep ShellAiAdvisoryPage` = 0 hit; test a11y vẫn xanh |
| **R1.3** | `WhaleAnalyticsTab.jsx:129` (dashboard) | **Không đụng** — giữ nguyên bubble ở dashboard | Smoke dashboard vẫn render chart |
| **R1.4** | Đặt lệnh luôn bị chặn do `side=UNKNOWN` | Sau R0.1–R0.3: `side` thật → mở lại. Guard giữ nguyên: `UNKNOWN` vẫn chặn | Test order ticket: `BUY`→payload `BUY`, `SELL`→`SELL`, `UNKNOWN`→disabled |
| **R1.5** | Không có | Thêm "Hoàn tác" 5s sau khi xoá (soft delete client-side + re-refresh) | Xoá → banner "Đã xoá. Hoàn tác" 5s; click → khôi phục |

**Gate W1**: `tsc` 0 · `lint` 0 errors · `vitest` advisory ≥ 41 pass · build PASS · đo lại `dist`: chunk advisory **không import** `dashboard-*.js` (tiết kiệm ~774 KB)

### W2 — Tái cấu trúc layout & IA

| ID | Hiện trạng | Yêu cầu | AC |
|---|---|---|---|
| **R2.1** | `WhaleAdvisoryPage.tsx:225` grid 3 cột, `min-h-[560px]` cứng | 1 cột chính + sidebar `xl:w-80` sticky `top-4`; bỏ `min-h` cứng, dùng `min-h-dvh` | @1440px: sidebar sticky khi scroll dài |
| **R2.2** | 4 tab `:288-333`, telemetry chỉ đọc localStorage | Còn **3 tab**: Rủi ro / Lịch sử / Backtest. Telemetry → footer accordion, nhãn rõ "chỉ dùng trên máy này" | `getAllByRole('tab').length === 3` |
| **R2.3** | `WhaleSymbolSidebar.js:125,128,136-139` 3 cột luôn 0 | Chỉ hiện cột có dữ liệu thật: Ticker · Side · Conf · Cập nhật. Bỏ `whaleIntensity`, `buyCount/sellCount`, `GD` | Không còn chuỗi `0%` khi không có dữ liệu; test assert cột |
| **R2.4** | 4 màn hình (ảnh 1–4) | Decision bar + thought + explainability gộp 1 màn hình đầu; tabs ở dưới | @1440×900: decision + thought + explainability + action bar nằm gọn 1 màn hình |
| **R2.5** | `CommandPanel.js:217-218` nhãn sai | "Bảng điều khiển cá voi" → `/stocks/<symbol>` hoặc bỏ; "Workspace" → bỏ trùng | Không còn link nhãn/lệch |
| **R2.6** | Sidebar `WhaleSymbolSidebar.js:195-196` "LIVE" tĩnh | Bỏ badge LIVE, thay bằng trạng thái thật từ `AdvisoryStatusView` (`:running/success/failed`) hoặc bỏ | Không còn chữ "LIVE" tĩnh |

### W3 — Chuẩn thiết kế

| ID | Hiện trạng | Yêu cầu | AC |
|---|---|---|---|
| **R3.1** | 0/17 file dùng `components/ui/*` | Migrate sang `Card/Tabs/Button/Badge/Skeleton/Table/Progress/Select/Dialog` | `grep "components/ui/" components/advisory` ≥ 8 file |
| **R3.2** | 0/17 file dùng `var(--*)` | Áp `theme/tokens.css`: `--fs-*`, `--sp-*`, `--r-*`, `--accent-*` | 0 `text-[Npx]` off-scale; chỉ còn giá trị trong `--fs-*` |
| **R3.3** | 15/17 file `createElement` | Chuyển hết sang JSX (đọc được, type-safe) | `grep createElement components/advisory` = 0 |
| **R3.4** | 25 nền tối không override | Light mode: dùng token, chỉ cần override tập trung 1 chỗ thay vì liệt kê utility | Screenshot light mode: không còn panel tối trên nền sáng |
| **R3.5** | 5 radius | Giới hạn `--r-sm/md/lg` | `grep -o "rounded-[a-z0-9]*"` chỉ còn lg/xl/full tương ứng token |
| **R3.6** | Emoji trong UI (`CommandPanel.js:174` 🔒, `Explainability.js:132` ⚠️) | Bỏ emoji, dùng `lucide-icon.tsx` | 0 emoji trong advisory components |

### W4 — Trung thực & a11y

| ID | Hiện trạng | Yêu cầu | AC |
|---|---|---|---|
| **R4.1** | `CommandPanel.js:195` "Chưa có mã nào đang hoạt động" khi đã chọn ABW | 3 empty state riêng: chưa chọn mã / mã chưa có tư vấn / tư vấn lỗi (kèm mã lỗi + nút Thử lại) | Test: chọn mã không có record → hiện đúng "mã này chưa có tư vấn" |
| **R4.2** | `:115` `0%`, `:143` `0 VNĐ` khi chưa có dữ liệu | `?? null` → `—`; progress bar ẩn khi null | Test: không có advisory → không còn chuỗi "0%" hay "0 VNĐ" |
| **R4.3** | `:131` confidence đã dùng `—` (đúng) | Giữ nguyên làm chuẩn cho R4.2 | — |
| **R4.4** | `WhaleAdvisoryPage.tsx:218-220` nút "Thử lại" hardcode, không có mã lỗi | Error banner: `mã lỗi` + thông điệp từ `error_code` (R0.10) + Retry | Test render lỗi → thấy mã lỗi |
| **R4.5** | A11y có tablist nhưng thiếu keyboard nav, focus ring | `Tabs` từ `components/ui/tabs.tsx` (đã có roving tabindex) + `:focus-visible` ring | Test: ArrowRight đổi tab |
| **R4.6** | `WhaleSymbolSidebar.js:143` `role="checkbox"` trong `<button>` | Bỏ nested interactive, dùng checkbox thật hoặc nút riêng | Test: không còn `role=checkbox` lồng trong button |
| **R4.7** | Contrast chưa đo | Đo contrast tất cả text trên light+dark; ≥ 4.5:1 body, ≥ 3:1 large | Báo cáo contrast kèm số đo |

### W5 — i18n

| ID | Hiện trạng | Yêu cầu | AC |
|---|---|---|---|
| **R5.1** | 87 chuỗi VI hardcode | Đưa hết vào `aiAdvisory.*` (đã có 143 key / 15 sub-namespace, `vi.js:6327`) | Script scan (node, tái lập §10.5) = **0** |
| **R5.2** | `i18n:scan` exit 0 dù parse fail | Sửa scanner parse `vi.js/en.js` dạng ESM (hoặc đổi file `.json`); fail → exit ≠ 0 | Cố tình thêm 1 chuỗi hardcode → `i18n:scan` exit ≠ 0 |
| **R5.3** | `whale-advisory-a11y.component.test.tsx:55` assert `{ name: /Tìm mã/ }` (chuỗi cứng) | Sau R5.1 phải assert theo `t()`/key, không theo literal VI | Test EN locale render → không còn chuỗi VI trong DOM |
| **R5.4** | — | Bổ sung test parity vi↔en cho `aiAdvisory` | `ai-cc-i18n-parity` mở rộng sang `aiAdvisory`: key-set equal |

### W6 — Test & minh chứng

| ID | Yêu cầu | AC |
|---|---|---|
| **R6.1** | Test `WhaleSymbolSidebar` (cột, empty state, sort) | ≥ 6 test |
| **R6.2** | Test `WhaleAdvisoryCommandPanel` (R4.1, R4.2) | ≥ 6 test |
| **R6.3** | Test `normalize_signal` FE khớp BE (bảng case chung) | ≥ 12 test, dùng **chung** fixture với test BE |
| **R6.4** | Contract smoke FE↔BE cho 11 field mới (R0.4) | ≥ 6 assert |
| **R6.5** | Xoá 2 test assert chuỗi source không còn ý nghĩa (`a11y:70-74`) | Thay bằng assert render thật |
| **R6.6** | Visual QA: 6 tổ hợp {light,dark} × {có dữ liệu, rỗng, lỗi} | 6 screenshot lưu `docs/evidence/ai-advisory-ui/` |
| **R6.7** | Bundle budget | `dist` chunk advisory **không** import `dashboard-*.js`; ghi số KB trước/sau vào evidence |

---

## §7. DEFINITION OF DONE

### 7.1 Cổng bắt buộc — tất cả phải xanh

```powershell
# FE
cd packages/web
npx tsc --noEmit                              # exit 0
npm run lint                                  # 0 errors
npm run i18n:scan                             # exit 0 VÀ parse được (R5.2)
npm run check:shell                           # exit 0
npm run build                                 # exit 0
npx vitest run src/components/__tests__/whale-advisory-*.test.* src/hooks/useWhaleAdvisoryData*.test.js --testTimeout=30000 --maxWorkers=1 --fileParallelism=false   # 0 fail

# BE  (host .venv, KHÔNG dùng container image cũ)
cd packages/core/backend
$env:DJANGO_DEBUG='true'
.venv\Scripts\python.exe manage.py check                                  # 0
.venv\Scripts\python.exe manage.py makemigrations --check --dry-run       # sạch
.venv\Scripts\python.exe manage.py test advisory                         # 0 fail
```

### 7.2 Cổng nghiệm thu nghiệp vụ — chạy tay, phải có bằng chứng

| # | Kịch bản | Kết quả mong đợi |
|---|---|---|
| A1 | Sửa config provider/model sai → bấm Làm mới | HTTP 400, thông báo tiếng Việt nói rõ sửa ở Cài đặt AI |
| A2 | Sửa config đúng → bấm Làm mới | Poll → `generated`; `side` ∈ {BUY,SELL,HOLD}; `confidence` ∈ [0,1] hiển thị dạng % |
| A3 | Mở tab Rủi ro / Lịch sử / Backtest | Cả 3 render dữ liệu thật; Backtest có `N`, `reliable`, `truncated` |
| A4 | Chọn mã chưa có tư vấn | Empty state "mã này chưa có tư vấn" + nút Làm mới; **không** hiện `0%` / `0 VNĐ` |
| A5 | Bấm Đặt lệnh với `side=BUY` | Form mở, mặc định BUY, xác nhận 2 bước, lot ≥ 100 |
| A6 | Tư vấn lỗi (provider 500) | Error banner có mã lỗi + thông điệp hành động + nút Thử lại |
| A7 | Xoá tư vấn | Confirm → xoá → banner "Hoàn tác" 5s |
| A8 | Sidebar | Chỉ cột Ticker/Side/Conf/Cập nhật; **không** cột 0% |
| A9 | Chuyển light mode | Không còn panel tối trên nền sáng |
| A10 | Chuyển sang English | **0** chuỗi tiếng Việt trong DOM trang |
| A11 | Đo DevTools → `/ai-advisory` | Không có request `getWhaleAnalyticsSnapshot`/`getStockOrderFlow` |
| A12 | Đo DevTools → `/ai-advisory` | ≤ 1 request `ai-advisory-symbol-stats` + 1 `ai-advisory` list + theo mã |

### 7.3 Minh chứng phải nộp

```
docs/evidence/ai-advisory-ui/
  gates.md                 # output 12 lệnh §7.1
  e2e-A1..A12.md           # kết quả 12 kịch bản + ảnh chụp
  contrast.md              # bảng contrast light/dark (R4.7)
  bundle.md                # KB chunk advisory trước/sau (R6.7)
  visual/{light,dark}-{data,empty,error}.png   # 6 ảnh (R6.6)
  i18n-scan.txt            # output script R5.1 = 0
```

---

## §8. PHẢN BIỆN

### 8.1 Phản biện chính: "Bỏ bubble chart là mất tính năng"

- **Phản bác**: Bubble chart **không thuộc phạm vi trang này**. Nó là *order-flow visualization*, không phải *AI advisory*. Nó vẫn còn nguyên ở dashboard (`WhaleAnalyticsTab.jsx:129`) nơi có đủ dữ liệu: `analyticsData` prefetch + SMFI + sức mạnh tổ chức (`:100-120`) + disclaimer + badge stale (`:150-160`). Trên advisory nó mất sạch 6 tính năng đó và đổi lại 774 KB + 2 request/mã + "0 bubble".
- **Điều kiện bác bỏ lập luận**: nếu sau R0.6 sidebar có `side`+`confidence` thật, người dùng vẫn cần *xem dòng tiền* ngay trong trang advisory → khi đó nên thêm **link "Xem dòng tiền"** tới dashboard thay vì nhúng lại chart. Không nhúng lại vì trùng lặp đã được chứng minh.

### 8.2 Phản biện: "Sửa BE tầng 0 là phạm vi khác, không phải refactor UI"

- **Phản bác**: Đây là điều kiện tiên quyết, không phải mở rộng. Bằng chứng: `serializers.py:92-94` trả `signal=None` vĩnh viễn ⇒ `normalizeAdvisorySide` (`useWhaleAdvisoryData.js:72-78`) trả `'UNKNOWN'` cho mọi record ⇒ `AdvisoryOrderTicket` chặn vĩnh viễn ⇒ CSV cột `side` rỗng ⇒ backtest 0 mẫu. Sửa UI trên nền đó là polish một trang không có dữ liệu.
- **Cách chứng minh phạm vi vẫn gọn**: W0 **không thêm endpoint mới** (trừ khi implement 2 stub), không thêm model mới (trừ 1 unique constraint), không đổi schema `structured_output`.

### 8.3 Rủi ro đã biết & giảm thiểu

| # | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| K1 | Sau R0.2, LLM trả `signal` không parse được → tỉ lệ `failed` tăng | Cao | Cao | Fail-closed có chủ đích + R0.1 có fallback từ `recommendation` + test ≥20 case; đo `failed_ratio` sau 20 refresh, ngưỡng ≤ 10% |
| K2 | Chuyển 15 file sang JSX làm sai lệch hành vi | Trung bình | Trung bình | Migrate 1 file/lần, chạy test sau mỗi file; không gộp với đổi logic |
| K3 | Bỏ 4 tab → 3 làm mất khả năng quan sát | Thấp | Thấp | Telemetry chuyển sang footer (không xoá hẳn), có AC "không mất chức năng" |
| K4 | `unique_constraint` (R0.8) fail nếu DB đang có bản ghi trùng | Trung bình | Cao | Migration phải **dedupe trước** trong `RunPython`; có bước verify đếm trùng trước khi merge |
| K5 | 2 request/mã biến mất → phát hiện chậm dữ liệu hỏng | Thấp | Thấp | Bù bằng A11: bắt buộc 1 request/mã tối đa |
| K6 | Đổi i18n làm hỏng test assert literal | Cao | Thấp | R5.3 liệt kê sẵn 1 test phải sửa |
| K7 | LLM trả `confidence_score` là string `"0.85"` | Trung bình | Trung bình | R0.2 ép `float()` trong try, fail → `None` (không bịa) |

### 8.4 Những chỗ tôi có thể sai

1. **Có thể `structured_output` đã có `signal` từ dữ liệu cũ**: DB dev chỉ 1 record `failed` nên chưa chứng minh được. Đội BE nên chạy `AdvisoryRecord.objects.exclude(structured_output={}).values_list('structured_output')[:50]` trên **DB production/staging** trước khi kết luận không tồn tại. Nếu có → R0.2/R0.3 chỉ cần vá parser, giảm ~40% khối lượng W0.
2. **Có thể `AdvisoryComponent` được đọc ở module khác ngoài `advisory/`**: tôi chỉ grep trong `packages/core/backend/src/advisory`. Cần grep toàn repo trước khi xoá/giữ (R0.9).
3. **`i18n:scan` có thể cố ý non-blocking**: nếu repo đã quy ước scanner chỉ báo cáo, thì R5.2 nên hạ xuống P2 thay vì P1.
4. **Layout §5.1 là thiết kế của tôi, chưa có user test**: cần visual QA 6 ảnh (R6.6) **trước khi** xem là chốt. Nếu đội chạy 1440×900 thấy vẫn dài → chấp nhận 2 màn hình, ghi vào evidence.

### 8.5 Phương án đã cân nhắc và loại

| Phương án | Lý do loại |
|---|---|
| Chỉ sửa CSS, giữ nguyên layout | Không chạm 3 lỗi dữ liệu bịa (H2/H3/H4) — vấn đề credibility, không phải thẩm mỹ |
| Lazy-load bubble chart thay vì bỏ | Vẫn giữ trùng lặp + 2 request; `dashboard` chunk 774 KB vẫn phải tải |
| Xoá luôn bubble ở dashboard | Ngoài phạm vi; dashboard là nơi duy nhất nó có dữ liệu đầy đủ |
| Viết lại `WhaleBubbleChart.jsx` (1818 dòng) | Không liên quan advisory; thuộc backlog riêng |
| Thay bằng chart mới (sparkline CVD) | Cần BE `SessionFacts`; mở rộng phạm vi. Ghi backlog, làm wave sau |

---

## §9. BÀN GIAO

### 9.1 Chia 2 luồng sau W0

| Luồng | Người | Nội dung |
|---|---|---|
| **BE** | 1 người | W0 (R0.1–R0.12) + R1.4 |
| **FE** | 1 người | W1.1–W1.3, R1.5, W2, W3, W4, W5, W6 |

W0 **tuần tự trước**: FE chỉ làm W1.1–W1.3 (xoá bubble, xoá shell) vì không phụ thuộc dữ liệu.

### 9.2 Ước lượng

| Wave | Nội dung | Ngày công | Phụ thuộc |
|---|---|---|---|
| W0 | R0.1–R0.12 (contract + security) | 5–7 | — |
| W1 | Xoá bubble + shell + undo | 1 | W0 (cho R1.4) |
| W2 | Layout + IA + sidebar | 2 | W0 (cần `side` thật cho cột) |
| W3 | Design system (JSX + tokens + light) | 4 | W2 |
| W4 | Trung thực + a11y | 2 | W0 |
| W5 | i18n + scanner | 2 | W2 |
| W6 | Test + visual QA + evidence | 2 | W3, W4, W5 |
| **Tổng** | | **18–20** | |

### 9.3 File inventory

**Xoá**: `pages/signals/ShellAiAdvisoryPage.tsx` · import ở `index.js:19`
**Sửa**: `pages/signals/WhaleAdvisoryPage.tsx` · `hooks/useWhaleAdvisoryData.js` · `adapters/core/advisory.js` · 14 file `components/advisory/*` · `index.css` (thu gọn override) · `i18n/vi.js` + `en.js` · 3 test advisory
**Thêm**: `advisory/signal_norm.py` · `advisory/model_choices.py` · `tests/test_advisory_signal_norm.py` · `test_advisory_orchestrator_contract.py` · `test_advisory_api_contract.py` · `test_advisory_symbol_stats.py` · `test_advisory_sanitize.py` · `test_advisory_race.py` · `test_advisory_list_view.py` · `advisory/migrations/0013_*.py` · `docs/evidence/ai-advisory-ui/*`
**Không đụng**: `components/WhaleBubbleChart.jsx` · `components/FactsFirstWhaleBubbleChart.jsx` · `components/dashboard/WhaleAnalyticsTab.jsx` · `features/stock-detail/**`

### 9.4 Quyết định đã chốt (không cần hỏi lại)

1. **Xoá bubble chart khỏi advisory** — giữ ở dashboard, `/stocks` không bị ảnh hưởng (X1).
2. **Sidebar chỉ hiện cột có dữ liệu thật** — bỏ `whaleIntensity`/`buyCount`/`GD`; implement `ai-advisory-symbol-stats` thật (R0.6) thay vì bỏ hẳn.
3. **Telemetry không xoá** — chuyển xuống footer accordion, dán nhãn "chỉ dùng trên máy này", không tính là tín hiệu trust.
4. **Layout 3 tầng** theo §5.1, sidebar sticky 80.
5. **Dùng `components/ui/*` + `theme/tokens.css`**, không phát minh kit mới.
6. **Chuyển hết sang JSX** (15 file).
7. **`AdvisoryComponent` giữ + wire vào API** (R0.9).
8. **`PortfolioAIAdvisoryListView` implement thật** (R0.12) → bỏ được fallback 20 mã.
9. **Ưu tiên W0 trước tuyệt đối** — nếu thiếu thời gian thì cắt W6 visual QA chứ không cắt W0.
10. **Mọi số trong tài liệu này đã verify bằng lệnh thật**; mục §8.4 nêu 4 điểm cần xác minh thêm trên môi trường đích.

---

## §10. PHỤ LỤC — TÁI LẬP MINH CHỨNG

### 10.1 Bằng chứng root cause (đã chạy)

```powershell
docker cp db_probe.py vninvest-dev-core-api:/tmp/ ; docker exec vninvest-dev-core-api python /tmp/db_probe.py
# → AdvisoryRecord total: 1 ; by status: [{'status': 'failed', 'n': 1}]
# → structured_output key frequency: {} ; NO record with non-empty structured_output
```

### 10.2 Bằng chứng cấu hình sai (đã chạy)

```powershell
docker exec vninvest-dev-core-api python /tmp/db_probe2.py
# → error_message: synthesis provider_status=404
# → effective_ai_context: ai_provider=gemini, ai_model=gpt-4o-mini
```

### 10.3 Bằng chứng parser Unicode (đã chạy, 5/14 MISMATCH)

| input | hiện tại | sau R0.1 |
|---|---|---|
| `BÁN` | `None` | `SELL` |
| `BÁN LỤC` | `None` | `SELL` |
| `GIỮ` | `None` | `HOLD` |
| `BÁN (giảm tỷ trọng)` | `None` | `SELL` |
| `KHÔNG MUA` | **`BUY`** | `UNKNOWN` |

### 10.4 Script kiểm chứng R0.1 (đưa vào test)

`tests/test_advisory_signal_norm.py` phải chứa **≥ 20 case** gồm 14 case trên + 6 case biên (`''`, `None`, `'   '`, `'MUA/BÁN'`, `'x'*200`, `'5.0%'`).

### 10.5 Script quét i18n (đưa vào repo)

Node script quét `components/advisory/*` + `pages/signals/WhaleAdvisory*`, bỏ qua dòng có `t(`/`defaultValue`/`className`, đếm literal chứa ký tự `\u00C0-\u1EF9`. **Kỳ vọng sau R5.1: `TOTAL=0`**.

### 10.6 Script đo bundle (đưa vào evidence)

```powershell
$f = Get-ChildItem packages/web/dist/assets -Filter "WhaleAdvisoryPage-*.js" | Select-Object -First 1
$c = Get-Content $f.FullName -Raw
[regex]::Matches($c, 'from"\./([^"]+\.js)"') | ForEach-Object {
  $p = "packages/web/dist/assets/$($_.Groups[1].Value)"
  "{0,-46} {1,8:N0} KB" -f $_.Groups[1].Value, ((Get-Item $p).Length/1KB)
}
```
**Hiện tại** có dòng `dashboard-PDWJjp5A.js  774 KB` → **sau R1.1 phải không còn**.
