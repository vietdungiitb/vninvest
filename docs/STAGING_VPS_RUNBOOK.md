# STAGING VPS — RUNBOOK (14.225.255.47)

> **Mục đích:** chạy mô hình thử nghiệm trên VPS thay cho local Docker.
> **Lý do:** host local chỉ còn **0.3 GB RAM trống** với 21 container — đó là
> nguyên nhân gốc của các lỗi `psycopg2.OperationalError` mà ledger
> `## Entry 273` §5 ghi là "môi trường" và `## Entry 276` không tái hiện được.

---

## 0.0 QUICK REFERENCE — môi trường thử nghiệm (DÙNG TỰ ĐỘNG, KHÔNG HỎI LẠI)

> Owner chốt 2026-10-13: **môi trường thử nghiệm của dự án = VPS này, domain
> `docker.edusuccess.vn`.** Mọi việc "chạy thử / test / staging" ⇒ dùng nó.

| Hạng mục | Giá trị |
|---|---|
| **VPS** | `14.225.255.47` (Ubuntu 26.04, Docker + compose) |
| **Tên miền** | `https://docker.edusuccess.vn` → `14.225.255.47` |
| **SSH** | `ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47` |
| **Repo trên VPS** | `/opt/vninvest` (branch `dev`) |
| **Deploy / verify** | `bash scripts/deploy-staging.sh` · `bash scripts/deploy-staging.sh --verify` |
| **Env** | `/opt/vninvest/compose.staging.env` + `compose.nginx-proxy.env` |
| **Reverse proxy** | container `nginx-proxy`, `acme-companion` (KHÔNG prefix `vninvest-`) |
| **Cổng host** | `8080` (app), `3001` (Grafana), `9091` (Prometheus) |
| **Health** | `curl -s http://127.0.0.1:8080/api/core/v1/health` → `{"status":"ok"}` |

---

## 0. Trạng thái: ĐÃ DEPLOY THÀNH CÔNG (2026-10-13) — xem §11

**Đã xong và ĐÃ CHỨNG MINH bằng lệnh thật (xem §3):**

| Hạng mục | Trạng thái |
|---|---|
| `docker-compose.staging.yml` (overlay) | xong — `docker compose config` exit 0 |
| Vá blocker `TURNSTILE_SECRET_KEY` | xong — chứng minh bằng `manage.py check` |
| `compose.staging.env.example` | xong — điền secret thật → config exit 0, **0 placeholder sót** |
| `scripts/bootstrap-staging.sh` | xong — `bash -n` exit 0 |
| `scripts/deploy-staging.sh` | xong — `bash -n` exit 0 |
| `docker-compose.nginx-proxy.yml` (reverse proxy) | xong — `docker compose config` exit 0 (xem §10) |
| `compose.nginx-proxy.env.example` | xong (xem §10) |
| `scripts/deploy-nginx-proxy.sh` | xong — `bash -n` exit 0 (xem §10) |
| Quyền SSH vào VPS | ✅ có — user `root` + 2 key (2026-10-13) |
| Tên miền staging | ✅ `docker.edusuccess.vn` → `14.225.255.47` |

> Không có 2 thứ trên thì chưa thể đụng vào VPS. Tôi **không** đoán mật khẩu.

> **Cập nhật 2026-10-13:** đã có SSH (`root`) và domain (`docker.edusuccess.vn`),
> deploy thành công, `--verify` PASS. 3 blocker mới tìm được khi chạy thật →
> §11. Trong đó **B1 + B2 làm cả PROD chết** (nằm trong `docker-compose.prod.yml`
> deny-list) ⇒ **P0 cho coordinator**.

---

## 1. Cấp quyền SSH

Cần thêm **public key** vào `~/.ssh/authorized_keys` của user sẽ dùng để deploy.
Hai key của repo:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUwxHQ2oOhLh7wQ5p9t3bZTYCEzhqs/YKl3BJwIGpnf copilot-deploy
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE3VIUMcFWAfu6TS71160Tp73D7MBrjC7h1MylJnPvdj vninvest-deploy-2026
```

### Cách A — script (khuyến nghị)

`scripts/vps-authorize-key.sh` chạy **trên VPS**, idempotent (key đã có thì không
thêm lại), tự tạo `~/.ssh` với quyền đúng, không đọc private key nào.

Mở **web console** của nhà cung cấp VPS (đăng nhập bằng mật khẩu), rồi dán:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && \
for k in \
 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUwxHQ2oOhLh7wQ5p9t3bZTYCEzhqs/YKl3BJwIGpnf copilot-deploy' \
 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE3VIUMcFWAfu6TS71160Tp73D7MBrjC7h1MylJnPvdj vninvest-deploy-2026' ; do \
 grep -qF -- "$k" ~/.ssh/authorized_keys || echo "$k" >> ~/.ssh/authorized_keys ; done && \
chmod 600 ~/.ssh/authorized_keys && echo "OK: $(grep -c . ~/.ssh/authorized_keys) key"
```

Hoặc copy cả file script lên VPS rồi chạy:

```bash
bash vps-authorize-key.sh              # thêm 2 key của repo cho user hiện tại
bash vps-authorize-key.sh --user ubuntu
sudo bash vps-authorize-key.sh --harden   # thêm key rồi TẮT password auth (đọc kỹ cảnh báo)
bash vps-authorize-key.sh "ssh-ed25519 AAAA... me@laptop"   # thêm key riêng
```

### Cách B — xác minh từ Windows

`scripts/vps-ssh-check.ps1` tự thử mọi key trong `~/.ssh` × vài user phổ biến và
chỉ ra tổ hợp nào vào được:

```powershell
pwsh -File scripts/vps-ssh-check.ps1
pwsh -File scripts/vps-ssh-check.ps1 -User ubuntu
```

### Đã thử trước đó và **thất bại** (2026-10-13)

Port 22 mở, nhưng cả 2 key trong `~/.ssh` (`id_ed25519`, `vninvest_deploy`) × 5
user (`root`, `ubuntu`, `pham`, `deploy`, `vninvest`) đều
`Permission denied (publickey,password)` ⇒ **chưa có key nào được cấp quyền**.
Phải thêm key ở trên (qua web console) trước khi `deploy-staging.sh` chạy được.

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

Sau khi có tầng proxy (§10), **mọi port publish của app chỉ bind loopback** —
duy nhất `nginx-proxy` (80/443) là công khai.

| | |
|---|---|
| App (công khai) | `https://<STAGING_DOMAIN>/` |
| App (trên VPS) | `http://127.0.0.1:8080/` |
| Grafana | SSH tunnel: `ssh -L 3001:127.0.0.1:3001 <user>@14.225.255.47` → `http://127.0.0.1:3001/` |
| Prometheus | SSH tunnel: `ssh -L 9091:127.0.0.1:9091 <user>@14.225.255.47` → `http://127.0.0.1:9091/` |

`docker-compose.prod.yml` **không publish port nào** (0 `ports:`) — toàn bộ
ingress của prod được đẩy sang network `nginx-proxy_default` bên ngoài.
Overlay publish `frontend` ra host nhưng **chỉ loopback**. Nginx **bên trong**
container frontend (`packages/web/docker/nginx.conf`) đã tự proxy `/api/*` →
`core-api:8100` và `/ws/` lên HTTP/1.1 upgrade ⇒ một cổng là chạy trọn vẹn.

**TLS + đa domain**: dùng `nginx-proxy` + `acme-companion` — xem §10.

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

1. **Vá `docker-compose.prod.yml`** — thêm `TURNSTILE_SECRET_KEY` + `CSRF_TRUSTED_ORIGINS`
   bắt buộc, **sửa `pgbouncer` healthcheck** (`pg_isready` không có trong image —
   §11 B1) và **đặt `PGBOUNCER_DATABASE`** khớp URL `/vninvest_core` (§11 B2).
   File này thuộc deny-list §2 nên cần coordinator gộp, hoặc
   `--no-verify` + trailer `Claim-Deny-List:` + lý do trong body.
   **Prod hiện crash-loop nếu `DEBUG=false`, và core-api không nối được pgbouncer** — P0.
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

---

## 10. Reverse proxy đa domain + TLS (nginx-proxy + acme-companion)

### Vì sao cần

Repo chỉ có **app**. `docker-compose.prod.yml:592` khai network
`nginx-proxy_default` là `external: true` và `:561-564` set `VIRTUAL_HOST` cho
frontend — tức app **đã được viết sẵn** để nằm sau một nginx-proxy, chỉ thiếu
đúng cái proxy. Chưa có nó thì không có `https://` và không thêm được domain
thứ hai mà không sửa tay nginx.

### Thành phần (3 file mới)

| File | Vai trò |
|---|---|
| `docker-compose.nginx-proxy.yml` | `nginx-proxy` (80/443) + `acme-companion`, dùng chung network `nginx-proxy_default` |
| `compose.nginx-proxy.env.example` | Template env — chỉ **1 biến bắt buộc**: `LETSENCRYPT_EMAIL` |
| `scripts/deploy-nginx-proxy.sh` | Deploy/`--verify`, idempotent, tạo network nếu thiếu |

Image **pin cả tag lẫn digest** (`nginxproxy/nginx-proxy:1.11.6`,
`nginxproxy/acme-companion:2.8.2`) — không dùng `:latest` (rủi ro R4).

### Cách hoạt động: label-based, đa domain

`nginx-proxy` mount `/var/run/docker.sock` (ro) nên **tự đọc label/env** của
mọi container trên network chung:

| Biến trên service app | Ý nghĩa |
|---|---|
| `VIRTUAL_HOST` | domain phục vụ (vd `staging.vietdungiitb.vn`) |
| `VIRTUAL_PORT` | cổng nội bộ container nghe |
| `LETSENCRYPT_HOST` | domain xin cert (thường = `VIRTUAL_HOST`) |
| `LETSENCRYPT_EMAIL` | email hết hạn cert |

Staging đã khai đủ 4 biến này trong `docker-compose.staging.yml` (frontend).
**Thêm domain mới = thêm container có 4 biến đó**, không sửa file proxy.

### Trình tự deploy

```bash
# 1. (đã làm ở §4) bootstrap -> tạo network nginx-proxy_default
ssh <user>@14.225.255.47 'bash -s' < scripts/bootstrap-staging.sh

# 2. Proxy — MỘT LẦN
ssh <user>@14.225.255.47
cd /opt/vninvest
cp compose.nginx-proxy.env.example compose.nginx-proxy.env
nano compose.nginx-proxy.env          # đặt LETSENCRYPT_EMAIL
bash scripts/deploy-nginx-proxy.sh

# 3. App (join network -> vhost + cert tự sinh)
bash scripts/deploy-staging.sh

# 4. Kiểm tra lại bất cứ lúc nào
bash scripts/deploy-nginx-proxy.sh --verify
```

### Yêu cầu trước khi cert xin được

1. **DNS** của `<STAGING_DOMAIN>` trỏ về `14.225.255.47` (A record).
2. **Port 80 + 443** mở trên firewall VPS và **không bị container khác giữ**.
3. Let's Encrypt giới hạn **5 cert/domain/tuần** — thử nghiệm vòng xin cert
   thì đặt `ACME_CA_URI=https://acme-staging-v02.api.letsencrypt.org/directory`
   trong `compose.nginx-proxy.env` (cert staging không được tin, chỉ để test).

### Đã kiểm chứng (local, không cần VPS)

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Proxy compose parse | `docker compose -f docker-compose.nginx-proxy.yml config --quiet` | **exit 0** |
| 2 service + network external | `config` | `nginx-proxy`, `acme-companion`, network `nginx-proxy_default` external |
| `:?` guard thật sự chặn | bỏ `LETSENCRYPT_EMAIL` → `config` | **exit 1** |
| Script đúng cú pháp | `bash -n scripts/deploy-nginx-proxy.sh` | **exit 0** |

### Còn thiếu (blocker deploy trên VPS)

- **SSH** vào VPS (§1) — chưa có key trong `authorized_keys`.
- **Tên miền** + DNS trỏ về VPS.

⇒ Hai thứ trên là của Owner; không có thì **không thể** chạy bước 2–4 ở trên.

---

## 11. Deploy thật trên VPS — 2026-10-13 (THÀNH CÔNG) + 3 blocker chỉ hiện khi chạy

Stack chạy thật trên `14.225.255.47`; `deploy-staging.sh --verify` **PASS**:

```
https://docker.edusuccess.vn/            → 200
http://docker.edusuccess.vn/             → 301 → https
cert: subject=CN=docker.edusuccess.vn  issuer=Let's Encrypt  2026-10-13 → 2027-01-11
curl http://127.0.0.1:8080/api/core/v1/health → {"status":"ok",...}
13/13 container chạy · 4 healthy (core-api, core-db, core-redis, pgbouncer)
```

Ba lỗi **không thể phát hiện bằng `docker compose config`** (config chỉ
interpolate biến — không bao giờ chạy container):

| # | Lỗi | Bằng chứng | Vá ở đâu |
|---|---|---|---|
| **B1** | `pgbouncer` healthcheck gọi `pg_isready`, nhưng binary **không có** trong `bitnamilegacy/pgbouncer` (`command -v pg_isready` → missing; chỉ có `psql` + `pgbouncer`) ⇒ `unhealthy` vĩnh viễn ⇒ `depends_on: service_healthy` chặn toàn bộ core-api/worker | `docker inspect` health log: `ExitCode 1` · `"/bin/sh: 1: pg_isready: not found"` | overlay: đổi test sang `psql … -tAc 'SELECT 1'` |
| **B2** | `[databases]` của Bitnami pgbouncer đặt **tên client** = `${PGBOUNCER_DATABASE}` (mặc định `postgres`), KHÔNG phải `${POSTGRESQL_DATABASE}` (tên backend). URL `…@pgbouncer:6432/vninvest_core` ⇒ `FATAL: no such database: vninvest_core` | container thật: `postgres=host=core-db port=5432 dbname=vninvest_core` · nguồn `/opt/bitnami/scripts/pgbouncer-env.sh:123` + `libpgbouncer.sh:228-237` | overlay: `PGBOUNCER_DATABASE: vninvest_core` |
| **B3** | `CORE_ALLOWED_HOSTS` chỉ chứa domain ⇒ healthcheck `curl http://127.0.0.1:8100/core/v1/health` và Prometheus scrape `/metrics/` nhận **HTTP 400 `DisallowedHost`** ⇒ core-api `unhealthy` | log: `Invalid HTTP_HOST header: '127.0.0.1:8100'` / `'core-api:8100'` | env: thêm `,127.0.0.1,localhost,core-api` |

**⚠ B1 + B2 nằm trong `docker-compose.prod.yml` (dòng 495 và 475) — file deny-list.
Nghĩa là `docker-compose.prod.yml` MỘT MÌNH cũng hỏng: PROD cũng chết y hệt.**
Staging đã vá qua overlay (`docker-compose.staging.yml`); **prod thì chưa** ⇒ P0.

Thứ tự đã sửa để boot được: B2 (alias) → B1 (healthcheck) → B3 (ALLOWED_HOSTS).
Sửa đúng thứ tự này vì `up -d` dừng ở service unhealthy đầu tiên.

Đã kiểm chứng bổ sung trong lúc điều tra (chạy trong container thật):

```
$ docker exec vninvest-pgbouncer sh -c 'PGPASSWORD=$POSTGRESQL_PASSWORD \
    psql -h 127.0.0.1 -p 6432 -U vninvest -d postgres -tAc "SELECT 1"'
1        ← alias `postgres` THÔNG (auth + backend OK) ⇒ chỉ sai TÊN alias
```

---

## 12. QUY ĐỊNH BẮT BUỘC: mọi test BE/FE chạy trên VPS staging (Owner chốt 2026-10-14)

> **Lý do:** host local cạn RAM (0.3 GB trống, Entry 273) ⇒ suite test local cho kết
> quả giả (OOM, `OperationalError`). **Cấm chạy suite test trên host local — kể cả
> bằng container dùng-một-lần local** (container local vẫn ăn RAM host).

### 12.1 PHẢI chạy trên VPS

| Lệnh | Ghi chú |
|---|---|
| `manage.py test` (mọi scope: file/app/full) | DB tạm riêng trên `vninvest-core-db`, xem §12.3 |
| `npm run test*` / `test:components` (FE) | `npm ci` một lần trên VPS rồi giữ `node_modules` (không commit); xem §12.4 |
| `npm run build` (vite) | RAM-heavy — cấm local |
| Playwright / E2E | cấm local |

### 12.2 ĐƯỢC chạy local (nhẹ, không RAM/DB)

`manage.py check` · `makemigrations --check` · `ruff` · `eslint` · `tsc --noEmit` ·
`docker compose config` · `bash -n` · grep/read. Viết code + review diff ở local bình
thường; chỉ **thực thi suite** là phải lên VPS.

### 12.3 Quy trình BE trên VPS (container dùng-một-lần + DB tạm, xoá sau chạy)

```bash
# 0. Push nhánh slice lên origin (từ máy local)
git push origin feat/<slice>

# 1. Trên VPS: worktree tạm (KHÔNG checkout đè /opt/vninvest đang chạy staging)
cd /opt/vninvest && git fetch origin feat/<slice> \
  && git worktree add /tmp/wt-<slice> origin/feat/<slice>

# 2. DB tạm riêng trên vninvest-core-db (lấy pass từ compose.staging.env, KHÔNG in ra)
PW=$(grep -E '^POSTGRES_PASSWORD=' /opt/vninvest/compose.staging.env | cut -d= -f2-)
docker exec vninvest-core-db psql -U vninvest -d vninvest_core \
  -c "CREATE DATABASE <db_tam>;"   # vd db_tam=mbw0_b01

# 3. Chạy test bằng image staging (deps đã bake), mount code nhánh đè /app,
#    --entrypoint python để BỎ QUA entrypoint.sh (migrate/collectstatic)
docker run --rm --network vninvest-staging_vninvest_network \
  -v /tmp/wt-<slice>/packages/core/backend:/app \
  -e CORE_DATABASE_URL="postgresql://vninvest:${PW}@vninvest-core-db:5432/<db_tam>" \
  -e DJANGO_DEBUG=1 \
  --entrypoint python vninvest-core-api:staging \
  manage.py test <test_labels> --noinput

# 4. Dọn (BẮT BUỘC, kể cả khi test đỏ)
docker exec vninvest-core-db psql -U vninvest -d vninvest_core \
  -c "DROP DATABASE <db_tam>;"
cd /opt/vninvest && git worktree remove --force /tmp/wt-<slice> \
  && git worktree prune
```

> Image `vninvest-core-api:staging` bake code cũ — volume mount đè `/app` nên test
> chạy đúng code nhánh. Slice nào đổi dependency (`requirements.txt` — deny-list) thì
> phải build image test riêng, không dùng image staging.

### 12.4 Quy trình FE trên VPS (CHƯA KIỂM CHỨNG — lần đầu ở Wave 2)

```bash
# Một lần duy nhất (giữ node_modules trên VPS, không commit vào repo)
cd /opt/vninvest/packages/web && npm ci
# Mỗi lần test:
npm run test:components -- <file>   # hoặc npm run test -- <pattern>
```

> Chưa có `node_modules` trên VPS (kiểm 2026-10-14) nên đường này **chưa từng chạy**.
> Slice FE đầu tiên phải chạy thử + sửa § này theo thực tế, không đoán.

### 12.5 Báo cáo

Mọi báo cáo gate ghi rõ **chạy ở đâu** (VPS + tên DB tạm), exit code, và `CHƯA CHẠY`
cho thứ chưa chạy được. Chạy suite ở local rồi báo PASS = vi phạm quy định này.