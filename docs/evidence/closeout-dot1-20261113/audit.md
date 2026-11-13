# AUDIT — `docs/PLAN_CLOSEOUT_DOT1_20261113.md` rev 1 (subagent read-only)

> Ngày: 2026-11-13 · Auditor: subagent độc lập (read-only, không sửa code)
> Đối tượng: `docs/PLAN_CLOSEOUT_DOT1_20261113.md` rev 1, worktree `D:/Mujoco Projects/vninvest-wt-closeout`, branch `feat/closeout-dot1-20261113`, base `origin/dev @ e76f66689`
> Nguồn đối chiếu: `docs/PLAN_REMAINING_WORK_20261113.md` §4–§6 · `docs/CLAIMS.md` · shell verify trực tiếp

## 0. Tóm tắt 5 phát hiện nặng nhất

1. **AC1 không thể đạt** — `audit-status-claims --strict` đếm *dòng* `in-progress/proposed`; `CLAIMS.md` append-only nên append release row không bao giờ giảm 16→13 (BLOCKER B1).
2. **Claim slice chưa tồn tại** — header plan khẳng định `closeout-dot1-20261113` "appended, in-progress" nhưng `grep` toàn file không thấy dòng nào; DoD của chính plan yêu cầu claim trước dòng sửa đầu tiên (BLOCKER B2).
3. **Viện dẫn w0-6 sai dòng** — `:1785 **in-progress**` đã bị `:1791 **done**` (PR #280 MERGED) thay thế; "row vẫn in-progress" là sai sự thật. Chặn backend vẫn đúng nhưng bằng chứng đúng phải là 6 commit unmerged post-merge (MAJOR M1).
4. **D2 (breaking `price` string→number "ngay") thiếu bằng chứng an toàn consumer** — "45 chỗ" không có grep/file:line; `adapters/core/market.js` có 0 `Number(`; không có sign-off widget-team, trái với yêu cầu "bắt buộc audit + thông báo widget team" ở plan gốc. Được chứa vì implementation defer — nhưng quyết định phải đánh dấu TẠM THỜI (MAJOR M2).
5. Điểm tốt: stale của `vet-finish` / `chart-widget-team` / `pm-review` có đủ 3 chân bằng chứng; scope không chạm deny-list; lessons resolve đủ 11/11; baseline B-1/B-3 chạy lại vẫn PASS.

---

## 1. Verify shell (chạy thật 2026-11-13 trên worktree closeout)

| # | Lệnh | Kết quả | Đối chiếu plan |
|---|---|---|---|
| V-1 | `git rev-list --count dev..origin/feat/w0-6-data-honesty` | **6** | Khớp plan §B-12 (6) ✓ |
| V-2 | `git rev-list --count dev..feat/backend-enterprise-demo-spec-20261112` | **0** | Khớp plan §B-13 (0) ✓ |
| V-3 | `git branch -a --list "*vet-finish*"` | **rỗng** (local + remote đều mất) | Khớp "branch không tồn tại" ✓ |
| V-4 | `git branch -a` \| vet/w0-6/pm-review/closeout | `* feat/closeout-dot1-20261113`, `origin/feat/w0-6-data-honesty`, `origin/feat/pm-review-20261022` (khác ngày), **không** có `pm-review-20261108` hay `backend-enterprise…` ở remote? (local có `feat/backend-enterprise-demo-spec-20261112`; remote có `origin/feat/backend-enterprise-demo-spec-20261112`) | Khớp cơ bản ✓ |
| V-5 | `git worktree list` | 2 entry: main `D:/Mujoco Projects/vninvest` + closeout (wt-b1/wt-bespec/wt-plan đã dọn) | Khớp §B-11, trừ chữ "chỉ còn main tree" (thực tế còn cả worktree slice này — MINOR m2) |
| V-6 | `git merge-base --is-ancestor d150e5df7 dev` | exit **0** (commit đã trong dev) | Khớp bằng chứng stale vet-finish ✓ |
| V-7 | `git log --name-only dev..origin/feat/w0-6-data-honesty` | 6 commit (`3311b2a0b…1bab98468`), trong đó `62e6e20a0` sửa `market_serving/native_views.py` (+8 dòng) cùng `commercial/tasks.py`, `views_tenant.py`, `views/signals.py`, `outbound_notification_service.py` | Chặn `native_views.py` là có thật ✓ (nhưng xem M1: đây là commit *post-merge*, không phải scope của `:1785`) |
| V-8 | `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng migration — PASS` | Khớp §B-1 ✓ (warning claim-file noise còn đó, đúng như plan ghi) |
| V-9 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | `89 header / 88 distinct / max=476 → PASS` | Khớp §B-3 ✓ |
| V-10 | `git ls-tree dev --name-only docs/` | chứa `BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` | Khớp "spec commit đã trong dev" ✓ |
| V-11 | `node …/check-ledger-entry.mjs --next-entry` → `477`; grep `^## Entry 477` → không thấy | Entry 477 đúng số kế tiếp, chưa tồn tại | Khớp §S-C6 ✓ |

## 2. Đối chiếu CLAIMS.md (đọc bằng `Get-Content`, do file có encoding khiến `read` báo binary)

| Dòng | Agent | Status ô | Thực tế |
|---|---|---|---|
| `:40` | `chart-widget-team` | `in-progress` | Worktree `vninvest-wt-bespec` đã mất (V-5); branch còn nhưng 0 unmerged (V-2); spec đã trong dev (V-10) → **stale thật** ✓ |
| `:1785` | `w0-6-data-honesty` | `**in-progress**` (in đậm) | Bị dòng mới hơn thay thế (xem `:1791`) → viện dẫn là stale (M1) |
| `:1791` | `w0-6-data-honesty` | `**done**` — "PR #280 MERGED → dev", Entry 398 | Đóng scope PR #280; 6 commit unmerged là việc *round-2* trên branch chưa xóa, **không có claim row mới** |
| `:1879` | `vet-finish` | `in-progress` | Branch mất (V-3) + `d150e5df7` trong dev (V-6) + done row `:1881` → **stale thật** ✓ |
| `:1881` | `vet-finish` | `done` — "xem Entry 415" | ✓ |
| `:1883` | `pm-review-20261108` | `in-progress` (PLAN docs) | Branch mất (chỉ còn `origin/feat/pm-review-20261022`) → stale, chưa có done → release row gộp là đúng đối tượng duy nhất còn hở |
| `:1884` | `pm-audit-fix-plan` | `in-progress` | Agent khác, giữ `docs/PLAN_PM_AUDIT_FIX_20261108.md` + `CLAIMS.md` → plan **không** release nó là đúng (nhưng nên ghi rõ để khỏi nhầm cùng branch — MINOR m1) |
| `:1885` | `pm-review-20261108` | `in-progress` (W0-1 fix) | Đã đóng bởi `:1886 done` (cùng file) → thực tế không còn hở |
| `:1886` | `pm-review-20261108` | `done` (W0-1 DONE, B8 PASS) | ✓ |
| `:1887`–`:1888` | `pm-review-20261108` | `in-progress` (W0-3, W0-6) | Đã đóng bởi `:1889 done` (superset file) → thực tế không còn hở |
| `:1889` | `pm-review-20261108` | `done` (W0-3/W0-6/W0-8/W2-1 DONE rev1) | ✓ |
| — | `closeout-dot1-20261113` | **KHÔNG TỒN TẠI** (`Select-String "closeout"` chỉ trúng `ai-m2/ai-m3/a5`, tail file là `sidebar-spa-nav/full-vitest-vps/remaining-work-plan/gate-p0/w0-9-release`) | Header plan ghi sai sự thật (BLOCKER B2) |

`audit-status-claims --strict` hiện báo **16 mở** (không có `w0-6` — vì `**in-progress**` in đậm không khớp exact-match sau lowercase, `scripts/audit-status-claims.mjs:81`; tương tự `check-multi-agent.mjs:43-48` dùng exact-match `VALID_STATUS`).

## 3. Findings

### BLOCKER B1 — AC1 (`plan:80`) không thể đạt bằng cách append-only
- **Thực tế:** `openClaims()` (`scripts/audit-status-claims.mjs:72-88`) đếm **mọi dòng** có status chính xác `in-progress`/`proposed`, không trừ các dòng `done`/`released` mới hơn, không grouping theo agent. `CLAIMS.md` là append-only (§quy tắc) nên các dòng `:1879`, `:40`, `:1883`, `:1885`, `:1887`, `:1888` tồn tại vĩnh viễn → sau khi append 3 release row, count vẫn **16**, không thể `16 → 13`.
- **Tác động:** DoD không bao giờ đạt; áp lực "cho xanh" đẩy người thực hiện tới sửa dòng cũ = vi phạm append-only.
- **Đề xuất:** viết lại AC1: "append 3 release row (`vet-finish`, `chart-widget-team`, `pm-review-20261108@:1883`); `git diff docs/CLAIMS.md` chỉ `+` ở cuối; open-row count **giữ nguyên 16 theo thiết kế**; verify stale bằng V-2/V-3/V-4/V-6/V-10 thay vì đếm".

### BLOCKER B2 — Claim slice chưa được khai nhưng header khẳng định đã có
- **Thực tế:** header plan (`plan:4`) ghi "`closeout-dot1-20261113` (`docs/CLAIMS.md`, appended, `in-progress`)" — `Select-String "closeout-dot1"` trên `docs/CLAIMS.md` trả về **0 dòng claim** (§2 bảng trên). DoD của chính plan (`plan:95`) yêu cầu "Claim `in-progress` **trước** dòng sửa đầu tiên (commit riêng)".
- **Đề xuất:** append 1 row `closeout-dot1-20261113 | feat/closeout-dot1-20261113 | scope S-C1..S-C6 + files: docs/evidence/closeout-dot1-20261113/*, docs/handoffs/HANDOFF_2026-11-13_CLOSEOUT-DOT1.md, ledger Entry 477 (không claim backend) | in-progress`, commit riêng **trước** mọi edit; sửa header thành "đã khai tại dòng :N".

### MAJOR M1 — Viện dẫn `w0-6` sai dòng, bỏ sót done row `:1791`
- **Thực tế:** plan (`plan:16`, `plan:54`) viết "HEAD `1bab98468` 'claim done' nhưng row vẫn `in-progress`" và "branch còn 6 commit chưa merge ⇒ KHÔNG stale". Đúng một nửa: 6 commit unmerged là thật (V-1, V-7) và `62e6e20a0` chạm `native_views.py` thật. Nhưng `:1785 **in-progress**` đã bị `:1791 **done**` ("PR #280 MERGED → dev", Entry 398) thay thế — 6 commit là việc round-2 trên branch chưa xóa, **không còn claim row nào bao phủ**.
- **Tác động:** kết luận hành động ("không sửa `native_views.py`") vẫn đúng và an toàn, nhưng luận cứ trong plan sai; đồng thời lộ lỗ hổng bookkeeping: branch có việc live nhưng không có claim.
- **Đề xuất:** sửa §0.1/§S-C2: cite `:1791 done` + `rev-list = 6` + `62e6e20a0 → native_views.py` làm bằng chứng chặn; thêm hành động "báo coordinator yêu cầu chủ branch merge/xóa branch hoặc khai claim round-2". Không sửa `:1785`.

### MAJOR M2 — D2 (`plan:19`) chốt breaking wire-format khi bằng chứng consumer chưa đủ
- **Thực tế:** D2 = "breaking `price` string→number **ngay** … an toàn nội bộ" với 2 luận cứ: (a) "FE đã `Number()`-hóa ở 45 chỗ" — plan không kèm grep/file:line nào; đo spot: `Number\(` xuất hiện **199** lần trong `packages/web/src/**/*.js`, tập "45 chỗ" không xác định; (b) "`chartAdapter.js:42-46` `Number()`-hóa" — verify **đúng** (`packages/web/src/adapters/chartAdapter.js:42-46` có 5 dòng `Number(...)`).
- **Thiếu:** consumer trực tiếp `packages/web/src/adapters/core/market.js` (route depth-chart `:350-356` theo spec) chứa **0** `Number(`; consumer ngoài repo (`vninvestcharts-widget` npm `^1.2.5`, third-party đọc API) chưa được audit; không có sign-off widget-team — trong khi plan gốc yêu cầu "**Bắt buộc** audit + thông báo widget team trước khi merge … Nếu chưa an toàn: thêm field số mới … cần Owner chốt" (`docs/PLAN_REMAINING_WORK_20261113.md:185-193`).
- **Giảm nhẹ:** implementation S1.1/S2.x **defer** sang sau khi `w0-6` merge (`plan:20,69,90`) nên slice này không gây breaking thật.
- **Đề xuất:** giữ D2 ở mức **đề xuất TẠM THỜI (pending widget-team sign-off + Owner confirm)**, không ghi "Owner-proxy (thay bạn…)" như quyết định cuối; bổ sung grep evidence + kết quả hỏi widget team trước khi slice backend thực thi. (Ghi nhận: D3 UPPER_SNAKE là hiệu chỉnh đúng so với `S2.2` gốc ghi `invalid_query` thường — khớp convention `INVALID_TIMEFRAME` hiện có.)

### MINOR
- **m1 — AC2 (`plan:81`) lẫn lộn lint với B-7:** B-1..B-9 không gồm lint; baseline viết "chạy ở B7" nhưng B-7 là `check-i18n-hardcoded-scope`. Sửa: nêu lệnh lint chính xác (`npm run lint` tại `packages/web`) trong AC2/DoD và chạy 1 lần pre-execution để có baseline.
- **m2 — B-11 "chỉ còn main tree":** thực tế còn 2 worktree (main + worktree slice này, V-5). Sửa chữ.
- **m3 — D7 token:** ghi nhận "Owner xác nhận đã revoke, không verify 401" là trung thực (`plan:60-61` ghi `CHƯA CHẠY`), giữ nguyên cách ghi "ghi nhận, không verify" — không nâng thành verified.
- **m4 — Tập file giữ của w0-6 round-2 rộng hơn AC4:** diff 6 commit còn chạm `commercial/tasks.py`, `identity_access/views_tenant.py`, `service_ops/views/signals.py`, `signal_intelligence/outbound_notification_service.py` + 4 file test (V-7). Slice này 0 dòng backend nên AC4 đạt tầm thường; đề xuất liệt kê full set vào §74 để slice backend sau dùng.
- **m5 — S-C2 nên nêu rõ `:1884 pm-audit-fix-plan` (agent khác, cùng branch name) KHÔNG thuộc diện release** để executor không release nhầm.

## 4. Checklist yêu cầu audit (kết quả)

| # | Yêu cầu | Kết quả |
|---|---|---|
| (a) Scope tránh file của claim non-stale | **ĐẠT** — slice 0 backend; `native_views.py`/`stock_mgmt_native_views.py` trong KHÔNG chạm (`plan:74`); `w0-6` round-2 giữ `native_views.py` thật (V-7) |
| (b) Stale có bằng chứng | **ĐẠT có lưu ý** — vet-finish (V-3+V-6+`:1881`), chart-widget (V-2+V-5+V-10), pm-review (branch mất + `:1886`/`:1889`); trừ viện dẫn w0-6 sai (M1) |
| (c) D1–D8 có lý do, không breaking ngay trong slice | **ĐẠT có điều kiện** — D1/D3/D4/D5/D6/D8 ổn (D5 Entry 476 đã xong, V-9/V-11); D2 phải hạ xuống tạm thời (M2); D7 ghi-nhận-trung-thực (m3) |
| (d) AC testable Given/When/Then | **KHÔNG ĐẠT toàn phần** — AC2–AC4 testable; AC1 unsatisfiable (B1); AC2 lẫn lint (m1) |
| (e) Không chạm deny-list | **ĐẠT** — scope: `docs/CLAIMS.md` (exempt, `check-multi-agent.mjs:41`), ledger Entry 477 (không thuộc `DENY_LIST` `check-multi-agent.mjs:27-40`), evidence/handoff file mới; `docker-compose.staging.yml` của vet-finish không bị chạm |
| (f) Lessons khớp tags | **ĐẠT** — 11/11 ID resolve (`L-001/002/003/007`→`multi-agent.md`, `L-G01/G02`→`build-gates.md`, `L-V02`→`verification.md`, `L-T01/L-F07`→`tooling-traps(-2).md`, `L-S01/S02`→`security.md` + `INDEX.md`); phủ claim/gate/worktree/probe/security |

## 5. Điều kiện để chuyển PASS

1. Sửa AC1 theo B1 (bỏ mục tiêu số đếm, gate bằng release-row + branch/worktree evidence).
2. Khai claim `closeout-dot1-20261113` + sửa header (B2) — commit riêng trước mọi edit.
3. Sửa luận cứ w0-6 theo M1 (cite `:1791` + rev-list + `62e6e20a0`).
4. Hạ D2 xuống "đề xuất tạm thời, pending widget-team sign-off + Owner confirm" (M2); bổ sung grep evidence khi slice backend chạy.

---

**VERDICT: NEED_REVISION** (2 BLOCKER: B1, B2 · 2 MAJOR: M1, M2 · 5 MINOR: m1–m5)

---

## 6. Re-audit rev 2 (2026-11-13, cùng auditor, read-only)

> Đối tượng: `docs/PLAN_CLOSEOUT_DOT1_20261113.md` rev 2 (116 dòng) + claim commit `a61530153`.
> Phương pháp: đọc plan toàn văn + `git show HEAD` + `git status`/`git diff` + rerun `rev-list` w0-6.

### 6.1 Đối chiếu 4 điều kiện §5

| # | Điều kiện | Kết quả rev 2 |
|---|---|---|
| C1 (B1) | AC1 bỏ mục tiêu số đếm | **ĐẠT** — `plan:81` gate bằng release-row + branch/worktree evidence; ghi rõ open-row count giữ nguyên theo thiết kế append-only, verify stale bằng V-2/V-3/V-4/V-6/V-10 |
| C2 (B2) | Claim + sửa header | **ĐẠT** — row `closeout-dot1-20261113` tại `:1934` (hunk `@@ -1931,3 +1931,4`), commit riêng `a61530153` (1 file, 1 insertion); header `plan:4` ghi `:1934` + hash; nợ L-002 ghi ở `plan:10` |
| C3 (M1) | w0-6 cite `:1791` + rev-list + `62e6e20a0` | **ĐẠT** — `plan:16` + `plan:57`: `:1791 done` (Entry 398) + `rev-list = 6` + `62e6e20a0 → native_views.py (+8)`; thêm hành động báo coordinator |
| C4 (M2) | D2 xuống provisional | **ĐẠT** — `plan:19` + §10: "đề xuất, CHƯA PHẢI quyết định cuối — pending widget-team sign-off + Owner confirm"; gap grep ghi trung thực ("45 chỗ" chưa định danh, `market.js` 0 `Number(`) |

### 6.2 Đối chiếu 5 MINOR

- **m1 lint: ĐẠT** — `plan:82` nêu `npm run lint` tại `packages/web`, phân biệt rõ B-7 là i18n scope.
- **m2 B-11: ĐẠT** — `plan:38` sửa thành "main tree + worktree slice này".
- **m3 D7: ĐẠT** — giữ "ghi nhận, không verify" + `CHƯA CHẠY` verify 401.
- **m4 full set: ĐẠT** — `plan:16`/`plan:57` liệt kê 5 backend files (`native_views.py`, `commercial/tasks.py`, `views_tenant.py`, `views/signals.py`, `outbound_notification_service.py`) + 4 file test; tên 4 file test để executor ghi khi chạy (R2).
- **m5 `:1884`: ĐẠT** — `plan:58` + claim scope đều ghi KHÔNG release `pm-audit-fix-plan :1884`.

### 6.3 Spot-check git (chạy thật)

- `git log --oneline`: `a61530153` (claim) atop `e76f66689` ✓
- `git show --stat HEAD`: `docs/CLAIMS.md` 1 insertion ✓
- `git diff --numstat docs/CLAIMS.md` (working tree): rỗng — ĐÚNG vì claim đã commit; `git diff HEAD~1 --numstat`: `1 + / 0 -` ✓ khớp kỳ vọng append-only
- `git status --short`: chỉ 2 untracked (`PLAN_CLOSEOUT…`, `evidence/closeout-dot1-20261113/`), 0 modified tracked ✓
- `git rev-list --count dev..origin/feat/w0-6-data-honesty`: **6** (rerun, khớp `plan:39`/B-12) ✓
- §10 mapping table `plan:104-116`: đủ 9 hàng B1/B2/M1/M2/m1–m5 ✓

### 6.4 Reservation (quan sát, không phải objection)

- **R1** — claim scope liệt kê pm-review `:1883/:1885/:1887/:1888` trong khi AC1/S-C2 chốt 1 release row gộp @`:1883` (vì `:1885`/`:1887`–`:1888` đã superseded bởi `:1886`/`:1889` done). Executor nên nêu rõ điểm này trong release row để khỏi hiểu là còn hở.
- **R2** — tên 4 file test round-2 chưa nêu (kế thừa độ hạt V-7); executor liệt kê khi chạy AC4. Người đóng: **executor ở bước S-C2**, không chặn slice.
- **R3** — D2 giữ provisional tới khi có widget-team sign-off + Owner confirm. Người đóng: **coordinator + Owner ở bước slice-backend**; bookkeeping w0-6 round-2 (merge/xóa branch hoặc claim mới) cũng do **coordinator ở bước slice-backend**, slice này chỉ ghi blocker.

**VERDICT: AGREE** (rev 2 đóng đủ 4 điều kiện §5 + 5 minor; thực thi theo reservation R1–R3)
