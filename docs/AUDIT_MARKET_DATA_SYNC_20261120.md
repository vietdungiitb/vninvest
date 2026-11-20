# AUDIT — Đồng bộ dữ liệu thị trường: giá, cổ tức, corporate actions (2026-11-20)

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **MDS-01 (HIGH) — Giá có tự cập nhật, cổ tức/chia tách thì KHÔNG.** Daily OHLCV được backfill mỗi ngày 17:05 ICT (`settings.py:776-783`) + realtime snapshot 5 phút (`settings.py:656-661`); nhưng repo **không có model hay pipeline corporate actions** (grep `corporate_action|ex_date|split_ratio|rights_issue|bonus_share` trong `packages/core/backend/src` → 0 hit), field `is_adjusted` (`market_data/models.py:80`) **không nơi nào set True**. Bars API phải trả `adjusted:false` + note (`stock_mgmt_native_views.py:4381-4384`). Hệ quả: return/MA/backtest sai quanh ngày chia cổ tức, chia tách, phát hành quyền.
2. **MDS-02 (MED) — `dividend_yield` không phải lịch cổ tức.** Screener lấy `ratio[0].dividend_yield` từ payload tài chính của provider, cache **12 giờ** (`screener_helpers.py:328`, `vnbroker_adapter.py:1389,1414`; `portfolio_analytics_views.py:3521-3548`). Nó đổi khi provider refresh snapshot tài chính, **không** đổi theo sự kiện chia cổ tức thực tế.
3. **MDS-03 (MED) — Đồng bộ danh sách mã/nhóm không tự chạy.** `sync_cached_symbol_groups()` chỉ được gọi từ endpoint thủ công `POST /api/soc/symbol-groups/sync/` (`service_ops/views/symbol_groups.py:296-312`) và luồng tạo nhóm trong stock-management (`stock_mgmt_native_views.py:3741-3742`); `CELERY_BEAT_SCHEDULE` **không có entry** nào gọi hàm này. Mã mới niêm yết / hủy niêm yết sẽ không tự vào `CachedSymbolGroup`/registry.
4. **MDS-04 (MED) — "Realtime" là polling, không phải stream.** Job tên `materialize-symbol-snapshot-60s` nhưng schedule mặc định **300s** (`settings.py:656-661`, env `SNAPSHOT_INTERVAL_SECONDS`); session facts 300s (`:667-670`); intraday hydrate 300s (`:769-773`); realtime prefetch 3s (`:676-679`). Giá trên UI trễ từ vài giây đến 5 phút tùy luồng; không phải tick-by-tick.
5. **MDS-05 (LOW) — Coverage 60.1% trong ảnh là trạng thái freshness, không phải "sai 40% dữ liệu".** `GlobalSymbolCoverage` có các trạng thái `fresh/warm/stale/missing` theo từng dataset (`global_symbol_coverage.py:62-88,180-212`); banner DataOps tính tỉ lệ fresh/stale (`SocDataInventorySection.tsx:105-116`). 60% nghĩa là 60% mã có dữ liệu tươi theo ngưỡng, phần còn lại cần refresh — có thể chủ động backfill từ tab **Vận hành** / **DataOps**.

---

## A. BẢN ĐỒ KIẾN TRÚC

| File:line | Số dòng | Trách nhiệm | Ghi chú |
|---|---:|---|---|
| `packages/core/backend/src/market_data/models.py:63-88` | 472 | `DailyPrice` (OHLCV ngày, `unique(symbol,date)`, `is_adjusted`) | `is_adjusted` default False |
| `packages/core/backend/src/market_data/vnbroker_adapter.py:680-785,1138-1212,1385-1415,1521-1630` | 1639 | Adapter provider: daily history, company info/events, financials (cache 12h), sync nhóm | `events` expose thô, không typed |
| `packages/core/backend/src/data_ingest/tasks.py:686-805,1441-1548,1642-2091` | 3473 | Backfill/ingest DailyPrice: fetch → classify → `bulk_create(update_conflicts)` | upsert 6 field; KHÔNG đụng `is_adjusted`/`change_pct` |
| `packages/core/backend/src/market_serving/vnbroker_materializer.py:131-291` | 328 | Vật lý giá provider → `SymbolSnapshot` (bulk upsert) | Reference price cho `price_change_pct` |
| `packages/core/backend/src/market_serving/materializers.py:120-128` | 220 | Snapshot fallback/materialize | `price_change_pct` tính từ previous close |
| `packages/core/backend/src/market_data/global_symbol_coverage.py:62-88,131-212` | 822 | Tính freshness `fresh/warm/stale/missing` + next action per dataset | Nguồn banner "độ phủ 60.1%" |
| `packages/core/backend/src/market_data/stock_mgmt_native_views.py:4381-4385,3741-3742` | 4936 | Bars API trả `adjusted:false`+note; trigger sync nhóm khi tạo nhóm | Không có `adj_close` |
| `packages/core/backend/src/user_workspace/screener_helpers.py:310-364,429-444` | 548 | Tính 6 metric cơ bản gồm `dividend_yield` | Từ financials, không từ dividend event |
| `packages/core/backend/src/vninvest_core/settings.py:545-989` | 989 | `CELERY_BEAT_SCHEDULE` — mọi lịch ingest/materialize | Không có job sync symbol groups |
| `packages/core/backend/src/service_ops/views/symbol_groups.py:296-312` | 329 | Endpoint sync nhóm thủ công | Có route `service_ops/urls.py:207` |

## B. LUỒNG DỮ LIỆU ĐÃ TRACE

### B1. Giá lịch sử (DailyPrice) — CÓ tự cập nhật

`CELERY_BEAT_SCHEDULE['daily-backfill-prices-1700']` (`settings.py:776-783`) → 17:05 ICT mỗi ngày gọi `data_ingest.tasks.backfill_daily_prices(days=365)`. Trong worker: `_fetch_and_upsert_bucket()` (`tasks.py:730-805`) gọi `fetch_daily_history()` (`vnbroker_adapter.py:680`) theo provider (VCI/KBS), rồi `_classify_daily_price_rows()` (`tasks.py:686-727`) so sánh 6 field `open/high/low/close/volume/source`; khác thì `bulk_create(..., update_conflicts=True, update_fields=['open','high','low','close','volume','source'], unique_fields=['symbol','date'])` (`tasks.py:790-796`). Bổ sung: weekly deep backfill 5 năm Chủ nhật 03:00 (`settings.py:796-805`) và pre-5-year Chủ nhật 04:00 (`:807-819`). Có manual backfill trong DataOps (`DataOpsContext.tsx:165-174`).

### B2. Giá trong phiên (SymbolSnapshot / SessionFacts) — CÓ, dạng polling

`materialize_symbol_snapshot` mỗi 300s mặc định (`settings.py:656-661`) → `vnbroker_materializer.py:131-291` bulk upsert `SymbolSnapshot`; `materialize_session_facts` mỗi 300s (`:667-670`); `warm_intraday_universe` mỗi 300s (`:769-773`); `schedule_realtime_prefetch_shards` mỗi 3s (`:676-679`). FE nhận qua WS (`signal_intelligence` broadcast) nhưng nguồn vẫn là snapshot định kỳ.

### B3. Cổ tức / corporate actions — KHÔNG có pipeline

`fetch_company_info()` gọi `company.events()` (`vnbroker_adapter.py:1186-1204`) và trả `events` dạng records thô; probe trước đó (`docs/evidence/closeout-dot1-20261113/qb2-probe.md:28`) cho DataFrame **rỗng `(0,0)`** dù provider tới được. Không có model `CorporateAction`, không có task ingest; `is_adjusted` (`market_data/models.py:80`) chỉ xuất hiện ở default/admin/serializer — grep gán `True` trong `src` → 0 hit. API bars chủ động trả `adjusted:false` + `note` (`stock_mgmt_native_views.py:4381-4384`).

### B4. Ví người dùng — cổ tức là giao dịch thủ công

Ledger hỗ trợ type `DIVIDEND` (`user_workspace/ledger/validators.py:160`, `user_workspace/test_ledger_holdings.py:201-213`) với `price=0` được phép; `dividend_income` chỉ tính từ giao dịch user nhập (`ledger/holdings.py:271-275`). Không có luồng "provider báo cổ tức → tự tạo transaction".

### B5. Cập nhật danh sách mã/nhóm — THỦ CÔNG

`sync_cached_symbol_groups()` (`vnbroker_adapter.py:1521-1630`) được gọi từ `POST /api/soc/symbol-groups/sync/` (`symbol_groups.py:296-312`) hoặc khi tạo nhóm trong stock-management (`stock_mgmt_native_views.py:3741-3742`). grep `CELERY_BEAT_SCHEDULE` → 0 entry.

## C. CONTRADICTIONS (plan/doc vs code)

| Tài liệu | Thực tế code | Tác động |
|---|---|---|
| `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md:18,80-91` đề xuất model `CorporateAction` + `adj_close` | Code chọn nhánh B: `adjusted:false`+note (`stock_mgmt_native_views.py:4381-4384`) theo probe `qb2-probe.md:28` | Đây là quyết định đã chốt, không phải bug; nhưng doc spec vẫn mô tả phương án (a) ⇒ dễ hiểu nhầm |
| `docs/BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md:141` ghi "Nguồn dữ liệu corporate actions: Có feed, W2.9" | Không có feed nào được wire; `Company.events()` rỗng | Kế hoạch W2.9 phần nguồn vẫn là [X] (chờ owner/feed), không phải "có feed" |
| `settings.py:656` tên job `materialize-symbol-snapshot-60s` | Schedule mặc định 300s (`:658`) | Tên gợi ý 60s nhưng thực tế 5 phút |
| `market_data/models.py:80` khai `is_adjusted` | Không nơi nào set True trong `src`; upsert (`tasks.py:794`) không đưa field này vào | Field "ảo", không phản ánh dữ liệu thật |

## D. FINDINGS

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| MDS-01 | HIGH | `market_data/models.py:80`, `stock_mgmt_native_views.py:4381-4384`, `vnbroker_adapter.py:1186-1204` | Không có corporate action model/pipeline; bars `adjusted:false` | Return, MA, backtest, P&L sai quanh ex-date dividend/split/rights | Model `CorporateAction` + ingest từ feed có sẵn (DNSE `get_corporate_action_history` theo `AUDIT_MARKET_DATA_SYNC_GAP_20260921.md:286-287`) hoặc giữ nhánh B + hiển thị cảnh báo rõ trên UI |
| MDS-02 | MED | `screener_helpers.py:328`, `vnbroker_adapter.py:1389,1414` | `dividend_yield` là snapshot financials cache 12h | Giá trị có thể cũ tối đa 12h, không phản ánh thông báo chia cổ tức mới | Thêm dividend calendar/event thật; nếu chưa có, gắn `as_of` + nhãn "snapshot 12h" trên screener |
| MDS-03 | MED | `symbol_groups.py:296-312`, `settings.py:545+` | Sync nhóm chỉ chạy thủ công | Mã mới/hủy niêm yết không tự cập nhật coverage/universe | Thêm beat job daily `sync_cached_symbol_groups` (idempotent) hoặc trigger sau `refresh_global_symbol_registry` |
| MDS-04 | MED | `settings.py:656-661,667-670,769-773` | Polling 300s dù tên "60s" | Độ trễ giá trong phiên tới 5 phút | Nếu cần realtime thật, dùng `vnbroker` `Stream`/tick có sẵn (đã nêu trong audit cũ MDG-03) hoặc đổi tên job cho trung thực |
| MDS-05 | LOW | `global_symbol_coverage.py:62-88`, `SocDataInventorySection.tsx:105-116` | 60.1% là tỉ lệ fresh, không phải sai số liệu | User có thể hiểu nhầm banner | Thêm tooltip giải thích 4 trạng thái freshness và nút "Refresh" dẫn tới DataOps planner |
| MDS-06 | LOW | `tasks.py:702-709,790-796` | Upsert ghi đè 6 field, không ghi `change_pct`/`is_adjusted` | `DailyPrice.change_pct` có thể null/0; FE dùng snapshot để tính nên tác động thấp | Đưa `change_pct` vào `next_values` + `update_fields` tính từ close hôm trước |

## E. QUALITY GATES AUDIT

- Đây là slice **doc-only, read-only**; không chạy `npm run build`/test trong slice này. Gate gần nhất đã chạy thật ở các slice trước: `pre-push-gate` 36 PASS (PR #450), vitest Header 13/13, BE test dataops OK — không suy diện sang slice này.
- i18n/lint/type-check: **CHƯA CHẠY** (không đổi source).
- Phạm vi grep: `packages/core/backend/src`, `packages/web/src`, `docs/` (đã quét cả `.md`/archive), config `settings.py` — theo Nguyên tắc 1 của khung audit.

## F. CÂU HỎI CẦN LÀM RÕ

1. Owner có nguồn corporate actions trả phí (DNSE/VSDC/HOSE) hay chấp nhận cơ chế `adjusted:false + note` vĩnh viễn?
2. Có cần tự động sync danh sách mã mới/hủy niêm yết mỗi ngày không, hay vẫn để operator bấm tay?
3. Yêu cầu độ trễ giá trong phiên là bao nhiêu (5 phút hiện tại có chấp nhận)?
4. Có cần hiển thị `dividend_yield` kèm `as_of`/nguồn trên screener không?

## G. ĐÁNH GIÁ TỔNG THỂ

- **Giá cổ phiếu: CÓ cơ chế đồng bộ** (ngày 17:05 ICT + weekly deep backfill + snapshot/phiên 5 phút), nhưng không phải tick realtime.
- **Cổ tức/chia tách: KHÔNG tự động**, hệ thống đang trung thực báo `adjusted:false` thay vì bịa `adj_close`. Đây là điểm cần quyết định sản phẩm, không phải lỗi code đơn thuần.
- Implementable: có (đã có ứng viên feed `Company.events()`/`DNSE get_corporate_action_history`), nhưng **blocked bởi nguồn dữ liệu + owner chốt**. Ưu tiên: MDS-01 → MDS-03 → MDS-02 → MDS-04.
- Không tự mở rộng sang tích hợp feed khi chưa có quyết định owner (theo STOP condition của plan).
