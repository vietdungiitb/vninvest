# Audit kế hoạch SSOT Phase 1 — vòng 2 (2026-11-27)

**Auditor**: subagent read-only. **Verdict**: **NEED_REVISION** — 2 objection. Các objection 1–4 vòng 1 đã giải quyết đúng.

| # | Mức | Objection | file:line |
|---|---|---|---|
| 1 | P1 | Baseline `:16` dùng placeholder `<8 file ...>` ⇒ số `32+22+9` không có lệnh tái hiện; `:13` nói plan "đã stage" nhưng thực tế `?? docs/PLAN_SSOT_IMPLEMENTATION_20261127.md` + `?? docs/evidence/ssot-implementation/`; `:18` chạy `grep` từ root vninvest cho đường dẫn sibling `vnbroker/` | `PLAN_SSOT_IMPLEMENTATION_20261127.md:13,16,18,55` |
| 2 | P1 | AC7 (`:48`) đổi hợp đồng `apply_profile` nhưng bỏ sót 3 caller đọc `os.environ` sau khi apply: `tests/examples/perf_profile_runner.py:36,41`, `tests/examples/auto_source_benchmark.py:333`, `tests/unit/core/test_performance_profiles.py:28-31` | `:48,51` |

## Cách sửa vòng 3
- Ghi rõ 8 file test bằng đường dẫn đầy đủ trong 1 lệnh `python -m pytest ...`; ghi trạng thái untracked thật; tách lệnh grep chạy từ repo `vnbroker`.
- AC7 đổi thành **backward-compatible**: giữ `apply_profile` (env mutation) cho caller cũ, thêm `profile_values(name) -> dict` thuần; đường bulk mới chỉ dùng dict inject, **không đụng 3 caller cũ**. Cập nhật §5.1 với danh sách caller được phép giữ nguyên.

## Reservation
Đây là vòng cuối theo quy tắc 3 lần; nếu vẫn NEED_REVISION → ghi blocker và dừng, không thử lần 4.
