# AUDIT PLAN v2 — re-audit B4 (độc lập, chỉ đọc)

| | |
|---|---|
| **Scope** | Đối chứng sửa đổi của `docs/PLAN_NEXT_PHASE_20261108.md` (104 dòng, B2 revised) so với verdict B3 `docs/evidence/next-phase/AUDIT_PLAN_20261108.md` (OBJ-1, OBJ-2, OBJ-3 + 3 improvement opportunities) |
| **Ngày** | 2026-11-08 |
| **HEAD lúc audit** | `5315e7cca` (branch `license-portal-lp1`) · plan v2 đang `M docs/PLAN_NEXT_PHASE_20261108.md` (chưa commit) · `?? packages/core/backend/src/commercial/test_license.py` còn nguyên |
| **Auditor** | Auditor độc lập B4 (phiên khác planner), **chỉ đọc — không sửa code, không commit** |
| **Đã đọc** | `docs/PLAN_NEXT_PHASE_20261108.md` v2 (toàn bộ 104 dòng) · `docs/evidence/next-phase/AUDIT_PLAN_20261108.md` v1 (toàn bộ 66 dòng) · `git rev-parse/status/branch` (lệnh đọc lại) |

## Đối chứng từng objection B3 → plan v2

| OBJ (B3) | Trạng thái | Bằng chứng trong plan v2 (`file:line`) |
|---|---|---|
| **OBJ-1 — T1: phân loại comment/string/JSX + acceptance 3 phần** | **ĐÃ ĐÓNG** ✅ | B1 gate trước claim tại `docs/PLAN_NEXT_PHASE_20261108.md:56`: "Chạy grep độc lập trên 7 file `SRC9` tại HEAD kế hoạch (`ai-cc-i18n-clean.component.test.ts:39-47`), phân loại từng dòng tiếng Việt (block/line comment / string literal / JSX text), đính kèm evidence… Số '93 dòng, 9 file' … là **CHƯA XÁC MINH**". Rescope tại `:57`: "Nếu có string/JSX text → **rescope** thành i18n-key placement vào `vi.js`/`en.js` + verify EN render (L-V04)". Acceptance tại `:59`: "**0 hit trên independent scan + AC5 PASS + full-suite count re-measured sau rebase** (ghi rõ quy tắc exclude của Entry 424: `--exclude auth-forms-rhf-extra`)". Q1 trở thành gate B1 tại `:90` (không còn câu hỏi mở khi B4). Đúng suggested fix B3 (`AUDIT_PLAN_20261108.md:41`). |
| **OBJ-2 — T0: tách T0a read-only / T0b deploy** | **ĐÃ ĐÓNG** ✅ | Tách tại `docs/PLAN_NEXT_PHASE_20261108.md:48-50`: "**T0a — read-only, evidence-only (không claim, không deploy, không commit)**… `docker-compose.staging.yml` vs git chỉ còn đúng hunks `CORE_AD_SIGNING_SECRET` ở 5 service + backup `.bak.20261108` tồn tại + secret có trong `compose.staging.env`" + "**T0b — deploy (thuộc B5/B7, chỉ khi coordinator xác nhận staging idle)**… **không** chạy trong T0a" + "Deploy T0b là acceptance của luồng B5/B7, không phải của T0" (`:50`). Đúng suggested fix B3 (`AUDIT_PLAN_20261108.md:48`). |
| **OBJ-3 — T2: operationalize acceptance + fallback giữ ticket** | **ĐÃ ĐÓNG** ✅ | Operationalize tại `docs/PLAN_NEXT_PHASE_20261108.md:65-66`: "chạy lẻ **3 lần liên tiếp**, trace từng bước… Giả thuyết worker rò rỉ (Entry 424:7) đưa vào trace checklist" + acceptance: "**3 lần chạy lẻ trên VPS đều PASS, wall-clock <20s mỗi lần** (đo bằng `time` hoặc `Measure-Command` trên VPS, không đo local) **và full-suite count không đổi** (cùng quy tắc exclude như T1)" + "Không tái hiện được ⇒ ghi **'flaky-unconfirmed, giữ ticket mở'** kèm lệnh tái hiện để triage sau, **không** đóng ticket". Ghi chú `--testTimeout` là ngưỡng fail tại `:64`. Đúng suggested fix B3 (`AUDIT_PLAN_20261108.md:55`). |

## Improvement opportunities B3 — đối chứng

| Mục (B3:57-62) | Trạng thái | Bằng chứng plan v2 |
|---|---|---|
| T3 parse probe + log gate cụ thể | **ĐÃ ĐÓNG** ✅ | `docs/PLAN_NEXT_PHASE_20261108.md:72`: parse probe `[System.Management.Automation.PSParser]::Tokenize` hoặc `pwsh -NoProfile -Command` chế độ parse-only, gate nhẹ local theo §12. Acceptance `docs/PLAN_NEXT_PHASE_20261108.md:74`: "không regression ở cổng log gate cụ thể `check-multi-agent.mjs`". |
| Lessons thêm L-V03 + gắn L-V04 | **ĐÃ ĐÓNG** ✅ | Header `docs/PLAN_NEXT_PHASE_20261108.md:24` liệt kê L-V03; nguồn `:25` cite L-V03 (`verification.md:57-71`); checklist `:33-34` tick L-V03 (git status sau lệnh) + L-V04 (test dương tính); T1 acceptance `:59` "Kiểm dương tính: nếu thêm key mới, key hiển thị đúng cả VI/EN (L-V04)". |
| Addendum drift HEAD | **ĐÃ ĐÓNG** ✅ | `docs/PLAN_NEXT_PHASE_20261108.md:22`: "HEAD trên main tree là `5315e7cca` (branch `license-portal-lp1`), 2 commit ahead `origin/dev`… Baseline trên… **không** phải hiện trạng tại thời điểm audit. Trước B5 phải re-sync…". |

## Objection mới

Không có objection mới. Không phát hiện mâu thuẫn mới trong plan v2; câu chữ "cổng log gate" tại `docs/PLAN_NEXT_PHASE_20261108.md:74` hơi vòng vo nhưng đã gán tên gate cụ thể `check-multi-agent.mjs` nên B5 thực thi được.

## VERDICT

**PASS** — OBJ-1, OBJ-2, OBJ-3 đều ĐÃ ĐÓNG với bằng chứng `file:line` trong plan v2 (T1: `docs/PLAN_NEXT_PHASE_20261108.md:56-59`; T0: `:48-50`; T2: `:65-66`); 3 improvement B3 cũng đã có mặt (`:22`, `:24-25`, `:33-34`, `:72-74`). Plan đủ điều kiện sang B5 (claim + worktree). Không ý kiến đạo đức/pháp lý.
