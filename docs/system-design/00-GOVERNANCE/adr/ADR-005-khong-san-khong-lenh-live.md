# ADR-005 — VNINVEST Không Phải Sàn, Không Đặt Lệnh Live

- **Ngày:** 2026-10-16 · **Người chốt:** Owner (định hướng sản phẩm).
- **Ngữ cảnh:** vninvest kết nối broker (DNSE/SSI/TCBS) để đồng bộ danh mục.
  Ranh giới đọc/giao dịch nếu không chốt bằng văn bản sẽ trôi dần theo từng
  slice (panel đã có nút đặt lệnh, plan cũ có R3 live-trading).
- **Quyết định:** vninvest là hệ thống tiếp nhận thông tin thị trường/broker để
  theo dõi, đánh giá, tư vấn AI. Mọi quyết định đầu tư và lệnh live trade KHÔNG
  thực hiện trên vninvest, trừ hợp đồng phát triển riêng có tính pháp lý rõ ràng.
- **Lý do:** định hướng Owner 2026-10-16; code đã thực thi từ trước (BE chặn
  live `live_ordering_disabled`, paper ⇒ dry-run, `trade: False` mọi lane).
- **Hệ quả:**
  1. Slice R3 live-trading cũ coi như đóng; mở lại chỉ bằng ADR mới + hợp đồng.
  2. Mọi copy "đặt lệnh" phải kèm "thử nghiệm"/PAPER + disclaimer.
  3. Capability `trade` giữ `False` mọi lane (test khóa matrix).
  4. Lộ trình mũi live đổi sang AI/paper/cảnh báo/báo cáo (`13.01` §2).
- **Bản đầy đủ:** `docs/DINH_HUONG_VNINVEST_KHONG_LIVE_TRADE_20261016.md` ·
  bản domain: `docs/adr/ADR-008-khong-san-khong-lenh-live.md`.
