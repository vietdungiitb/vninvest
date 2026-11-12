# BÀN GIAO CHO ĐỘI BACKEND `vninvest` — 6 hạng mục demo-grade cho Enterprise widget

> **Bản đặt trong repo `vninvest`** để đội backend theo dõi trong PR. Bản gốc: `vninvestcharts-widget/docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md`.
> Mọi `file:line` trong tài liệu là **đường dẫn tương đối từ `packages/core/backend/src/`** trong repo này — ví dụ `market_serving/native_views.py:540` = `packages/core/backend/src/market_serving/native_views.py:540`.

**Ngày:** 2026-11-12 · **Từ:** chart widget team (`vninvestcharts-widget`) · **Đến:** đội backend `vninvest`
**Trạng thái:** đã được PM duyệt (2026-11-12) · **Phạm vi:** backend `vninvest` (Django/DRF, `packages/core/backend/src`)
**Quy ước bằng chứng:** mọi khẳng định kèm `file:line` — verify ngày 2026-11-12 trong repo `vninvest`.

---

## 0. Tóm tắt — 6 hạng mục

| ID | Hạng mục | Effort | Vì sao cần | Mở capability widget | Phụ thuộc |
|---|---|---|---|---|---|
| **B-1** | Mount 2 route: `realtime/whale-campaigns/` + `realtime/unified-alerts/` | **S** | Code đã có sẵn ~600L, chỉ thiếu route ⇒ demo không mở được capability | `whale_campaign` (demo) | — |
| **B-2** | `realtime/depth-chart/`: bỏ dữ liệu giả | **S/M** | `is_mock:true` — vi phạm Rule 15 + rủi ro uy tín khi demo cho khách B2B | `orderbook_dom` (demo) | Q-B1 |
| **B-3** | Corporate actions + `adj_close` (hoặc trả `adjusted:false` + `note`) | **M** | Chỉ báo sai số quanh ngày chia cố tức ở **mọi tier kể cả Free** | `adjusted_bars` | Q-B2 |
| **B-4** | Fundamentals: contract ổn định (typed, key cố định, `period` linh hoạt, cash_flow nếu có) | **M** | Client không bind chắc chắn vào field nào ⇒ widget không dám mở capability | `fundamentals_full` | Q-B3 |
| **B-5** | Data hygiene: số là số, timestamp Unix ms, timeframe canonical, envelope `code` bắt buộc | **S** | Widget parse sai âm thầm (string vs number, 2 contract OHLCV, 3 bảng timeframe) | tất cả | — |
| **B-6** | *(P0 của chính `vninvest`, ngoài scope demo)* enforce PAT scope + đóng OpenAPI public | **M** | PAT `scopes=[]` đọc được toàn bộ market data + signals; schema công khai không auth | an toàn bán B2B | — |

**Tổng B-1..B-5: ~2.5–3 tuần** (1 backend dev). B-6 chạy song song (P0 của chính vninvest).

**Cần chốt TRƯỚC khi code:** (1) shape data ở §2 + §3, (2) 4 câu hỏi Q-B1..Q-B4 ở §8.

---

## 1. Bối cảnh tối thiểu (đọc trước khi code)

- **Tôn chỉ:** widget là sản phẩm khách **thuê bao + nhúng vào hệ thống của họ**; widget cung cấp **TÍNH NĂNG**; **dữ liệu là của khách hàng**. ⇒ `vninvest` là **backend demo/reference**: đủ để demo enterprise features + làm reference implementation cho adapter. **KHÔNG phải** sản phẩm dữ liệu ⇒ **không cần** build data platform, không cần theo kịp bản "Enterprise" của TradingView.
- **Ai làm gì:** `vnsaas` (saas.edusuccess.vn) bán tier → **widget** bán feature set + adapter → khách implement adapter theo **contract generic** của widget và nối backend riêng của họ.
- **Vì sao cần bạn lúc này:** widget team đang build E0–E5 **song song** (adapter contract generic, rồi tới từng capability). Cần **contract data ổn định** để viết adapter + demo. Bạn **không** cần làm hết EP của spec 09-28 — phần đó viết cho `vninvest` như sản phẩm dữ liệu (đã over-scoped, xem §4).
- **Cách kiểm chứng:** mỗi hạng mục có AC + test trong repo bạn; widget team đo **từ ngoài** trên staging `https://charts.edusuccess.vn` (Rule 17) và báo kèm ảnh/DOM text.

---

## 2. Hạng mục chi tiết

### B-1 — Mount 2 route (code đã có sẵn) · effort S

**Hiện trạng (verify 11-12):**
| Thứ | Bằng chứng |
|---|---|
| `RealtimeUnifiedAlertsView` — "Serve legacy unified-alerts contract from native core signal tables" | `market_serving/native_views.py:540-541`, `get()` `:558`, trả 400 khi cursor sai `:574` |
| `RealtimeWhaleFeedAggregateView` (kế thừa unified-alerts) | `market_serving/native_views.py:910-913` |
| `RealtimeWhaleCampaignsView` — "Serve legacy whale-campaigns contract from core canonical whale events" | `market_serving/native_views.py:1371-1374` |
| **Nhưng `market_serving/urls.py` chỉ mount 13 route** (file 35 dòng, đọc đủ) | `market_serving/urls.py:18-34` — **không có** `unified-alerts` lẫn `whale-campaigns` |

⇒ **~600L code đang chết**: demo không mở được capability whale-campaign dù view đã viết xong.

**Việc cần làm**
1. `market_serving/urls.py`: import 2 view vào block `from .native_views import (...)` (`:4-15`) + thêm 2 `path(...)` theo đúng pattern route hiện có (`realtime/whale-feed-aggregate/<str:symbol>/` ở `:31`).
2. Giữ nguyên semantics cursor/pagination của unified-alerts (`:558-574`).
3. Test: thêm vào `market_serving/tests/test_native_views.py` (file này đã có pattern test whale-feed-aggregate + reverse() + assert URL + assert 401/403 — xem `:153-217`).

**AC**
- `GET /core/v1/realtime/whale-campaigns/<symbol>/` → 200 + payload campaign; 401 khi không PAT; 400 `code=invalid_query` khi cursor sai.
- `GET /core/v1/realtime/unified-alerts/` → 200.
- **Không** thay đổi bất kỳ route cũ nào.

---

### B-2 — `depth-chart`: bỏ dữ liệu giả · effort S/M

**Hiện trạng:** `RealtimeDepthChartView` — `market_serving/native_views.py:429`; docstring tự thừa nhận **"order book depth (mock implementation)"** (`:430`); sinh 3 bậc bid/ask từ snapshot với seed tất định theo symbol+ngày (`:469-478`); response có `is_mock: True` (`:451`), `data_quality: 'estimated'` (`:452`), `source: 'synthetic_from_snapshot'` (`:453`); nhánh "không có snapshot" cũng trả `is_mock: True` (`:522`) + `synthetic_from_snapshot` (`:524`).

**Vì sao:** demo bán cho khách B2B là hợp đồng niềm tin — khách sẽ nối backend thật của họ, nên demo có số giả là rủi ro thương mại, không chỉ vi phạm Rule 15 ("cấm fake dữ liệu production").

**2 lựa chọn — cần Q-B1:**
- **(a) Có nguồn order book thật** → thay bằng feed thật; bỏ `is_mock`; thêm `data_quality: 'live'`; giữ shape `{symbol, bids:[{price,size}], asks:[...], spread, timestamp}`.
- **(b) Chưa có nguồn** → **bỏ route khỏi demo** và dùng `realtime/price-board/<symbol>/` (`market_serving/urls.py:27`) + `session-facts/<symbol>/` (`:22`) thay cho DOM; widget sẽ **degrade trung thực** chứ không hiện số giả. *(Phương án này đã được ghi trong spec 09-28 `SPEC_VNINVEST_BACKEND_API_PROPLUS_2026-09-28.md:1331-1332`: EP-3 không phụ thuộc kỹ thuật nhưng phụ thuộc thương vụ — không có nguồn thì báo lại để đổi sang session-facts.)*

**AC**
- Nếu (a): không còn chuỗi `is_mock` / `synthetic_from_snapshot` trong response; có test assert payload **không** chứa `is_mock: true`; nếu endpoint không có dữ liệu ⇒ trả `bids: []`, `asks: []`, `note` (không bịa).
- Nếu (b): route bị gỡ khỏi `urls.py`; widget team được thông báo để tắt capability `orderbook_dom` trong demo (widget sẽ tự degrade — không cần code thêm).

---

### B-3 — Corporate actions + `adj_close` · effort M

**Hiện trạng:** grep toàn backend `adj_close|corporate_action|adj_factor` → **0 match** ⇒ không có nguồn điều chỉnh. Bars hiện trả `{timestamp, open, high, low, close, volume}` — **không** có `adj_close` (audit 09-28 §3.3).

**Vì sao (hạng mục quan trọng nhất về chất lượng):** thiếu nó thì chỉ báo sai số quanh ngày chia cố tức **ở mọi tier, kể cả Free** — spec 09-28 gọi đây là *"Blocker tuyệt đối"* (`SPEC_VNINVEST_BACKEND_API_PROPLUS_2026-09-28.md:25`). Đây là hạng mục **fix chất lượng dữ liệu**, không chỉ mở khóa enterprise.

**Việc cần làm — chọn 1 trong 2 (cần Q-B2):**
- **(a) Có nguồn corporate actions** (vnbroker / KBS / SSI) → model `CorporateAction` (`symbol`, `action_type ∈ {dividend, split, rights, bonus}`, `ex_date`, `ratio`, `amount`, `currency`, `source`, `fetched_at`) + endpoint `GET /core/v1/stock-management/stocks/<symbol>/corporate-actions/` + trả `adj_close` trong bars.
- **(b) Chưa có nguồn** → trong bars trả `adjusted: false` + `note` giải thích (theo spec 09-28 `:576`: *"backend chưa điều chỉnh"*) ⇒ widget degrade trung thực, **không** tự suy đoán `adj_close` từ giá.

**AC**
- Bars có `adjusted` (boolean) và (`adj_close` | `note`); test trên 1 symbol có corporate action thật; `adj_close` **không** dùng giá trị suy đoán.

---

### B-4 — Fundamentals: contract ổn định · effort M

**Hiện trạng:** `GET /core/v1/stock-management/stocks/<symbol>/financials/` (`market_data/core_urls.py:73`; mount thứ 2 ở `market_data/public_urls.py:75`) → `StockManagementFinancialsView` (`market_data/stock_mgmt_native_views.py:3286-3313`) → `get_company_financials_response` (`market_data/vnbroker_adapter.py:1323`) → `fetch_company_financials` (`:1215`) với **cứng `period='quarter'`** cho cả 3 bảng: ratio (`:1226`), income (`:1239`), balance (`:1252`); **không có cash_flow** (grep `cash_flow|cashflow` 0 hit).
⇒ Client phải thử nhiều tên khả năng (`market_data/screener_helpers.py:331-360`) ⇒ **không bind chắc chắn**; đây là lý do widget chưa mở `fundamentals_full`.

> **Không cần tạo model `StockFundamental`** — đã bị remove ở `market_data/migrations/0006_remove_stockfundamental.py` (migration `0005_add_stock_fundamental.py` là lịch sử). **Đừng làm theo EP-4 cũ trong spec 09-28** ở phần "model StockFundamental".

**Việc cần làm:** chốt shape **cố định** + typed (drf-spectacular `response_serializer`); `period` nhận `quarter|year`; có `cash_flow` thì trả, không có thì `null` + `note` (xem Q-B3); số là số, thiếu thì `null` (không `""`).

**AC**
- OpenAPI có schema cho endpoint (không phải `{}`); response có key cố định (vd `ratios`, `income_statement`, `balance_sheet`, `cash_flow`); `?period=year` hoạt động hoặc trả 400 `code=invalid_query`; không còn dict mở.

---

### B-5 — Data hygiene cho adapter · effort S

**Hiện trạng (verify 11-12):**
| Vấn đề | Bằng chứng |
|---|---|
| `price` là **string** (Decimal) còn `change_pct` là float ⇒ `"0.0" == 0` là `false` trong JS | `market_serving/native_views.py:54-68` (quote single), `:102-120` (batch) |
| **2 contract khác nhau cho cùng dữ liệu OHLCV**: `/chart/` trả `date` (ISO string) + `volume` float; `/bars/` trả `timestamp` (Unix ms) + `volume` int | `market_data/core_urls.py:62` vs `:74` |
| **3 bảng timeframe mâu thuẫn**; `30m` hợp lệ ở `/chart/` nhưng **400** ở `/bars/` | spec 09-28 §1.4 (`:97-111`) |
| OpenAPI không mô hình hóa lớp nginx rewrite `/api/*` → `/core/v1/*` ⇒ mô tả sai mọi `/api/*` | spec 09-28 `:39` |

**Việc cần làm** (theo Q1/Q2/Q4 của spec 09-28 `:52-111`): số luôn là **JSON number**; timestamp luôn **Unix ms**; timeframe theo enum canonical case-sensitive (`1m 5m 15m 30m 1H 2H 4H 6H 12H D W M Q Y`); nullable dùng `null`; envelope lỗi giữ nguyên `{detail, code, timestamp, request_id, field_errors}` với `code` bắt buộc ở mọi 4xx/5xx.

**AC:** 1 endpoint chuẩn hoá (bars) + test assert **kiểu** của `price`/`close` là number; 3 bảng timeframe gộp còn 1; không dùng `Decimal`/string cho số.

---

### B-6 — P0 của chính `vninvest` (ngoài scope demo, nhưng chặn bán B2B) · effort M

| Vấn đề | Bằng chứng |
|---|---|
| **PAT scope không enforce**: hàm `require_pat_scopes_or_human_session` có sẵn nhưng chỉ được gọi với scope `manage_tenant` ⇒ PAT `scopes=[]` vẫn đọc được market data + signals + financials | `identity_access/commercial_partner_views.py:49,72,102,136,187,239,280,311` (8 chỗ, đều `manage_tenant`); scope khai ở `identity_access/serializers.py:11-26` |
| **OpenAPI + Swagger public, không auth**: route đăng ký **vô điều kiện** (comment nói "chỉ DEBUG hoặc internal" nhưng không có `if settings.DEBUG`) + middleware cho vào danh sách miễn auth | `vninvest_core/urls.py:56-58`; `identity_access/middleware.py:41-43` (và `:333-335` cho quota-exempt) |
| **`/api/admin-ops/*` hứa 410 GONE nhưng luôn trả 401** | spec 09-28 `:363` |
| **SSE bị nginx cắt sau 120s** (chỉ `/api/soc/*` có 300s) | `frontend/docker/nginx.conf:201` |
| Không `Retry-After`, `X-RateLimit-*` chỉ set khi PAT hợp lệ | spec 09-28 `:362` |

**Việc cần làm:** enforce scope theo nhóm endpoint (`market:read` cho market data, `signals:read` cho signal, `ai:invoke` cho advisory); đóng schema khi `DEBUG=False` (hoặc bắt auth); thêm `Retry-After` + `X-RateLimit-*`; nginx timeout riêng cho SSE.

**AC:** PAT không có scope ⇒ 403 với `code=permission_denied`; `/core/v1/schema/` ⇒ 404/403 khi `DEBUG=False`; probe **từ ngoài** (không header) phải **không** trả 200.

---

## 3. Contract data widget cần (để 2 team làm SONG SONG)

Bảng dưới là **contract của backend demo** để widget team viết adapter. **KHÔNG phải** contract khách hàng phải tuân theo — khách implement theo **contract generic** của widget (E0); `vninvest` là **reference implementation** + bộ test tuân thủ (conformance kit).

| Capability widget | Endpoint demo hiện có | Shape (rút gọn) | Trạng thái |
|---|---|---|---|
| `deep_history` | `GET /core/v1/stock-management/stocks/<symbol>/bars/` (`market_data/core_urls.py:74`) | `{bars:[{timestamp,o,h,l,c,v}], has_more_before, has_more_after, next_before, next_after}` | ✅ contract tốt nhất — **giữ nguyên** |
| `realtime_tick` | `GET /core/v1/realtime/ticker/<symbol>/` (`market_serving/urls.py:24`) + `/tickers/` (`:25`) | `{symbol, price, current_price, prev_price, change_pct, volume, market_status, stale, fetched_at}` | ⚠️ `price` là string ⇒ **B-5** |
| order-flow (vertical) | `realtime/whale-feed/<symbol>/` (`:29`) + `whale-feed-aggregate` (`:31`) + `session-facts/<symbol>/` (`:22`) | `{symbol, session_date, cvd_normalized, delta_strength_pct, buy_strength, institutional_strength, whale_net_flow, dark_flow_score, ...}` | ✅ |
| `whale_campaign` | `realtime/whale-campaigns/<symbol>/` | campaign clusters | ❌ **B-1** (view có, route chưa mount) |
| `orderbook_dom` | `realtime/depth-chart/<symbol>/` (`:34`) | `{symbol, bids:[{price,size}], asks:[...], spread, timestamp}` | ❌ **B-2** (mock) |
| `fundamentals_full` | `stock-management/stocks/<symbol>/financials/` (`core_urls.py:73`) + `overview/` (`:61`) + `news/` (`:65`) + `news/ai-summary/` (`:66`) | typed, key cố định | ⚠️ **B-4** |
| `adjusted_bars` | `stock-management/stocks/<symbol>/bars/` + corporate actions | `adj_close` hoặc `adjusted:false`+`note` | ❌ **B-3** |
| `cloud_alert` | `stock-management/price-alerts/` CRUD + `<pk>/mark-triggered/` (`core_urls.py:56-58`) | alert CRUD | ✅ |
| `server_workspace` | `workspace/portfolios/*` + `workspace/watchlists/` (`user_workspace/urls.py:52-73`) | portfolio / watchlist | ✅ |
| alert center | `signals/alert-center/*` + SSE stream (`signal_intelligence/urls.py:6-13`) | UnifiedAlert | ✅ |
| `index_constituents` | — | — | ❌ ngoài scope demo (E4) |

**Ràng buộc quan trọng:** khi thêm/sửa endpoint cho demo, **giữ nguyên** các route widget đang dùng (bars, ticker(s), whale-feed, session-facts, price-alerts, workspace, financials, overview, news). Đổi shape ⇒ báo widget team **trước** để không hỏng adapter đang viết.

---

## 4. Ngoài phạm vi (defer) — đừng làm lúc này

| Item | Lý do defer |
|---|---|
| Namespace mới `/core/v1/<domain>/v1/` + typed schema **toàn repo** | Over-scoped cho backend demo; giữ endpoint cũ, chỉ typed endpoint mình chạm |
| `cash_flow` model + history + đa kỳ | Cần nguồn (Q-B3); làm sau |
| Paper OMS server-side (EP-10) | Widget đã có paper trading client-side production-grade; server OMS không cần cho demo |
| Server Pine / deep backtest (EP-9) | E4; cần dữ liệu sạch (EP-1 + EP-4) |
| Tick/second ingest + `bar_update` (EP-7) | Cần nguồn tick (Q-B4) |
| Index constituents (EP-6) | E4 |
| Sửa bảng timeframe/metric duplicate **toàn repo** | Làm dần, chỉ endpoint mình chạm (B-5 scope hẹp) |

---

## 5. Quy tắc bắt buộc (giữ nguyên khi làm)

1. **Rule 15 — không trả dữ liệu giả/synthetic** trong production lẫn demo. Thiếu dữ liệu ⇒ `null`/`[]` + `note`/`data_quality` ⇒ widget degrade trung thực.
2. **Không breaking contract:** giữ endpoint cũ, thêm endpoint/field mới; đổi shape ⇒ báo widget team trước.
3. **Số là số** (JSON number) · **timestamp Unix ms** · **timeframe canonical** case-sensitive · **nullable = `null`** (không `""`, không `0` giả).
4. **Envelope lỗi** giữ nguyên `{detail, code, timestamp, request_id, field_errors}`; `code` bắt buộc ở mọi 4xx/5xx; dùng lại mã có sẵn (`unauthenticated`, `permission_denied`, `not_found`, `invalid_query`, `invalid_timeframe`, `plan_limit_exceeded`, `quota_exceeded`, `rate_limited`, `data_unavailable`, `not_implemented`, `upstream_unavailable`, `validation_failed`).
5. **Typed schema** cho endpoint mới/đổi (`response_serializer` + `@extend_schema`): `python manage.py spectacular --file openapi.json` ⇒ **0 warning**; schema phải là `$ref`, không phải `{}`.
6. **Cursor pagination** (`page.next_cursor`, `has_more`, `limit`), không offset.
7. Auth + quota theo plan hiện có (`commercial/plan_catalog.py:62-99`); **không** nới trong demo.
8. Test trong repo bạn, **fail-before → pass-after**; không sửa test cũ để làm xanh.

---

## 6. Định nghĩa xong (DoD) + cách kiểm chứng

Mỗi hạng mục xong khi:
1. Test tự động trong repo backend (`market_serving/tests/`, `market_data/tests/`) — **fail-before → pass-after**, lệnh tái hiện ghi trong PR.
2. `python manage.py spectacular --file openapi.json` → **0 warning** cho endpoint liên quan.
3. Không còn chuỗi `is_mock` / `synthetic_from_snapshot` ở endpoint đã đổi.
4. Widget team đo **từ ngoài** staging `https://charts.edusuccess.vn` (Rule 17) — báo kèm ảnh + DOM text.

Lệnh gợi ý:
```bash
python manage.py test market_serving market_data
python manage.py spectacular --file openapi.json
curl -s -H "Authorization: Bearer $PAT" https://<host>/core/v1/realtime/whale-campaigns/VNM/
curl -s -H "Authorization: Bearer $PAT" https://<host>/core/v1/stock-management/stocks/VNM/bars/?timeframe=D
```

---

## 7. Timeline gợi ý (song song với widget team)

| Tuần | Backend | Widget (để bạn biết mình đang chờ gì) |
|---|---|---|
| 1 | **B-1** (route) + **B-5** (hygiene) + trả lời Q-B1..Q-B4 | E0 — contract generic + tách reference impl |
| 2 | **B-2** (depth) + **B-4** (fundamentals) | E1 — bars/tick + whale overlay |
| 3 | **B-3** (corporate actions) + **B-6** (security P0) | E2 — DOM/fundamentals panel |

---

## 8. Câu hỏi cần backend trả lời (chặn B-2 / B-3 / B-4)

| # | Câu hỏi | Chặn |
|---|---|---|
| **Q-B1** | Có nguồn **order book thật** không (SSI/TCBS/KBS/snapshot)? Nếu **không** → chọn phương án (b) bỏ khỏi demo | B-2 |
| **Q-B2** | Nguồn **corporate actions** nào khả dụng (vnbroker/KBS/SSI)? Có đủ split/rights/bonus không? | B-3 |
| **Q-B3** | Nguồn financials có **cash_flow** và kỳ **year** không, hay chỉ quarter? | B-4 |
| **Q-B4** | Có nguồn **tick/second** để demo realtime sub-second không? | E4 (không chặn demo) |

---

*Người nhận: đội backend `vninvest`. Nguồn: `vninvestcharts-widget/docs/ROADMAP_ENTERPRISE_VNINVEST_BACKEND_CONSOLIDATED_2026-11-12.md` (§3.1–§3.3, §5.6–§5.7, §6.2) + `SPEC_VNINVEST_BACKEND_API_PROPLUS_2026-09-28.md` (Q1–Q9, EP-0..EP-10) + audit 09-28 / 11-08 / 11-10. Mọi `file:line` verify ngày 2026-11-12 trong repo `vninvest` (đường dẫn tương đối từ `packages/core/backend/src/`).*
