# Đo lường — rà soát handoff WS502 + baseline tiếp tục (2026-11-15)

> **Phạm vi:** trạng thái `dev`, staging VPS `14.225.255.47`, log nginx, quality gates máy local.
> **Thời điểm đo:** 2026-11-15 06:17–06:30 UTC (13:17–13:30 giờ VN).
> **Máy đo:** Windows, repo `D:/Mujoco Projects/vninvest`, không Docker local (đúng quy tắc).
> **Mục đích:** thay thế niềm tin vào văn bản handoff bằng số đo tái hiện được.

---

## 1. Môi trường

| Mục | Giá trị | Lệnh |
|---|---|---|
| Local HEAD | `54a401b80` | `git rev-parse dev` |
| origin/dev | `54a401b80` | `git rev-parse origin/dev` |
| Working tree | sạch | `git status --short` |
| VPS HEAD | `7a0bd7aa7` | `ssh … 'cd /opt/vninvest && git log --oneline -1'` |
| VPS ↔ local | 5 commit, **toàn bộ là docs** | `git diff --name-only 7a0bd7aa7..54a401b80` |
| Giờ VPS (UTC) | `Sun Nov 15 06:19:13 UTC 2026` | `date -u` |

5 commit VPS thiếu (đều docs): `docs/AGENT_PROTOCOL.md`, `docs/CLAIMS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/handoffs/HANDOFF_2026-11-15_WS502-DASHBOARD.md`. ⇒ **Không cần deploy** để chạy tiếp.

---

## 2. Log nginx — token trong query string

Lệnh gốc (chạy trên VPS):

```bash
docker logs nginx-proxy --since <W> 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -c 'token='
docker logs nginx-proxy --since <W> 2>&1 | grep -o 'GET /[^ ]*token=' | sed 's/GET //' | sort | uniq -c
```

| Cửa sổ | `token=` | `ticket=` | 502 |
|---|---|---|---|
| 15 phút | 1 | 0 | – |
| 30 phút | 1 | – | 0 |
| 1 giờ | 1 | 0 | 0 |
| 6 giờ | 26 | 0 | 4 |
| 24 giờ | 283 | 17 | 108 |

**Theo path (24h):**

```
277 /ws/realtime/?
  6 /core/v1/signals/alert-center/stream/?lane=main&
```

**Mốc thời gian quan trọng:**

| Sự kiện | Thời điểm (UTC) | Bằng chứng |
|---|---|---|
| Commit sửa WS sang ticket | `5d22118a6` (2026-11-15) | `git log -1 -S "ticket=" -- packages/web/src/hooks/useRealtimeFeedCore.js` |
| Container frontend được tạo | `2026-11-15T02:42:00Z` | `docker inspect vninvest-frontend --format '{{.Created}}'` |
| Hit `?token=` cuối trên `/ws/realtime/` | `15/Nov/2026:01:52:54Z` | `grep 'ws/realtime/?token=' \| tail -1` |
| Hit `?token=` trên alert-center | `15/Nov/2026:06:21:18Z` | `grep 'alert-center/stream/.*token=' \| tail -1` |
| 502 cuối cùng | `15/Nov/2026:01:39:39Z` | `grep ' 502 ' \| tail -1` |

**Kết luận có kiểm chứng:**
- `/ws/realtime/?token=` **đã dừng trước rebuild**, không có hit nào sau `02:42Z`.
- `/core/v1/signals/alert-center/stream/…&token=` **vẫn đang xảy ra sau rebuild** ⇒ lỗ rò hiện hành.

**Số token khác nhau trong 24h:** 23 (đếm theo tiền tố `token=vni_internal_` + 6 ký tự). Không ghi giá trị đầy đủ vào tài liệu.

---

## 3. Bundle đang phục vụ

```bash
docker exec vninvest-frontend sh -lc 'f=/usr/share/nginx/html/assets/hooks-BCiCY1L_.js; grep -o "realtime/?[a-z]*=" $f | sort | uniq -c'
```

```
3 realtime/?ticket=
```

- `token=` trong chunk: **0**.
- Service worker: **không có** (`NO_SW`) ⇒ không có precache giữ bundle cũ.
- `cache-control` cho asset: `no-store, no-cache, must-revalidate, max-age=0` ⇒ không phải cache HTTP giữ bản cũ.

⇒ Nguồn `?token=` còn lại **không phải** bundle cũ của web; nó là **code hiện tại** ở đường SSE (`useAlertCenterStream.ts`) và/hoặc client khác (mobile `packages/mobile/src/services/realtime.ts:19`).

---

## 4. 502 — tách theo vhost/path trước khi kết luận

Số 502 theo giờ (6h gần nhất):

```
1 [15/Nov/2026:00
3 [15/Nov/2026:01
```

- 0 502 trong 1h gần nhất.
- 4 502 trong 6h, **tất cả trước 01:39Z**.
- 108 502/24h gồm cả vhost khác dùng chung `nginx-proxy` (`edusuccess.vn`, `/api/method/frappe.*`). **Không phải toàn bộ là lỗi vninvest.**

Bài học L-G04 áp dụng: con số 108 là **số dòng log khớp mẫu**, không phải "108 lỗi của sản phẩm".

---

## 5. Tài nguyên VPS

```bash
git worktree list        # /opt/vninvest, /tmp/wt-gatep0 (detached e59298e1c), /tmp/wt-gatep0-fix (a972fd040)
psql -lqt                # ai_r42 ai_r43 ai_r51 ai_r52 ai_r53 + vninvest_core
df -h /                  # 91G/116G = 79%
git status --short       # ?? compose.staging.env.bak-20261114
docker ps --filter name=vninvest   # 13 container, 0 restart
```

- `/tmp/wt-gatep0` tạo `Nov 13 18:58`, không có process `manage.py test` đang chạy (đếm = 0).
- `vninvest-core-api` healthy; health qua nginx = **200**.

---

## 6. Quality gates (local, 2026-11-15)

`node scripts/pre-push-gate.mjs` → **5 FAIL / 31 PASS / 0 SKIP** (exit 1).

| Cổng | Kết quả | Nguyên nhân đo được |
|---|---|---|
| `system-design` | FAIL | `freshness-report.md:12` ghi 137; gate đếm 138; thực tế 139 (xem §7) |
| `global-config-drift` | FAIL | 4 file `tools/opencode-global/*` lệch bản deploy |
| `admin-ux` | FAIL | `python` = Microsoft Store stub → "Python was not found" |
| `envelope-contract` | FAIL | cùng lý do |
| `openapi-budget` | FAIL | probe `import django` không nhận ra interpreter thiếu ⇒ chạy checker bằng stub |

Các cổng quan trọng **PASS**: `tsc --noEmit` (0 lỗi), `check-multi-agent`, `check-ai-cc`, `lessons` (60/60), `i18n-strict`, `audit-status`, `admin-routes`, toàn bộ `ui-check-*`, `preflight-*`.

**CHƯA CHẠY có lý do (không phải PASS):**
- `ui-check-theme-contrast`, `ui-check-a11y-runtime`: staging đang chạy build khác baseline (`adapters-D0NzdBiI.js` ≠ `adapters-B64GAyed.js`) ⇒ gate tự báo `CHUA CHAY`.
- Full FE suite / full BE suite: **chưa chạy** sau chuỗi WS502 (xem plan C-07/C-08).

**Python:** `Get-Command python` → `C:/Users/<user>/AppData/Local/Microsoft/WindowsApps/python.exe` (stub). Không có `packages/core/backend/.venv` và không có `.venv` ở root repo (đã kiểm bằng `Get-ChildItem -Recurse -Depth 4`).

---

## 7. Đếm migration — 3 con số khác nhau

| Nguồn | Số | Cách đếm |
|---|---|---|
| `docs/system-design/_meta/freshness-report.md:12` | **137** | ghi tay |
| `check-system-design.mjs:146` | **138** | regex `/migrations/0[^/]*\.py` |
| Đếm thủ công | **139** | `Get-ChildItem src/*/migrations/*.py` trừ `__init__.py` |

Chênh lệch 1 file: `packages/core/backend/src/identity_access/migrations/9000_auth_user_email_ci_unique.py` (có `class Migration` ở dòng 75). Regex `^0` **bỏ sót** file này.

⇒ Sửa doc 137 → 138 là **vẫn sai**; phải sửa regex (C-05).

---

## 8. Đối chiếu handoff ↔ đo được (CONTRADICTIONS)

| Handoff nói (`file:line`) | Đo được | Kết luận |
|---|---|---|
| `HANDOFF_2026-11-15_WS502-DASHBOARD.md:29-30` "log chỉ còn `?ticket=`" | Đúng cho `/ws/realtime/`; **sai** cho `/core/v1/signals/alert-center/stream/` | **Đúng một phần** — bỏ sót đường SSE |
| `HANDOFF…:31` "revoke PAT `BqJaKW`" | 23 PAT khác nhau trong 24h | **Thiếu phạm vi** — không chỉ 1 token |
| `HANDOFF…:32` "AI panel timeout 10s — ticket riêng" | `AIAdvisorAlertPanel.js:67-68` đã có | **Stale** — đã xong, không làm lại |
| `HANDOFF…:33-34` "1-2 502 khi cold load" | 0 trong 1h, 4 trong 6h đều trước 01:39Z | **Khớp** |
| `MASTER_TRACKING_2026Q4.md` header "34 PASS / 0 FAIL @ 91bad0440" | 31 PASS / 5 FAIL | **Sai sự thật** — cần refresh |
| `docs/PLAN_REMAINING_WORK_20261113.md:61-65` "S4.1–S4.5 CHƯA LÀM" | S4.5 (deploy) đã xong: VPS @ dev; S4.1–S4.4 vẫn chưa | **Lỗi thời một phần** |

---

## 9. Giới hạn của lần đo này

- **Không** chạy full BE/FE suite ⇒ không có kết luận về hồi quy chức năng sau WS502.
- **Không** đăng nhập UI để tái hiện SSE alert-center bằng mắt; kết luận F-01 dựa trên **code + log**, chưa có ảnh chụp DevTools.
- Số 502 phụ thuộc log còn trong buffer `docker logs` (xoay vòng) — cửa sổ 24h có thể thiếu nếu container restart.
- Chưa xác minh được PAT nào còn hiệu lực; chỉ biết chúng **đã từng** xuất hiện trong log.

---

## 10. Lệnh tái hiện nhanh (copy nguyên khối)

```bash
# Trên VPS
ssh -i ~/.ssh/id_ed25519 root@14.225.255.47
cd /opt/vninvest && git log --oneline -1 && git status --short
git worktree list
docker ps --filter name=vninvest --format '{{.Names}} {{.Status}}'
docker logs nginx-proxy --since 1h 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -c 'token='
docker logs nginx-proxy --since 1h 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -c ' 502 '
docker logs nginx-proxy --since 48h 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep 'ws/realtime/?token=' | tail -1
docker logs nginx-proxy --since 48h 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep 'alert-center/stream/.*token=' | tail -1
docker exec vninvest-core-db psql -U vninvest -lqt | cut -d'|' -f1 | tr -d ' '
df -h /

# Trên máy local
cd "D:/Mujoco Projects/vninvest"
git rev-parse dev origin/dev
node scripts/pre-push-gate.mjs
node packages/web/scripts/check-multi-agent.mjs
node scripts/audit-status-claims.mjs --strict
node docs/system-design/_meta/tools/check-system-design.mjs --check
```
