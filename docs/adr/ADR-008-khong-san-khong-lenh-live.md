# ADR-008: VNINVEST không phải sàn, không đặt lệnh live

- **Ngày:** 2026-10-16 · **Trạng thái:** ĐÃ CHỐT (Owner) · **Claim:** `dinh-huong`
- **Căn cứ:** định hướng Owner 2026-10-16 + code đã thực thi
  (`test_order_safety.py:176-195` chặn live, `broker/base.py:40-67`
  `trade: False` mọi lane)
- **Liên quan:** ADR-006 (broker SSOT qua vnbroker) · ADR-007 (holdings/watchlist)

## Quyết định

VNINVEST là hệ thống tiếp nhận thông tin thị trường/broker để theo dõi, đánh
giá, tư vấn AI. Mọi quyết định đầu tư và lệnh live trade không thực hiện trên
vninvest, trừ hợp đồng phát triển riêng có tính pháp lý rõ ràng.

## Luật bất biến

1. BE từ chối mọi yêu cầu lệnh live (`live_ordering_disabled`); server là
   nguồn sự thật của mode (paper ⇒ dry-run).
2. UI không hứa lệnh thật: copy "đặt lệnh" luôn kèm "thử nghiệm"/PAPER +
   disclaimer không phải lời khuyên đầu tư.
3. Capability `trade` giữ `False` mọi lane cho tới ADR mới.
4. Slice R3 live-trading cũ coi như đóng; mở lại chỉ bằng ADR mới + hợp đồng.
