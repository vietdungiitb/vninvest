# Audit độc lập PLAN_PRICE_MIGRATION_FULL_20261124.md (2026-11-24)

> Auditor độc lập, chỉ đọc, tự trace codebase + staging evidence.
> Verdict: **REQUEST CHANGES** — 6 lỗ hổng P0 + 5 thiếu sót P1. Chưa được code/chạy S0–S7.

## P0 (phải sửa thiết kế trước triển khai)
1. **P0-1 Ongoing T+1 + rebase**: plan chỉ backfill one-shot. Ngày T+1 chưa có row ⇒ nightly 17:05 chèn từ VCI/KBS (`adj_close=NULL`) ⇒ chia đôi hệ thống. Tại ex-date tương lai, `adj_close` lịch sử phải tụt đồng loạt nhưng plan không có job re-sync ⇒ đóng băng, đứt gãy kỳ chia cổ tức đầu tiên. Bắt buộc thiết kế daily sync + rebase.
2. **P0-2 Lệch pha OHLC + NAV**: `DailyPrice` chỉ có `close/adj_close`, không có `adj_open/high/low`. Nến adjusted không vẽ được nếu `O/H/L` thô + `adj_close` chỉnh (râu xuyên màn hình); indicator H/L/C (ATR/Stoch/ADX/MFI/52w) sai. `PortfolioEquityCurve/_nav_series` (`portfolio_analytics_views.py:489-546`) nhân `quantity` hiện tại với `close` 365 ngày trước ⇒ đổi sang raw phóng đại NAV quá khứ 1,2–2,5×.
3. **P0-3 Thứ tự sai**: S3 persist trước S4 guard + trước S6 consumer. Thiếu schema migration (`price_source` chưa có); nightly/weekly ghi đè lô vừa persist; API đọc hỗn hợp nửa raw/nửa adjusted. Thứ tự đúng: Backup → Bulk+coverage → Dry-run → **Schema migration → Guard/pause beat → Persist (maintenance/flag cutover)** → Invalidate → Deploy consumer+resume → Verify.
4. **P0-4 Field không tồn tại + sót volume**: `CafefDailyPrice` không có `change_pct`; `contract.py:54-67` chủ động drop `'Thay đổi'`. S3 đòi ghi `change_pct` từ bảng này ⇒ bất khả thi. S3 cũng sót `volume` (đổi `value` mà giữ `volume` cũ ⇒ VWAP/RVOL lệch).
5. **P0-5 DB-only giữ adj_close hỏng + CafeF-only + false-green**: 49,1% dòng có `adj_close` double-adjust. S3 "không đụng DB-only" ⇒ lọt lỗi sai. 2022 có ~38.986 dòng CafeF-only chưa nói INSERT hay UPDATE. Tiêu chí "row count sau = trước" là false-green (update 0 vẫn bằng nhau).
6. **P0-6 Đường fetch + số liệu + benchmark**: `importer.py:11-46` gọi `fetcher.py` local, KHÔNG qua vnbroker `bulk_year`; `vnbroker_adapter.py:1645-1665` mới có `daily_bars` per-symbol. Các số 28–39% là **riêng HOSE**, chưa đo HNX/UPCOM. `_benchmark_returns` đọc chỉ số từ `DailyPrice` — CafeF `ExchangeType` có chứa chỉ số không chưa xác minh.

## P1
Fan-out sót 3 beat job + 4 on-demand ghi DailyPrice; `/bars/` metadata `adjusted` vẫn check `AdjFactor.PARTIAL` ⇒ báo sai sau cutover; anomaly-alert 5m cần pause khi recompute snapshot; RVOL/whale fallback; `is_adjusted=True` với `close` thô gây hiểu sai contract; rollback pg_dump xóa mất dữ liệu 2 tuần; disk bloat UPDATE 4,58M + WAL; typo `部分` dòng 87.

## Khuyến nghị owner chốt §7
1. UI: **Adjusted** cho chart/technical/screener/backtest/52w (toggle Raw); **Raw** cho bảng phiên/tham chiếu/trần/sàn/realtime/sổ. Điều kiện: giải P0-2.
2. Năm: tải đủ **2011–2026** (48 req) đo phủ 3 sàn rồi mới chọn; cắt 2019 tạo đứt gãy basis.
3. DB-only: giữ nguyên + cờ + **bắt buộc dọn `adj_close` hỏng**; chia 3 nhóm (chỉ số / huỷ niêm yết / rác).
4. Không chạy lại record cũ; gắn `price_basis`; backtest phải ép cùng basis entry/exit.
5. Rebase classification: return-parity ngày thường ≤0,5% = REBASE_SHIFT warn; spike ngoài ex-date/lệch ngày/nhảy unit = DATA_ERROR halt.
