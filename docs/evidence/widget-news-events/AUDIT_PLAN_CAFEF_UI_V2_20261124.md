# Audit UI v2 — plan CafeF trên COC (2026-11-24)

> Auditor độc lập vòng 2 (cuối scope UI), chỉ đọc. Verdict: **AGREE (+reservation)**.

## Kết quả
- M1 (preview fetch/ToS) ✅ đóng: plan §3 nguồn số dự kiến vs đã lưu, cache 10p, timeout 20s, pacing, ToS trước C2+C3.
- M2 (gate) ✅ đóng: `check:shell` + baseline UI + `check-uiux-budget`. Lỗi nhỏ: mô tả `check:shell` 4 thay vì 7 sub-script — đã sửa trong REVISION 4.
- m3–m7 ✅ đóng: ownership reuse, scraping prefix, run log service_key + inventory entry, abort cooperative + commit theo exchange/year + extend_schema, style soc.components.css.
- Không blocker/major mới. Reservation m4 (scraping prefix) đã gắn owner = implementer C3 khi khai claim.

## Reservation
- Owner chốt ToS/rate-limit trước C2 **và** C3.
- `openpyxl` vào `requirements.txt` (deny-list) trước C2, coordinator + `Claim-Deny-List:`.
- Perf parse đo thật trước khi báo PASS (L-V01).
