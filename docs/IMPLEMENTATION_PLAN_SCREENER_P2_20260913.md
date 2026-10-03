# IMPLEMENTATION PLAN — Screener `/screener` P2 UX + lịch + history server

> Ngày lập: 2026-09-13 · Nguồn: `docs/IMPLEMENTATION_PLAN_SCREENER_P1_20260913.md` §10 + `docs/AUDIT_SCREENER_P1_FULL_20260913.md` §G + code sau P1 (HEAD `4da08faa`, ledger Entry 78).
> Phạm vi: **P2 UX** — URL share, React Query, backtest v2 + history server (Q5), lịch quét + alert (Q6), thêm vào watchlist/tạo alert từ dòng, cột persist, mobile/a11y. Không sửa công thức chỉ báo (Q3 → P3), không đụng P1 contract (sort/paging/cache/async đã ổn định).
> Nguyên tắc: mỗi sub-step `tsc` (FE) / `manage.py test user_workspace` (BE) + `npm run build` cuối step; mọi thay đổi 1 ledger entry; contract additive-only.

## 0. Quyết định cần chốt trước khi code (kiểu Entry 64/73 của P0/P1)

| # | Tham số | Đề xuất mặc định | Nếu đổi thì ảnh hưởng |
|---|---|---|---|
| D8 | URL share | `?rule=<id>&run=1&sort=&order=&page=` (rule → auto-open editor, run=1 → auto-run sau khi load). Không lưu `scanParams` vào URL khi chưa run (tránh URL dài). | Lưu thêm `limit/include_ai` → URL dài nhưng share chính xác hơn. |
| D9 | React Query key | `['screener','rules', tenant_id]` + `['screener','run', ruleId, scanParams]` (dùng `useTenantAdminQuery` pattern, `tenant-changed` invalidation đã có `QueryProvider.tsx`). Stale 30s, không refetch on window focus cho run (đắt). | Stale ngắn hơn → nhiều refetch; dài hơn → dữ liệu cũ sau khi sửa rule (đã có `updated_at` trong cache key BE nên an toàn). |
| D10 | History server quota | `MAX_HISTORY_PER_USER=100` (giữ 20 gần nhất ở FE như `screenerHistoryStore.ts:2`, BE giữ 100, API `GET /screener/history/?page=&limit=&rule_id=`). Quá quota → xóa oldest. | Thấp hơn → mất history cũ; cao hơn → DB phình (mỗi entry ~ rows×~30 keys, 100×47 rows×2KB ≈ 9MB/user). |
| D11 | Lịch quét (Q6) | `ScreenerSchedule` per-user: `cron` `0 18 * * 1-5` (sau đóng phiên 15:00 + 3h, theo Q6), `is_active` toggle, `rule_ids: int[]` (1..n), `notify_channels: ['in_app','email']`. Beat task `screener_scheduled_run` chạy mỗi 5 phút, check `due = cron.now?` → enqueue `run_screener_scan_task` từng rule (reuse P1.4 snapshot). | Cron linh hoạt hơn → UI phức tạp; 1 lịch/user đơn giản hơn n lịch/rule. |
| D12 | Watchlist/alert từ dòng | Watchlist: gọi `workspace.js:addWatchlistItem(watchlistId, symbol)` — cần picker watchlist (default đầu tiên). Alert: `createPriceAlert({symbol, condition, target_price: close, cooldown: 300})` — prefill close hiện tại, cho sửa. | Không picker → UX kém (thêm vào watchlist nào?). |
| D13 | Cột persist | `localStorage` `vninvest_screener_columns_v1` (như history) + sync `userconfig` nếu sau này cần cross-device (để P2, không BE). | Lưu BE → cross-device nhưng thêm API. |
| D14 | Mobile/a11y | Table `overflow-x: auto` đã có `ScreenerResultsTable.tsx:301`, thêm `aria-label` cho picker/pager/sort header, `role="table"` + keyboard sort (Enter/Space). Breakpoint 768: stack filterBuilder 1 col. | Không làm → a11y fail. |

## 1. Hiệu chỉnh audit ↔ code (đã đọc lại code ngày 2026-09-13, plan này là chuẩn)

1. **History hiện tại** `screenerHistoryStore.ts:1-42` dùng `localStorage` `vninvest_screener_history_v1` `MAX_RUNS=20`, `ScreenerPage.tsx:204-218` `saveHistoryEntry` + `ScreenerHistory.tsx:40-266` hiển thị `winRate/buildTrades` (client tính từ `currentPrices` hoặc `later close`). Q5 yêu cầu server theo `user+tenant` + quota → P2.3 sẽ **thay** localStorage bằng BE, giữ fallback localStorage khi BE chưa có (tương thích).
2. **ScreenerPage hiện tại** `ScreenerPage.tsx:120-151` dùng `useState` + `loadRules` `useCallback` + `useEffect`, chưa React Query. `QueryProvider.tsx` đã bọc `main.tsx`, `useTenantAdminQuery` đã dùng cho 13 TenantAdmin pages — P2.2 chỉ áp dụng pattern, không tạo QueryProvider mới.
3. **Watchlist/alert đã có API** `workspace.js:89-283` `getWatchlists/addWatchlistItem` + `getPriceAlerts/createPriceAlert` — P2.5 chỉ thêm nút trong `ScreenerResultsTable` row, không tạo endpoint mới.
4. **Cột picker** `ScreenerResultsTable.tsx:124-128` `visible` state + `setVisible`, `COLUMNS` 26 cols — P2.6 chỉ thêm `localStorage` persist (đọc lúc init, ghi khi toggle), không đổi COLUMNS.
5. **URL hiện tại** không có `useSearchParams` — P2.1 thêm `react-router-dom` `useSearchParams` (đã dùng cho `/watchlist`? grep `useSearchParams` trong `src/pages` → CHƯA, cần thêm).
6. **Throttle đã tách** `ScreenerRunThrottle` 30/min + `ScreenerStatusThrottle` 60/min (Entry 78) — P2 schedule task sẽ dùng cùng `ScreenerRunThrottle` hay bypass (beat không phải user) — quyết định: schedule task không qua throttle (gọi `_compute_scan` trực tiếp, không `POST /run/`).
7. **Cache đã có** `screener:scan:{user}:{rule}:{updated_ts}:{session}:{include_ai}` Option B — P2 schedule sẽ warm cache sau mỗi run (đã có trong task).

## 2. P2.1 — URL share (`?rule=&run=&sort=&order=&page=`)

**Hiện trạng:** không có URL state, F5 mất rule đang xem, không share được (plan §10 P2).

**Thiết kế (FE `ScreenerPage.tsx` + `ScreenerResultsTable.tsx`):**
- (a) `useSearchParams` đọc `rule`, `run`, `sort`, `order`, `page`, `limit`. `rule` là `ScreenerRule.id` (int), validate `Number.isInteger` + `rules.find(r=>r.id===rule)` → nếu không tồn tại → ignore + toast “Bộ lọc không tồn tại”.
- (b) Khi `rule` hợp lệ → `setEditing(rule)` hoặc `setActiveRule(rule)` + `setScanParams` từ URL (nếu có `sort/order/page/limit` thì dùng, không thì DEFAULT). Nếu `run=1` → auto `runWithParams(rule, scanParams)` sau khi `loadRules` xong (đợi `rules.length>0`).
- (c) Khi user đổi rule (click Run / sort / page) → `setSearchParams({rule: activeRule.id, run: 1, sort, order, page, limit}, {replace:true})` (dùng `replace` để không spam history, trừ lần đầu `run=1` dùng `push`).
- (d) Khi user đóng editor / clear results → `setSearchParams({}, {replace:true})` (xóa URL).
- (e) Không lưu `include_ai` vào URL (ít dùng), giữ default 1.

**Yêu cầu:**
- [ ] R2.1.1 Mở `/screener?rule=3` → editor mở rule 3, không auto-run.
- [ ] R2.1.2 Mở `/screener?rule=3&run=1&sort=close&order=asc&page=2` → auto-run với sort/page đúng, bảng hiện `page 2`.
- [ ] R2.1.3 `?rule=9999` (không tồn tại) → ignore, không 404, toast.
- [ ] R2.1.4 Sort header click → URL `sort`/`order`/`page=1` đổi và `replace`, không tạo entry history mới cho mỗi click (back 1 lần về list).

**Minh chứng:** FE component test `ScreenerUrlShare.component.test.tsx` (mock `useSearchParams`).

## 3. P2.2 — React Query cho screener (tương tự TenantAdmin 13/13)

**Hiện trạng:** `ScreenerPage.tsx:153-165` `loadRules` + `setRules` thủ công, không cache, không `tenant-changed` invalidation.

**Thiết kế (FE `ScreenerPage.tsx`, reuse `providers/QueryProvider.tsx` + `hooks/useTenantAdminQuery.ts`):**
- (a) `const {data: rules, isLoading, error} = useTenantAdminQuery({queryKey:['screener','rules'], queryFn:()=>coreApiAdapter.getScreenerRules(), staleTime:30_000})` (tenant scope như `useTenantAdminQuery` đã làm).
- (b) `create/update/delete` dùng `useTenantAdminMutation` + `onSuccess: invalidateTenantAdminQueries(queryClient, ['screener','rules'])` (đã có `QueryProvider` listener `tenant-changed`).
- (c) `run` giữ `useState` cho `results/running/jobInfo` (không query, vì POST + cache Option B + 202 polling đã phức tạp, giữ `runWithParams` như cũ, chỉ bọc `isPending` cho nút Run).
- (d) Giữ fallback `coreGet` khi `useTenantAdminQuery` fail? Không — RQ đã có `error` state, hiển thị banner như cũ.

**Yêu cầu:**
- [ ] R2.2.1 `GET /screener/rules/` gọi 1 lần, chuyển tab rồi quay lại không refetch trong 30s (staleTime).
- [ ] R2.2.2 Đổi tenant (dispatch `tenant-changed`) → `['screener','rules']` invalidate, fetch lại.
- [ ] R2.2.3 Tạo rule xong → list tự refetch, không cần `loadRules()` thủ công.

**Minh chứng:** `ScreenerPage.query.test.tsx` (mock `coreApiAdapter.getScreenerRules` + `QueryClientProvider`).

## 4. P2.3 — Backtest v2 + history server (Q5)

**Hiện trạng:** `screenerHistoryStore.ts:1-42` localStorage 20 runs, `ScreenerHistory.tsx:40-266` tính `winRate` client từ `currentPrices` hoặc `later close`. Mất khi đổi máy, không quota server, không filter theo rule.

**Thiết kế (BE `user_workspace/models.py` + `portfolio_analytics_views.py` + `urls.py`, FE `ScreenerHistory.tsx`):**
- (a) Model mới `ScreenerRunHistory` (`user, tenant, rule, rule_name, run_at, matched_count, total_scanned, window_days, session_date, matched: JSON[HistoryRow], params: JSON{sort,order,page,limit,include_ai}`) — `ordering -run_at`, `Index(['user','tenant','-run_at'])`, `Index(['rule','-run_at'])`. `MAX_HISTORY_PER_USER=100` (D10).
- (b) `POST /screener/history/` (tạo sau mỗi `POST /screener/rules/<id>/run/` 200 — gọi trong `post` sau `payload` build, không block response: `ScreenerRunHistory.objects.create(...)` + `if count>100: delete oldest`). `GET /screener/history/?rule_id=&page=&limit=&from=&to=` — paginated, `DELETE /screener/history/<id>/` + `DELETE /screener/history/` (clear all).
- (c) FE `ScreenerHistory.tsx` → `useTenantAdminQuery(['screener','history', ruleId, page])` fetch BE, fallback `loadScreenerRuns()` khi BE 404/empty (tương thích). `ScreenerPage.tsx:204-218` `saveHistoryEntry` → `coreApiAdapter.createScreenerHistory({ruleId, ruleName, rows})` + vẫn `saveScreenerRun` local để fallback.
- (d) Backtest v2: BE tính `winRate` server từ `DailyPrice` (close sau `run_at` + 5/20 ngày, như `buildTrades` hiện tại nhưng dùng DB, không `getDailyPrices` từng symbol client). `GET /screener/history/<id>/backtest/?horizon=5,20` trả `winRate, wins, losses, trades`. FE hiển thị như cũ.

**Yêu cầu:**
- [ ] R2.3.1 Chạy rule 21 lần → BE giữ 100, FE `GET /history/?limit=20` trả 20 mới nhất, `page=2` trả 20 tiếp.
- [ ] R2.3.2 Đổi máy (xóa localStorage) → history vẫn đủ từ BE.
- [ ] R2.3.3 `GET /history/<id>/backtest/?horizon=5` trả `winRate` khớp `buildTrades` cũ trên cùng fixture (khớp 100% với `currentPrices` mock).

**Minh chứng:** BE `test_screener_history.py` (5 tests: create+quota+list+backtest+tenant-isolation) + FE `ScreenerHistory.query.test.tsx`.

## 5. P2.4 — Lịch quét + alert (Q6)

**Hiện trạng:** không có lịch, user phải click `Chạy` mỗi ngày (Q6 yêu cầu lịch sau đóng phiên + thông báo mã mới khớp).

**Thiết kế (BE `user_workspace/models.py` + `screener_tasks.py` + `queue_policy.py`, FE `ScreenerSchedulePage.tsx`):**
- (a) Model `ScreenerSchedule` (`user, tenant, name, rule_ids: int[], cron: str (default "0 18 * * 1-5"), is_active: bool, notify_channels: str[] (in_app,email), last_run_at, next_run_at, created_at`). Validate `rule_ids` tồn tại + `cron` via `croniter`.
- (b) API `GET/POST /screener/schedules/` (list/create), `PUT/DELETE /screener/schedules/<id>/` (update/delete), `POST /screener/schedules/<id>/run-now/` (manual trigger).
- (c) Beat task `screener_scheduled_run` (mỗi 5 phút, queue `manual_on_demand`): `due = croniter(cron, last_run_at).get_next(datetime) <= now` → với mỗi `rule_id` → `run_screener_scan_task.delay(snapshot, session_date=today, include_ai=1, job_id=new)` (reuse P1.4, snapshot chống drift). Sau run, so `matched` kỳ trước (từ `ScreenerRunHistory` latest) → tìm `new_symbols = matched_now - matched_prev` → nếu có → tạo `UnifiedAlert` hoặc `Notification` (dùng `signal_intelligence` hoặc `support` channel) với `in_app` + `email` (qua `commercial` quota).
- (d) Phân biệt user-schedule vs SOC global: `ScreenerSchedule.tenant` nullable? User-schedule `tenant=user's tenant`, SOC global `tenant=None` (chỉ staff). Entry 64 Q6 đã chốt: “phân biệt user-schedule vs SOC global” → giữ `tenant` FK, global `is_global=True` riêng (hoặc `tenant=None`).
- (e) FE `ScreenerSchedulePage.tsx` (hoặc tab trong `ScreenerPage`) — list schedules + form `cron` (preset `18:00 T2-T6` + custom) + multi-select rules + toggle active + `Run now`.

**Yêu cầu:**
- [ ] R2.4.1 Tạo schedule `18:00 T2-T6` cho rule 1, `run-now` → tạo `ScreenerRunHistory` 1 entry, `new_symbols` đúng.
- [ ] R2.4.2 Beat due → enqueue task, không qua `ScreenerRunThrottle` (beat bypass, gọi `_compute_scan` trực tiếp).
- [ ] R2.4.3 Tắt `is_active` → beat không chạy.

**Minh chứng:** BE `test_screener_schedule.py` (4 tests: crud+due+new_symbols+tenant-isolation) + FE `ScreenerSchedule.component.test.tsx` (mock `getScreenerSchedules`).

## 6. P2.5 — Thêm vào watchlist / tạo alert từ dòng + cột persist

**Hiện trạng:** `ScreenerResultsTable.tsx:343-372` mỗi row là link `/stocks/<symbol>` + 26 cols, không có action.

**Thiết kế (FE `ScreenerResultsTable.tsx` + `ScreenerPage.tsx`):**
- (a) Thêm cột `actions` (không sort) với 2 nút: `+ Watchlist` (icon `Bookmark`) + `+ Alert` (icon `Bell`). Click → `coreApiAdapter.addWatchlistItem(defaultWatchlistId, symbol)` (lấy `getWatchlists` đầu tiên, hoặc prompt chọn) + toast; Alert → `createPriceAlert({symbol, condition: 'ABOVE', target_price: row.close, cooldown:300})` + modal cho sửa condition/price.
- (b) Cột persist: `ScreenerResultsTable.tsx:124-128` `visible` init từ `localStorage.getItem('vninvest_screener_columns_v1')` (JSON `Record<string,boolean>`), mỗi `setVisible` → `localStorage.setItem`. Không BE (D13).
- (c) Picker đã có `ScreenerResultsTable.tsx:274-298`, chỉ thêm persist.

**Yêu cầu:**
- [ ] R2.5.1 Click `+ Watchlist` trên row AAA → `POST /workspace/watchlists/<id>/items/` với symbol AAA, toast success.
- [ ] R2.5.2 Click `+ Alert` → modal prefill `symbol=AAA, price=20`, save → `POST /stock-management/price-alerts/` 201.
- [ ] R2.5.3 Toggle cột `pe_ratio` off → reload → vẫn off (localStorage).

**Minh chứng:** `ScreenerWatchlistAlert.component.test.tsx` (mock `addWatchlistItem` + `createPriceAlert`).

## 7. P2.6 — Mobile / a11y pass

**Hiện trạng:** `ScreenerResultsTable.tsx:301` `overflowX: auto` đã có, nhưng sort header thiếu `aria-sort`, `tabIndex`, keyboard.

**Thiết kế (FE `ScreenerResultsTable.tsx` + `ScreenerPage.tsx` + `ScreenerFilterBuilder.tsx`):**
- (a) Table header `th onClick →` thêm `role="columnheader" aria-sort={serverMeta.sort===key ? (order==='asc'?'ascending':'descending') : 'none'} tabIndex=0 onKeyDown Enter/Space → handleSort`.
- (b) Pager buttons đã có `disabled`, thêm `aria-label="Previous page"` / `Next`.
- (c) Breakpoint 768: `ScreenerPage.tsx:434` `pageStyle maxWidth 1200` → thêm `@media (max-width: 768px) { flexDirection: column }` cho `RuleEditor` (đã flex), `FilterBuilder` grid `repeat(auto-fit, minmax(220px,1fr))` đã responsive, table `minWidth 900` giữ scroll.
- (d) Lighthouse a11y 90+ (chạy `npm run build && npx lighthouse http://localhost/screener --only-categories=accessibility`).

**Yêu cầu:**
- [ ] R2.6.1 Tab → focus sort header → Enter → sort đổi, `aria-sort` đúng.
- [ ] R2.6.2 Mobile 375px: không horizontal scroll ngoài table, filterBuilder 1 col.

**Minh chứng:** `ScreenerA11y.component.test.tsx` (a11y role + keyboard) + manual Lighthouse screenshot.

## 8. Thứ tự thực thi + ước lượng (~5–7 ngày)

| Step | Item | Phụ thuộc | Ước lượng |
|------|------|-----------|-----------|
| 1 | **P2.1** URL share | Không | 0.5d |
| 2 | **P2.2** React Query | P2.1 (dùng URL) | 1d |
| 3 | **P2.6** Cột persist (localStorage) | P2.2 (table) | 0.25d (gối) |
| 4 | **P2.3** History server (model+API+FE) | P2.2 (RQ) | 1.5d |
| 5 | **P2.4** Lịch quét + alert | P2.3 (reuse history + task) | 2d |
| 6 | **P2.5** Watchlist/alert từ dòng | P2.3 (history) | 0.5d (gối 4) |
| 7 | **P2.7** Mobile/a11y pass | P2.5 (table) | 0.5d |
| 8 | **P2.8** Evidence + E2E `screener-p0.spec.ts` mở rộng | Tất cả | 0.5d |

## 9. Quality gates (bắt buộc mỗi sub-step / step)

- BE sub-step: `DJANGO_DEBUG=true .venv/Scripts/python manage.py test user_workspace --verbosity 1` pass (cho phép 1 pre-existing holdings `httpx.UnsupportedProtocol`); mới: `assertNumQueries` cho history/schedule không tăng query so với P1.
- FE sub-step: `npm --prefix packages/web run build` (`tsc && vite build`) exit 0; `npm run lint` 0 errors (warnings baseline 3545); `npm run test:components` pass (hiện 25 files 106 tests, thêm P2 tests).
- Cuối step: `npm run build` pass + smoke `GET /screener/?rule=1&run=1` + `GET /screener/history/` + `POST /screener/schedules/` trên dev.
- Ledger: 1 entry / thay đổi mã nguồn. Evidence: `docs/evidence/screener-p2/`.

## 10. Out-of-scope P2 (sang P3)

P3: calibrate công thức vendor (Q3, so sánh `screener_helpers.py` với feed vendor, thêm `values` vs `close` choice), preset cộng đồng (share template), realtime intraday (poll `SymbolSnapshot` mỗi 5s). Tuyệt đối không: đổi công thức chỉ báo trong P2, đổi key response P1, tạo queue/beat mới ngoài `manual_on_demand` + `screener_scheduled_run` (5m), migration DB ngoài 2 model mới (`ScreenerRunHistory`, `ScreenerSchedule`).

