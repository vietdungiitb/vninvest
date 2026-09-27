# PA-4 Gates — `pf4-modelsworker` (models/worker slice)

- **Agent:** `pf4-modelsworker` · **Branch:** `feat/pf4-modelsworker` · **Worktree:** `C:\Mujoco Projects\pf4-modelsworker`
- **DB:** `ag_pf4_modelsworker` (`postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf4_modelsworker`)
- **Base:** `dev` (`origin/dev`), leaf `user_workspace` = `0018_broker_config_unverified`
- **Audit:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 `P0-ISO-03` / `P0-MIG-01` / `P0-DATA-01` / `P0-DATA-02`
- **Plan:** `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` TEN-04 / TEN-05 / LED-02
- **Env dùng để chạy gate:** `CORE_DATABASE_URL`, `DJANGO_DEBUG=1` (không sửa `settings.py`)

> **KHÔNG TỒN TẠI:** `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` được yêu cầu đọc ở §2/§4/§5/§8 —
> không có trong worktree lẫn main tree (`C:\Mujoco Projects\vninvest\docs\evidence\portfolio-commercial\`
> chỉ có `HANDOFF_CHECKLIST.md`). Đã đọc thay bằng `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1
> + `HANDOFF_CHECKLIST.md` §5 (Wave 1: `TEN-04`, `TEN-05`).

---

## 1. Migration — quyết định (a) vs (b) cho `0008`

### Chọn **(a) repair migration**, KHÔNG sửa `0008`.

Bằng chứng `0008` **đã apply** (không phải giả định):

```
$ docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core \
    -c "select name, applied from django_migrations where app='user_workspace' order by id"

 0007_add_tenant_fk_transaction_subaccount          | 2026-05-22 17:43:57.543887+00
 0008_backfill_transaction_subaccount_tenant        | 2026-05-22 17:43:57.677559+00   ← ĐÃ APPLY
 0009_trackedsymbol_and_price_alert_cooldown        | 2026-05-22 17:43:57.892739+00
 ...
 0018_broker_config_unverified                      | 2026-09-23 10:51:09.385756+00

$ docker exec vninvest-dev-core-db psql -U vninvest -d aicc_r0 \
    -tAc "select count(*) from django_migrations where app='user_workspace' and name='0008_...'"
1
```

Sửa file đã apply ⇒ vi phạm BR-07 (`docs/AGENT_PROTOCOL.md:107`). Plan TEN-05 (`:608-610`) cũng yêu cầu
"nếu `0008` đã chạy ở bất kỳ DB nào thì **không** được chỉ sửa file `0008`".

### Tên file + head

- **Đọc head từ `origin/dev`, KHÔNG đọc trong worktree:**
  ```
  $ git -C "C:\Mujoco Projects\vninvest" fetch origin dev
  $ git -C "C:\Mujoco Projects\vninvest" ls-tree --name-only origin/dev -- \
      packages/core/backend/src/user_workspace/migrations/
  ... 0017_user_broker_config.py
  ... 0018_broker_config_unverified.py      ← leaf
  ```
- **Số `0019` do `makemigrations` tự đặt.** Tôi chỉ truyền `--name` cho phần mô tả:
  ```
  $ python manage.py makemigrations user_workspace --name pf4_tenant_and_financial_guards
  Migrations for 'user_workspace':
    src\user_workspace\migrations\0019_pf4_tenant_and_financial_guards.py
  ```
  Không tự viết `0019_...`; không đụng app khác.
- **`tenantreg-c`** đang claim `*/migrations/*` nhưng claim ghi rõ chỉ app
  `identity_access` / `tenant_lifecycle` / `commercial` / `data_ingest`
  (`docs/CLAIMS.md:59`) ⇒ **không trùng app, không trùng số**.
  ⚠ **Coordinator phải verify lại lúc merge** — các agent khác có thể tạo `0019` cho app khác,
  điều đó vô hại, nhưng nếu agent nào đó tạo `0019` trong `user_workspace` thì sẽ thành 2 leaf.

---

## 2. AC-1 — RED evidence: `0008` hỏng thật (`FieldError`)

`test_migration_0008_rehearsal.Migration0008BugEvidenceTests` seed `SubAccount` tenantless +
`portfolio_id = NULL` ở **state `0007`** (`MigrationExecutor.project_state`), rồi gọi **đúng hàm gốc**
`0008.backfill_subaccount_tenant(apps_0007, None)`.

Output đỏ (trích nguyên văn):

```
FAIL: test_0008_backfill_raises_field_error_on_tenantless_subaccount
(user_workspace.test_migration_0008_rehearsal.Migration0008BugEvidenceTests.
 test_0008_backfill_raises_field_error_on_tenantless_subaccount)
RED EVIDENCE: gọi đúng hàm gốc của `0008` với state 0007 → FieldError.
----------------------------------------------------------------------
AssertionError: Cannot resolve keyword 'is_active' into field. Choices are:
id, invited_by, invited_by_id, joined_at, public_id, role, tenant, tenant_id,
updated_at, user, user_id
```

Danh sách `Choices` là bằng chứng field set thật của `TenantMember` ở state `0007`:
**8 field, không có `is_active`.** `FieldError` chắc chắn, không phụ thuộc state
(`identity_access/models.py:578-647` cũng không có `is_active`).

### 2.1 Hai nghi ngờ đã LOẠI TRỪ (đề bài yêu cầu không báo lại)

| Nghi ngờ | Kết luận | Bằng chứng |
|---|---|---|
| `bulk_update(..., ['tenant_id'])` sai | **KHÔNG phải lỗi** | Probe thật trên Django 6.0.6: `SA.objects.bulk_update([SA(id=1, tenant_id=1)], ['tenant_id'])` → sinh `SET "tenant_id" = (CASE …)`, không `FieldDoesNotExist` |
| `SubAccount.portfolio` / `Transaction.portfolio` không có trong state | **KHÔNG phải lỗi** | `0003_dnse_lightspeed_credential_v2.py:31-35` thêm `SubAccount.portfolio`; `0001_initial.py:56-61` khai `Transaction.portfolio` non-null |

⇒ `0008` **chỉ có đúng 1 lỗi** như đề bài nêu.

### 2.2 Nguyên nhân gốc (audit chưa nêu, đã xác minh)

Tác giả lẫn `TenantMember` với `SubAccount.is_active` — field **đúng** tồn tại tại
`user_workspace/migrations/0002_add_subaccount.py:23`, cùng app, cùng ngữ cảnh backfill.
Bằng chứng tác giả từng làm ĐÚNG: `0005_backfill_portfolio_tenant.py:26`
`TenantMember.objects.filter(user=portfolio.user).first()` — **không** `is_active`.
⇒ `0008` là lỗi sót, không phải chủ ý.

### 2.3 Điều kiện kích hoạt

Chỉ nổ khi `SubAccount.tenant IS NULL` **VÀ** `SubAccount.portfolio_id IS NULL` (đi vào nhánh
`else` ở `0008:71`). Fresh DB rỗng bypass nhánh lỗi (`0008:60`).

---

## 3. RỦI RO CÒN LẠI CỦA `0008` (ghi rõ, không che)

**Kịch bản hở:** một DB đang ở state `0007` **và có sẵn** row tenantless ⇒ `migrate` vẫn nổ
`FieldError` tại `0008`, **trước khi** tới `0019`.

Không thể vá mà không sửa file `0008` (vi phạm BR-07). Đánh giá thực tế:
- Mọi DB đã từng chạy `migrate` đều đã apply `0008` (xem §1) ⇒ `0008` không chạy lại.
- DB mới luôn rỗng ⇒ bypass `0008:60`.
- DB dev `vninvest_core`: `SubAccount` tenant null = 0, portfolio null = 0;
  `Transaction` tenant null = 0 ⇒ ngay cả khi rerun cũng bypass.

**Khuyến nghị cho coordinator:** ticket riêng cho harness CI (`TEN-05` yêu cầu job
`migration-rehearsal`) chạy `migrate` trên DB clone có seed dữ liệu thật, phát hiện trường hợp
này trước khi nó chặn deploy.

### 3.1 `0008:92-99` reverse còn nguy hiểm hơn `FieldError`

`0008.reverse_backfill` gọi `Transaction.objects.all().update(tenant=None)` +
`SubAccount.objects.all().update(tenant=None)`. Test
`test_0008_reverse_backfill_breaks_on_not_null_columns` chứng minh bằng `IntegrityError`:
từ `0012_enforce_tenant_not_null_real` cột `tenant_id` là NOT NULL ⇒ **lệnh đó không chạy được**,
rollback bất kỳ DB nào đã qua `0012` đều vỡ.

⇒ Reverse của `0019` là **no-op có chủ đích** (`repair_subaccount_tenant_reverse` /
`repair_transaction_tenant_reverse`), test `test_repair_reverse_does_not_null_out_every_row`
chứng minh không row nào mất tenant.

---

## 4. Rehearsal thật trên DB có dữ liệu (không chỉ unit test)

Tập lệnh (mô phỏng đúng kịch bản audit nêu: "production có dữ liệu sẽ dừng deployment"):

```powershell
$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf4_modelsworker"
$env:DJANGO_DEBUG = "1"
cd packages/core/backend
python manage.py migrate user_workspace 0018 --noinput      # về state ĐÃ APPLY 0008
# seed: 3 SubAccount tenantless, 1 Transaction tenantless, 2 UserBrokerConfig chưa có tenant
python manage.py migrate user_workspace
```

Kết quả `migrate` lên `0019`:

```
Applying user_workspace.0019_pf4_tenant_and_financial_guards...
  backfill_broker_config_tenant: assigned=1 quarantined=1 unresolved=1
  repair_transaction_tenant: Updated 1 rows, quarantined=0
  repair_subaccount_tenant: Updated 2 rows, quarantined=1
 OK
```

Trạng thái sau backfill (query trực tiếp trên `ag_pf4_modelsworker`):

```
-- SubAccount
 7|SA-solo  | tenant=7 (reh-a)                | quarantine=0   ← user thuộc 1 tenant → gán đúng
 8|SA-multi | tenant=NULL                     | quarantine=1   ← user thuộc 2 tenant → KHÔNG đoán
 9|SA-orphan| tenant=9 (auto-rehearsal_orphan)| quarantine=0   ← user 0 tenant → auto-provision

-- UserBrokerConfig
 3|dnse| tenant=7 (reh-a)| quarantine=0
 4|dnse| tenant=NULL      | quarantine=1

-- Transaction
 3|VNM| tenant=7
```

### 4.1 Idempotent (chạy lại 3 hàm backfill lần 2)

```
$ python manage.py shell -c "... [f(apps,None) for f in (backfill_broker_config_tenant,
                                  repair_transaction_tenant, repair_subaccount_tenant)]"
backfill_broker_config_tenant: assigned=0 quarantined=0 unresolved=1
repair_transaction_tenant: No transactions to update
repair_subaccount_tenant: No subaccounts to update
```

Số row sau khi chạy lại: `subaccounts=2`, `broker_configs=2`, `quarantine_SA=1`, `quarantine_BC=1`
⇒ **không duplicate row, không tạo quarantine thừa**.

---

## 5. AC-8 — file migration đã apply KHÔNG bị sửa

```
$ git diff --stat
 docs/CLAIMS.md                                                    |   2 +-
 packages/core/backend/src/user_workspace/models.py                | 300 ++++++++++++++++-----
 packages/core/backend/src/user_workspace/signals.py              |  37 ++-
 packages/core/backend/src/user_workspace/tasks.py                |  90 ++++-
 4 files changed, 351 insertions(+), 78 deletions(-)
```

**Không file `00XX` nào bị chạm.** File migration mới là **untracked** (chưa commit):
`packages/core/backend/src/user_workspace/migrations/0019_pf4_tenant_and_financial_guards.py`.

Test `AppliedMigrationUntouchedTests.test_branch_does_not_touch_already_applied_migration_files`
chạy `git diff --name-only origin/dev...HEAD -- .../user_workspace/migrations/` và assert
không chạm 9 file đã lock (`0001`, `0005`, `0006`, `0007`, `0008`, `0011`, `0012`, `0017`, `0018`).

---

## 6. Gate — kết quả thật

Tất cả lệnh chạy từ `C:\Mujoco Projects\pf4-modelsworker\packages\core\backend`
trừ `check-multi-agent` (chạy từ repo root).

| # | Lệnh | Kết quả |
|---|---|---|
| 1 | `python manage.py check` | **PASS** — `System check identified no issues (0 silenced).` |
| 2 | `python manage.py makemigrations --check --dry-run` | **PASS** — `No changes detected`, `exit=0` |
| 3 | `python manage.py showmigrations user_workspace` | **PASS** — `[X] 0019_pf4_tenant_and_financial_guards` là leaf cuối, **19/19 applied, đúng 1 leaf** |
| 4 | `python manage.py test user_workspace.test_worker_tenant user_workspace.test_broker_config_tenant user_workspace.test_migration_0008_rehearsal -v 2` | **PASS** — `Ran 58 tests … OK` |
| 5 | `python manage.py test vninvest_core.tests.test_user_workspace_tenant_isolation -v 1` | **PRE-EXISTING** — `Ran 26 tests … FAILED (failures=1, errors=5)`, **y hệt ở HEAD sạch** (xem §7) |
| 6 | `python manage.py test identity_access -v 1` | **PRE-EXISTING** — `Ran 288 tests … FAILED (errors=1)`, **y hệt ở HEAD sạch** (xem §7) |
| 7 | `python manage.py test user_workspace -v 1` (regression rộng) | **PRE-EXISTING** — `Ran 170 tests … FAILED (errors=4, skipped=2)`, **0 failure do slice này** (xem §7) |
| 8 | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — `0 lỗi, 0 trùng số migration — PASS`, `exit=0` |

### 6.1 AC map

| AC | Nội dung | Trạng thái | Test |
|---|---|---|---|
| 1 | Seed `SubAccount` tenantless + `portfolio_id=NULL` ở `0007` → `0008` | **PASS** (sau fix) | `Migration0008BugEvidenceTests` + `RepairBackfillRehearsalTests` (8 test) |
| 2 | Repair idempotent: chạy 2–3 lần, không duplicate | **PASS** | `test_repair_backfill_is_idempotent_when_run_twice`, `test_repair_backfill_idempotent_for_quarantined_row` + rehearsal §4.1 |
| 3 | Backfill broker config: 1 tenant → gán đúng; ≥2 tenant → quarantine | **PASS** | `BrokerConfigTenantBackfillTests` (8 test) |
| 4 | 2 tenant của cùng user không đọc/trạng thái/sync lẫn nhau | **PASS** | `BrokerConfigTenantIsolationTests` (8 test) |
| 5 | `SubAccount` tạo không truyền tenant qua signal ⇒ không `IntegrityError` | **PASS** | `SubAccountSignalTenantTests` (6 test) |
| 6 | user ≥2 tenant, task không truyền `tenant_id` ⇒ từ chối | **PASS** | `WorkerTenantResolutionTests` (6 test) |
| 7 | Ma trận validator price/quantity/fee/tax | **PASS** | `TransactionValidatorMatrixTests` (14 test) |
| 8 | `git diff` không chạm file `00XX` cũ | **PASS** | §5 + `AppliedMigrationUntouchedTests` |

**8/8 AC PASS.**

---

## 7. Bằng chứng PRE-EXISTING (reproduce trên HEAD sạch bằng `git stash -u`)

Không suy đoán "chắc là pre-existing" — đã chạy thật ở HEAD sạch rồi so sánh.

| Suite | HEAD sạch (`git stash -u`) | Sau thay đổi | Kết luận |
|---|---|---|---|
| `vninvest_core.tests.test_user_workspace_tenant_isolation` | `Ran 26 … FAILED (failures=1, errors=5)` | `Ran 26 … FAILED (failures=1, errors=5)` | Giống hệt — **pre-existing** |
| `identity_access` | `Ran 288 … FAILED (errors=1)` | `Ran 288 … FAILED (errors=1)` | Giống hệt — **pre-existing** |
| `identity_access.tests.test_pat_tenant_binding` (để chốt tên test) | `ERROR: test_drf_auth_reuses_middleware_credential_avoids_double_query` · `FAILED (errors=1)` | Cùng tên test, `FAILED (errors=1)` | Giống hệt — **pre-existing** |
| `user_workspace` (full app) | — | `Ran 170 … FAILED (errors=4, skipped=2)` | 4 lỗi đều nằm trong 2 module dưới; xem dòng dưới |
| `user_workspace.test_broker_retail` + `test_portfolio_analytics_native_routes` | `Ran 8 … FAILED (errors=4)` — `test_exchange_rate_ok`, `test_gold_ok_and_cached`, `test_upstream_error_mapped`, `test_core_v1_workspace_portfolio_analytics_routes_match_legacy_contracts` | Cùng 4 tên test | Giống hệt — **pre-existing** |

Ngoài ra, `user_workspace/tests.py:331-348`
(`test_portfolio_without_tenant_assignment_fails_isolation_query`) **đã từng đỏ** khi tôi tạm
bỏ fallback auto-provision tenant, rồi **xanh trở lại** sau khi giữ lại hành vi đó (xem §8.2).

---

## 8. CONTRADICTIONS phát hiện được (không theo giả định của đề bài)

### 8.1 `SubAccount` **KHÔNG** phải "không có signal" — signal đã tồn tại và **tệ hơn mô tả**

Đề bài (và audit `P0-DATA-01`) nói `SubAccount` là "lỗ hổng thật duy nhất — KHÔNG có signal cứu".
**Sai.** `models.py` (trước thay đổi) `:901` đã có:

```python
@receiver(pre_save, sender=SubAccount)     # models.py:901 — ĐÃ CÓ
def resolve_tenant_for_user_workspace_models(sender, instance, **kwargs): ...
```

Và bản cũ của receiver đó có **3 lỗi**, trong đó lỗi nặng nhất không phải "thiếu signal":

| Lỗi | Vị trí | Tác động |
|---|---|---|
| `CoreTenant.objects.filter(owner_user=user).first()` | `models.py:940` | **"first tenant" đoán mù** — user đa tenant bị gán tenant tùy ý |
| `TenantMember.objects.filter(user=user).first()` | `models.py:948` | **"first tenant" đoán mù** (dòng này là nguyên nhân `SubAccount` của user đa tenant nhận tenant NGẪU NHIÊN) |
| `CoreTenant.objects.create(tenant_code=f"auto-{user.username}", …)` | `models.py:952-960` | **Ghi dữ liệu như side effect của `save()`** |

Cả 3 vi phạm nguyên tắc bất di bất dịch `IMPLEMENTATION_PLAN…:54` ("không có `first tenant`/
`first portfolio` fallback") và `:51` (deny by default).

**Đã sửa** (file trong phạm vi): `models.py` nay có
`resolve_tenant_for_user_workspace_instance()` làm SSOT —
`portfolio/watchlist` chain → **đúng 1** tenant của user → fail-closed; `SubAccount` được tháo
khỏi danh sách sender ở `models.py` và do receiver riêng `signals.auto_populate_subaccount_tenant`
sở hữu (đúng như yêu cầu "thêm `SubAccount` vào receiver"), cùng gọi SSOT.

### 8.2 Không thể vừa fail-closed vừa giữ `tests.py` — đã chọn phương án và ghi lý do

`user_workspace/tests.py:331-348` tạo `Portfolio(user=orphan, tenant=None)` và **dựa vào**
fallback auto-provision. `tests.py` **ngoài phạm vi** (không sửa được) và có test khác dùng hành
vi này ⇒ bỏ hẳn auto-create sẽ làm đỏ code không thuộc phạm vi.

⇒ Giữ auto-provision **chỉ cho case user thuộc 0 tenant** (`_autoprovision_tenant_for`), bỏ
"first tenant" ở case ≥2 tenant. Đây là cải thiện thật cho lỗ hổng mà không phá app khác.
Rủi ro còn lại ("ghi dữ liệu trong `save()`") đã ghi ở docstring `models.py` + backlog §10.

### 8.3 `external_id` uniqueness — **KHÔNG thêm** DB constraint (có lý do)

- `Transaction.external_id` là `CharField(blank=True, default='')` — **không nullable** ⇒ mọi giao
  dịch manual đều để trống ⇒ unique constraint trên cột này sẽ **va chạm hàng loạt**.
- Có thể trùng giữa các provider (chưa có trường `provider` ở `Transaction`).
- **Không chứng minh được** dữ liệu production sạch: DB dev `vninvest_core` có
  `tx_total = 0` nên truy vấn trùng trả `0` — **không chứng minh được cho production**.
  SQL để DBA chạy trước khi thêm constraint:
  ```sql
  SELECT portfolio_id, external_id, count(*)
  FROM user_workspace_transaction
  WHERE external_id <> ''
  GROUP BY 1,2 HAVING count(*) > 1;
  ```
- Constraint sai sẽ làm hỏng `update_or_create` đang chạy tại `tasks.py:234`.

⇒ **Backlog**, không thêm trong slice này. `pf2-analyticsledger` đang làm phần
idempotency/ledger — báo coordinator để gộp.

### 8.4 Oversell — không sửa (đúng plan)

`IMPLEMENTATION_PLAN…:277` yêu cầu kiểm tra oversell ở **service/ledger, không ở model** (model
không đủ ngữ cảnh portfolio). `pf2-analyticsledger` đang làm phần ledger ⇒ chỉ ghi nhận, không sửa.

### 8.5 `serializers.py` ngoài phạm vi — luật theo loại lệnh chưa chặn ở tầng API

`Transaction.clean()` (luật BUY/SELL ⇒ `quantity > 0`, `price > 0`) chỉ chạy khi gọi
`full_clean()`. Django **không** validate khi `.save()`. Ở tầng API:
- `MinValueValidator` trên field **có** hiệu lực vì DRF `ModelSerializer` tự kế thừa
  (`serializers.py:24-38`) — test `test_serializer_enforces_same_matrix` chứng minh.
- Nhưng luật theo loại (`BUY`/`SELL` không được `quantity = 0`) cần
  `validate()` trong `TransactionSerializer` ⇒ **`serializers.py` nằm trong deny list**
  ⇒ **báo coordinator, không tự sửa**.

### 8.6 Fan-out task chưa truyền `tenant_id` (ngoài phạm vi)

`tasks.py:reconcile_all_dnse_transactions_task` / `sync_all_dnse_balances_task` gọi
`.delay(user_id)` không kèm tenant ⇒ user đa tenant bị từ chối ở task con (fail-closed, đúng).
Cần scheduler truyền tenant theo membership — `settings.py`/`queue_policy` ngoài phạmvi.
Đã ghi comment tại call site.

---

## 9. Quyết định `null=True` cho `UserBrokerConfig.tenant` (dựa trên dữ liệu)

Đề bài yêu cầu "kiểm tra xem có bao nhiêu row thật trước khi quyết định `null=True` hay
`null=False`". Số đo trên DB dev `vninvest_core`:

```
UserBrokerConfig      | 0
SubAccount null tenant| 0
SubAccount portfolio NULL | 0
Transaction null tenant| 0
```

Plan TEN-04 (`:593`) yêu cầu NOT NULL nhưng **rollback rule** của chính plan (`:601`) là
*"expand-only migration; cột nullable trước, backfill sau, contract sau canary"*.

⇒ **`null=True` ở `0019`** (expand), vì:
1. Row thật ở dev = 0 **không chứng minh được** cho production/staging — nếu đặt NOT NULL ngay,
   một row ambiguous ở production sẽ **chặn deploy**.
2. Backfill có thể quarantine (không gán được) ⇒ NOT NULL sẽ fail.
3. Đúng rollback rule của plan.

**Contract phase (`AlterField` → `null=False`) là việc của ticket sau, chỉ khi quarantine = 0 ở
mọi môi trường.** Đã ghi ở docstring migration.

### 9.1 Vì sao thêm 2 constraint thay vì 1

`Meta.constraints` có 2 unique constraint:
1. `uniq_broker_config_tenant_user_provider_label` — `(tenant, user, provider, label)`, đúng AC.
2. `uniq_broker_config_legacy_no_tenant` — `(user, provider, label)` **WHERE `tenant IS NULL`**.

Cần (2) vì Postgres coi `NULL` là khác nhau trong unique index ⇒ nếu chỉ có (1), row chưa backfill
được bảo vệ. (2) giữ **hành vi cũ** cho nhóm row đó, test
`test_legacy_unique_user_provider_label_preserved_for_null_tenant` chứng minh
`user_workspace/test_user_broker_config.py:50-59` không vỡ.

---

## 10. Việc ngoài phạm vi — BÁO CÁO, KHÔNG TỰ SỬA

| # | File | Cần gì | Vì sao không sửa |
|---|---|---|---|
| 1 | `user_workspace/views_broker.py:97,122,133,147,162` | truyền `tenant` vào `get_user_broker_config` / `set_user_broker_secrets` | **DENY LIST**. Đã làm tương thích ngược (`tenant=None` ⇒ hành vi cũ + `logger.warning`) nên route không vỡ; nhưng credential **vẫn tenant-blind** cho tới khi view được migrate |
| 2 | `user_workspace/views_dnse.py:150,415` | truyền `tenant` | **DENY LIST** |
| 3 | `user_workspace/serializers.py:24-38` | `validate()` cho luật BUY/SELL theo loại | **DENY LIST** |
| 4 | `user_workspace/models.py` (auto-provision trong `save()`) | nên tạo tenant ở luồng đăng ký `identity_access/views/register.py` | `identity_access/**` **DENY LIST**; `views/register.py` do `tenantreg-a` giữ |
| 5 | `user_workspace/tests.py:331-348` | test giả định "Portfolio tenant NULL tồn tại" — sau `0012` điều đó không còn khả thi | **Ngoài danh sách file cho phép**. Hiện vẫn xanh nhờ giữ auto-provision |
| 6 | `Transaction.external_id` | unique `(portfolio, external_id) WHERE external_id <> ''` | Cần DBA chạy SQL trùng ở production trước (§8.3). **Backlog** |
| 7 | Oversell check | service/ledger | `pf2-analyticsledger` đang làm |
| 8 | `0008` reverse `objects.all().update(tenant=None)` | không thể sửa | BR-07; đã chứng minh lệnh này **không chạy được** sau `0012` |
| 9 | `reconcile_all_dnse_transactions_task` fan-out | truyền `tenant_id` | Cần scheduler (`settings.py`) — `tenantreg-s` giữ |

---

## 11. CHƯA CHẠY

| Hạng mục | Lý do |
|---|---|
| `makemigrations --check --dry-run` trên DB **đã migrate đầy đủ có dữ liệu** (plan TEN-05 `:613`) | Đã chạy trên `ag_pf4_modelsworker` sau khi seed dữ liệu + migrate tới `0019` (§4) — nhưng **chưa** chạy trên DB có dữ liệu *production-like* thật; không có clone |
| Harness `migration-rehearsal` trên CI (plan TEN-05 `:612`) | Job CI nằm ngoài phạm vi; cần ticket riêng cho coordinator |
| `makemigrations` trên DB đã apply ở `0018` với dữ liệu thật của `vninvest_core` | Không được chạm DB `vninvest_core` (multi-agent) |
| Visual QA / E2E UI | Slice backend, không có thay đổi FE |
| `npx tsc --noEmit` / `npm run build` | Không sửa `packages/web/**` |

**Không gate nào ghi "PASS" mà chưa chạy thật.**
