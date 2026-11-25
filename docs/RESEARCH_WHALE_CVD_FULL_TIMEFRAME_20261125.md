# Nghiên cứu: Whale Alert & CVD Darkflow Full Timeframe (1D/1W/4h)

**Ngày:** 2026-11-25
**Vai trò:** PM vninvest (cung cấp dữ liệu cho widget vninvestcharts-widget)
**Phạm vi:** BE (vninvest) + FE (vninvest) + contract với widget
**Trạng thái:** Nghiên cứu — **AS-IS trước slice `feat/whale-cvd-full-tf`**. Không đọc các mục dưới như trạng thái hiện tại.

> **Cập nhật sau slice (2026-11-25):** các dòng dưới mô tả hiện trạng *trước khi code*. Kết quả cuối: `whale_buckets[]` **đã implement** (`market_serving/native_views.py:492`, handler `:628`, alias `1d`/`1w` + `400` cho window lạ); session-facts/cvd hỗ trợ `4h/1D`, **không** hỗ trợ `1W` (weekly lấy `cvd_series` từ dark-money aggregate); widget thực tế là tgz `0.4.7-ent` (`packages/web/package.json:107`), không phải npm `1.2.5`. Xem `docs/AUDIT_WHALE_CVD_FULL_TF_REAUDIT_20261125.md` + handoff widget để có trạng thái hiện hành.

## 1. Tóm tắt kết luận

- BE contract **đã có** implementation trên nhánh `feat/whale-cvd-contract-be` (merged PR #525 vào main? chưa — `c75012499` chưa ancestor của main). Implementation tuân theo `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` REV.2.2: CVD mở rộng `/session-facts/{symbol}/cvd/` với `delta/revision/unit/source/trade_count` + cache key kẹp revision; Whale builder `build_whale_feed_payload()` per-tick từ `WhaleAlertCanonical`, 8-field summary, scope `market:read`, +07:00.
- Nhánh hiện tại `feat/whale-cvd-1d-1w` (của tôi) **đi sai hướng**: dùng `dark-money-history` aggregate `WhaleAlertCanonical` theo ngày (không lọc `whale_tick:`, `else: sell`, timezone ICT → lệch trục). Audit `origin/audit/whale-cvd-1d1w-20261125` báo 9 findings (F-01..F-09), chưa nên merge.
- **2 quyết định Owner cần chốt** (từ audit §F): (1) CVD canonical mở rộng session-facts/cvd cho 4h/1D/1W, dark-money-history.cvd_series chỉ alias; (2) Whale giữ `whale_orders[]` per-tick intraday + thêm `whale_buckets[]` theo `?window=` cho 4h/1D/1W.
- `whale_buckets[]` **chưa implement** ở contract branch (grep: 0 hit). Đây là gap chính còn lại.
- Widget (`vninvestcharts-widget@1.2.5`) **không cần upgrade**: ExternalCVDOverlay expects `bucket_ts` + `cumulative_cvd`; whale markers expect `ts` + `matched_value`. Alignment issue là do timezone (ICT vs UTC), đã fix ở nhánh tôi (bucket_ts UTC midnight). Nhưng contract branch dùng `+07:00` (D5) → widget phải parse `new Date(ts)` correctly; widget đã làm vậy. OK.
- **Không cần cài phiên bản widget mới.** Overlay misalignment gốc là timezone data, không phải widget version. 1.2.6 (C:\Temp) không có fix alignment khác (ExternalCVDOverlay cùng code).

## 2. Trạng thái hiện tại (bằng chứng)

| Nhánh | Base | Trạng thái |
|---|---|---|
| `feat/whale-cvd-1d-1w` (của tôi) | `main@3f4484edc` | Có helper `_compute_daily_weekly_cvd_series` (dark-money-history), FE override. Audit: 9 findings. |
| `feat/whale-cvd-contract-be` | merged PR #525 | Implementation canonical (CVD + whale builder). Chưa merged vào main (`c75012499` not ancestor of main). |
| `origin/audit/whale-cvd-1d1w-20261125` | main | Audit report (9 findings). |

## 3. Audit findings cần xử lý (từ audit §D)

| ID | Mức | Vấn đề | Fix |
|---|---|---|---|
| F-01 | P0 | Helper CVD không lọc `whale_tick:` ⇒ cộng đôi ~6.290 row aggregate `tick_session:` clamp 5B | Thêm filter `alert__source_ref__startswith='whale_tick:'` + floor 500M; rebase lên dev trước. |
| F-02 | P0 | `else: sell` tái phạm bug D4 | `if buy / elif sell / else continue`. |
| F-03 | P1 | Whale daily không có giá thị trường; FE dùng `s.value` (VND) làm `price` ⇒ marker sai trục | BE thêm `price` = close bucket (từ DailyPrice) vào `whale_signals`; hoặc FE map về close candle. |
| F-04 | P1 | `time` daily là date string thay vì unix seconds (intraday dùng unix) | Dùng `_to_unix_seconds()` cho daily/weekly (đồng nhất intraday). |
| F-05 | P1 | Không có test mới; 2 test dark-money xanh ở baseline (vacuous) | Thêm test fail-before: per-tick filter, side strict, cumulative theo ngày/tuần, range rỗng, ISO week qua năm. |
| F-06 | P2 | `bucket_ts` lấy max_date của alert; candle weekly lấy row.date cuối DailyPrice; tuần không có alert bị bỏ bucket | Sinh bucket từ lịch candles/period, fill bucket rỗng. |
| F-07 | P2 | Payload thiếu `cvd`/`delta` và `unit:"vnd"`; `mapToCvdSeries` gán `cvd=0` | Thêm `delta`, `cvd`, `unit:"vnd"` cho parity D4. |
| F-08 | P1 | Branch based on main, thiếu fix D4 của dev | Rebase `feat/whale-cvd-1d-1w` onto `origin/dev` (hoặc contract branch). |
| F-09 | P2 | Ledger Entry 57 ghi sai nguyên nhân 2 fail groups_seed | Sửa mô tả. |

## 4. Hai quyết định Owner (từ audit §F) — đề xuất trả lời

**Quyết định 1 — Endpoint CVD canonical:**
- **Đề xuất: AGREE.** Mở rộng `/session-facts/{symbol}/cvd/` cho 4h/1D/1W (contract branch đã làm cho 5m/15m/30m/1h; cần thêm 4h/1D/1W). `dark-money-history.cvd_series` chỉ làm alias cùng shape. Tránh 2 logic cạnh nhau.
- Lý do: contract branch đã implement canonical với `delta/revision/unit/source/trade_count` + cache key kẹp revision. dark-money-history chỉ aggregate per-day (không có session facts semantics) → không nên là source chính.
- **Lưu ý FE/widget:** session-facts/cvd là per-session (one trade_date). Cho chart daily spanning nhiều ngày, FE cần gọi per-day hoặc cần range endpoint. Đây là gap cần xử lý ở FE (batch calls per visible day) hoặc BE thêm range param. Đề xuất: BE thêm `?from=&to=` range support vào session-facts/cvd, hoặc FE batch per-day với cache.

**Quyết định 2 — Whale:**
- **Đề xuất: AGREE.** Giữ `whale_orders[]` per-tick cho intraday + thêm `whale_buckets[]` theo `?window=` cho 4h/1D/1W.
- `whale_buckets[]` chưa implement (grep 0 hit). Cần BE thêm: aggregation per bucket (date/week) từ `WhaleAlertCanonical` (per-tick), trả `{bucket_ts, price (close), net_value, dominance, size_class, count, ts (unix)}`.
- FE/widget: intraday dùng `whale_orders[]` (per-tick marker), daily/weekly dùng `whale_buckets[]` (bucket marker). Tránh marker sai trục (F-03).

## 5. Kế hoạch thực hiện (chưa code)

### Phase A — Rebase & align (BE)
1. Rebase `feat/whale-cvd-1d-1w` onto `origin/dev` (hoặc contract branch `feat/whale-cvd-contract-be`).
2. Drop helper `_compute_daily_weekly_cvd_series` (dark-money) hoặc chuyển thành alias gọi session-facts/cvd.
3. Fix F-01/F-02 (filter per-tick + side strict).
4. Implement whale_buckets aggregation (decision 2) — new helper + `?window=` param.
5. Extend session-facts/cvd windows to {5m,15m,30m,1h,4h,1D,1W} (decision 1).
6. dark-money-history: align `price`/`time` (unix) + `delta/cvd/unit` (F-03/F-04/F-07) — hoặc deprecate cvd_series (alias).

### Phase B — FE/widget
1. `sessionFactsCvd.ts` (widget): thêm `window` param; parse new fields.
2. StockDetailPage: switch daily/weekly CVD source từ dark-money-history → session-facts/cvd (per day or range).
3. Whale markers: daily/weekly dùng `whale_buckets[]` (price = close, ts unix).
4. Keep intraday whale_orders per-tick.
5. Update `PLAN_WHALE_CVD_UX_FIX` REQ-05.

### Phase C — Tests (fail-before)
1. BE: per-tick filter, side strict, cumulative per day/week, empty range, ISO week across year, 400 UNSUPPORTED_WINDOW, 403 scope, 501 body, 8-field summary invariant, +07:00.
2. FE: mapping tests for daily path.
3. Re-audit.

### Phase D — Quality gates
- `manage.py test market_serving signal_intelligence data_ingest` trên Postgres.
- `makemigrations --check --dry-run` = no changes.
- `npx tsc --noEmit`, `npm run build`, `vitest run`.

## 6. Câu hỏi Owner — đã chốt (2026-11-25)

1. **CVD cho 4h**: ✅ **Có** — Owner chọn có (tránh ngắt quãng). Mở rộng session-facts/cvd windows thêm `4h` (cùng `5m/15m/30m/1h/1D/1W`).
2. **Whale daily representation**: Owner không rõ → **Khuyến nghị & chốt: aggregate theo bucket** (date/week) thay vì list alert tối đa 100. Lý do: list alert có gap (tuần không có alert → bucket bị bỏ, cumulative đứt đoạn, lệch trục candle — audit F-06). Aggregate by bucket từ lịch candles/period, fill bucket rỗng (0) ⇒ trục liên tục, khớp candle. `whale_signals` list alert vẫn giữ cho intraday/debug, nhưng daily/weekly marker dùng `whale_buckets[]`.
3. **Widget REQ-05**: **Gộp với endpoint mới** — dùng `whale_buckets[]` cho daily/weekly (price=close thật, ts unix) thay vì whale feed per-tick. Chính xác hơn vì tránh marker sai trục (F-03) và timezone mismatch (F-04). Per-tick `whale_orders[]` chỉ cho intraday.

## 7. Khuyến nghị Immediate

- **Không merge** `feat/whale-cvd-1d-1w` hiện tại (audit: chưa implementable).
- **Rebase** lên contract branch / dev trước khi làm tiếp.
- **Owner chốt 2 quyết định** (mục 4) + 3 câu hỏi (mục 6) để tôi code.

## 8. Non-goal

- Không migration DB.
- Không xây pipeline tick realtime.
- Không đổi retention lên 30 ngày.
- Không sửa repo widget (chỉ cập nhật adapter FE).
- Không cài phiên bản widget mới (1.2.5 đủ; alignment fix là data timezone).
