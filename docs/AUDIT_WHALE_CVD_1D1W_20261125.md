# AUDIT — Whale Alert & CVD Darkflow 1D/1W (2026-11-25)

**5 findings nghiêm trọng nhất:** (1) helper CVD mới (`stock_mgmt_native_views.py:1003-1012`) **không lọc `whale_tick:`** ⇒ cộng đôi ~6.290 row aggregate `tick_session:` đã bị clamp 5B (F-01/P0); (2) `else: sell` ở `:1033-1036` tái phạm bug D4 đã sửa trên `dev` (F-02/P0); (3) `whale_signals` daily không có giá thị trường, frontend dùng `s.value` (VND) làm `price` ⇒ marker vẽ sai trục giá (F-03/P1); (4) `time` daily là date string thay vì unix seconds như nhánh intraday (F-04/P1); (5) **không có test mới** cho aggregation — 2 test dark-money "2/2" là test cũ, xanh cả trước sau (F-05/P1, L-E01). Branch cũng dựa trên `main`, chưa có fix D4 của `dev` (F-08/P1). Kết luận: **chưa nên merge; cần sửa BE 5 điểm trước khi đưa vào production.**

## 0. Nguyên tắc / phạm vi

- Audit độc lập, **không sửa code**; mọi khẳng định kèm `file:line`; chưa đọc thì ghi CHƯA XÁC MINH.
- Scope: thay đổi chưa commit trên `vninvest@feat/whale-cvd-1d-1w` (base `main@3f4484edc`) + twin repo `vninvestcharts-widget` (`origin/dev@71455714`).
- Báo cáo ghi tại worktree `D:\Mujoco Projects\wt\vninvest-audit-1d1w` (Rule 18). Không đụng `docs/evidence/widget-news-events/` của agent khác.

## 1. Đọc trước

`docs/ANALYSIS_WHALE_CVD_1D_1W_20261125.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 57, `vninvest@origin/dev:docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` §D1/D4/D5, AGENTS.md Rule 12/14, widget plan `PLAN_WHALE_CVD_UX_FIX_2026-11-25.md`.

## 2. Phạm vi nghiên cứu

- **A. BE:** `packages/core/backend/src/market_data/stock_mgmt_native_views.py` (helper mới + wire response), đối chiếu `signal_intelligence/{tasks.py,models.py}`, `market_serving/{session_facts_engine.py,native_views.py}` trên `origin/dev`.
- **B. FE:** `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js`, `packages/web/src/pages/StockDetailPage.tsx`, `packages/web/src/components/VNStockChartPanel.js`, `packages/web/src/utils/VNInvestSignalAdapter.js`.
- **C. Twin-repo:** widget `src/widget/adapters/sessionFactsCvd.ts`, `src/widget/overlayPainters/externalCvdPainter.ts`; BE endpoint mới là `dark-money-history`, **không phải** `/session-facts/{symbol}/cvd/` đã ký kết.
- **D. Quality gates:** tự chạy lại (mục 4E).

## 3. Phương pháp

B1 đọc docs/plans → B2 `git status`/`git diff` → B3 grep symbol → B4 read trace 1 use-case (dark-money-history 1W → response → frontend override → widget painter) → B5 đối chiếu `main` vs `origin/dev` → B6 chạy gate trên cây có đổi và trên worktree baseline sạch (`3f4484edc`).

## 4. Đầu ra

### A. Bản đồ thay đổi

| File | Dòng đổi | Trách nhiệm |
|---|---|---|
| `stock_mgmt_native_views.py` | +65 | `_compute_daily_weekly_cvd_series` + `cvd_series` trong response dark-money-history |
| `useStockDetailPageModel.js` | +30 | state `darkMoneyData`, effect fetch khi 1D/1W, guard `typeof` |
| `StockDetailPage.tsx` | +29-2 | override `chartWhaleSignals`/`chartOrderFlowData` |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | +16 | Entry 57 |

### B. Luồng dữ liệu đã trace

`activeTimeframe ∈ {1D,1W}` → `useStockDetailPageModel.js:171-198` fetch `getDarkMoneyHistory({interval, period:'3M'})` → `StockDetailPage.tsx:140-160` override 2 prop → `VNStockChartPanel.js:127-146` `mapToWhaleOrders`/`mapToCvdSeries` → widget `externalCvdSeries` + whaleOrders → `whalePainter.ts` / `externalCvdPainter.ts`. Bridge: `stock_mgmt_native_views.py:2000-2004` gọi helper, `:2097` trả `cvd_series`.

### C. CONTRADICTIONS (plan/doc vs code)

| Doc | Code | Tác động |
|---|---|---|
| Analysis `:42` nói `time` daily là date string, cần chuẩn hóa | `stock_mgmt_native_views.py:2020` vẫn `local_dt.date().isoformat()` | F-04 chưa sửa |
| Analysis `:48` đề xuất `cvd_series` có `{time, cumulative_cvd, buy_value, sell_value, strength}` | Code trả `{bucket_ts, cumulative_cvd, buy_value, sell_value}` (thiếu `strength`, `cvd`, `unit`) | F-07 |
| Entry 57 ghi 2 fail do "thiếu module vnbroker" | Baseline `3f4484edc` cũng 50 test / 2fail, tên là `*_groups_seed_detail_and_items_are_native` (`0 != 3`); vnbroker chỉ là log warning | Sửa mô tả ledger; không quy sai nguyên nhân |
| Widget plan REQ-05 muốn whale 1h/4h/1D/1W | BE mới chỉ thêm 1D/1W; 4h CVD vẫn `cvd_series: []` (`stock_mgmt_native_views.py:2000-2001`), session-facts windows max `1h` | Widget phải tách: whale 4h map client; CVD 4h vẫn non-goal |

### D. Findings

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| **F-01** | ERROR/P0 | `stock_mgmt_native_views.py:1003-1012` | Query `WhaleAlertCanonical.objects.filter(symbol, executed_at__date__range)` **không có** `alert__source_ref__startswith='whale_tick:'`, không `matched_value__gte` floor | `origin/dev:native_views.py` có `_WHALE_TICK_SOURCE_PREFIX`; G0 probe đếm **6.290 row** `tick_session:` bị clamp 5B, `executed_at` = giờ chạy task ⇒ daily/weekly CVD cộng đôi + bubble giả | Thêm filter per-tick + floor 500M, dùng constants của `dev`; rebase branch lên `origin/dev` trước khi merge |
| **F-02** | ERROR/P0 | `stock_mgmt_native_views.py:1033-1036` | `if side == 'buy' ... else: sell` — mọi side khác buy đều cộng vào sell | `origin/dev:session_facts_engine.py` đã đổi thành `elif side == 'sell'` (bỏ UNKNOWN); tái phạm bug D4 ⇒ CVD lệch chiều | `if side == 'buy'`, `elif side == 'sell'`, còn lại `continue` |
| **F-03** | ERROR/P1 | `StockDetailPage.tsx:147-153` + `stock_mgmt_native_views.py:2035-2045` | Map `price: s.value` (matched_value VND) nhưng `whale_signals` daily không có field `price`; `VNStockChartPanel.js:130-133` dùng giá này để vẽ bubble | Bubble daily/weekly vẽ ở trục giá = VND (vd 1,44 tỷ) ⇒ nằm ngoài chart, marker vô nghĩa | BE thêm `price` = close của bucket (từ `DailyPrice`) vào `whale_signals`; hoặc FE map về close candle theo ngày |
| **F-04** | GAP/P1 | `stock_mgmt_native_views.py:2020` | Non-intraday `time = date.isoformat()` (string), trong khi intraday `time = _to_unix_seconds()` | `mapToWhaleOrders.ts:44` casts `String(o.ts)` rồi `mapWhaleEventsToBars` dùng `new Date(ts)` ⇒ lệch UTC midnight 1 ngày | Dùng `_to_unix_seconds()` cho daily/weekly (đồng nhất intraday) |
| **F-05** | GAP/P1 | `git diff --stat` (không có file test) | 2 test dark-money là `route_matches_public_contract` + `returns_native_envelope`, **xanh ở baseline `3f4484edc`** (đã tự chạy) | Bằng chứng "2/2 OK" là vacuous cho helper mới (L-E01); không có regression lock cho aggregation | Thêm test fail-before: per-tick filter, side strict, cumulative theo ngày/tuần, range rỗng, ISO week qua năm |
| **F-06** | RISK/P2 | `stock_mgmt_native_views.py:1046-1055` | `bucket_ts` lấy `max_date` của **alert** trong bucket; candle weekly lấy `row.date` cuối của **DailyPrice** (`:984-993`). Tuần không có alert bị bỏ bucket | Lệch trục CVD vs candle; đứt đoạn cumulative | Sinh bucket từ lịch candles/period, fill bucket rỗng |
| **F-07** | RISK/P2 | `stock_mgmt_native_views.py:1048-1054`, `VNInvestSignalAdapter.js:62-69` | Payload thiếu `cvd`/`delta` và `unit:"vnd"`; `mapToCvdSeries` gán `cvd=0` | Histogram/delta CVD sai; trục VND không được khai báo | Thêm `delta`, `cvd`, `unit:"vnd"` cho parity D4 |
| **F-08** | RISK/P1 | `git log` HEAD `3f4484edc` (base `main`) | Branch thiếu fix D4 đã merge vào `origin/dev` (`c75012499`): `whale_tick:` filter + `elif side=='sell'` | Merge vào dev có conflict/regression; helper mới kế thừa bug | Rebase `feat/whale-cvd-1d-1w` onto `origin/dev`, rồi re-run tests |
| **F-09** | INFO/P2 | `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 57 | Ghi 2 fail do `vnbroker`; thực tế 2 fail là `groups_seed` (`0 != 3`), vnbroker chỉ warning log | Sai nguyên nhân trong ledger | Sửa dòng Residual/Validation khi chốt entry |

### E. Quality gates (tự chạy lại, có đổi vs baseline)

| Gate | Lệnh | Exit có đổi | Exit baseline `3f4484edc` | Kết luận |
|---|---|---|---|---|
| BE tests | `DJANGO_DEBUG=1 python manage.py test market_data.tests.test_stock_management_native_api` | 1 — 50 tests, 48 pass, 2 fail (`groups_seed`) | 1 — **cùng 50/2 fail** | 2 fail là pre-existing; **không** do vnbroker |
| 2 dark-money tests | chạy riêng 2 test tên `*_dark_money_history_*` | 0 | **0** | Vacuous — không test helper mới (F-05) |
| FE tsc | `cd packages/web && npx tsc --noEmit` | 0 | CHƯA CHẠY (không cần — đổi FE chỉ ở cây có đổi) | Khớp báo cáo |
| FE vitest | `npx vitest run src/features/stock-detail` | 0 — 2 file/12 test | CHƯA CHẠY | Khớp báo cáo |
| FE build | `npm run build` | 0 — ✓ built in 33.57s | CHƯA CHẠY | Khớp báo cáo |

Fat-file/i18n: không sửa file widget nào trong audit này; widget plan có `audit:hardcoded-text` baseline 2 dòng cũ. Không có UI text mới phía widget.

### F. Câu hỏi cần làm rõ

1. Có bắt buộc CVD cho khung **4h** không? Hiện `dark-money-history` với `interval=4h` vẫn đi nhánh intraday và trả `cvd_series: []` (`:2000-2001`); `session-facts` chỉ có `{5m,15m,30m,1h}`. Nếu có ⇒ mở slice BE riêng.
2. `whale_signals` daily có cần giữ tối đa 100 điểm cho period `10Y` không, hay aggregation theo bucket thay vì list alert?
3. Widget plan `WHALE-CVD-UX-FIX-2026-11-25` đang chờ duyệt — có gộp REQ-05 (whale 1h/4h/1D/1W) với endpoint `dark-money-history` mới này không, hay vẫn dùng whale feed per-tick?

### G. Đánh giá tổng thể

**Chưa implementable theo nghĩa "có thể merge ngay".** Hướng đi đúng (aggregate WhaleAlertCanonical, additive `cvd_series`, FE override chỉ daily/weekly, guard `typeof`) nhưng **P0 F-01/F-02** phải sửa trước vì tái phạm đúng lỗi hợp đồng đã chốt ở PR #525; **P1 F-03/F-04** làm marker daily sai hoàn toàn; **F-05** thiếu regression lock. Ưu tiên: rebase onto `origin/dev` → sửa F-01/F-02 → thêm `price`+unix `time` (F-03/F-04) → viết test fail-before (F-05) → rồi mới FE merge. Không cần migration DB.

## 5. Tóm tắt ngắn

Xem đoạn đầu file. Người duyệt: Owner BE/Coordinator. Không code được sửa trong audit này.
