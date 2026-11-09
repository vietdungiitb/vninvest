# B3 Audit plan (v2) — docs-audit-plan-1109 — NEED_REVISION

Verdict: **NEED_REVISION** vòng 2 (auditor độc lập, `ses_e407813dcffeoN8c9Mjg9es0nB`).
Đóng: OBJ-1 (claim ở B5, có điều kiện), OBJ-3 (B1 return schema đúng), OBJ-4 (A2 coordinator-only).
Còn: OBJ-2 (Step A1 vẫn claim RED mâu thuẫn refute: tiêu đề "2 lỗi còn treo", Step 1 "2 test đỏ", commit `fix(be): timezone.utc`) · OBJ-5 (short path: lane table, `:179` serializer/locale, `:200-201` widget/native_views, `:210` settings app nào, `:218` session_facts, `:119` pricing/test chưa full path).

Đã sửa rev3: A1 → "Re-verify trước, sửa sau" (Step re-verify-first, bỏ qua Step 2 nếu xanh); B1 Step 2 → "đổi return schema"; full path cho lane table, serializer/locale, widget, native_views, settings, session_facts, pricing/test.
