# PLAN M5 — Cutover consumer sau khi đổi basis giá (2026-11-25)

> Trạng thái: **DRAFT — chờ audit độc lập. Chưa code.**
> Nền tảng: `PLAN_PRICE_MIGRATION_FULL_20261124.md` REVISION 2 (AGREE sau 3 vòng audit) §5/S5-S6.
> Đã xong: M0 bulk · M1 diff · M2 schema · M3 guard · M4 apply HOSE 2022 (91.808 dòng).

## 1. Nguyên tắc
1. **Không trộn basis** trong cùng cửa sổ indicator — mọi consumer 🔴 đổi trong cùng maintenance window.
2. UI default theo owner đã chốt: **Adjusted** cho chart/technical/screener/backtest/52w (toggle Raw); **Raw** cho bảng phiên/tham chiếu/trần/sàn/realtime/sổ.
3. `close` đã là **giá thô** (từ M4), `adj_close` = giá đã điều chỉnh, `adj_factor = adj_close/close` là SSOT hệ số. O/H/L adjusted = `O/H/L × adj_factor` khi đọc (không thêm cột).
4. Record cũ (`AdvisoryRecord`, `ScreenerRunHistory`) **không chạy lại** — gắn `price_basis`; backtest ép cùng basis entry/exit.

## 2. Fan-out consumer (từ research §4.1 — phải đổi)
| Nhóm | file:line | Hành động |
|---|---|---|
| `/chart/` | `stock_mgmt_native_views.py:1935-1947` | giữ raw cho nến; indicator dùng adjusted (O/H/L × adj_factor) |
| `/bars/` | `:4068/:4072`, metadata `:4398-4418` | trả cả `close`(raw)+`adj_close`; metadata `adjusted` đọc `price_source`, **giữ nhánh `_corporate_actions_enabled()`** |
| `/stocks/<sym>/` | `:1781-1818` | 52w H/L + % change dùng adjusted |
| `technicals/bulk` | `:1515`, cache `:1499` | indicator dùng adjusted; invalidate cache |
| `daily-prices` | `market_data/views.py:147-181` + serializer `:19-26` | **thêm `adj_close`, `adj_factor`, `price_source`** vào serializer |
| Materializer snapshot | `market_serving/materializers.py:79-140`, `vnbroker_materializer.py:102-109,188-237` | `reference_price` = close raw hôm trước (đúng rồi sau M4); trần/sàn/% recompute |
| Advisory | `advisory_helpers.py:214-237`, `advisory/views.py:963-999` | dùng adjusted; gắn `price_basis` record mới |
| NAV | `portfolio_analytics_views.py:489-546` | **sửa công thức**: quantity hiện tại × close 365d sai ⇒ dùng chuỗi quantity theo thời gian (`Transaction`/`LedgerEntry`) hoặc ít nhất dùng `adj_close` cho entry/exit |
| Screener | `portfolio_analytics_views.py:3468-3637`, `screener_helpers.py:368-419`, backtest `:4473-4529` | adjusted; record cũ gắn basis_mismatch |
| FE | `market.js:202-247` → `chartAdapter.js:42-60` → `VNStockChartPanel.js` | host đọc `adj_close` nếu mode adjusted; widget **không tự render adjClose** (đã xác minh bundle 0.4.7-ent) ⇒ host map vào `close` trước khi truyền widget |

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
- 1,4% DB-only (và 298 dòng HOSE 2022) có `adj_close=NULL` — consumer phải xử lý null (fallback `close`).

## 7. Lessons áp dụng
`[L-V02, L-V04, L-V05, L-V03, L-002, L-M02]` — phản chứng root cause, assert ngày + giá thật, mở ảnh E2E, git status sau lệnh mutate, claim trước code.
