# Audit kế hoạch F1 — vòng 1 (2026-11-28)

**Auditor**: subagent read-only. **Verdict: NEED_REVISION** — 4 objection.

| # | Mức | Objection |
|---|---|---|
| 1 | P0 | Plan gọi `unmapped_cafef` là "provider-adjusted legacy" — **SAI**: đó là dòng CafeF thiếu, `adj_close` đã dọn NULL (`test_m6b_pricing_skip.py:16`). Bỏ sentinel `None` sẽ trộn raw 42750 vào chuỗi adjusted (`advisory_helpers.py:233`, `screener_helpers.py:388`, `portfolio_analytics_views.py:503`, ledger:306) |
| 2 | P0 | `vnbroker_fallback` có `adj_factor=1`, `close` vẫn là giá legacy — plan không xử lý trường hợp này; nếu scale O/H/L×1 nhưng thay close bằng adj_close có thể tạo nến basis hỗn hợp |
| 3 | P1 | `/ohlcv` metadata bị gate bởi `CORPORATE_ACTIONS_ENABLED` (`stock_mgmt_native_views.py:4269,4329`, default off) ⇒ AC2 không tái tạo; AC4 thiếu `test_price_basis_s6.py`, `test_ohlcv_bars_native_api.py`, `test_m5_chart_points.py` |
| 4 | P1 | SCOPE "không flag" không trung thực (phải sửa gate metadata); sót `VNStockChartPanel.js:236,262-265` lọc nến realtime theo `priceBasis==='adjusted'` — sau anchor basis là `provider_adjusted_fallback` ⇒ nến quote raw lọt vào chart đã scale |

## Hướng sửa v2
- Giữ nguyên sentinel `None` cho `unmapped_cafef`; chỉ thêm `vnbroker_fallback` và mọi nguồn có `adj_close`/`adj_factor` hợp lệ.
- Làm rõ `vnbroker_fallback`: `adj_close=close` (identity, từ `anchor_a_relabel.py:48-53`), `factor=1` ⇒ **không đổi giá**, chỉ đổi nhãn; đưa bằng chứng DB (`close=13934.04 = VCI adjusted`) vào plan.
- Đưa gate metadata + `VNStockChartPanel.js` vào SCOPE; bổ sung 3 file test vào AC4; không đổi giá trị flag, chỉ đổi điều kiện phát metadata.
