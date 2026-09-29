# AUDIT ALERT CENTER — VERIFICATION 2026-09-19 (thực thi `IMPLEMENTATION_PLAN_ALERT_CENTER_20260918.md` + vá phản biện `PHAN_BIEN_IMPLEMENTATION_PLAN_ALERT_CENTER_20260918.md`)

**HEAD thực thi:** xem `git log` (branch `dev`, tree gồm các file dưới). **Kết luận:** Phase 1 (7 slices) + Phase 2 (5 slices) + Phase 3 (6 slices) HOÀN TẤT code + tests; toàn bộ gates xanh.

## 1. Gates (output thật)

| Gate | Lệnh | Kết quả |
|---|---|---|
| tsc | `npx tsc --noEmit` (packages/web) | exit 0, 0 errors |
| build | `npm run build` | PASS 19.37s (chunk warn pre-existing) |
| jest | `npm test -- --no-coverage` | **17/17 suites, 235/235 tests** (DoD-2 đạt sau fix F2) |
| vitest | `npm run test:components` | **46 files / 229 tests PASS** (baseline 40/213 → +6 files/+16 tests) |
| lint | `npm run lint` | 0 errors, 3559 warnings (baseline 3549, +10 pre-existing rule `jsx-no-literals`) |
| i18n | `npm run i18n:scan` + grep parity | exit 0; 13 keys alertCenter mới đủ vi+en (xem §3) |
| BE | `manage.py test signal_intelligence` | **62 tests OK** (baseline 55 → +7) |
| BE check | `manage.py check` | 0 issues |

## 2. Slices đã thực thi (kèm vá C1-C7 từ phản biện)

- **F2 (DoD jest):** `AIAdvisorAlertPanel.js` += export `createAiAdvisorTranslator` (dùng chung `createTranslator`, không đổi hành vi) → suite FAIL pre-existing → 3/3 pass.
- **B4:** `delivery_service.py:67-68` `return queryset` → `queryset.none()` + test user rỗng (feed 0/summary 0, user1 unaffected).
- **B1:** `views.py:_apply_common_alert_filters` severity `severity__in` + family `Q_OR` (giữ ngữ nghĩa stale_quote cũ); helper test += param `severity` (vá F-PLAN-01); +2 tests union.
- **A2:** xóa `useEffect([filters])` (`AlertCenterPage.tsx:200-202`), `useAlertCenterFilters.ts` += `resetStatsPage` + reset trong 4 handlers; lane/timeframe handlers reset.
- **B3:** 3 views đọc `?lane=` (validate main/ai) + context payload lane động; `market.js` detail/ack += `params`; `useAlertCenterActions(refetch, lane)` + `event_id` fallback; test `?lane=ai` inline (vá F-PLAN-07); d.ts += params.
- **B2:** `normalizeAlert` += alert_id/triggered_at/direction/value (+export named để test); sort fallback `ts`; key `alert_id ?? event_id`.
- **E1:** 9 keys i18n (vá đếm 8→9); drawer xóa 2 field ảo + in-scope + recent_events(5); card `matched_value` fallback + `t(currency)` + `Math.round(confidence*100)%`.
- **P3-07:** `Coalesce(Sum(value), 0)` + test assert `== 0` (vá F-PLAN-05, JSON render float).
- **C1:** mới `useCoreQuery.ts` scope `['core-user']` + test scope (không tenant).
- **C2:** `useAlertCenterData.js` → 3 queries (feed 5s / summary+stats 30s) + test tiers (keys + intervals).
- **C3:** BE cursor test (5 alerts, 2 pages = 4 items, no dup) + FE `extraAlerts`/`extractFeedCursor`/`loadMore` + case 7 (cursor=abc append EXTRA).
- **C4:** metric aiSuggest chỉ lane ai; sort `value ?? matched_value`; FilterBar family theo lane (ai:2/main:6) + test 2+1 cases.
- **C5:** gộp vào `AlertCenterPage.component.test.tsx` 7 cases (vá F-PLAN-06: A2 là case 5).
- **D1:** `useAlertCenterRealtime` dispatch `alert-center-new` (bỏ batch đầu); Header badge `unseen` live (poll 30s, `enabled` khi auth) + click → `/alert-center` + toast 5s + sound (guard).
- **D2:** URL sync 2 chiều (`replaceState`; init validate lane/timeframe/date) + export CSV RFC4180 (`alert-center-YYYYMMDD.csv`, 12 cột). Deviate plan (pushState→replaceState): tránh spam history.
- **D3:** `setSessionDate`/`setAppliedSymbol` trong hook; FilterBar `<input type=date>` + reset khi đổi lane; BE đã nhận `session_date`.
- **D4:** drawer `aria-labelledby` + focus-trap Tab; feed `aria-live=polite` + `aria-busy`; card `tabIndex=0` + Enter (guard target).
- **D5:** cache LocMem/Redis (pickle-safe) 10s summary/stats, key gồm user+lane+filters+page.
- **D6 (vá F-PLAN-03):** scope `signals` 60/min (`settings.py`) + `SignalRateThrottle` gắn 10 views + log latency/count; test patch `THROTTLE_RATES` trực tiếp (bind lúc import, `override_settings` vô tác dụng) → 2×200 + 429.

## 3. i18n keys mới (13, đủ vi+en)

close, detailSummary, detailRecentEvents, detailInScope, detailNotInScope, currency, famStaleQuote, famAiAlert, loadMore, newAlert, viewAlert, sessionDate, exportCsv.

## 4. Re-trace 4 luồng B1-B4 (mapping test)

- B1 multi: `test_severity_multi_select_returns_union` + `test_alert_family_multi_select_returns_union` (BE 12 tests OK).
- B2 live-top: `normalizeAlert.component.test.ts` 2/2 + case 6 page test (LIVE1 đầu DOM).
- A2 pagination: case 5 (S8 ở trang 2 sau 700ms, không snap-back).
- B3 AI detail: `test_event_detail_respects_lane_param` (404→200→ack 200) + actions fallback (lane truyền từ page).
- Security B4: `test_user_without_watchlist_sees_no_alerts`; D6: `test_signals_throttle_enforced` (2×200→429).

## 5. Còn lại (manual, không làm được trong session này)

- Video/screenshot: live whale TOP <1s, AI drawer, pagination, bell badge/toast, share URL, CSV mở Excel, date picker, axe-core 0 critical, BE query-count −50%, 61 req/phút → 429 (đã chứng minh cơ chế bằng test 2/min).
- Deviations đã ghi: replaceState thay pushState (D2); test E1 assert keys thay text Việt (không LangProvider trong vitest); `normalizeAlert` export named (cộng thêm, không đổi hành vi).
