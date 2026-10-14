# MODULES/support — Support

> Tin cậy tổng: ❓ (sơ khởi). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Vé hỗ trợ: user tạo/xem vé, staff xử lý qua dashboard riêng, đính kèm, audit vé.

## 2. Models (5 — chi tiết ở `06.02`)

`SupportTicket` (có tenant FK ✅), `SupportTicketCounter`, `TicketAttachment`,
`TicketAuditLog`, `TicketMessage` (không trực tiếp — ❓ theo vé cha hay thiếu?).

## 3. API (8 route — chi tiết ở `07.02`)

`tickets/*` + `staff/*`. Phân quyền mịn: IsStaffUser / IsTicketOwnerOrStaff ✅
(trích máy từ `07.02`).

## 4. Job/signal

Có `support/tasks.py`. Không có file signal riêng.

## 5. Finding mở

- F-SUP-01 (✅ ĐÃ ĐÓNG slice sysdesign-p13 — GAP sai): `support` CÓ 1 test
  file ở `backend/tests/` (170 tests OK chung, 2026-10-14).

## 6. Test khóa + trạng thái

Không có. Dossier v1 skeleton.
