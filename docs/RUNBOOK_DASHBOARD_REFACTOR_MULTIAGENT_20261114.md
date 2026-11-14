# RUNBOOK — Thực thi Master Plan Dashboard Refactor (S1–S13) theo vòng khép kín

- **Scope**: bàn giao cho đội code (multi-agent) thực thi `docs/PLAN_DASHBOARD_REFACTOR_20261114.md` (v2) — 13 slices S1–S13, với audit độc lập `docs/AUDIT_PLAN_DASHBOARD_REFACTOR_20261114.md` (verdict PASS_WITH_CONDITIONS, 6 V2 findings).
- **Date**: 2026-11-14.
- **Trạng thái**: S1 ✅ (PR #387), S6 ✅ (PR #389) đã ship. Còn lại S2, S3, S4, S5, S7, S8, S9, S10, S11, S12, S13 (11 slices).
- **Owner decisions đã chốt** (§12 plan): Q1 giữ trầm rõ nét hơn (iterative); Q2 "Khác" toggle trong settings; Q3 bỏ Cá mập, thay multicharts (áp dụng tương lai); Q4/Q5 làm theo khuyến nghị; Q6 làm từng slice nhỏ, lưu audit + nhật ký từng slice.

---

## 0. Preflight (chạy 1 lần trước khi bắt đầu bất kỳ slice nào)

1. **Nạp skill bắt buộc** (theo `AGENTS.md` Bước 0 + skill-routing-protocol):
   - `workflow-dev-loop` (9 bước khép kín) — gọi trước dòng code đầu tiên.
   - `project-lessons` (planning gate) — với `taskDescription` + `filePaths` + `actions` → trả `LESSONS APPLICABLE` + `MANDATORY CHECKLIST`. Plan phải ghi `Lessons áp dụng: [L-...]` hoặc `NONE – <lý do>`.
   - `multi-agent-workflow` — khi ≥2 agent cùng làm việc.
   - `soc-uiux` — cho mọi task UI/UX (bản đồ gate + anti-pattern).
   - `test-driven-development` — fail-before test trước code.
   - `staff-engineer-review` — audit độc lập B3/B8.
2. **Mở phiên** (theo `AGENTS.md` Bắt buộc):
   ```powershell
   sh scripts/agent-install-hooks.sh   # hoặc git config --worktree core.hooksPath .githooks
   pwsh -File scripts/agent-sync.ps1   # rebase → check migration → gate
   git -C <main tree> status --short
   ```
3. **Đọc bắt buộc**: `docs/AGENT_PROTOCOL.md` §10 (multi-agent), `docs/CLAIMS.md` (claim registry), `docs/PLAN_DASHBOARD_REFACTOR_20261114.md` (plan v2), `docs/AUDIT_PLAN_DASHBOARD_REFACTOR_20261114.md` (audit verdict).
4. **Môi trường**: VPS staging `14.225.255.47` / `docker.edusuccess.vn` (AGENTS.md §Môi trường). BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`. Nếu thiếu → ghi `CHƯA CHẠY`, không suy ra.

---

## 1. Vòng khép kín cho MỖI slice (9 bước `workflow-dev-loop`)

Áp dụng cho mỗi slice S2–S13. Không bỏ bước, không đảo thứ tự (L-G01).

### Bước 1 — Đo lường (fact-finding + claim + lessons)
- Nạp `project-lessons` với taskDescription (mô tả slice) + filePaths (danh sách file dự kiến) + actions (`edit`, `gate`, `test`, `claim`).
- Ghi `Lessons áp dụng: [L-...]` vào plan.
- **Khai claim TRƯỚC dòng đầu tiên** (L-002): append vào cuối `docs/CLAIMS.md`:
  ```
  | <slice-key> | feat/<slice-key> -> dev | <scope> | <files> | in-progress | <date> | Lessons ap dung: [...] |
  ```
  Commit riêng claim trước khi sửa code.
- Chạy baseline gate (ghi rõ PASS/FAIL/CHƯA CHẠY — L-G02).

### Bước 2 — Kế hoạch (`docs/PLAN_<SLICE>_20261114.md`)
- Viết plan slice: SCOPE (danh sách file), Given/When/Then AC, gates, tests, effort, STOP conditions, rollback.
- Tham chiếu plan v2 §10 (slice spec) + audit V2 findings (V2-01..V2-06) + Owner decisions §12.

### Bước 3 — Audit kế hoạch độc lập (chỉ đọc, `staff-engineer-review`)
- Agent khác (hoặc subagent) đọc plan + code + audit doc, trả verdict PASS/NEED_REVISION.
- Nếu NEED_REVISION → sửa plan → re-audit. Lặp đến PASS.

### Bước 4 — Đồng thuận
- Coordinator + auditor đồng ý. Ghi `AGREE` vào plan.

### Bước 5 — Claim (đã làm ở Bước 1, xác nhận in-progress)

### Bước 6 — Code (fail-before)
- Tạo branch `feat/<slice-key>` từ `dev` mới nhất.
- Viết test fail-before (TDD) cho AC chính.
- Code tối thiểu theo skill `soc-uiux` §1 (SSOT) + §6 (anti-patterns).
- Chạy `npx tsc --noEmit` sau mỗi sub-step; `npm run build` cuối slice (AGENTS.md).

### Bước 7 — Gates
- Thứ tự bắt buộc (L-G01): rebase → check migration → gate.
  ```powershell
  pwsh -File scripts/agent-sync.ps1   # rebase → check migration → gate
  ```
- Gates bắt buộc (dùng tên script đúng — MN-10):
  - `node packages/web/scripts/check-multi-agent.mjs`
  - `npx tsc --noEmit`
  - `npm run lint` (0 errors)
  - `npm run check:tokens` (`node packages/web/scripts/check-tokens.mjs`)
  - `node packages/web/scripts/check-portfolio-contrast.mjs`
  - `node packages/web/scripts/check-theme-contrast.mjs` (hoặc CHƯA CHẠY + lý do)
  - `node packages/web/scripts/check-light-theme.mjs`
  - `npm run check:dom-landmarks`
  - `node packages/web/scripts/check-heading-contract.mjs`
  - `npm run i18n:scan:strict` + `npm run check:i18n-hardcoded`
  - `npm run test:components` (không regress; cập nhật baseline nếu có chủ đích)
  - `npm run test:visual` (baseline update có chủ đích, ghi lý do) — hoặc CHƯA CHẠY + lý do
- Nếu thiếu môi trường (DB, Chromium, canvas runtime) → ghi `CHƯA CHẠY`, không suy ra PASS (L-G02, L-007).

### Bước 8 — Re-audit (B8, `staff-engineer-review`)
- Agent khác đọc code + diff + gate results, trả verdict PASS/NEED_REVISION.
- Nếu NEED_REVISION → sửa → re-audit. Lặp đến PASS.

### Bước 9 — Bàn giao (merge + push + cleanup + ledger)
- Cập nhật claim: `in-progress` → `done` + ghi gate results + PR number.
- Tạo PR: `pwsh -File scripts/agent-pr.ps1 -Title "feat(<slice>): ..." -Scope "<slice>"`
  - Nếu `pwsh` không có → dùng `gh pr create` trực tiếp (đã làm trong phiên này).
- Push: nếu pre-push-gate có FAIL pre-existing → dùng `SKIP_PRE_PUSH_GATE=1` **chỉ khi** ghi lý do vào commit body/claim note (sanctioned kill-switch, không phải `--no-verify`).
- Merge: `gh pr merge <N> --merge --delete-branch` (repo convention: merge commit).
- Cleanup: `git checkout dev && git pull --ff-only origin dev && git branch -d feat/<slice>` (hoặc `agent-cleanup.ps1 -Branch <b> -Execute` cho worktree).
- **Append ledger Entry** tại đầu `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry N+1): Date, Type, Branch, Claim, Scope, Gates (PASS/FAIL/CHƯA CHẠY), Lessons áp dụng, Next, Files, GHI LESSON MOI (nếu có).
- Cập nhật plan doc nếu slice thay đổi scope/AC.

---

## 2. Phối hợp multi-agent (khi ≥2 agent cùng làm)

Theo `docs/AGENT_PROTOCOL.md` §10 + `multi-agent-workflow` skill. Tóm tắt:

### Vai trò
| Vai trò | Trách nhiệm |
|---|---|
| **Coordinator (PM)** | Own plan, claim registry, slices assignment, Owner questions, merge approval, ledger. |
| **FE agent** | Code slices (CSS/TSX/JS), gates FE, PR. |
| **BE agent** | Endpoints/data (Phase D/S9/S13), migration (nếu cần — để `makemigrations` sinh). |
| **Auditor agent** | Independent B3/B8 (read-only), verdict PASS/NEED_REVISION. |

### Quy tắc cứng
1. **Không commit thẳng vào `dev`** — branch `feat/<slice>-<agent>` + PR.
2. **Không commit 10 file shared** (§2 protocol): `AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`. Ghi vào claim + báo coordinator. Hook chặn.
3. **Không sửa file agent khác đang claim `in-progress`**.
4. **Không tự đặt số migration** — đọc head thật hoặc để `makemigrations` sinh.
5. **Không chạy `npm install`/`pip install` khi chưa hỏi** (junction node_modules dùng chung).
6. **Không báo "PASS" cho thứ chưa chạy** — ghi `CHƯA CHẠY`.
7. **Không `--no-verify`** trừ khi ghi lý do vào commit body (kill-switch `SKIP_PRE_PUSH_GATE=1` sanctioned, phải ghi lý do).
8. **Claim trước dòng đầu tiên** (L-002): commit riêng claim vào `docs/CLAIMS.md` TRƯỚC khi sửa code.
9. **Gate sau rebase** (L-G01): rebase → check migration → gate.
10. **Tên branch = `feat/<claim-key>` đúng y ký tự** (L-M02) — lệch 1 chữ là preflight chặn.

### Tránh xung đột
- Mỗi slice = 1 claim key = 1 branch = 1 PR. Không 2 agent cùng slice.
- File overlap: nếu 2 slice cùng chạm 1 file → slice sau phải rebase + resolve, hoặc coordinator gộp scope.
- Migration: chỉ BE agent đặt số, qua `makemigrations` (không tự đặt).
- Shared files: ghi vào claim + báo coordinator, không commit.

### Claim template
```
| <slice-key> | feat/<slice-key> -> dev | <scope 1 dòng> | <files> | in-progress | <date> | Lessons ap dung: [L-...] |
```
Sau merge: flip `in-progress` → `done` + thêm `PR #N.`

---

## 3. Checklist per-slice (copy-paste cho mỗi slice)

```
[ ] 0. Nạp skill: workflow-dev-loop + project-lessons + soc-uiux + (test-driven-development nếu có test)
[ ] 1. Đo lường: baseline gate (ghi PASS/FAIL/CHƯA CHẠY), claim row appended (commit riêng)
[ ] 2. Plan: docs/PLAN_<SLICE>_20261114.md (SCOPE, Given/When/Then, gates, tests, effort, STOP, rollback)
[ ] 3. Audit B3 (staff-engineer-review): verdict PASS/NEED_REVISION → sửa → re-audit
[ ] 4. Đồng thuận: AGREE ghi vào plan
[ ] 5. Claim: in-progress (đã làm ở bước 1)
[ ] 6. Code: branch feat/<slice>, fail-before test, code tối thiểu, tsc sau mỗi sub-step
[ ] 7. Gates: agent-sync.ps1 (rebase→migration→gate) — dùng tên script đúng (MN-10)
[ ] 8. Re-audit B8: verdict PASS/NEED_REVISION → sửa → re-audit
[ ] 9. Bàn giao: claim done + PR (agent-pr.ps1 hoặc gh pr create) + push + merge + cleanup + ledger Entry
[ ] 10. Cập nhật plan v2 nếu slice thay đổi scope/AC
```

---

## 4. Verification & close-of-session

### Per slice (sau merge)
- `git checkout dev && git pull --ff-only origin dev`
- `git status --short` — chỉ còn file lạ pre-existing (báo Owner, không commit).
- `node packages/web/scripts/check-multi-agent.mjs` → 0 lỗi.
- `npx tsc --noEmit` → 0 lỗi (nếu có đổi source FE).
- Ledger Entry appended với Date/Type/Branch/Claim/Scope/Gates/Lessons/Next/Files.

### Close session (sau khi tất cả slice xong)
1. `pwsh -File scripts/agent-sync.ps1` (rebase → migration → gate) trên dev.
2. `git status --short` — phải sạch (trừ file lạ pre-existing đã báo Owner).
3. `git log --oneline -N` — xác nhận merge commits.
4. `node packages/web/scripts/check-multi-agent.mjs` → 0 lỗi.
5. Báo Owner: tổng kết slices (done/queued), gates (PASS/CHƯA CHẠY), lessons mới (nếu có), file lạ pre-existing.
6. Nếu có file lạ pre-existing → báo Owner decide commit/discard (không tự commit).

---

## 5. Trạng thái slices hiện tại (2026-11-14)

| Slice | Nội dung | Effort | Trạng thái | PR |
|---|---|---|---|---|
| S1 | Fix heatmap label (BL-03) | S (0.5d) | ✅ DONE | #387 |
| S2 | Vibrant palette (BL-02) — keep dark, clearer | S (1d) | READY (V2-03) | — |
| S3 | Empty state tile (A3) | S (0.5d) | CONDITIONAL (V2-04) | — |
| S4 | Focal point (MJ-06) | S (0.5d) | READY | — |
| S5 | "Khác" toggle (MJ-07) | S (0.5d) | READY | — |
| S6 | AI alert timeout (BL-01) | M (1-2d) | ✅ DONE | #389 |
| S7 | AI deck fix (BL-01) | S (0.5d) | BLOCKED by S9 + V2-01 | — |
| S8 | Technical tab wiring (MJ-08) | S (0.5d) | CONDITIONAL (V2-06) | — |
| S9 | KPI data fix (BL-05) | M (2d) | CONDITIONAL (V2-01) | — |
| S10 | Multicharts thay Cá mập (BL-04) | M (2d) | BLOCKED by V2-02 + Q3 | — |
| S11 | Breadth + alert empty (C2-C4) | S (1d) | CONDITIONAL (V2-05) | — |
| S12 | Visual polish (Phase E) | M (2d) | READY (last) | — |
| S13 | Data layer (Phase F) | L (3-5d) | CONDITIONAL (V2-05) | — |

**Wave 1 (READY, không blocker)**: S4, S5 → có thể làm song song (khác file, không xung đột).
**Wave 2 (CONDITIONAL, sau khi cập nhật spec)**: S2, S3, S8, S9, S11, S13 (với V2 fixes).
**Wave 3 (BLOCKED)**: S7 (sau S9 + V2-01), S10 (sau V2-02 + Q3).
**Wave 4 (last)**: S12 (visual polish, sau tất cả).

---

## 6. Cách "yêu cầu multi-agent thực hiện"

### Mẫu yêu cầu (copy-paste cho coordinator)

```
Slice: <slice-key> (vd. dashboard-heatmap-focal)
Branch: feat/<slice-key>
Claim: <slice-key> (khai TRƯỚC dòng đầu tiên)
Skill bắt buộc: workflow-dev-loop + project-lessons + soc-uiux (+ test-driven-development nếu có test)
Audit: staff-engineer-review (B3 trước code, B8 sau code)
Plan: docs/PLAN_DASHBOARD_REFACTOR_20261114.md §Slice <Sx> + V2 corrections
AC: <Given/When/Then từ plan>
Gates: <danh sách gate từ §1 Bước 7>
Effort: <S/M/L>
STOP: <điều kiện dừng>
Báo cáo: ledger Entry + PR #N + gate results (PASS/FAIL/CHƯA CHẠY)
```

### Ví dụ yêu cầu S4 (focal point)

```
Slice: dashboard-triad-grid-focal
Branch: feat/dashboard-triad-grid-focal
Claim: dashboard-triad-grid-focal
Skill: workflow-dev-loop + project-lessons + soc-uiux
Audit: staff-engineer-review (B3/B8)
Plan: docs/PLAN_DASHBOARD_REFACTOR_20261114.md §Slice S4 + V2 corrections (MJ-06)
AC: Given viewport ≥1280px, When render, Then heatmap lane rộng hơn alert/AI lane.
Gates: npm run test:visual, npm run check:dom-landmarks, npx tsc --noEmit, npm run lint
Effort: S (0.5 ngày)
STOP: nếu thay đổi grid-template-columns phá layout responsive → dừng, báo.
Báo cáo: ledger Entry + PR #N + gate results
```

### Giao việc cho agent
1. Coordinator tạo claim row + branch name trong `docs/CLAIMS.md`.
2. Giao task cho FE agent: "Thực thi slice `<key>` theo runbook §1 (9 bước). Nạp skill `workflow-dev-loop` + `project-lessons` + `soc-uiux` trước dòng code đầu tiên. Claim đã khai ở `docs/CLAIMS.md`. Plan ở `docs/PLAN_DASHBOARD_REFACTOR_20261114.md` §Slice <Sx>. Audit B3 trước code, B8 sau code. Gate theo §1 Bước 7. Ship qua PR + merge + cleanup. Append ledger Entry."
3. FE agent thực thi, báo cáo verdict + gate results + PR number.
4. Auditor agent (subagent) chạy B3/B8 read-only, trả verdict.
5. Coordinator review → merge → cleanup → ledger.

---

## 7. Cạm bẫy đã gặp thật (từ AGENTS.md + lessons)

| Sai lầm | Hậu quả | Phòng tránh |
|---|---|---|
| Commit file shared | Hunk gộp 2 agent, tách không được | Claim + báo coordinator; hook chặn |
| Tự đặt số migration | `Conflicting migrations; multiple leaf nodes` | Để `makemigrations` sinh |
| Khai claim khi chưa `git status` | Che mất file đang bị giữ | Chạy `git status --short` trước |
| Chạy gate trước rebase | Báo xanh nhưng code sau rebase khác | rebase → migration → gate |
| Tin số migration đọc trong worktree | Worktree không thấy việc chưa commit của agent khác | Đọc head thật trên main tree |
| Hook chưa commit khi tạo worktree mới | Hook im lặng, mọi thứ lọt | `sh scripts/agent-install-hooks.sh` |
| Báo "PASS" cho thứ chưa chạy | False-positive, che lỗi | Ghi `CHƯA CHẠY` + lý do |
| Commit thẳng vào dev | Sinh migration trùng số | Branch `feat/<slice>` + PR |
| Không có môi trường ⇒ không có kết luận | Kết luận sai lệch | Ghi `CHƯA CHẠY` |

---

## 8. Tài liệu tham chiếu

- Plan: `docs/PLAN_DASHBOARD_REFACTOR_20261114.md` (v2, 13 slices, Owner decisions §12)
- Audit: `docs/AUDIT_PLAN_DASHBOARD_REFACTOR_20261114.md` (verdict PASS_WITH_CONDITIONS, 6 V2 findings)
- Protocol: `docs/AGENT_PROTOCOL.md` §10 (multi-agent), §11 (planning gate)
- Claim registry: `docs/CLAIMS.md`
- Ledger: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 487-494)
- Lessons: `docs/LESSONS/` (css-soc, frontend, build-gates, verification, multi-agent, tooling-traps)
- Skills: `.opencode/skills/` (workflow-dev-loop, multi-agent-workflow, project-lessons, soc-uiux)
- Staging: `docs/STAGING_VPS_RUNBOOK.md` (VPS 14.225.255.47)
- Heatmap code: `packages/web/src/components/dashboard/PortfolioHeatmap.js`
- Dashboard code: `packages/web/src/pages/DashboardPage.tsx`, `CoreDashboardPositionDeck.tsx`, `SmartStatsHeader.js`, `AIAdvisorAlertPanel.js`, `AIAdvisorDeckPanel.jsx`
- Widget pattern: `packages/web/src/components/VNStockChartPanel.js` (lazy import + injectCSS)
- Gate scripts: `packages/web/scripts/check-*.mjs` (đọc header để biết kiểm gì)
- Package scripts: `packages/web/package.json:7-34` (check:shell, check:tokens, check:contrast, i18n:scan:strict, etc.)
