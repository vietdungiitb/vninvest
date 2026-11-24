# AUDIT + PHẢN BIỆN — YÊU CẦU BE Whale/CVD realtime cho VNInvestCharts

- **Ngày audit:** 2026-11-24 · **Phạm vi:** doc `vninvestcharts-widget/docs/requests/BE_REQUEST_WHALE_CVD_REALTIME_2026-11-24.md` (push lên `origin/dev`, tạo ở commit `72ac0bdb`, HEAD `13e4da81`) đối chiếu với code thật của **cả hai** repo.
- **Ref đã đọc:** `vninvest@dev` = `9d1258a0e` (working tree sạch trước audit) · `vninvestcharts-widget@origin/dev` = `13e4da81` (working tree bẩn — xem §E); file:line của widget được lấy từ doc's commit `72ac0bdb` và đối chiếu `dev` HEAD.
- **Người nhận:** widget team + đội backend `vninvest` + Owner (chốt các câu hỏi §F).
- **Phương pháp:** grep/glob/read toàn repo (kể cả `.py`, `.ts/.tsx`, `.json`, settings, i18n, docs) — tuân thủ khung audit cứng trong `AGENTS.md`; không chạy code, không sửa source.

## Tóm tắt 5 phát hiện nghiêm trọng nhất (1 đoạn)

Yêu cầu có **ý đồ đúng** (Rule 15 — không bịa data: `vninvestcharts-widget/AGENTS.md:98,101`) và phần lớn bằng chứng hiện trạng widget là có thật, nhưng **chưa đủ điều kiện để giao code**: (1) BE **đã có** dạng `whale_orders[{ts,price,volume,matched_value,side,size_class}]` ở `/core/v1/whale-feed` (`signal_intelligence/views.py:1036-1058`) — yêu cầu tạo thêm dạng thứ 4 là vi phạm SSOT; (2) `size_class` có **3 bộ enum không tương thích** (request `whale|shark|large|small` :39 / BE `whale|shark|normal` `views.py:354-360` / widget `small|shark|whale` `src/lib/types/vninvest.ts:59`) kèm 3 bộ ngưỡng; (3) nguồn aggressor thật duy nhất là `IntradayTick.side` (`market_data/models.py:285-310`) còn Whale/OrderFlow side là suy từ aggregate — SLA **< 1s từ khớp lệnh** không có bằng chứng và Q-B4 vẫn mở (`docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:225`); (4) path CVD `/core/v1/orderflow/{symbol}/cvd/` **không tồn tại**, endpoint thật `/core/v1/session-facts/{symbol}/cvd/` đã trả `buy_volume`/`sell_volume` (`views.py:422-423`) nhưng lấy từ whale aggregate, không phải tick toàn thị trường; (5) yêu cầu UTC `Z` / 501 `not_provisioned` / limit 200-1000 xung đột với hợp đồng hiện hữu (`views.py:418` trả `+07:00`, `views.py:378-406` trả 200-rỗng, `native_views.py:349` default 50/max 200). **Verdict: chưa implement được; cần Owner chốt 5 quyết định §F trước khi mở ticket.**

---

## 0. Nguồn & phương pháp

| Nguồn | Vai trò | Ref |
|---|---|---|
| `vninvestcharts-widget/docs/requests/BE_REQUEST_WHALE_CVD_REALTIME_2026-11-24.md` | Đối tượng audit | tạo `72ac0bdb`, không đổi tới `13e4da81` (`git log`/`git diff --stat` đầu rỗng) |
| `vninvest/docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:31-34,171,225` | Quyết định PM: vninvest là backend **demo/reference**, không phải data product; Q-B4 mở | đã merge |
| `vninvest/docs/handoffs/HANDOFF_2026-11-22_STOCK_WHALE_BACKFILL_ALL.md:10-18` | Bằng chứng whale detect là **batch/Celery**, không phải tick push | đã merge |

Quy ước trích dẫn: tiền tố `BE:` = repo `vninvest` (`packages/core/backend/src/`), `W:` = repo `vninvestcharts-widget`. Mọi dòng đều kèm `file:line`; không có → ghi **KHÔNG TỒN TẠI**.

## A. Bản đồ kiến trúc (file | dòng | trách nhiệm | ghi chú)

| File | Dòng | Trách nhiệm | Ghi chú bằng chứng |
|---|---:|---|---|
| `BE:market_serving/native_views.py` | 1768 | `RealtimeWhaleFeedView` (alerts-only), whale-feed-aggregate, cursor hand-rolled | `:340-362` response alerts; `:1091-1161` cursor; `:1176-1207` serialize; `:1272-1289` envelope |
| `BE:market_serving/views.py` | 436 | `SessionFactsCvdView` | `:340-435`; `cvd_series` `:416-424`; 200-empty `:378-406` |
| `BE:market_serving/session_facts_engine.py` | 415 | Materialize CVD bucket từ `WhaleAlertCanonical` | `:100-149` cộng buy/sell từ `matched_value` |
| `BE:market_serving/urls.py` | 43 | Mount route | `:23` session-facts cvd; `:31` realtime whale-feed; `:33` whale-feed-aggregate |
| `BE:signal_intelligence/views.py` | 1058 | `WhaleFeedAggregateView` — **đã có** whale_orders | `:1010-1058`; floats `:1039,1041`; enum `:354-360` |
| `BE:signal_intelligence/consumers.py` | 232 | WS `/ws/realtime/` | `:108-232`; auth `:129-136` |
| `BE:signal_intelligence/broadcasting.py` | 147 | Envelope WS + `seq` | `:29-37` Redis INCR; `:40-65` event list |
| `BE:market_data/models.py` | 590 | `IntradayTick` — nguồn aggressor thật duy nhất | `:285-310`, `side` `:291-304` |
| `BE:vninvest_core/settings.py` | 1000 | Auth, throttle, CORS | `:378-381`, `:394-397`, `:443-462` |
| `BE:identity_access/apps.py` | 56 | Dynamic CORS allow-all cho `/core/v1/*` | `:4-10,49-50` |
| `BE:vninvest_core/pagination.py` | 59 | Cursor pagination helpers | `:35-59` |
| `W:src/widget/adapters/VNInvestClient.ts` | 1129 | Endpoint builder + REST client | `:258` whale-feed path; `:1027` `getWhaleFeed` |
| `W:src/widget/adapters/nativeShapes.ts` | 178 | Map native shape, **không bịa field** | `:72-94` order-flow → `cvd_series:[]` `:83`; `:113-130` whale → `whale_orders:[]` `:126` |
| `W:src/widget/adapters/VNInvestDataAdapter.ts` | 765 (working tree) | Domain facade (widget) | `:111-135` whale campaign; `:567-569` `subscribeToTrades` stub |
| `W:src/demo/dataSources/VNInvestDataAdapter.ts` | 119 | Domain facade (demo) | `:59-82` getWhaleEvents → filter/map `whale_orders` |
| `W:src/widget/adapters/VNInvestWebSocketClient.ts` | 329 | WS subscribe-by-symbol + reconnect | `:243-251`; `:310-322` |
| `W:src/widget/components/fork/ForkEngineSurface.tsx` | 473 | Overlay CVD/whale/degraded | `:288-294` externalCVD; `:330-350` degraded badge |
| `W:src/lib/types/vninvest.ts` | 369 | `WhaleSizeClass` union | `:59` = `small\|shark\|whale` |

## B. Luồng dữ liệu đã trace (hiện trạng)

**Whale REST.** `W:VNInvestClient.ts:258` (builder) → `:1027` `getWhaleFeed()` gọi **bare URL, không query params** → `GET /core/v1/realtime/whale-feed/VIC/` → `BE:vninvest_core/urls.py:58` → `BE:market_serving/urls.py:31` → `RealtimeWhaleFeedView.get` `BE:native_views.py:344` → query `UnifiedAlert` `:350` → response `{symbol, alerts[]}` `:351-362` → `W:nativeShapes.ts:113-130` map alerts, **`whale_orders: []` ở `:126`** → `W:src/demo/dataSources/VNInvestDataAdapter.ts:68-81` filter/map trên mảng rỗng → `[]`.

**CVD REST.** Widget `getOrderFlow()` → `/core/v1/orderflow/{symbol}/?window=` → `BE:signal_intelligence/urls.py:18` `OrderFlowEventListView` (`views.py:987-1007`) → `W:nativeShapes.ts:72-94` → `cvd_series: []` `:83`. Song song, BE có sẵn `/core/v1/session-facts/{symbol}/cvd/` (`BE:market_serving/urls.py:23`) → `SessionFactsCvdView` (`views.py:340-435`) → đọc `SessionFactsBucket` materialized từ `WhaleAlertCanonical` (`session_facts_engine.py:100-149`) → `cvd_series[6 field]` `views.py:416-424` — **widget hiện không consume endpoint này**.

**WS.** `W:VNInvestWebSocketClient.ts:243-251` gửi `{action:"subscribe",symbols}` → `/ws/realtime/` (`BE:vninvest_core/asgi.py:38`) → `RealtimeConsumer` (`BE:consumers.py:108-232`) → channel layer → `BE:broadcasting.py:40-65` đóng gói kèm `seq` `:47`. Event list thực tế: `whale_alert` `:61`, `dark_flow_alert` `:63`, `system_alert` `:65`, `ticker_update` `:140` — **không có** `whale_order` / `orderflow_delta`.

## C. CONTRADICTIONS (doc vs code)

| Request (file:line) | Thực tế (file:line) | Tác động |
|---|---|---|
| `size_class ∈ {whale,shark,large,small}` (doc `:39`) | `BE:signal_intelligence/views.py:354-360` = `{whale,shark,normal}`; `W:src/lib/types/vninvest.ts:59` = `{small,shark,whale}` | 3 enum lệch; `large`/`normal` rơi ngoài union type widget |
| "bổ sung `whale_orders[]`" (doc `:14,36`) | `BE:signal_intelligence/views.py:1036-1058` **đã trả** đúng 6 field qua `/core/v1/whale-feed` (`urls.py:17`), bọc `envelope()` (`envelope.py:103-116`) | Tạo hợp đồng whale thứ 4, vi phạm SSOT |
| §0 "backend order-flow map hiện không có field delta" (doc `:8`) | `BE:market_serving/views.py:422-423` **đã có** `buy_volume`,`sell_volume`; chỉ thiếu `delta`,`trade_count`,`revision` | Doc đánh giá thấp dữ liệu sẵn có; endpoint mới một phần trùng lặp |
| `GET /core/v1/orderflow/{symbol}/cvd/` (doc `:61`) | `BE:market_serving/urls.py:23` = `/core/v1/session-facts/{symbol}/cvd/`; grep route orderflow/cvd = **KHÔNG TỒN TẠI** | Route requested không resolve ⇒ 404 nếu widget đổi theo doc |
| `ts`/`bucket_ts` ISO-8601 **UTC**, ví dụ `Z` (doc `:39,81,100`) | `BE:market_serving/views.py:418` `dj_timezone.localtime(...).isoformat()` → `+07:00`; `native_views.py:360` `triggered_at.isoformat()`; test `tests/test_session_facts_api.py:377` kỳ vọng `+07:00` | Đổi format endpoint cũ = breaking; mới UTC + cũ local = 2 múi giờ trên cùng chart |
| `501 {reason:"not_provisioned"}` (doc `:103`) | `BE:views.py:378-406` trả **200** + `cvd_series: []` + `data_status`; grep `not_provisioned` = **KHÔNG TỒN TẠI**; 501 duy nhất ở `views_tenant.py:582-585` (khác ngữ cảnh, dường như unrouted) | Widget không phân biệt được "chưa provision" vs "không có data" |
| "CORS cho phép `charts.edusuccess.vn`" (doc `:99,114`) | `BE:vninvest_core/settings.py:443-459` có allow-list nhưng `:462` `CORS_API_DYNAMIC_ALLOW=true` + `identity_access/apps.py:4-10` cho **mọi Origin** trên `/core/v1/*`,`/api/*` | Câu hỏi sai bản chất: domain đã được phép; vấn đề là **quá rộng** + PAT trong query string |
| `seq` tăng dần + latency `< 1s từ khớp lệnh` (doc `:53`) | `BE:broadcasting.py:29-37,47` đã có `seq`; nhưng aggressor thật chỉ ở `BE:market_data/models.py:285-310`; whale detect chạy batch (`docs/handoffs/HANDOFF_2026-11-22_...md:10-18`); Q-B4 vẫn mở (`docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:225`) | `seq` OK, SLA **chưa có nguồn** ⇒ không thể cam kết |
| `limit` default 200 / max 1000 (doc `:101`) | `BE:native_views.py:349` default 50, max 200 | Breaking change cho consumer cũ; widget `nativeShapes.ts:23` cũng clamp 1000 cho bars |
| "`VNInvestClient`: thêm method `getWhaleFeed`" (doc `:107`) | `W:VNInvestClient.ts:1027` (doc commit) / `:1007` (`dev` HEAD) **đã có** | Nhiệm vụ §4 bị trùng việc đã làm |
| `VNInvestDataAdapter.ts:111-135` map ra `[]` (doc `:7`) | Trên doc commit, `:111-135` là `fetchWhaleCampaignsForSymbol`; `[]` thực sự sinh ra ở `W:nativeShapes.ts:126` | Sai quy kết nguyên nhân; reviewer không tái lập được |
| `alerts[] → [] → overlay degraded backend_missing` (doc `:7`) | `W:useWhaleCampaignFeed.ts:91`: mảng rỗng ⇒ status `live`; degraded do `source === "none"` `:96` / default `:164` | Chuỗi nhân-quả sai; độ trễ thực tế nằm ở source resolution |
| `ForkEngineSurface.tsx:281-287` = externalCvdSeries (doc `:107`) | Feature commit `:284`; `dev` HEAD `:288` (đoạn `:281-287` là `CVDIndicator` nội bộ) | Trích sai vị trí, dù prop có thật |

## D. Findings

| ID | Loại | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|---|
| F-01 | ERROR | **P0** | doc `:14,36` · `BE:signal_intelligence/views.py:1036-1058` · `BE:market_serving/native_views.py:351-362,1272-1289` | 3 hợp đồng whale đang chạy song song: alerts-only, canonical `whale_orders` (trong `envelope.data`), aggregate `results`+cursor; contract JSON `shared/api-contracts/whale-feed-aggregate.contract.json:58-74` lại đã lệch code | Thêm dạng thứ 4 ⇒ widget phải map 4 shape, dễ lệch dữ liệu giữa bubble/summary | Chọn **1 contract canonical**; mở rộng `/core/v1/whale-feed` (hoặc `/realtime/whale-feed/{symbol}/`) để serve shape đó; đánh dấu deprecate 2 dạng kia có timeline; AC: widget `nativeShapes.ts:113-130` chỉ map 1 dạng |
| F-02 | ERROR | **P0** | doc `:39` · `BE:signal_intelligence/views.py:354-360,127` · `W:src/lib/types/vninvest.ts:59` · `docs/handoffs/HANDOFF_2026-11-22_STOCK_WHALE_BACKFILL_ALL.md:15-16` | Enum: request `large` / BE `normal` / widget không có cả 2. Ngưỡng: detect 500M, size_class 1B/5B, widget filter mặc định 1M | `size_class` không map được ⇒ severity bubble sai; cùng lệnh có thể xếp lớp khác nhau tuỳ nơi đọc | Chốt 1 enum + bảng ngưỡng duy nhất trong shared contract, kèm test BE↔FE (assert mọi giá trị BE nằm trong union widget) |
| F-03 | ERROR | **P0** | doc `:53` · `BE:market_data/models.py:285-310` · `BE:signal_intelligence/tasks.py:453-454` · `..._SPEC_2026-11-12.md:225` | Aggressor thật = `IntradayTick.side` (provider); `WhaleAlertCanonical.side`/`OrderFlowEvent.side` là suy từ ratio; whale detect chạy batch; Q-B4 chưa trả lời | Không có nền để cam kết WS `<1s`; nếu cố sẽ sinh dữ liệu giả (vi phạm Rule 15 `W:AGENTS.md:98,101`) | Gate P0 WS **sau khi** Owner xác nhận nguồn tick/second; trước đó chỉ giao REST snapshot + `501` và giữ degraded trung thực |
| F-04 | ERROR | **P1** | doc `:61,75` · `BE:market_serving/urls.py:23` · `BE:market_serving/views.py:416-424` · `BE:market_serving/session_facts_engine.py:100-149` | Route requested không tồn tại. Endpoint thật đã có 6 field (`bucket_ts,cumulative_cvd,buy_strength,institutional_strength,buy_volume,sell_volume`), nguồn là whale aggregate. Thiếu `delta`, `trade_count`, `revision` | Nếu làm mới từ `IntradayTick` trong khi endpoint cũ vẫn từ whale ⇒ 2 CVD khác số trong cùng chart | Chọn 1: (a) mở rộng endpoint hiện hữu với `delta` suy từ buy-sell + `source:'whale_aggregate'` + `revision` (rẻ, trung thực), hoặc (b) endpoint mới từ `IntradayTick` có `trade_count`. **Không trộn nguồn** |
| F-05 | ERROR | **P1** | doc `:39,81,100` · `BE:market_serving/views.py:418` · `BE:market_serving/native_views.py:360` · `W:backend-contract.test.ts:314` | BE trả `+07:00` (hoặc `+00:00`), request đòi `Z`; bucket chart căn theo giờ VN | Đổi format endpoint cũ = breaking; bucket UTC 02:00-08:00 không khớp phiên 09:00-15:00 nếu widget căn local | Owner chốt 1 múi: giữ offset `+07:00` cho endpoint cũ, hoặc(new) UTC **kèm rule căn bucket theo phiên VN**; chấp nhận cả `Z` lẫn `+00:00` ở parser |
| F-06 | ERROR | **P1** | doc `:39,81,103` · `BE:market_serving/views.py:378-406` | Không có pattern `not_provisioned`; missing data hiện trả 200 + `data_status`; request vừa nói "field bắt buộc" vừa nói "thiếu thì trả null" | 501 có thể bị widget hiểu là lỗi transport; `null` vs bỏ bucket vs `[]` không nhất quán | Ma trận trạng thái: `501`=chưa có source, `200`+`cvd_series:[]`=có source nhưng rỗng, `400`=params sai; bucket không có trade ⇒ **bỏ hẳn** (không gán 0, không `null`); final event định nghĩa full payload |
| F-07 | RISK | **P1** | doc `:36-39,81,101,115` · `BE:market_serving/native_views.py:349,1091-1161` · `BE:vninvest_core/pagination.py:35-59` | Cursor helpers có sẵn nhưng doc không nói sort key, nội dung cursor, hay hành vi khi `revision` đổi giữa 2 page; limit default/max đổi | `cumulative_cvd` có thể bị reset/nối sai khi paginate qua revision mới | Cursor = base64(`revision`, `ts`, `id`); nếu revision đổi giữa chừng ⇒ `409 revision_changed` bắt widget invalidate cả chuỗi; terminal `next_cursor:null`; clamp limit → 400 hay auto-clamp phải ghi rõ |
| F-08 | RISK | **P1** | doc `:99,114` · `BE:vninvest_core/settings.py:443-462` · `BE:identity_access/apps.py:4-10` · `BE:signal_intelligence/consumers.py:129-132` | REST `/core/v1/*` hiện cho **mọi Origin** (dynamic allow); WS nhận `?ticket=` hoặc `?token=` raw PAT | "Cấp CORS" là sai yêu cầu; nguy cơ lộ PAT trong query/header log; B-6 vẫn mở (`..._SPEC_...:21`) | Owner/Security: allow-list `charts.edusuccess.vn` thay vì dynamic, hoặc chấp nhận dynamic có nhật ký; WS **chỉ** dùng ticket dùng 1 lần, cấm raw PAT trên URL; thêm AC bảo mật |
| F-09 | RISK | **P2** | doc `:99` · `BE:market_serving/native_views.py:342,345-346` · `BE:market_serving/views.py:358-359` · `BE:vninvest_core/settings.py:378-381,394-397` | Whale yêu cầu `market:read`, orderflow `signals:read`, CVD có `MarketDataThrottle`; request chỉ ghi "như hiện hữu" | Endpoint mới có thể thiếu scope/throttle ⇒ lặp P0 B-6 | Ghi rõ scope + throttle class vào AC cho từng endpoint; test assert 403 khi sai scope, 429 khi vượt throttle |
| F-10 | RISK | **P2** | doc `:102-103` · `BE:service_ops/domain_configs/signals.py:34-36` | Retention signals = 7/365/90 ngày; không có config 30 ngày cho whale/orderflow; không có phép đo p95/<1s | SLA không kiểm chứng được ⇒ báo cáo "đạt" vô căn cứ | Hoặc định nghĩa phép đo (endpoint, dataset, phương thức p95, khung giờ) + config retention key, hoặc bỏ SLA khỏi hợp đồng demo/reference |
| F-11 | GAP | **P2** | doc `:7,107` · `W:VNInvestClient.ts:258,1027` · `W:VNInvestDataAdapter.ts:111-135,567-569` · `W:useWhaleCampaignFeed.ts:91,96` | Nhiều file:line lệch giữa `dev` HEAD và feature commit (xem bảng C); đường dẫn `ForkEngineSurface.tsx` thiếu `src/widget/components/fork/`; Rule 15 rộng hơn "cấm fake" (`W:AGENTS.md:95`) | Vi phạm nguyên tắc "mọi khẳng định kèm file:line"; reviewer mất thời gian tái lập | regenerate citation từ 1 ref được pin (`origin/dev@13e4da81`), dùng đường dẫn đầy đủ, tách bạch "doc commit" vs "dev HEAD" |
| F-12 | ERROR | **P2** | doc `:39,53,81,93,107` | Mâu thuẫn nội bộ: bắt buộc vs null; `buyer_broker/seller_broker` không nằm bắt buộc; `delta` khi volume null; event `final:true` không định nghĩa payload; reconnect snapshot chỉ quy định cho whale | Hai bên implement khác nhau vẫn cho là đạt | Bảng required/optional + enum + ví dụ `final` event; thêm rule snapshot-on-reconnect cho CVD |
| F-13 | GAP | **P1** | doc `:3,103` · `vninvest/docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:31-34` | Request đặt mục tiêu "aggressor thật ... production" + SLA/retention, trong khi Owner/PM đã chốt vninvest là backend **demo/reference**, data là của khách | Over-scope đúng như spec 09-28 đã bị bác (`..._SPEC_...:33`) | Re-scope thành "reference contract cho adapter"; production data SLA thuộc adapter của khách, không thuộc repo này |

## E. Quality gates audit

- **Gate chạy thật:** `git status --short` (vninvest) → sạch trước audit; `git rev-parse --abbrev-ref HEAD` → `dev`; `git log --all --name-only --diff-filter=A` (cả 2 repo) → xác nhận doc **KHÔNG có** trên `dev` local của vninvest, chỉ có trên `vninvestcharts-widget@origin/dev`; `git log`/`git diff --stat` → doc không đổi từ `72ac0bdb`.
- **Không chạy (doc-only, không sửa source):** `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run test:components`, BE pytest, `npm run lint` — ghi **CHƯA CHẠY**, không suy ra kết quả.
- **Caveat bằng chứng widget:** working tree `vninvestcharts-widget` đang bẩn (34 file, trong đó `VNInvestDataAdapter.ts` là `MM`). Subagent đối chiếu: nội dung working tree của các file trích dẫn chính **byte-identical với `72ac0bdb`**, nhưng `dev` HEAD lệch 1–64 dòng. Vì vậy bảng C/D ghi rõ ref tương ứng; không dùng số dòng `dev` HEAD để phản biện doccommit.
- **Con số có lệnh tái tạo:** số dòng file ở §A lấy bằng `Get-Content -Encoding UTF8`).Count; verdict ở §C/D lấy bằng `grep`/`read` tại ref đã nêu.

## F. 5 câu hỏi — ĐÃ CHỐT bởi backend owner (2026-11-24)

> Cập nhật sau audit: các câu hỏi Q1–Q5 đã được thay bằng quyết định D1–D5 tại
> `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (vai trò người viết code backend, không đẩy lại Owner).
> Bảng dưới giữ lại dạng câu hỏi chỉ để trace finding → quyết định.

| # | Câu hỏi cũ | Quyết định | Chặn finding |
|---|---|---|---|
| Q1 | Nguồn aggressor/second tick thật có sẵn không? SLA `<1s`? | **D1 (REV.2.1)**: `whale_orders` đọc `WhaleAlertCanonical` (per-tick từ `IntradayTick`, 365 ngày); bỏ `<1s`; WS/REST aggressor `not_provisioned` | F-03 |
| Q2 | Enum + ngưỡng `size_class`? | **D2 (REV.2.1)**: `{small,shark,whale}`, `500M<=small<1B<=shark<5B<=whale`; sàn `min_value=500M`; `normal→small`, bỏ `large` | F-02 |
| Q3 | Whale dùng contract nào? | **D3**: giữ `/core/v1/realtime/whale-feed/{symbol}/` (URL widget), 1 builder chung với `/core/v1/whale-feed` | F-01, F-11 |
| Q4 | CVD mở rộng cũ hay endpoint mới? | **D4**: mở rộng `session-facts/.../cvd/`; route orderflow mới chỉ mount 501 | F-04 |
| Q5 | Múi giờ / status / CORS / WS auth? | **D5 (REV.2.1)**: giữ `+07:00`; 501 vs 200-empty vs 400; allow-list `charts.edusuccess.vn`; subscribe `events[]` + ticket-only (human session không bị chặn) | F-05, F-06, F-08 |

## G. Đánh giá tổng thể & khuyến nghị thứ tự

**Implementable? Có — sau khi chốt D1–D5.** Khi audit lần đầu, blocker nằm ở quyết định; nay 5 quyết định đã được backend owner chốt tại `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md`, kèm phạm vi file và test fail-before. Không có migration, không xây pipeline tick mới. Đây là cách tránh lặp lỗi đã gặp ở `..._SPEC_2026-11-12.md:25` ("cần chốt trước khi code").

**Khuyến nghị (đổi Priority so với request):**

1. **D1–D5 đã chốt (REV.2.1)** — `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (doc-only, Entry 622/623).
2. **P0' (rẻ, không phụ thuộc tick feed):** chuẩn hoá 1 whale contract + enum + ngưỡng + `revision`/cursor/`delta` trên endpoint **đã có**; thêm test contract BE↔FE. Đây là phần widget thực sự cần để thoát trạng thái `backend_missing`.
3. **P1:** CVD — mở rộng `session-facts/.../cvd/` theo D4 (vài chục dòng), không phải endpoint mới.
4. **WS / `<1s`:** theo D1, event aggressor trả `not_provisioned`; giữ `seq` có sẵn cho event thật — hành vi đúng Rule 15, không phải thất bại.
5. **Bỏ khỏi scope:** retention 30 ngày + SLA production — thuộc adapter của khách (F-13).

**Next steps / owner:** backend mở claim + branch `feat/whale-cvd-contract-be`, code theo bảng phạm vi trong decision doc với test đỏ trước; widget team cập nhật citation (F-11) và đổi URL CVD theo D4; contract test chạy thật trên staging `https://charts.edusuccess.vn` (Rule 17, `..._SPEC_...:34`).
