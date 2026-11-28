# Audit kế hoạch unblock Phase 0 — vòng 1 (2026-11-28)

**Auditor**: subagent read-only. **Verdict: NEED_REVISION** — 5 objection.

| # | Mức | Objection |
|---|---|---|
| 1 | P0 | 140.182 không có lệnh tái hiện trong evidence STOP; AC1/AC2 không có filter năm ⇒ backup count mơ hồ |
| 2 | P0 | Relabel 2026 của mã có dòng `cafef` cũ tạo trộn basis, trong khi `integrity.py:81-82` không nhận `vnbroker_fallback` vào `foreign_adjusted`; thiếu gate integrity sau apply |
| 3 | P1 | Rollback nói 7 field nhưng AC1 đổi 6 cột (+id khóa) — không liệt kê |
| 4 | P1 | `skip_count>0` không dừng lệnh ⇒ vẫn có dòng `unmapped_cafef` mang adj bị integrity flag |
| 5 | P1 | SCOPE nói "không schema" nhưng tạo bảng backup DDL; AC4 đo DB nhưng FE nhãn phụ thuộc flag đang false |

## Số liệu bổ sung (probe sau audit)
- 963 mã unmapped: **915** có dòng `cafef` cũ, chỉ 48 sạch ⇒ relabel riêng 2026 là sai.
- Toàn chuỗi 963 mã: **2.652.748 dòng** = 885.728 cafef + 1.473.620 unmapped + 293.400 legacy.

## Hướng sửa v2
- Theo **Anchor A đã Owner chốt**: chuyển **toàn chuỗi** 963 mã sang 1 basis `vnbroker_fallback` (`adj_close=close`, `factor=1`), giữ bản gốc CafeF trong `CafefDailyPrice` để đối chiếu.
- Cập nhật `integrity.py` để `vnbroker_fallback` vào `foreign_adjusted`; chạy `check_price_integrity` sau apply.
- Backup lưu `id` + 6 cột; snapshot **trước** apply; `skip_count>0 ⇒ halt`.
- Backup table là **ops artifact**, không phải Django migration.
- Flag FE là non-goal (đo DB coverage); ghi rõ trạng thái flag staging `display=0`.
