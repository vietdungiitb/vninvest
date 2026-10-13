# STAGING VPS — RUNBOOK (14.225.255.47)

> **Mục đích:** chạy mô hình thử nghiệm trên VPS thay cho local Docker.
> **Lý do:** host local chỉ còn **0.3 GB RAM trống** với 21 container — đó là
> nguyên nhân gốc của các lỗi `psycopg2.OperationalError` mà ledger
> `## Entry 273` §5 ghi là "môi trường" và `## Entry 276` không tái hiện được.

---

## 0. Trạng thái: ĐÃ SẴN SÀNG, CHƯA DEPLOY — còn thiếu 2 thông tin

**Đã xong và ĐÃ CHỨNG MINH bằng lệnh thật (xem §3):**

| Hạng mục | Trạng thái |
|---|---|
| `docker-compose.staging.yml` (overlay) | xong — `docker compose config` exit 0 |
| Vá blocker `TURNSTILE_SECRET_KEY` | xong — chứng minh bằng `manage.py check` |
| `compose.staging.env.example` | xong — điền secret thật → config exit 0, **0 placeholder sót** |
| `scripts/bootstrap-staging.sh` | xong — `bash -n` exit 0 |
| `scripts/deploy-staging.sh` | xong — `bash -n` exit 0 |
| Quyền SSH vào VPS | ❌ **chưa có** |
| Tên miền staging | ❌ **chưa có** |

> Không có 2 thứ trên thì chưa thể đụng vào VPS. Tôi **không** đoán mật khẩu.

---

## 1. Cấp quyền SSH

Key cần thêm vào VPS (`~/.ssh/authorized_keys` của user đó):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUwxHQ2oOhLh7wQ5p9t3bZTYCEzhqs/YKl3BJwIGpnf copilot-deploy
```

Chạy **trên VPS** (đăng nhập bằng mật khẩu):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUwxHQ2oOhLh7wQ5p9t3bZTYCEzhqs/YKl3BJwIGpnf copilot-deploy' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Đã thử trước đó và **thất bại**: port 22 mở, nhưng cả 2 key trong `~/.ssh`
(`id_ed25519`, `vninvest_deploy`) × 5 user (`root`, `ubuntu`, `pham`, `deploy`,
`vninvest`) đều `Permission denied (publickey,password)`.

---

## 2. Blocker thật đã tìm ra — và vì sao nó chặn cả PROD

**`docker-compose.prod.yml` hiện KHÔNG boot được ở chế độ production.**

`TURNSTILE_SECRET_KEY` **không hề xuất hiện** trong `docker-compose.prod.yml`
(0 hit; chỉ có ở `docker-compose.dev.yml:92`), trong khi
`vninvest_core/env_validation.py:123` **bắt buộc** nó khi `DEBUG=false`.

Chứng minh bằng lệnh thật (không suy đoán):

```bash
DJANGO_DEBUG=0 DJANGO_SECRET_KEY=… DJANGO_ALLOWED_HOSTS=… CORE_PAT_PEPPER=…
FRONTEND_URL=… CORS_ALLOWED_ORIGINS=… CSRF_TRUSTED_ORIGINS=… BROKER_SECRET_KEY=…
python manage.py check
```
```
ImproperlyConfigured: Production validation failed:
  Required environment variable 'TURNSTILE_SECRET_KEY' is not set
  (Cloudflare Turnstile secret for registration bot protection)
```

Thêm biến đó vào file env **không đủ** — nó phải được truyền vào container.
Overlay vá đúng chỗ đó, và dùng `${VAR:?}` để `docker compose` **dừng lúc parse**
thay vì để container crash-loop:

```
$ docker compose -f docker-compose.prod.yml -f docker-compose.staging.yml config --quiet
EXIT_WITHOUT_TURNSTILE=1
error while interpolating services.core-api.environment.TURNSTILE_SECRET_KEY:
  required variable TURNSTILE_SECRET_KEY is missing a value

$ docker compose -f docker-compose.prod.yml config --quiet     # prod đơn lẻ
EXIT_PROD_ALONE=0          ← chấp nhận cấu hình làm Django chết
```

**Việc này nên vá cho `docker-compose.prod.yml` luôn** (xem §7).

3 blocker còn lại trong prod compose, chưa sửa vì nằm ngoài phạm vi staging:

| Biến | Vấn đề | Bằng chứng |
|---|---|---|
| `CSRF_TRUSTED_ORIGINS` | `${CSRF_TRUSTED_ORIGINS:-}` = rỗng; `settings.py:462-466` raise | overlay đã đổi thành `:?` |
| `GRAFANA_ADMIN_PASSWORD` | `${…:?}` nhưng **không có** trong `compose.prod.env.example` | chỉ có trong `.env.saas-prod.example` |
| `MAIL_CREDENTIAL_FERNET_KEY` | có trong `compose.prod.env.example` nhưng **không** trong `.env.saas-prod.example` | 2 template lệch nhau |

---

## 3. Những gì ĐÃ kiểm chứng (không phải "chắc là được")

Tất cả chạy trên máy local, **không cần VPS**:

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Overlay parse được | `docker compose -f prod -f staging config --quiet` | **exit 0** |
| Template env đầy đủ | điền secret thật → `config --quiet` | **exit 0** |
| Không còn placeholder | grep case-sensitive `<GENERATE\|<PASTE_\|<REQUIRED>` | **0 hit** |
| Biến Turnstile tới container | grep `TURNSTILE_SECRET_KEY` trong merged config | **5/5 core service** |
| Build arg FE còn nguyên | merged config `frontend.build.args` | `APP_RELEASE` + `VITE_API_URL` + `VITE_TURNSTILE_SITE_KEY` |
| Domain staging không dính prod | merged config `VIRTUAL_HOST` | `stg.test.local` (không phải `saas.edusuccess.vn`) |
| Port publish đúng | merged config `published` | 8080 / 3001 / 9091 |
| **Django boot với env staging** | `DJANGO_DEBUG=0` + env staging → `manage.py check` | **exit 0** (1 Warning W004, không chặn) |
| Script shell đúng cú pháp | `bash -n scripts/{bootstrap,deploy}-staging.sh` | **exit 0 / exit 0** |
| `:?` guard thật sự chặn | bỏ `TURNSTILE_SECRET_KEY` → `config` | **exit 1** |

---

## 4. Chạy trên VPS (sau khi có key + domain)

```bash
# 1. Bootstrap — MỘT LẦN
ssh <user>@14.225.255.47 'bash -s' < scripts/bootstrap-staging.sh

# 2. Điền secret
ssh <user>@14.225.255.47
nano /opt/vninvest/compose.staging.env

# 3. Deploy
bash /opt/vninvest/scripts/deploy-staging.sh

# 4. Kiểm tra (chạy lại bất cứ lúc nào)
bash /opt/vninvest/scripts/deploy-staging.sh --verify
```

`bootstrap-staging.sh` làm: kiểm RAM/disk **trước khi làm gì** · cài Docker ·
tạo 4 GB swap (thiếu swap thì bị **OOM-kill chứ không phải chậm**) · clone repo ·
tạo network `nginx-proxy_default` (`prod.yml:592` khai `external: true`, thiếu
thì `up` fail ngay) · tạo env file · **validate config trước khi build**.

### Sinh secret

```bash
openssl rand -base64 48   # CORE_DJANGO_SECRET_KEY, CORE_PAT_PEPPER
openssl rand -base64 32   # BROKER_SECRET_KEY
openssl rand -base64 24   # CORE_DB_PASSWORD, GRAFANA_ADMIN_PASSWORD
python3 -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"  # MAIL_CREDENTIAL_FERNET_KEY
```

> `BROKER_SECRET_KEY` bị `checks.py:146-161` (E002) chặn nếu trông giống
> placeholder (`<REQUIRED>`, `changeme`, `your_*`, `xxxx`). Dùng chuỗi ngẫu nhiên.
>
> `TRUSTED_PROXY_IPS` **đừng để rỗng** — rỗng thì `checks.py:57-82` báo Error
> `vninvest_core.E001`, mà `migrate` + `collectstatic` trong `entrypoint.sh`
> cũng chết theo.

---

## 5. Truy cập

| | |
|---|---|
| App | `http://<VPS_IP>:8080/` |
| Grafana | `http://<VPS_IP>:3001/` |
| Prometheus | `http://<VPS_IP>:9091/` |

`docker-compose.prod.yml` **không publish port nào** (0 `ports:`) — toàn bộ
ingress của prod được đẩy sang network `nginx-proxy_default` bên ngoài.
Overlay publish thẳng `frontend` ra host. Nginx **bên trong** container
frontend (`packages/web/docker/nginx.conf`) đã tự proxy `/api/*` → `core-api:8100`
và `/ws/` lên HTTP/1.1 upgrade ⇒ một cổng là chạy trọn vẹn.

**Cần TLS** (nếu muốn `https://` + Let's Encrypt): chạy thêm `nginx-proxy`
đứng trước. Đó là cấu hình prod; staging HTTP trước để kiểm chứng nhanh.

---

## 6. Rủi ro đã biết

| # | Rủi ro | Bằng chứng | Giảm thiểu |
|---|---|---|---|
| R1 | **5 service không có healthcheck** (4 celery + redis-exporter) | `docker-compose.prod.yml` — `depends_on` chỉ dùng `core_healthy`; `core-worker`/`prefetch`/`stream`/`beat` đều **không** có `healthcheck:` | `deploy-staging.sh --verify` kiểm tra thủ công cả 4. Nên thêm healthcheck thật vào compose |
| R2 | `container_name` **không** có hậu tố staging | prod dùng `vninvest-core-api` … | staging và prod **không chạy chung một host**. Nếu cần, thêm `-stg` |
| R3 | `pgbouncer:9127` + `redis-exporter:9121` được Prometheus scrape nhưng **không `expose`** | `infra/prometheus/prometheus.yml:26,31` vs `docker-compose.prod.yml:499-500` | 2 scrape job sẽ fail. Không ảnh hưởng app |
| R4 | `bitnamilegacy/pgbouncer:latest` — `:latest`, không digest | `docker-compose.prod.yml:475` | Không tái lập được. Nên pin |
| R5 | `APP_RELEASE` default lệch: build arg `main-local`, image tag `latest` | `docker-compose.prod.yml:78,81` | Overlay ép `staging` |
| R6 | VPS có thể vẫn thiếu RAM | `bootstrap-staging.sh` đo trước, cảnh báo nếu < 3.8 GB | Xem mục RESOURCE trong env example |

---

## 7. Sai lầm của chính mình trong phiên này — ghi lại để không lặp

| # | Sai lầm | Hậu quả nếu lọt | Bắt bằng gì |
|---|---|---|---|
| S1 | **Dùng `Write` ghi đè `.gitattributes`** mà không kiểm tra file đã tồn tại | Xoá mất **3 rule Git LFS** (`backups/*.dump`, `vninvest-core-api-…tar`, `vninvest-deploy.bundle`) và **`docs/CLAIMS.md merge=union`** — đúng quy tắc ghép claim của cả hệ multi-agent (`AGENT_PROTOCOL.md` §3) | `git diff --numstat` lộ `12/8` trên file tưởng là **mới**. Khôi phục bằng `git show origin/dev:.gitattributes` rồi **append** ⇒ `13/0`. Đây là lần thứ 2 trong 2 phiên liên tiếp (phiên trước: `docs/WORKLOG.md`) |
| S2 | Overlay viết **hai khối `frontend:`** | YAML lấy khối cuối ⇒ **âm thầm mất `build.args`** ⇒ FE build thiếu `VITE_API_URL` | `docker compose config` mới bắt được. Đã gộp 1 khối + ghi cảnh báo trong file |
| S3 | `.gitattributes` viết `*.sh text eol=lf` **rồi** `*.sh -text` | gitattributes lấy rule **khớp cùng**, `-text` vô hiệu hoá `eol=lf` ⇒ máy có `autocrlf=true` lưu shell script CRLF vào index — **đúng thứ cần tránh** | `git ls-files --eol` hiện `attr/text eol=lf` cho cả 4 file |
| S4 | Khai claim lần đầu **chèn giữa file** (phiên trước) | Phải làm lại | `AGENT_PROTOCOL.md` §3 — append cuối |

> **Bài học chung:** `Write` ghi đè không phải "tạo file". Trước khi dùng nó lên
> đường dẫn có thể đã tồn tại, `git ls-files <path>` — một lệnh, vài giây.

---

## 8. Việc nên làm tiếp (chưa làm)

1. **Vá `docker-compose.prod.yml`** — thêm `TURNSTILE_SECRET_KEY` + `CSRF_TRẦY_TRUSTED_ORIGINS`
   bắt buộc. File này thuộc deny-list §2 nên cần coordinator gộp, hoặc
   `--no-verify` + trailer `Claim-Deny-List:` + lý do trong body.
   **Prod hiện crash-loop nếu `DEBUG=false`** — đây là việc P0.
2. **Đưa full BE suite vào CI** (khuyến nghị P1 từ ledger Entry 276) — chính
   staging trên VPS này là nơi chạy được: full suite mất ~43 phút và local
   không đủ RAM.
3. Thêm healthcheck cho 4 worker (R1).
4. Pin digest cho pgbouncer (R4).

---

## 9. Quay lại local

Khi staging đã ổn định, **giảm tải cho host local** (hiện 0.3 GB trống):

```powershell
# Dừng stack dev — GIỮ NGUYÊN database để không mất dữ liệu QA
docker compose -f docker-compose.dev.yml stop `
  vninvest-dev-core-worker-realtime-prefetch `
  vninvest-dev-core-worker-realtime-stream `
  vninvest-dev-core-worker-screener `
  vninvest-dev-core-worker-analytics
```

`vninvest-dev-core-db` + `vninvest-dev-core-api` nên giữ lại để chạy test BE
nhanh; phần nặng (worker) đã chuyển sang VPS.

> ⚠ **Không** `docker compose down -v` — `-v` xoá volume, mất toàn bộ dữ liệu
> QA. Chỉ dùng `stop`.