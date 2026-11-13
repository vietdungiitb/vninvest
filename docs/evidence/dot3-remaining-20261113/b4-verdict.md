# Verdict B4 — PLAN_DOT3_REMAINING_20261113.md rev 2

> Ngày: 2026-11-13 · Auditor: subagent read-only · Branch: `feat/dot3-remaining-20261113` @ `20dafa5ed` (đúng branch, đúng claim commit) · Verdict: **PASS (được code)**

## Checklist 4 objection (audit B3 → §7 rev 2)

- [x] **M1 — file:line "đã có sẵn": ĐỦ.** `middleware.py:607-610` đủ 4 header X-RateLimit; `throttles.py:140-142` đủ 3 header; `urls.py:78-79` đúng 410 admin-ops; `views.py:905-906` ping 15s + `:926` keep-alive. Lưu ý nhỏ: `envelope.py:47` chỉ là docstring param `headers` của helper 2xx, không phải bằng chứng 429 có `Retry-After` — nhưng AC-B6 assert runtime + TDD fail-before sẽ bắt đúng nếu thiếu, nên không chặn.
- [x] **m1 — 5 key: SỬA ĐÚNG.** §0 bullet 1 + AC-B4 đều ghi "5 key (`period,year,quarter,report_date,items`)" — khớp số lượng và danh sách.
- [x] **m2 — scope P3: SẠCH.** Bảng §2 P3 chỉ có `migrations/0008_*` (do `makemigrations` sinh); `models.py` chỉ xuất hiện dạng đọc (`LicenseKey` tại `commercial/models.py:168` — xác minh tồn tại, head migration vẫn `0007`, drift thật). Không có việc sửa model.
- [x] **m3 — V1 B-4: TRUNG THỰC.** §0 bullet 1 + AC-B4 đều ghi `period=year` **CHƯA XÁC MINH** (package ngoài `vnbroker`) và giữ nhánh 400 `UPPER_SNAKE`; probe runtime dời sang B6 — đúng như §7 hứa.

## Câu đồng thuận

**Đồng thuận cho code theo plan rev 2** với 2 nit không chặn: plan viện dẫn `§0.1/§0.2/§0.3` nhưng file không có các tiểu mục này (chỉ có §0 bullets 1-4) — nên đổi thành "§0 mục 1/2/3" ở lần chạm tiếp theo; và `envelope.py:47` nên thay bằng bằng chứng 429-path thật nếu muốn chặt M1. Không cần rev 3 trước khi code.
