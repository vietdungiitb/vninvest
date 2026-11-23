# E2E xác nhận corporate events overlay trên chart vninvest (2026-11-23)

## Môi trường
- Staging `https://docker.edusuccess.vn/stocks/VIC`, Playwright `playwright-core` trên VPS (theo runbook, không chạy local).
- Đăng nhập qua API `/api/auth/login/` bằng user test tạm `wne_e2e` (có `TenantMember` active); JWT inject vào `localStorage` trước khi load trang. User/PAT tạm đã xóa sau test.

## Kết quả thật
- Trang chart render: `CHART_URL = /stocks/VIC`, `SVG_COUNT = 82`, nến/volume/indicator hiển thị đầy đủ.
- `CORP_CALLS = [200]`, body: `{"data":{"symbol":"VIC","from":"2025-11-23","to":"2026-11-22","count":3,"actions":[...]}}`.
- Bundle staging có `showCorporateEvents:!0` và `corporateEventsMode:"live"` (grep assets).
- **Overlay hiển thị**: badge tròn chữ `S` (ISS = phát hành) trên trục volume, tại nhãn `14/07` — khớp event `ISS 2026-07-10` trong 3 action BE trả về (2 event cùng ngày + 1 event 2025-12-05).
- Ảnh: `vic-chart-full.png` (toàn trang) + `vic-event-marker.png` (crop badge, đã mở xem trực tiếp).

## Kết luận
Widget **đã chạy được overlay corporate events trên chart của chính vninvest**. Luồng: BE endpoint 200 → host adapter map `actions` → widget self-compute `timeIndex` → badge `S` trên plot. News dock cũng đã có consumer phía widget (PR #72/#78/#79 bên widget) nhưng chưa chụp E2E riêng trong phiên này.

Ghi chú: console có vài lỗi `ERR_NETWORK_CHANGED` / 404 tài nguyên không liên quan (whale signals, favicon) — không chặn overlay.
