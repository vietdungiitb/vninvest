# Định Hướng VNINVEST: Hệ Thống Theo Dõi — Đánh Giá — Tư Vấn AI, Không Sàn, Không Lệnh Live

> Ngày: 2026-10-16 · Trạng thái: ĐÃ CHỐT (Owner) · ADR: `docs/adr/ADR-008-khong-san-khong-lenh-live.md`.
> Mọi quyết định đầu tư và lệnh live trade KHÔNG thực hiện trên vninvest,
> trừ khi có hợp đồng phát triển riêng với tính pháp lý rõ ràng.

## 1. Định hướng một câu

VNINVEST tiếp nhận thông tin từ **thị trường + broker** để **theo dõi, đánh
giá, tư vấn AI tổng hợp**, giúp nhà đầu tư có chiến lược và quyết định đúng.
VNINVEST không phải sàn giao dịch, không giữ tiền, không đặt lệnh thay người
dùng.

## 2. Bằng chứng code: định hướng đã được thực thi (không chỉ tuyên bố)

| Lớp chặn lệnh live | File:line |
|---|---|
| `mode=live` bị từ chối mã `live_ordering_disabled` | `test_order_safety.py:176-195` (4 test khóa) |
| Thiếu mode → `order_mode_required`; `dry_run=False` = live → chặn | `test_order_safety.py:160-173` |
| Server là nguồn sự thật của mode: `paper` ⇒ `dry_run=True` xuống broker | `test_order_safety.py:204-210` |
| Từ chối live được audit (`rejected_live_mode`) | `test_order_safety.py:388-393` |
| OTP/token endpoint cũng default-live-chặn | `test_order_safety.py:434-448` |
| Capability: `trade: False` cả 3 lane | `broker/base.py:40-67` |
| Kill-switch + quiet-hours fail-closed mọi sync/task | `broker/sync_guard.py:1-40`, `tasks.py:134-141` |

## 3. Ranh giới cho phép (whitelist)

1. **Đọc** (read-only): sync positions/số dư/sổ lệnh/khớp lệnh, holdings,
   watchlist, market data, cảnh báo, báo cáo phân tích.
2. **Mô phỏng paper**: lệnh thử trong môi trường giả lập, gắn nhãn PAPER rõ,
   không tiền thật, không ra thị trường (giữ vì giá trị giáo dục + kiểm chứng
   chiến lược, không vì giao dịch).
3. **Tư vấn AI**: tín hiệu, khuyến nghị, giải thích — luôn kèm từ chối trách
   nhiệm "không phải lời khuyên đầu tư", không tự động đặt lệnh theo.
4. **Kết nối broker**: chỉ để đọc + xác minh (test-connection read-only).

## 4. Ngoài ranh giới (cấm, trừ hợp đồng riêng)

Đặt lệnh live, lệnh điều kiện ra thị trường, margin/phái sinh tiền thật,
giữ tiền/nạp-rút, eKYC mở tài khoản, sao kê thuế thay broker. Các slice R3
live-trading trong plan cũ (`PORTFOLIO_EXEC_SLICES_BROKER_LIVE_OPS`, R3 live
trong báo cáo BGĐ §5) **tuyên bố CHẾT** — giữ tài liệu làm lịch sử, không mở
lại khi chưa có hợp đồng.

## 5. Điểm chạm cần rà soát copy (không hứa lệnh thật)

- `AdvisoryOrderTicket.js:74` ("Phiếu đặt lệnh") + `WhaleAdvisoryCommandPanel.jsx:267`
  ("Đặt lệnh") + `StockDetailHeader.js:122`: phải gắn nhãn paper + disclaimer,
  không dẫn sang flow live.
- `dnsePanel.action.placeOrder` ("Đặt lệnh thử nghiệm"): giữ chữ "thử nghiệm",
  giữ confirm + badge PAPER (F-FE-03 đã ghi nhận thiếu confirm — ticket riêng).
- `portfoliosManage.drawer.broker` ("Kết nối broker / đặt lệnh"): đổi thành
  "Kết nối broker" khi chạm tới (tránh hứa đặt lệnh).

## 6. Lộ trình phù hợp (thay thế mũi live trong báo cáo BGĐ)

- **Pha A (giữ):** khóa an toàn — secret rotation, E2E read-only, drill rollback.
- **Pha B (đổi mũi):** AI advisory R0 → Usage có số → paper gắn AI → cảnh báo
  đa điều kiện → nhật ký + báo cáo hiệu suất. Mỗi slice: AC + contract test +
  audit độc lập (mẫu Wave 0–4).
- **Pha C:** mobile production, onboarding < 5 phút tới first-sync, API chỉ-đọc
  cho bên thứ ba.
- **Pha D (điều kiện):** live-trading CHỈ mở bằng slice riêng khi có hợp đồng
  pháp lý (policy + OTP + risk-limit + idempotency + audit đã kiểm chứng) —
  mặc định đóng, kill-switch toàn cục sẵn sàng.
- **Không làm 12 tháng:** eKYC, nạp/rút, margin, phái sinh, sàn (Q4 đã chốt).

## 7. Tiêu chí kiểm soát audit cho mọi slice tới

1. Không endpoint mới nào đặt lệnh live (grep `place_order` + review).
2. Mọi copy "đặt lệnh" phải kèm "thử nghiệm"/PAPER + disclaimer.
3. Capability `trade` giữ `False` mọi lane (test khóa matrix).
4. Test live-rejection còn xanh (`test_order_safety.py`).
5. Secret/tenant/audit gate như cũ (Entries 323–330).
