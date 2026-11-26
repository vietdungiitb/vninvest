# GATES — broker-config-r1 (2026-11-26)

> Mọi dòng có command + output thật. `CHƯA CHẠY` được ghi rõ, không báo PASS giả (L-G02).

| Gate | Lệnh | Kết quả |
|---|---|---|
| Fail-before FE | `npx vitest run src/components/__tests__/soc-broker-r1.component.test.tsx` trên code trước R1 | **4 failed / 0 passed** — raw key, textarea `{}`, không có error i18n (đã chạy lúc 16:15) |
| Fail-before harness | mock `useI18n` trả `t` mới mỗi render → `reload` đổi identity → effect chạy lại xoá error (L-F10) | Sửa dùng `tVi` ổn định → 4/4 xanh |
| FE component (sau fix AC4) | `npx tsc --noEmit && npx vitest run src/components/__tests__/soc-broker.component.test.tsx src/components/__tests__/soc-broker-wave4.component.test.tsx src/components/__tests__/soc-broker-r1.component.test.tsx --reporter=dot` | tsc exit **0** · **3 file / 11 test PASS** |
| BE R1 (trên VPS) | `docker exec vninvest-core-api python /app/src/manage.py test service_ops.tests.test_broker_config_r1 --verbosity 2 --noinput --keepdb` với `CORE_DATABASE_URL` trực tiếp `core-db:5432` (thay `pgbouncer:6432`) | `Ran 8 tests … OK` (xem chi tiết §AC dưới) |
| BE regression (trên VPS) | cùng lệnh, label `service_ops.tests.test_soc_broker_config service_ops.tests.test_soc_broker_ops_wave4` | `Ran 21 tests … OK` |
| Pre-push | `git push -u origin feat/broker-config-r1` (hook `pre-push-gate`) | **36 PASS / 0 SKIP / 0 FAIL** — push thành công |
| Deploy staging | `REPO_BRANCH=feat/broker-config-r1 bash /opt/vninvest/scripts/deploy-staging.sh` | API health 2xx, không container chết; VPS HEAD = `321981221`; `grep -c _raw_purpose_errors /app/src/service_ops/views/broker.py` = **3** |
| Artifact FE | `grep -o cred_required /usr/share/nginx/html/assets/i18n-*.js \| wc -l` | **2** (`cred_required`, `cred_schema_invalid`, `table_caption`, `col_provider`, `no_queues` đều present) |
| E2E staging | `PLAYWRIGHT_BASE_URL=https://docker.edusuccess.vn E2E_USER=testuser@vninvest.vn E2E_PASS=<test> npx playwright test tests/visual/broker-config-r1.spec.ts --project=chromium --reporter=line` | **2 passed** (setup + chromium); 4 GET `/broker/{config,health,credentials,audit}` trả **200**; KHÔNG có POST credentials khi bấm Lưu rỗng |
| Ảnh E2E | `docs/evidence/broker-config-r1/e2e/broker-tab-r1.png` | Đã **mở ảnh**: caption/cột dịch tiếng Việt, textarea rỗng + placeholder `client_id/client_secret`, banner “Nhập thông tin secrets trước khi lưu.” |

**Sự cố deploy xen kẽ:** giữa phiên, một session khác deploy `dev` ⇒ VPS HEAD quay `e7b67b151`, E2E thấy raw key. Đã deploy lại branch, kiểm HEAD `321981221` + asset `cred_required=2`, rồi chạy lại E2E 2 passed. Đây là **race condition môi trường**, không phải lỗi code.

**CHƯA CHẠY:** `npm run build` (FE build được thực hiện trong image Docker khi deploy — artifact đã verify như trên, nhưng lệnh build cục bộ không chạy riêng); full `npm run test:components`; E2E firefox/webkit; BE suite toàn repo. FE vitest chạy trên máy agent (container frontend không có node_modules để chạy vitest) — ghi rõ để không hiểu nhầm là gate VPS.

## Bằng chứng BE theo AC

| AC | Test | Kết quả |
|---|---|---|
| AC4 mismatch 400 / missing = warning | `test_credential_purpose_mismatch_blocks_apply_but_missing_is_warning` | OK (400 khi có credential sai purpose; preview trả warnings khi thiếu) |
| AC5 fail-closed | `test_backfill_provider_falls_back_to_dnse` | OK (log `provider=ssi has no tape consumer — fall back to dnse`) |
| AC6 giữ verify | `test_purpose_change_keeps_verification`, `test_secret_rotation_resets_verification` | OK |
| AC7 reserved keys | `test_reserved_keys_preserved_on_apply` | OK |
| AC8 purpose thô | `test_raw_invalid_purpose_rejected` | OK |

## Dọn dẹp

- User staff tạm `e2e_broker` tạo trên staging để thử login ⇒ **đã xoá** (`deleted_e2e_broker_user_rows: 1`); E2E dùng lại `testuser` (superuser có tenant).
- Test DB `test_broker_config_r1_test` trên `core-db` được giữ bởi `--keepdb` — cần DROP trong bước dọn cuối.
