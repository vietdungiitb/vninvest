# Audit kế hoạch Phase 0 (2026-11-27)

**Auditor**: subagent read-only. **Verdict vòng 1: NEED_REVISION** — 3 objection. SCOPE read-only đạt, không objection.

| # | Mức | Objection |
|---|---|---|
| 1 | P0 | "Mã active" không định nghĩa; AC1 nền 1834 mã nhưng STOP dùng 95% "mã active" không có query ⇒ có thể thu hẹp nghĩa để game ngưỡng |
| 2 | P0 | Benchmark ghi 100 mã × 30 ngày, nhưng D-07 (`REV2:108`) bắt ≥100 mã × **1 năm**, 2 khung giờ ICT, thêm `requeue_count`/`symbols_missing` |
| 3 | P1 | Thiếu probe độ phủ rights trong `CorporateAction` (D-02 cần) và waiver chính thức cho việc bỏ `safe_rps_dnse` (Owner nói "dnse để sau") |

## Sửa v2
- Định nghĩa active bằng `StockProfile.status='active'` (`models.py:26-45`) ∩ mã có `DailyPrice` 2026; công thức STOP kèm query.
- Benchmark đúng D-07: ≥100 mã × 1 năm, chạy 2 khung giờ, đo thêm `requeue_count`, `symbols_missing`.
- Thêm probe rights (`CorporateAction.rights_ratio_pct`/`rights_issue_price` sau migration Phase 2 — hiện chưa có cột ⇒ ghi rõ CHƯA CÓ, không giả); waiver DNSE ghi thành văn bản do Owner chốt.
