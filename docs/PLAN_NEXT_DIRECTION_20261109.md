# PLAN — Hướng tiếp theo để đội code thực hiện (P0 → Phase A → Phase B) — 2026-11-09

> **For agentic workers:** REQUIRED SUB-SKILL: Dùng `workflow-dev-loop` B3/B4 (audit plan độc lập, verdict bằng văn bản) → B5 claim → B6 TDD → B7 gates → B8 re-audit. Steps dùng checkbox (`- [ ]`). **Plan này là B2 — chưa B3/B4, chưa khai claim, chưa viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6).**

**Goal:** Đóng P0 staging (workers crash-loop) rồi đóng W0 (Phase A) và mở W1 retail activation (Phase B) theo lộ trình đã chốt ở `docs/EVALUATION_HANDOFF_20261109.md` §H.

**Architecture:** 1 Django backend (16 app) + React frontend (69 route) + VPS staging duy nhất; fix theo wave P0→A→B, mỗi task = 1 branch `feat/<tên-agent>` + 1 PR + 1 ledger Entry. File-disjoint để chạy 2 agent song song.

**Tech Stack:** Django 6 + Celery beat + React 19/Vite + `vninvestcharts-widget` vendor (`file:` spec) + `route-contract.test.js` (521 route) + VPS staging `14.225.255.47` (cấm local Docker).

**Spec:** `docs/EVALUATION_HANDOFF_20261109.md` (§0, §D, §H, §J) · `docs/PM_BUG_GAP_MATRIX_20261108.md` (M1–M10) · `docs/PLAN_PM_AUDIT_FIX_20261108.md` (W0–W2 task chi tiết) · `docs/MASTER_TRACKING_2026Q4.md` §6 (Phase A/B) + D1–D8 `:90-101` · `docs/PLAN_NEXT_PHASE_20261108.md` (T0–T4).

## Global Constraints

- Retail-first, phase 1 FREE brand name (D8) · AI = phân tích kỹ thuật, không khuyến nghị (D2) · Depth = "Ước tính" mọi nơi (D6) · Push = future, không báo True giả khi thiếu key (D7).
- Không `npm/pip install` · không tự đặt migration (để `makemigrations` sinh) · không chạm deny-list (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`) — cần thì ghi vào claim + báo coordinator.
- FE SOC: token → `soc.tokens.css`, class → `soc.components.css`, **không** `soc.module.css`.
- i18n: `t(key, { defaultValue })`; sửa `vi.js`/`en.js` phải claim-check trước, không 2 agent sửa locale cùng lúc.
- Test env: **VPS staging only** cho BE/build nặng (`bash scripts/deploy-staging.sh --verify`, BE cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`). Gate nhẹ (`check-multi-agent`, `tsc --noEmit`, `check-lessons`, `normalize-eol`) chạy local.
- Mọi số kèm lệnh tái hiện; chưa chạy ghi `CHƯA CHẠY` (L-007). Không `--no-verify` trừ khi ghi lý do vào commit body.

## Review Focus

- `RestartCount>0` nhưng `Up` — phải FAIL verify, không PASS kiểu Entry 423 (§0 AUD-01/02).
- Pull staging đè hotfix secret `docker-compose.staging.yml` (+5 `CORE_AD_SIGNING_SECRET`) — phải `git stash` trước pull, kiểm conflict sau pop (Entry 423 + `PLAN_NEXT_PHASE:48`).
- Manifest regen bằng filter local (không chạy script VPS `dump-core-route-manifest.py`) — phải chạy lại script trên VPS trước merge (Entry 418).
- `workspace.js` bị W0-3 và W1-1 chạm tuần tự — cấm 2 agent claim đồng thời (`PLAN_PM_AUDIT_FIX:69`).
- `vi.js`/`en.js` top-level key trùng — test `tenantreg-dup-i18n-keys` bắt, phải chạy trước khi thêm namespace mới.

---

## Baseline exit-code tại HEAD (đo thật phiên plan này — B2, 2026-11-09)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng migration (warnings file cũ không chặn) |
| Lessons | `node scripts/check-lessons.mjs` | **PASS** — 14 file \| 57/60, sách (phiên audit 2026-11-09) |
| Git | `git log --oneline -5 origin/dev` · `git status --short` | `26e44d203` PR #308; `M docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 428) + `?? docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` + `?? docs/EVALUATION_HANDOFF_20261109.md` |
| Pin | `Select-String requirements.txt redis` / `pyproject.toml celery` | `requirements.txt:9 redis>=5.0,<6.0` · `pyproject.toml:19 celery>=5.4,<6.0` — khớp AUD-01 |
| Type / FE suite / BE suite / build / VPS verify | — | **CHƯA CHẠY** trong phiên lập plan (gate tối thiểu trước B5: `npx tsc --noEmit` + suite/BE qua VPS §12; số kế thừa Entry 424/426 ghi tham khảo, không suy ra HEAD mới) |

**Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01, L-T02]

**Nguồn:** `docs/LESSONS/multi-agent.md:6-118` · `docs/LESSONS/verification.md:10-104` · `docs/LESSONS/tooling-traps.md:44-82` (chỉ 3 file đã đọc, không đọc cả `docs/LESSONS/`).

**MANDATORY CHECKLIST (tick trước khi slice xong):**
- [ ] File không nằm deny-list §2; cần sửa deny-list → claim + coordinator (L-001)
- [ ] Claim commit riêng **trước** dòng code đầu tiên, branch `feat/<tên-agent>` đúng ký tự (L-002, L-M02)
- [ ] Gate sau `agent-sync.ps1` (rebase → check migration → gate), không gate trước rebase (L-003)
- [ ] Không commit thẳng `dev`; qua branch + PR; không `--no-verify` (L-008)
- [ ] Không kết luận BE khi chưa có env; ghi `CHƯA CHẠY` (L-007)
- [ ] Script đo có control biết đáp án (L-V01); gốc rễ kế thừa có fail-before (L-V02); assert giá trị thật + test dương tính (L-V04)
- [ ] `git status --short` sau mỗi lệnh ghi file (L-V03); `git diff --numstat` sau mỗi edit (L-T01); mở đúng file trong citation trước khi tin (L-T02)

---

## SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE (đúng trong plan này):** P0-1/P0-2/P0-3 + A1/A2/A3/A4/A5 + B1/B2/B3/B4/B5 (file-disjoint, thứ tự §H). Mỗi task = 1 branch + 1 PR.
- **LIMIT:** Tối đa 3 vòng sửa/task, quá thì `blocker` + dừng (luật cứng #2). Song song tối đa 2 agent, mỗi agent 1 worktree + DB riêng `ag_<tên>`.
- **NON-GOALS (không làm trong plan này):** W1.8 SAML thật + W1.5 2-tầng broker (chờ Owner Q2/Q5) · W1.9 free policy (chờ Owner Q7) · C3 i18n lazy / D1 light / D2 recharts (T4 chờ GO) · axe/visual 5 route · sửa `agent-*.ps1` ngoài T3 · purge secret history / rotate (chờ Owner, `OPEN_WORK_SEC:49-62`) · bật CI (chờ billing, `OPEN_WORK_SEC:178-186`).
- **ROLLBACK:** Revert PR (merge-commit, không squash). BE task render lại manifest nếu cần. VPS compose ops: backup `.bak.20261108` đã có; pull phải stash hotfix trước.
- **Môi trường:** Mọi thử nghiệm BE/build trên **VPS staging** (`14.225.255.47:/opt/vninvest`, `docs/STAGING_VPS_RUNBOOK.md` §12). Cấm local Docker. Sau thử nghiệm xoá container/worktree/DB tạm.

---

## Chuỗi công việc (thứ tự đề xuất — song song 2 lane, file-disjoint)

### P0 — Staging blocker (coordinator làm, [T], phải xong trước mọi BE test)

#### P0-1: Bump redis-py cho kombu (AUD-01)

**Files:**
- Modify: `packages/core/backend/requirements.txt:9` (deny-list — coordinator only)
- Verify: `packages/core/backend/requirements.txt:23` (`channels-redis>=4.1,<5.0`)
- Test: không có unit test — verify bằng `docker logs` worker không còn `VersionMismatch`

**Interfaces:**
- Consumes: `packages/core/pyproject.toml:19` `celery>=5.4` → kombu cần `redis>=6.1.0`
- Produces: image `vninvest-core-api:staging` mới cho P0-2/P0-3

- [ ] **Step 1:** Audit plan này bằng auditor độc lập (B3/B4), ghi verdict vào `docs/evidence/next-direction/AUDIT_PLAN_*.md`
- [ ] **Step 2:** Coordinator đổi `redis>=5.0,<6.0` → `redis>=6.1.0` (ghi lý do + owner duyệt vào commit body nếu dùng `--no-verify`; deny-list).
- [ ] **Step 3:** Trên VPS: `bash scripts/deploy-staging.sh` rebuild image, `docker logs vninvest-core-worker --tail 50` không còn `VersionMismatch`, `docker inspect` RestartCount không tăng sau 10 phút (`docker ps` 2 lần cách 5 phút, uptime tăng, không `<1m`).
- [ ] **Step 4:** Commit riêng (không kèm code khác) + ledger Entry mới. Acceptance: Given image cũ (redis 5.3.1), When inspect sau deploy, Then 5 worker/beat uptime >5 phút, RestartCount không tăng.

#### P0-2: Patch `--verify` bắt restart-loop (AUD-02)

**Files:**
- Modify: `scripts/deploy-staging.sh` (thêm check RestartCount/uptime vào `--verify`)

**Interfaces:**
- Consumes: `docker inspect -f '{{.RestartCount}}'` của 5 service
- Produces: `--verify` FAIL khi RestartCount>0 (trừ service vừa deploy có chủ đích)

- [ ] **Step 1:** Viết fail-before: chạy `--verify` hiện tại trên staging đang loop → PASS giả (ghi lại output, L-V04 control).
- [ ] **Step 2:** Thêm check: FAIL nếu `RestartCount>0` hoặc `Status=Restarting` >5m. Không thêm service mới, không đổi flow deploy.
- [ ] **Step 3:** Chạy lại trên VPS: staging đang loop → `--verify` FAIL; sau P0-1 (image mới lên) → `--verify` PASS + health 2xx.
- [ ] **Step 4:** Commit + ledger. Acceptance: Given staging loop, When `--verify`, Then FAIL với dòng nêu tên service + RestartCount.

#### P0-3: Pull staging lên `26e44d203` (AUD-03)

**Files:**
- Ops: VPS `/opt/vninvest` only; không commit deny-list `docker-compose.staging.yml` lên git (wire secret là việc riêng, ghi ledger)

- [ ] **Step 1:** Trên VPS: `git status -sb` (phải thấy đúng `M docker-compose.staging.yml` + 5 untracked đã biết) → `git stash push -- docker-compose.staging.yml` (giữ hotfix).
- [ ] **Step 2:** `git pull origin dev` (→ `26e44d203`) → `git stash pop` → kiểm conflict; nếu conflict ở hunks `CORE_AD_SIGNING_SECRET` thì giữ hunks VPS, không giữ hunks upstream nếu trống.
- [ ] **Step 3:** `python manage.py migrate` (trước mọi `reencrypt`, remind `OPEN_WORK_SEC:93-98`) + `bash scripts/deploy-staging.sh --verify` PASS + `curl http://127.0.0.1:8080/api/core/v1/health` 2xx.
- [ ] **Step 4:** Ghi ledger (staging HEAD mới + verify output), không commit `docker-compose.staging.yml`/secret lên git. Acceptance: staging HEAD = `26e44d203`, LP1 backend có mặt, RestartCount=0.

---

### Phase A — Đóng W0 (không cần Owner, [T], S/M)

#### A1: Re-verify trước, sửa sau (B3 OBJ-2 rev3) — envelope broker + pricing đã refute

**Files:**
- Modify (chỉ nếu B6 re-verify đỏ): `packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py:607` (thu hẹp `KNOWN_UNREADABLE` cho 5 endpoint `views_broker`) — **P0-1 (AUD-01) xong trước thì mới chạy được trên VPS**
- [x] **A1 refute (B3 OBJ-2, tự xác minh 2026-11-09)**: `packages/core/backend/src/advisory/pricing.py:160` hiện là `timezone.is_naive(effective_from)`, không phải `timezone.utc`; `packages/core/backend/src/advisory/pricing.py:17` đã `from datetime import UTC`, grep `timezone.utc` trên file = 0. Đây là claim kế thừa sai (Entry 404/407 đã sửa hoặc file đã thay đổi) — **không còn lỗi để sửa**. B6 phải re-verify: chạy `packages/core/backend/src/vninvest_core/tests/test_no_timezone_utc.py` trên VPS, nếu xanh thì A1 đóng bằng "không còn bug", không bịa fail-before.

- [ ] **Step 1 (re-verify-first):** Trên VPS chạy `test_no_timezone_utc.py` + `test_api_envelope_schema.py`. Nếu cả 2 xanh → A1 đóng bằng "không còn bug", không bịa fail-before (L-V02). Nếu đỏ → mới ghi RED chính xác rồi sang Step 2.
- [ ] **Step 2 (chỉ nếu Step 1 đỏ):** Sửa đúng root cause thật (không nới assertion để cho xanh, L-V04). Nếu xanh hết thì bỏ qua Step 2.
- [ ] **Step 3:** Chạy lại 2 test trên VPS PASS + `makemigrations --check` không đổi. Commit `test(be): re-verify A1 + envelope broker` (nếu có sửa) hoặc đóng bằng evidence không sửa. (Effort S)

#### A2: Vệ sinh registry claim (hygiene, AUD-08/C5) — coordinator-only (B3 OBJ-4)

**Files:**
- Modify: `docs/CLAIMS.md` (3 dòng `pm-review-20261108 in-progress` → `superseded`/`done`, 1 từ/dòng như Entry 425) — **chỉ coordinator làm**; agent song song KHÔNG tự sửa dòng của agent khác (`AGENT_PROTOCOL.md:53-54`). Agent chỉ ghi đề xuất vào `note` claim của mình và báo coordinator.

- [ ] **Step 1:** `git show HEAD:docs/CLAIMS.md` xác nhận 3 dòng stale còn `in-progress`.
- [ ] **Step 2:** Edit tool đổi đúng 3 ô `status` (giữ append-only, không sửa/xoá dòng khác, không normalize EOL).
- [ ] **Step 3:** `node packages/web/scripts/check-multi-agent.mjs` PASS + `git diff --numstat` = 3 dòng. Commit riêng. (Effort S, file-disjoint với A1/A5 — song song được)

#### A3: Backfill ledger + trích dẫn PR sai của W0.8a (doc-only)

**Files:**
- Modify: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (backfill Entry 403 nếu thiếu, đính chính trích dẫn PR của W0.8a: không có PR, chỉ `31dcae058`/`91bad0440`)

- [ ] **Step 1:** Đối chiếu `git log --oneline --grep="W0.8a"` + `gh pr view 285` (đã biết "Could not resolve" ở Entry 404) — xác nhận không có PR.
- [ ] **Step 2:** Append Entry đính chính (không sửa/xoá Entry cũ, append-only), cite `file:line` của ROADMAP/handover đã sửa.
- [ ] **Step 3:** `node scripts/check-lessons.mjs` PASS + `git diff --numstat` khớp. (Effort S)

#### A4: Đính chính roadmap W0.4 + W0.2 (doc-only)

**Files:**
- Modify: `docs/ROADMAP_MASTER_2026Q4_2027.md` (row W0.4/W0.2) + `docs/MASTER_TRACKING_2026Q4.md` header (§ nếu còn ghi "còn 6 slice") — **cần coordinator** nếu 2 file này thuộc deny-list trong phiên thực hiện (kiểm `docs/AGENT_PROTOCOL.md` §2 trước).

- [ ] **Step 1:** Cite lại bằng chứng Entry 402 (4 test bảo vệ đỏ sẵn, `check-shell.mjs:37,41,150,156,454,806` assert 3 file, `src/index.js:20,27` public API) — không đoán.
- [ ] **Step 2:** Sửa đúng 2 row roadmap theo kết luận "không xoá được", không thêm kết luận mới.
- [ ] **Step 3:** Gate nhẹ PASS. (Effort S)

#### A5: OpenClaw → tính năng hỗ trợ D4 (M)

**Files:**
- Modify: `packages/core/backend/src/advisory/ai_clients/openclaw.py:42-43,151-152` (fail-closed có lý do, phân biệt "support not configured" vs "AI chính chết")
- Modify: `packages/web/src/i18n/vi.js` + `en.js` (label hỗ trợ — claim-check trước) — *nếu file-disjoint với A1/B1 thì song song được; nếu chạm locale cùng B1 thì làm tuần tự*
- Test: BE test trên VPS (`test_openclaw_*` nếu có, hoặc thêm 1 test nhỏ)

- [ ] **Step 1:** Fail-before: gọi `openclaw` qua BE → 503 generic (ghi output).
- [ ] **Step 2:** Sửa BE fail-closed rõ lý do + thêm key i18n hỗ trợ (vi/en cùng lúc, `t(key,{defaultValue})`).
- [ ] **Step 3:** Chạy lại BE test VPS PASS + `npx tsc --noEmit` 0. Commit. Acceptance: UI không giả "AI chính chết" khi OpenClaw chưa cấu hình.

---

### Phase B — W1 retail activation (2 agent song song sau Phase A, [T])

**Phân công lane file-disjoint (song song được):**

| Lane | Task | File chính | Không được chạm |
|---|---|---|---|
| Lane-1 | B1 AI contract (W1.1) | `packages/core/backend/src/advisory/orchestrator.py` + serializer + `packages/web/src/i18n/vi.js`/`en.js` + disclaimer | `packages/web/src/adapters/core/workspace.js` (Lane-2 dùng) |
| Lane-2 | B2 gỡ order (W1.2) | `packages/core/backend/src/user_workspace/views_dnse.py` + `packages/web/src/adapters/core/workspace.js` (nhỏ) | `packages/core/backend/src/advisory/orchestrator.py` (Lane-1 dùng) |

#### B1: AI contract → phân tích kỹ thuật (W1.1, L, nền W2.1)

**Files:**
- Modify: `packages/core/backend/src/advisory/orchestrator.py:720-726` (prompt đã là `posture`/`levels` — giữ nguyên) + `:845-891` (link phân tích vẫn trả `signal`/`target_price`/`recommendation` ở `:879,881,886` — **đổi return schema này, không phải prompt**)
- Modify: serializer advisory (cùng `packages/core/backend/src/advisory/`) + `packages/web/src/i18n/vi.js` + `packages/web/src/i18n/en.js` + disclaimer UI
- Test: BE `test_advisory_*` + FE `ai-cc-i18n-clean` (chạy VPS)

- [ ] **Step 1:** Fail-before: BE test cũ assert `signal==BUY|SELL|HOLD` PASS trên code cũ (ghi lại — L-V02 control).
- [ ] **Step 2:** Đổi return schema, thêm disclaimer, gỡ order placement khỏi UI (giữ `paper` dry_run).
- [ ] **Step 3:** Chạy BE test mới PASS (assert `posture`/`levels` thật, không còn `signal`) + FE vitest liên quan PASS + `npx tsc --noEmit` 0.
- [ ] **Step 4:** Commit. Acceptance: Given user gọi advisory, When trả về, Then không còn `signal`/`target_price`/`recommendation`, có `posture`/`levels` + disclaimer.

#### B2: Gỡ order placement khỏi sản phẩm (W1.2, M)

**Files:**
- Modify: `packages/core/backend/src/user_workspace/views_dnse.py:301-404` (`live` → 4xx, nhãn "phiếu thử nghiệm")
- Modify: `packages/web/src/adapters/core/workspace.js:23-30` (nhỏ, truyền `mode:'paper'` — đã có từ PA-5, chỉ đổi nhãn/hành vi `live`)

- [ ] **Step 1:** Fail-before: gọi `live` → thành công (ghi output, chứng minh order placement còn mở).
- [ ] **Step 2:** `live` trả 4xx (`live_ordering_disabled`), UI giữ `paper` + nhãn thử nghiệm. Không đụng `W1.3`/`W1.5`.
- [ ] **Step 3:** Chạy lại: `live` → 4xx, `paper` → vẫn chạy, FE test contract PASS. Commit. Acceptance: live không còn đặt lệnh thật ngoài hợp đồng.

#### B3: Depth minh bạch D6 (W1.3, M) — [T] + [X] vendor

**Files:**
- Modify: `packages/web/src/components/workstation/hooks/useOrderBook.js` + `packages/web/src/components/workstation/StockOrderBookWidget.jsx` (badge mọi nơi tiêu thụ)
- BE: `packages/core/backend/src/market_serving/native_views.py:515-527` (doc only, không thêm field `estimated`/`delta_seconds` — đã bác ở `PLAN_PM_AUDIT_FIX:123-128`)
- Test: `StockOrderBookWidget.estimated.component.test.tsx` (đã có 2 case ở Entry 420 — mở rộng)

- [ ] **Step 1:** Đọc vendor `vninvestcharts-widget` README/tick xem có nuốt `is_mock` không (**CHƯA XÁC MINH** đến khi đọc vendor file — L-V02). Không đoán.
- [ ] **Step 2:** Gắn badge "Ước tính" mọi nơi tiêu thụ thật (không chỉ 1 nơi). Nếu vendor nuốt thì ghi [X] repo ngoài, không tự sửa vendor.
- [ ] **Step 3:** FE vitest badge 2/2 PASS + screenshot 360/768/1280 (mở ảnh ra xem, L-V05). Commit.

#### B4: W1.4 phần còn lại (M)

**Files:** `packages/core/backend/src/vninvest_core/settings.py:669-673` (NOOP) · indicators None · AI news null · news digest rỗng · discovery hub rỗng — tách thành 2 commit nhỏ nếu chạm >2 file.

- [ ] **Step 1:** Đo từng endpoint thực (BE test VPS) — endpoint nào trả null/rỗng thật thì ghi, endpoint nào đã có dữ liệu thì không sửa (L-V02).
- [ ] **Step 2:** Sửa đúng root cause từng mục, xoá entry NOOP `669-673` (task thật đã chạy `871-875` "Overrides the NOOP").
- [ ] **Step 3:** BE test VPS PASS + manifest không tăng route thừa. Commit.

#### B5: Minh bạch whale/dark flow (W1.6, M)

**Files:** `packages/core/backend/src/signal_intelligence/session_facts_engine.py:38,205` (`dark_flow_score` = absorption proxy) + UI ghi rõ nguồn/freshness

- [ ] **Step 1:** Trace 1 use-case từ engine → API → UI, ghi `file:line` từng bước (B-template §B).
- [ ] **Step 2:** Đổi copy UI "absorption proxy" + nguồn + freshness, không đổi công thức score. i18n vi/en cùng lúc.
- [ ] **Step 3:** FE vitest + screenshot 2 theme (mở ảnh xem) PASS. Commit.

---

### Deferred — ticket riêng, không gộp vào P0/A/B

- **T3** (`agent-sync.ps1`/`agent-cleanup.ps1` PS 5.1): probe parse-only local trước, sửa nhỏ nhất đúng chỗ, giữ hành vi PWSh 7+. Làm trước T2 vì là infra.
- **T2** (`auth-forms-rhf-extra` treo lẻ): repro ×3 trên VPS + trace, không sửa production khi chưa có root cause; quá 3 vòng → blocker giữ ticket mở (`PLAN_NEXT_PHASE:62-67`).
- **T4** (BE suite full + axe 5 route 390×851 + visual 5×2 theme + C3/D1/D2): **không mở** khi chưa có GO của owner (§J Q8).
- **W1.8 SAML / W1.5 broker 2 tầng / W1.9 free** — chờ Owner Q2/Q5/Q7 (§J).
- **Rotate secret + bật CI** — chờ Owner (billing/prod/public), `OPEN_WORK_SEC:49-62,178-186`.

---

## Trình tự vòng kín (mỗi task, bắt buộc)

B1 Đo lường (agent-sync → status → claims → lessons §Baseline) → **B2 plan này** → B3 audit độc lập (chỉ đọc, người/model khác) → B4 đồng thuận PASS/AGREE (ghi verdict bằng văn bản, không chat-only) → B5 claim + worktree cách ly (`scripts/new-agent.ps1` + `agent-install-hooks.sh` + DB riêng) → B6 TDD fail-before → pass-after → B7 gates sau rebase (local nút + VPS staging) → B8 re-audit độc lập (0 blocker + 0 major) → B9 claim done + ledger Entry + PR merge-commit → cleanup worktree/branch.

Song song: mỗi agent 1 worktree; `workspace.js`/`vi.js`/`en.js` không claim đồng thời.

## Câu hỏi cần làm rõ (Q1 là gate của P0, không phải câu hỏi mở khi B4)

1. **Q1 (P0 gate)**: Owner duyệt bump `redis>=6.1.0` + rebuild staging khi nào? (§J Q1)
2. **Q2**: Depth nguồn thật ở W1 hay chỉ gắn nhãn (D6)? — default trong plan: giữ synthetic + nhãn "Estimates — not a live book" (không chạy B3 phần vendor khi chưa đọc vendor file).
3. **Q5**: `/ai/agents/` gỡ UI (đã chọn ở W0-3) hay dựng BE? SAML (a) rebuild image hay (b) CLI `xmlsec1`? Mobile giữ scaffold?
4. **Q8**: Mở C3/D1/D2 trong đợt này không, hay giữ defer (T4)?

## Đánh giá tổng thể

- **Implementable?** P0-1→A1/A5 → A2/A3/A4 → B1/B2 là nhỏ, không blocker (trừ deny-list P0-1 chỉ coordinator). T4 là chờ owner — không tự mở.
- **Blocker:** Không blocker cho P0→A→B1/B2. Rủi ro duy nhất đã ghi: conflict secret VPS khi pull (P0-3 stash trước), `workspace.js`/`locale` đua claim (lane table).
- **Ưu tiên:** P0-1 → P0-2 → P0-3 → A1 → A2 → A5 → A3/A4 → B1 ∥ B2 (2 lane) → B3/B4/B5 → Deferred.

## Bàn giao

Plan này là **B2** (chưa B3/B4). Bắt đầu B3 cần auditor độc lập đọc plan này + `docs/EVALUATION_HANDOFF_20261109.md` + ledger Entry 428, ghi verdict vào `docs/evidence/next-direction/AUDIT_*.md` trước khi khai claim. Không viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6).

**Evidence liên quan:** `docs/EVALUATION_HANDOFF_20261109.md` (§0–§K) · `docs/AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` · `docs/PLAN_NEXT_PHASE_20261108.md` · `docs/SESSION_HANDOFF_UIUX_20261108.md` · `docs/PM_BUG_GAP_MATRIX_20261108.md` · `docs/MASTER_TRACKING_2026Q4.md` §6.

**Self-review:** Mỗi finding ở §0 có task (AUD-01→P0-1, AUD-02→P0-2, AUD-03→P0-3, AUD-05→B1, AUD-07→B3, AUD-08→A2, AUD-09→Deferred, AUD-04/10→Deferred [X]). Mọi acceptance đều Give/When/Then đo được, không có "TBD". Proportion: plan ~3× spec ngắn gọn trong EVALUATION §H — chấp nhận vì đây là plan thực thi cho team chưa đọc codebase.
