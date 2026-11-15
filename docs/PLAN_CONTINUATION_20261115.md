# PLAN — Tiếp tục sau handoff WS502 (2026-11-15)

> **Ngày lập:** 2026-11-15 · **Người lập:** agent (session continuation)
> **Base:** `dev` @ `54a401b80` (= `origin/dev`, working tree sạch)
> **Claim:** `continuation-plan-20261115` · **Branch:** `feat/continuation-plan-20261115`
> **Loại slice:** doc-only (0 dòng code, 0 file deny-list, 0 deploy)
> **Nguồn rà soát:** `docs/handoffs/HANDOFF_2026-11-15_WS502-DASHBOARD.md` + chuỗi handoff 2026-11-13
> **Bằng chứng đo:** `docs/evidence/continuation-20261115/MEASUREMENTS_20261115.md`
> **Audit độc lập:** `docs/evidence/continuation-20261115/audit.md`

---

## 0. Kết luận 1 trang

1. **Handoff WS502 đúng phần lớn nhưng có 1 mục stale và 1 lỗ hổng bị bỏ sót** (chi tiết ở §2). Mục 1 (chỉ còn `?ticket=`) **đúng cho `/ws/realtime/`**: lần cuối thấy `?token=` là `01:52:54Z`, trước lần rebuild `02:42Z`; bundle đang phục vụ (`hooks-BCiCY1L_.js`) có 3× `realtime/?ticket=` và **0** `token=`. Mục 4 (1-2 502 khi cold load) khớp số đo: **0** 502 trong 1 giờ gần nhất.
2. **Nhưng có một lỗ rò token MỚI chưa ai ghi nhận:** SSE alert-center vẫn gửi **PAT dài hạn trong query string**. Bằng chứng: `packages/web/src/hooks/useAlertCenterStream.ts:43-44`; log nginx có hit lúc **`06:21:18Z` hôm nay** (sau rebuild); test đang **ghim** hành vi này (`useSignalStream.component.test.tsx:141`). Đây là **P0** — cùng loại lỗi vừa sửa cho WS, chỉ khác đường.
3. **`pre-push-gate` hiện 5 FAIL / 31 PASS**, nhưng **3 FAIL là do môi trường**, không phải code: máy này không có Python thật (`python` = Microsoft Store stub), và `scripts/pre-push-gate.mjs:441-444` chỉ nhận diện thiếu Django chứ không nhận diện thiếu interpreter ⇒ báo FAIL thay vì `CHƯA CHẠY`.
4. **2 FAIL còn lại là drift tài liệu/cấu hình thật:** `system-design` (đếm migration sai **137** so với thực tế **139**) và `global-config-drift` (4 file `tools/opencode-global/*` lệch bản deploy).
5. **Chưa có baseline toàn suite nào sau chuỗi thay đổi WS502, và baseline cũ không xanh:** FE lần cuối 2026-11-13 là **1243/1251 pass — 8 fail, exit 1** (`HANDOFF_2026-11-13_FULL-VITEST-VPS.md:18`), BE lần cuối 2026-10-22 là **3468 test / 11 fail / 224 error / 7 skip** (`HANDOVER_W0_FOUNDATION_20261022.md:187`). Cần chạy lại trên VPS trước khi coi chuỗi WS502 là đóng.
6. **Đề nghị thứ tự:** P0 (SSE ticket + Owner revoke PAT) → P1 (gate tin cậy + 2 baseline) → P2 (dọn VPS + claim + C2/C3/E2E) → P3 (Owner product decisions + refresh MASTER_TRACKING).

---

## 1. Baseline đo được (chạy thật, 2026-11-15 06:17–06:30 UTC)

| Hạng mục | Kết quả | Lệnh tái hiện |
|---|---|---|
| Local `dev` | `54a401b80`, sạch, **= `origin/dev`** | `git rev-parse dev origin/dev`, `git status --short` |
| VPS `/opt/vninvest` | `7a0bd7aa7` (dev), **5 commit docs-only** sau local | `ssh … 'cd /opt/vninvest && git log --oneline -1'` |
| VPS untracked | `compose.staging.env.bak-20261114` | `git status --short` trên VPS |
| Container vninvest | 6 core + redis/db/pgbouncer/monitoring, **0 restart**, `core-api` healthy | `docker ps --filter name=vninvest` |
| Health | `https://docker.edusuccess.vn/` = **200** | `curl -o /dev/null -w '%{http_code}'` |
| Disk VPS | **91G/116G = 79%** | `df -h /` |
| Worktree VPS | `/tmp/wt-gatep0` (từ 2026-11-13 18:58), `/tmp/wt-gatep0-fix` | `git worktree list` |
| DB rác VPS | `ai_r42`, `ai_r43`, `ai_r51`, `ai_r52`, `ai_r53` | `psql -lqt` |
| `?token=` 15m / 1h / 6h / 24h | **1 / 1 / 26 / 283** | `docker logs nginx-proxy --since W \| grep -c token=` |
| `?token=` theo path (24h) | `/ws/realtime/?` **277** · `/core/v1/signals/alert-center/stream/` **7** | `grep -o 'GET /[^ ]*token='` |
| `?token=` trên `/ws/realtime/` lần cuối | **`15/Nov/2026:01:52:54Z`** (trước rebuild 02:42Z) | `docker logs … \| grep 'ws/realtime/?token=' \| tail -1` |
| `?token=` trên alert-center lần cuối | **`15/Nov/2026:06:21:18Z`** (sau rebuild) | `docker logs … \| grep 'alert-center/stream/.*token=' \| tail -1` |
| `?ticket=` 24h | **17** | `grep -c ticket=` |
| HTTP 502 30m / 1h / 6h / 24h | **0 / 0 / 4 / 108** | `grep -c ' 502 '` |
| 502 theo giờ (6h) | chỉ `00h` (1) và `01h` (3) — **trước rebuild** | `grep ' 502 ' \| grep -o '\[[0-9]*/Nov/2026:[0-9][0-9]'` |
| Bundle đang phục vụ | `hooks-BCiCY1L_.js`: **3× `realtime/?ticket=`, 0 `token=`** | `docker exec vninvest-frontend grep -o` |
| `pre-push-gate` | **5 FAIL / 31 PASS / 0 SKIP** | `node scripts/pre-push-gate.mjs` |
| `check-multi-agent` | PASS (0 lỗi) | `node packages/web/scripts/check-multi-agent.mjs` |
| `audit-status-claims --strict` | PASS, nhưng **16 claim đang mở** (13–14 stale) | `node scripts/audit-status-claims.mjs --strict` |

**Cảnh báo đọc số (L-G04):** 108 502/24h **không phải 108 lỗi vninvest**. Log nginx-proxy là **dùng chung** nhiều vhost; trong 24h có 502 của `edusuccess.vn` (ERP) và `/api/method/frappe.*`. 502 của vninvest tập trung đúng path `/ws/realtime/?token=` và **dừng sau 01:39Z**. Không được báo "staging còn 502" mà bỏ vế này.

---

## 2. Rà soát 4 việc dở của handoff WS502

| # | Handoff nói | Trạng thái đo được | Kết luận |
|---|---|---|---|
| 1 | "User hard-reload → log chỉ còn `?ticket=`, đếm bulk POST + 502 mới → Entry 519" | `/ws/realtime/?token=` lần cuối `01:52:54Z`, 0 hit trong 1h; bundle mới có `ticket=` | **ĐẠT cho WS**, nhưng **chưa có Entry ghi việc đếm log** (Entry 518 chỉ ghi "chờ user reload") → đóng bằng C-03. **Còn hở ở SSE alert-center** → mở C-01 |
| 2 | "Revoke/rotate PAT `vni_internal_BqJaKW_...`" | Log 24h có **23 PAT khác nhau**; `BqJaKW` vẫn xuất hiện đến `01:52:54Z` | **CHƯA LÀM — Owner**. Không chỉ 1 token: cần revoke **toàn bộ** PAT từng lọt log |
| 3 | "AI panel timeout 10s" | `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:67-68` đã có `AbortController` + `setTimeout(…, 10000)`; `:91` hiển thị lỗi timeout | **ĐÃ XONG trước phiên này** (PR #389 / Entry 494). **Không làm lại** |
| 4 | "Cold load sau >5 phút idle có thể lọt 1-2 502 — chấp nhận" | 502 chỉ còn ở `00h`–`01h`, 0 trong 1h gần nhất | **ĐÚNG, đã đo**. Ghi nhận là hành vi đã biết, không mở ticket |

---

## 3. Findings (đo được, kèm `file:line`)

| ID | Mức | Bằng chứng | Thực tế | Tác động | Hướng xử lý |
|---|---|---|---|---|---|
| **F-01** | **P0** | `packages/web/src/hooks/useAlertCenterStream.ts:43-44` | `getBrowserStorageToken("access_token")` được nhét vào query `token=` của SSE | PAT dài hạn nằm trong access log nginx + mọi proxy trung gian; hit thật lúc `06:21:18Z` | C-01: dùng ticket ngắn hạn như WS |
| **F-02** | **P0** | `packages/core/backend/src/signal_intelligence/views.py:803-817` | BE chấp nhận `?token=` vì "EventSource không gửi được Authorization header" | Hợp thức hoá lỗi F-01; nếu chỉ sửa FE thì client cũ vẫn lọt | C-01: thêm nhánh `ticket`, giữ `token` có thời hạn rồi bỏ |
| **F-03** | P0 | `packages/web/src/hooks/useSignalStream.component.test.tsx:141` | `expect(url).toContain("token=test-pat-token")` | Test **ghim** hành vi rò token ⇒ sửa code sẽ đỏ, dễ bị "sửa test cho xanh" sai hướng | C-01: đổi assert sang `ticket=` + thêm test âm tính |
| **F-04** | **P1** | `scripts/pre-push-gate.mjs:441-444` | Probe chỉ coi là "thiếu Django" khi khớp `/No module named ['"]django['"]/`; interpreter thiếu in "Python was not found" ⇒ không khớp ⇒ chạy checker bằng stub ⇒ FAIL | 3 cổng (`admin-ux`, `envelope-contract`, `openapi-budget`) đỏ **vĩnh viễn** trên máy không có Python ⇒ mất giá trị gate, dễ push `--no-verify` | C-04: nhận diện stub/ENOENT → `SKIP (CHƯA CHẠY)`; giữ FAIL cho lỗi checker thật |
| **F-05** | P1 | `docs/system-design/_meta/freshness-report.md:12` + `docs/system-design/_meta/tools/check-system-design.mjs:146` | Doc ghi `137`, gate đo `138`; nhưng regex chỉ đếm `migrations/0*.py` nên **bỏ sót** `identity_access/migrations/9000_auth_user_email_ci_unique.py:75` ⇒ thực tế **139** | Con số "chuẩn" của doc và của gate **đều sai**; sửa doc theo gate sẽ vẫn sai 1 | C-05: sửa regex + doc = 139 + chạy `--write` freshness |
| **F-06** | P1 | `tools/opencode-global/*` vs bản deploy | 4 file DRIFT: `agent-preflight.mjs`, `test-agent-preflight.mjs`, `pre-bash-agent-preflight.js`, `scripts-package.json` | Preflight đang chạy **khác** bản canonical trong repo ⇒ hành vi hook không đại diện code | C-06: chạy `deploy.mjs` rồi `verify` lại 0 DRIFT |
| **F-07** | P1 | Handoff DOT3 §3 (`docs/handoffs/HANDOFF_2026-11-13_DOT3-REMAINING.md:19`) | Full FE/BE suite **CHƯA CHẠY** sau chuỗi WS502 + ticket | 5 commit gần nhất chạm WS/auth chưa có suite nào xác nhận | C-07/C-08: chạy trên VPS theo runbook §12.3/§12.4 |
| **F-08** | P2 | `docker ps`, `git worktree list`, `df -h` trên VPS | 2 worktree `/tmp/wt-gatep0*`, 5 DB `ai_r4x/ai_r5x`, `compose.staging.env.bak-20261114`, disk **79%** | Rác tích luỹ + file env backup chứa secret nằm ngoài compose | C-09: dọn có kiểm chứng trước khi xoá |
| **F-09** | P2 | `docs/CLAIMS.md` + `scripts/audit-status-claims.mjs` | 16 claim mở; tool đếm **mọi dòng lịch sử** nên append `released` không bao giờ về 0 | Registry mất tín hiệu "ai đang giữ gì"; gate không bao giờ xanh | C-10: append `released` cho 13 stale + quyết định policy đếm "trạng thái mới nhất" |
| **F-10** | P2 | `docs/evidence/uiux-remediation/PERF_BASELINE_20261113.md:12-13` | `echarts` 711.5 KB, `i18n` 564.1 KB vẫn trong tải đầu | Mục tiêu C2/C3 chưa đạt; ảnh hưởng LCP trên mạng chậm | C-11/C-12 |
| **F-11** | P3 | `docs/MASTER_TRACKING_2026Q4.md` header | Ghi "2026-10-22 @ `91bad0440` · 34 PASS / 0 FAIL" — nay là 31 PASS / 5 FAIL | Tài liệu điểm vào **sai sự thật**; người mới đọc sẽ tin gate xanh | C-14: refresh hoặc thay bằng con trỏ tới plan này |

---

## 4. Kế hoạch tiếp tục (slice, AC, phụ thuộc)

### P0 — Tuần này

#### C-01 · Bỏ PAT khỏi URL SSE alert-center (P0 bảo mật)
- **Chạm:** `packages/web/src/hooks/useAlertCenterStream.ts`, `packages/core/backend/src/signal_intelligence/views.py`, `packages/web/src/hooks/useSignalStream.component.test.tsx`, có thể `packages/web/src/hooks/useSignalStream.ts`.
- **Việc:** phát ticket ngắn hạn (tái dùng `/core/v1/auth/ws-ticket/` nếu contract cho phép; nếu không, thêm scope `sse`), FE truyền `?ticket=`; BE `initial()` chấp nhận `ticket` **và** `token` trong giai đoạn chuyển tiếp, log cảnh báo khi còn `token`.
- **Gia cố kèm theo (từ audit):** `packages/web/src/hooks/useRealtimeFeedCore.js:9-10` vẫn để `getRealtimeWebSocketUrl()` fallback về `localStorage.getItem('access_token')` — hiện **không có call site nào** dùng fallback này (`:1011` đã guard `wsTicket ? … : null`), nhưng đây là bẫy: caller tương lai gọi không tham số sẽ đẩy PAT vào `?ticket=`. Đổi hàm thành **từ chối** giá trị không phải ticket (trả `null` + log) thay vì đọc localStorage.
- **AC:**
  - **Given** user mở `/alert-center`, **when** SSE kết nối, **then** URL chỉ có `ticket=` (test component assert `not.toContain("token=")`).
  - **Given** chạy 24h trên staging, **when** grep nginx, **then** `alert-center/stream/.*token=` = 0.
  - **Given** ticket hết hạn, **when** reconnect, **then** FE xin ticket mới, không fallback về PAT.
- **Effort:** M · **Phụ thuộc:** không · **Rủi ro:** EventSource không set header ⇒ phải giữ cơ chế query, chỉ đổi **loại** credential.

#### C-02 · Owner revoke toàn bộ PAT từng lọt log (Owner)
- **Việc:** revoke 23 PAT quan sát trong 24h (không chỉ `vni_internal_BqJaKW_...`), xác nhận `GITHUB_TOKEN` đã rotate (S5.3 cũ), rồi ghi biên bản.
- **AC:** mọi token cũ trả 401 ở `/core/v1/auth/ws-ticket/`; log 24h sau revoke không còn token cũ.
- **Effort:** S · **Không thể làm bởi agent** (không có quyền).

#### C-03 · Chốt soak 24h cho WS ticket + đóng mục 1 handoff
- **Việc:** sau 24h kể từ `02:42Z`, đếm lại `ws/realtime/?token=`; nếu 0 → append 1 dòng xác nhận vào ledger (không sửa Entry cũ).
- **AC:** `grep 'ws/realtime/?token='` trên 24h = 0 **và** `?ticket=` > 0.
- **Effort:** S · **Phụ thuộc:** thời gian, không code.

### P1 — Gate tin cậy + baseline

#### C-04 · Gate không được báo FAIL khi thiếu interpreter
- **Chạm:** `scripts/pre-push-gate.mjs` (vùng `:359-455`), có thể thêm helper `resolvePython()` dùng chung.
- **Việc:** coi `Python was not found`, `ENOENT`, exit 9009 là "không có interpreter" → `skip(... "CHƯA CHẠY: thiếu python")`; chỉ FAIL khi interpreter chạy được mà checker trả lỗi.
- **AC:** trên máy này gate báo **3 SKIP** thay vì 3 FAIL, tổng `2 FAIL / 31 PASS / 3 SKIP`; trên VPS có `.venv` vẫn chạy thật 3 cổng đó; thêm self-test cho nhánh stub.
- **Effort:** S/M · **Rủi ro:** nới gate quá tay ⇒ phải có self-test chứng minh lỗi thật vẫn FAIL.

#### C-05 · Sửa số migration (doc + bộ đếm)
- **Chạm:** `docs/system-design/_meta/freshness-report.md:12`, `docs/system-design/_meta/tools/check-system-design.mjs:146`.
- **Việc:** đổi regex sang `migrations/\d+_.*\.py` (đếm cả `9000_*`), chạy `--write`, xác nhận doc = **139**.
- **AC:** `node docs/system-design/_meta/tools/check-system-design.mjs --check` exit 0; số trong doc = số đếm thật = 139.
- **Effort:** S.

#### C-06 · Deploy lại cấu hình opencode toàn cục
- **Việc:** `node tools/opencode-global/deploy.mjs` → chạy lại `verify` (0 DRIFT) → `test-agent-preflight` 26/26.
- **AC:** `global-config-drift` PASS; không đổi hành vi hook ngoài ý muốn (so diff trước/sau).
- **Effort:** S · **Lưu ý:** đây là **máy**, không phải repo ⇒ ghi vào evidence, không commit.

#### C-07 · Full FE suite trên VPS
- **Việc:** theo `docs/STAGING_VPS_RUNBOOK.md` §12.4, chạy toàn bộ vitest trên VPS (không local).
- **AC:** ghi rõ tổng test / pass / fail; fail nào là pre-existing phải chứng minh bằng worktree HEAD sạch.
- **Effort:** M · **Phụ thuộc:** C-06 không bắt buộc.

#### C-08 · Full BE suite trên VPS
- **Việc:** theo runbook §12.3 (DB tạm riêng, `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`), chạy toàn bộ; dọn DB sau khi chạy.
- **AC:** có baseline mới thay cho baseline 2026-10-22 (`3468 test / 11 fail / 224 error / 7 skip` theo `HANDOVER_W0_FOUNDATION_20261022.md:187`); mọi fail/error phải phân loại.
- **Effort:** L · **Bắt buộc:** dọn container/DB tạm sau khi xong (S5.2).

### P2 — Vệ sinh + tính năng đã defer

#### C-09 · Dọn VPS (có kiểm chứng)
- **Việc:** xác nhận không process nào dùng `/tmp/wt-gatep0*` → `git worktree remove`; kiểm tra `pg_stat_activity` trước khi `DROP DATABASE ai_r4x/ai_r5x`; quyết định `compose.staging.env.bak-20261114` (giữ 600 hay xoá sau khi đối chiếu); theo dõi disk 79%.
- **AC:** `git worktree list` còn 1; `psql -l` còn 4 DB hệ thống + `vninvest_core`; disk ≤ 75% hoặc có kế hoạch.
- **Effort:** S/M · **Rủi ro:** xoá nhầm DB đang dùng ⇒ bắt buộc kiểm `pg_stat_activity` trước.

#### C-10 · Vệ sinh claim registry + policy đếm
- **Việc:** append `released` cho 13–14 claim stale (append-only, **không sửa dòng cũ**); quyết định `audit-status-claims` đếm **trạng thái mới nhất theo tên** thay vì mọi dòng.
- **AC:** `--strict` báo "đang mở: 0" (hoặc ngưỡng có lý do); `check-multi-agent` vẫn PASS.
- **Effort:** S.

#### C-11 · C2 — defer echarts khỏi tải đầu
- **Việc:** lazy-load `echarts` (711.5 KB) theo route; đo lại bằng `packages/web/scripts/measure-route-graph.mjs`.
- **AC:** tải đầu `/dashboard` giảm ≥ 500 KB; không vỡ chart nào (test component + ảnh chụp thật).
- **Effort:** M.

#### C-12 · C3 — tách i18n namespace
- **Việc:** lazy i18n (564.1 KB) theo route/namespace.
- **AC:** chunk i18n không còn trong tải đầu; `i18n:scan` idempotent.
- **Effort:** M.

#### C-13 · E2E sidebar + visual baseline
- **Việc:** chạy E2E click sidebar không reload; tạo baseline Linux trên VPS (hiện chỉ có win32).
- **AC:** E2E xanh trên build staging hiện tại; ảnh baseline commit kèm `git status` sạch (L-V03/L-V05).
- **Effort:** S/M.

### P3 — Tài liệu + quyết định

#### C-14 · Refresh `MASTER_TRACKING_2026Q4.md`
- **Việc:** cập nhật mốc + trạng thái gate thật, hoặc thay bằng con trỏ tới plan này.
- **AC:** không còn dòng "34 PASS / 0 FAIL" sai sự thật.
- **Effort:** S.

#### C-15 · Owner chốt 3 quyết định sản phẩm
- AI contract (D2/W1.1) · broker 2 tầng (W1.5) · chính sách free-trial (W1.9).
- **AC:** mỗi quyết định có 1 dòng trong `docs/CLAIMS.md` hoặc quyết định ghi thành văn bản.
- **Effort:** S (Owner) · **Chặn:** mọi slice UI/UX liên quan.

---

## 5. Thứ tự thực thi đề xuất

```
C-01 (P0 code)  ──→ C-03 (soak 24h)  ──→ C-10 (claim)
C-02 (Owner, song song)
C-04 ──→ C-05 ──→ C-06 ──→ C-07 ──→ C-08
C-09 (độc lập, làm sớm để hạ disk 79%)
C-11 / C-12 / C-13 (sau khi C-07 xanh)
C-14 / C-15 (cuối)
```

**Lý do thứ tự:** C-01 là lỗ hổng đang hoạt động; C-04 phải xong trước C-07/C-08 để kết quả gate đáng tin; C-09 làm sớm vì disk 79% là rủi ro hạ tầng chung.

---

## 6. Không làm trong slice này (non-goals)

- Không sửa code, không sửa test, không deploy, không drop DB.
- Không chạm deny-list (`AGENTS.md`, `package.json`, lockfile, `docker-compose*`, `.env*`).
- Không sửa dòng cũ trong `docs/CLAIMS.md` / ledger (append-only).
- Không "sửa test cho xanh" ở F-03: test đang ghim hành vi sai, phải đổi **theo** hành vi đúng.

---

## 7. Rủi ro & rollback

| Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| Sửa SSE sang ticket làm rơi client cũ | Trung bình | Alert-center không nhận alert | Giữ nhánh `token` chuyển tiếp + log cảnh báo; bỏ sau 1 tuần |
| C-04 nới gate khiến lỗi thật lọt | Trung bình | Regression vào `dev` | Self-test âm tính: interpreter chạy được + checker lỗi ⇒ vẫn FAIL |
| DROP DB nhầm | Thấp | Mất dữ liệu test | `pg_stat_activity` + `pg_dump` trước khi drop |
| Disk 79% đầy trong lúc chạy full suite | Trung bình | Suite chết giữa chừng | Dọn C-09 trước C-07/C-08 |
| Sửa regex đếm migration làm gate khác lệch | Thấp | Gate đỏ mới | Chạy `--write` rồi `--check`; so số trước/sau |

**Rollback slice này:** `git revert <commit>` — doc-only, không ảnh hưởng runtime.

---

## 8. Kiểm chứng cho chính slice này

| Cổng | Kỳ vọng | Trạng thái |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | 0 lỗi, claim khớp branch | PASS (đã chạy sau khi append claim) |
| `node scripts/scan-secrets.mjs` | không có secret mới | sẽ chạy trước commit |
| `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | Entry mới đúng thứ tự, không trùng số | **PASS** — max=522, 0 trùng mới (1 trùng cũ có sẵn) |
| `node scripts/pre-push-gate.mjs` | không tệ hơn baseline 5 FAIL / 31 PASS | sẽ chạy + ghi số thật |
| Audit độc lập (B3) | `PASS` hoặc `AGREE` không reservation chặn | `AGREE` — independence hạn chế (B3 bị chặn free-limit, thay bằng verify read-only 16/16 citation MATCH); xem `docs/evidence/continuation-20261115/audit.md` |

---

## 9. Lessons áp dụng

`Lessons áp dụng: [L-001 L-002 L-003 L-008 L-V01 L-V02 L-V03 L-G02 L-G04 L-T01 L-T02 L-M02]`

- **L-001/L-008:** không chạm deny-list, làm trên `feat/*` + PR.
- **L-002/L-M02:** claim khai + commit **trước** khi sửa; branch = `feat/<tên claim>` đúng ký tự.
- **L-003:** local `dev` đã bằng `origin/dev`; nếu rebase phát sinh thì phải chạy lại gate.
- **L-V01/L-V02:** mọi số trong plan có lệnh tái hiện; "root cause" của handoff được kiểm lại (mục 2), không tin suông.
- **L-V03:** sau mỗi lệnh đo trên VPS/`docker logs`, kiểm `git status` — không để file phát sinh lọt vào commit.
- **L-G02:** 3 cổng không chạy được ghi `CHƯA CHẠY`, không ghi PASS.
- **L-G04:** 108 502/24h được tách theo vhost/path trước khi kết luận.
- **L-T01/L-T02:** `CLAIMS.md` append bằng Node theo byte (delta +529 byte = đúng 1 dòng); mọi `file:line` đã mở đọc thật.

**MANDATORY CHECKLIST (tick trước khi đóng slice):**
- [x] Đã `git status --short` trước khi khai claim
- [x] Claim commit riêng trước khi sửa file khác
- [x] Branch khớp tên claim
- [x] Không file nào trong deny-list
- [x] Mọi số liệu có lệnh tái hiện trong evidence
- [ ] `scan-secrets` + `check-ledger-entry` + `pre-push-gate` chạy lại sau khi viết xong
- [ ] Audit độc lập có verdict bằng văn bản
- [ ] Claim → `done` + Entry ledger + PR

---

## 10. Bàn giao

- **Xong trong slice này:** plan + evidence + audit verdict + claim + Entry ledger + PR.
- **Việc đầu tiên của phiên sau:** C-01 (SSE ticket) — P0 đang hoạt động, không chờ.
- **Việc Owner phải làm ngay:** C-02 (revoke PAT) — không thể thay thế bằng code.
