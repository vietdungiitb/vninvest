# BE gates — mbw4 (B4.0 + B4.1 + B4.2)

Ngay: 2026-10-15 · Nhanh: `feat/mbw4-be` -> `feat/mbw4-soc-ops`
VPS: `14.225.255.47` · Worktree VPS: `/tmp/wt-mbw4-be` · DB tam: `mbw4_be` (chua don — don o Stage 8)
Runner: `bash /tmp/mbw4_green.sh` (PW server-side tu `CORE_DB_PASSWORD`, khong quote long; `-m django` chu thuong)

## 1. TDD fail-before (RED) — commit `74e765220` (test, chua implement)

`manage.py test service_ops.tests.test_soc_broker_ops_wave4` → **10 tests, failures=2, errors=5**:
- 2 FAIL: thieu key `queues`/`lane`, CSV tra JSON (chua co nhanh `download=csv`)
- 5 ERROR: `CSV_MAX_ROWS` chua co, `lane`/`needs_verification` chua co, 2 expiry thieu `DNSE_CREDENTIAL_FERNET_KEY`
- 3 PASS san: 403 non-staff health/audit + kill-switch via apply (duong hien co)

Phat hien moi truong: staging **thieu `DNSE_CREDENTIAL_FERNET_KEY`** (compose.staging.env chi co
`MAIL_CREDENTIAL_FERNET_KEY`) → test credential bat buoc key. Giai phap: key tam single-use
sinh local, truyen `-e` trong runner (chi ma hoa chuoi fake trong DB tam, DB bi DROP; khong commit).

## 2. GREEN — commit `9fcad1486` + fix `7137ff4a0` + audit-loop `666eff844`

`manage.py test service_ops.tests.test_soc_broker_ops_wave4 service_ops.tests.test_soc_broker_config service_ops.tests.test_broker_runtime` → **28/28 OK** (lan nao cung OK; lan 1: 27/28 do expectation test sai top global — sua test, khong sua implementation).
- `makemigrations --check --dry-run` (VPS, code da gop `f6375dcec`): **No changes detected** (khong migration — expiry derived, O-3). Leaf giu `0030`.
- Re-run tren code da gop (`/tmp/wt-mbw4-merge` @ `f6375dcec`): **28/28 OK**.

## 3. B4.0 staging-read (READ-ONLY tren staging `vninvest_core`)

- Runbook §12.3: sua `POSTGRES_PASSWORD` → `CORE_DB_PASSWORD` (1 dong, commit `74e765220`).
- Leftover B3.4 (`SubAccount.provider=''`, `broker_config IS NULL`): **CHUA CHAY** — staging schema
  thieu cot `provider` (`ProgrammingError: column user_workspace_subaccount.provider does not exist`);
  `showmigrations user_workspace` tren staging: **0024–0030 chua apply** (staging di sau dev — pre-existing drift, khong do wave nay). Dieu kien `AlterField` khong danh gia duoc → giu CHUA CHAY theo plan.
- DB `mbw1_wave` con sot: **ton tai, 0 connection** (`pg_stat_activity`), wave 1 da merge PR #147 → **orphan, du dieu kien DROP o Stage 8**.

## 4. Ghi chu

- Hook pre-push canh bao "Test BE se fail" (thieu `CORE_DATABASE_URL` local) la SKIP on — BE chi chay tren VPS theo §12, dung quy dinh.
- OpenAPI budget (Errors=32/Warnings=184) + envelope-contract (9/9) xanh trong pre-push local (khong tang).
