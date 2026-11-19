# AUDIT PLAN — W0 Token SSOT (`feat/uiux-ssot-w0`) · Round 3

**Verdict: NEED_REVISION** — 0 blocker, 1 major (O-25).

- Round 1 blockers O-01..O-05: **FIXED** trong rev2.
- Round 2 major O-24: **FIXED** trong rev3 (text-on-accent dark → 7.35, tự tính WCAG khớp; plan ghi đúng).
- 5 minor notes C1-C5: **FIXED** trong rev3.
- **O-25 (major mới)**: `--text-muted: #475569` trong light block làm 3 baseline violation TỆ HƠN (3.75→2.36, gate đo canvas tối). Inverse problem thứ 2. Fix khuyến nghị (a): **không** thêm text-muted vào light block, giữ base #94a3b8; gate clean. App light theme text-muted = #94a3b8 (2.45, dev-only). Hoặc (b) thêm + update baseline (Owner sign-off), hoặc (c) sửa gate include light-theme.css.
- Minor: D1 bảng nên ghi "giữ #94a3b8 (không hội tụ)" thay vì 2 mũi tên.

Chi tiết: [AUDIT_ROUND3_20261119.md](../AUDIT_ROUND3_20261119.md).

**Kết luận**: xử lý O-25 fix (a), audit vòng 4 → PASS/AGREE, rồi S1.
