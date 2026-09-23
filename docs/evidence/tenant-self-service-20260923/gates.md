# Evidence B+A S0–S7 + F1 + A2 (2026-09-23)

## Gates
- BE: `test_personal_keys` 14/14, `test_webhook_detail_permissions` 6/6,
  `test_soc_users` 8/8 → gộp 28/28 OK.
- Full `identity_access` suite: 265 tests, 1 error PRE-EXISTING
  (`test_drf_auth_reuses_middleware_credential_avoids_double_query` — mock thiếu
  effective_status, fail cả khi chạy lẻ, không đụng file đã sửa).
- FE: tenant pages 7/7 + menu-contract 8/8 (2 mới) + soc-users 3/3 = 18/18.
- `tsc` 0 errors (đã fix en.js mất cân bằng brace do edit + Shell props đúng type).
- `npm run build` PASS 42.90s. eslint 0 errors (warnings jsx-no-literals cùng convention cũ).
- i18n keys verify runtime: tenantKeys/tenantUsageSummary/group.tenantSelf/routes VI+EN đủ.

## Lưu ý đã xử lý khi implement
- S3 en.js từng vỡ brace (block chèn giữa object) — đã dời ra top-level + verify parse + tsc 0.
- Route GET+POST chung path `/partner/me/keys/` phải gộp 1 view (Django first-match).
- Model raise Django ValidationError (quota) → bọc thành DRF 400 trong view personal.
- Test isolation: cache.clear() khi sqlite tái dùng id (rate-limit key trùng).
