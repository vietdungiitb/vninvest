# IMPLEMENTATION PLAN — Screener `/screener` P1 performance (không code ở bước này)

> Ngày lập: 2026-09-13 · Nguồn: `docs/AUDIT_SCREENER_COMMERCIAL_GRADE_20260913.md` (§G-P1: F1/F6/F7/F8) + P0 plan §12 + code sau P0 (ledger Entries 63–71, HEAD `8c5ceff4`).
> Phạm vi: **P1 performance** — sort/phân trang server, cache scan, batch financials + window động, celery run dài, rate-limit. Không sửa công thức chỉ báo (Q3, dời P3), không đụng history/lịch (Q5/Q6, P2).
> Nguyên tắc: mỗi sub-step xong chạy `npx tsc --noEmit` (FE) / `manage.py test user_workspace` (BE); cuối step `npm run build`; mọi thay đổi 1 ledger entry. Contract cũ giữ tương thích ngược (tham số mới đều optional).

## 0. Quyết định cần chốt trước khi code (kiểu Entry 64 của P0)

| # | Tham số | Đề xuất mặc định | Nếu đổi thì ảnh hưởng |
|---|---|---|---|
| D1 | Ngưỡng sync/async | `total_scanned > 800` → `202 queued` (settings `SCREENER_SYNC_SYMBOL_LIMIT=800`); có cache hit thì luôn sync | Thấp hơn → nhiều job celery hơn (ổn định nhưng UX chờ); cao hơn → rủi ro timeout worker web |
| D2 | Sort mặc định | `sort=ai_score&order=desc` (thay `close` desc hiện tại) | FE nhận thứ tự mới — P1 FE adopt server order nên an toàn |
| D3 | Phân trang | `page=1&limit=25`, `limit ∈ {10,25,50,100}`, max 100 | Export FE tự gọi `limit=2000` (vẫn ≤ universe ~1200, Q1) |
| D4 | Cache scan | **Option B Entry 76**: key theo `(user, rule_id, rule.updated_at, session_date, include_ai)` — **KHÔNG `sort/order`** (1 entry cho mọi sort/page, hit-rate cao; sort `O(n log n)` trên <100 matched post-cache); TTL 4h (`SCREENER_SCAN_CACHE_TTL=14400`) | Ngắn hơn → nhiều recompute; dài hơn → rủi ro dữ liệu cũ (đã có `session_date` trong key nên an toàn) |
| D5 | Rate-limit | `ScreenerRunThrottle`: prod `30/min`, dev bypass (mẫu `MarketDataThrottle`); tối đa 3 job pending/user (`429 + retry_after`) | Chặt hơn có thể chặn user quét nhiều rule liên tiếp |
| D6 | AI advisory | worker/async: tính full; sync (≤800 mã): tính full như hiện tại; `include_ai=0` → bỏ qua + cấm `sort=ai_score` (400) | Không có "truncated AI" — tránh thêm flag/phức tạp |
| D7 | Window DailyPrice | động theo rule (`_required_lookback_days`), clamp [35, 90] lịch (thay 90 cố định) | Thấp hơn 35 có thể thiếu nến cho SMA50 + cuối tuần dài |

## 1. Hiệu chỉnh audit ↔ code (đã đọc lại code ngày 2026-09-13, plan này là chuẩn)

1. **F1 nhẹ hơn audit mô tả một phần**: `get_company_financials_response` đã cache 12h Django cache (`stock_financials:{symbol}`, `vnbroker_adapter.py:1167-1204`) — chi phí thật là **N roundtrip cache/probe mỗi scan** + cache-miss gọi vnbroker từng mã. P1.3 batch bằng `cache.get_many` + chỉ gọi adapter cho key miss (xác minh format key lúc làm).
2. **Index DB đã đủ**: `SymbolSnapshot`/`SessionFacts` có index `(symbol, session_date, stale)` (`market_serving/migrations/0001_initial.py:32,56`); `DailyPrice` unique `(symbol, date)` + index (`market_data/models.py:86-90`). P1.6 chỉ **verify EXPLAIN**, không migration trừ khi phát hiện thiếu.
3. **Sort `close` desc** vẫn còn (`portfolio_analytics_views.py:1549`) — P1.1 thay bằng sort param, default `ai_score` desc (D2).
4. **Response P0** đã có `session_date/is_stale/days_old/missing_fields/missing_counts` (`:1551-1563`) — P1 chỉ **thêm** key (`page/limit/pages/sort/order/job_*`), 5 key legacy + 5 key P0 giữ nguyên (tương thích ngược).
5. **Celery sẵn sàng**: pattern `shared_task` trong `user_workspace/tasks.py:14-50`; `TESTING → ALWAYS_EAGER` (`settings.py:343-349`) nên test status-flow chạy đồng bộ xác định; queue đích: domain `manual_operations` → queue `manual_on_demand` (`queue_policy.py:124-143`) — thêm route key `user_workspace.screener_*`, không tạo queue mới.
6. **Throttle có mẫu**: `MarketDataThrottle(UserRateThrottle)` + dev bypass (`market_serving/views.py:166-168`); global đã bật `UserRateThrottle` + `PATRateThrottle` (`settings.py:232-233`) — P1.5 chỉ thêm class riêng cho run view.
7. **FE hiện tại**: `runScreenerRule(ruleId)` (`workspace.js:567-570`) không params; `handleRun` (`ScreenerPage.tsx:187-213`) đồng bộ; table sort/paging client (`ScreenerResultsTable.tsx:48,103-123`) — P1 FE truyền params + giữ fallback client khi response thiếu meta mới.

## 2. P1.1 — Sort + phân trang server (F6, F7)

**Hiện trạng:** `matched.sort(close desc)` (`:1549`); trả toàn bộ `matched` (`:1551-1563`); FE `PAGE_SIZE=25` cố định.

**Thiết kế (BE `portfolio_analytics_views.py`, FE adapter + page + table):**
- (a) Query params mới (đều optional): `sort ∈ {ai_score, close, momentum_20d_pct, volume_rvol, rsi_14, price_vs_sma20_pct, symbol}`, `order ∈ {asc, desc}` (default `ai_score/desc` — D2), `page ≥ 1` (default 1), `limit ∈ {10,25,50,100}` (default 25 — D3), `include_ai ∈ {0,1}` (default 1). Sai miền → `400` (message VI).
- (b) Sort key `ai_score` = `row.ai_advisory.ai_score_0_100` (None cuối cùng — giữ quy ước sort client `ScreenerResultsTable.tsx:109-111`); `symbol` so chuỗi; còn lại so số, None cuối.
- (c) `include_ai=0` → `ai_advisory=None` mọi dòng + `sort=ai_score` bị 400. (Tiết kiệm compute khi FE chỉ cần bảng thô/export số.)
- (d) Response thêm: `page, limit, pages, sort, order` (additive). Không params mới → payload hệt P0 (tương thích ngược, FE cũ/table test cũ không vỡ).
- (e) FE: `runScreenerRule(ruleId, params)` ghép querystring; `handleRun` gửi `{sort, order, page, limit, include_ai:1}`; table dùng meta server (prev/next/sort header gọi server, reset page khi đổi sort); giữ sort/paging client **chỉ khi** response thiếu `page` (fallback an toàn). Export gọi riêng `limit=2000, include_ai=1` để đủ dữ liệu (ghi chú UX: toast "đang chuẩn bị file" nếu 202).

**Yêu cầu:**
- [ ] R1.1 `sort=momentum_20d_pct&order=asc` trả đúng thứ tự + meta `pages=ceil(count/limit)`.
- [ ] R1.2 `sort=foo` → 400; `limit=7` → 400; `include_ai=0&sort=ai_score` → 400.
- [ ] R1.3 Không params → response byte-tương đương P0 (trừ sort default đổi theo D2 — ghi rõ trong ledger nếu giữ `close` cho path legacy; **quyết định lúc làm**: legacy path giữ `close` desc để không vỡ client lạ, path có params dùng default D2).

**Minh chứng:** BE test sort/paging/400 (P1.6); FE component test header click gọi adapter kèm params.

## 3. P1.2 — Cache kết quả scan (F1)

**Hiện trạng:** mỗi click "Chạy" recompute toàn universe (cache duy nhất là financials 12h từng mã).

**Thiết kế (BE, Django cache — redis prod / locmem test):**
- (a) Key **Option B Entry 76**: `screener:scan:{user_id}:{rule_id}:{rule.updated_at_ts}:{session_date}:{include_ai}` — **KHÔNG `sort/order`** (1 entry cho mọi sort/page; tránh 14× entries `7 sorts × 2 orders`; sort post-cache rẻ trên <100 matched). Value: `{matched_full (chưa sort), total_scanned, missing_counts}` + `window_days` recompute; TTL `SCREENER_SCAN_CACHE_TTL` default 14400 (D4).
- (b) Luồng run: lookup rule → build key → cache hit → sort + paginate từ cache (luôn sync, kể cả universe lớn) → miss → `_compute_scan` (sync hoặc enqueue theo D1) → `cache.set` full **unsorted** rồi sort/paginate.
- (c) Invalidation: tự động qua `rule.updated_at` + `session_date` trong key (sửa rule → key mới). Không xóa tay. Ghi chú: `updated_at` đổi theo giây — 2 click liên tiếp trong 1 giây có thể recompute 2 lần (chấp nhận, throttle D5 chặn spam).
- (d) Giới hạn: không cache path `limit=2000` export? **Có cache chung** (cache lưu full, export paginate lại từ cache — rẻ). Không cache response lỗi/400.

**Yêu cầu:**
- [ ] R2.1 Chạy lần 2 cùng rule (không sửa) → `get_company_financials_response` **0 call mới** (assert mock call count trong test).
- [ ] R2.2 Sửa rule (đổi value) → kết quả đổi (key mới), không dính cache cũ.
- [ ] R2.3 Qua phiên mới (`session_date` khác) → recompute, banner staleness P0 vẫn đúng.

**Minh chứng:** BE test cache-hit/miss (P1.6) + log `cache.get/set` trong dev.

## 4. P1.3 — Batch financials + window động + trim cột query (F1, F8)

**Hiện trạng:** loop gọi adapter từng mã (`:1457`); `DailyPrice` 90 ngày toàn universe 1 query full-row (`:1438-1443`); snapshots/facts/profile full-row.

**Thiết kế (BE, cùng file run view + helper mới trong `screener_helpers.py`):**
- (a) Pre-warm financials: thu thập `symbols` → `cache.get_many([stock_financials:{s}…])` (xác minh prefix `stock_financials:` lúc làm — `vnbroker_adapter.py:1184`) → chỉ gọi `get_company_financials_response(sym)` cho key miss (hàm tự cache 12h). Không đổi SSOT/cache TTL.
- (b) `_required_lookback_days(conditions)`: map field→số nến tối thiểu (`sma50/sma20_vs_sma50_pct`: 55, `macd_hist`: 40, `sma20/price_vs_sma20/bollinger/vwap/mfi?/avg_volume_20`: 25, `momentum_20d_pct`: 22, còn lại RSI/Stoch/ATR/ADX: 20, field lạ: 55) → `trading_days → calendar = ceil(days*1.5)+5`, clamp **[35, 90]** (D7). Rule rỗng/None → 75.
- (c) Trim cột: `DailyPrice… .only('symbol','date','close','volume','high','low')` + `snapshots .only('symbol','price','volume','session_date')` + `facts .only(...)` (Entry 76 keep `.only()` — `_screener_build_technical` chỉ đọc `p.close/volume/high/low` (`screener_helpers.py:316-319`), đủ 6 field deferred, không N+1); `profile` giữ `values` hiện tại. (Plan cũ ghi `.values()` — đã update theo code.)
- (d) Không đổi công thức (Q3).

**Yêu cầu:**
- [ ] R3.1 Rule chỉ dùng `rsi_14` → window ≈ 35 lịch (assert `lookback_date` trong test qua mock hoặc expose `window_days` vào response meta — **thêm key `window_days`**, additive).
- [ ] R3.2 Rule có `sma50` → window ≥ 80 lịch; kết quả khớp P0 (không đổi số học).
- [ ] R3.3 Universe 1200 mã: số query DB không đổi (vẫn ~5 query), payload DB giảm ≥ 40% số row DailyPrice cho rule nhẹ (đo bằng `assertNumQueries` + đếm row hoặc log).

**Minh chứng:** unit test `_required_lookback_days` + BE test so sánh matched P0 vs P1 cho cùng fixture (khớp 100%).

## 5. P1.4 — Celery run dài + endpoint trạng thái (F1)

**Hiện trạng:** sync toàn phần; universe ~1200 mã (Q1) × (financials + 30 chỉ báo + AI) có thể vượt timeout web/gateway giờ cao điểm.

**Thiết kế (BE task + view, FE polling):**
- (a) Task mới `user_workspace.screener_tasks.run_screener_scan_task` (file mới, tránh phình `tasks.py` DNSE): input JSON-serializable `(user_id, tenant_id|None, rule_id, rule_snapshot{rules_json, updated_at_ts}, session_date_iso, sort, order, include_ai)` — **snapshot rule** để kết quả không lệch nếu user sửa rule giữa chừng. Task chạy đúng pipeline P1.1–P1.3 (tách pipeline thành hàm `execute_screener_scan(...)` dùng chung view sync + task), cập nhật `cache job_key` progress mỗi 200 mã (`{status:'running', scanned, total}`), xong `cache.set` scan-key P1.2 + job `{status:'completed', result_meta}` (không nhúng full matched vào job — FE fetch lại qua run/ thường, lúc đó cache hit).
- (b) Route task vào `manual_operations.task_routes` (`queue_policy.py:126-135`) → queue `manual_on_demand` (không queue mới, không beat).
- (c) View: `POST run/` thêm nhánh — cache hit → sync như P1.2; `total_scanned > SCREENER_SYNC_SYMBOL_LIMIT` (D1) hoặc `?async=1` → tạo `job_id=uuid4`, `cache.set(job_key, {status:'queued',…}, TTL 1h)`, `.delay(...)`, trả **202** `{status:'queued', job_id, poll_url:'/core/v1/screener/rules/<id>/run/status/?job_id=…'}`. Mới: `GET run/status/` (cùng `urls.py`) → `{status, scanned, total, result_meta|error}`; `completed` → FE gọi lại `POST run/` (cache hit) lấy trang 1. Lỗi task → `{status:'failed', error}` + FE toast + giữ kết quả cũ trên màn hình.
- (d) Chống spam job: đếm job `queued/running` per-user trong cache (`screener:jobs:{user_id}` set, TTL 1h); > 3 → 429 (liên kết D5). Task xong (completed/failed) tự gỡ khỏi set (finally).
- (e) FE (`ScreenerPage.handleRun` + `ScreenerResultsTable`): nhận 202 → trạng thái "Đang quét trên hàng đợi…" + progress bar (`scanned/total`, poll 1.5s, timeout 90s → toast thử lại) → completed → fetch sync. Giữ nút Hủy poll (chỉ dừng poll client, không kill task — ghi rõ trong UI text).
- (f) Fail-safe: worker chết/job mất (job_key missing sau TTL) → status endpoint trả `{status:'unknown'}` + FE fallback gọi sync thường.

**Yêu cầu:**
- [ ] R4.1 Universe fixture > limit (test override `SCREENER_SYNC_SYMBOL_LIMIT=1`) → 202 + `job_id`; `GET status` → completed + `result_meta.matched_count` đúng (ALWAYS_EAGER chạy đồng bộ trong test).
- [ ] R4.2 `?async=1` với universe nhỏ → vẫn 202 (ép async được).
- [ ] R4.3 Job thứ 4 khi 3 job pending → 429 có `retry_after`.
- [ ] R4.4 Sửa rule giữa chừng không làm lệch kết quả job đang chạy (snapshot assert).

**Minh chứng:** BE test async-flow + pending-cap; FE component test poll 202→completed (mock adapter theo chuỗi); E2E manual 1 lần với universe thật (ghi thời gian scan trước/sau vào evidence).

## 6. P1.5 — Rate-limit endpoint run (F1-phòng vệ)

**Hiện trạng:** run view không throttle riêng (chỉ global).

**Thiết kế:** `ScreenerRunThrottle(UserRateThrottle)` cạnh view (mẫu `MarketDataThrottle`): `rate = '999999/day' if _DEV_MODE else '30/min'` (D5) — check `_DEV_MODE` bằng `DJANGO_DEBUG` env như mẫu. `throttle_classes = [ScreenerRunThrottle]` cho `POST run/` (+ `GET status/` nhẹ hơn: dùng chung, không thêm class). 429 trả envelope DRF chuẩn (FE hiện toast lỗi có sẵn từ P0).

**Yêu cầu:**
- [ ] R5.1 Override rate `3/min` trong test → request thứ 4 → 429.
- [ ] R5.2 Dev mode (`DJANGO_DEBUG=1`) không 429 khi click liên tục (manual).

**Minh chứng:** BE test throttle (override settings) — 3 dòng, rẻ.

## 7. P1.6 — Tests + verify index + evidence (lấp khoảng còn lại của E)

| # | File test | Target | Case tối thiểu |
|---|---|---|---|
| U1 | `user_workspace/tests/test_screener_scan_params.py` (mới) | P1.1 | sort từng key + order, `page/limit` meta đúng, 400 sort/limit/include_ai-kết-hợp, legacy no-params giữ shape P0 |
| U2 | `…/test_screener_scan_cache.py` (mới) | P1.2 | miss→compute+set, hit→0 adapter call, sửa rule→key mới, session khác→recompute |
| U3 | `…/test_screener_lookback.py` (mới) | P1.3 | `_required_lookback_days` từng nhóm field + clamp; matched P1 == P0 trên fixture chung |
| U4 | `…/test_screener_async_run.py` (mới) | P1.4 | 202 + status completed (eager), `?async=1`, pending-cap 429, snapshot-rule không lệch |
| U5 | gộp U4 | P1.5 | throttle 429 khi override rate |
| F1 | `screener/__tests__/ScreenerServerPaging.component.test.tsx` (mới) | FE P1.1/P1.4 | header sort gọi adapter kèm params + reset page; 202 → progress → completed → render; hủy poll |
| E2E | mở rộng `tests/visual/screener-p0.spec.ts` hoặc spec mới | smoke | run thật 1 rule nhiều-mã: ảnh progress async (nếu trigger) + bảng sort server + export sau P1 |

**Verify index (không migration mặc định):** chạy `EXPLAIN` 5 query của run view trên staging/dev-DB có dữ liệu thật (snapshots/facts/prices/profile/latest) → ghi output vào evidence; chỉ tạo migration khi phát hiện seq-scan.

**Yêu cầu:**
- [ ] R6.1 `manage.py test user_workspace` xanh (trừ 1 pre-existing holdings đã biết, Entry 71).
- [ ] R6.2 `npx vitest run src/components/screener` xanh, không tăng warnings eslint scope.
- [ ] R6.3 Evidence `docs/evidence/screener-p1/`: EXPLAIN log + ảnh async-progress + thời gian scan trước/sau (so với P0 cùng rule/universe).

## 8. Thứ tự thực thi + ước lượng (~1 sprint / 5 ngày)

1. **P1.1** (1d) — contract trước: sort/paging params + validate + response meta; FE adapter + table skeleton gọi server (fallback client giữ nguyên).
2. **P1.3** (1d, song song 1) — thuần BE trong pipeline: batch financials + window động + trim cột; không đổi response.
3. **P1.2** (1d, sau 1) — cache layer bọc ngoài pipeline (key gồm sort/order theo P1.1).
4. **P1.4** (1.5d, sau 2+3) — tách `execute_screener_scan`, task celery, status endpoint, FE polling UI.
5. **P1.5** (0.25d, gối 4) — throttle class + test.
6. **P1.6** (1d, gối đầu + chốt) — test viết cùng mỗi item, EXPLAIN + evidence cuối.

## 9. Quality gates (bắt buộc mỗi sub-step / step)

- BE sub-step: `manage.py test user_workspace` pass (cho phép 1 pre-existing holdings); mới: `assertNumQueries` cho run-view không tăng số query so P0 (chỉ giảm payload).
- FE sub-step: `npx tsc --noEmit` exit 0; eslint scope `src/components/screener/ src/pages/ScreenerPage.tsx src/types/screener.ts` 0 errors, warnings không quá 3 (baseline Entry 71).
- Cuối step: `npm run build` exit 0 + smoke `POST run/` sync và `GET status/` trên dev.
- Ledger: 1 entry / thay đổi mã nguồn. Evidence: `docs/evidence/screener-p1/`.

## 10. Out-of-scope P1 (sang P2/P3)

P2: URL share (`?rule=&run=`), React Query, backtest v2 + history server (Q5), lịch quét + alert (Q6), thêm vào watchlist/tạo alert từ dòng, cột persist, mobile/a11y pass. P3: calibrate công thức vendor (Q3), preset cộng đồng, realtime intraday. Tuyệt đối không: đổi công thức chỉ báo, đổi key response P0, tạo queue/beat mới, migration DB trừ khi EXPLAIN bắt buộc.
