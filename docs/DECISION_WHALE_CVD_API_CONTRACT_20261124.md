# QUYẾT ĐỊNH BACKEND — Hợp đồng API Whale/CVD cho widget (2026-11-24, REV.2.1)

- **Vai trò:** người viết code backend `vninvest`, chốt thay Owner — không đẩy câu hỏi lại widget team.
- **Trạng thái:** **REV.2.1 — REV.2 + 1 P0 mới (2 writer ghi trộn WhaleAlertCanonical) + 4 P1 tinh chỉnh**; thay thế REV.1/REV.2 và §F của `docs/AUDIT_BE_REQUEST_WHALE_CVD_REALTIME_2026-11-24.md`.
- **Đối tượng:** `vninvestcharts-widget@origin/dev@13e4da81` `docs/requests/BE_REQUEST_WHALE_CVD_REALTIME_2026-11-24.md`.
- **Lessons áp dụng:** [L-V01, L-V02, L-V04, L-T01, L-T02, L-F04, L-F07].
- **MANDATORY CHECKLIST (đã tick):**
  - [x] Mọi "gốc rễ" kế thừa (review + audit + REV.1) đã mở đúng file, đúng dòng, trích nguyên văn trước khi sửa (L-V02, L-T02) — log §6.
  - [x] Không dùng con số chưa probe: SLA `<1s` bị loại; retention lấy từ config thật; mọi con số kèm `file:line` (L-V01).
  - [x] Test sẽ assert **giá trị thật** (8 field summary, 501 body, scope 403, `unit:"vnd"`) chứ không assert rỗng; có test dương tính (L-V04).
  - [x] `git diff --numstat` sau mỗi sửa; không dùng `Get-Content|Set-Content` (L-T01, L-F04); exit code đọc tách pipeline (L-F07).
  - [x] Trước khi code chạy G0 probe staging (§5) — hiện **CHƯA CHẠY**.

---

## 0. Tóm tắt khác REV.1 (do review bắt đúng)

| REV.1 | REV.2 | Bằng chứng phản biện |
|---|---|---|
| `whale_orders` đọc trực tiếp `IntradayTick`, retention 7 ngày | Đọc `WhaleAlertCanonical` (per-tick, 365 ngày), underlying aggressor vẫn là `IntradayTick` | `signal_intelligence/tasks.py:122-125,250-375` ghi canonical per tick; `models.py:76-107` có `order_id/matched_value`; `service_ops/domain_configs/signals.py:35` = 365 ngày. REV.1 nói canonical "suy từ ratio" là **sai** — `tasks.py:453-454` là của `OrderFlowEvent` |
| `summary = {buy_value, sell_value}` | Đủ **8 field** | widget `isWhaleFeedResponse()` (`VNInvestClient.ts:238-244`) thấy 2 key là đẩy raw summary vào `WhalePanel.tsx:31-36`, đọc `whale_buy/shark_buy/small_buy...` (`lib/types/vninvest.ts:72-81`) ⇒ undefined/NaN |
| Ngưỡng "tuỳ" | `min_value = 500_000_000` mặc định, `small=[500M,1B)` | `order_flow_engine.py:31` `WHALE_VALUE_MIN_VND`; nếu lọc ≥1B thì `small` chết, nếu ≥0 thì trang đầu toàn tick lẻ |
| Ví dụ `2.94B → whale` | Sửa thành **`shark`** | D2: `shark=[1B,5B)` |
| CVD không nói đơn vị, thiếu scope | `unit:"vnd"` + `market:read` + fix `else:sell` + cache key kẹp `computed_at` | `session_facts_engine.py:122-127` cộng `matched_value` VND vào cột tên `*_volume`; `views.py:358-359` không gọi scope gate; `views.py:386` cache key không kẹp revision |
| WS chỉ sửa `broadcasting.py` | Thêm `consumers.py` + `ws_ticket.py` + protocol `events[]` | `broadcasting.py` chỉ publisher; auth/subscribe ở `consumers.py:174-200`, `ws_ticket.py:78-93`; subscribe hiện chỉ có `symbols` |
| Bảng phạm vi 8 file (đếm lệch) | Danh sách đúng **14 path** (§5, sau audit plan vòng 1) | thiếu `consumers.py`, `ws_ticket.py`, `signal_intelligence/views.py`, `session_facts_engine.py`, env, manifest, 2 file test WS/CORS |
| "bucket materialized ở 15m" | Sửa: materialize **4 window** `{5m,15m,30m,1h}`, `1m` không được hỗ trợ | `session_facts_engine.py:52,56-61,231-252,359` |
| `409 revision_changed` cho whale feed | **Bỏ** — keyset cursor `(executed_at, pk)` không hỏng khi có row mới ở đầu | `pagination.py:35-59` chỉ là DRF cursor chuẩn, không có helper `{v,ts,id}`/`409` như REV.1 ghi |
| `native_views.ts:120` | `nativeShapes.ts:120` | citation sai file (L-T02) |
| **REV.2 → REV.2.1:** chưa lọc writer aggregate | **Lọc cứng `alert__source_ref__startswith='whale_tick:'`** | 2 Celery task ghi trộn `WhaleAlertCanonical`: per-tick `tasks.py:285` vs aggregate `tick_session:` (`tasks.py:149`) → `materializers.py:925-928` ghi row `matched_value = min(5B, ...)` (`:811`), `executed_at` = giờ chạy task ⇒ bong bóng/summary giả |
| REV.2 thiếu default window + `+00:00` | Default = phiên gần nhất có data; mọi timestamp qua `dj_timezone.localtime()` | `settings.py:354-356` `USE_TZ=True` ⇒ `.isoformat()` trả `+00:00`, tự vi phạm D5 |
| REV.2 kẹp cache key **và** invalidate app khác | **Chỉ kẹp `revision` vào cache key** `market_serving/views.py:386`; bỏ mục #8 `order_flow_engine.py` | key đổi ⇒ tự miss, không cần phá cache app khác (chạy trước khi materialize xong) |

---

## D1 — Nguồn aggressor & SLA (chốt lại)

**Quyết định: `whale_orders[]` đọc từ `WhaleAlertCanonical` (per-tick, aggressor thật từ `IntradayTick`, retention 365 ngày); bỏ SLA `<1s`; event realtime trả `not_provisioned`.**

- **Lọc cứng per-tick (P0 mới REV.2.1):** `WhaleAlertCanonical` hiện có **2 writer chạy cùng lúc mỗi 5 phút** (`settings.py:855-874`): (1) per-tick `tasks.py:250-375` với `source_ref='whale_tick:...'` (`:285`); (2) aggregate `tick_session:{symbol}:{date}:buy|sell` (`tasks.py:149`) → `materializers.py:925-928` ghi vào **cùng bảng**, `matched_value = min(5B, ...)` (`:811`), `executed_at = triggered_at` (giờ chạy task, `:813`). ⇒ `build_whale_feed_payload()` **phải** lọc `alert__source_ref__startswith='whale_tick:'`; `session_facts_engine.py:93-101` cũng phải kiểm tra/chặn row `tick_session:` nếu đang cộng trùng vào CVD. Nếu không, mỗi phiên xuất hiện 2 lệnh 5 tỷ giả và `summary` bị cộng đôi. G0 probe đếm phân bố `source_ref` là điều kiện bắt buộc.
- Aggressor gốc: `IntradayTick.side` BUY/SELL/UNKNOWN (`market_data/models.py:285-316`). `detect_whale_ticks` (`order_flow_engine.py:244-256`) lọc `value >= WHALE_VALUE_MIN_VND = 500M` (`:31`), rồi `_bulk_write_whale_canonical` ghi từng tick (`tasks.py:250-375`). **Bug thật cần sửa:** `tasks.py:281` `side = 'buy' if side_raw == 'BUY' else 'sell'` ép UNKNOWN → sell; sửa bằng cách bỏ row `UNKNOWN` ngay trong `detect_whale_ticks` (filter `side != 'UNKNOWN'`), không đổi choices model.
- Dedup: `source_ref` per-tick gồm `symbol+timestamp+side+matched_value` (`tasks.py:285`) — 2 lệnh y hệt cùng giây/giá/KL/side chỉ giữ 1 row (chấp nhận được ở mức demo/reference; ghi chú trong docstring builder).
- Không dùng raw `IntradayTick` trên request path vì không có cột `matched_value`, không index theo giá trị, không `unique_together` (`models.py:309-315`, `data_ingest/tasks.py:2573` dùng `ignore_conflicts`), và chỉ giữ 7 ngày (`signals.py:34`).
- `order_id`: `canonical.order_id or str(canonical.alert_id)` (model `:94`, PK `:81-86`) — idempotent ngay cả khi `order_id` rỗng.
- `buyer_broker`/`seller_broker`: `null` — không có dữ liệu, không bịa.
- Freshness: canonical được ghi khi hydrate tick (hot 300 s / warm 900 s — `market_serving/realtime_prefetch.py:43-44`); cold **không hydrate trong phiên**, chỉ có backfill (`data_ingest/tasks.py:2469-2475`, handoff `docs/handoffs/HANDOFF_2026-11-22_STOCK_WHALE_BACKFILL_ALL.md:10-18`). Response phải trả `freshness_by_tier: {hot:"<=300s", warm:"<=900s", cold:"backfill_only"}` — widget hiển thị nhãn "có thể trễ" cho cold.
- WS realtime aggressor chưa có: bỏ mục tiêu `<1s`; subscribe event mới → control event `not_provisioned`; REST orderflow → `501`. `seq` giữ cơ chế hiện có (`broadcasting.py:29-37,47`).

## D2 — Enum & ngưỡng (chốt lại)

`size_class ∈ {small, shark, whale}` (khớp widget `lib/types/vninvest.ts:59`); `side ∈ {buy, sell}` chữ thường (`:60`). Ngưỡng duy nhất trên `matched_value` (VND):

| class | khoảng |
|---|---|
| `small` | `[500_000_000, 1_000_000_000)` |
| `shark` | `[1_000_000_000, 5_000_000_000)` |
| `whale` | `>= 5_000_000_000` |

- `min_value` query param mặc định `500_000_000`, **sàn cứng 500M** (bằng `WHALE_VALUE_MIN_VND` — canonical không lưu tick < 500M); truyền `< 500M` ⇒ `400 MIN_VALUE_BELOW_FLOOR` thay vì trả rỗng gây hiểu nhầm. `small=[500M,1B)` nên không chết.
- Đổi `normal → small` ở `signal_intelligence/views.py:354-360`; bỏ `large` (request `:39`). Ngưỡng 500M của detector là ngưỡng **phát hiện**, trùng giá trị nhưng khác khái niệm với `min_value` — ghi chú trong docstring.
- `whaleThreshold` 1M của widget là filter hiển thị, không đổi.

## D3 — Hợp đồng Whale (chốt lại)

**Public URL giữ nguyên** `/core/v1/realtime/whale-feed/{symbol}/` (`market_serving/urls.py:31`, widget `VNInvestClient.ts:258`, web `market.js:584-587`). Một builder chung `build_whale_feed_payload()` trả shape chuẩn **lowercase**; mỗi route có adapter riêng (không dùng chung response object).

```json
{
  "symbol": "VIC", "revision": 1730000000,
  "updated_at": "2026-11-24T16:15:32+07:00",
  "whale_orders": [{
    "order_id": "VIC-912345", "ts": "2026-11-24T16:15:32+07:00",
    "price": 24500, "volume": 120000, "matched_value": 2940000000,
    "side": "buy", "size_class": "shark",
    "buyer_broker": null, "seller_broker": null
  }],
  "alerts": [{"...": "giữ nguyên shape cũ"}],
  "summary": {
    "buy_value": 2940000000, "sell_value": 0,
    "whale_buy": 0, "whale_sell": 0,
    "shark_buy": 2940000000, "shark_sell": 0,
    "small_buy": 0, "small_sell": 0
  },
  "next_cursor": null,
  "source": "whale_alert_canonical", "data_quality": "provider_side_from_tick",
  "freshness_by_tier": {"hot": "<=300s", "warm": "<=900s", "cold": "backfill_only"},
  "retention_days": 365
}
```

- `summary` tính trên **toàn cửa sổ `from..to`**, không phải page hiện tại; cả 8 field bắt buộc (`lib/types/vninvest.ts:72-81`). Invariant bắt buộc đưa vào unit test: `buy_value == whale_buy + shark_buy + small_buy` (tương tự sell). Không đụng `isWhaleFeedResponse()` — payload có đủ 2 key nên widget dùng raw summary, vì vậy phải đúng 8 field.
- **Default window khi widget gọi bare URL** (`VNInvestClient.ts:1029` không truyền `from`/`to`): chọn **phiên gần nhất có dữ liệu** — `session_date = MAX(session_date)` của symbol sau khi lọc per-tick — rọi `from/to` theo phiên đó; **không** cộng 365 ngày (`signals.py:35`). Khi caller truyền `from/to`, suy `session_date__gte/lte` theo `+07:00` để ăn index `(symbol, session_date, side)` có sẵn (`signal_intelligence/models.py:101-104`) — slice này **không migration**, không thêm index `(symbol, executed_at)`.
- **Empty state** (0 row per-tick): `whale_orders: []`, `summary` 8 field = 0, `revision: 0`, `updated_at: null`, `next_cursor: null`, `alerts: []`. Không null hoá summary (widget đọc trực tiếp).
- Mọi timestamp trả ra dùng `dj_timezone.localtime(x).isoformat()` (`settings.py:354-356` `USE_TZ=True` ⇒ `.isoformat()` trả `+00:00`, tự vi phạm D5).
- `alerts[]`: **không paginate**, luôn trả danh sách đầy (tối đa `alert_limit` mặc định 50, giữ hành vi `native_views.py:349-350`). `next_cursor` chỉ áp cho `whale_orders`.
- Pagination whale: keyset `(executed_at, pk)`; `limit` mặc định **50** (giữ `market.js:584-587` không breaking), cho phép tối đa **1000** nếu caller truyền rõ; vượt 1000 → `400 LIMIT_EXCEEDED`. Không ném `409` khi có tick mới — keyset xử lý được.
- `revision` = `MAX(executed_at)` của canonical trong symbol (đổi chỉ khi có whale event thật, không đổi mỗi hydrate); widget invalidate cache khi giá trị đổi.
- Alias `/core/v1/whale-feed` (`signal_intelligence/urls.py:17`, `views.py:1010-1058`) **giữ nguyên**: envelope, `side` HOA, scope `signals:read`, `symbol` tuỳ chọn, `?session_date=` 365 ngày, test `test_signal_intelligence_api_routes.py:107-114` vẫn xanh. Adapter convert từ builder chung.

## D4 — CVD (chốt lại)

**Không xây endpoint tick-based mới.** Mở rộng `/core/v1/session-facts/{symbol}/cvd/` (`market_serving/urls.py:23`, `views.py:340-435`).

- Thêm: `delta = buy_volume - sell_volume`, `revision = int(facts.computed_at.timestamp())`, `updated_at = dj_timezone.localtime(facts.computed_at).isoformat()` (**không** gọi thẳng `.isoformat()` — `USE_TZ=True`, `settings.py:354-356`), `unit: "vnd"`, `source: "whale_aggregate"`, `data_quality: "derived_from_whale_alerts"`, `trade_count: null` (không có nguồn đếm trade — không gán 0). Các field mới phải có mặt **cả** ở nhánh 200-empty `_build_empty_cvd_payload()` (`views.py:91-105`): `unit/source/data_quality/revision/updated_at` (empty: `revision: 0`, `updated_at: null`), `delta: 0`, `trade_count: null`.
- `buy_volume`/`sell_volume` thực chất là **VND** (`session_facts_engine.py:122-128`, `views.py:286`) — phải có `unit:"vnd"` để widget không hiểu nhầm trục.
- Sửa bug `else: sell` (`session_facts_engine.py:124-127`) thành `if side == 'sell': ...` và bỏ side khác (UNKNOWN) — kèm test fail-before.
- Scope: thêm `require_pat_scopes_or_human_session(request, 'market:read')` ngay sau `:358` (hiện chỉ `IsAuthenticated` + `MarketDataThrottle`) — tránh lặp B-6.
- Cache: **chỉ** kẹp `revision` vào key ngay tại `views.py:386` — `core:cvd_series:v2:{symbol}:{session_date}:{bucket_minutes}:{revision}`. Khi `facts.computed_at` đổi, key mới tự miss ⇒ không stale. **Bỏ** ý định gọi `cache.delete` từ `order_flow_engine.py:231-237` (REV.2 mục #8) — app khác phá key không kèm revision vừa miss hoàn toàn vừa chạy trước khi materialize xong.
- `window` nhận Strict `{5m,15m,30m,1h}` (`views.py:273-275`, `session_facts_engine.py:56-61`); param `bucket` nếu truyền phải map đúng hoặc `400 UNSUPPORTED_WINDOW` — **không fallback êm về 15m** như `:368` hiện nay. `1m` không được hỗ trợ.
- **Không paginate CVD**: 1 phiên bị chặn bởi `trade_date`/`window`, số bucket hữu hạn; `next_cursor` không xuất hiện. cursor base64 `{ts,id}` chỉ dùng ở whale feed.
- Route `/core/v1/orderflow/{symbol}/cvd/` và `.../trades/` mount để trả `501 {reason:"not_provisioned", source:"live_aggressor"}` — đây là hợp đồng "aggressor live", **không phải** tape đã hydrate (`/core/v1/market-data/intraday-tape/{symbol}/` ở `market_data/views.py:426-498`, widget đã dùng `VNInvestClient.ts:264`). Gắn `@extend_schema` + cập nhật `packages/web/src/adapters/core/__tests__/core-route-manifest.json`.
- 200 + `cvd_series:[]` + `data_status` (`views.py:378-406`) vẫn là "có nguồn nhưng rỗng", không phải 501.

## D5 — Hợp đồng chung (chốt lại)

| Mục | Chốt | Bằng chứng |
|---|---|---|
| Múi giờ | Response giữ `+07:00`; input chấp nhận `Z`/`+00:00`/`+07:00` rồi normalize | `views.py:418`, `native_views.py:360`, `tests/test_session_facts_api.py:377` |
| `revision` | Whale: `MAX(executed_at)` epoch s · CVD: `int(computed_at.timestamp())`; empty = `0`; `updated_at` = `dj_timezone.localtime(...).isoformat()` (empty = `null`) | `signal_intelligence/models.py:95`, `market_serving/models.py:101`, `settings.py:354-356` |
| Cursor | Whale keyset `{executed_at, pk}` base64; `next_cursor:null` = hết; **không có 409** | `pagination.py:35-59` (chỉ DRF cursor), `native_views.py:1091-1161` |
| `limit` | Whale default 50 / max 1000; CVD không paginate | `native_views.py:349`, `market.js:584-587` |
| Bucket rỗng | Bỏ hẳn bucket (không 0, không null) | request `:81` cấm gán 0 giả |
| Status | `501` chưa provision · `200`+`[]`+`data_status` rỗng · `400` params sai | `views.py:378-406` |
| CORS | Thêm `https://charts.edusuccess.vn` vào `CORS_ALLOWED_ORIGINS` **trong `/opt/vninvest/compose.staging.env`** (production đọc 100% env: `settings.py:452-459`; default localhost chỉ khi DEBUG `:446-451`). Test phải `@override_settings(CORS_API_DYNAMIC_ALLOW=False)` nếu không `OPTIONS 200` PASS giả vì dynamic allow `:462` + `apps.py:4-10` | — |
| WS auth & protocol | Subscribe: `{action:"subscribe", symbols:[...], events?:["whale_order","orderflow_delta"]}` (`consumers.py:174-200` hiện chỉ có `symbols`). Chỉ gửi `not_provisioned` cho event được **opt-in**, không gửi bừa làm lỗi `ticker_update`. Event mới chỉ cho connection mint bằng **ticket**; machine PAT cần scope `ws:realtime` (`views_ws_ticket.py:44-45`), **human session ticket vẫn dùng bình thường** (`ws_ticket.py:78-93`) — không chặn nhầm. Cần `auth_method: "ticket"|"token"` trong kết quả `resolve_user_from_ws_query()` để phân biệt | — |
| Scope/throttle | Whale `market:read` (`native_views.py:345-346`), CVD thêm `market:read`, alias `/core/v1/whale-feed` giữ `signals:read` (`views.py:1025`); assert 403/429 | — |
| SLA | Bỏ `<1s`/p95; thay freshness đo được + probe staging | `realtime_prefetch.py:32-34,43-44` |

---

## 5. Phạm vi implement + gate

**Lessons áp dụng:** [L-V01, L-V02, L-V04, L-T01, L-T02, L-F04, L-F07] — checklist ở đầu doc đã tick.

| # | File | Thay đổi | Test fail-before |
|---|---|---|---|
| 1 | `signal_intelligence/order_flow_engine.py:244-256` | lọc `UNKNOWN` + chỉ giữ per-tick trước khi ghi canonical | test canonical không có side `sell` giả |
| 2 | `signal_intelligence/tasks.py:280-281` | bỏ ép `UNKNOWN→sell` (để filter ở #1 chặn) | test detect with UNKNOWN |
| 3 | `signal_intelligence/views.py:354-360` | `normal→small`, hằng số ngưỡng dùng chung | unit `_whale_size_class` |
| 4 | `market_serving/native_views.py` (mới helper + `:340-362`) | builder chung, **lọc `whale_tick:`**, default session gần nhất, `session_date` clamp, empty state, 8-field summary + invariant, `localtime()`, freshness, keyset cursor, 501 | contract flat + alias + 501 body + 8 field |
| 5 | `signal_intelligence/views.py:1010-1058` | adapter từ builder: envelope + side HOA + scope cũ | test cũ `test_signal_intelligence_api_routes.py:107-114` vẫn xanh |
| 6 | `market_serving/views.py:91-105,340-435` | `delta/revision/unit/source/trade_count` ở **cả 2 nhánh**, scope gate, **cache key kẹp revision**, strict window, `localtime()` | test fields + 403 + 400 + 200-empty |
| 7 | `market_serving/session_facts_engine.py:93-101,124-127,231-252` | fix `else:sell`, **chặn row `tick_session:`**, windows (bỏ ý định invalidate cache) | test không cộng trùng aggregate + fresh session |
| 8 | `market_serving/urls.py` + `@extend_schema` | mount 2 route 501 | resolver + OpenAPI gate |
| 9 | `signal_intelligence/consumers.py:174-200` + `identity_access/ws_ticket.py:78-93` | `events[]`, control `not_provisioned`, `auth_method` | consumer test opt-in, không spam |
| 10 | `/opt/vninvest/compose.staging.env` (VPS) + test CORS | allow-list domain; test `override_settings(DYNAMIC=False)` | preflight 200 thật |
| 11 | `packages/web/src/adapters/core/__tests__/core-route-manifest.json` | cập nhật route mới | manifest gate |
| 12 | `packages/core/backend/src/market_serving/tests/test_native_views.py`, `tests/test_session_facts_api.py`, `tests/test_signal_intelligence_api_routes.py` | test mới | đỏ trước, xanh sau |

**G0 — probe bắt buộc TRƯỚC khi code (CHƯA CHẠY):** trên VPS `14.225.255.47` (repo `/opt/vninvest`, env `compose.staging.env`) chạy 1 lô query read-only:
1. `market_data_intraday_tick`: phân bố `price` theo `source` (biệt `18.20` nghìn đồng vs `50000` VND — `test_native_views.py:36-52` vs `test_order_flow_dark_value.py:52`) + tỷ lệ `side='UNKNOWN'`. Nếu có nguồn lưu nghìn đồng, normalize về VND trước khi nhân — nếu không, mọi classification sai 1000×.
2. `signal_intelligence_whalealertcanonical JOIN unified_alert`: `GROUP BY source_ref prefix` (`whale_tick:` / `tick_session:` / `order_flow:` / rỗng) + `MAX(executed_at)` + count clamp 5B. Nếu có row `tick_session:` ⇒ bắt buộc filter ở #4/#7; không được xoá dữ liệu, chỉ lọc trên đọc.
3. Kiểm tra `session_facts_engine.py:93-101` hiện có đang cộng row `tick_session:` vào CVD hay không (so sánh `SUM(matched_value)` theo prefix).

**Gate sau code:** `manage.py test market_serving signal_intelligence data_ingest` trên Postgres DB riêng · `makemigrations --check --dry-run` = "No changes detected" · `node packages/web/scripts/check-multi-agent.mjs` 0 lỗi · `node scripts/check-lessons.mjs` 0 (không sửa `docs/LESSONS/` trong slice này) · contract test trên staging `https://charts.edusuccess.vn`. **Hiện CHƯA CHẠY** (chưa sửa source).

**Non-goal:** không migration; không xây pipeline tick realtime; không đổi retention lên 30 ngày; không tắt dynamic CORS trong slice này; không sửa repo widget.

## 6. Logverify review (nguyên văn, L-V02/L-T02)

- P0-1 ✅ `VNInvestClient.ts:238-244` `"summary" in data && "whale_orders" in data` → `:1030` return raw; `WhalePanel.tsx:31-36` đọc 6 field; `lib/types/vninvest.ts:72-81` đủ 8. **Có thật.**
- P0-2 ✅ `tasks.py:281` ép UNKNOWN→sell; `order_flow_engine.py:31,244-256` ngưỡng 500M; example 2.94B/whale sai. **Có thật.**
- P0-3 ✅ `session_facts_engine.py:122-127` VND + `else:sell`; `views.py:358-359` thiếu scope; `views.py:386` cache key; `order_flow_engine.py:41,231-237` prefix khác. **Có thật.**
- P0-4 ✅ `consumers.py:174-200` chỉ `symbols`; `ws_ticket.py:78-93` trả User; `views_ws_ticket.py:44-45` human path unchanged. **Có thật.**
- P1 ✅ `market_data/views.py:426-498` tape có sẵn; widget `VNInvestClient.ts:264` đã dùng; `settings.py:446-462` CORS; `market.js:584-587` contract cũ; price unit 2 fixture trái ngược. **Có thật.**
- P2 ✅ REV.1 trích `native_views.ts:120` (phải là `nativeShapes.ts:120`), `pagination.py:35-59` không có helper 409, `session_facts_engine.py:56-61` materialize 4 window. **Có thật — đã sửa ở REV.2.**

**REV.2.1 verify (tự mở code, không tin review):**
- P0-N1 ✅ `settings.py:855-874` 2 beat task mỗi 300s; `tasks.py:285` ghi `whale_tick:`; `tasks.py:149` ghi aggregate `tick_session:`; `materializers.py:925-928` ghi vào **cùng bảng**, `matched_value = min(5B,...)` `:811`, `executed_at = triggered_at` `:813`. **Có thật — lọc cứng + G0 mở rộng.**
- P1 ✅ `VNInvestClient.ts:1029` gọi bare URL (không `from/to`) + `signal_intelligence/models.py:101-104` không index `executed_at` + `settings.py:354-356` `USE_TZ=True` ⇒ `.isoformat()` trả `+00:00`. **Có thật.**
- P1 ✅ ví dụ `buy_value:0` trong khi `shark_buy:2.94B` sai; `min_value` clamp `[0,5B]` sai vì canonical không lưu <500M; `_build_empty_cvd_payload()` `views.py:91-105` thiếu field mới. **Có thật — đã sửa.**
- P1 ✅ cache key kẹp revision thì tự miss; xoá cache từ app khác (`order_flow_engine.py:231-237`) vừa miss vừa chạy sai thứ tự. **Có thật — bỏ mục #8.**

**Next:** sau khi Owner/Issuer chuyển lệnh triển khai → mở claim + branch `feat/whale-cvd-contract-be`, chạy G0 (3 query), viết test đỏ trước, code theo bảng **14 path**, re-audit rồi PR. Audit plan vòng 1 = NEED_REVISION (5 objection nhỏ) — đã sửa ở `docs/PLAN_WHALE_CVD_CONTRACT_BE_20261124.md`, chờ re-audit vòng 2.
