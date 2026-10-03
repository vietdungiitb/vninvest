# Evidence Đợt 1 — User config DNSE hợp nhất (B1.1–B1.3)

Ngày: 2026-09-23. Spec: `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md` Rev.1.

## gates.txt (lệnh đã chạy, kết quả)

- `manage.py check` → `System check identified no issues (0 silenced).`
- `manage.py makemigrations --check --dry-run` → `No changes detected`
- `manage.py test user_workspace.test_user_broker_config user_workspace.test_broker_config_api`
  → `Ran 20 tests — OK` (6 model/mask/migrate + 14 API/task)
- `manage.py test identity_access.tests.test_dnse_credential identity_access.tests.test_dnse_credential_integration`
  → `Ran 15 tests — OK` (hồi quy store cũ)
- `manage.py test data_ingest.tests.test_backfill_tasks data_ingest.tests.test_backfill_integration`
  → `Ran 21 tests — OK` (hồi quy backfill đọc store cũ)
- `manage.py test user_workspace.tests` → `Ran 10 tests — OK`
- `npx tsc --noEmit` (packages/web) → exit 0
- `npx eslint` 7 file FE đợt 1 → exit 0
- `npm run build` → `built in 49.46s` (chỉ warning chunk-size pre-existing)
- `npx vitest run BrokerSettingsSection.component.test.tsx` → 4 passed
- `npm run i18n:scan` → diff chỉ thêm block `broker.*` (vi+en); 0 key broker thiếu;
  scanner có log "Added" keys của file khác nhưng diff xác nhận không ghi rác vào file.

## migrate-0017.txt

- `migrate` scratch sqlite: `Applying user_workspace.0017_user_broker_config... OK`
- `migrate user_workspace 0016` (reverse): `Unapplying ... OK` (chỉ xóa row có marker)
- `migrate user_workspace` (forward lại): `OK` (idempotent)
- Lưu ý: `migrate user_workspace` đơn lẻ trên DB trống lỗi `no such table:
  service_ops_servicedefinition` (pre-existing — data migration liên app, không liên quan 0017).

## api-samples.md (shapes đã lock bằng test)

- `GET /core/v1/broker/providers/` → `{providers: [{id, status, is_configured} × dnse/ssi/tcbs]}`
- `GET /core/v1/broker/config-schema/dnse/` → `{provider, test_connection_kind, fields[]}`
- `POST /core/v1/broker/dnse/config/` `{client_id, client_secret}` →
  `{ok, is_configured, provider, label, status, preview: {client_id: "abcd****"}, ...}` (không secret)
- `GET` cùng path → serialized config; `DELETE` → `{ok: true}`
- `POST /core/v1/broker/dnse/test-connection/` → `202 {job_id, state: pending}` (<500ms, enqueue)
- `GET /core/v1/broker/jobs/<uuid>/` → `{state: pending|succeeded|failed, result?/error?}`
- Path cũ `/core/v1/broker/dnse/config/` nay do view mới phục vụ (route cũ đã xóa — xem deviations).

## deviations (lệch so với plan Rev.1 — đã quyết, ghi để Đợt 2/3 biết)

1. B1.2.5 sửa: route `broker/dnse/config/` cũ XÓA (thay vì giữ alias) vì trùng path với
   `broker/<provider>/config/` — Django first-match sẽ shadow. View mới phục vụ path này.
   FE `workspace.js get/update/deleteDNSEConfig` + `DNSEConnectionPanel` đã chuyển sang shape mới.
   Hàm `views_dnse.dnse_config_api` đã xóa (sync/OTP/order views giữ, đọc store mới qua helper).
2. Test BE đặt tại `user_workspace/test_*.py` (không có thư mục `tests/` như plan ghi).
3. Component FE phát hiện + sửa 1 bug UX thật: `loadDetail` clear `msg` sau test-connection
   thành công (message bị nuốt) — đã tách clear ra effect đổi provider.
4. `client_id` SSI là non-secret (giữ nguyên trong preview) — quyết thiết kế, test lock.
5. UI screenshots: chưa có (cần rebuild image dev vì container chạy image cũ) — làm ở B1.4 tay khi deploy.
