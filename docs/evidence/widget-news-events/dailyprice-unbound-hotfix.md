# Hotfix DailyPrice — UnboundLocalError trong dark-money-history (2026-11-25)

> Branch `fix/dailyprice-unbound` · Claim `dailyprice-unbound` · Entry 642.
> Hotfix 3 dòng bị sót lại trên working tree (từ PR #540 / Entry 640), chưa commit — theo yêu cầu "resume" của owner.

## 1. Bug
`StockManagementDarkMoneyHistoryView.get` (`market_data/stock_mgmt_native_views.py:2103`) dùng `DailyPrice` ở nhánh daily/weekly (`:2152`), nhưng block F-03 phía sau (`:2238`) cũng `from market_data.models import DailyPrice` ⇒ Python coi `DailyPrice` là local cho toàn method ⇒ nhánh daily nổ `UnboundLocalError`. Test cũ chỉ dùng `interval=1h` nên không phát hiện.

## 2. Fix
Thêm `from market_data.models import DailyPrice` ở đầu method (`:2105-2107`) với comment giải thích.

## 3. Gate (thật)
- RED: chạy test với file **bỏ** 3 dòng fix ⇒ `UnboundLocalError: cannot access local variable 'DailyPrice'` tại `:2152`, test FAIL.
- GREEN: với fix ⇒ `Ran 1 test … OK`.
- Regression `market_data`: **259 test**, 1 fail pre-existing `test_stock_management_technicals_bulk_returns_compatible_technical_payload` (đã chứng minh bằng HEAD sạch ở các slice trước).
- Test mới: `test_stock_dark_money_history_daily_interval_has_no_unbound_local`.
