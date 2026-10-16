# ADR — Sổ Quyết Định Kiến Trúc

> Quyết định đã chốt thì ghi ở đây kèm **lý do và ngày**. Tranh luận lại một quyết
> định mà không đọc ADR của nó là lãng phí thời gian của cả đội.

## Quy ước

- Tên file: `ADR-NNN-ten-ngan.md`, số tăng dần (bắt đầu `ADR-001`).
- Mỗi ADR: Ngữ cảnh → Quyết định → Lý do → Hệ quả → Ngày + người chốt.
- Quyết định đảo ngược: không sửa ADR cũ — viết ADR mới ghi rõ thay thế ADR nào.
- Thay đổi kiến trúc trong code mà không có ADR tương ứng là thiếu chuẩn (xem
  `00.03` §3.3: đổi kiến trúc ⇒ `02.01` + ADR mới).

## Danh sách

| ADR | Quyết định | Ngày |
|---|---|---|
| [ADR-001](ADR-001-route-id-theo-catalog.md) | RouteId theo `routeCatalog` (D-01) | 2026-10-13 |
| [ADR-002](ADR-002-so-cai-append-only.md) | Sổ cái append-only | 2026-10-14 |
| [ADR-003](ADR-003-envelope-contract.md) | Envelope contract | 2026-10-14 |
| [ADR-004](ADR-004-cach-ly-tenant.md) | Cách ly tenant | 2026-10-14 |
| [ADR-005](ADR-005-khong-san-khong-lenh-live.md) | Không phải sàn, không đặt lệnh live (trừ hợp đồng riêng) | 2026-10-16 |
