# ĐÁP ÁN 4 CÂU HỎI Q-B1..Q-B4 — bàn giao demo-grade cho Enterprise widget

> **Ngày:** 2026-11-12 · **Từ:** agent `vninvest` (repo `vninvest`) · **Đến:** đội backend `vninvest` + widget team (`vninvestcharts-widget`)
> **Bám theo:** `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` §8 (PR #353, đã merge `ff0fd28ae`)
> **Phương pháp:** đọc code thật trong `packages/core/backend/src/` (grep + mở file), **không** suy diễn. Mọi kết luận kèm `file:line` (đường dẫn tương đối từ `packages/core/backend/src/`).
> **Lưu ý:** `vnbroker` là package **ngoài repo** (không cài trong môi trường local) ⇒ những phần phụ thuộc shape DataFrame của `vnbroker` ghi **CHƯA XÁC MINH** (cần probe staging).

---

## 0. Tóm tắt quyết định

| # | Câu hỏi | Trả lời ngắn | Hệ quả cho kế hoạch |
|---|---|---|---|
| **Q-B1** | Nguồn **order book thật**? | **KHÔNG có** trong `vninvest`. Chỉ có endpoint **mock** (`is_mock:true`, `source:'synthetic_from_snapshot'`). | ⇒ **Phương án (b): bỏ `orderbook_dom` khỏi demo** (B-2), hoặc dựng nguồn thật ngoài phạm vi demo. |
| **Q-B2** | Nguồn **corporate actions**? | **CHƯA XÁC MINH, nhưng CÓ ứng viên**: `vnbroker.api.company.Company.events()` **đã được gọi** và expose qua `overview` endpoint dạng `events: [...]` (shape **không typed**). Không có bảng/model corporate actions trong repo. | B-3 **có thể làm** nếu probe staging thấy `events` chứa ex-date/split/rights; nếu không ⇒ dùng fallback `adjusted:false` + `note` (đề xuất mặc định an toàn). |
| **Q-B3** | Fundamentals có **cash_flow** + kỳ **year**? | **cash_flow: KHÔNG** (payload chỉ `ratio`/`income_statement`/`balance_sheet`). **Kỳ: chỉ `quarter` hardcode** trong code; `year` **chưa dùng** ⇒ `CHƯA XÁC MINH` liệu lib `vnbroker` có hỗ trợ. | B-4: chốt contract `period` linh hoạt (cần probe lib) — **không** tự ý thêm `cash_flow`. |
| **Q-B4** | Nguồn **tick/second**? | **CÓ tick thật**: model `IntradayTick` + 2 đường ingest (provider realtime, DNSE tape backfill). **KHÔNG có "second bar"**; tick là staging short-lived. | E4 (không chặn demo). Realtime sub-second **không** nên hứa trong demo khi chưa đo độ phủ/retention. |

---

## 1. Q-B1 — order book thật: **KHÔNG có**

**Bằng chứng:**
- Endpoint duy nhất liên quan: `market_serving/native_views.py:429` — `class RealtimeDepthChartView(APIView)`, docstring `:430` ghi rõ *"order book depth (**mock implementation**)"*.
- `:442-454` — không có snapshot ⇒ trả `bids: []`, `asks: []`, **`'is_mock': True`**, `'source': 'synthetic_from_snapshot'`, `'data_quality': 'estimated'`.
- `:469-478` — bids/asks được **sinh từ `SymbolSnapshot`** theo `volume_distribution = [0.40, 0.30, 0.20]` (không phải sổ lệnh thật).
- `:522` — nhánh còn lại cũng set `'is_mock': True`.
- Grep toàn backend (`OrderBook|order_book|orderbook|Level2|level2`) → **0 model/provider**; các hit "depth" khác là **queue depth tier** của planner (`market_data/global_symbol_planner.py:21-24`), không liên quan order book.
- Các API `vnbroker` đang được dùng: `Vnbroker` (`market_data/vnbroker_adapter.py:193`), `listing` (`:375`), `company` (`:1144`), `financial` (`:1221`), `news` (`market_data/stock_mgmt_native_views.py:2221`) ⇒ **không có API depth/orderbook nào được gọi**.

**Trả lời:** `vninvest` **không** có nguồn order book thật (SSI/TCBS/KBS/snapshot đều không được nối). Level-1 của broker không phải order book ⇒ không thể dựng `bids/asks` thật mà không việt adapter mới (ngoài scope demo).

**Đề xuất cho B-2:** theo phương án (b) trong spec — **bỏ capability `orderbook_dom` khỏi demo** và trả `null`/`[]` + `note` (Rule 15: không dữ liệu giả). Nếu Owner muốn giữ capability thì phải làm ticket riêng (nối broker depth API), **không** làm trong wave demo.

---

## 2. Q-B2 — corporate actions: **CHƯA XÁC MINH (có ứng viên `Company.events()`)**

**Bằng chứng:**
- **Không có** bảng/model corporate actions trong repo: grep `corporate_action|ex_date|split_ratio|rights_issue|bonus_share|stock_split` toàn `packages/core/backend/src/` ⇒ **0 hit**.
- `market_data/models.py:80` — `DailyBar.is_adjusted` (`default=False`) ⇒ **bars chưa hề được điều chỉnh**; không có pipeline nào biết ngày chia.
- **Ứng viên duy nhất:** `market_data/vnbroker_adapter.py:1186-1197` — `events_df = company.events()` (nguồn `vnbroker.api.company.Company`, `source='KBS'` mặc định `:1145`), trả về `events` trong payload `:1203` (và `:1211` khi lỗi).
- Đã expose ra API: `market_data/stock_mgmt_native_views.py:1648-1656` (cache 1 ngày trong `profile.metadata`) và trả về ở `:1660-1672` (`'events': metadata.get('events', [])`, `'note': 'native_profile_loaded'`).

**Trả lời:** vninvest **chưa có** pipeline corporate actions (không có bảng, không có adjust). Có **một đường dữ liệu ứng viên** — `Company.events()` của vnbroker — nhưng **shape không typed** (records thô từ DataFrame) ⇒ **CHƯA XÁC MINH** field có gồm ex-date / tỉ lệ chia / quyền mua hay không.

**Cần làm (probe, 1 lệnh) trên staging — chưa chạy trong phiên này:**
```bash
curl -s -H "Authorization: Bearer $PAT" \
  "https://docker.edusuccess.vn/core/v1/stock-management/stocks/VNM/overview/" | jq '.events[0:3]'
```
- Nếu `events` có `ex_date`/`ratio`/loại sự kiện ⇒ B-3 làm được `adj_close` (cần chốt cách tính).
- Nếu không ⇒ B-3 theo hướng an toàn: `adjusted: false` + `note` (**không** giả định đã điều chỉnh) ⇒ capability `adjusted_bars` **chưa** mở được, nhưng widget degrade trung thực.

---

## 3. Q-B3 — fundamentals: **không có `cash_flow`; kỳ chỉ `quarter`**

**Bằng chứng:**
- `market_data/vnbroker_adapter.py:1215-1274` — `fetch_company_financials(symbol, source='KBS')`:
  - `:1226` `finance.ratio(period='quarter')`, `:1239` `finance.income_statement(period='quarter')`, `:1252` `finance.balance_sheet(period='quarter')` ⇒ **kỳ hardcode `quarter`** ở cả 3 nguồn.
  - `:1263-1267` — payload chỉ có **3 key**: `ratio`, `income_statement`, `balance_sheet` ⇒ **không có `cash_flow`**.
  - Bên trong mỗi key là `DataFrame.to_dict(orient='records')` (`:1230/1243/1256`) ⇒ **shape tự do, không typed** ⇒ đúng như spec §3 cảnh báo ("client không bind chắc chắn vào field nào").
- Endpoint: `market_data/core_urls.py:73` → `StockManagementFinancialsView`; schema `_STOCK_FINANCIALS_SCHEMA` tại `market_data/stock_mgmt_native_views.py:311-319` = `{symbol, financials (object|null), note}` ⇒ **envelope typed, lõi `financials` không typed**.
- `cash_flow` trong repo **không phải** báo cáo lưu chuyển tiền tệ mà là **dòng tiền danh mục**: `user_workspace/models.py:1539` (`CashFlow` → `LedgerEntry`), `user_workspace/ledger/analytics.py:161-227` (`xnpv/xirr/mwr` trên `cash_flows` của sổ cái) ⇒ **cảnh báo dễ nhầm**: đừng map `cash_flow` hiện có vào fundamentals.
- `StockFundamental` **đã bị xoá**: `market_data/migrations/0005_add_stock_fundamental.py` → `0006_remove_stockfundamental.py`; `data_ingest/tasks.py:3471` ghi rõ *"No bespoke StockFundamental store / enrichment task — SSOT"* ⇒ không có store riêng để đổi shape thoải mái.

**Trả lời:** `cash_flow` **không** có trong nguồn financials hiện tại (và không có ý định thêm trong demo). Kỳ **chỉ `quarter`**; liệu `vnbroker.api.financial.Finance` có nhận `period='year'` ⇒ **CHƯA XÁC MINH** (package ngoài repo, không cài local).

**Đề xuất B-4 (contract ổn định):**
1. **Envelope** giữ `{symbol, financials, note}` (đã typed ở `stock_mgmt_native_views.py:311-319`).
2. **3 key cố định** `ratio` / `income_statement` / `balance_sheet` — giữ nguyên, **không** thêm `cash_flow` giả.
3. **Mỗi record** chuẩn hoá tối thiểu: `period`, `year`, `quarter`, `report_date` (nullable) + `items` (object) ⇒ **key cố định, kiểu rõ** ⇒ client bind được.
4. `period` nhận query param (`quarter|year`), **fallback `quarter`** khi upstream không có ⇒ không giả data.
5. **Typed schema** (`@extend_schema`) + `spectacular` **0 warning** (Rule 5).

---

## 4. Q-B4 — tick/second: **CÓ tick thật; KHÔNG có second bar**

**Bằng chứng:**
- Model: `market_data/models.py:167-202` — `class IntradayTick` (`symbol`, `timestamp`, `price` Decimal, `volume` BigInt, `side` BUY/SELL/UNKNOWN, `match_type`, `source` mặc định `'vnbroker'`), bảng `market_data_intraday_tick`.
- Ingest (2 đường): `data_ingest/tasks.py:429-507` (provider realtime trades → `bulk_create` `:507`) và `:2475-2571` (backfill DNSE tape: presence check `:2524`, `bulk_create(ignore_conflicts=True)` `:2571`).
- Retention: `data_ingest/tasks.py:2576-2578` — *"**IntradayTick là short-lived staging** — chain enrichment pipeline để materialize long-term canonical facts"* ⇒ tick là **staging**, không phải kho dữ liệu dài hạn.
- **Không có** khái niệm bar 1 giây: model liên quan chỉ có `IntradayBar` (theo timeframe) + `IntradayTick`; không có `second_bar`/`tick_log` model (grep 0 hit).

**Trả lời:** có **tick thật** (khớp lệnh, không phải depth). **Không** có "second bar". Realtime sub-second **chưa** nên hứa trong demo: cần đo **độ phủ** (số symbol có tick trong ngày) + **retention thực tế** trên staging trước khi mở capability `realtime_tick` mức sub-second.

**Việc cần làm (độc lập với demo, E4):** đo trên staging `SELECT count(DISTINCT symbol), min(timestamp), max(timestamp) FROM market_data_intraday_tick WHERE timestamp >= now() - interval '1 day';` ⇒ ghi kết quả vào báo cáo E4.

---

## 5. Ghi nhận thêm (2 điểm ảnh hưởng kế hoạch)

1. **B-1 (mount route) — đã làm trong slice `feat/enterprise-b1-routes`** (xem ledger Entry 466 + `docs/evidence/enterprise-demo-b1/`): mount `realtime/unified-alerts/` + `realtime/whale-campaigns/<symbol>/` (view đã có sẵn ~600L nhưng **chưa** được mount ⇒ demo không mở được capability `whale_campaign`).
2. **Envelope `code` còn thiếu ở 2 endpoint vừa mount**: `native_views.py:571/574/576/578` (unified-alerts) và `:1393/1396/1400` (whale-campaigns) trả 400 **chỉ có `detail`**, chưa có `code` ⇒ **AC của spec ("400 `code=invalid_query`") chưa đạt ở B-1**; đã ghi rõ trong ledger Entry 466 để B-5 xử lý (đừng đánh dấu AC sai).

---

## 6. Trạng thái & việc tiếp theo

- **Trả lời 4/4 câu hỏi:** xem §1–§4 (2 câu trả lời **có điều kiện** vì phụ thuộc shape từ package ngoài repo `vnbroker` ⇒ cần 1 probe staging, lệnh đã ghi ở §2).
- **Backend có thể cắt ticket theo timeline spec §7:**
  - **Tuần 1:** B-1 (✅ đã làm ở slice này) + B-5 (hygiene: số là số, Unix ms, timeframe canonical, envelope `code` — **chưa làm**) + probe §2.
  - **Tuần 2:** B-2 (bỏ mock depth ⇒ đề xuất phương án (b) ở §1) + B-4 (contract theo §3).
  - **Tuần 3:** B-3 (theo kết quả probe §2) + B-6 (P0 PAT scope + đóng OpenAPI — **chưa làm**).
- **Widget team:** E0–E5 build song song; E0 (contract generic) không phụ thuộc 4 câu trả lời này.

*Tài liệu này là **đáp án** cho `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` §8 — không thay thế phần spec gốc.*
