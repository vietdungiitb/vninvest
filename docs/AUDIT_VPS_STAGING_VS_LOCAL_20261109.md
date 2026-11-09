# Audit: Local (dev) vs VPS staging — 2026-11-09

- **Scope**: Tinh trang repo local + doi chieu code tren VPS staging
- **Date**: 2026-11-09. Local `D:\Mujoco Projects\vninvest` (branch `dev`), VPS `root@14.225.255.47:/opt/vninvest` (SSH key auth, BatchMode)
- **Ket luan 1 dong**: Local `dev` @ `26e44d203` sach; staging chay `dev` @ `5f9422694` (tre 16 commits) + hotfix ngoai-git da biet (Entry 423); **P0 moi: 4 workers + beat crash-loop tu luc deploy (RestartCount 1486/837) do `redis-py 5.3.1` vs kombu yeu cau `>=6.1.0` — root la `requirements.txt:9` pin `redis>=5.0,<6.0`.**

## 0. Hieu chinh host (quan trong)

`saas.edusuccess.vn` va `14.225.255.47` la **CUNG 1 may** (hostname `edusuccess-xyjn`, cung `/opt/vninvest`, cung HEAD + cung dirty state). Moi evidence duoi day lay qua SSH `14.225.255.47` theo `docs/STAGING_VPS_RUNBOOK.md:19-20`. Chuẩn staging: repo `/opt/vninvest` branch `dev`, deploy bang `scripts/deploy-staging.sh`, health `http://127.0.0.1:8080/api/core/v1/health`.

## 1. Trang thai local (xac minh truc tiep)

| Muc | Thuc te |
|---|---|
| Branch | `dev` (da roi khoi `main` chet — xem §4 C0), working tree sach ngoai tru 1 file audit untracked nay |
| HEAD | `26e44d203` — Merge PR #308, date 2026-11-08 23:38 +0700 = `origin/dev` (fetch + `ls-remote` khop) |
| Remote branches | `origin/dev`, `origin/main`, `feat/*`, `license-portal-lp1` — KHONG co `enterprise` |

## 2. Trang thai VPS staging (qua SSH, khong doc gia tri secret)

| Muc | Thuc te |
|---|---|
| Branch/HEAD | `dev` @ `5f9422694` — Merge PR #304, date 2026-11-08 21:24 +0700 |
| Do tre | `5f9422694` la ancestor cua `origin/dev`; `rev-list --count` = **16 commits** (PR #305–#308). Dang chu y: `205867b84` license-portal LP1 backend (model + 7 views + routes) staging chua co |
| Dirty (tracked) | `M docker-compose.staging.yml` — diff 1 file, 5 insertions: them `CORE_AD_SIGNING_SECRET: ${...:?...}` vao 5 services (`core-api`, `core-worker`, `realtime-prefetch`, `realtime-stream`, `beat`) |
| Untracked | `.add-ad-signing-secret.py` (22 dong), `.dbg-compose.py` (6 dong), `backups/staging_pre_redeploy_20261015_204856.dump`, `compose.staging.env.bak.1791899801`, `docker-compose.staging.yml.bak.20261108` |
| Secret trong git? | 0 match trong `origin/dev:docker-compose.staging.yml`, `5f9422694:...`, `origin/dev:compose.staging.env.example` → hotfix hoan toan ngoai-git. NHUNG da duoc document trong ledger **Entry 423** (deploy Nov-08 FAIL thieu secret → them tay + backup `.bak`, deploy PASS + `--verify` PASS) |
| Env key (dem so dong) | `compose.staging.env` (0600) co 1 dong `CORE_AD_SIGNING_SECRET=`; file `.bak` Oct-13 co 0 dong |
| Health API | `curl http://127.0.0.1:8080/api/core/v1/health` → `{"status":"ok","package":"vninvest-core",...}` — core-api song |
| Containers | `vninvest-core-api` healthy (Up 12h, RestartCount 0), `vninvest-frontend` Up 12h, db/redis/pgbouncer healthy, proxy/acme Up 10d |

## 3. P0: Workers crash-loop — root cause da trace (NEW)

| Muc | Evidence |
|---|---|
| Hien tuong | 2 lan `docker ps` cach nhau ~15 phut deu thay 4 workers + beat uptime < 1 phut. `docker inspect`: `vninvest-core-worker` **RestartCount=1486**, `vninvest-core-beat` **RestartCount=837**, api = 0. Loop lien tuc tu deploy Nov-08 (~12h × 1486 lan ≈ 30s/lan) |
| Loi | `docker logs vninvest-core-worker`: `kombu.exceptions.VersionMismatch: Redis transport requires redis-py versions 6.1.0 or later. You have 5.3.1` |
| Root (code) | `packages/core/backend/requirements.txt:9` pin **`redis>=5.0,<6.0`** trong khi `packages/core/pyproject.toml:19` cho `celery>=5.4,<6.0` keo kombu moi doi `redis-py>=6.1.0`. Transitive dep khong pin → drift |
| Tai sao api song? | api (gunicorn/Django) khong import kombu redis transport luc boot; chi worker/beat (celery) crash |
| Tai sao Entry 423 bao PASS? | `--verify` PASS voi "0 dead container" — container restart-loop hien `Up`, khong phai dead → verify khong bat duoc. Gap trong verify |
| Dev moi nhat? | `git log 5f9422694..HEAD -- '*requirements*'` = rong → **16 commits thieu khong cham requirements → pull len `26e44d203` KHONG sua workers.** Can bump `redis>=6.1.0` (kiem channels-redis tuong thich) + rebuild image. `requirements.txt` thuoc deny-list → can coordinator, KHONG tu sua o phien nay |

## 4. CONTRADICTIONS (doc vs code)

| # | Doc (file:line) | Thuc te (evidence) | Impact |
|---|---|---|---|
| C0 | (gia dinh cu) local `main` so sanh duoc staging | `main` @`9e49ea5f9` (PR #37, Sep-27), `merge-base origin/main origin/dev` exit!=0 → khong chung lich su. Da chuyen local sang `dev` | Moi diff local(main)↔VPS truoc day vo nghia; audit nay dung local `dev` |
| C1 | `scripts/deploy-remote.ps1:9` default `-Branch "enterprise"`; `scripts/deploy-server.sh:20` | Branch `enterprise` KHONG ton tai (`git branch -r` + VPS). Staging chay `dev` | Script mac dinh chay vao nhanh khong ton tai |
| C2 | `DEPLOY_DOCKER_EDUSUCCESS.md:184-188` flow `checkout main; pull origin main` | Staging checkout `dev`; `main` la nhanh chet | Doc deploy lech staging; runbook moi (`STAGING_VPS_RUNBOOK.md`) moi la chuan |
| C3 | `deploy-staging.sh --verify` PASS (Entry 423) | Workers loop tu luc deploy, verify khong phat hien (container restarting ≠ dead) | Can bo sung check RestartCount/uptime vao `--verify` |

## 5. Findings tom tat

- **[F1] P0 — workers crash-loop (NEW, chua ai ghi).** `requirements.txt:9` vs kombu. Can coordinator bump redis + rebuild image staging. Tam thoi staging chi co api+frontend song, moi tac vu celery/beat chet.
- **[F2] RISK — hotfix secret ngoai-git (DA BIET, Entry 423).** Wire + value chi tren server. Pull sau neu upstream cham `docker-compose.staging.yml` → conflict. Can commit phan wire (khong value) qua coordinator (compose file deny-list).
- **[F3] GAP — staging tre 16 commits.** Thieu LP1 backend + gates fix. Nhung pull khong sua F1.
- **[F4] Thieu — deploy scripts + doc cu.** Default branch `enterprise` khong ton tai; doc cu chi `main`.
- **[F5] Rac ops tren server.** 2 script `.py` root + 2 `.bak` + dump cu. Khong anh huong runtime; don sau khi F2 xong.

## 6. De xuat (uu tien)

1. P0: coordinator bump `redis>=6.1.0` trong `packages/core/backend/requirements.txt:9` (verify `channels-redis:23` tuong thich) → rebuild `vninvest-core-api:staging` → `deploy-staging.sh` → kiem tra `RestartCount=0` + uptime on dinh.
2. P0: bo sung vao `deploy-staging.sh --verify`: fail neu bat ky service nao `RestartCount>0` hoac uptime < 5 phut (tru service vua deploy co chu dich).
3. P1: commit wire `CORE_AD_SIGNING_SECRET` (khong value) + key rong vao `compose.staging.env.example`; tren VPS `git stash` hotfix truoc khi pull de tranh conflict.
4. P1: sua default branch `enterprise` → `dev` trong 2 deploy scripts; archive hoac danh dau `main` la stale.
5. P2: pull staging len `26e44d203` (lay LP1 + gates) sau khi F1 xong; xoa file `.bak`/script tam.

## 7. Validation da chay (thuc te)

- Local: `git status -sb`, `git log -5`, `git branch -r`, `git merge-base` (exit!=0), `git rev-list --count 5f9422694..origin/dev` (=16), `git diff --stat 5f9422694..HEAD` (27 files, +1046/-26), `git show <rev>:<file>` + Select-String (=0 match secret), `git log -- '*requirements*'` (rong).
- VPS staging (SSH 14.225.255.47): `git status -sb`, `git log -5`, `git diff --stat`, `git stash list` (rong), `git worktree list` (1), `ls -la compose.*`, `grep -c '^KEY='` (chi dem), `git ls-remote origin dev` (=`26e44d203`), `curl` health (`status:ok`), `docker ps` (22 containers), `docker inspect | grep RestartCount/StartedAt`, `docker logs --tail` worker (traceback kombu).

## 8. Cau hoi can owner/coordinator chot

- Duyet bump `redis>=6.1.0` + rebuild image staging khi nao? (F1 — block moi tac vu celery tren staging)
- `main` co archive khong, hay giu lam gi? (de tranh phien sau lai so nham nhanh chet)
- Staging co nghiem thu LP1 khong? (quyet dinh muc gap pull PR #306)
