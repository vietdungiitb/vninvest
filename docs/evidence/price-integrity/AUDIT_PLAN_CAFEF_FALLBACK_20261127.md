# Audit kế hoạch fallback — 2026-11-27

**Giới hạn độc lập:** solo, không có auditor/model thứ hai; đây là tự audit có cấu trúc, không gọi là independent.

## Đối chiếu plan ↔ source

| Plan | Kiểm chứng | Kết quả |
|---|---|---|
| KBS/VCI adjusted=False route CafeF | `kbs/quote.py:438-445`, `vci/quote.py:578-585` | Đúng — không có raw khi CafeF chết |
| FE đã có nhãn fallback | `chartAdapter.js:90` `basis='provider_adjusted_fallback'` | Đúng — không cần sửa FE |
| Đơn vị ×1000 | `DailyPrice` staging TPB 2026-01-05 `close=13934.04`; VCI `history(adjusted=True)` `close=13934.04` | Khớp — không đổi đơn vị |
| Status choice mới không cần migration | `models.py:619-623` là `TextChoices` trên `CharField` | Đúng |

## CONTRADICTIONS

- Không có.

## Reservation

- **R1**: independence không đạt (solo) — đóng bằng ghi rõ giới hạn + chạy lại gate ở B7/B8.
- **R2**: AC4 đụng staging dùng chung — chỉ chạy sau merge + deploy, và chỉ ghi 1 mã thử, không backfill đại trà.
- **R3**: fallback là **provider-adjusted basis**; không phải thay thế CafeF SSOT. Khi CafeF hết block, job chuẩn ghi đè lại; phải ghi rõ trong evidence để người đọc không hiểu nhầm.

## Verdict

**AGREE** (R1/R2/R3). Chuyển B5 với SCOPE giữ nguyên.
