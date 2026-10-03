# Evidence Đợt 2 — System registry + SOC tab (B2.1–B2.4)

Ngày: 2026-09-23. Spec: `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md` Rev.1.

## gates.txt (lệnh đã chạy, kết quả)

- `manage.py check` → 0 issues; `makemigrations --check` → `No changes detected`
- BE mới + hồi quy một lượt → `Ran 50 tests — OK`:
  `service_ops.tests.test_broker_runtime` (7) + `test_broker_system_config` (8) +
  `test_soc_broker_config` (11) + `identity_access.tests.test_system_broker_credential` (4) +
  `user_workspace.test_broker_config_api` (14) + `test_user_broker_config` (6)
- Hồi quy backfill (`test_backfill_tasks` + `test_backfill_integration`) → `Ran 21 tests — OK`
  (log redis-connect spam là pre-existing ở local, tests vẫn pass)
- FE `npx tsc --noEmit` → exit 0 (đã fix `toast()` → `toast.success()`)
- `npx eslint` 4 file B2.3 → exit 0
- `npm run build` → `built in 34.70s` PASS (chỉ warning chunk-size pre-existing)
- `vitest soc-broker.component.test.tsx` → 3/3 (render + preview modal + apply)
- i18n: keys `soc.tabs.broker(+_description)` + `soc.broker.*` (~35 keys) đủ VI/EN (verify grep);
  không chạy `i18n:scan` (scanner ghi rác từ file khác — đã chứng minh ở Đợt 1)

## Phạm vi code Đợt 2

- B2.1: `service_ops/domain_configs/broker.py` (BrokerSystemConfig/Entry/Timeout,
  validate, purpose mapping D4, kill-switch, quiet-hours) + export `__init__`
- B2.2: `identity_access.SystemBrokerCredential` (+`last_check`) + migration `0027`
  (create + copy system DNSE cũ) + `get_system_broker_secrets(provider, purpose)` purpose-gate
- B2.3: `service_ops/views/broker.py` (7 views, SOCBaseView=IsAdminUser) + 8 routes `broker/*` +
  `tasks.test_system_broker_connection_task` (ghi last_check, đo latency) +
  `adapters/core/soc.js` (9 methods) + `SocBrokerPanel.tsx` (config/health/credentials/audit+CSV) +
  tab `broker` icon `Building2` + i18n
- B2.4: `service_ops/broker_runtime.py` (active config, provider_for_purpose, kill-switch,
  quiet-hours qua đêm) + backfill system ưu tiên `SystemBrokerCredential` (fallback cũ) +
  fan-out user tôn trọng quiet-hours

## deviations (lệch plan Rev.1 — đã quyết)

1. Tái dùng `ServiceConfig` versioned sẵn có (thay model `BrokerSystemConfigVersion` mới) +
   `ConfigChangeAudit` — ít schema hơn, đúng mẫu `VnbrokerConfigView`.
2. `ServiceDefinition` dùng `domain='platform'` (tránh migration thêm choice 'broker').
3. Thêm field `last_check` vào `SystemBrokerCredential` (sửa migration 0027 khi chưa apply ở đâu).
4. Test-connection hệ thống async qua Celery + poll endpoint `broker/jobs` chung (không I/O trong request).
5. UI screenshots tay khi rebuild image dev (container chạy image cũ) — như Đợt 1.
