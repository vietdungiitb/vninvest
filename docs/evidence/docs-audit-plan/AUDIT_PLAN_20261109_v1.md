# B3 Audit plan (v1) — docs-audit-plan-1109 — NEED_REVISION

Verdict: **NEED_REVISION** (auditor độc lập, chỉ đọc, `ses_e407a39caffecPzo9GVzFxvIAv`).

OBJ-1 thiếu claim L-002 · OBJ-2 A1 citation không tồn tại (`pricing.py:160` đã không còn `timezone.utc`) · OBJ-3 orchestrator citation drift (prompt đã posture, return còn signal) · OBJ-4 A2 sửa dòng người khác (coordinator-only) · OBJ-5 short path mơ hồ.

Tự xác minh của implementer (L-V02, 2026-11-09): grep `pricing.py` → `:160` là `is_naive`, 0 hit `timezone.utc`; `orchestrator.py:720-724` prompt `posture`, `:879,881,886` return còn `signal/target_price/recommendation`. Cả 2 OBJ đều ĐÚNG. Đã sửa plan rev2 (A1 đóng bằng verify, B1 đổi return schema, A2 coordinator-only, full path). Cần B3 v2 trước B5.
