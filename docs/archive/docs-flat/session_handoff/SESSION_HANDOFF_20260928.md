# Session handoff — 2026-09-28 (SEC-01/02/03)

`verified: 2026-09-28 @ c1678ad5` · nguồn sự thật cho trạng thái claim: `docs/CLAIMS.md` + `git log`, **không phải file này**.

## Đã merge vào `dev` trong phiên này

| PR | Nội dung | Merge |
|---|---|---|
| #46 | SEC-03: scanner secret + gỡ 7 credential hardcode | `cfabe2d2` |
| #47 | SEC-02b: key registry nhiều version + fail-closed | `fd54dc2d` |
| #48 | đóng claim `sec02b` | `c1678ad5` |

Cả 3 claim (`sec03-secret-scan`, `sec02b-multi-version-keys`) đã ở trạng thái `released`.

### SEC-03 (PR #46)
`packages/web/scripts/scan-secrets.mjs` — quét git-tracked file. Self-test 43/43; quét
4203 file: 0 finding. Cấu hình được chọn bằng **đo**, không đoán: floor 24 → 1 finding
(thật), floor 12 → 145 (≈140 fixture), rule bare-key → 338 ⇒ **loại rule bare-key**.
Lỗ hổng của chính scanner (flag nhầm source của nó, chứa literal 44 ký tự giống
Fernet thật) đã sửa ở `7edfba95`.
7 credential thật đã gỡ khỏi working tree, gồm 3 script tạo admin `is_superuser=True`
với mật khẩu hardcode `test@123456`.
`docker-compose.dev.yml` (deny-list §2, commit riêng `51a21c5f`): bỏ Fernet key thật,
sửa bug `POSTGRES_PASSWORD` lệch với 11 `CORE_DATABASE_URL`, **giữ lại** default pepper.

### SEC-02b (PR #47)
Audit lại spec (`docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md:79-124`) cho thấy
PR #43 để sót 4 yêu cầu. Đáng kể nhất: **`BROKER_SECRET_KEY`/v2 chưa từng được gọi** —
`encrypt_string` ghim `version=1` nên secret broker **vẫn gắn vào `SECRET_KEY`**, đúng
risk 90% của spec. Thêm 2 fail-open (`decrypt_string` → `""`, `get_secrets` → `{}`).
Đã thêm `SecretKeyMissingError`, key registry nhiều version,
`UserBrokerConfig.secret_version` + migration `0020` (sinh bằng `makemigrations`),
system check `W003`/`W004` cho PB1. 28/28 test.
Chi tiết + câu trả lời PB1/PB2/PB3: `docs/evidence/SEC-02/`.

## Baseline test đã biết (đừng điều tra lại)

- **BE full suite `dev` @ `c1678ad5`: 642 test — 11 failures, 2 errors.** Đã xác minh
  *trùng từng tên* bằng cách chạy 6 module đó trên `dev` sạch. Không phải do SEC-02b.
  Danh sách: `test_audit_logs_api` (1), `test_quota_period_accumulation` (1),
  `test_scheduler_management_commands` (4 fail + 2 error), `test_session_facts_api` (4),
  `test_stock_management_api_routes` (1).
- **FE**: `npx tsc --noEmit` 0 · `npm run build` PASS · jest 18/18 255 · vitest 102/102 686.
- **GitHub Actions đang TẮT** (PR #36) — 40/40 run fail do `recent account payments have
  failed`, runner chưa chạy bước nào. Không có tín hiệu CI nào.

## Việc còn tồn đọng — CHỈ OWNER

1. **Rotate/revoke secret.** Các credential đã gỡ khỏi working tree **vẫn nằm trong git
   history**. Thứ tự **không đảo**: revoke → rotate → gỏ khỏi HEAD → purge history →
   chặn tái diễn. **Không purge history khi còn agent đang chạy.** Còn: PAT GitHub, admin
   password Portainer, Fernet key `DNSE_CREDENTIAL_FERNET_KEY`.
2. **`docker-compose.dev.yml`** — các biến giờ dùng `:?` fail-fast, nên môi trường dev
   phải có `CORE_DB_PASSWORD`, `CORE_PAT_PEPPER`, `DNSE_CREDENTIAL_FERNET_KEY` trong
   `compose.dev.env` (gitignored) thì `docker compose config` mới exit 0.
3. **Wire `BROKER_SECRET_KEY` vào compose** — spec SEC-02 §2 cấm chạm `docker-compose*.yml`
   nên PR #47 cố ý không đụng. Không có nó thì broker secrets vẫn ghi ở v1.
4. **Re-encrypt row cũ** (chưa làm, có chủ đích). Data migration không thể là schema
   migration: cần key đích lúc migrate và sẽ phá chính row cần migrate.
   ```sql
   SELECT secret_version, count(*) FROM user_workspace_userbrokerconfig
   WHERE secrets_cipher <> '' GROUP BY 1;
   ```
   Rồi dùng `SecretStore().reencrypt(...)` theo quy trình 4 bước trong `pb-answers.md`.
5. **`node tools/opencode-global/deploy.mjs`** — chưa chạy, nên `global-config-drift` còn
   FAIL (xem bẫy #5).

## Bẫy đã gặp trong phiên này — đọc trước khi chạy lại

1. **Postgres: user là `vninvest`, KHÔNG phải `vninstall`.** Gõ sai 1 chữ cái cho ra
   `FATAL: password authentication failed` — triệu chứng *rất* dễ nhầm thành "Postgres
   không chạy". `postgresql://vninvest:devpassword@127.0.0.1:5433/<db>`.
2. **Worktree mới KHÔNG có `node_modules`** → `tsc` và `i18n-strict-selftest` FAIL giả.
   Tạo junction:
   `New-Item -ItemType Junction -Path <wt>\packages\web\node_modules -Target <main>\packages\web\node_modules`.
   Xoá junction **trước** khi `git worktree remove`.
3. **Worktree mới KHÔNG có `src/staticfiles/`** (artifact `collectstatic`, untracked,
   `.gitignore:28`) → `test_admin_login_page_is_servable` lỗi
   `Missing staticfiles manifest entry` giống hệt regression nhưng **không phải code**.
   Copy từ main tree. Đừng ghi "642/11/3" vào báo cáo — số đúng là 11/2.
4. **Test DB còn sót** → `manage.py test` hỏi xoá tương tác rồi `EOFError`. Luôn
   `--noinput`, và `DROP DATABASE ... WITH (FORCE)` khi dọn.
5. **`global-config-drift` FAIL không phải do `autocrlf`.** Tôi đã đoán sai một lần rồi
   sửa lại. Nguyên nhân thật: agent khác sửa `tools/opencode-global/*` trong main tree mà
   chưa deploy. Lệnh fix là `deploy.mjs` (sửa global config máy) — **đừng chạy khi agent
   khác đang bay**.
6. **`cd` trong command không ăn ở môi trường này.** Tôi từng set nhầm `core.autocrlf`
   lên main repo. Dùng tham số `workdir` của tool thay vì `cd`.
7. **Bốn `.bak` chứa PAT thật** từng được tạo khi sửa file. Xoá ngay, đừng commit.
8. **`main tree` có thể đang bị agent khác giữ** (uncommitted file, có file đã staged).
   Kiểm tra `git status` trước khi đụng; nếu không sạch thì làm việc trong worktree riêng.

## Còn lại trong Wave −1

SEC-01 chưa đóng vì chờ bằng chứng rotate từ owner. Sau đó mới sang wave tiếp theo.
Xem `docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md` cho phần còn lại.

## File deny-list — cần coordinator merge

Phiên này **không** sửa các file này (theo AGENTS.md §2):
`AGENTS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `packages/web/package.json`,
`pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`.
Lưu ý: `docker-compose.dev.yml` **đã** được sửa trong commit `51a21c5f` của PR #46 (đã
merge) — coordinator nên review hậu kiểm nếu chưa xem.
