# Audit kế hoạch xoá close Rev.2 — vòng 1

**Verdict: NEED_REVISION** — 4 objection. Đã xác nhận Rev.2 bác rename, backup/checksum/lock đủ, DROP dời deploy riêng.

| # | Mức | Objection |
|---|---|---|
| 1 | P0 | Inventory consumer chưa đầy đủ: `stock_mgmt_native_views.py:597,1009,1641,2049,4204,4300-4310`, `vnbroker_materializer.py:195,201,247,249`, `market_serving/materializers.py:83,113-117` chưa liệt kê |
| 2 | P0 | FE nhánh raw (`chartAdapter.js:53,56-59`) dùng O/H/L raw trong khi `close` payload thành adjusted ⇒ nến basis hỗn hợp; "FE không đổi" sai |
| 3 | P0 | NAV `portfolio_analytics_views.py:596-598` dùng `p.close` cố ý để tránh double-count với `adj_close`; Rev.2 ghi "NAV → adj_close" tự mâu thuẫn |
| 4 | P1 | 930k dòng `adj_close=NULL` chưa có policy fallback khi bỏ `raise` ở `pricing.py:41-50` |
