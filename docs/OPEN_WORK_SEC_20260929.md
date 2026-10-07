# OPEN WORK (SEC / billing / CI) — 5 P0 bị chặn bởi quyền của owner

**Ngày:** 2026-09-29
**Đã đổi tên:** 2026-10-07 từ `OPEN_WORK_20260929.md` (ghi chú giải thích bên dưới)
**Nguồn:** 3 audit độc lập trong 1 phiên (SEC-01..03 / SAFE-01..04 / SAFE-05..07 + TEN-01..06) → **42 lỗi còn lại**
**Branch:** `feat/portfolio-p0-closure` · **Claim:** `docs/CLAIMS.md` dòng `portfolio-p0-closure`

Tài liệu này ghi những việc **không agent nào tự làm được**. Mỗi mục có `file:line`,
lệnh tái tạo, và lý do chặn. Không mục nào được coi là đã xong.

> **Nguyên tắc:** viết ở đây nghĩa là **chưa làm**. Không mục nào có bằng chứng
> `Pass` vì không mục nào đã chạy được.

---

> ## ⚠ HỆ SỐ ĐỘC LẬP — KHÔNG TRÙNG VỚI `OPEN_WORK_20260927.md`
>
> File này nhóm việc **SEC / billing / CI** (2026-09-29).
> `OPEN_WORK_20260927.md` dùng **cùng số hiệu `OW-01..OW-05`** cho **việc hoàn toàn khác**.
>
> | Số hiệu | Ở file này (SEC) | Ở `OPEN_WORK_20260927.md` |
> |---|---|---|
> | `OW-01` | Rotate 7 secret — **CHƯA CHẠY** | URL-routing — **ĐÃ ĐÓNG** (Entry 241) |
> | `OW-02` | Rotate `BROKER_SECRET_KEY` — **chưa đổi** | `commercial/views.py` 500 — **đã merge PR #73** |
> | `OW-03` | Trả billing + bật CI — **CHƯA CHẠY** | `AuditLogListView` fail-closed SOC |
> | `OW-04` | Ledger quy trình — **ĐÃ XỬ LÝ** (xem mục dưới) | `STRICT_TURNSTILE_ENFORCEMENT` |
> | `OW-05` | `UserDNSECredential` legacy store | P0-SEC-01: 9 secret trong git history |
>
> **Tra cứu phải ghi rõ tên file. Không dùng số hiệu `OW-nn` để tra** — số hiệu trùng
> ở 2 file và có thể chỉ tới việc khác nhau.
>
> ### Vì sao đổi tên (2026-10-07)
> `AGENTS.md` trỏ "6 việc còn tồn đọng (OW-01..OW-06)" — người đọc sẽ tra `OW-01` ở file 27,
> thấy **"ĐÃ ĐÓNG"**, và **bỏ sót việc rotate secret (P0)**. Xem
> `docs/PLAN_QUYET_DINH_4_VIEC_20261007.md` quyết định 4.
>
> ### OW-04 Ở FILE NÀY ĐÃ SAI — đã đóng
> Mục OW-04 ghi *"ledger chưa ghi vì file còn trong deny list §2"*. **Không còn đúng**:
> - `packages/web/scripts/check-multi-agent.mjs` `DENY_LIST` **không có** `CODE_CHANGE_AUDIT_LEDGER.md`
>   (đã gỡ khỏi deny-list 2026-10-03, Owner chốt)
> - `docs/CODE_CHANGE_AUDIT_LEDGER.md` **Entry 241** đã ghi
>
> → Đóng mục này, không cần hành động gì thêm.

---

## OW-01 — Rotate 7 secret (SEC-01, P0)

**Trạng thái:** `CHƯA CHẠY (chờ owner)` · **2/5 điều kiện tiên quyết ĐÃ ĐẠT** (kiểm 2026-10-07)
**Chặn:** cần network tới GitHub / DNSE / Django / Ad signing.

7 secret phải revoke + phát hành lại **cùng lúc** (D-29 — rotate là một sự kiện):

| # | Tên biến | Ghi chú |
|---|----------|---------|
| 1 | `CORE_DJANGO_SECRET_KEY` | |
| 2 | `CORE_PAT_PEPPER` | |
| 3 | `CORE_AD_SIGNING_SECRET` | |
| 4 | `DNSE_CREDENTIAL_FERNET_KEY` | |
| 5 | `DNSE_API_KEY` | |
| 6 | `DNSE_API_SECRET` | |
| 7 | `GITHUB_CLIENT_SECRET` |

**Bằng chứng hiện có (verify bằng lệnh, không phải suy luận):**

```
$ git ls-files | grep -c 'compose.dev.env'
0                                    # đã gỡ khỏi tracked (SEC-03 R3 ĐẠT)

$ git check-ignore -v compose.dev.env
.gitignore:49:compose*.env   compose.dev.env

$ node packages/web/scripts/scan-secrets.mjs
scan-secrets: OK, no secrets found          # 0 secret thật trong tracked file
```

**Còn lại (không làm được nếu thiếu owner):**

0. ⚠ **PHÁT HIỆN MỚI 2026-10-07 — DB dev thiếu 4 migration.**
   `SELECT secret_version FROM user_workspace_userbrokerconfig` → **cột không tồn tại**.
   Nguyên nhân: `django_migrations` trên DB dev cao nhất `0019_pf4_tenant_and_financial_guards`,
   trong khi code đã có `0020`…`0023`.
   ⇒ Phải `python manage.py migrate` **trước** khi chạy `reencrypt_broker_secrets`,
   nếu không lệnh sẽ lỗi vì thiếu cột `secret_version`.

1. ✅ **ĐÃ KIỂM 2026-10-07** — `SELECT count(*) FROM identity_access_userdnsecredential` → **0**.
   Store này dùng `_encrypt_credential` riêng (`identity_access/models.py:879-892`), **không**
   qua `SecretStore` và **không có** `secret_version`, nên lệnh `reencrypt_broker_secrets`
   cố tình bỏ qua nó. Rotate key ⇒ mất toàn bộ credential DNSE cũ.
   **Trên DB dev không mất gì (0 bản ghi).** ⚠ Phải chạy lại trên DB THẬT.
2. ⏳ Chưa làm — xác nhận `0 UserBrokerConfig` đang ở `secret_version=1` (cần #0 trước),
   rồi `reencrypt_broker_secrets --apply` (lệnh có sẵn:
   `user_workspace/management/commands/reencrypt_broker_secrets.py`).
3. ⏳ Thông báo user trước khi rotate (session/PAT cũ sẽ vô hiệu) — D-29.
4. ⏳ Tạo `docs/evidence/SEC-01/{gates,rotate-log,pb-answers}.md` — **sau** khi rotate,
   không tạo trước (tạo trước là báo cáo không có bằng chứng).

**Không tự purge git history** (`AGENTS.md` cấm khi còn agent chạy):
`git log --all -S 'DNSE_CREDENTIAL_FERNET_KEY'` → **27 commit**,
`-S 'github_pat_'` → **18**, `-S 'ghp_'` → **22**. Chỉ ghi số, **không** in giá trị.

---

## OW-02 — Rotate `BROKER_SECRET_KEY` lên `SecretStore` (SEC-02, P0)

**Trạng thái:** code ĐÃ có, **nhưng chưa có tác dụng trong bất kỳ deployment nào**
**Đã làm trong PR này:** biến `BROKER_SECRET_KEY` đã được set (fail-fast) ở 4 file compose.

**Việc còn lại (chỉ owner vận hành được):**

```bash
# 1. sinh key, đặt vào compose.dev.env / secret store (KHÔNG commit)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 2. xem trước, KHÔNG ghi gì (mặc định dry-run)
python manage.py reencrypt_broker_secrets

# 3. mới ghi
python manage.py reencrypt_broker_secrets --apply

# 4. GIỮ `BROKER_SECRET_KEY_V1` để rollback được (key registry multi-version)
```

**Vì sao quan trọng — đo bằng lệnh, trước khi PR này:**

```
$ grep -rn BROKER_SECRET docker-compose*.yml compose.dev.env.example
0 hit
```

⇒ `write_version()` luôn trả `LEGACY_VERSION=1` ⇒ `get_key(1)` là
`SECRET_KEY + ":core-workspace-key"` (`encryption.py:53`). **Xoay
`DJANGO_SECRET_KEY` làm hỏng toàn bộ broker credential.** Đúng rủi ro 90% mà
`docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md:81` cảnh báo.

---

## OW-03 — Trả billing + bật lại CI (SAFE-07, SEC-03 R6, P0)

**Trạng thái:** `CHƯA CHẠY` — không thể chạy từ phía agent. **Xác minh lại 2026-10-07: tình trạng không đổi.**

```
$ git ls-files '.github/workflows/*.yml' | wc -l
1                  # CHỈ secret-scan.yml

$ ls .github/workflows-disabled/
backend.yml  core-api.yml  governance-release-gate.yml  large-file-guard.yml
multi-agent-gate.yml  opencore-doc-sync-gate.yml  web-ci.yml  web.yml
                     + README.md
8 workflow bị disable — không đổi so với 2026-09-27.

$ head -3 .github/workflows-disabled/README.md
# GitHub Actions - ĐÃ TẮT 2026-09-27
# 200/200 run gần nhất thất bại. Nguyên nhân gốc: recent account payments
# have failed / spending limit needs to be increased. — fail sau 2-3 giây,
```

⚠ **Hệ quả:** ngoài `secret-scan`, mọi gate (test, tsc, multi-agent) chỉ chạy **cục bộ**
qua `.githooks/pre-push`. Không có CI làm lưới an toàn khi máy dev hỏng.

**Đã làm trong PR này (để sẵn sàng khi bật):**
- `.github/workflows/secret-scan.yml` — đã viết, **chưa bao giờ chạy**.
- `scripts/pre-push-gate.mjs` — đã nối `secret-scan` + `secret-scan-selftest`.
  **Đây là gate chạy thật hiện nay** (PASS 52/52 selftest, 0 secret / 3335 file).

**Owner làm, đúng thứ tự — KHÔNG đảo:**

1. Trả billing.
2. **Trước** khi bật: sửa 7 chỗ fail-open còn trong YAML đã tắt:
   - `core-api.yml:142,143,144` (`coverage run manage.py test --keepdb || true`)
   - `web-ci.yml:39,50,170,173` (`|| echo`)
   - `packages/core/backend/entrypoint.sh:21,24,52` (`|| true`, `|| echo`, `|| echo`)
   Bật nguyên trạng thái ⇒ lần chạy đầu tiên **đỏ ngay**.
3. `git mv .github/workflows-disabled/*.yml .github/workflows/`
4. Thêm `manage.py check` + `makemigrations --check` (hiện **0 occurrence** trong
   mọi workflow — R3 của SAFE-07 chưa từng có).
5. Thêm `fail_under` vào `.coveragerc` (hiện không có — R4/AC3).

**PB2 của spec đã trả lời:** CI dùng Postgres chứ không dùng SQLite —
`identity_access/migrations/9000_auth_user_email_ci_unique.py:60` dùng
`array_agg` của Postgres, chạy trên SQLite sẽ `OperationalError` ngay lúc migrate.

---

## OW-04 - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (quy trinh, P1) - DA DONG 2026-10-07

**Trang thai goc (SAI):** ~~chua ghi. File nam trong deny list 2 nen agent khong commit duoc.~~

**Bang chung da dong:**
- `packages/web/scripts/check-multi-agent.mjs` `DENY_LIST` **khong chua** `CODE_CHANGE_AUDIT_LEDGER.md`
  (da go khoi deny-list ngay 2026-10-03, Owner chot, muc Q-01 cua `AGENTS.md`).
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` **Entry 241** da ghi ngay 2026-10-03.
- Rang buoc con lai: ledger append-only, moi Entry la 1 `## Entry N` rieng de hunk tach duoc.

**Viec can lam:** ~~bo sung entry~~ -> **khong con**. Neu phat sinh Entry moi, append theo
quy uoc ledger (khong can claim truoc, khong can `--no-verify`).

<details>
<summary>Noi dung goc (giu de doi chieu, da het hieu luc)</summary>

Can bo sung cac entry sau (noi dung da san trong commit cua PR nay):

- Migration `0008` sua `is_active` tren `TenantMember`
- 4 cache key them `tenant_id`
- Kill-switch: fail-open -> fail-closed
- 7 endpoint tai chinh co kiem tra quyen theo tenant
- 12 call site FE doc tenant qua SSOT
- `BROKER_SECRET_KEY` set fail-fast + `CORE_PAT_PEPPER` co default

</details>
## OW-05 — `UserDNSECredential` legacy store (SEC-02) — ✅ ĐÃ CHỌN (b) 2026-10-07

**Trạng thái:** đã quyết — chọn **(b)**, xác minh bằng số liệu thật.

`UserDNSECredential` dùng `_encrypt_credential` / `_decrypt_credential` riêng
(`identity_access/models.py:879-892, 997-1004`), **không** qua `SecretStore`,
**không có** `secret_version`. Lệnh `reencrypt_broker_secrets` cố t ý bỏ qua nó
(`reencrypt_broker_secrets.py:97`).

**Số liệu kiểm chứng 2026-10-07 (đọc lại trước khi quyết):**

```sql
SELECT count(*) FROM identity_access_userdnsecredential;   --> 0
```

⇒ Trên **DB dev** store rỗng ⇒ rotate `DNSE_CREDENTIAL_FERNET_KEY` **không mất credential nào**.
Rủi ro "mất toàn bộ credential DNSE cũ" **không xảy ra với dữ liệu hiện có**.

**Quyết định: (b) — ghi ngoài phạm vi, KHÔNG thêm migration lúc này.**

Lý do không chọn (a):
- Thêm `secret_version` cho một bảng **0 bản ghi** là việc không cần thiết
- DB dev đang thiếu migration `0020`–`0023` (`django_migrations` cao nhất `0019`); thêm
  migration mới làm rối thêm tình trạng này

**Điều kiện mở lại lên P0 — phải kiểm lại trên DB THẬT, không phải DB dev:**
- [ ] `SELECT count(*) FROM identity_access_userdnsecredential` > 0 trên production
      ⇒ **dừng rotate** `DNSE_CREDENTIAL_FERNET_KEY` cho tới khi có đường migrate
- [ ] Hoặc owner xác nhận chấp nhận mất credential DNSE cũ

⚠ **Kết luận trên chỉ đúng cho DB dev.** Store ở môi trường production có thể khác.
Không coi SEC-02 **đóng vật lý** khi còn 1 store chưa versioning.

---

## Phụ đính — 2 finding audit ĐÃ BÁC BỎ (ghi lại để không ai làm lại)

| Finding audit | Kết luận | Bằng chứng |
|---|---|---|
| "SAFE-04: 0/52 endpoint có capability" | **SAI ở phạm vi.** `identity_access` đã có hệ quyền đầy đủ, 60+ view dùng `require_tenant_permission`. Gap chỉ nằm ở `user_workspace`. | `grep -c require_tenant_permission user_workspace/` = **0**; cùng lệnh trong `identity_access/` = **60+** |
| "TEN-04: thêm `TenantScopePermission` vào 32 view analytics" | **SẄ GÂY REGRESSION BẢO MẬT.** `TenantScopePermission` tự resolve tenant khi middleware chưa set ⇒ biến 404 fail-closed thành **200 trả dữ liệu**. Đã thử, 5 test đỏ, đã revert. | `_get_user_portfolio` (`portfolio_analytics_views.py:84-106`) đã fail-closed 404; `test_analytics_tenant_matrix.py` AC3 khoá hành vi đó |
| "SEC-01..03 đã xong" | **Sai cả 3**, mỗi cái bằng cơ chế khác nhau | SEC-01 chưa từng bắt đầu · SEC-02 code tốt nhưng biến chưa set (OW-02) · SEC-03 mất đúng yêu cầu chặn tái diễn (OW-03) |
