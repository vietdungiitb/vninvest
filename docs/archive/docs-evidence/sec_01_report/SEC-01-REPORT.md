# SEC-01 — Secret Exposure Incident Report

**Ngày phát hiện:** 2026-09-25 (audit Portfolio)
**Ngày verify lại:** 2026-09-26 @ HEAD `523cd346`
**Mức:** **P0 — nghiêm trọng nhất trong toàn bộ audit Portfolio**
**Nguồn:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §0.6, §D1 `P0-SEC-01`
**Verify:** `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` §4 `U-1`,`U-2`
**Trạng thái:** **CHƯA XỬ LÝ** — cần owner hành động. Báo cáo này không sửa file nào.

> ## ⚠ QUY TẮC ĐỌC
> Tài liệu này **không chứa giá trị secret nào**. Chỉ có: tên file, số dòng, tên biến, độ dài,
> và 8 ký tự đầu của SHA-256 token (để phân biệt token nào là token nào mà không lộ chúng).
> Không có bước nào trong quy trình này cần bạn in ra giá trị gốc.

---

## 1. Tóm tắt điều hành

| Mức | Nội dung | Số |
|---|---|---:|
| 🔴 **CRITICAL** | `compose.dev.env` tracked, chứa `DNSE_CREDENTIAL_FERNET_KEY` hợp lệ (44 ký tự) | 10 key |
| 🔴 **HIGH** | Token GitHub PAT thật trong file tracked | **4 token / 21 dòng / 20 file** |
| 🟠 **MEDIUM** | `DNSE_CREDENTIAL_FERNET_KEY` **không** inject trong `docker-compose.prod.yml` | prod `RuntimeError` |
| 🟠 **MEDIUM** | Secret nằm trong git history | 10 + 14 commit |

**Consequence nghiêm trọng nhất:** `DNSE_CREDENTIAL_FERNET_KEY` lộ ⇒ **mọi
`UserDNSECredential` trong database giải mã được.** Key Fernet là đối xứng — có key là đọc
được toàn bộ credential broker đã lưu. Đây không phải "rò rỉ config", đây là rò rỉ dữ liệu
tài chính của khách hàng nếu database bị sao lưu/đọc.

**Việc gỡ khỏi HEAD KHÔNG đủ.** Số commit trong history chứa chuỗi token:
- `git log -S "github_pat_"` → **10 commit**
- `git log -S "ghp_"` → **14 commit**
- `git log -S "DNSE_CREDENTIAL_FERNET_KEY"` → **15 commit**

⇒ Phải **revoke/rotate** trước, **purge history** sau. Đảo thứ tự là mất tiền.

---

## 2. CRITICAL — `compose.dev.env`

### 2.1 Trạng thái git

```
git ls-files --error-unmatch compose.dev.env   -> exit 0   (ĐANG TRACKED)
git check-ignore -v compose.dev.env            -> exit 1   (KHÔNG được ignore)
```

`.gitignore:13-45` có `.env`, `backend/.env*`, `frontend/.env.*`, `.env.*.local`,
`.env.production`, `.env.saas-prod` — **không có** pattern `compose*.env`.
⇒ Lỗ hổng thật của `.gitignore`, không phải sự cẩu thả cục bộ.

`git ls-files` khớp env chỉ có 2 file: `compose.dev.env` (tracked) +
`compose.prod.env.example` (placeholder, OK).

### 2.2 Key trong file — tên + độ dài, KHÔNG giá trị

| Dòng | Tên biến | Độ dài | Ghi chú |
|---:|---|---:|---|
| 10 | `CORE_DB_PASSWORD` | 11 | |
| 11 | `CORE_DJANGO_SECRET_KEY` | 37 | secret Django — rotate làm vô hiệu mọi session/PAT derive |
| 14 | `CORE_PAT_PEPPER` | 36 | băm PAT — rotate làm vô hiệu toàn bộ PAT đã cấp |
| 15 | `CORE_AD_SIGNING_SECRET` | 43 | |
| **16** | **`DNSE_CREDENTIAL_FERNET_KEY`** | **44** | **đúng dạng Fernet hợp lệ ⇒ KHÔNG phải placeholder** |
| 19 | `DNSE_API_KEY` | 96 | |
| 20 | `DNSE_API_SECRET` | 86 | |
| 21 | `GRAFANA_ADMIN_PASSWORD` | 5 | yếu, brute-force được |
| 103 | `GITHUB_CLIENT_ID` | 20 | không nhạy cảm |
| 104 | `GITHUB_CLIENT_SECRET` | 40 | |

Không cơ chế placeholder nào (`changeme`/`your`/`xxx`/`TODO`) khớp bất kỳ dòng nào trên.

### 2.3 Chuỗi khai thác

```
compose.dev.env:16  (DNSE_CREDENTIAL_FERNET_KEY, 44 ký tự)
        │
        ▼
identity_access/models.py:861-867  _get_fernet()  → dùng env này
        │
        ▼
identity_access/models.py:877-879  _decrypt_credential()
        │
        ▼
Giải mã được MỌI UserDNSECredential trong DB
(user DNSE ID + trading token + mật khẩu)
```

Tham chiếu thêm: `identity_access/dnse_credential_views.py:76` ·
`user_workspace/migrations/0017_user_broker_config.py:55` · `docker-compose.dev.yml:82,127,352,421,458`.

### 2.4 Khuyến nghị

1. **Rotate Fernet key trước, xoá file sau.** Cần re-encrypt tool chạy 1 lần trên DB.
   Giữ key cũ read-only 7 ngày để rollback, sau đó thu hồi.
2. `git rm --cached compose.dev.env` + tạo `compose.dev.env.example` chỉ chứa placeholder
   dạng `<REQUIRED>` + thêm `compose*.env` vào `.gitignore`.
3. AC kiểm chứng: số record đọc được **trước = sau** re-encrypt; `git check-ignore` exit 0.

---

## 3. HIGH — Token GitHub trong file tracked

### 3.1 Token thật (phân biệt qua SHA-256 8 ký tự đầu + độ dài)

| Mã | SHA-8 | Độ dài | Format | File | Dòng |
|---|---|---:|---|---|---|
| **[A]** | `b69d8e77` | 93 | `github_pat_` | `DOCKER_STARTUP_GUIDE.md` | 14, 116 |
| **[B]** | `8591126c` | 93 | `github_pat_` | `docker-start.ps1` | 8 |
| **[B]** | `8591126c` | 93 | `github_pat_` | `set-docker-env.ps1` | 4 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_actions.py` | 5 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_default_branch.py` | 5 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_frontend_fail.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_github.py` | 5 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_run_details.py` | 5 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_test_log.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/check_workflows.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/dispatch_backend.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/dispatch_workflows.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/monitor_runs.py` | 6 |
| **[C]** | `6eaab992` | 40 | `ghp_` | `scratch/portainer_setup.py` | 16 |
| **[D]** | `8841c239` | 40 | `ghp_` | `packages/core/backend/tests/test_ai_audit_logs.py` | 45 |

**Tổng: 4 token riêng biệt · 15 vị trí · 6 token distinct.**

### 3.2 Placeholder — KHÔNG tính là secret thật

| SHA-8 | Độ dài | File : dòng | Lý do là placeholder |
|---|---:|---|---|
| `76467a4f` | 25 | `SYSTEM-CONNECTIVITY-TROUBLESHOOT-20260513.md` : 22, 27, 39, 48 | chứa ký tự `x` lặp |
| `9112466b` | 15 | `compose.prod.env.example` : 122 | `your_github_pat_...` |

⇒ Audit gốc đúng khi nói `compose.prod.env.example:122` chỉ là placeholder.

### 3.3 Vì sao nặng hơn audit gốc

Audit §0.6 nói *"PAT dạng `github_pat_...` trong `DOCKER_STARTUP_GUIDE.md:14,116`,
`docker-start.ps1:8`, `set-docker-env.ps1:4`"* — tức 4 dòng, 3 file.

Thực tế:
- **Thêm 11 file `scratch/*.py` với token [C]** — đây là **code chạy được** (script dispatch CI
  workflow), không phải tài liệu. Token nằm trong biến module-level được `import`.
- **Thêm token [D]** trong test fixture `dirty = {'token': '…'}` dùng để assert mask. Vẫn
  format `ghp_` thật; **không phân biệt được dummy/khật thật mà không in giá trị** ⇒
  **xử lý như thật**.

### 3.4 Khuyến nghị

1. **Revoke [A], [B], [C], [D]** trên GitHub. Cấp token mới qua secret store, **không commit**.
2. Rà soát GitHub audit log + token activity từ thời điểm commit đầu tiên chứa token.
   Dùng `git log -S "github_pat_"` (10 commit) và `git log -S "ghp_"` (14 commit) để biết
   khoảng thời gian phơi nhiễm.
3. Thay literal trong `DOCKER_STARTUP_GUIDE.md`, `docker-start.ps1`, `set-docker-env.ps1`
   bằng biến `${VNBROKER_GITHUB_TOKEN:?message}` hoặc hướng dẫn đọc secret manager.
4. `scratch/*.py` — chuyển sang đọc `GH_TOKEN` từ env. **Cần owner quyết: xoá hẳn hay giữ
   làm script local?**
5. `test_ai_audit_logs.py:45` — thay bằng chuỗi sinh từ `secrets`/`token_urlsafe` để không
   trùng pattern secret scanner.
6. **Purge history** chỉ **sau khi** revoke (xem §5). Backup tag trước khi purge.

---

## 4. MEDIUM — `DNSE_CREDENTIAL_FERNET_KEY` thiếu trong production

`git grep -n DNSE_CREDENTIAL_FERNET_KEY` → **0 hit** trong `docker-compose.prod.yml`.

| Nơi | Có key? |
|---|---|
| `docker-compose.prod.yml` | ❌ **KHÔNG** |
| `compose.prod.env.example` | ❌ **KHÔNG** |
| `docker-compose.dev.yml` | ✅ `:82, :127, :352, :421, :458` (trong đó `:352` để rỗng) |
| `compose.dev.env` | ✅ `:16` (**đang tracked**) |
| `identity_access/models.py` | `:864, :866, :889, :947` |
| `identity_access/dnse_credential_views.py` | `:76` |

`identity_access/models.py:861-867` `_get_fernet()` **raise `RuntimeError`** nếu thiếu env.
Route legacy `identity_access/urls.py:68` **vẫn bật** ⇒ `POST /core/v1/dnse-credential/`
trong production sẽ `RuntimeError` ⇒ HTTP 500.

Biến duy nhất prod compose inject cho Fernet là `MAIL_CREDENTIAL_FERNET_KEY`
(`docker-compose.prod.yml:99, :154, :236, :271`) — **khác tên, không thay thế được**.

Lưu ý: `docker-compose.prod.yml:319` `VNBROKER_GITHUB_TOKEN` nằm trong block **comment**
(`:312-322` cả khối service backend bị comment) ⇒ không phải secret thật trong prod compose.

### Khuyến nghị

1. Inject `DNSE_CREDENTIAL_FERNET_KEY` vào `docker-compose.prod.yml` **hoặc** tắt route
   legacy + bỏ biến. Không để trạng thái "bật route nhưng thiếu key".
2. Preflight ở entrypoint: thiếu key ⇒ exit 1 với log rõ, **không** fallback sang `SECRET_KEY`.
3. **Không** đặt default Fernet key trong compose (§2.4 cũng áp dụng cho
   `docker-compose.dev.yml:82,127,421,458`).
4. AC: `docker compose -f docker-compose.prod.yml config` fail với message yêu cầu key khi
   env thiếu.

> **Lưu ý phối hợp:** `docker-compose*.yml` nằm trong **deny list** `docs/AGENT_PROTOCOL.md` §2.
> Agent không tự sửa — phải đi qua coordinator, hoặc ghi vào claim `note` và báo coordinator.

---

## 5. Thứ tự thực thi — KHÔNG ĐẢO

```
┌─ BƯỚC 1: REVOKE  (owner, ưu tiên tuyệt đối) ────────────────────┐
│  Revoke [A][B][C][D] trên GitHub                                │
│  Rà soát audit log / token activity                            │
│  ⇒ KHÔNG làm bước 2 trước bước 1. Xoá ở HEAD không làm token   │
│    mất hiệu lực.                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ BƯỚC 2: ROTATE  (owner + backend) ─────────────────────────────┐
│  DNSE_CREDENTIAL_FERNET_KEY  → re-encrypt tool 1 lần trên DB    │
│  CORE_DJANGO_SECRET_KEY, CORE_PAT_PEPPER,                      │
│  CORE_AD_SIGNING_SECRET, DNSE_API_KEY/SECRET,                  │
│  GITHUB_CLIENT_SECRET  → đổi CÙNG LẦN (Fernet hiện derive từ  │
│  SECRET_KEY nên rotate SECRET_KEY = rotate Fernet)              │
│  ⚠ CHẤP NHẬN session/PAT cũ bị vô hiệu → thông báo user trước  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ BƯỚC 3: GỠ KHỎI HEAD  (sau khi 1+2 xong) ─────────────────────┐
│  git rm --cached compose.dev.env ; tạo example sạch            │
│  .gitignore += compose*.env                                    │
│  DOCKER_STARTUP_GUIDE.md / docker-start.ps1 / set-docker-env.ps1│
│    → thay literal bằng biến env                                 │
│  scratch/*.py → đọc GH_TOKEN từ env (hoặc xoá — cần owner)     │
│  test_ai_audit_logs.py:45 → sinh chuỗi, không hardcode          │
│  AC: git grep pattern = 0 secret thật                            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ BƯỚC 4: PURGE HISTORY  (sau khi 3 xong) ──────────────────────┐
│  Backup tag trước                                               │
│  10 commit github_pat_ + 14 commit ghp_ + 15 commit FERNET_KEY  │
│  Dùng công cụ chuyên dụng (BFG / git-filter-repo), KHÔNG tự    │
│  viết script sed                                               │
│  ⇒ Bắt buộc rewrite toàn bộ SHA ⇒ phải force-push + yêu cầu    │
│    mọi người re-clone                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─ BƯỚC 5: NGĂN TÁI DIỄN ───────────────────────────────────────┐
│  Gitleaks (hoặc tương đương) ở PR + push, exit != 0 khi phát   │
│  hiện; allowlist CHỈ cho placeholder test                       │
│  GitHub secret scanning + push protection bật                  │
│  AC: tạo file test chứa token giả → workflow FAIL              │
│  AC: xoá token → workflow PASS                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Cảnh báo về việc chạy song song:** nếu 10 agent đang hoạt động thì **không** purge
> history giữa chừng — sẽ phá worktree và branch của họ. Chờ các agent đóng session
> (`docs/AGENT_PROTOCOL.md` §10.4–10.6) rồi mới purge.

---

## 6. Checklist bàn giao cho owner

Mỗi mục phải tick trước khi coi SEC-01 là đóng:

- [ ] Token `[A] b69d8e77` đã revoke, trả `401/403` khi dùng (output đã redact)
- [ ] Token `[B] 8591126c` đã revoke
- [ ] Token `[C] 6eaab992` đã revoke
- [ ] Token `[D] 8841c239` đã revoke
- [ ] GitHub audit log đã rà soát, kết quả ghi vào báo cáo (không ghi token)
- [ ] `DNSE_CREDENTIAL_FERNET_KEY` đã rotate; số record đọc được trước = sau re-encrypt
- [ ] Key cũ đã ở trạng thái read-only, hẹn thu hồi sau 7 ngày
- [ ] 6 key còn lại trong `compose.dev.env` đã rotate
- [ ] Người dùng đã được thông báo session/PAT cũ bị vô hiệu **trước** khi rotate
- [ ] `git grep` trên HEAD = 0 secret thật (placeholder được allowlist)
- [ ] `git check-ignore -v compose.dev.env` exit 0
- [ ] `compose.dev.env.example` chỉ chứa placeholder `<REQUIRED>`
- [ ] `docker-compose.prod.yml` inject `DNSE_CREDENTIAL_FERNET_KEY` **hoặc** route legacy đã tắt
- [ ] `docker compose -f docker-compose.prod.yml config` fail rõ ràng khi thiếu key
- [ ] Không còn default secret trong `docker-compose*.yml`
- [ ] Gitleaks chạy ở PR + push, exit != 0 khi phát hiện
- [ ] Self-test: file chứa token giả ⇒ workflow đỏ
- [ ] History đã purge (sau khi mọi agent đóng session) — hoặc owner ghi rõ quyết định **không** purge + lý do
- [ ] Tên người phê duyệt + ngày + link tới báo cáo gốc

---

## 7. Sai sót của quá trình verify — minh bạch

1. `git grep -In -E <pattern> -- .` trả **rỗng**, trong khi `git grep -n <pattern>` (không
   pathspec) ra kết quả. Nếu chỉ chạy bản có pathspec sẽ kết luận nhầm
   *"không có secret nào trong repo"* — đây là cách dễ bỏ sót nhất trong phiên này.
2. `rg` không có trong PATH ⇒ 2 lượt grep đầu trả "NO MATCH" sai. Đã chạy lại bằng
   `grep`/`Select-String`; mọi kết luận trong báo cáo dựa trên lượt chạy lại.
3. Phân biệt token thật vs placeholder bằng SHA-256 8 ký tự + độ dài + kiểm tra ký tự lặp.
   Token `[D]` trong test fixture **không phân biệt được** ⇒ xử lý như thật (thiên về an toàn).
4. **Chưa xác minh:** token nào còn hiệu lực, có ai đã dùng nó không, và DB production có
   `UserDNSECredential` thật hay không. Cần owner tra cứu — sub-agent read-only không có
   network tới GitHub/DB production.

---

## 8. Tham chiếu

- `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §0.6, §D1 `P0-SEC-01`, §1.4, §K1
- `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` §4 `U-1`,`U-2`
- `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` §7 `SEC-01`,`SEC-02`,`SEC-03`
- `docs/AGENT_PROTOCOL.md` §2 (deny list: `docker-compose*.yml`, `.env*`; `CLAIMS.md` chỉ append)
- `identity_access/models.py:861-879` (`_get_fernet` / `_decrypt_credential`)
- `identity_access/urls.py:68` (route legacy còn bật)
- `docker-compose.prod.yml:99,154,236,271` (`MAIL_CREDENTIAL_FERNET_KEY` — khác tên)
- `.gitignore:13-45` (thiếu pattern `compose*.env`)
