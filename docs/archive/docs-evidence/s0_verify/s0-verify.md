# Evidence S0 — verify trước B+A (2026-09-23)

1. `navigationCatalog` consumers: chỉ `src/index.js:3` re-export (barrel) + README.
   Sidebar runtime đọc `layouts/.../sidebaritems.ts` (filter `Sidebar.tsx:126-127`).
   → Quyết theo C4: thêm group `tenant` vào catalog CHỈ để đồng bộ metadata + test;
   menu thật chạy qua `sidebaritems.ts` + `routeCatalog` (có contract test).
2. `TENANT_PERMISSION_CLASSES` import cho `views_personal.py`: từ `views/helpers.py:18`
   (module nhẹ) — C6. `views_tenant.py:32` là def trùng, cấm import từ đó.
3. `PartnerPATRevokeSerializer` tồn tại (`serializers.py:273`) — reuse cho revoke personal.
4. Baseline gates trên HEAD (`095a87af`, sau F1+A2): BE `identity_access` + FE liên quan
   sẽ chạy lại ở S7 sau khi code B+A vào.
5. `pages/tenant/` chưa tồn tại — tạo ở S3 (N1).
