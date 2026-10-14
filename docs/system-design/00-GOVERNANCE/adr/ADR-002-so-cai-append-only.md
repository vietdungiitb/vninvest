# ADR-002 — Sổ Cái Append-Only, Lưu ≥ 7 Năm (D-17)

- **Ngày:** hồi tố 2026-10-14 (quyết định có trước, ghi lại từ code).
- **Ngữ cảnh:** dữ liệu tiền phải bất biến để kiểm toán; sửa quá khứ trực tiếp
  là gian lận.
- **Quyết định:** `LedgerEntry` chỉ append (`AppendOnlyMixin`); sửa sai bằng entry
  đảo (`reversal_of`), một dòng chỉ đảo một lần; unique `(tenant, external_id)`
  chống ghi trùng; lưu ≥ 7 năm.
- **Bằng chứng code:** `user_workspace/models.py:1040` (mixin), `:1086-1092`
  (tenant NOT NULL), `:1150-1161` (2 unique), xem `06.01` §2.
- **Hệ quả:** không bao giờ UPDATE/DELETE dòng sổ; backfill phải idempotent
  (bài học migration 0022).
