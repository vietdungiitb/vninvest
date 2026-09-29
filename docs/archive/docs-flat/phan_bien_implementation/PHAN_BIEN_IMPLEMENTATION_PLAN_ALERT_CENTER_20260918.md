# PHẢN BIỆN ĐỘC LẬP — `IMPLEMENTATION_PLAN_ALERT_CENTER_20260918.md`

**Ngày:** 2026-09-19 · **Phạm vi:** toàn văn plan 693 dòng vs codebase thật (`packages/web` + `packages/core/backend/src/signal_intelligence`) · **HEAD:** `4ace7c42` · **Kết quả:** KHÔNG viết code, chỉ nghiên cứu + đề xuất.

> **5 findings nghiêm trọng nhất:** (1) **F-PLAN-01 BLOCKER** — test B1/B3 gọi `_create_alert(severity=...)` nhưng helper không có param → `TypeError`, plan không yêu cầu sửa helper. (2) **F-PLAN-02 HIGH** — gate `jest 17/17 PASS` sai baseline: thực tế 17 suites / 232 tests, **1 suite FAIL** pre-existing (`AIAdvisorAlertPanel.i18n.test.js`, `SyntaxError: createAiAdvisorTranslator`), DoD-2 không thể đạt. (3) **F-PLAN-03 HIGH** — AC D6 "61 req/phút → 429" vô căn cứ: views không có `throttle_classes`, `soc_operator_read` 120/min không áp cho alert-center. (4) **F-PLAN-04 MEDIUM** — E1 ghi "8 keys" nhưng liệt kê 9; `i18n:scan` auto-add nên AC "grep parity 0" không thể đỏ → gate tự vá. (5) **F-PLAN-05 MEDIUM** — FAMILY MAP `stale_quote` mâu thuẫn nội bộ (bảng D2 OR top-level vs code B1 AND bên trong) + test P3-07 assert `'0.00'` sai kiểu (runtime trả float `0.0`).

---

## A. Bản đồ kiến trúc (file plan chạm → line_count | trách nhiệm | note)

| File | Lines | Trách nhiệm trong plan | Note |
|---|---|---|---|
| `packages/core/backend/src/signal_intelligence/views.py` | 709 | B1 filter multi, B3 lane param, B4 policy, P3-07 Coalesce | `_apply_common_alert_filters:141-178`; hard `lane='main'` tại `:362` (feed), `:530` (detail), `:555` (context), `:584` (ack); `Response(payload)` trực tiếp `:470`, serializer chỉ trong `extend_schema` `:489` |
| `packages/core/backend/src/signal_intelligence/delivery_service.py` | 196 | B4 `none()` | Leak tại `:67-68` (`if not user_symbols: return queryset`); `resolve_user_delivery_symbols` đọc watchlist+tracked+transaction `:20-33` |
| `packages/core/backend/src/signal_intelligence/tests/test_alert_center_api.py` | 133 | B1/B3/B4 tests mới | Helper `_create_alert` `:23-39` **không có param `severity`** — gốc F-PLAN-01 |
| `packages/core/backend/src/signal_intelligence/models.py` | 325 | FAMILY MAP đối chiếu | `AlertTypeChoices` `:16-22`: whale/dark_flow/signal/system/ai_alert/ai_suggest — không có price_shock/stale_quote → map Q là đúng hướng |
| `packages/core/backend/src/signal_intelligence/urls.py` | — | Routes B3/C3 | `alert-center/feed|summary|symbol-stats|events/<uuid>|ack|symbols/<str>/context` + `ai-alerts/*` (grep `:6-15`); total lines CHƯA XÁC MINH |
| `packages/core/backend/src/vninvest_core/pagination.py` | 59 | C3 cursor | `AlertCursorPagination:42-43` (`ordering='-triggered_at'`, `page_size_query_param='page_size'`); feed override tuple `:31 views.py` |
| `packages/core/backend/src/vninvest_core/settings.py` | 747 | D6 rate-limit | `DEFAULT_THROTTLE_CLASSES:246-249` (PAT+User); `user` 1000/hour prod `:251`; `soc_operator_read` 120/min `:259` — **không view alert-center nào reference** |
| `packages/web/src/pages/AlertCenterPage.tsx` | 356 | A2 xóa effect, B2 sort/key, B3 truyền lane, C3 load-more, C4 metric | `useAlertCenterActions(refetch)` no-lane `:103`; dedupe `alert_id ?? event_id` `:111/:115`; sort guard `0` `:126-128`; `useEffect([filters])` reset page `:200-202`; key chỉ `alert_id` `:315` |
| `packages/web/src/hooks/useAlertCenterFilters.ts` | 38 | A2 `resetStatsPage` | `sessionDate` dead `:7`; return object literal `:30-38` (mới mỗi render — đúng P0-2) |
| `packages/web/src/hooks/useAlertCenterData.js` | 108 | C1 migrate query, C2 tách tiers | `join(',')` `:45-46`; `Promise.all` 3 calls `:49-55`; `useTenantAdminQuery(key,"",{...})` `:34-37` |
| `packages/web/src/hooks/useAlertCenterActions.ts` | 96 | B3 lane + `event_id` fallback | Guard `!alert_id\|\|!symbol` `:22`, ack guard chỉ `alert_id` `:44`; signature `(refetch)` `:12` |
| `packages/web/src/hooks/useRealtimeFeedCore.js` | 1260 | B2 normalize 4 field | `normalizeAlert:238-257` thiếu triggered_at/alert_id/value/direction; `readEventField:49` đã đọc `payload.data` |
| `packages/web/src/hooks/useAlertCenterRealtime.js` | 50 | B2 dedupe | Key `event_id \|\| symbol-ts` `:27`, sort chỉ `ts` `:32-36` — không `triggered_at` |
| `packages/web/src/components/alert-center/FilterBar.tsx` | 143 | C4 family động | `FAMILY_OPTIONS` const module-scope 6 options `:24-31` (thiếu stale_quote/ai_alert); đã nhận `lane` prop `:34` ✓ |
| `packages/web/src/components/alert-center/AlertCard.tsx` | 212 | E1 currency/confidence | Hard `"VND"` `:131`, `${confidence}%` (0-1) `:158` |
| `packages/web/src/components/alert-center/DetailDrawer.tsx` | 105 | E1 field thật | Field ảo `average_severity/threshold_strategy` `:97-98`; `role=dialog`+Escape+focus đã có `:19-32/:41-42` |
| `packages/web/src/components/alert-center/StatsPanel.tsx` | 94 | A2 test target | Nút `«‹›»` `:55-89` — `›` unique cho `getByRole` ✓ |
| `packages/web/src/adapters/core/market.js` | 541 | B3 params | detail `:87-90` và ack `:111-114` **không** params; context `:98-104` **có** params — spec B3 đúng |
| `packages/web/src/i18n/vi.js` / `en.js` | 5382 / 5366 | E1 8/9 keys | Block `alertCenter` `vi:5272-5379` / `en:5256-5363`; 9 keys mới grep 0 match cả 2 file |
| `packages/web/jest.config.js` + `package.json` | — | Gates | jest `testMatch **/*.test.*`, ignore `.component.test` + vninvestcharts; scripts `test/test:components/lint/i18n:scan/build` |

## B. Luồng dữ liệu đã trace (2 use-case)

**B-1. Multi-select severity (B1):** FilterBar toggle → `toggleSeverity` (filters) → `useAlertCenterData.js:45` `join(',')` → `GET /core/v1/signals/alert-center/feed?severity=high,low` (`urls.py:6`) → `AlertCenterFeedView.get_queryset` `views.py:355-363` → `_apply_common_alert_filters:141` → `:177-178` `filter(severity=severity)` exact (BUG: chỉ match literal `"high,low"`) → sau fix `severity__in` → delivery policy → FE. Trace khớp spec B1 `plan:148-170`.
**B-2. AI-lane detail 404 (B3):** AlertCard Chi tiết → `handleLoadDetail` `useAlertCenterActions.ts:21-29` (không lane, không `event_id` fallback, guard `:22`) → `market.js:87-90` (không params) → `GET /events/{id}` → `AlertCenterEventDetailView.get` `views.py:528-535`, hard `lane='main'` `:530` loại `ai_suggest` → 404 → sau fix đọc `?lane=` + FE fallback. Trace khớp spec B3 `plan:275-323`.

## C. CONTRADICTIONS (plan vs code)

| # | Plan (file:line) | Thực tế (file:line) | Tác động |
|---|---|---|---|
| C1 | `plan:53` + DoD-2 `plan:665` "jest 17/17 → PASS" | 17 suites / **232 tests pass / 1 suite FAIL** `AIAdvisorAlertPanel.i18n.test.js` (`SyntaxError: ... no export 'createAiAdvisorTranslator'`, pre-existing) | Gate sai baseline; DoD-2 không đạt được nếu không fix ngoài scope |
| C2 | `plan:176-195` test B1 gọi `_create_alert(severity='high'/'low',...)` | Helper `test_alert_center_api.py:23-39` chỉ `(symbol,alert_type,source_ref)`, severity hardcode HIGH | `TypeError` ngay khi chạy; cả 2 test B1 đỏ |
| C3 | `plan:418` "thêm 8 keys" | Liệt kê **9** keys; `i18n:scan` auto-add (verified exit 0 + tự thêm keys khác) | Đếm sai (nhỏ); AC "grep parity 0" (`plan:465`) không thể đỏ → gate tự vá, vô nghĩa phát hiện thiếu key |
| C4 | `plan:634-638` AC "61 req/phút → 429" | Views **0** `throttle_classes`; `soc_operator_read` 120/min (`settings.py:259`) không áp dụng; default `user` 1000/hour prod | AC FAIL ở hiện trạng; phải thêm scope throttle mới (đúng tinh thần "kiểm tra nếu chưa có" nhưng AC viết như đã có) |
| C5 | `plan:39` stale_quote `(system AND stale_quote:%) OR freshness='stale'` | Code B1 `plan:156-157` = `Q(SYSTEM) & (startswith OR freshness)` (khớp code hiện `views.py:170-174`) | Lệch ngữ nghĩa cho alert non-system bị stale; bảng MAP phải sửa theo code |
| C6 | `plan:492` assert `total_value == '0.00'` | View trả `Response(payload)` dict trực tiếp (`views.py:470`) → DRF JSONEncoder render Decimal thành float `0.0` | Test đỏ; assert phải là `== 0`/`0.0` hoặc đi qua serializer |
| C7 | `plan:507` `useCoreQuery(queryKey, options)` | Callsite `useAlertCenterData.js:34-37` `useTenantAdminQuery(key,"",{...})` (3 tham số) | Phải adapt 3 callsites khi migrate (note thực thi, LOW) |

## D. Findings

- **[F-PLAN-01] ERROR | BLOCKER | `plan:176-195` + `test_alert_center_api.py:23-39` | Test B1 dùng kwarg `severity` không tồn tại → `TypeError` | Cả slice B1 không chạy được | Fix: thêm `severity='high'` param vào helper (giữ default HIGH để 5 test cũ xanh), rồi mới chạy 2 test mới.**
- **[F-PLAN-02] ERROR | HIGH | `plan:53,665` | jest baseline đỏ 1 suite pre-existing | Mọi PR bị kẹt DoD-2 | Fix: hoặc sửa `AIAdvisorAlertPanel.i18n.test.js` trước Phase 1, hoặc DoD ghi rõ "17 suites, trừ 1 FAIL pre-existing đã ghi nhận".**
- **[F-PLAN-03] ERROR | HIGH | `plan:634-638` + `settings.py:259` + views 0 throttle | AC rate-limit viết như hành vi hiện có | D6 verify thất bại | Fix: D6 thành task "thêm scope `signals 60/min` + `throttle_classes` vào 9 views", AC giữ 61→429.**
- **[F-PLAN-04] GAP | MEDIUM | `plan:418,465` | 8-vs-9 keys; gate tự vá | E1 AC không phát hiện được thiếu key | Fix: sửa "9 keys"; AC đổi thành "grep key trong code vs locale trước khi scan", hoặc `i18n:scan --fail-on-missing` nếu config hỗ trợ.**
- **[F-PLAN-05] GAP | MEDIUM | `plan:39` vs `plan:156-157` + `plan:492` | MAP stale_quote + assert `'0.00'` sai | Ngữ nghĩa filter + test đỏ | Fix: MAP theo code (AND bên trong); assert `== 0`.**
- **[F-PLAN-06] RISK | LOW | `plan:112-123` (A2) vs C5 `plan:595-607` | Hai slice cùng tạo/sửa `AlertCenterPage.component.test.tsx` | Conflict nội dung test | Fix: gộp — A2 là case #5 của C5, một file duy nhất 6 cases.**
- **[F-PLAN-07] RISK | LOW | `plan:337` `QUERY_STRING='lane=ai'` | Hợp lệ (extra→WSGI environ) nhưng lạ | Người đọc tưởng API sai | Fix: dùng inline `?lane=ai` trong path.**

**Điểm plan đúng (giữ nguyên):** line refs B4 (`delivery_service.py:67-68`), B1 filter (`views.py:141-178`), B3 3 views (`:530/:555/:584`) + adapters (`market.js:87-114`), A2 (`AlertCenterPage.tsx:200-202`, filters `:30-38`), E1 (drawer `:97-98`, card `:131/:158`, filterbar `:24-31`, i18n blocks), B2 (`normalizeAlert:238-257`), thứ tự P0-6>P0-3>P0-2>P0-5>P0-4>P3-07, D11 giữ `sessionDate` dead, D12 downgrade P3-07. ~85% spec khớp code.

## E. Quality gates audit (chạy thật phiên này)

| Gate | Plan claim | Thực tế |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | PASS (qua `npm run build` = `tsc && vite build`, build PASS) |
| `npm run build` | 32.79s PASS | **PASS 31.34s** (chunk >1000kB warn pre-existing) |
| `npm test -- --no-coverage` | 17/17 PASS | **17 suites, 232 tests pass, 1 suite FAIL** (`AIAdvisorAlertPanel.i18n.test.js` SyntaxError `createAiAdvisorTranslator` — pre-existing, ngoài scope alert-center) |
| `npm run test:components` | 40/213 PASS | **40 files / 213 tests PASS (19.97s)** — khớp |
| `manage.py test signal_intelligence` | 55 tests OK | **55 tests OK (28.2s)** — khớp (redis warnings + 1 log 404 ack hợp lệ, vô hại) |
| `manage.py check` | 0 issues | **0 issues** — khớp |
| `npm run lint` | 0 errors | **0 errors, 3549 warnings** pre-existing (lần 1 timeout 180s, pass ở 600s) |
| `npm run i18n:scan` | exit 0, grep là truth | **exit 0**, auto-add keys khác (tree `git diff` i18n sạch) — khớp + củng cố F-PLAN-04 |

## F. Câu hỏi cần làm rõ

1. `coreApiAdapter.getAlertCenterFeed({...q, cursor})` (C3 FE, `plan:562`) có passthrough mọi key thành query string không? **CHƯA XÁC MINH** adapter — nếu whitelist params thì C3 FE kẹt.
2. Có fix `AIAdvisorAlertPanel.i18n` FAIL pre-existing trước Phase 1 (để DoD-2 đạt được), hay chấp nhận baseline đỏ có ghi nhận?
3. Scope throttle D6 chọn `signals 60/min` riêng hay tái dùng `soc_operator_read` 120/min (đổi AC tương ứng)?
4. `detailAvgSeverity/detailThreshold` (đã tồn tại `vi:5334-5335`/`en:5318-5319`) có xóa khỏi locale sau khi xóa drawer `:97-98`, hay giữ cho tương thích?

## G. Đánh giá tổng thể

**Implementable — CÓ, sau khi vá 7 điểm C1-C7, không blocker kiến trúc.** Thứ tự vá trước khi code: (1) helper `severity` (F-PLAN-01, 5 phút), (2) chốt DoD jest (F-PLAN-02), (3) định nghĩa scope throttle D6 (F-PLAN-03), (4) sửa MAP stale_quote + assert P3-07 + đếm keys E1 (F-PLAN-04/05), (5) gộp A2 vào C5 + inline `?lane=` (F-PLAN-06/07). Ưu tiên thực thi giữ nguyên plan: B4 → B1 → A2 → B3 → B2 → E1 → P3-07 → C1-C5 → D1-D6. Rủi ro tồn dư duy nhất ngoài plan: suite jest FAIL pre-existing (không thuộc alert-center, nhưng kẹt DoD nếu không xử lý ở F2.
