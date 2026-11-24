# Audit v1 — plan CafeF OHLC ingest (2026-11-24)

> Auditor độc lập phiên mới, chỉ đọc, tự probe endpoint + tự mở source. Verdict: **NEED_REVISION** (7 objection; O1–O3 blocker).

## Tự đo
- JSON TPB 04/01/2022: `GiaDongCua=42.75`, `GiaDieuChinh=17.94`, volume 11.034.900 ✅
- PageSize cap 30 ✅; range 3 năm clamp 250 ✅; HNX/UPCOM 247 ✅
- Export ALL HOSE 2022: 4.467.581 byte, `<row>`=101.757 (gồm header) → **101.756 data rows**; 2,0 s
- Đơn vị giá nghìn VNĐ, giá trị tỷ VNĐ ✅; `requirements.txt:20` không có openpyxl ✅

## Objection
- **O1 (P0)**: map `close`=thô tạo hệ giá thứ 3; consumer trộn hệ ở `advisory_helpers.py:219,233`, `advisory/views.py:963-989`, `vnbroker_materializer.py:103-109,190-198`, `portfolio_analytics_views.py:488-498`, `screener_helpers.py:381`, `adjustment.py:19-22,61`.
- **O2 (P0)**: "tắt apply_adjustments" mâu thuẫn "không sửa parser"; `adjustment.py:81-104` không filter source, nightly `tasks.py:3498-3499` ghi đè.
- **O3 (P0)**: unique `(symbol,date)` (`models.py:90`) ⇒ "không ghi đè vnbroker" + "updated=count" tự mâu thuẫn; năm 2022 gần như mọi cặp đã có ⇒ skip hết.
- **O4 (P1)**: fan-out sót materializer/cache/technicals/prefetch; đổi `DailyPrice.close` là đổi nến widget dù không sửa widget (`stock_mgmt_native_views.py:1935,4138`). Intraday/TickerSessionClose không ảnh hưởng.
- **O5 (P1)**: 51×4,47 MB = 228 MB (không phải 600 MB); thiếu perf budget/temp cleanup/retry; ToS chưa có bằng chứng.
- **O6 (P2)**: AC 101.757 là cả header (data=101.756); DD/MM trả im lặng 246 dòng 2026 → cần validate ngày trả về.
- **O7 (P2)**: openpyxl là blocker C2, không chỉ câu hỏi.

## Phân công
- Tác giả sửa O1–O7 → REVISION 1 (đã làm): bảng đối chiếu riêng `CafefDailyPrice`, không đụng DailyPrice/apply_adjustments, unique riêng, fan-out mở rộng, số liệu 228 MB, strict date + validate response, openpyxl blocker.
- Owner chốt ToS + dependency openpyxl (deny-list).
