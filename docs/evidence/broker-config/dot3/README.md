# Evidence Đợt 3 — SSI/TCBS config + contract (B3.0–B3.3)

Ngày: 2026-09-23. Spec: `docs/IMPLEMENTATION_PLAN_BROKER_CONFIG_20260923.md` Rev.1.

## gates.txt

- BE → `Ran 60 tests — OK (skipped=2)`:
  `user_workspace.test_broker_config_api` (17, +SSI/TCBS CRUD) +
  `test_vnbroker_broker_signatures` (6: 4 stub + 2 live-gated skip) +
  `test_user_broker_config` (6) + `service_ops.test_broker_runtime` (7) +
  `test_broker_system_config` (8) + `test_soc_broker_config` (11) +
  `identity_access.test_system_broker_credential` (4)
  (1 lần chạy thiếu `DNSE_CREDENTIAL_FERNET_KEY` → 7 errors; chạy lại đủ env → OK)
- Hồi quy backfill 21 OK (Đợt 2, không đổi ở Đợt 3 ngoài NEWSWITCH đã cover)
- `manage.py check` 0; `makemigrations --check` sạch (0018 AlterField choices)
- FE `tsc` 0; eslint (BrokerSettingsSection + test) 0; `build` 27.77s PASS
- vitest 2 files → 8/8 (BrokerSettingsSection 5 + soc-broker 3)
- i18n: `broker.ssi.*`, `broker.tcbs.*`, `status_unverified` đủ VI/EN (verify grep)
- secret-scan: Select-String secret-like trong tests chỉ trúng fixture giả + assertNotIn
  (AK1/AS1/SYSSEC/BADSEC/LEGSEC) — 0 secret thật; response preview mask (test lock)

## Phạm vi code Đợt 3

- B3.0: `requirements.txt` pin `vnbroker@v1.1.0` → `@v3.4.0` ghim SHA
  `1ff04e609b940f672d44bb88e9f006b721fd1262`
  (user báo "v3.4.0 rồi" — verify `ls-remote` + signatures SSI/TCBS tại tag khớp v3.3.0;
  local venv có vnbroker 2.0.0 HỎNG (ImportError BrokerAPIError) → code import lazy + tests stub)
- B3.1: `broker/ssi.py` (schema 4 fields, market-only `authenticate()`, KEYWORD ARGS bắt buộc —
  fix C2), test task connected + kwargs assert
- B3.2: `broker/tcbs.py` (schema, unverified-flow không gọi authenticate, custody warn-not-block —
  G4), status `unverified` mới + migration `0018`, test task unverified≠error
- B3.3: `views_broker` mở ssi/tcbs (schema registry, validate theo provider) + task dispatch 3 lane +
  tiles FE tự kích hoạt (mock stale đã sửa) + test SSI tile + contract tests
  (stub: kwargs C2/method C1/unverified + live-gated skip khi thiếu vnbroker thật)

## deviations

1. Pin lên thẳng **v3.4.0** (thay v3.3.0 trong plan Rev.1) vì tag đã tồn tại khi thực thi.
2. `mask_value`: secret ≤4 ký tự che toàn bộ (test bắt được lộ `AK1` trong `AK1****`).
3. FE tiles test từng race với fallback list — chốt mock providers all-supported + assert no coming-soon.
4. Component `loadDetail` từng nuốt msg test-ok (sửa Đợt 1, lock bằng test).
5. UI screenshots tay khi rebuild image dev (container chạy image cũ) — như Đợt 1/2.
