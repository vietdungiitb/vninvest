# Kế hoạch thực hiện: AI Advisory đạt đẳng cấp thương mại (2026-09-25)

> **Bàn giao cho đội code — làm trực tiếp, không cần hỏi lại.**
> Nguồn audit: session 2026-09-25 (Entry 214). Mọi file:line đã xác thực bằng code thật.
> Quy ước cứng: i18n qua `LangContext` (`t()` + `localeTag`); API qua `coreApiAdapter` (`coreGet/corePost`); nhãn Việt full dấu; `npx tsc --noEmit` sau mỗi slice, `npm run build` cuối mỗi Wave; `manage.py check` + `makemigrations --check` sau mỗi slice BE.

## 0. Ma trận slice → finding → mức ưu tiên

| Slice | Finding | Mức | Cửa ngõ Wave |
|---|---|---|---|
| S01 | F-04 leak chéo user Latest/History | P0 | Wave P0 |
| S02 | F-09 API key plaintext at-rest | P0 | Wave P0 |
| S03 | F-02 TOCTOU budget + cooldown bypass | P0 | Wave P0 |
| S04 | F-05 thiếu throttle riêng | P0 | Wave P0 |
| S05 | F-03 generation bỏ qua user budget/temp + F-14 token_budget 2 nguồn sự thật | P0 | Wave P0 |
| S06 | F-08 synthesis fail-loud + quota refund + error-string guard | P0 | Wave P0 |
| S07 | F-01 `Sum()` aggregate + F-06 bỏ reset + F-07 PUT validate + F-12 khai báo cooldown setting | P1 | Wave P0 (bundle nhỏ, làm cùng) |
| S08 | E1 link `/ai-advisory/shell` gãy + registry dead | P1 | Wave P1 |
| S09 | E2 CSS `neon-glass-panel/agentic-glow-cyan` missing SaaS | P1 | Wave P1 |
| S10 | E3 skeleton + E4 budget banner route chính + E5 quota max động | P1 | Wave P1 |
| S11 | E6 confidence chuẩn + E7 locale + i18n hardcode batch-1 | P1 | Wave P1 |
| S12 | G1 backtest runner T+1/T+3/T+5 | P2 | Wave P2 |
| S13 | G2 export/share + G3 compare đa mã | P2 | Wave P2 |
| S14 | G4 alert 2 chiều + G5 order ticket prefill | P2 | Wave P2 |
| S15 | G6 explainability + SSE/poll-status + R1 light-mode + R4 a11y + R7 confirm xóa | P2/P1 | Wave P2 |

Thứ tự bắt buộc: S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 → S10 → S12 → S13 → S14 → S15.
Không được làm S12–S15 trước khi S01–S06 xong (dữ liệu nền chưa an toàn).

---

## Wave P0 — Bảo mật + tiền (BE)

### S01 — User-scoping Latest/History (F-04)

**Hiện trạng code thật:**
- `packages/core/backend/src/advisory/views.py:184-188` — `AdvisoryLatestView.get` filter `(symbol, session_date, status)` **không** `user=`.
- `views.py:558-562` — `AdvisoryHistoryView.get` filter `(symbol, status)` **không** `user=`.
- Mẫu đúng để copy: `packages/core/backend/src/market_data/stock_mgmt_native_views.py:2317-2318` đã `.filter(user=...)`.
- Index sẵn hỗ trợ: `advisory/models.py:103-104` (`symbol,session_date,status`), `:104` (`user,session_date`).

**Yêu cầu (làm đúng từng bước):**
1. `views.py:184-188`: thêm `.filter(user=request.user, ...)` — giữ nguyên `order_by('-generated_at','-created_at')`, giữ 404 message hiện tại.
2. `views.py:556-562`: thêm `.filter(user=request.user, ...)` trước `order_by`; giữ paginator + `session_date` query param.
3. Không thêm migration (chỉ đổi queryset). Không đổi serializer.
4. Legacy row `user=NULL` (`models.py:72-79` nullable): sau fix sẽ 404 với mọi user (fail-closed — chấp nhận, ghi vào release note).

**Tiêu chí nghiệm thu:**
- AC-1: user A tạo advisory FPT (pending→generated), user B `GET /core/v1/advisory/latest/FPT/` → 404 (không thấy của A).
- AC-2: user B `GET /core/v1/advisory/history/FPT/` → `results` không chứa record của A.
- AC-3: user A vẫn thấy của chính mình (200 + results ≥ 1).
- AC-4: isolation áp dụng cả khi `?session_date=` và khi qua paginator.

**Test (thêm vào `packages/core/backend/tests/test_advisory_api_routes.py`, theo convention file hiện tại `TestCase + APIClient + force_authenticate`, xem `:34-49`):**
- `test_latest_does_not_leak_other_users_record`: 2 users, A tạo record generated, B GET → 404.
- `test_history_does_not_leak_other_users_record`: B GET history → 0 results của A; A GET → ≥1.
- `test_latest_returns_own_record`: A GET → 200 + đúng `advisory_id`.

**Gates:** `manage.py check` 0; `makemigrations --check` clean; file test trên PASS; regression `test_advisory_api_routes.py` + `test_advisory_budget.py` PASS.

**Minh chứng:** log test 2-user (copy dòng PASS), `git diff` 2 hunk queryset.

**Rủi ro/Rollback:** user đang dựa vào đọc chung (không mong đợi) sẽ 404 — thông báo trước 1 release; rollback = revert 2 dòng filter.

---

### S02 — Strip API key khỏi snapshot (F-09)

**Hiện trạng code thật:**
- `views.py:391` `'api_key': decrypted_key` trong `effective_context`.
- `views.py:456-464` persist toàn bộ `effective_context` vào `context_snapshot.effective_ai_context`.
- Hàm sanitize sẵn nhưng **không được gọi** ở path này: `tasks.py:12-17` `_sanitize_effective_context_for_session` (chỉ dùng cho `AdvisorySession` tại `:88`); `serializers.py:34-50` `sanitize_sensitive_fields` (dùng cho CC audit, không dùng ở refresh-path).
- Celery nhận `effective_context` nguyên key là đúng (cần key để gọi LLM tại `orchestrator.py:264-265`); chỉ snapshot DB phải strip.

**Yêu cầu:**
1. Trong `views.py`, trước `AdvisoryRecord.objects.create` (`:466-475`): `snapshot_context = _sanitize_effective_context_for_session(effective_context)` — import hàm từ `advisory.tasks` (tránh duplicate logic). Persist `snapshot_context` vào `context_snapshot.effective_ai_context`; giữ `effective_context` nguyên khi gọi `generate_advisory_task.delay` (`:507-508`).
2. Mở rộng `_is_sensitive_key` nếu cần: hiện tại `serializers.py:24-31` đã cover `api_key/secret/credential/token` (trừ `max_token/tokens_per` — giữ nguyên).
3. Không migration. Không đổi response shape (serializer không expose snapshot key — verify `serializers.py:62-110` chỉ expose signal/confidence/summary/rationale/components).

**Tiêu chí nghiệm thu:**
- AC-1: POST refresh với BYOK → đọc `AdvisoryRecord.context_snapshot.effective_ai_context.api_key` trong DB/shell == `'[redacted]'`, không phải key thật.
- AC-2: task celery vẫn nhận key thật (mock `generate_advisory_task.delay`, assert arg `effective_context['api_key']` == key đã decrypt).
- AC-3: record cũ đã lộ key không tự sửa (ghi release note; script backfill là slice riêng, không làm ở đây).

**Test (cùng file `test_advisory_api_routes.py`):**
- `test_refresh_snapshot_redacts_api_key`: mock decrypt trả `sk-test-...`, POST, assert `record.context_snapshot['effective_ai_context']['api_key'] == '[redacted]'` + assert `mock_delay.call_args[0][1]['api_key']` vẫn là key thật.

**Gates:** check 0; test mới + regression PASS.

**Minh chứng:** shell query 1 record sau POST (giá trị `[redacted]`), diff 1 hunk.

---

### S03 — Per-user lock + global cooldown (F-02)

**Hiện trạng code thật:**
- Cooldown chỉ `(user, symbol)` tại `views.py:244-249`, default 60s qua `getattr(...,'ADVISORY_MANUAL_TRIGGER_COOLDOWN_SECONDS',60)` (`:241`) — setting này **không khai báo** trong `settings.py` (xem S07).
- Không lock quanh check+create (đọc toàn `post` `:207-541` không có `cache.add`/transaction bao check).
- Doc đề xuất per-user lock nhưng code chưa có.

**Yêu cầu:**
1. Thêm per-user global cooldown ngắn (vd 10s, setting mới `ADVISORY_MANUAL_TRIGGER_USER_COOLDOWN_SECONDS=10`): query record mới nhất của user (mọi symbol) trong window → 429 `retry_after_seconds` (reuse envelope cooldown hiện tại `:267-274`, thêm `scope:'user'` trong response để FE phân biệt).
2. Thêm distributed lock quanh check+create: `cache.add(f'advisory:refresh:lock:{user_id}', 1, timeout=15)`; không lấy được lock → 429 `reason='concurrent_refresh'`. Đặt trong `post` trước budget check, release trong `finally`. Dùng `django.core.cache` (backend cache hiện tại của dự án — không thêm Redis dependency mới).
3. Giữ cooldown per-symbol 60s hiện tại nguyên.

**Tiêu chí nghiệm thu:**
- AC-1: 2 POST đồng thời cùng user khác symbol → 1 request 201, 1 request 429 (không cả 2 đều 201).
- AC-2: POST symbol B ngay sau POST symbol A (trong 10s) → 429 `scope:'user'` + `retry_after_seconds` ≤ 10.
- AC-3: sau 10s, POST symbol B → 201 (không kẹt lock).

**Test:**
- `test_concurrent_refresh_single_flight`: mock `cache.add` trả False lần 2 → 429 (unit, không cần thread thật).
- `test_user_global_cooldown_blocks_symbol_rotation`: tạo record user+symbol A `created_at=now`, POST symbol B → 429.
- `test_lock_released_after_success`: POST 201 → `cache.delete` đã gọi (assert mock) hoặc POST tiếp sau hết window → 201.

**Gates:** check 0; test mới + regression PASS.

---

### S04 — Throttle riêng advisory (F-05)

**Hiện trạng code thật:**
- 3 views chỉ `permission_classes=[IsAuthenticated]` (`views.py:179,205,553`), không `throttle_classes`.
- Buckets sẵn trong `settings.py:262-283`: `user 1000/hour`, `signals 60/min`, `soc_stream 60/min` — **không** có bucket advisory.

**Yêu cầu:**
1. `settings.py:262-283`: thêm `'advisory_refresh': '999999/day' if TESTING else '10/hour'` (ngang `ingest_admin_trigger 10/hour` — pattern có sẵn).
2. `views.py:198-205` (`AdvisoryRefreshView`): thêm `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = 'advisory_refresh'`. Chỉ gắn POST view (Latest/History giữ global).
3. Response 429 của DRF giữ nguyên envelope (không custom).

**Tiêu chí nghiệm thu:**
- AC-1: user gửi 11 POST refresh trong 1h (TESTING bypass除外 — test bằng override rate) → request 11 → 429.
- AC-2: GET latest/history không bị bucket này chặn (gửi 20 GET liên tiếp → không 429 từ scope này).
- AC-3: `DEBUG/TESTING` vẫn bypass như các bucket khác.

**Test:** `override_settings(REST_FRAMEWORK={... 'advisory_refresh': '3/hour' ...})`, POST 4 lần → lần 4 là 429.

**Gates:** check 0; test mới PASS.

---

### S05 — Wire user budget/temperature vào generation (F-03 + F-14)

**Hiện trạng code thật:**
- `_resolve_advisory_token_budget` (`views.py:129-146`) + `_advisory_budget_state` (`:149-174`) đã đúng cho enforcement.
- Nhưng `effective_context` (`:385-399`) lấy `ai_settings.max_tokens/temperature` (system) — không đọc `UserAICredential`.
- `tasks.py:97` lưu `token_budget = effective_context.max_tokens` (system) → `AdvisorySession.budget_exceeded` (`models.py:155-157`) lệch với budget-state enforcement.

**Yêu cầu:**
1. Trong `views.py` sau khi resolve `budget_state`: `remaining = budget_state['remaining']`; `effective_max = min(int(ai_settings.max_tokens or 2000), max(1, remaining))`; gán `effective_context['max_tokens'] = effective_max`.
2. Đọc `UserAICredential.temperature` (nullable): nếu `not None` → clamp `0..1` (pattern PUT tại `portfolio_analytics_views.py:658`) → gán `effective_context['temperature']`.
3. Truyền thêm `effective_context['token_budget'] = budget_state['token_budget']` + `['budget_source']`; `tasks.py:97` đổi sang `int(effective_context.get('token_budget') or effective_context.get('max_tokens') or 2000)` — một nguồn sự thật.
4. Không migration (dùng key mới trong JSON + int field sẵn).

**Tiêu chí nghiệm thu:**
- AC-1: user budget 100, system max 5000, remaining 60 → `AdvisoryRecord.context_snapshot.effective_ai_context.max_tokens` ≤ 60 (sau S02 thì đọc bản sanitize — key `max_tokens` vẫn giữ).
- AC-2: user temperature 0.2 → snapshot `temperature == 0.2` (không phải system 0.7).
- AC-3: `AdvisorySession.token_budget` == budget enforcement (user budget), `budget_exceeded` khớp `hard_exceeded` ở cùng thời điểm.
- AC-4: user chưa set override → hành vi cũ nguyên (system).

**Test:** unit `_resolve` giữ nguyên + API test POST với cred `max_tokens_per_day=100, temperature=0.2` (mock celery) → assert snapshot.

**Gates:** check 0; test mới + `test_advisory_budget.py` regression PASS.

---

### S06 — Synthesis fail-loud + quota refund (F-08)

**Hiện trạng code thật:**
- `orchestrator.py:280-285`: `raise_for_status` + `res_data[...]` + `json.loads` không try/except → task `failed`.
- Sub-agent lỗi trả error-string làm "analysis" — xem `orchestrator.py:49-51` (verify khi implement; nếu dòng lệch ±5 do refactor thì grep `error-string|except.*analysis` để định vị).
- Quota `api_calls_used += 1` tại `views.py:477-478` trước generate; task fail (`tasks.py:159-167`) không hoàn.

**Yêu cầu:**
1. `orchestrator.py`: bọc synthesis POST+parse trong try/except → raise `AdvisorySynthesisError` có `provider_status/body_snippet` (cắt 500 ký tự, không log key).
2. `orchestrator.py run_async`: nếu cả 3 sub-agent đều là error-string (nhận diện bằng prefix `ERROR:` hoặc flag `ok=False` tùy code thực — đọc hàm `call_agent_async` trước khi code) → không gọi synthesis, trả `{'status':'failed','error':...}` để task mark `failed` thay vì `generated` rác.
3. `tasks.py` nhánh except: sau khi mark `failed`, hoàn quota — trừ `QuotaRecord.api_calls_used` của tenant kỳ hiện tại (tìm qua `record.user` → tenant owner; reuse `_manual_trigger_period` logic read-only, không tạo mới). Bọc hoàn-quota trong try/except riêng (fail-open, chỉ log).
4. Không retry tự động ở slice này (tránh đốt tiền gấp đôi).

**Tiêu chí nghiệm thu:**
- AC-1: provider trả non-JSON → record `failed`, `error_message` chứa `synthesis` + status code, không có `generated` rác.
- AC-2: 3 sub-agent lỗi → không gọi synthesis (mock `client.post` 0 lần ở synthesis) + record `failed`.
- AC-3: task fail → `QuotaRecord.api_calls_used` giảm đúng 1 so với lúc POST (hoàn).
- AC-4: task success → quota giữ nguyên (không hoàn nhầm).

**Test (`tests/test_advisory_tasks.py` — file đã tồn tại):** thêm 3 tests trên (mock orchestrator/client).

**Gates:** check 0; test mới + regression tasks/routes PASS.

---

### S07 — Bundle correctness nhỏ (F-01 + F-06 + F-07 + F-12)

**S07a — Budget Sum aggregate (F-01):** `views.py:156-160` đổi `sum(values_list)` → `aggregate(total=Sum('tokens_used'))`. AC: cùng dataset cho cùng tổng; test với 50 sessions cho cùng kết quả. File: `views.py:149-174`.

**S07b — Bỏ reset phá dữ liệu (F-06):** `tasks.py:19-45` `reset_daily_token_budgets` đang `.update(tokens_used=0)` toàn bảng (xóa lịch sử burn). Đổi thành **no-op có log** + comment `enforcement đã date-scoped (views.py:158)`; giữ beat schedule nguyên để không vỡ deploy. AC: chạy task → `tokens_used` các row giữ nguyên; log chứa `noop`. (Xóa hẳn task + beat là slice dọn dẹp riêng sau 1 sprint.)

**S07c — PUT validate (F-07):** `user_workspace/portfolio_analytics_views.py:638-654` thêm validators: `advisory_refresh_interval_hours` 1..168, `max_auto_refreshes_per_day` 0..24, `max_tokens_per_day` 1..100000 (400 khi vi phạm, pattern BE dataops C4). `temperature` giữ clamp `0..1` (`:658`). AC: PUT `max_tokens_per_day=-5` → 400; PUT đúng → 200.

**S07d — Khai báo setting (F-12):** `settings.py` thêm `ADVISORY_MANUAL_TRIGGER_COOLDOWN_SECONDS=60` + `ADVISORY_MANUAL_TRIGGER_USER_COOLDOWN_SECONDS=10` (S03) explicit + comment. AC: `grep` setting có trong file; `views.py:241` vẫn đọc đúng giá trị.

**Gates chung S07:** check 0; `makemigrations --check` clean (không migration mới); 4 nhóm test nhỏ PASS.

---

## Wave P1 — Frontend đúng (route + visual + data)

### S08 — Route shell (E1/C1/C2)

**Hiện trạng code thật:**
- `main.tsx:26` remap `ai-advisory → whale-advisory`; `main.tsx:111` route duy nhất; `main.tsx:167` catch-all → `/dashboard`.
- `pageRegistry.js:189-190` entry `ai-advisory → ShellAiAdvisoryPage` dead; `:258-259` `whale-advisory → WhaleAdvisoryPage` live.
- Link chết: `WhaleAdvisoryPage.tsx:89-92` build `/ai-advisory/shell?symbol=`, `WhaleAdvisoryBentoHeader.js:69-76` render khi `showShellHostLink` (đang `false` tại `WhaleAdvisoryPage.tsx:37,103`).
- Catalog: `routeCatalog.js:57-65` (`ai-advisory` baseline, capability `signals.ai_advisory.read`).

**Yêu cầu (chọn Option A — khuyến nghị):**
- Option A (khuyến nghị): xóa link chết — xóa `advisoryShellHostHref` (`WhaleAdvisoryPage.tsx:89-92`), prop `shellHostHref/showShellHostLink` ở cả page + `BentoHeader.js:10-16,69-76`; xóa registry entry `:189-190`; `ShellAiAdvisoryPage.tsx` giữ cho test/audit (không route).
- Option B (nếu product muốn giữ shell): thêm route `ai-advisory/shell` + catalog entry + capability + `check:shell` allowlist. Tốn hơn — chỉ làm khi PO xác nhận bằng văn bản.
- Mặc định làm Option A.

**Tiêu chí nghiệm thu:**
- AC-1: grep `ai-advisory/shell` trong `packages/web/src` = 0 hit (Option A).
- AC-2: click toàn page không điều hướng `/dashboard` bất ngờ (không còn link gãy).
- AC-3: `route-catalog-contract` test PASS (không vỡ catalog).

**Test:** `whale-advisory-route.component.test.tsx` mới — render page, assert không có link shell; assert `resolvePageComponent('ai-advisory')` mount Whale page.

**Gates:** `tsc 0`, `vitest` file mới PASS, `npm run check:shell` PASS.

---

### S09 — CSS glass (E2)

**Hiện trạng code thật:**
- 6 usages `neon-glass-panel/agentic-glow-cyan` trong `packages/web/src` (page `:107,147,158`, sidebar `:37`, command `:41`, header `:19`); 0 definition trong `packages/web/src/index.css` (đã verify Count=0); định nghĩa gốc chỉ ở legacy `frontend/src/index.css:731+`.
- Class thật sẵn có: `.glass/.glass-strong` (`index.css:261-271`), `.live-dot-pulse` (`:235-237`), `.panel-scrollbar` (`:520-539`).

**Yêu cầu:**
1. Thêm vào `packages/web/src/index.css` (khu vực glass, cạnh `:261-271`): định nghĩa `.neon-glass-panel` + `.agentic-glow-cyan` port từ legacy (`frontend/src/index.css:731-755` — copy nguyên chuỗi, chỉ đổi token màu nếu dùng hex hardcode → thay bằng `var(--color-*)`; nếu legacy dùng hex thì giữ hex ở slice này + TODO Wave 1 tokens).
2. Bổ sung light-mode: `[data-theme="light"] .neon-glass-panel` nền sáng (vì toàn advisory đang dark-only — xem S15R1, ở đây làm tối thiểu để không vỡ khi user bật light).
3. Không đổi className ở JSX (giữ nguyên 6 usages).

**Tiêu chí nghiệm thu:**
- AC-1: mở `/ai-advisory` ở dark → panel có blur+border+glow (so screenshot trước/sau).
- AC-2: bật `data-theme="light"` → panel nền sáng, chữ đọc được (không nền đen chữ đen).
- AC-3: không regression các trang khác dùng `.glass` (visual smoke dashboard + stock-detail).

**Test:** không test unit cho CSS; minh chứng = screenshot dark/light + `git diff index.css`.

**Gates:** `tsc 0`, `build` PASS, `check:shell` PASS.

---

### S10 — Skeleton + budget banner + quota max động (E3/E4/E5)

**Hiện trạng code thật:**
- Hook trả `loading` (`useWhaleAdvisoryData.js:63,167,174,264`) nhưng page không destructure (`WhaleAdvisoryPage.tsx:48-52`); render chỉ nhánh `error` (`:106-114`).
- Banner `AIAdvisoryWarningBanner.js:6-99` (props `budgetSoftWarning+budget`, đã i18n đủ `vi.js:5026-5036`) chỉ mount ở `StockDetailTabs.js:92-101`, không có ở route chính; footer page (`WhaleAdvisoryPage.tsx:204-229`) chỉ số thô.
- `StockDetailTabs.js:97` hardcode `fallbackQuotaMax:5`.

**Yêu cầu:**
1. `WhaleAdvisoryPage.tsx:48-52`: destructure thêm `loading`; khi `loading && items.length===0` render skeleton (3 khối pulse theo layout grid hiện tại — không đổi layout).
2. Mount `AIAdvisoryWarningBanner` ở page (trên grid, dưới header): props từ `refreshInfoMap[activeSymbol]` + `advisoryFallbackFlags` nếu có; `budget` map từ `refreshInfo` (`tokens_remaining_today` → suy ra used/budget nếu BE chưa trả — đọc `getAdvisoryAutoRefreshInfo` response thực tế trước khi code, field nào thiếu thì banner chỉ hiện khi đủ dữ liệu, không bịa số).
3. `StockDetailTabs.js:97`: `fallbackQuotaMax` lấy từ response (`fallback_quota_max` hoặc `manual_trigger.quota.limit` tại `views.py:522-534`) — fallback 5 chỉ khi BE không trả.

**Tiêu chí nghiệm thu:**
- AC-1: tải lần đầu (throttle network) → thấy skeleton, không panel rỗng.
- AC-2: user chạm 80% budget → banner `budgetSoftWarning` hiện ở route chính (text khớp `vi.js:5034`).
- AC-3: quota max hiển thị == số BE trả (không phải lúc nào cũng 5).

**Test:** `whale-advisory-banner.component.test.tsx` — mock hook loading → skeleton; mock budget warning → banner text; mock quota max động.

**Gates:** `tsc 0`, vitest mới PASS, `i18n:scan` 0 key mới thiếu.

---

### S11 — Confidence + locale + i18n batch-1 (E6/E7)

**Hiện trạng code thật:**
- `WhaleAdvisoryCommandPanel.js:124` render `${advisory.confidence || 0}%` (null → `0%`).
- `RecommendationCardExplainability.js:22-27` regex parse `%` từ summary khi thiếu số; `:29` stale logic.
- `normalizeAdvisoryItem` (`useWhaleAdvisoryData.js:16-35`) không chuẩn hóa thang 0-1 vs 0-100.
- `fmtTime` không locale (`WhaleAdvisoryPage.tsx:12-15` `toLocaleTimeString()` trần); `RecommendationHistoryMini.js:80` `toLocaleString()` trần — trái pattern `localeTag` (`AIAdvisoryWarningBanner.js:85`).

**Yêu cầu:**
1. Chuẩn hóa ở `normalizeAdvisoryItem`: `confidence` về thang 0-100 (nếu `0< x <=1` → `x*100` round; giữ `null` khi thiếu). CommandPanel `:124` + Explainability `:61` render `—` khi null (không `0%`).
2. `fmtTime` + history date: truyền `localeTag` từ `useI18n` (pattern banner `:85`), thay 3 chỗ: page `:12-15`, command panel `fmtCompact/fmtTime` tương ứng, history `:80`.
3. i18n batch-1 (không ôm đồm toàn bộ ~26 chuỗi — batch-2 ở S15): chuyển header labels (`BentoHeader.js:40,47,53-54,66-67,96`), 4 metric labels (`CommandPanel.js:104,123,129,135`), empty/loading (`HistoryMini.js:55`) sang `t('aiAdvisory.*')` + thêm keys VI/EN (đặt namespace mới `aiAdvisory`, không nhét vào `aiAdvisoryWarning`).

**Tiêu chí nghiệm thu:**
- AC-1: advisory không confidence → hiện `—`, không `0%`.
- AC-2: confidence 0.82 (thang 1) → hiện `82%`.
- AC-3: đổi EN → header/metric/empty đều EN (không còn VI cứng ở các chỗ đã migrate); `i18n:scan` 0 thiếu cho namespace mới.
- AC-4: date/time đổi theo locale (VI vs EN khác định dạng).

**Test:** unit `normalizeAdvisoryItem` (null/0.82/82) + render test EN locale cho header/panel.

**Gates:** `tsc 0`, vitest PASS, `i18n:scan` PASS.

---

## Wave P2 — Parity thương mại

### S12 — Backtest runner T+1/T+3/T+5 (G1)

**Hiện trạng code thật:** `RecommendationHistoryMini.js:20-95` chỉ hiển thị `outcome_t1/t3/t5` (có thể null) + footnote `:92`; không runner, không chọn khung.

**Yêu cầu:**
1. BE: endpoint mới `GET /portfolio/ai-advisory/<symbol>/backtest/?window=30|90` — tính hit-rate (dấu `outcome_tN` cùng dấu side), avg return T+1/T+3/T+5, N mẫu, từ record `generated` có outcome (không tính outcome null). Tận dụng field outcome sẵn (không thêm table mới).
2. FE: panel `AdvisoryBacktestPanel` trong tab hỗ trợ (cạnh telemetry/risk/history tại `WhaleAdvisoryPage.tsx:159-199`): chọn window, hiện hit-rate + avg T+N + N mẫu + disclaimer "kết quả quá khứ, không đảm bảo".
3. i18n `aiAdvisory.backtest.*` VI/EN.

**Tiêu chí nghiệm thu:**
- AC-1: symbol có ≥5 mẫu → hiện hit-rate % + avg 3 cột + N.
- AC-2: symbol chưa đủ mẫu → empty trung thực (không bịa 0%).
- AC-3: window 30 vs 90 cho số khác nhau đúng dữ liệu.

**Test:** BE 3 tests (đủ mẫu/thiếu mẫu/window); FE render 2 states.

---

### S13 — Export/share + compare đa mã (G2/G3)

**Yêu cầu:**
1. Export CSV advisory hiện tại + history theo symbol (tận dụng pattern SOC export limit ≤5000 đã có ở AGENTS Phase 3 Step 6): nút trong CommandPanel + HistoryMini; CSV gồm `created_at,symbol,side,confidence,summary,outcome_t1/t3/t5`.
2. Share-link: copy link `/ai-advisory?symbol=X` (đọc `activeSymbol` từ query khi load — hiện page chưa đọc query).
3. Compare: bảng chọn ≤5 symbol từ sidebar → cột side/confidence/whaleIntensity/updated; reuse `symbolStats` + `items`.
4. i18n `aiAdvisory.export/share/compare.*`.

**Tiêu chí nghiệm thu:** AC-1 CSV tải đúng nội dung + UTF-8 BOM (mở Excel không lỗi dấu); AC-2 paste share-link → mở đúng symbol; AC-3 compare 5 mã render đủ cột.

**Test:** FE export util (BOM + header) + compare render; BE không đổi (dùng API sẵn).

---

### S14 — Alert 2 chiều + order ticket (G4/G5)

**Yêu cầu:**
1. Tạo alert từ advisory: nút "Tạo cảnh báo" trong CommandPanel → prefill `symbol + ngưỡng confidence/whaleIntensity` → POST alert-center API sẵn (đọc adapter alert-center trước khi code, không tạo API mới nếu đã có).
2. Deep-link ngược: alert liên quan advisory hiện link "Xem tư vấn" (query `from=alert`).
3. Order ticket: nút "Đặt lệnh" mở ticket với prefill `symbol + giá tham chiếu (matched_value)`; không auto-submit (fail-closed — user xác nhận tay). Checklist `ActionChecklist.js:34-43` giữ nguyên vai trò log, không biến thành submit.
4. Ghi disclaimer rủi ro cạnh nút đặt lệnh.

**Tiêu chí nghiệm thu:** AC-1 tạo alert từ advisory thành công + alert mới có link ngược; AC-2 ticket prefill đúng symbol/giá; AC-3 không có auto-order khi chỉ bấm "Tiến hành" checklist.

---

### S15 — Explainability + SSE/poll-status + light-mode + a11y + confirm xóa

**Yêu cầu:**
1. Explainability (G6): mở rộng `RecommendationCardExplainability.js:75-97` — thêm khối feature attribution (đóng góp whale/darkFlow/technical % — lấy từ `AdvisoryComponent` technical/whale/recommendation nếu BE có, không bịa), input snapshot rút gọn, `ai_provider/ai_model` + thời gian generate.
2. Realtime thật (F-13): thêm `GET /core/v1/advisory/status/<advisory_id>/` (pending/generated/failed) HOẶC SSE `event:advisory` reuse pattern `soc_stream` throttle (`settings.py:275`); FE thay poll mù 4s×15 (`useWhaleAdvisoryData.js:219-228`) bằng poll-status có đích (dừng khi generated/failed, timeout 60s). Không poll fan-out `Promise.allSettled` vô hạn (`:137-139`) — thêm giới hạn 20 + cache 60s.
3. Light-mode (R1): toàn `components/advisory/*` đang `bg-slate-950/text-slate-200` cứng — thêm `dark:` variants hoặc token `data-theme` tối thiểu cho nền/chữ/border (theo Wave 1 tokens Entry 213).
4. a11y (R4): refresh `aria-label` (`BentoHeader.js:77-90`), tabs `role=tab/aria-selected` (`WhaleAdvisoryPage.tsx:160-180`), symbol `aria-current`, search `<label>`, thought-stream `aria-live`, bỏ emoji làm nội dung duy nhất.
5. Xóa có confirm (R7): `handleDeleteAdvisory` (`useWhaleAdvisoryData.js:245-260`) thêm `ConfirmModal` (pattern dự án) trước `DELETE`.
6. Bỏ default `BCM` cứng (`WhaleAdvisoryPage.tsx:90`, `Shell:64`) → empty state trung thực khi universe rỗng.
7. i18n batch-2: các chuỗi còn lại (`ActionChecklist.js:11-14,48,53,78,89`, `RiskModeSelector`, `TrustTelemetryPanel`, phases `AgenticThoughtStream.js:16-18`).

**Tiêu chí nghiệm thu:** AC-1 attribution hiện khi đủ dữ liệu, ẩn khi thiếu (không bịa); AC-2 refresh dừng đúng khi xong/fail; AC-3 light-mode đọc được; AC-4 axe/lighthouse a11y không lỗi critical mới; AC-5 xóa phải confirm; AC-6 universe rỗng → empty, không tự chọn BCM.

---

## Phản biện (reviewer checklist — áp cho mọi slice)

1. Đọc diff: có đúng file:line trong plan không? Có file ngoài phạm vi không (scope creep)?
2. Security: còn `user=` thiếu không? Còn secret nào vào DB/log không? (grep `api_key|secret` trong diff).
3. Tiền: còn đường nào đốt LLM/quota không qua budget+throttle không?
4. i18n: còn chuỗi VI/EN cứng mới không? (`i18n:scan` + grep `'[À-ỹ]'` trong file đổi).
5. Fail-closed: lỗi infra → user thấy lỗi trung thực, không advisory rác, không auto-order.
6. Test: AC nào chưa có test tương ứng? Test có assert hành vi (không chỉ render)?
7. Docs: ledger entry + release note (behavior change: 404 legacy, quota refund, route xóa) đã ghi chưa?

## Minh chứng xác thực (Definition of Done toàn plan)

- BE: `manage.py check` 0, `makemigrations --check` clean, toàn bộ `test_advisory_*.py + test_ai_cc_*.py` PASS (log đính kèm).
- FE: `npx tsc --noEmit` 0, `npm run build` PASS, `eslint` 0 errors ở file đổi, vitest files mới PASS, `npm run check:shell` PASS, `i18n:scan` 0 thiếu.
- Bằng chứng mỗi slice: `git diff --stat` + log test + (S09/S10/S15) screenshot dark/light.
- Ledger: 1 entry/slice hoặc 1 entry/wave (tối thiểu Entry 215 này + entry đóng Wave P0/P1/P2).

## Ước lượng (đội 1 BE + 1 FE)

- S01 0.5d · S02 0.5d · S03 1d · S04 0.5d · S05 1d · S06 1d · S07 1d → Wave P0 ~5d
- S08 0.5d · S09 0.5d · S10 1d · S11 1d → Wave P1 ~3d
- S12 2d · S13 2d · S14 2d · S15 3d → Wave P2 ~9d
- Tổng ~17 ngày-công (chưa gồm review + visual QA user).
