# AUDIT — Đồng bộ dữ liệu thị trường chứng khoán: khoảng cách với thị trường thực (2026-09-21)

> Audit độc lập subsystem `market_data` + `market_serving` + data-ingest pipeline, đối chiếu với
> dữ liệu thị trường chứng khoán Việt Nam cần có để vận hành thời gian thực.
> Khung: AGENTS.md §4. Phương pháp: read/grep toàn repo + đọc package ngoài `vnbroker` 2.0.0
> (`.venv/Lib/site-packages/vnbroker`). Read-only — không thay đổi mã nguồn.
> Ngôn ngữ: Tiếng Việt. Mọi khẳng định kèm `file:line`.

---

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **MDG-01 (HIGH) — Sổ lệnh (order book L2) đang là MOCK.** `RealtimeDepthChartView` tự sinh 3 mức
   bid/ask (`native_views.py:327,364-411`), trong khi gói `vnbroker` **đã có** `quote.price_depth()`
   (`vnbroker/api/quote.py:188`) — dự án chưa gọi.
2. **MDG-02 (HIGH) — Giá lịch sử chưa điều chỉnh corporate actions.** Field `is_adjusted` tồn tại
   nhưng **không nơi nào set `True`** (`market_data/models.py:80`; chỉ default/admin/serializer);
   không có model cổ tức/chia tách → return, MA, backtest sai trên mã có sự kiện quyền.
3. **MDG-03 (HIGH) — "Realtime" thực chất là polling nến ngày.** Giá lấy qua `history(interval='1D')`
   (`vnbroker_adapter.py:408-413,486-492`), tick chỉ `page_size=50` (`:174`); gói `vnbroker` có
   `Stream` async + `TickData` kèm `bid_price/ask_price/bid_volume/ask_volume`
   (`vnbroker/api/stream.py:82,42-45`) nhưng dự án không dùng.
4. **MDG-04 (MED) — Không lưu giá trị chỉ số** (VNINDEX/VN30/HNX) dù provider có
   `common/indices.py:27`; dự án chỉ có danh sách thành viên nhóm (`default_groups.py:97`).
5. **MDG-07 (MED) — Không có phái sinh / CW / trái phiếu** dù provider có
   `listing.all_future_indices/all_covered_warrant/all_bonds` (`vnbroker/api/listing.py:138,162,174`).

---

## A. BẢN ĐỒ KIẾN TRÚC

### A1. Model & dataset (dự án)

| File:line | Thực thể | Vai trò | Note |
|---|---|---|---|
| `market_data/models.py:15` | `StockProfile` | Metadata mã (sàn, ngành, KL lưu hành) | equity only |
| `market_data/models.py:63` | `DailyPrice` | OHLCV ngày + `is_adjusted` (default False) | `unique(symbol,date)` |
| `market_data/models.py:135` | `IntradayBar` | Nến intraday (1H, 5m…) | `unique(symbol,datetime,timeframe)` |
| `market_data/models.py:167` | `IntradayTick` | Tick khớp lệnh | `side` BUY/SELL/UNKNOWN |
| `market_data/models.py:205` | `GlobalSymbolRegistry` | SSOT symbol + tier hot/warm/cold | |
| `market_data/models.py:250` | `GlobalSymbolDemandSource` | Edge nhu cầu (holding/watchlist/alert) | |
| `market_data/models.py:320` | `GlobalSymbolCoverage` | Coverage/freshness/gap per dataset | 5 dataset |
| `market_serving/models.py:12` | `SymbolSnapshot` | Price board: OHLCV + `reference/ceiling/floor` + `market_status` | |
| `market_serving/models.py:69` | `SessionFacts` | CVD, buy_strength, whale_net_flow | derived |
| `market_serving/models.py:115` | `SessionFactsBucket` | Bucket theo cửa sổ | derived |

Dataset canonical (`global_symbol_coverage.py:16-22`): `daily_prices`, `price_board_snapshot`,
`intraday_bars`, `intraday_ticks`, `session_facts`.

### A2. Adapter & nguồn

| File:line | Hàm | Nguồn thực tế |
|---|---|---|
| `vnbroker_adapter.py:164-183` | `_fetch_intraday_frame` | `Vnbroker().stock().quote.intraday(page_size=50)` |
| `vnbroker_adapter.py:403-427` | `_fetch_realtime_price_with_quote_class` | `quote.history(interval='1D', today)` |
| `vnbroker_adapter.py:456-526` | `fetch_price_board_snapshots_batch` | `fetch_multiple(interval='1D')` |
| `vnbroker_adapter.py:818-871` | `fetch_intraday_tape` | tape REST + Redis stream |
| `vnbroker_adapter.py:558-641` | `fetch_daily_history` | lịch sử ngày |
| `vnbroker_adapter.py:982,1059,1121` | `Company/Finance/News` | hồ sơ, tài chính, tin |

Nguồn chọn qua `VnbrokerRuntimeConfig.SourceChoices` (`models.py:102-107`): VCI/KBS/TCBS/SSI/MSI.
Publish tick → Redis stream `vninvest:ticks:{symbol}` `maxlen=500` (`vnbroker_adapter.py:148-158`) →
WebSocket `RealtimeConsumer` `/ws/realtime/` (`signal_intelligence/consumers.py:127`).

### A3. Năng lực gói ngoài `vnbroker` 2.0.0 (CHƯA được dự án dùng)

| File:line | Năng lực | Dự án dùng? |
|---|---|---|
| `vnbroker/api/quote.py:188` | `price_depth()` — sổ lệnh | ❌ (chỉ dùng `intraday`, `history`) |
| `vnbroker/api/stream.py:82` | `Stream` async generator (fallback `source="auto"`) | ❌ |
| `vnbroker/api/stream.py:42-45` | `TickData.bid_price/ask_price/bid_volume/ask_volume` | ❌ |
| `vnbroker/common/indices.py:27` | `get_all_indices()` / index groups / sectors | ❌ |
| `vnbroker/api/listing.py:138,150,162,174` | `all_future_indices`, `all_government_bonds`, `all_covered_warrant`, `all_bonds` | ❌ |
| `vnbroker/api/snapshot.py:59` | `MarketSnapshot` heatmap theo nhóm/ngành | ❌ |

**Kết luận A3:** phần lớn gap là **thiếu tích hợp**, không phải thiếu nguồn — ngoại lệ là **khối ngoại**
(không có `foreign/room` trong gói; grep `foreign|room` = 0 match).

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE

**B1. Realtime tick (use-case: FPT trong phiên):**
`schedule_realtime_prefetch_shards` (3s, `settings.py:484-488`) → shard `prefetch_realtime_ticker_shard`
(`realtime_prefetch.py:476+`) → `_fetch_intraday_frame` `quote.intraday(page_size=50)`
(`vnbroker_adapter.py:174`) → `_normalize_intraday_trade_rows` (`:105`) → `_publish_intraday_stream`
Redis `maxlen=500` (`:150-158`) → WS consumer (`consumers.py:127`). DB tick ghi qua
`_hydrate_intraday_symbols` (`data_ingest/tasks.py:506`).

**B2. Price board (use-case: snapshot định kỳ 180s):**
`fetch_and_upsert_price_board` (`tasks.py:838`, beat `settings.py:560-562`) →
`fetch_price_board_snapshots_batch` `fetch_multiple(interval='1D')` (`vnbroker_adapter.py:486-492`) →
`SymbolSnapshot` upsert (`vnbroker_materializer.py:184-185`).

**B3. Daily EOD (use-case: backfill 17:05):**
`backfill_daily_prices` (`settings.py:587-590`) → `fetch_daily_history` → `DailyPrice`
(`data_ingest/tasks.py:1623+`) → coverage refresh (`:261`).

**B4. Derived facts:**
`materialize_session_facts` (5m, `settings.py:470-472`) → `session_facts_engine.compute_session_facts_for_all_active`
(`session_facts_engine.py:298`) → `SessionFacts` + buckets.

---

## C. CONTRADICTIONS (doc/naming vs code)

| # | Doc/naming | Code thực tế | Tác động |
|---|---|---|---|
| C-a | `fetch_price_board_snapshots_batch` docstring gọi là "realtime snapshot" (`vnbroker_adapter.py:456-471`) | Dùng `interval='1D'` (`:486-492`) → là **nến ngày đang hình thành**, không phải tick | Kỳ vọng "realtime" sai lệch |
| C-b | `RealtimeDepthChartView` docstring tự ghi "mock implementation" (`native_views.py:327`) | Sinh 3 mức bid/ask giả (`:364-411`) | API trả dữ liệu không có thật, dễ gây hiểu nhầm |
| C-c | `DailyPrice` model có `is_adjusted` ngụ ý đã điều chỉnh (`models.py:80`) | Không pipeline nào set `True` | Giá lịch sử thực chất chưa điều chỉnh |
| C-d | `models.py:170` chú thích tick "Native storage + Redis cache (5 min TTL)" | Redis stream dùng `maxlen=500` không TTL (`vnbroker_adapter.py:158`) | Comment sai cơ chế retention |

---

## D. FINDINGS

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| MDG-01 | **HIGH** | `market_serving/native_views.py:327,364-411` | Order book L2 là mock 3 mức | Không thể hiển thị/khớp dữ liệu sổ lệnh thật | Thêm `OrderBookSnapshot` + gọi `quote.price_depth()` (`vnbroker/api/quote.py:188`) |
| MDG-02 | **HIGH** | `market_data/models.py:80` | `is_adjusted` không bao giờ `True`; 0 model cổ tức/chia tách | Return/MA/backtest sai trên mã có sự kiện quyền | Thêm `CorporateAction` + pipeline điều chỉnh + set `is_adjusted=True` |
| MDG-03 | **HIGH** | `vnbroker_adapter.py:408-413,174` | Giá realtime = nến 1D; tick poll page_size=50 | Độ trễ cao, không phải streaming | Dùng `Stream` (`vnbroker/api/stream.py:82`) + persist tick |
| MDG-04 | MED | `market_data/models.py:320-330`; `default_groups.py:97` | Không lưu giá trị chỉ số | Không có VNINDEX/VN30/HNX để so sánh/benchmark | Model `IndexQuote` + `get_all_indices()` (`common/indices.py:27`) |
| MDG-05 | MED | grep `foreign\|room` = 0 | Không có khối ngoại; provider cũng không có | Thiếu chỉ báo dòng tiền ngoại — quan trọng ở VN | Tích hợp nguồn ngoài (SSI/Fiin) hoặc `price_depth` nếu có room |
| MDG-06 | MED | `market_data/models.py:167-199` | Tick không phân biệt khớp lệnh vs thỏa thuận | Volume/giá bị lẫn put-through | Thêm `match_type` chuẩn hóa + tách field |
| MDG-07 | MED | `market_data/models.py:15-93` | Chỉ equity; không phái sinh/CW/bond | Không phủ VN30F, CW, trái phiếu | `listing.all_future_indices/all_covered_warrant/all_bonds` (`vnbroker/api/listing.py:138,162,174`) |
| MDG-08 | MED | `vnbroker_adapter.py:158` | Redis stream `maxlen=500`, không retention/partition `IntradayTick` | Mất tick khi vượt 500; DB phình vô hạn | Nâng maxlen / persist ngay; retention job |
| MDG-09 | LOW | `vnbroker_adapter.py:171-183` | Tự loop source thủ công, không fallback streaming | Failover chậm khi provider lỗi | Dùng `Stream(source="auto")` (`stream.py:96`) |
| MDG-10 | LOW | `market_serving/models.py:44-48` | `market_status` gắn snapshot, không có lịch nghỉ/lễ per-exchange | Trạng thái phiên có thể sai ngày lễ | Bảng `TradingCalendar` per-exchange |
| MDG-11 | LOW | `settings.py:459-461,560-562` | snapshot 300s, price-board 180s | Không phù hợp theo dõi realtime | Giảm interval + streaming |
| MDG-12 | LOW | `native_views.py:231-250` | Breadth chỉ advancing/declining/unchanged từ `SymbolSnapshot` | Không breadth theo ngành/index | Mở rộng breadth từ `IndexQuote`/sector |

---

## E. QUALITY GATES

Đây là audit read-only, **không thay đổi mã nguồn** → không phát sinh gate mới. Trạng thái hiện tại
(kế thừa từ Entry 138):
- BE `manage.py check` = 0; `test_soc_tasks` 6F pre-existing (baseline).
- FE `tsc` 0, `build` PASS, eslint 0, `i18n:scan` exit 0.

Khi implement roadmap, bắt buộc chạy lại các gate trên + migration check + coverage test mới.

---

## F. CÂU HỎI CẦN LÀM RÕ

1. Provider nguồn realtime ưu tiên để lấy order book/khối ngoại là gì (VCI/KBS/SSI FastConnect/DNSE WS/Fiin)?
   Riêng **khối ngoại (MDG-05) chưa xác minh có nguồn nào trong hệ hiện tại**.
2. Dự án có nhu cầu phái sinh/CW/bond (MDG-07) cho giai đoạn tới, hay chỉ equity?
3. Yêu cầu độ trễ realtime mục tiêu (giây? phút?) để chốt interval + streaming.
4. Có được phép thêm dependency/nguồn dữ liệu ngoài (Fiin/SSI) không?

---

## G. ĐÁNH GIÁ TỔNG THỂ

- **Điểm mạnh:** governance coverage/freshness/gap (`GlobalSymbolCoverage`, planner) và kiến trúc
  dataset/tier rất tốt — nền tảng vững để mở rộng.
- **Điểm yếu cốt lõi:** (1) realtime chưa thật (polling nến ngày), (2) order book mock,
  (3) lịch sử chưa điều chỉnh corporate actions, (4) thiếu chỉ số/khối ngoại/phái sinh.
- **Cơ hội lớn:** phần lớn gap (order book, streaming, index, derivatives) **gói `vnbroker` đã hỗ trợ**
  → chủ yếu là công việc tích hợp, chi phí thấp hơn nhiều so với tự xây.
- **Blocker:** MDG-01/02/03 nên xử lý trước khi quảng bá "dữ liệu realtime".

---

## H. ROADMAP CHI TIẾT

### Phase 0 — Tính đúng đắn dữ liệu (P0, ưu tiên tuyệt đối)
| Hạng mục | Deliverable | Phụ thuộc | Rủi ro |
|---|---|---|---|
| H0.1 Corporate actions | Model `CorporateAction` (symbol, ex_date, type, ratio, cash_div) + migration + pipeline điều chỉnh `DailyPrice` + set `is_adjusted=True` + backfill | nguồn sự kiện quyền | Cao nếu không có nguồn |
| H0.2 Order book L2 | Model `OrderBookSnapshot` (bid/ask N mức) + `fetch_price_depth` gọi `quote.price_depth()` + thay mock `RealtimeDepthChartView` | `vnbroker/api/quote.py:188` | Trung bình |
| H0.3 Đo & tài liệu hoá | Đo coverage live 5 dataset; ghi rõ giới hạn dữ liệu | — | Thấp |

### Phase 1 — Realtime thật (P1)
| Hạng mục | Deliverable | Phụ thuộc |
|---|---|---|
| H1.1 Tick streaming | Dùng `Stream` (`stream.py:82`) → persist `IntradayTick` ngay; bỏ phụ thuộc `maxlen=500` | MDG-03 |
| H1.2 Index values | Model `IndexQuote` + job lấy `get_all_indices()` (`common/indices.py:27`) | MDG-04 |
| H1.3 Put-through | Chuẩn hoá `match_type`, tách volume thỏa thuận | MDG-06 |
| H1.4 Retention | Partition/retention cho `intraday_ticks`/`intraday_bars` | MDG-08 |
| H1.5 Fallback | Dùng `Stream(source="auto")` cho failover | MDG-09 |

### Phase 2 — Mở rộng phạm vi (P2)
| Hạng mục | Deliverable | Phụ thuộc |
|---|---|---|
| H2.1 Khối ngoại | Model `ForeignTrading` + tích hợp nguồn ngoài | MDG-05 (cần nguồn) |
| H2.2 Phái sinh/CW/Bond | Model + job từ `all_future_indices/all_covered_warrant/all_bonds` | MDG-07 |
| H2.3 Trading calendar | `TradingCalendar` per-exchange | MDG-10 |
| H2.4 Breadth nâng cao | Breadth theo ngành/index từ `IndexQuote`/sector | MDG-12 |
| H2.5 Giảm interval | Rút ngắn snapshot/price-board + streaming | MDG-11 |

### Thứ tự đề xuất
`H0.1 → H0.2 → H1.1 → H1.2 → H0.3 → H1.3/H1.4 → H2.*`

---

## I. PHỤ LỤC — Lệnh/điểm kiểm tra

```powershell
# Liệt kê năng lực provider thực tế
Get-ChildItem "packages/core/backend/.venv/Lib/site-packages/vnbroker/api" -Filter *.py
Select-String -Path "packages/core/backend/.venv/Lib/site-packages/vnbroker/api/quote.py" -Pattern "def (intraday|price_depth|history)"
# Xác nhận dự án chưa dùng price_depth/Stream/indices
Select-String -Path packages/core/backend/src -Include *.py -Recurse -Pattern "price_depth|Stream\(|get_all_indices|all_future_indices"
# Coverage live (khi stack chạy)
docker compose -f docker-compose.dev.yml exec -T -w /app/src core-api python manage.py shell -c "from market_data.models import GlobalSymbolCoverage as G; from django.db.models import Count; print(list(G.objects.values('dataset','freshness_state').annotate(n=Count('id'))))"
```

---

## J. ERRATA sau phản biện độc lập (2026-09-21) — ĐỌC TRƯỚC §A3/§D/§H

Phản biện độc lập đã verify và phát hiện **audit gốc sai ở mảng package-side**. Các mục dưới
**thay thế** nội dung tương ứng ở trên (giữ nguyên §A1/A2/B/C-a/C-b/C-c project-side).

### J1. Drift version vnbroker (THAY §A3 + mọi claim về `vnbroker`)
Ba phiên bản khác nhau — audit gốc chỉ đọc `.venv` local 2.0.0:
| Nơi | Version | Bằng chứng |
|---|---|---|
| `requirements.txt` | **v1.1.0** (pin) | `requirements.txt:29` (`git+...@v1.1.0`) |
| `.venv` local | **2.0.0** | `vnbroker-2.0.0.dist-info/METADATA` |
| Container `core-api` (bản chạy thật) | **1.0.2** | `pip show vnbroker` → `Version: 1.0.2` |

**Hệ quả:** mọi claim §A3 dựa trên 2.0.0 không đảm bảo đúng ở bản chạy 1.0.2.
Đã verify trên container 1.0.2:
- `vnbroker.api.stream` **KHÔNG tồn tại** → `ModuleNotFoundError` ⇒ **MDG-03/H1.1/H1.5 không implementable trên bản hiện tại**.
- `Quote.price_depth` **có** (`inspect.signature` = `(self, symbol=None, **kwargs) -> DataFrame`, khớp 2.0.0) ⇒ H0.2 khả thi.
- `Trading.foreign_trade` **có**; `common.indices.get_all_indices` **có**.
- `vnbroker.connector.dnse.websocket` **KHÔNG có** (chỉ 2.0.0) ⇒ kênh `foreign_investor`/`market_index` là 2.0.0-only.

### J2. Sửa MDG-05 (khối ngoại) — TIỀN ĐỀ SAI
Audit gốc ghi "grep `foreign|room` = 0 → phải tìm nguồn ngoài". **Sai**: gói có
`api/trading.py:127 foreign_trade()` (cả 1.0.2) và 2.0.0 có kênh `foreign_investor`
(`connector/dnse/websocket.py:5,50`). MDG-05 chuyển từ "thiếu nguồn" → **"cần tích hợp `foreign_trade()`"**.

### J3. Sửa MDG-03/H1.1/H1.5 (streaming) — KHÔNG KHẢ THI / KHÔNG GIẢI QUYẾT
`Stream` của vnbroker là **polling 1 giây**, không phải WebSocket thật
(`explorer/vci/stream.py:4-8`: "VCI does not provide a public WebSocket API"); fallback chỉ
`["vci","kbs"]` (`api/stream.py:146`). ⇒ không giảm latency, không failover thực, và
**xung đột kiến trúc QueueRecovery** (poll 1s × N mã = đúng class flood vừa gỡ, xem F-AUD-05).
**H1.1/H1.5 hoãn** cho tới khi có provider WS thật + thiết kế qua queue layer.

### J4. Sửa H1.2 (index values) — `get_all_indices()` KHÔNG đủ
`common/indices.py:27-210` chỉ là metadata (list/info/group/sector/exchange), **không có quotes**;
VCI intraday **từ chối index** (`explorer/vci/quote.py:585-586`). H1.2 phải chọn nguồn index quote
khác (2.0.0 `dnse/websocket.py` kênh `market_index`, hoặc nguồn khác) — chưa chốt.

### J5. Sửa MDG-06 / MDG-08 (quá tuyệt đối)
- **MDG-06:** VCI map `matchType→match_type` (`explorer/vci/const.py:50-55`), library chuẩn hoá
  `b/B/s/S/BU/SD→Buy/Sell` (`core/utils/transform.py:173-180`, gọi trong `intraday_to_df:429`);
  adapter passthrough (`vnbroker_adapter.py:134`) + model có field (`models.py:187`).
  ⇒ tick **có** `match_type`; chỉ chưa chắc phân biệt put-through.
- **MDG-08:** TTL 5 phút là của **tape cache** (`vnbroker_adapter.py:856`), khác `maxlen=500` của
  stream; comment `models.py:170` không hề nói tới stream (C-d của audit gốc sai).

### J6. Sửa §E (baseline test) — CẢ HAI PHÍA ĐỀU SAI
Reproduce live trong container dev (2 lần): `test_soc_tasks` = **Ran 38, FAILED (failures=1)**
(`test_market_data_queue_tier_scheduler_dispatches_due_tiers_with_runtime_policy`, `dispatched_runs 1 != 2`).
- Audit gốc ghi "6 FAIL pre-existing" → **không tái hiện**.
- Phản biện ghi "38/38 OK local sqlite" → **không tái hiện** ở dev container.
⇒ Baseline thực = **37 pass / 1 fail**; cần điều tra nguyên nhân (nghi do runtime policy/Redis state),
không được dùng số cũ cho bất kỳ gate nào.

### J7. Findings mới từ phản biện (đã verify)
| ID | Mức | file:line | Xác nhận |
|---|---|---|---|
| F-AUD-01 | HIGH | `requirements.txt:29` vs container 1.0.2 vs `.venv` 2.0.0 | ✅ Build không reproducible; cần pin 1 version + import-test CI |
| F-AUD-02 | MED | `native_views.py:427-428` đọc `profile.tick_size`; `StockProfile` không có field; `except: pass` `:429-430` | ✅ Dead path, luôn default 0.05 |
| F-AUD-03 | MED | `domain_configs/signals.py:34,80`; `views/signals.py:901,933` | ✅ `intraday_tick_retention_days` chỉ hiển thị, không job enforce |
| F-AUD-05 | MED | kiến trúc QueueRecovery | ✅ Streaming bypass queue sẽ tái tạo flood — phải đi qua chunk/timeout/circuit |
| F-AUD-06 | LOW | roadmap §H thiếu slice FE | ✅ MDG-01/04/12 cần UI (order book, index overlay, breadth ngành) |

### J8. Phản biện lại 2 điểm của phản biện (meta)
- **F-AUD-04 (side inference) bị nói quá:** `intraday_to_df` gọi `process_match_types`
  (`core/utils/transform.py:429`) chuẩn hoá `b/B/s/S/BU/SD→Buy/Sell` (`:173-180`) trước khi adapter
  thấy dữ liệu ⇒ `startswith('buy'/'sell')` **hoạt động**; rủi ro chỉ còn ở mã không nằm trong map.
  Giữ khuyến nghị test sample thật, nhưng hạ mức "toàn bộ side sai" → residual risk.
- **C-2 của phản biện lặp lại chính version trap:** cite `connector/dnse/websocket.py:5,50` (file
  **2.0.0-only**, container 1.0.2 không có). Kết luận cốt lõi vẫn đúng nhờ `foreign_trade` (có trên 1.0.2),
  nhưng dẫn chứng DNSE WS là version-dependent.

### J9. Thứ tự sửa đề xuất (thay §H "Thứ tự đề xuất")
`F-AUD-01 (chốt version + rebuild verify) → H0.1 corporate actions (nguồn `company.events()` có sẵn:
dnse:258/kbs:580/tcbs:374/vci:304; `dnse/client.py:408 get_corporate_action_history`) →
H0.2 price_depth (khả thi trên 1.0.2) → H1.3 verify-side sample thật → H1.4 gắn retention config →
H2.*`. **Hoãn H1.1/H1.5**; **viết lại MDG-05/H1.2**.

### J10. Verify độc lập errata + fix phát sinh (2026-09-21, sau §J)
**J10.1 — Erratum 1 (F-AUD-04) ĐÚNG cả hai bản.** Container 1.0.2: `process_match_types` def `:142`,
map `:174/:179` (`b→Buy`, `BU→Buy`/`SD→Sell`), call trong `intraday_to_df` `:430` (lệch 1 dòng so với
số §J cite từ .venv 2.0.0 — không ảnh hưởng kết luận). Adapter lowercase + `startswith('buy'/'sell')`
khớp output `Buy/Sell` ⇒ side inference hoạt động với mã mapped; residual = mã unmapped (đúng chỗ
put-through sống nếu có). Giữ hạ mức F-AUD-04.
**J10.2 — Erratum 2 (C-5) ĐÚNG mechanism, NHƯNG quy nguyên nhân chưa đủ.** Reproduce container: Ran 38,
FAILED (1) đúng test/log như §J. Đào sâu thêm 1 lớp: skip xảy ra vì `recovery_backlog → manual_on_demand`
(`dataops_market_data.py:39`) depth 141-155 > max 20 (`service_ops/tasks.py:51,1124-1143`).
Depth này **do chính corrective-v4 QueueRecovery** (chuyển price-board/snapshot batch 150-340s/run sang
manual) — không chỉ "runtime policy/Redis state" chung chung. Hệ quả: (a) test env-dependent (đọc LLEN live;
local fail-open 0 ⇒ pass); (b) recovery tier bị skip vĩnh viễn trên dev (planner không backfill gaps).
**Fix đã áp (Entry 149):** batch → `enrichment_eod` (worker rảnh ~23h/ngày, concurrency 1→3) +
mock `_get_redis_queue_depth → 0` trong test (deterministic) + env `WARM_INTRADAY_BEAT_INTERVAL_SECONDS`
đồng bộ api container (chống repair flap 600↔300). Verify: container **38/38 OK**; manual 67→34
(đang drain); eod depth 0 (drain kịp); DB queues đúng sau repair.
**J10.3 — Ghi chú C-2 ĐÚNG toàn bộ trên 1.0.2:** `foreign_trade: True`,
`vnbroker.connector.dnse.websocket` → ModuleNotFoundError, `price_depth(self, symbol=None, **kwargs)`
khớp 2.0.0.
**J10.4 — Baseline test chốt:** container 38/38 OK (sau fix); local sqlite 38/38 OK. Số "6F"/"37/1" chỉ còn
giá trị lịch sử (mô tả trạng thái infra từng thời điểm, không phải baseline code).
