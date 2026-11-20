# Field mapping — vninvest pipeline ↔ vnbroker package 3.8.x (2026-11-20)

> Bối cảnh: Entry 573 F-NEW-5. Hai repo cùng rule parse ESOP nhưng khác tên field. File này là ánh xạ khi vninvest chuyển từ parse-text sang `VCI.corporate_actions()` sau khi vnbroker release 3.8.x và consumer bump pin (`requirements.txt:38`, hiện vẫn 3.7.2).

| Khái niệm | vninvest (`market_data.corporate_actions.parser` / `CorporateAction`) | vnbroker 3.8.x (`common/corporate_actions.py`) | Ghi chú |
|---|---|---|---|
| Tiền cổ tức/cp | `cash_amount_per_share` (`Decimal(18,2)`) | `cash_amount` | Đổi tên khi map; cùng đơn vị VND/cp |
| Tỉ lệ cổ phiếu thưởng | `stock_ratio_pct` (`Decimal(18,4)`) | `stock_ratio_pct` | Giữ nguyên |
| Trạng thái parse | `parse_status ∈ {structured, parsed_from_text, unparsed}` | `parse_status` (cùng enum) | Nguồn sự thật duy nhất |
| Cổ tức `%` trên mệnh giá | `ambiguous_cash_pct=True` + `unparsed` | `ambiguous_cash_pct=True` + `unparsed` | Giữ nguyên |
| ESOP `Phát hành cho CBCNV tỉ lệ X%` | `ambiguous_ratio_pct=True` + `unparsed` | **`is_esop=True`** + `unparsed` | ⚠ Khác tên — map `is_esop → ambiguous_ratio_pct` |
| ID nguồn | `source_event_id` (VCI `id`, fallback `fb-…`) | `source_event_id` | Giữ nguyên; không dedup theo title |
| Nhóm cùng ex_date | `AdjFactor` group theo `(symbol, ex_date)` | `group_id` dạng `f"{symbol}:{ex_date}"` | Consumer tự cộng tiền; package không gộp mất gốc |
| Ngày quyền | `ex_date` (`DateField`) | `ex_date` | VCI trả `exright_date` package tự đổi tên |
| `record_date` / `payment_date` | `null` với VCI | `null` với VCI | VCI raw DataFrame không có 2 cột này |

## Quy tắc parse đã hội tụ (cả 2 repo)

1. `DIV + %` (không có tiền) ⇒ `unparsed`, `ambiguous_cash_pct=True`.
2. `DIV + tiền + %` ⇒ lấy tiền, **bỏ `%`** (`stock_ratio_pct=None`) — Entry 573 F-NEW-1.
3. `ISS + %` chỉ trả `stock_ratio_pct` khi title chứa `Cổ phiếu thưởng` hoặc `Trả Cổ tức bằng Cổ phiếu`.
4. Mọi `ISS + %` khác (ESOP / phát hành riêng lẻ) ⇒ `unparsed`, cờ ambiguous tương ứng, **không suy diễn số**.

## Điều kiện chuyển sang feed có cấu trúc

- vnbroker release 3.8.x + vninvest bump pin + re-probe VCI (id ổn định, enum `DIV,ISS`).
- Khi đó `ingest.fetch_corporate_actions` chỉ cần map cột theo bảng trên; parser parse-text giữ lại làm fallback và cho dữ liệu lịch sử chưa có field số.
- Flag `CORPORATE_ACTIONS_ENABLED` vẫn `False` cho tới khi owner đối chiếu Q1/Q2 xong (Entry 573 §F.1).

**Không làm**: tự tính `adj_close` trong package; self-map `is_esop` thành `False` cho mọi event ISS (sẽ mất cảnh báo).
