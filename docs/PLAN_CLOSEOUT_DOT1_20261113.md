# PLAN — Closeout Đợt 1 (doc + probe + claim hygiene, KHÔNG sửa backend) — rev 2

> **Ngày:** 2026-11-13 · **Trạng thái:** KẾ HOẠCH rev 2 — thực thi sau audit B3 NEED_REVISION
> **Claim:** `closeout-dot1-20261113` (`docs/CLAIMS.md:1934`, trạng thái `in-progress`, commit `a61530153`)
> **Branch:** `feat/closeout-dot1-20261113` → `dev` (PR) · **Worktree:** `D:/Mujoco Projects/vninvest-wt-closeout`
> **Base đo:** `origin/dev` @ `e76f66689` (PR #373 page-registry đã merge)
> **Nguồn:** `docs/PLAN_REMAINING_WORK_20261113.md` §4–§6 + đo thật 2026-11-13 (B1)
> **Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-G01, L-G02, L-V02, L-T01, L-F07, L-S01, L-S02]
> **Audit độc lập (B3, subagent read-only):** `NEED_REVISION` — 2 BLOCKER + 2 MAJOR + 5 MINOR → đã sửa ở rev 2, xem `docs/evidence/closeout-dot1-20261113/audit.md` §5 + bảng §10.
> **Ghi nợ quy trình:** claim row append + commit SAU khi tạo file plan (lẽ ra claim trước mọi edit — L-002). Khắc phục: claim đã commit riêng (`a61530153`) trước mọi edit TIẾP THEO; header rev 1 ghi sai ("appended") đã đính chính ở rev 2.

---

## 0. Kết luận 1 trang (Owner-proxy quyết thay bạn — bạn đã ủy quyền)

1. **Backend Đợt 1 (S1.1 B-5, S2.1 B-2) BỊ CHẶN — không sửa trong slice này.** Claim `w0-6-data-honesty` đã đóng scope PR #280 (`CLAIMS.md:1791` `done`, Entry 398), NHƯNG branch `origin/feat/w0-6-data-honesty` còn **6 commit round-2 chưa merge** (HEAD `1bab98468`; `git rev-list --count dev..origin/feat/w0-6-data-honesty` = 6), trong đó `62e6e20a0` sửa `market_serving/native_views.py` (+8 dòng) cùng `commercial/tasks.py`, `identity_access/views_tenant.py`, `service_ops/views/signals.py`, `signal_intelligence/outbound_notification_service.py` + 4 file test. Round-2 **không có claim row nào bao phủ** (lỗ hổng bookkeeping — đã báo coordinator yêu cầu chủ branch merge/xóa branch hoặc khai claim round-2). Sửa các file này lúc này = overwrite việc live của người khác → vi phạm §3.2.
   - `vet-finish` (`CLAIMS.md:1879`) giữ `native_views.py` + `stock_mgmt_native_views.py`, nhưng branch đã mất + commit `d150e5df7` đã nằm trong `dev` (`merge-base --is-ancestor` exit 0) + có done row `:1881` → **stale** → release được.
   - ⇒ Sau khi release `vet-finish`, `stock_mgmt_native_views.py` hết người giữ, NHƯNG `native_views.py` vẫn bị `w0-6` round-2 giữ → **mọi edit backend chạm `native_views.py` đều dừng**. Không có ngoại lệ "chắc là stale".
2. **Quyết định Owner-proxy TẠM THỜI (thay bạn, chờ xác nhận — bạn đã ủy quyền quyết nhưng D2 cần thêm bằng chứng trước khi thành quyết định cuối):** D1=(b) giữ route depth-chart trả rỗng trung thực · D2=**đề xuất** breaking `price` string→number (CHƯA PHẢI quyết định cuối — pending widget-team sign-off + Owner confirm; bằng chứng hiện có: `chartAdapter.js:42-46` `Number()`-hóa 5 dòng; FE `Number(` 199 chỗ nhưng tập "45 chỗ" chưa định danh + `adapters/core/market.js` có **0** `Number(` + consumer ngoài `vninvestcharts-widget` chưa audit) · D3=400 `UPPER_SNAKE` khi `period=year` không được hỗ trợ · D4=404 schema khi `DEBUG=False` · D5=re-baseline (đã làm ở Entry 476) · D6=deploy staging sau Đợt 0 (chưa làm) · D7=token `vni_internal_*` đã revoke (bạn xác nhận 2026-11-13; ghi nhận, không verify 401 vì không có token) · D8=B-2..B-6 trước C2/C3.
3. **Slice này chỉ làm phần không xung đột:** vệ sinh worktree (đã xong, ghi evidence) + release 3 claim stale (`vet-finish`, `chart-widget-team`, `pm-review-20261108`) + ghi nhận token + probe read-only Q-B2/Q-B4 trên VPS (không ghi DB, không sửa code) + ledger Entry + handoff. **0 dòng backend, 0 migration, 0 deny-list.**

---

## 1. Baseline đo được (chạy thật 2026-11-13, worktree closeout @ `e76f66689`)

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| B-1 | `node packages/web/scripts/check-multi-agent.mjs` | **0** | `0 lỗi, 0 trùng migration — PASS` + 165 warning (claim-file noise cũ) |
| B-2 | `node packages/web/scripts/scan-secrets.mjs` | **0** | `4663 tracked, 4478 scanned, 185 skipped` → OK |
| B-3 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **0** | `89 header / 88 distinct / max=476` → PASS |
| B-4 | `node scripts/check-lessons.mjs` | **0** | `14 file \| 59/60 lesson — sạch` |
| B-5 | `node scripts/normalize-eol.mjs` | **0** | OK |
| B-6 | `node packages/web/scripts/check-light-theme.mjs` | **0** | 230 màu, phủ đủ |
| B-7 | `node packages/web/scripts/check-i18n-hardcoded-scope.mjs --all` | **0** | `309 / baseline 309` |
| B-8 | `node packages/web/scripts/check-page-registry.mjs` | **0** | `21 entry, 26 route, 0 unreferenced` |
| B-9 | `.\node_modules\.bin\tsc.cmd --noEmit` (packages/web) | **0** | không output |
| B-10 | `node scripts/audit-status-claims.mjs --strict` | **0** | 16 claim mở (chi tiết §2) |
| B-11 | `git worktree list` | — | main tree + worktree slice này (wt-b1/wt-bespec/wt-plan đã dọn) |
| B-12 | `git rev-list --count dev..origin/feat/w0-6-data-honesty` | — | **6** (round-2 sau `:1791 done`; `62e6e20a0` chạm `native_views.py` → chặn backend) |
| B-13 | `git rev-list --count dev..feat/backend-enterprise-demo-spec-20261112` | — | **0** (stale, release được) |

**CHƯA CHẠY ở lúc lập plan:** probe Q-B2/Q-B4 trên VPS (§3); `npm run lint` full (chạy ở B7 sau sửa — slice này không sửa `.tsx` nên kỳ vọng 0 errors như PR #372).

---

## 2. Việc làm (scope khóa — file được chạm)

### S-C1 — Vệ sinh worktree (đã xong, chỉ ghi evidence)
- `git worktree list` = 1 entry (main tree). `wt-b1`/`wt-bespec`/`wt-plan` đã xóa ở phiên trước. Không còn junction `node_modules` treo. **Không làm gì thêm.**

### S-C2 — Release 3 claim stale (append-only, không sửa dòng cũ — §3.4)
| Claim | Dòng | Bằng chứng stale | Hành động |
|---|---|---|---|
| `vet-finish` | `:1879` `in-progress` | branch `feat/vet-finish` **không tồn tại** (local + remote); commit `d150e5df7` đã trong `dev` | append release row |
| `chart-widget-team` | `:40` `in-progress` | worktree `vninvest-wt-bespec` **không tồn tại**; branch `feat/backend-enterprise-demo-spec-20261112` còn nhưng **0 unmerged** (`rev-list dev..branch` = 0); spec commit đã trong `dev` | append release row |
| `pm-review-20261108` | `:1883,1885,1887` `in-progress` | branch `feat/pm-review-20261108` **không tồn tại** (chỉ còn `origin/feat/pm-review-20261022` khác ngày); đã có dòng `done` (`:1886`, `:1889`) | append 1 release row gộp |
| `w0-6-data-honesty` (round-2, không row) | — (scope PR #280 đã đóng ở `:1791 done`) | 6 commit unmerged post-merge, `62e6e20a0` chạm `native_views.py` + `commercial/tasks.py` + `identity_access/views_tenant.py` + `service_ops/views/signals.py` + `signal_intelligence/outbound_notification_service.py` + 4 file test → **KHÔNG stale** → **KHÔNG release, KHÔNG sửa các file này**; đã báo coordinator yêu cầu chủ branch merge/xóa branch hoặc khai claim round-2 | ghi blocker §5 |
| `pm-audit-fix-plan` | `:1884` `in-progress` (cùng tên branch, agent khác) | giữ `docs/PLAN_PM_AUDIT_FIX_20261108.md` + `CLAIMS.md` → **KHÔNG thuộc diện release** (nêu rõ để executor không release nhầm) | không chạm |

### S-C3 — Token `vni_internal_*` (ghi nhận, không verify)
- Bạn xác nhận **đã revoke lâu rồi**. Ghi nhận `done` theo lời Owner (không có token trong tay nên **không** verify 401 — ghi `CHƯA CHẠY`).
- Bằng chứng repo sạch: `scan-secrets` exit 0 (B-2) + `git grep` full-token 0 hit (đã đo ở Entry 476). Không purge history (quyết định riêng Owner, giữ nguyên).

### S-C4 — Probe Q-B2/Q-B4 (read-only VPS, không sửa code/DB)
- Q-B2: `docker exec vninvest-core-api python manage.py shell` đọc `fetch_company_info('VNM').events[:5]` → ghi `docs/evidence/closeout-dot1-20261113/qb2-probe.md` (sample đã redact + kết luận CÓ/KHÔNG ex-date/ratio).
- Q-B4: `docker exec vninvest-core-db psql` đếm `market_data_intraday_tick` 1 ngày → `qb4-probe.md`.
- Nếu SSH/VPS không tới được → ghi `CHƯA CHẠY` + lệnh tái hiện, **không** bịa sample.

### S-C5 — Hồ sơ quyết định D1–D8 (Owner-proxy, §0.2)
- Ghi vào handoff §2 (bảng quyết định + lý do + file:line). Implementation backend (S1.1/S2.1/S2.2/S3.1/S3.2) **defer** sang slice sau khi `w0-6` merge.

### S-C6 — Đóng slice (ledger · claim done · handoff · PR)
- Prepend **1 `## Entry 477`** (số lấy bằng `--next-entry`). Claim row `closeout-dot1-20261113` → `done`. Handoff `docs/handoffs/HANDOFF_2026-11-13_CLOSEOUT-DOT1.md`. PR merge-commit → cleanup worktree.

**KHÔNG chạm:** `packages/core/backend/src/market_serving/native_views.py` · `stock_mgmt_native_views.py` (chờ `w0-6` merge) · `AGENTS.md` · `package.json`/`package-lock.json` · `docker-compose*.yml` · `.env*` · untracked của session khác (`docs/PLAN_A4*`, `docs/PLAN_WIDGET*`, `docs/WIDGET_EMBEDDING*`, `docs/evidence/a4-roadmap/`, `facts32.json`, `21-fullbleed-test.png`).

---

## 3. AC (Given/When/Then)

- **AC1:** Given 3 claim stale có bằng chứng §S-C2, When append 3 release row (`vet-finish`, `chart-widget-team`, `pm-review-20261108@:1883`), Then `git diff docs/CLAIMS.md` chỉ `+` ở cuối file (không sửa dòng cũ nào) và mỗi release row trích đúng bằng chứng (branch/worktree/done-row). (Đính chính B1: `audit-status-claims --strict` đếm *dòng* nên open-row count **giữ nguyên theo thiết kế append-only** — không dùng số đếm làm gate; verify stale bằng V-2/V-3/V-4/V-6/V-10.)
- **AC2:** Given không sửa backend, When chạy B-1..B-9 sau mọi edit + `npm run lint` tại `packages/web` (lệnh lint chính xác — đính chính m1: B-7 là i18n scope, lint là lệnh riêng), Then tất cả exit 0 (lint kỳ vọng 0 errors như PR #372; probe có PASS hoặc CHƯA CHẠY trung thực).
- **AC3:** Given probe VPS, When SSH thành công, Then 2 file `qb2/qb4-probe.md` có command + sample + kết luận; When SSH thất bại, Then 2 file ghi `CHƯA CHẠY` + lệnh tái hiện (không bịa số).
- **AC4:** Given `w0-6` còn 6 unmerged, When grep diff của slice, Then **0 file** trùng với files nó giữ (`native_views.py` vắng mặt trong diff).

---

## 4. Rollback / Non-goals / Limit

- Rollback: revert release rows (1 commit) + xóa worktree; probe không đổi gì nên không rollback.
- Non-goals: S1.1/S2.1/S2.2/S3.1/S3.2 code (defer) · purge history · deploy staging · C2/C3/E2E · sửa claim `w0-6`/`ai-cc`/`vnbroker` (không stale).
- Limit: 3 vòng sửa/bước (quy tắc 3 lần thử). Lố → ghi `blocker`, dừng.

## 5. DoD checklist

- [ ] Claim `in-progress` **trước** dòng sửa đầu tiên (commit riêng)
- [ ] `git diff --numstat` khớp dự kiến (không EOL drift; append-only giữ LF)
- [ ] B-1..B-9 xanh (lint 0 errors; probe có PASS hoặc CHƯA CHẠY trung thực)
- [ ] `git diff --name-only` **không** chứa `native_views.py` / `stock_mgmt_native_views.py`
- [ ] Ledger 1 Entry mới (477) + claim `done` + handoff + PR merge-commit + cleanup worktree

---

## 10. Đối chiếu objection của audit B3 (đã xử lý ở rev 2)

| # | Mức | Nội dung | Xử lý ở rev 2 |
|---|---|---|---|
| B1 | BLOCKER | AC1 (`16→13`) không thể đạt với append-only | Viết lại AC1: gate bằng release-row + branch/worktree evidence, không đếm số; giữ nguyên open-row count theo thiết kế |
| B2 | BLOCKER | Claim slice chưa tồn tại nhưng header ghi "appended" | Đã append + commit riêng `a61530153` (dòng `:1934`); header ghi số dòng + hash; ghi nợ L-002 (claim sau plan) |
| M1 | MAJOR | Viện dẫn w0-6 sai (`:1785` đã bị `:1791 done` thay thế) | Cite `:1791 done` + `rev-list` 6 + `62e6e20a0→native_views.py`; thêm báo coordinator + liệt kê full file set round-2 |
| M2 | MAJOR | D2 breaking "ngay" thiếu bằng chứng consumer | Hạ D2 xuống **đề xuất tạm thời** (pending widget-team sign-off + Owner confirm); ghi bằng chứng hiện có + thiếu |
| m1 | MINOR | AC2 lẫn lint với B-7 | Nêu lệnh lint chính xác (`npm run lint` tại `packages/web`) |
| m2 | MINOR | B-11 "chỉ còn main tree" sai (còn worktree slice) | Sửa chữ: main + worktree slice này |
| m3 | MINOR | D7 token | Giữ cách ghi "ghi nhận, không verify" + `CHƯA CHẠY` verify 401 |
| m4 | MINOR | File set round-2 rộng hơn AC4 | Liệt kê full set vào §0.1/S-C2 |
| m5 | MINOR | `:1884 pm-audit-fix-plan` dễ release nhầm | Thêm dòng KHÔNG thuộc diện release ở S-C2 |
