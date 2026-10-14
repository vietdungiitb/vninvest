# ADR-004 — Cách Ly Tenant (FK + Fail-Closed)

- **Ngày:** hồi tố 2026-10-14 (quyết định có trước, ghi lại từ code).
- **Ngữ cảnh:** đa tenant — rò rỉ cross-tenant là sự cố bảo mật P0.
- **Quyết định:** (1) mọi bảng tiền/miền-tenant có FK `tenant` NOT NULL;
  (2) thiếu scope ⇒ queryset rỗng (`qs.none()`), không fallback;
  (3) `Idempotency-Key` gắn theo tenant (trùng key khác tenant không đụng nhau).
- **Bằng chứng code:** `Portfolio.tenant` NOT NULL (`user_workspace/models.py:35`),
  `LedgerEntry.tenant` NOT NULL (`:1086`), unique theo tenant (`:1150`).
- **Hệ quả:** model miền-tenant mới không có tenant FK là finding (cột tenant FK
  ở `06.02`); audit log cross-tenant là P0.
