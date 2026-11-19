# HANDOFF 2026-11-19 — UI/UX SSOT & nhất quán trình bày (bàn giao đội code) · rev4

- **Ngày**: 2026-11-19 · **Base đã cập nhật**: `dev@2b10b3016` (rev1 ghi `69141ab93`, lệch 6 commit — O-19) · **Trạng thái**: `AGREE vòng 4 — sẵn sàng S0` (B3 v1 NEED_REVISION → rev2 → v2 NEED_REVISION → rev3 → v3 NEED_REVISION → rev4 → v4 **AGREE**, 0 blocker/0 major; 3 reservation minor R1–R3 đã đóng).
- **Evidence**: `docs/AUDIT_UIUX_FULL_20261119.md` (audit nguồn) · `docs/evidence/uiux-ssot/AUDIT_PLAN_PROGRAM_20261119.md` (B3 v1) · `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 536.
- **Spec**: 5 file `docs/PLAN_UIUX_*_20261119.md` (đọc cùng handoff này). Plan là nguồn sự thật cho từng slice; handoff là nguồn sự thật cho lịch trình/gate/ownership.
- **Quy trình**: `workflow-dev-loop` 9 bước + `multi-agent-workflow` 8 gate. File repo thắng skill khi xung đúng.

## 0. Disposition verdict B3 v1 (bắt buộc đọc trước khi nhận slice)

| Objection | Xử lý trong rev2 |
|---|---|
| O-01 test đỏ xanh giả | `PLAN_W0` Task 1: regex `(?<![-\w])`, strip comment, tách base/light, control âm+dương |
| O-02 contrast đỏ | `PLAN_W0` Task 2: nâng `--text-muted` dark `#64748b→#94a3b8` + sửa `--bg-panel-soft` tại `theme/tokens.css:14`; gate phải đỏ trước/xanh sau |
| O-03 delta chưa chốt | Bảng D1 dưới đây mở rộng **8 nhóm**; Entry 531 I.1 "giữ giá trị" bị D1 rev2 thay thế |
| O-04 light tắt cứng | Cơ chế **dev/staging-only** (Q2 đã chốt), `PLAN_W0` Task 4 |
| O-05 20 vs 13 | Tách `BASE_TOKENS` (13→0) / `LIGHT_OVERRIDES` (7, dời sang owner) |
| O-06 4/5 RED + detector | `PLAN_W1_CHROME` Task 1: 4 RED + 1 regression; detector strip comment + `renderElement("h1")` |
| O-07 prop `actions` | Thêm prop + `.d.ts` + test render |
| O-08 glass đục | Định nghĩa token glass có alpha + backdrop-filter; test computed style |
| O-09/O-10/O-11 modal | Full path + symbol, dùng `ui/dialog.tsx`/`drawer.tsx`, test hành vi Tab/Escape/focus-return |
| O-12 6 file focus sót | Bổ sung 6 file vào `PLAN_W1_A11Y` Task 3 |
| O-13 a11y-runtime 113 | Ghi baseline thật; modal test bằng component test, không tin runtime exit 0 |
| O-14 baseline sai | Bảng §4 viết lại với số thật + nghĩa "exit 0 = không có vi phạm mới" |
| O-15 `.vnbConsole` owner thứ 3 | Ghi ngoại lệ có chủ đích + allowlist test trong `PLAN_W0` Task 1 |
| O-16/O-17 Cmd+K/density | Tách sang S5 (`PLAN_UIUX_W3_COMMAND_DENSITY_20261119.md`) — Q4 chốt |
| O-18 S3/S4 đụng file | Thêm dependency S4←S3 + bảng file ownership §2 |
| O-19 ledger | Auditor đã khôi phục 533, đánh lại 534/535, thêm 536; rev2 ghi Entry 537 |
| O-20 `superpowers:*` | Thay bằng `workflow-dev-loop` + `writing-plans` |
| O-21 `impeccable document` | **Đính chính một phần**: lệnh tồn tại trong skill (`reference/document.md`), nhưng là *skill procedure* không phải CLI binary — plan ghi đúng nhãn |
| O-22 "timeout 300s" | Đây là harness timeout, không phải cơ chế script; ghi thời gian chạy thật ~6.2 phút |
| O-23 claim stale | **Q5 chốt**: 2 claim đã có dòng `done` → bỏ bước release, không đụng NUL byte |
| O-24 (vòng 2) accent-cyan light | rev3: giữ base `#06b6d4` + `--text-on-accent: #0f172a` ở light block; D1 table sửa muted net 0; C1 direct value; C3 flag precedence; C5 `contrast-green.md` |
| O-25 (vòng 3) text-muted light inverse | rev4 fix (a): **không** khai `--text-muted` trong light block; giữ base `#94a3b8` direct. Gate 0 mới; app light 2.45 là known limitation (dev-only) — mở program riêng sửa gate include `light-theme.css`. Không nâng baseline (R2) |

## 1. Quyết định Owner (không hỏi lại)

| # | Quyết định | Hệ quả |
|---|---|---|
| D1 rev2 | Token owner = `theme/tokens.css`. Chấp nhận **đủ 8 nhóm delta**: cyan `#22d3ee→#06b6d4` · muted dark **giữ `#94a3b8` (không hội tụ về `#64748b`)** (bỏ indirection `var(--color-text-muted)`, net delta 0) · border `rgba(80,120,168,.15)→#1e293b` · fs `0.68/0.75/0.85→0.75/0.8125/0.875` · **bg-panel** `rgba(8,23,52,.4)→#0f172a` · **bg-panel-soft** `rgba(15,23,42,.3)→#0f172a` · **shadow-sm/md** `0 2px 8px/.15→0 1px 2px/.05` · **font-sans** `ui-sans-system…→"Inter","Segoe UI"…`. Ngoại lệ: `.vnbConsole` giữ giá trị dark-first (`soc.components.css:4341-4352`) — allowlist, không migrate. `--text-muted` dark phải nâng lên `#94a3b8` trong W0 để qua WCAG AA. | Ảnh before/after 8 ảnh (4 route × 2 theme) |
| D10 mới (O-25) | `--text-muted` **giữ `#94a3b8` direct**, KHÔNG override light (gate 0 mới); app light 2.45 là known limitation dev-only, sửa gate ở program riêng. Lý do: max contrast của 1 màu trên 2 nền ≈4.38 < 4.5 — không có giá trị đơn lẻ pass cả hai | Không nâng baseline; ghi limitation vào `contrast-green.md` |
| D9 mới (O-24) | Light theme: `--accent-cyan` **giữ base `#06b6d4`** (gate 8.31 ✅; chữ trắng 2.43 ❌) + thêm `--text-on-accent: #0f172a` trong light block (chữ đen trên cyan **7.35** ✅). Không dùng `#0e7490` (gate 3.77 ❌). Không đổi `--pf-gain/--pf-loss` (L-F08) | 1 dòng token + test contrast; `contrast-green.md` |
| D2 | Admin card → **glass thật** (alpha < 1 + `backdrop-filter`), không phải `bg-[var(--bg-panel)]` đục | Token glass mới trong owner + test computed |
| D3 | W1 làm cả 4 nhóm, tách `uiux-chrome-w1` + `uiux-a11y-w1` theo file ownership | 2 slice song song được |
| D4 | `DESIGN.md` sinh **sau W0**, bằng skill `impeccable` procedure `document` (không phải CLI) | Không SSOT thiết kế thứ hai |
| D5 mới | Light theme bật **chỉ dev/staging** bằng query param/localStorage có guard; revert trước production | 8 ảnh light của W0 chạy được |
| D6 mới | W1-chrome scope = 4 route còn RED; `ShellOperationsCenterPage` → regression test | Không đòi 5/5 |
| D7 mới | Cmd+K toàn app + density chuyển **S5/W3**; W2 chỉ freshness + DESIGN.md | Tránh mount trùng/context giả |
| D8 mới | S0 **bỏ** bước release claim (đã `done`); chỉ merge docs | Không nhiễu CLAIMS.md/NUL byte |

**Cấm**: đổi màu tăng/giảm (L-F08) · thêm vào `soc.module.css` (L-F03) · script mất duration/easing (L-F05) · commit deny-list · `npm install` · test/build/E2E local (chỉ VPS staging).

## 2. Ma trận slice + file ownership

| Slice | Agent / branch | Wave | Phụ thuộc | Plan | File riêng (không agent khác đụng) |
|---|---|---|---|---|---|
| S0 | coordinator | pre | — | §3 | docs only |
| S1 | `uiux-ssot-w0` / `feat/uiux-ssot-w0` | W0 | S0 | `PLAN_UIUX_W0_TOKEN_SSOT_20261119.md` | `soc.tokens.css`, `theme/tokens.css`, `check-*-baseline/*.json`, `main.tsx` (dev guard) |
| S2 | `uiux-chrome-w1` / `feat/uiux-chrome-w1` | W1 | S1 | `PLAN_UIUX_W1_CHROME_20261119.md` | `adminUi.tsx`, `ShellPageTemplate.js/.d.ts`, `components/feedback/*`, 4 route |
| S3 | `uiux-a11y-w1` / `feat/uiux-a11y-w1` | W1 | S1 | `PLAN_UIUX_W1_A11Y_URL_20261119.md` | `components/ui/*`, `advertising/*`, 5 modal path, 8 focus-ring file |
| S4 | `uiux-exp-w2` / `feat/uiux-exp-w2` | W2 | **S1, S2, S3** (O-18) | `PLAN_UIUX_W2_EXPERIENCE_20261119.md` | `components/feedback/FreshnessBadge.tsx`, `DESIGN.md` |
| S5 | `uiux-cmd-w3` / `feat/uiux-cmd-w3` | W3 | S2 | `PLAN_UIUX_W3_COMMAND_DENSITY_20261119.md` | `CommandRegistry`, `SettingsProvider`, `TenantAdminLayout.tsx`, `FullLayout.tsx` |

S2 ∥ S3 được (i18n module hoá, mỗi slice 1 module mới). S4 **không** song song S3 (cùng `CoreDashboardPositionDeck.tsx` + `PortfolioHoldingsPage.tsx`). Mọi slice tạo `locales/{vi,en}/<slice>.js` riêng; coordinator đăng ký barrel lúc merge.

## 3. Precondition S0 (đã sửa theo D8/Q5)

1. **Không** append dòng `released`: verified `ai-cc-uiux` có dòng `done` ở `CLAIMS.md:1629`, `vnbroker-console` ở `:1685/:1691/:1697`. Ghi "already done — no release needed" trong PR body. Không đụng NUL byte tại `CLAIMS.md` (~byte 269127).
2. Merge 6 file docs (handoff + 5 plan) vào `dev` **trước** `new-agent.ps1` — worktree tạo từ `HEAD`.
3. `git status --short` sạch + hook đã commit (`sh scripts/agent-install-hooks.sh`, L-005).

## 4. Baseline thật (số đã replicate trong phiên rev2)

| Gate | Hiện tại | Nghĩa exit 0 | Mục tiêu slice |
|---|---|---|---|
| `check-token-conflict` | **13** (root-only 11) | không có vi phạm MỚI | **0**, baseline = 0 (S1) |
| `check:tokens` | 0 — 79 hex allowlisted | thật | 0, không nới allowlist |
| `check:contrast` | 0 — 7 cặp × 2 mode | thật | 0 |
| `check-theme-contrast` | **32 vi phạm + 12 undecodable** | không có vi phạm MỚI | **0 vi phạm mới** (W0 simulation phải exit 0) |
| `check-portfolio-contrast` | 0 — 12 cặp × 2 theme | thật | 0 |
| `check:light-theme` | 0 — 230 utility/638 file | thật | 0 |
| `check:dom-landmarks` | 0 | thật | 0 |
| `check-heading-contract` | **24** | không có vi phạm MỚI | ≤20 (4 route sửa) + detector bắt `renderElement` |
| `check-focus-ring` | **8** (6 file nằm ngoài plan v1) | không có vi phạm MỚI | **0** (S3Cover cả 8 file) |
| `check-uiux-budget` | **FAIL** — tổng 129; CSS-2 55, A11Y-9 16 | rule tăng = FAIL | PASS: CSS-2 ≤46, A11Y-9 ≤5 (S3) |
| `check-a11y-runtime` | **113**, 10 route, build 2026-10-21 | subset của baseline | 0 vi phạm mới; **modal dùng component test**, không tin runtime |
| `test:visual` | CHƯA CHẠY | — | baseline ảnh mới 4 route × 2 theme |

> Cwd: `check-dom-landmarks.mjs` / `check-portfolio-contrast.mjs` resolve path tương đối → chạy trong `packages/web`.
> `scan-ui-guidelines.mjs` không có timeout nội tại; lần chạy thật ~6.2 phút (O-22).

## 5. Giao thức audit khép kín

B3 auditor khác session, `edit: deny`, verdict ghi `docs/evidence/uiux-ssot/<slice>/AUDIT_PLAN.md`. `NEED_REVISION` → sửa → audit lại, **tối đa 3 vòng** (v1 đã dùng 1). B6 fail-before có control âm+dương. B7 sau `agent-sync.ps1` (L-003), VPS staging only. B8 0 blocker + 0 major. B9 claim done → Entry ledger → PR merge-commit → cleanup.

## 6. Rủi ro

R1 delta D1 đã chốt 8 nhóm — nếu ảnh staging lệch ngoài bảng → dừng hỏi Owner, không tự tạo alias. R2 không nâng baseline giả. R3 `git checkout --` cấm (L-A01) — dùng `git show HEAD:<f> > <f>` qua `cmd /c`. R4 `core.autocrlf=true` là bình thường. R5 CSS build/đọc tay candidate. R6 giữ duration/easing. R7 i18n 2 locale + coordinator đăng ký barrel. R8 `.vnbConsole` là ngoại lệ có chủ đích — must có test allowlist. R9 light guard phải revert trước production.

## 7. Definition of Done

0 conflict token · `check-theme-contrast` 0 vi phạm mới · budget PASS (≤46/≤5) · focus-ring 0 · 4 route dùng chrome + detector nhận `renderElement` · 5 modal có trap hành vi · 29 điểm deep-link · ảnh 4 route × 2 theme (dev flag) · 5 PR merge-commit · `DESIGN.md` sau W0 · S5 tách riêng.

## 8. Next

Auditor vòng 2 audit lại rev2 (0 blocker + 0 major) → S0 merge docs → cấp worktree S1. **Chưa có code production nào sửa, chưa claim, chưa merge.**
