# HANDOFF — Đợt 0 "gate xanh" (S0.1–S0.5) — slice `gate-p0-20261113` (2026-11-13)

> **Ngày:** 2026-11-13 · **Phạm vi:** đóng Đợt 0 của `docs/PLAN_REMAINING_WORK_20261113.md` (S0.1–S0.5)
> **Branch/commit:** `feat/gate-p0-20261113` → `dev` (PR) · claim `gate-p0-20261113` = `done`
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-gatep0` (đã xoá sau merge)
> **Plan:** `docs/PLAN_GATE_P0_20261113.md` (rev 2) · **Evidence:** `docs/evidence/gate-p0-20261113/gates.md`
> **Audit:** B3 `NEED_REVISION` (2 BLOCKER + 3 MAJOR + 3 MINOR) → rev 2 · B8 (re-audit) xem §4

---

## 1. Đã làm (tiếp nối phiên trước)

Phiên trước (`remaining-work-plan-20261113`, PR #369) để lại 3 commit trên branch `feat/gate-p0-20261113`
**chưa push, chưa có plan/evidence/S0.5/ledger/PR**. Phiên này:

1. **Rà soát lại** 3 commit đó bằng lệnh thật (không tin commit message) → 2/4 hạng mục xác nhận đúng,
   **phát hiện 1 lỗi P0 mới**: file "redaction note" tự ghi lại **nguyên văn token thật** (token sẽ lên GitHub).
2. **Lập plan** `docs/PLAN_GATE_P0_20261113.md` (rev 1) → audit độc lập `NEED_REVISION` → **rev 2** sửa hết 8 objection.
3. **Đo fail-before thật trên VPS** (3 file → 7 đỏ) → sửa → **pass-after xanh** → **full suite 0 đỏ**.
4. **Sửa lỗi rò token**: file note chỉ giữ tiền tố + hậu tố + sha256; **rewrite history branch** (token-free) + `force-with-lease`.
5. **Ghi lesson L-V10** (`scan-secrets` exit 0 ≠ repo sạch secret) + sửa số liệu §1.5 `docs/LESSONS/INDEX.md`.
6. **Đóng slice**: ledger Entry 476 · claim `done` + release claim stale · handoff này · PR → merge → dọn branch/worktree.

---

## 2. Phát hiện quan trọng (đọc trước khi làm việc tiếp)

### 2.1 P0 — token thật vẫn nằm trong `origin/dev` ⇒ **Owner phải REVOKE**

- `docs/evidence/staging-pro-layout/facts20.json` (đã merge vào `dev` từ slice `staging-pro-layout`) chứa
  4 lần token WebSocket thật `vni_internal_<77 ký tự>` (sha256 `ec8f9b90…`).
- Slice này đã **redact file đó** + **không ghi lại giá trị token** ở bất kỳ file tracked nào
  (`git grep -c "<token đầy đủ>"` = **0 hit** trên toàn repo) + **rewrite** branch để history không mang bản sao.
- ⚠ **Nhưng token vẫn còn trong history của `origin/dev`** ⇒ redact **không** thay thế được revoke.
  **Việc cần Owner làm:** revoke/rotate token `vni_internal_*` trên hệ thống cấp PAT (không phải việc code).
  Sau khi revoke: token cũ trả 401 (kiểm bằng 1 request — **CHƯA CHẠY**, không có token trong tay).

### 2.2 Bài học L-V10 — `scan-secrets` exit 0 ≠ repo sạch secret

Rule của scanner là **contextual**: giá trị phải đứng **ngay sau một key name** (`token=…`).
Secret nằm trong backtick/prose `.md` ⇒ không có key name liền kề ⇒ **false negative** ⇒ gate xanh giả.
⇒ AC sau khi redact phải là `git grep -c "<token đầy đủ>"` = 0 hit, **không** phải exit code của scanner.
Chi tiết: `docs/LESSONS/false-green.md` §L-V10 + `docs/evidence/staging-pro-layout/REDACTION_20261113.md` §3b.

### 2.3 Đính chính Entry 474 — 7 test echarts **KHÔNG** phải "pre-existing"

`docs/evidence/full-vitest-vps-20261113/gates.md:27` ghi 7 test echarts-canvas là *"Lỗi môi trường, pre-existing"*.
**Sai**: đó là **regression của D2** (`b3920f980` đổi import `AIUsageDashboard.tsx:11` từ `recharts` sang shim
`./charts/RechartsCompat` dùng `CanvasRenderer`; jsdom không có canvas). Bằng chứng: D2 **đã** mock shim ở
4 file test khác (`AdminAnalyticsPage.component.test.tsx:17`, `OrderFlowRadarPanel.component.test.tsx:22`,
`TenantAdminHomePage.component.test.tsx:31`, `ai-slo-dashboard.component.test.tsx`) ⇒ 2 file bị D2 **bỏ sót**.
Đính chính bằng Entry 476, **không** sửa Entry 474.

### 2.4 3 gate **pre-existing** đang đỏ trên `dev` ⇒ chặn mọi push (chưa xử lý trong slice này)

Đo lại trên `dev` sạch (không phải do diff của slice này):

| Gate | Lệnh | Kết quả trên `dev` sạch | Nguồn |
|---|---|---|---|
| `ui-check-light-theme` | `node packages/web/scripts/check-light-theme.mjs` | exit 1 — `.bg-emerald-700` chưa được phủ light mode (file `packages/web/src/components/advisory/AdvisoryOrderTicket.js`) | PR #364 / Entry 473 (`bg-emerald-600→700`) |
| `ui-check-i18n-hardcoded-scope` | `node packages/web/scripts/check-i18n-hardcoded-scope.mjs --all` | exit 1 — `src/components/VNStockChartPanel.js: 7 > baseline 4` (3 mới) | W-K (PR #355) |
| `ui-check-page-registry` | `node packages/web/scripts/check-page-registry.mjs` | exit 1 — **40 lỗi** `UNREFERENCED` registry entry | registry vs route (cần slice riêng) |

⇒ Slice này push `--no-verify` **với lý do ghi trong commit body + evidence + handoff** (theo `AGENTS.md`:
"không `--no-verify` trừ khi ghi lý do vào commit body"). **Phiên sau nên mở slice riêng** để xanh 3 gate này —
hiện chúng chặn push của **mọi** agent.

---

## 3. Gates chạy thật

Bảng đầy đủ: `docs/evidence/gate-p0-20261113/gates.md` (§1 baseline, §2 fail-before, §3 pass-after, §4 full suite, §4.1 gate khác).

Tóm tắt (chạy thật):

| Gate | Nơi chạy | Exit | Kết quả |
|---|---|---|---|
| `tsc --noEmit` | local (§12.2) | 0 | 0 lỗi |
| `eslint` 3 file test đổi | local (§12.2) | 0 | không output |
| `check-multi-agent` | local | 0 | 0 lỗi, 0 trùng migration (165 warning pre-existing) |
| `scan-secrets` | local | 0 | 4659 tracked, 4474 scanned, 185 skipped, OK |
| `check-ledger-entry` | local | 0 | 89 header / 88 distinct / max 476, 0 trùng mới |
| `check-ledger-entry --self-test` | local | 0 | 4/4 PASS |
| `check-lessons` | local | 0 | 14 file, 59/60 lesson, sạch |
| `normalize-eol` | local | 0 | OK (3 file đã chuẩn hoá LF) |
| `npm run i18n:scan:strict` | VPS | 0 | không đổi so với baseline |
| `npm run lint` (full src) | VPS + local | 1 | 2 lỗi pre-existing (`ShellMailConfigPage.tsx:95`, `VipLocalControlPage.tsx:369`), cả 2 file không trong slice diff |
| `npm run build` | VPS | 0 | tsc && vite build |
| `npm run test:components` (3 file) | VPS | 0 | 3 passed (3), 32 passed (32), 4.81s |
| `npm run test:components` (FULL SUITE) | VPS | 0 | 186 passed (186), 1251 passed (1251), 73.25s |
| `check-light-theme` / `check-i18n-hardcoded-scope` / `check-page-registry` | local | 1 | 3 gate pre-existing đỏ trên dev sạch (R6) — push `--no-verify` với lý do |

Fail-before (VPS, `origin/dev` = e59298e1c): 3 file, 7 failed | 25 passed (32), Errors 5, 6.42s (`dpr` ×6 + `clearRect` ×1 + S4 assert). Pass-after (VPS, a972fd040): 3 file, 32/32 passed, 4.81s.

---


## 4. Audit

- **B3 (audit plan, subagent read-only):** `NEED_REVISION` — 2 BLOCKER + 3 MAJOR + 3 MINOR → sửa hết ở plan rev 2
  (bảng đối chiếu objection ở plan §10).
- **B8 (re-audit revision cuối, subagent read-only):** `NEED_REVISION` — 6 objections (2 BLOCKER + 2 MAJOR + 2 MINOR). Chi tiết: `docs/evidence/gate-p0-20261113/b8-reaudit.md`.
  - #1 BLOCKER: claim row :1932 còn `in-progress` → đã sửa `done` (2026-11-13).
  - #2 BLOCKER: `normalize-eol` gate đỏ (3 file EOL drift) → đã chạy `--fix`, exit 0.
  - #3 MAJOR: handoff §3/§4 placeholder → đã điền.
  - #4 MAJOR: closure edits chưa commit → commit cùng `--no-verify` (lý do trong commit body).
  - #5 MINOR: claim lessons list không khớp plan → đã harmonize.
  - #6 MINOR: REDACTION note §3 còn cite AC cũ → đã harmonize với §3b (L-V10).
  - Điều đã PASS: scope 10 file (0 deny-list, 0 migration), tsc 0, check-lessons 0, check-multi-agent 0, check-ledger-entry 0 (+self-test 4/4), lint 2 lỗi pre-existing (không trong slice diff), secret redaction (4 REDACTED, token-free branch, còn trong origin/dev → Owner revoke), full suite VPS 186/1251 xanh.

VERDICT B8: NEED_REVISION → sau fix objections #1–#4: **PASS (pending re-verify)**.

---


## 5. Việc còn lại / Next steps

1. **Owner:** revoke/rotate token `vni_internal_*` (P0, xem §2.1) + xác nhận có purge history `dev` hay không (quyết định riêng).
2. **Owner:** chốt D1–D8 của `docs/PLAN_REMAINING_WORK_20261113.md` §6 (đặc biệt **D1** (B-2), **D2** (B-5 breaking), **D3** (B-4 `period=year`)) — Đợt 1–5 chưa bắt đầu.
3. **Slice riêng (P0):** xanh 3 gate ở §2.4 ⇒ mọi push mới không cần `--no-verify`.
4. **Đợt 1 (plan §4):** S1.1 (B-5 data hygiene) + S1.2/S1.3 (probe Q-B2/Q-B4) — cần Owner chốt D2 vì B-5 có rủi ro breaking cho widget team.
5. **Vệ sinh:** worktree `vninvest-wt-b1` (detached `4e86657e4`, B-1 đã xong) + `vninvest-wt-bespec` (claim `chart-widget-team` `in-progress`) + `vninvest-wt-plan` (PR #369 đã merge) — dọn theo `scripts/agent-cleanup.ps1` (xóa junction `node_modules` **trước** khi xóa cây).
6. **Claim stale:** `CLAIMS.md` còn nhiều dòng `in-progress` cũ (vd `chart-widget-team` dòng 40, `pm-review-20261108` 1883–1888) — `scripts/audit-status-claims.mjs --strict` là gate để đo.

---

## 6. Evidence

- Plan: `docs/PLAN_GATE_P0_20261113.md` (rev 2)
- Gates: `docs/evidence/gate-p0-20261113/gates.md`
- Redaction note: `docs/evidence/staging-pro-layout/REDACTION_20261113.md` (§3b)
- Baseline fail-before: `docs/evidence/full-vitest-vps-20261113/gates.md`
- Lesson: `docs/LESSONS/false-green.md` §L-V10
- Ledger: Entry 476
- Plan gốc (lộ trình Đợt 1–5): `docs/PLAN_REMAINING_WORK_20261113.md`
