# AUDIT TỔNG THỂ + HANDOFF — Đánh giá công việc đã làm & hướng triển khai (2026-11-09)

> **Date**: 2026-11-09 · **Mode**: audit doc-only, read-only code (không đổi runtime) · **Vị trí**: local `dev` @ `26e44d203` (= `origin/dev`, PR #308 merge) · **Staging**: VPS `14.225.255.47:/opt/vninvest` @ `5f9422694` (tre 16 commits) · **Working tree**: `M docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 427 chưa commit) + `?? docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` (untracked)
>
> **Lessons áp dụng**: [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-T01, L-T02] — trích từ `docs/LESSONS/verification.md:10-84`, `docs/LESSONS/multi-agent.md:6-118`, `docs/LESSONS/tooling-traps.md:44-82`. File đã đọc: `verification.md`, `multi-agent.md`, `tooling-traps.md` (không đọc cả `docs/LESSONS/`).

LESSONS APPLICABLE (9):
- [L-001 | Shared deny-list] — QUY TẮC: Không commit file deny-list, ghi claim + báo coordinator
- [L-002 | Khai claim trước] — QUY TẮC: Claim commit riêng trước dòng code đầu tiên, kể cả solo
- [L-003 | Gate sau rebase] — QUY TẮC: Thứ tự rebase → check migration → gate
- [L-007 | Không môi trường] — QUY TẮC: Chưa chạy được ghi CHƯA CHẠY, không suy ra PASS
- [L-V01 | Control] — QUY TẮC: Script đo phải có control biết đáp án trước khi tin
- [L-V02 | Gốc rễ kế thừa] — QUY TẮC: Root cause người khác ghi phải có phản chứng fail-before
- [L-V04 | Test xanh giả] — QUY TẮC: Assert giá trị thật + test dương tính
- [L-T01 | EOL] — QUY TẮC: `git diff --numstat` là cảnh báo sớm nhất về EOL
- [L-T02 | Citation] — QUY TẮC: Citation là (file, dòng, nguyên văn), không phải trí nhớ

MANDATORY CHECKLIST (tick trước khi coi xong):
- [x] Mọi khẳng định kèm `file:line` có thể mở đọc; không đoán (L-V02, L-T02)
- [x] Không báo PASS cho thứ chưa chạy — ghi CHƯA CHẠY (L-007)
- [ ] Audit này không sửa runtime, không migration, không đụng deny-list (L-001)
- [ ] Sau khi ghi file này phải `git status --short` để bắt side-effect (L-V03, `verification.md:57-71`)
- [ ] Coordinator merge entry này kèm Entry 427 đang pending (L-003: gate sau rebase)

---

## 0. Tóm tắt 5 findings nghiêm trọng nhất (đọc phần này nếu vội)

1. **[P0 NEW] Staging workers + beat crash-loop từ deploy Nov-08** — `vninvest-core-worker` RestartCount=1486, beat=837, `kombu.exceptions.VersionMismatch` (cần redis-py>=6.1.0, image có 5.3.1). Root: `packages/core/backend/requirements.txt:9` pin `redis>=5.0,<6.0` vs `packages/core/pyproject.toml:19` cho `celery>=5.4,<6.0` kéo kombu mới. Evidence: `docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` §3 + `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 427 (pending). **Hệ quả**: api/frontend sống nhưng mọi celery/beat task trên staging chết; `--verify` báo PASS vì container restarting hiện `Up` không phải dead. **Fix phải ở coordinator** (requirements thuộc deny-list §2).
2. **[STALE DOC] MASTER_TRACKING dừng ở 2026-10-22, code đã chạy tới Entry 427 (Nov-09)** — `docs/MASTER_TRACKING_2026Q4.md:5` ghi `dev @91bad0440` trong khi `git log origin/dev` = `26e44d203` (+PR #285–#308). AGENTS.md vẫn ghi widget `vninvestcharts-widget ^1.2.5` trong khi `packages/web/package.json:108` là `file:vendor/...tgz` (Entry 408, registry UNPUBLISH 2026-10-22). Phiên sau đọc MASTER_TRACKING là đọc sai baseline.
3. **[HANDOFF LẨU] 3 dòng claim `pm-review-20261108` vẫn `in-progress` trong khi work đã ghi `done`** — `docs/CLAIMS.md` tail: W0-1, W0-3, W0-6 còn `in-progress` (2026-11-08) dù dòng `W0-3/W0-6/W0-8/W2-1 DONE (rev1)` ghi `done` (B8 PASS: route-contract 4/4, tsc 0). Registry drift kiểu Entry 404 I-2 lặp lại; `check-multi-agent` vẫn PASS nên gate không chặn.
4. **[GAP TEST] Các nợ T2/T3/T4 vẫn mở, không ai triage** — T1 (AC5 CRLF) đã đóng ở Entry 426 (7/7 PASS, tsc 0, `ai-cc-i18n-clean.component.test.ts:127-129` chuẩn hoá EOL), nhưng T2 (`auth-forms-rhf-extra` treo khi chạy lẻ), T3 (`agent-sync.ps1`/`agent-cleanup.ps1` parse PS 5.1), T4 (BE suite + axe/visual + C3/D1/D2) vẫn y nguyên theo `docs/PLAN_NEXT_PHASE_20261108.md:62-80` + `docs/SESSION_HANDOFF_UIUX_20261108.md:33-43`. Không có verdict mới nào trong 2 ngày qua (Nov-08 → Nov-09).
5. **[RISK VẬN HÀNH] Staging là 1 host duy nhất, đang tre 16 commits + hotfix ngoài-git + chặn [X]** — VPS `/opt/vninvest` @ `5f9422694` thiếu LP1 backend `205867b84`, dirty `M docker-compose.staging.yml` (+5 `CORE_AD_SIGNING_SECRET`, đã document Entry 423), 5 untracked (`.py`, `.bak`, dump). Mọi test BE/build phải lên VPS (cấm local Docker) nhưng host đang crash-loop; CI GitHub vẫn [X] billing (`docs/OPEN_WORK_SEC_20260929.md:178-186`, 8 workflow disabled, 40/40 fail, steps=0). Không có lưới thứ hai.

---

## A. Bản đồ kiến trúc (đã verify bằng đọc code thật — từ MASTER_TRACKING + code inspection Entry 417)

| Miền | Quy mô (đã đo) | Trách nhiệm | Bằng chứng hiện hành |
|---|---|---|---|
| BE 16 Django app | ~93k LOC · 291 test file | `identity_access` auth/tenant/PAT/partner (110 route) · `user_workspace` portfolio+ledger+broker+AI-CC · `service_ops` SOC · `advisory` BYOK · `market_data`/`market_serving`/`signal_intelligence` | `docs/MASTER_TRACKING_2026Q4.md:29-46` (bảng LOC) · `docs/PM_FUNCTIONAL_TREE_20261108.md` (L0–L4 tree) |
| FE 69 route | 421 file prod · ~110k LOC · 215 test file | Auth/Market/Portfolio (15) · Signals+AI (7) · Tenant-admin (17) · Operator/SOC (11) | `docs/MASTER_TRACKING_2026Q4.md:50-57` |
| Contract gate | 396 call site · 521 route core (sau W0-1 fix 631→521) | `route-contract.test.js` là source of truth FE→BE | Entry 418: `identity_access/urls.py:75` bỏ duplicate, manifest regen; `docs/CODE_CHANGE_AUDIT_LEDGER.md:96-103` |
| Design system | `soc.tokens.css` 211 dòng · `soc.components.css` 4061 dòng · `soc.module.css` 3 dòng barrel (0 token) | Token → tokens, class → components, **cấm** module.css | `docs/MASTER_TRACKING_2026Q4.md:60` · AGENTS.md §Constraints |
| Packages phụ | `mobile` 3823 LOC · `opencore` 62 · `vip-app` 684 | Scaffold, không nối CI, không consumer | `docs/MASTER_TRACKING_2026Q4.md:64-70` |
| Vendor chart | `packages/web/vendor/vninvestcharts-widget-1.2.5.tgz` 2.6MB · `file:` spec | Thay npm registry đã UNPUBLISH 2026-10-22 | Entry 408: `docs/CODE_CHANGE_AUDIT_LEDGER.md:186-190` |

> **Lưu ý stale**: Bảng LOC/route count trên là số của Oct-22. Sau Entry 415–420 (ruff, intraday, UI/UX) số này đã lệch. Không dùng để ước lượng hôm nay — xem §C.

---

## B. Luồng dữ liệu đã trace (use-case quyết định, kèm file:line)

### B1. Order DNSE — khép vòng FE↔BE (đã đóng PA-1/PA-5)

- FE: `packages/web/src/adapters/core/workspace.js:23-30` gửi `mode:'paper'` + `Idempotency-Key` header (PA-5, Entry PA-5: `6c2a4491`/`180a6b60`)
- BE: `packages/core/backend/src/user_workspace/views_dnse.py:301-404` validate `mode` ∈ {paper,live} + allowlist `market_type`/`order_category`, live → `live_ordering_disabled` khi thiếu license
- Audit: `packages/core/backend/src/user_workspace/services/idempotency.py` dùng Django cache TTL 7 ngày (chưa phải `OrderJob`) — nợ `docs/CLAIMS.md:152-153`

### B2. AI Advisory — đang vi phạm D2 (chưa đóng)

- LLM bị ép: `packages/core/backend/src/advisory/orchestrator.py:717-723` yêu cầu `signal: BUY|SELL|HOLD` + `target_price`
- OWNER D2 (`docs/MASTER_TRACKING_2026Q4.md:95`): AI = **phân tích kỹ thuật**, không khuyến nghị, không đặt lệnh ngoài hợp đồng
- Trạng thái: W2-1 đã đổi prompt rev1 (Entry 419) nhưng chưa xong contract → vẫn P0 theo `docs/PM_BUG_GAP_MATRIX_20261108.md:80` (M6-01)

### B3. Depth chart — synthetic nhưng tiêu thụ như thật

- BE: `packages/core/backend/src/market_serving/native_views.py:430,451,522` (`is_mock:True`, `synthetic_from_snapshot`), sinh 3 bid/3 ask từ snapshot (`:469-511`)
- FE: `packages/web/src/components/workstation/StockOrderBookWidget.jsx:153-161` đã có badge "Ước tính" (D6), nhưng `chartAdapter.js:154-176` poll 5s vào widget repo ngoài **không có badge**
- Tác động: retail hiểu nhầm là order book thật (`docs/PM_BUG_GAP_MATRIX_20261108.md:10`, M2-01)

---

## C. CONTRADICTIONS (plan/doc vs code) — doc nói một đằng, code nói một nẻo

| # | Doc (file:line) | Thực tế (file:line / lệnh) | Tác động |
|---|---|---|---|
| C1 | `docs/MASTER_TRACKING_2026Q4.md:5` ghi `dev @91bad0440` (2026-10-22) | `git log origin/dev` = `26e44d203` (PR #308, 2026-11-08 23:38 +0700) | Baseline trong MASTER_TRACKING outdated 17 ngày, 20+ PR |
| C2 | AGENTS.md ghi widget `vninvestcharts-widget ^1.2.5` | `packages/web/package.json:108` = `file:vendor/vninvestcharts-widget-1.2.5.tgz` (Entry 408) | Audit widget phải đọc vendor local, không tra npm |
| C3 | `docs/OPEN_WORK_20260927.md:134` baseline BE `602 test — failures=10, errors=3` | `docs/MASTER_TRACKING_2026Q4.md:267` baseline `3468/12/224/7` (Entry 402 đo lại) | So baseline cũ là sai; lấy 3468 + Entry 415 (427+620+1074+508+314+32 OK) |
| C4 | `docs/OPEN_WORK_20260927.md:39-40` ghi PR #272/#273 **OPEN** | Đã merge (đính chính ở `OPEN_WORK_20260927.md:594-597`: "PR #272/#273 **đã merge**") | Đọc nhầm là pending |
| C5 | CLAIMS `pm-review-20261108` còn 3 dòng `in-progress` | Dòng `done` đã có cho cùng work (W0-1 B8 PASS `0/521`, W0-3/W0-6 rev1 B8 PASS) | Registry drift, file tưởng đang bị giữ không bị |
| C6 | Entry 423/424 ghi staging `--verify` PASS | Audit Entry 427 ghi workers loop từ deploy Nov-08 (RestartCount 1486), `--verify` không bắt | PASS của verify là **xanh giả** (L-V04): restarting ≠ dead |
| C7 | `scripts/deploy-remote.ps1:9` + `deploy-server.sh:20` default branch `enterprise` | `git branch -r` không có `enterprise`; staging chạy `dev`. `docs/DEPLOY_DOCKER_EDUSUCCESS.md:184-188` ghi flow `checkout main` trong khi staging `dev`, `main` chết từ Sep-27 | Script mặc định chạy vào nhánh không tồn tại; doc deploy lệch staging |
| C8 | `docs/OPEN_WORK_20260927.md` (OW-01..OW-06) **trùng số hiệu** với `docs/OPEN_WORK_SEC_20260929.md` (OW-01..OW-05) cho việc khác nhau hẳn | Đã có cảnh báo ở `AGENTS.md` + `OPEN_WORK_SEC:16-30` | Tra "OW-01" là ra việc khác nhau; phải ghi tên file |

---

## D. Findings (ID | Mức | file:line | Thực tế | Tác động | Đề xuất)

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất (1 dòng) |
|---|---|---|---|---|---|
| AUD-01 | **ERROR P0** | `requirements.txt:9` vs `pyproject.toml:19` | redis 5.3.1 vs kombu cần >=6.1.0 | Worker/beat crash-loop | Coordinator bump `redis>=6.1.0` + rebuild (chặn deny-list) |
| AUD-02 | **ERROR P1** | `scripts/deploy-staging.sh` (--verify) | Không check RestartCount/uptime | --verify PASS giả, mask P0 | Thêm check RestartCount>0 → FAIL |
| AUD-03 | **RISK P1** | staging `/opt/vninvest` @ `5f9422694` | Tre 16 commits, thiếu LP1 `205867b84` | Staging thiếu backend mới nhất | Pull lên `26e44d203` sau AUD-01 |
| AUD-04 | **GAP P1** | `.github/workflows-disabled/` (8) | 200/200 run fail steps=0, billing ngoài | Không lưới CI thứ hai | Owner trả billing rồi `git mv` (đã ghi `OPEN_WORK_SEC:178-186`) |
| AUD-05 | **GAP P1** | `advisory/orchestrator.py:717-723` | AI contract BUY/SELL/HOLD + target | Vi phạm D2 pháp lý | Đổi schema → `posture/levels` + disclaimer (W1.1, nền W2.1) |
| AUD-06 | **GAP P1** | `packages/core/backend/src/commercial/test_license.py` (untracked, `license-portal-lp1`) | LP1 backend đã merge `205867b84` nhưng test untracked ở main tree? | Chưa xác minh LP1 | Chạy test LP1 trên VPS trước khi đóng license-portal |
| AUD-07 | **RISK P1** | `market_serving/native_views.py:430` | Depth mock 100%, badge chỉ 1 nơi | Retail tưởng book thật | Gắn badge mọi nơi tiêu thụ (D6) |
| AUD-08 | **GAP P2** | CLAIMS tail `pm-review-20261108` | 3 `in-progress` stale | Che mất file ownership thật | Đóng bằng `superseded`/`done` 1 từ/dòng như Entry 425 |
| AUD-09 | **GAP P2** | `docs/PLAN_NEXT_PHASE_20261108.md:62-80` T2/T3 | Treo BE suite, PS 5.1 parse, axe/visual | Nợ infra lặp lại mỗi phiên | Mở 1 ticket cho T3 trước (dễ nhất), T2 cần repro ×3 trên VPS |
| AUD-10 | **RISK P2** | `docs/OPEN_WORK_SEC_20260929.md:49-51` OW-01 | `CORE_PAT_PEPPER` 11 commit còn dùng, Owner trì hoãn rotate | Lên prod/public là P0 | Mở lại rotate trước deploy prod |

Không có finding nào dưới mức "đề xuất 1 dòng" — mọi mục đều có file:line hoặc lệnh tái hiện.

---

## E. Quality gates audit (chạy thật phiên này vs CHƯA CHẠY)

| Cổng | Lệnh | Kết quả phiên này (2026-11-09) |
|---|---|---|
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng migration (dòng cảnh báo file cũ không chặn). Chạy lúc B1, `main tree` đang có `M ledger` + `?? audit doc` không ảnh hưởng check |
| Lessons | `node scripts/check-lessons.mjs` | **PASS** — 14 file \| 57/60 lesson, `backend.md 48d/4bai` … — sách (không vi phạm C1/C2/C3) |
| Git | `git log --oneline -15 origin/dev` + `git status --short` | `26e44d203` PR #308; `M docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 427 pending) + `?? docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` |
| Requirements pin | `Select-String requirements.txt` + `pyproject.toml` | `requirements.txt:9 redis>=5.0,<6.0`, `pyproject.toml:19 celery>=5.4,<6.0` — khớp Entry 427 F1 |
| Type-check | `npx tsc --noEmit` | **CHƯA CHẠY** phiên này (Entry 426 đo 0 lỗi ở HEAD của nó; không suy ra HEAD mới) |
| FE suite | `npx vitest run` full | **CHƯA CHẠY** phiên này — kế thừa Entry 424 `1198/1199` (177/178 files) ở HEAD cũ |
| BE suite | `manage.py test` trên VPS | **CHƯA CHẠY** — host đang crash-loop workers, cần AUD-01 xong trước |
| VPS verify | `bash scripts/deploy-staging.sh --verify` | **CHƯA CHẠY** phiên này — cần rebuild image sau AUD-01 |
| E2E / axe / visual | Playwright + browser trên VPS | **CHƯA CHẠY** — cần staging + browser (handoff §4) |

> Trung thực số liệu: mọi số trên đều là lệnh đã chạy phiên này, trừ các ô `CHƯA CHẠY` (L-007, L-V01). Không claim PASS cho thứ chưa chạy.

---

## F. Đánh giá công việc đã làm (tổng hợp từ ledger + handoff, không vượt quá 5 findings ở §0)

### F1. Đã đóng và có bằng chứng mạnh

- **Portfolio Commercial PA-1..PA-5 (#12–#17)**: order fail-closed + 2 P0 mới X.1/X.2 + tenant FK + idempotency + FE `mode`/`Idempotency-Key`. AC 10/10 PA-1, 50/50 test, 0 conflict (Entry PA-1, `docs/CLAIMS.md:118-142`).
- **Tenant register 6 slice (`tenantreg-*`)**: client-IP SSOT, reset/revoke PAT, tenant isolation, quota, FE auth — file-disjoint, merge 0 collision. Còn 3 item mở có lý do (quota day/month unit, AuditLog scope, commercial member 500) — `docs/CLAIMS.md:171-200`.
- **W0 FOUNDATION (#278–#284)**: wire 3 gate chết → `pre-push-gate` 28→34 PASS, contract gate hồi sinh (396 call, 0 path không resolve), 7→13 indicator, gap-1/gap-2 đóng, manifest 631, `exports` 10/10 fix. Kết luận W0.2 "không xoá được" đã refute bằng chạy thật trên VPS (Entry 402).
- **UI/UX Phase B (#302–#305, Entry 422–424)**: B2 6/6, B3 6 file i18n, B4 gate scope (306/306), B5 scope/aria (61 th), C1/C2 widget defer (dashboard 3834KB đo thật), auth closeout 15→29/29 (66/66), AC4 canonical, verdict v4 **AGREE**, full suite 177/178 files 1198/1199, staging deploy+verify PASS (lúc đó chưa phát hiện crash-loop).
- **Gates-fix + T1 (#307–#308, Entry 425–426)**: AC11 CRLF + system-design 118/45 + honest SKIP django-missing + hygiene 3 stale claims → `pre-push-gate` 34 PASS/2 SKIP/0 FAIL. T1: AC5 refute "93 dòng comment" (0 runtime hit, gốc là CRLF checkout), fix chuẩn hoá EOL `ai-cc-i18n-clean.component.test.ts:127-129`, 7/7 PASS, tsc 0, B8 PASS 0 blocker.
- **PM review rev1 (Entry 417)**: 6 blocker B3/B8 được gỡ (SOC prefix bác bỏ → partner double-mount thật 110 route, SAFE-04 đã merge PR #75, `loadError` đủ 2 locale, W0.5 xong PR #281). Rửa phèn false-positive nghiêm ngặt.
- **Workflow-dev-loop (Entry 406)**: học `erp-dev-loop`, đặt làm mặc định, luật cứng "mọi audit phải thành văn bản" (luật #6) — chính file này tuân theo.

### F2. Làm dở / partial (đã ghi nợ, chưa có verdict mới)

- **LP1 backend (`205867b84` LicenseKey)**: model + service + 7 views + routes đã merge, nhưng `test_license.py` untracked ở main tree + `license-portal-lp1` còn branch và file `5315e7cca`/`267c3d41a`/`d1b1cc611` trùng tên câu (3 commits cùng message trên 3 base khác nhau?). Cần coordinator quyết: merge hay bỏ. Evidence `git log --all --grep="LP1"` ở §E.
- **W0.7 SAML**: `python3-saml` import lỗi `libxml2 version mismatch`, `xmlsec1` CLI có sẵn — chờ Owner chọn (a) rebuild image hay (b) CLI verify (`docs/MASTER_TRACKING_2026Q4.md:152`).
- **gap-3 `/ai/agents/`**: FE gọi, BE rỗng — đang thực hiện gỡ UI ở W0-3 (`workspace.js:727-739` + `route-contract.test.js:168-171`), B8 PASS nhưng chưa merge vào `dev` (manifest regen cần chạy script VPS).
- **Editorial debt**: `docs/MASTER_TRACKING_2026Q4.md` stale từ Oct-22; `ROADMAP_STATUS.md` (Apr-03), `PROGRESS_DASHBOARD.md` (Oct-03) đã có banner nhưng chưa archive; `AGENTS.md` deny-list không sửa được.

### F3. Quy trình đã được cải thiện thật (không phải lý thuyết)

- **TDD + fail-before**: Entry 418 (110/631→0/521), Entry 423 (tenantreg-auth-pages 15 FAIL→29 PASS), Entry 426 (1 failed|6 passed→7/7 PASS) đều có số trước/sau.
- **Không tin claim kế thừa**: Entry 407 (W1.4-salvage refute StockChartView là view chết), Entry 426 (refute "93 dòng"), Entry 402 (refute grep dotted) — đây là lớp bảo vệ chống xanh giả tốt nhất của repo.
- **Gate trung thực**: Entry 425 chuyển `exit 2` → `SKIP` có lý do, không nuốt FAIL; self-test tích hợp với fake gen; `check-multi-agent` + `check-lessons` chạy thật mỗi phiên (§E).

---

## G. Handoff tổng hợp (dồn các handoff phiên trước thành 1 trang)

| Handoff | File nguồn | Trạng thái sau handoff | Việc còn lại truyền cho phiên này |
|---|---|---|---|
| UI/UX close-out | `docs/SESSION_HANDOFF_UIUX_20261108.md` + Entry 424 | Phase B đóng, full suite 1198/1199, staging xong | T1/T2/T3/T4 → `docs/PLAN_NEXT_PHASE_20261108.md` |
| Next-phase | `docs/PLAN_NEXT_PHASE_20261108.md` (T0–T4) | T0 guard ops, T1 AC5, T2 treo, T3 PS 5.1, T4 BE/axe/C3-D1-D2 | T1 xong Entry 426; **T2/T3/T4 vẫn mở** (§D AUD-09) |
| PM review 20261108 | `docs/PM_BUG_GAP_MATRIX_20261108.md` + `docs/PM_ROADMAP_UPGRADE_20261108.md` + `docs/PLAN_PM_AUDIT_FIX_20261108.md` | Rev1 6 blocker đã gỡ, W0-1/W0-3/W0-6/W0-8/W2-1 rev1 xong | Manifest regen VPS, route-contract VPS, BE regression VPS — **chưa chạy** (AUD-03) |
| W0 foundation | `docs/HANDOVER_W0_FOUNDATION_20261022.md` + `docs/MASTER_TRACKING_2026Q4.md` §5–§6 | W0.1/W0.3/W0.5/W0.6/W0.9/W0.10 xong; W0.2/W0.4 kết luận "không xoá" | **Phase A (A1–A5)** ở `docs/MASTER_TRACKING_2026Q4.md:164-172` vẫn là việc tiếp theo |
| SEC / CI | `docs/OPEN_WORK_SEC_20260929.md` + `docs/OPEN_WORK_20260927.md` §2b | OW-01 rotate trì hoãn có chủ đích (repo PRIVATE), OW-03 CI tắt có chủ đích | Mở lại khi lên prod/public (AUD-04, AUD-10) |
| Audit VPS mới nhất | `docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` + Entry 427 (pending) | Phát hiện P0 crash-loop, staging tre 16, hotfix ngoài-git | AUD-01..03 (coordinator) |

---

## H. Hướng triển khai tiếp theo (thứ tự ưu tiên, kèm effort + dependency)

### Ưu tiên 0 — Staging P0 (coordinator, [T], blocker mọi test BE)

1. **AUD-01**: bump `redis>=6.1.0` trong `packages/core/backend/requirements.txt:9`, verify `channels-redis>=4.1,<5.0` tương thích (`requirements.txt:23`), rebuild `vninvest-core-api:staging`, `deploy-staging.sh`, check `RestartCount=0` + uptime ổn định ≥30 phút. *Deny-list nên coordinator làm, không tự sửa ở phiên audit.*
2. **AUD-02**: patch `deploy-staging.sh --verify` — FAIL nếu bất kỳ service nào `RestartCount>0` hoặc `Status` chứa `Restarting` quá 5 phút (trừ service vừa deploy có chủ đích).
3. **AUD-03**: `git stash` hotfix secret trên VPS → `git pull origin dev` lên `26e44d203` → `git stash pop` kiểm tra conflict `docker-compose.staging.yml` (+5 hunks nếu có), chạy `manage.py migrate` trước mọi `reencrypt` (nhắc `OPEN_WORK_SEC:93-98`).

### Ưu tiên 1 — Phase A đóng W0 (không cần Owner, [T], S/M effort)

Theo `docs/MASTER_TRACKING_2026Q4.md:164-172` (đã verify lại ở Entry 417):

- **A1**: 2 lỗi thật còn treo `timezone.utc` (`advisory/pricing.py:160`) + 5 endpoint `broker_*` envelope (`test_api_envelope_schema.py:607`) — có test khoá sẵn, BE test VPS sau AUD-01.
- **A2**: vệ sinh registry — đóng 3 dòng `pm-review-20261108 in-progress` stale (§C C5) bằng `superseded` (tiền lệ Entry 425).
- **A3**: backfill ledger + sửa trích dẫn PR sai của W0.8a (không có PR, chỉ commit `31dcae058`/`91bad0440`) — doc-only.
- **A4**: đính chính roadmap W0.4 + W0.2 ("không xoá được", Entry 402) — doc-only, theo cách Entry 402.
- **A5**: OpenClaw → tính năng hỗ trợ (D4, fail-closed có lý do) + ghi `ai_agents` chờ Owner.

### Ưu tiên 2 — Phase B W1 (2 agent song song sau Phase A, [T])

- **B1 (W1.1)**: AI contract → **phân tích kỹ thuật** (bỏ `signal`/`target_price`/`recommendation`) — nền cho W2.1. Effort L.
- **B2 (W1.2)**: gỡ order placement (D2) — `live` trả 4xx, nhãn "phiếu thử nghiệm", giữ `paper`. Effort M.
- **B3 (W1.3)**: depth minh bạch — badge "Ước tính" mọi nơi tiêu thụ (AUD-07), phần widget vendor là [X].
- **B4 (W1.4 phần còn lại)**: `materialize_unified_alerts` NOOP · indicators None · AI news null · news digest rỗng · discovery hub rỗng. Effort M.
- **B5 (W1.6)**: minh bạch whale/dark flow (`dark_flow_score` = absorption proxy + nguồn + freshness). Effort M.
- **B6 (W1.8) / B9 (W1.5)**: SAML strict verify thật + 2 tầng broker — **chờ Owner Q2/Q4/Q5/Q6** (§J).

### Ưu tiên 3 — Infra nợ (ticket riêng, không gộp vào W1)

- **T3** (`agent-sync.ps1`/`agent-cleanup.ps1` PS 5.1 parse) — probe parse-only local, sửa nhỏ nhất, không sửa script khác. Làm trước T2 vì là infra dễ lặp.
- **T2** (`auth-forms-rhf-extra` treo lẻ) — repro ×3 trên VPS, trace, không sửa production khi chưa có root cause; quá 3 vòng → ghi blocker giữ ticket mở.
- **T4** (BE suite + axe 5 route 390×851 + visual 5 route ×2 theme + C3/D1/D2) — **không mở** khi chưa có GO của owner (§J, AUD-09).

**Thứ tự đề xuất cho 1 tuần tới**: AUD-01/02/03 (1 ngày, coordinator) → A1+A2+A5 (2 ngày, song song 2 agent) → A3/A4 doc-only (0.5 ngày) → B1+B2 song song (1 tuần) → [X] billing/secret chờ owner không chặn W1 (theo ROADMAP §4.7: được phép làm tiếp W1–W3 không cần chờ bất kỳ mục [X] nào).

---

## I. Cân nhắc môi trường & gate VPS

- Mọi test BE/FE/build nặng chạy **VPS staging `14.225.255.47`**, **cấm local Docker** (`AGENTS.md` + `docs/STAGING_VPS_RUNBOOK.md` §12, `scripts/check-experiment-env.mjs` là cổng máy).
- Phiên này chỉ chạy gate nhẹ local (`check-multi-agent`, `check-lessons`) — đúng §12.1. BE/FE/VPS là **CHƯA CHẠY** (L-007), không báo PASS.
- `saas.edusuccess.vn` và `14.225.255.47` là **cùng 1 máy** (`edusuccess-xyjn`) — tránh nhầm 2 host (`docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` §0).
- Sau AUD-01, VERIFY bắt buộc: `RestartCount=0` cho 5 worker/beat, `curl http://127.0.0.1:8080/api/core/v1/health` 2xx, không container mới `Restarting`, và `network` không mất secret `CORE_AD_SIGNING_SECRET`.

---

## J. Câu hỏi cần owner/coordinator chốt (gate của việc tiếp theo)

| # | Câu hỏi | Chặn slice nào | Nguồn |
|---|---|---|---|
| Q1 | Duyệt bump `redis>=6.1.0` và rebuild staging khi nào? | AUD-01 | Entry 427 §Next |
| Q2 | `contracts/admin_ops` (2470 LOC + 740 test) giữ hay xoá? | W0.2 chốt | `docs/MASTER_TRACKING_2026Q4.md:277` |
| Q3 | SAML: (a) rebuild image sửa `lxml/xmlsec` hay (b) verify bằng `xmlsec1` CLI? | W1.8 (P0) | `docs/MASTER_TRACKING_2026Q4.md:276` |
| Q4 | gap-3 `/ai/agents/`: implement BE hay gỡ UI (W0-3 mặc định là gỡ)? | W0.7 | `docs/MASTER_TRACKING_2026Q4.md:275` |
| Q5 | Tên vai trò staff thứ 2 (không dùng "COC")? Credential tầng 2 thuộc tenant hay operator? | W1.5 | `docs/MASTER_TRACKING_2026Q4.md:281-282` |
| Q6 | Ai trả chi phí LLM cho user free? | W2.3 (W2) | `docs/MASTER_TRACKING_2026Q4.md:280` |
| Q7 | Bỏ trial 14 ngày hay giữ? Free có quảng cáo không? | W1.9 / W3 | `docs/MASTER_TRACKING_2026Q4.md:278-279` |
| Q8 | Mở C3/D1/D2 trong đợt này không, hay giữ defer? | T4 | `docs/PLAN_NEXT_PHASE_20261108.md:77-80` |

**PP**: Các Q trên đã có default trong `docs/PLAN_PM_AUDIT_FIX_20261108.md:65-69` để dev không phải hỏi lại — nhưng vẫn cần xác nhận chính thức của owner trước khi code.

---

## K. Kết luận & next step của chính audit này

- Audit này là **B8 re-audit độc lập** (chỉ đọc, không chạm runtime) cho các việc Entry 415–427. Verdict: **AGREE** với các verdict trước (Phase B v4 AGREE, gates-fix B8 PASS, T1 B8 PASS), kèm **1 blocker mới AUD-01** (P0 workers) mà các vòng trước chưa phát hiện vì `--verify` xanh giả.
- Việc tiếp theo **không phải** sửa code ở phiên này. Coordinator cần: (1) commit Entry 427 + audit này kèm Entry 428 (xem ledger), (2) AUD-01/02/03, (3) mở 2 agent cho A1/A5 + A2.
- Nếu AUD-01 chưa xong, mọi BE test trên VPS đều **CHƯA CHẠY** và không có kết luận mới được.

**Evidence files**: `docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` (untracked), `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 427 (pending), `docs/PLAN_NEXT_PHASE_20261108.md`, `docs/SESSION_HANDOFF_UIUX_20261108.md`, `docs/PM_BUG_GAP_MATRIX_20261108.md`, `docs/MASTER_TRACKING_2026Q4.md`, `docs/OPEN_WORK_20260927.md`, `docs/OPEN_WORK_SEC_20260929.md`, `docs/CLAIMS.md` (tail).

*Ponytail note*: File này không sửa runtime, không migration, không đụng deny-list. Rủi ro còn lại: `requirements.txt` bump chưa làm (AUD-01) — staging vẫn crash-loop cho đến khi coordinator xử lý.
