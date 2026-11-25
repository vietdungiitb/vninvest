# PLAN M5 — Cutover consumer sau khi đổi basis giá (2026-11-25)

> Trạng thái: **AGREE (audit v3) — 5 objection + 5 reservation đã đóng. Bắt đầu code M5a.**
> Nền tảng: `PLAN_PRICE_MIGRATION_FULL_20261124.md` REVISION 2 (AGREE sau 3 vòng audit) §5/S5-S6.
> Đã xong: M0 bulk · M1 diff · M2 schema · M3 guard · M4 apply HOSE 2022 (91.808 dòng).

## 1. Nguyên tắc
0. **SCOPE (Objection v2-2)**: mới chỉ **2% dữ liệu** có `adj_factor` (HOSE 2022 = 91.808 / 4,58M). Không đổi default toàn cục. Dùng flag `PRICE_ADJUSTED_DISPLAY` (mặc định `off`) + scope `year=2022, exchange=HOSE` cho pilot. Với mọi `(symbol,date)` ngoài scope ⇒ **fallback sang hành vi cũ** (đọc `close` như hiện nay) — tránh nhảy basis liên năm (`PLAN_FULL:12` cấm cắt 2019). Mở rộng sau khi apply M4 toàn bộ 3 sàn × các năm.
1. **Không trộn basis** trong cùng cửa sổ indicator — mọi consumer 🔴 đổi trong cùng maintenance window **của scope pilot**.
2. UI default theo owner đã chốt: **Adjusted** cho chart/technical/screener/backtest/52w (toggle Raw); **Raw** cho bảng phiên/tham chiếu/trần/sàn/realtime/sổ. **Ngoại lệ pilot (reservation 3)**: `PRICE_ADJUSTED_DISPLAY` mặc định `off` chỉ trong giai đoạn HOSE 2022 (2% data) — bật flag cho scope pilot thì dùng Adjusted; sau khi apply M4 toàn 3 sàn mới chuyển default Adjusted vĩnh viễn.
3. `close` đã là **giá thô** (từ M4), `adj_close` = giá đã điều chỉnh, `adj_factor = adj_close/close` là SSOT hệ số. **Quyết định đúng sau audit (Objection 1)**: scale **CẢ O/H/L/C** ở **host adapter `chartAdapter.js:42-53`** bằng `adj_factor` — widget `OHLCVBar` (`engcore/index.d.ts:767-779`) chỉ có 6 field, không có prop đổi sang adjusted, Pine đọc `t['close']` (`index.cjs:303`). Host truyền `close = adj_close`, `open/high/low = raw × factor` ⇒ nến widget là adjusted theo default owner. Nhánh Raw (bảng phiên) đọc trực tiếp `close` thô, **không qua chartAdapter**. Không sửa widget (out of scope).
4. Record cũ (`AdvisoryRecord`, `ScreenerRunHistory`) **không chạy lại** — gắn `price_basis`; backtest ép cùng basis entry/exit.

## 2. Fan-out consumer (từ research §4.1 — phải đổi)
| Nhóm | file:line | Hành động |
|---|---|---|
| `/chart/` | `stock_mgmt_native_views.py:1935-1947`, `_serialize_price_point :984-992`, `_aggregate_daily_rows :995-1041`, `_compute_chart_technical_payload :844-899` | **Thêm `adj_close`/`adj_factor` VÀ `price_source` vào `.values()`/points** (Objection v1-1 + v2-1). `_serialize_price_point` hiện chỉ có OHLCV — phải mở rộng. **Reservation 5**: bucket W/M `:995-1041` chỉ giữ OHLCV ⇒ mang theo `adj_close`/`adj_factor`/`price_source` từ **phiên cuối bucket**. **Reservation 4**: technical payload `:844-899` đọc `close` raw — widget tự tính indicator từ nến đã scale nên **KHÔNG đổi payload technical**, chỉ sửa ref trong plan (không phải `:1522` — đó là technicals/bulk). FE cần cờ `price_source` lọc `unmapped_cafef`; `adj_factor=NULL` ⇒ bỏ dòng khỏi cửa sổ adjusted (không thay raw close). Host adapter scale O/H/L/C. |
| `/bars/` | `:4068/:4072`, metadata `:4398-4418` | trả cả `close`(raw)+`adj_close` **khi `CORPORATE_ACTIONS_ENABLED=true`** (mặc định false — `stock_mgmt_native_views.py:4056-4058,4071-4072`; phải bật flag khi pilot); metadata `adjusted` đọc `price_source`, **giữ nhánh `_corporate_actions_enabled()`** |
| `/stocks/<sym>/` | `:1781-1818` | 52w H/L + % change dùng adjusted |
| `technicals/bulk` | `:1515`, cache `:1499` | indicator dùng adjusted; invalidate cache |
| `daily-prices` | `market_data/views.py:147-181` + serializer `:19-26` | **thêm `adj_close`, `adj_factor`, `price_source`** vào serializer |
| Materializer snapshot | `market_serving/materializers.py:79-140`, `vnbroker_materializer.py:102-109,188-237` | `reference_price` = close raw hôm trước (đúng rồi sau M4); trần/sàn/% recompute |
| Advisory | `advisory_helpers.py:214-237`, `advisory/views.py:963-999` | dùng adjusted; gắn `price_basis` record mới |
| NAV | `portfolio_analytics_views.py:489-546` | **sửa công thức**: quantity hiện tại × close 365d sai ⇒ dùng chuỗi quantity theo thời gian (`Transaction`/`LedgerEntry`) hoặc ít nhất dùng `adj_close` cho entry/exit |
| Screener | `portfolio_analytics_views.py:3468-3637`, `screener_helpers.py:368-419`, backtest `:4473-4529` | adjusted; record cũ gắn basis_mismatch |
| FE | `market.js:202-247` → `chartAdapter.js:42-60` → `VNStockChartPanel.js` | host map `close=adj_close`, `open/high/low=raw×factor` trước khi truyền widget (widget **không tự render adjClose** — bundle 0.4.7-ent). **Chốt reservation 1+2**: nến cuối (`VNStockChartPanel.js:234-260`, quote raw) ⇒ **loại khỏi indicator window** (không scale — quote không có `adj_factor`, `pushRealtimeBar:131-155` không scale). FE phải **consume `price_source`** từ `/chart` points để lọc dòng `unmapped_cafef`. |
| RVOL / whale fallback | `market_serving/native_views.py:583-605`, `portfolio_analytics_views.py:2853-2870` | RVOL dùng `DailyPrice.volume` (M4 không đổi volume) — chỉ đối chiếu; whale fallback đọc `close/open` ⇒ dùng cùng basis adjusted. |

## 3. Invalidate + Recompute (cùng release)
- Cache bulk-technicals 300s (`stock_mgmt_native_views.py:387-401`), SOC inventory 3600s (`dataops_inventory.py:8-12`), `SymbolSnapshot` + pre-open 08:40 (`settings.py:656-666`), coverage, raw-SQL inventory (`:81-95`).
- Chạy lại materializer `SymbolSnapshot` + pre-open; rebuild coverage.
- Resume 5 beat job + anomaly 5m (đã pause M3). Tắt flag `PRICE_MIGRATION_PAUSED`.

## 4. Slice hoá
- **M5a** (BE read contracts): serializer + `/bars` metadata + `/chart` indicator + technicals. Test golden TPB 2022 `close=42750`, `adj_close=17940`.
- **M5b** (BE domain): advisory + NAV + screener + snapshot recompute. Test NAV không sập giả ngày chia; backtest basis.
- **M5c** (FE + invalidate + E2E): chartAdapter mode, invalidate cache, resume beat, Playwright staging chụp ảnh mở xem.

## 5. Gate & chốt
Mỗi slice: sync → claim → TDD fail-before → gate (tsc/build/check:shell/baseline UI nếu đụng FE; BE test VPS) → re-audit → PR merge-commit → Ledger Entry kế tiếp (dùng `check-ledger-entry --next-entry`). Không Commit shared (`package.json` deny-list) nếu không cần.

## 6. Chưa xác minh / rủi ro
- NAV quantity time-series cần schema `Transaction`/`LedgerEntry` — chưa đọc kỹ; phải trace trước khi code M5b.
- `stock_financials` cache 12h, `intraday_tape` 300s — 🟢 không đổi.
- **Objection 3 (đã sửa)**: 298 dòng HOSE 2022 + ~1,4% DB-only có `adj_close=NULL` ⇒ `adj_factor=NULL`. **KHÔNG được thay raw `close` vào cửa sổ adjusted** (TPB 2022 `42750` vs `17940` — nhảy giả). Quy định: consumer đọc cờ `price_source='unmapped_cafef'` để **loại/bỏ qua dòng đó khỏi cửa sổ adjusted** (hoặc carry-forward `adj_factor` từ phiên trước cùng mã nếu có); fallback áp dụng cho **CẢ O/H/L/C**, không riêng `close`. Nhánh Raw vẫn đọc `close` thô bình thường.
- NAV quantity time-series: đã trace `Transaction.date/quantity` (`user_workspace/models.py:92,134,141`) + `LedgerEntry.SPLIT/BONUS` (`:1327,1342-1350`) ⇒ nâng từ CHƯA XÁC MINH thành **đã trace, khả thi** trước M5b.
- Beat/on-demand pause list đầy đủ theo research §4.1: 4 beat + 4 on-demand + anomaly 5m (M3 đã implement). Resume cùng release M5.

## 7. Lessons áp dụng
`[L-V02, L-V04, L-V05, L-V03, L-002, L-M02]` — phản chứng root cause, assert ngày + giá thật, mở ảnh E2E, git status sau lệnh mutate, claim trước code.
