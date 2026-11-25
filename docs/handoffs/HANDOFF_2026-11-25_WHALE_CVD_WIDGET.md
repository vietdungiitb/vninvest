# Handoff — Whale/CVD Full Timeframe: phần việc cho vninvestcharts-widget code team

**Ngày:** 2026-11-25
**Repo bàn giao:** `vninvestcharts-widget` (code team riêng)
**Repo nguồn dữ liệu:** `vninvest` (BE + FE adapter) — nhánh `feat/whale-cvd-full-tf` (base `origin/dev`), re-audit xong.
**Trạng thái:** BE contract + FE wiring **đã giao**; widget team cần cập nhật adapter + overlay. Residual R-03/R-04 nằm hoàn toàn trong repo widget.
**Evidence:** `docs/evidence/whale-cvd-full-tf/gates.md` · `docs/AUDIT_WHALE_CVD_FULL_TF_REAUDIT_20261125.md` · Entry 640 trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

## 1. Scope

- **vninvest (tôi làm):** BE contract (session-facts/cvd mở rộng window, whale endpoint + whale_buckets), FE adapter wiring, tests.
- **vninvestcharts-widget (code team tự làm):** cập nhật `sessionFactsCvd.ts`, whale marker handling, overlay alignment, plan REQ-05. **Không sửa BE.**

## 2. Contract BE sẽ giao (để widget team code theo)

### 2.1 CVD — `/core/v1/session-facts/{symbol}/cvd/`

Query: `?window={5m|15m|30m|1h|4h|1D}&trade_date=YYYY-MM-DD` (trade_date optional, default phiên gần nhất có data). 1W không qua session-facts (per-session) — dùng dark-money-history aggregate cho weekly.

Response (200):
```json
{
  "symbol": "VIC",
  "session_date": "2026-11-24",
  "window": "1D",
  "bucket_minutes": 1440,
  "cvd_normalized": 62.5,
  "delta_strength_pct": 12.3,
  "whale_net_flow": 123456789,
  "cvd_series": [
    { "bucket_ts": "2026-11-24T00:00:00+07:00", "cumulative_cvd": 123456789, "buy_volume": 987654321, "sell_volume": 864197532, "delta": 123456789, "buy_strength": 66.5, "institutional_strength": 59.2 }
  ],
  "delta": 123456789,
  "revision": 1730000000,
  "updated_at": "2026-11-24T16:15:32+07:00",
  "unit": "vnd",
  "source": "whale_aggregate",
  "data_quality": "derived_from_whale_alerts",
  "trade_count": null
}
```
- Empty (có nguồn nhưng rỗng): `cvd_series: []`, `data_status: "missing_cvd_buckets"`, `delta:0`, `revision:0`, `updated_at:null`, `trade_count:null`, `unit/source/data_quality` vẫn có.
- `400 UNSUPPORTED_WINDOW` nếu window không trong tập (không fallback êm).
- `403` nếu thiếu scope `market:read`.
- Cache key kẹp revision: `core:cvd_series:v2:{symbol}:{session_date}:{bucket_minutes}:{revision}`.

### 2.2 Whale — `/core/v1/realtime/whale-feed/{symbol}/`

Query: `?from=&to=&min_value=&limit=&cursor=` (optional; bare URL = phiên gần nhất có data).

Response (200) — flat, +07:00:
```json
{
  "symbol": "VIC",
  "revision": 1730000000,
  "updated_at": "2026-11-24T16:15:32+07:00",
  "whale_orders": [
    { "order_id": "VIC-912345", "ts": "2026-11-24T16:15:32+07:00", "price": 24500, "volume": 120000, "matched_value": 2940000000, "side": "buy", "size_class": "shark", "buyer_broker": null, "seller_broker": null }
  ],
  "alerts": [ { "...": "shape cũ, giữ nguyên" } ],
  "summary": { "buy_value": 2940000000, "sell_value": 0, "whale_buy": 0, "whale_sell": 0, "shark_buy": 2940000000, "shark_sell": 0, "small_buy": 0, "small_sell": 0 },
  "next_cursor": null,
  "source": "whale_alert_canonical",
  "data_quality": "provider_side_from_tick",
  "freshness_by_tier": { "hot": "<=300s", "warm": "<=900s", "cold": "backfill_only" },
  "retention_days": 365
}
```
- `price` = giá khớp thật (không phải matched_value). `ts` = ISO +07:00.
- size_class: small [500M,1B), shark [1B,5B), whale >=5B. min_value floor 500M.
- Empty: `whale_orders: []`, summary 8 field = 0, `revision:0`, `updated_at:null`, `next_cursor:null`, `alerts:[]`.
- `limit` default 50 / max 1000; vượt → 400 LIMIT_EXCEEDED. Keyset cursor `(executed_at, pk)`.
- `revision` = MAX(executed_at) epoch s; widget invalidate cache khi đổi.

### 2.3 Whale buckets (MỚI — decision 2, ✅ ĐÃ implement trên `feat/whale-cvd-full-tf`)

BE **đã implement** aggregation per bucket cho 4h/1D/1W (`market_serving/native_views.py:492` `build_whale_buckets()`, view handler `:628`). Shape dưới đây là shape cuối đã giao:
```json
"whale_buckets": [
  { "bucket_ts": "2026-11-24T00:00:00+07:00", "ts": 1732406400, "price": 24500, "net_value": 2940000000, "dominance": "buy", "size_class": "shark", "count": 3 }
]
```
- `bucket_ts`: ISO +07:00 căn đầu bucket (Thứ Hai 00:00 cho 1W).
- `ts`: unix seconds (để widget `new Date(ts)` align với bar xScale).
- `price`: close của bucket (từ DailyPrice) — không phải matched_value.
- `net_value`: buy - sell trong bucket.
- `dominance`: `"buy" | "sell" | "neutral"` — `neutral` khi `net_value == 0` (kể cả bucket rỗng).
- `size_class`: theo ngưỡng trên `net_value` (abs); `small` khi <500M.
- `count`: số whale tick trong bucket.
- Bucket rỗng vẫn trả (`net_value=0`, `count=0`, `dominance="neutral"`, `price`=close từ `DailyPrice`) để trục liên tục.
- Query: `?window={4h|1D|1W}` trên `/core/v1/realtime/whale-feed/{symbol}/`; **không phân biệt hoa thường**, alias `1d`/`1w` được nhận; window lạ → `400 UNSUPPORTED_WINDOW` (không fallback êm sang per-tick). Bỏ `window` → payload per-tick `whale_orders[]` như cũ.

### 2.4 Dark-money-history (alias)

`/core/v1/stock-management/stocks/{symbol}/dark-money-history/` giữ nguyên nhưng:
- `cvd_series` items: thêm `delta`, `cvd`, `unit:"vnd"` (parity D4).
- `whale_signals` items: thêm `price` (close bucket) + `time` unix seconds (thay date string).
- `dark_flow_series` giữ nguyên.

## 3. Việc widget team phải làm (code team tự thực hiện)

1. **`sessionFactsCvd.ts`** (adapter):
   - Thêm param `window?: '5m'|'15m'|'30m'|'1h'|'4h'|'1D'` (1W không qua session-facts — dùng dark-money-history).
   - Parse fields mới: `delta`, `revision`, `updated_at`, `unit`, `source`, `data_quality`, `trade_count`.
   - Cache key theo revision (invalidate khi revision đổi).
2. **Whale marker handling**:
   - Intraday (1m/5m/15m/30m/1h): dùng `whale_orders[]` (per-tick) như hiện tại — `ts` ISO +07:00, `price` thật, `matched_value`.
   - Daily/weekly/4h: dùng `whale_buckets[]` — `ts` unix, `price` close bucket, `net_value`, `dominance`.
   - Không dùng `s.value` / `matched_value` (VND) làm `price` (bug F-03). FE vninvest hiện vẫn gán `whaleSignals` từ `dark_money.whale_signals` nhưng đã sửa `price`/`matched_value` = close (`StockDetailPage.tsx:150-155`); widget team nên thay hoàn toàn bằng `whale_buckets[]` theo item 4 bên dưới.
3. **ExternalCVDOverlay**: đã expect `bucket_ts` + `cumulative_cvd`. Đảm bảo parse `new Date(bucket_ts)` align với bar xScale. BE trả `+07:00` ⇒ widget parse OK. Không cần đổi overlay code, chỉ cần feed đúng data.
4. **PLAN_WHALE_CVD_UX_FIX REQ-05**: cập nhật để dùng `whale_buckets[]` cho daily/weekly thay vì whale feed per-tick; thêm case 4h.
5. **Timezone**: BE trả `+07:00` (D5 carve-out). Widget parse `new Date(ts)` → align bar dates. Nếu bar dates là UTC midnight (date-only string), cần BE trả `ts` unix (đã làm) để tránh mismatch. Widget nên prefer `ts` (unix) nếu có, fallback `bucket_ts`.
6. **R-03 (whale bucket rỗng)**: BE `build_whale_buckets()` đã fill bucket rỗng từ `DailyPrice` (count=0). Widget team đảm bảo marker render đúng cho bucket `count=0` (không skip) để trục liên tục.
7. **R-04 (CVD 4h)**: BE session-facts/cvd đã hỗ trợ `?window=4h` (mỗi session/ngày). Widget team cần: (a) gọi session-facts/cvd `window=4h` cho từng ngày visible thay vì dùng `orderFlow` 1h; (b) aggregate cvd_series theo 4h bucket; (c) cập nhật `sessionFactsCvd.ts` nhận `window`. Hiện FE vninvest vẫn dùng dark-money cho d/1d/1w; 4h để widget team xử lý theo contract này.

## 4. Việc vninvest (tôi) làm — TRẠNG THÁI (2026-11-25)

- ✅ BE: rebase onto dev (`feat/whale-cvd-full-tf`); implement `build_whale_buckets()` + `?window=` param trong `RealtimeWhaleFeedView`; fix dark-money helper (F-01 per-tick filter, F-02 side strict, F-07 delta/cvd/unit, UTC timezone, price+ts in whale_signals); schema `cvd_series` added.
- ✅ FE: adapter wiring (`getDarkMoneyHistory`, `getSessionFactsCvd`); `useStockDetailPageModel` darkMoneyData; `StockDetailPage` override daily/weekly (whaleSignals + orderFlowData + darkFlow).
- ✅ Tests (coordinator tự chạy, log tại `docs/evidence/whale-cvd-full-tf/gates.md`): `py_compile` OK; BE **9/9** trên VPS Postgres (`vninvest-core-api` → `vninvest-core-db:5432`); `tsc --noEmit` 0 lỗi; `vitest run src/features/stock-detail` **16/16** (3 test mới chạm dark-money path); `npm run build` ✓.
- ⚠ R-04: `VNStockChartPanel.js:52` `enableCVD` mặc định `false`, không caller nào truyền `true` ⇒ widget có render `externalCvdSeries` hay không **CHƯA XÁC MINH** bằng runtime. FE đã override `cvd_series` nhưng bật overlay là việc widget team.
- ✅ Extend session-facts/cvd windows to 4h/1D (decision 1) — done: `_floor_bucket` hỗ trợ 4h/1D, `_SERIES_WINDOWS_BY_LABEL` thêm 4h/1D, views `_WINDOW_TO_BUCKET_MINUTES` + canonical window label. 1W không qua session-facts (per-session) — dùng dark-money-history aggregate (đã fill empty weeks, F-06) cho weekly.
- ✅ dark-money helper: F-01 (per-tick filter), F-02 (side strict), F-06 (fill empty buckets từ DailyPrice), F-07 (delta/cvd/unit), F-04 (UTC midnight), F-03 (price+ts trong whale_signals).

## 5. Non-goal cho widget team

- Không sửa BE.
- Không upgrade widget từ phía `vninvest`: `packages/web/package.json:107` đang dùng tgz `0.4.7-ent` (không phải npm `1.2.5`). Alignment fix là data/timezone + contract, không phải bump version.
- Không xây pipeline tick realtime.

## 6. Liên hệ / cập nhật

- Contract chi tiết: `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (REV.2.2).
- Audit độc lập: `docs/AUDIT_WHALE_CVD_FULL_TF_REAUDIT_20261125.md` (2 subagent, mọi finding đã xử lý hoặc ghi residual).
- Research: `docs/RESEARCH_WHALE_CVD_FULL_TIMEFRAME_20261125.md`.
- Gates: `docs/evidence/whale-cvd-full-tf/gates.md`.
- Widget team theo dõi commit cuối của `feat/whale-cvd-full-tf` trên `origin/dev`; contract shape ở mục 2.3 là final, không còn thay đổi.
