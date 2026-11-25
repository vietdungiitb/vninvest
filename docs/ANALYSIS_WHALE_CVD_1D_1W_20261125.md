# Phân tích: Whale Alert & CVD Darkflow cho khung 1D / 1W

**Ngày:** 2026-11-25
**Phạm vi:** packages/core (Django) + packages/web (React/Vite)
**Câu hỏi:** Có whale alert và CVD darkflow cho khung 1D và 1W không? Làm được không?
**Trạng thái:** Phân tích **AS-IS trước slice** — các `file:line` bên dưới mô tả code *trước* `feat/whale-cvd-full-tf`.

> **Cập nhật sau slice:** FE giờ fetch dark-money cho `d/1d/1w` (`useStockDetailPageModel.js:171-200`) và override whale/CVD tại `StockDetailPage.tsx:146-181`; BE có `whale_buckets[]` + `cvd_series` daily/weekly. Kết quả cuối xem `docs/AUDIT_WHALE_CVD_FULL_TF_REAUDIT_20261125.md`.

## 1. Tóm tắt kết luận

- **Whale Alert:** Có hỗ trợ một phần. Backend `dark-money-history` đã hỗ trợ interval `1D`/`1W` (`_DARK_MONEY_INTERVAL_ALIASES` tại `stock_mgmt_native_views.py:333-342`), gom `UnifiedAlert` (whale/dark_flow/signal) theo **ngày** (`bucket_key = local_dt.date().isoformat()`, line 1959-1960) và trả `whale_signals` (tối đa 100) + `dark_flow_series` (strength TB, whale_buy/sell value theo ngày). Frontend chart panel (`VNStockChartPanel.js`) nhận `whaleSignals` prop và render marker. **Tuy nhiên** frontend lấy `whaleSignals` từ `whaleFeed` (session-scoped intraday, `StockDetailPage.tsx:290`), không phải từ `dark-money-history`, nên trên khung 1D/1W marker có thể lệch/không khớp candle daily.
- **CVD Darkflow:** Chưa có cho 1D/1W. CVD (cumulative volume delta) chỉ được tính intraday theo session (`SessionFacts` engine, windows `5m/15m/30m/1h` tại `session_facts_engine.py:56-61`). `dark-money-history` trả `dark_flow_series` có `strength`/`whale_buy_value`/`whale_sell_value` theo ngày nhưng **không** có `cumulative_cvd`. Không có endpoint tính CVD tích lũy theo ngày/tuần.
- **Có làm được không?** Có. Khả thi với backend aggregation theo ngày/tuần từ `WhaleAlertCanonical` (đã có `executed_at`, `side`, `matched_value`) + frontend wiring. Ước lượng effort trung bình.

## 2. Bằng chứng file:line

### Backend — dark-money-history hỗ trợ 1D/1W
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py:333-342` — `_DARK_MONEY_INTERVAL_ALIASES` map `'1d'→'1D'`, `'1w'→'1W'`.
- `:344-351` — `_DARK_MONEY_INTRADAY_MAX_DAYS` chỉ intraday (1m..4h); 1D/1W không có → `is_intraday=False`.
- `:1875` — `interval = _normalize_dark_money_interval(...)`.
- `:1882` — `is_intraday = interval in _DARK_MONEY_INTRADAY_MAX_DAYS`.
- `:1914-1930` — nhánh daily: lấy `DailyPrice`, `_aggregate_daily_rows(rows, timeframe)` với `timeframe='W' if interval=='1W' else 'D'`.
- `:1932-1942` — alerts filter `UnifiedAlert` (whale/dark_flow/signal) theo `triggered_at__date__gte=start_date`.
- `:1956-1960` — `bucket_key = local_dt.date().isoformat()` (theo ngày) cho non-intraday.
- `:1985-1995` — `whale_signals` list (≤100) với time/confidence/strength/value.
- `:1997-2012` — `dark_flow_series` với strength, signal_count, whale_buy_value, whale_sell_value per ngày.

### Backend — CVD chỉ intraday
- `packages/core/backend/src/market_serving/session_facts_engine.py:56-61` — `_SERIES_WINDOWS_BY_LABEL = {5m,15m,30m,1h}`.
- `:106-247` — `_compute_session_facts_from_rows` tính CVD theo bucket intraday, data source `WhaleAlertCanonical` (line 40, 94-97).
- `packages/core/backend/src/market_serving/views.py:273-426` — `SessionFactsCvdView` chỉ nhận `window` in {5m,15m,30m,1h} (`_WINDOW_TO_BUCKET_MINUTES`).
- `packages/core/backend/src/signal_intelligence/models.py:76-107` — `WhaleAlertCanonical` có `executed_at`, `side`, `matched_value`, `is_dark_flow` — đủ để aggregate theo ngày/tuần.

### Frontend
- `packages/web/src/pages/StockDetailPage.tsx:289-291` — `whaleSignals: whaleFeed` (session-scoped).
- `packages/web/src/components/VNStockChartPanel.js:127-144` — `mappedWhaleOrders` từ `whaleSignals` + `orderFlowData.whale_orders`; `mappedCvdSeries` từ `orderFlowData.cvd_series`.
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js:7` — `DEFAULT_ORDER_FLOW_WINDOW = "1h"`; `getSessionFactsCvd(symbol, {window:'1h'})`.
- `packages/web/src/adapters/core/market.js:244-252` — `getDarkMoneyHistory(symbol, {interval, period})` đã có.

## 3. Gap & đề xuất (nếu muốn implement)

**A. Whale alert trên 1D/1W (cải thiện wiring)**
1. Khi `activeTimeframe` ∈ {1D, 1W}, gọi `adapter.getDarkMoneyHistory(symbol, {interval: activeTimeframe, period: activePeriod})` thay vì dùng `whaleFeed`.
2. Map `whale_signals` (time: bucket_key unix? hiện time là string date cho non-intraday) → marker format mà `useViewportWhaleMarkers`/`mapToWhaleOrders` hiểu. Cần chuẩn hóa `time` thành timestamp (hiện `bucket_key` là ISO date string cho daily; `mapToWhaleOrders` cần parse). 
3. Có thể merge với intraday whale feed khi timeframe intraday.

**B. CVD Darkflow cho 1D/1W (backend mới)**
1. Tạo aggregation từ `WhaleAlertCanonical`: group by date (và week cho 1W), sum `matched_value` theo side → daily net CVD; cumulative sum over range → `cumulative_cvd` per day/week.
2. Dark flow strength per day: dùng `_compute` logic hoặc reuse `dark_flow_score = min(|net_cvd|/total*100, 100)`.
3. Expose qua `dark-money-history` response thêm field `cvd_series: [{time, cumulative_cvd, buy_value, sell_value, strength}]` (hoặc endpoint riêng `/session-facts/.../cvd?window=1d`).
4. Frontend: khi daily/weekly, set `orderFlowData.cvd_series` từ response này để `mappedCvdSeries` render pane CVD.

**C. Quality gates**
- Thêm test backend cho daily/weekly CVD aggregation (mirrors `test_native_views.py`).
- Test frontend mapping.

## 4. Kết luận khả thi

- Whale alert daily/weekly: **có sẵn backend**, chỉ cần wiring frontend + chuẩn hóa time field. Effort thấp.
- CVD daily/weekly: **chưa có**, cần backend aggregation + frontend wiring. Effort trung bình. Có thể tận dụng `WhaleAlertCanonical` (đã có đủ field) nên không cần migration dữ liệu mới.
- Không có blocker về dữ liệu (IntradayBar/DailyPrice + WhaleAlertCanonical đã tồn tại). Chỉ cần logic aggregation + contract frontend.