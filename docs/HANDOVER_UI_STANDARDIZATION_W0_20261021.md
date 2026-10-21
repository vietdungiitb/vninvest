# HANDOVER — UI Standardization W0

> **PR:** [#272](https://github.com/vietdungiitb/vninvest/pull/272) · **Nhánh:** `feat/uistd-w0` @ `7e0982952` · **Base:** `dev` @ `e7b008f25`
> **Ngày:** 2026-10-21 · **Quy trình:** `multi-agent-workflow` Stage 1→8 (Plan → Audit Plan → Claim → Code → Audit Code → Test → Sync/Merge → Retrospective)
> **Tài liệu:** plan `docs/PLAN_UI_STANDARDIZATION_W0.md` (v1.3) · audit plan (verdict `AGREE`) · **audit code** `docs/AUDIT_UI_STANDARDIZATION_W0.md` · **test** `docs/TEST_REPORT.md` · ledger **Entry 390** · báo cáo slice `docs/SUMMARY_uistd-w0-{template,gates,tokens}.md`

---

## 1. Đã làm (3 slice, 3 agent, tên agent khớp hậu tố branch)

| Slice | Agent / branch | Nội dung | Kết quả |
|---|---|---|---|
| **S1** | `uistd-w0-template` / `feat/uistd-w0-template` | Template chuẩn `CommercialPage` + 4 primitive + CSS module + test | 9 file · test **20/20** · 0 hex cứng |
| **S2** | `uistd-w0-gates` / `feat/uistd-w0-gates` | 5 gate máy **baseline-locked** + điểm gọi trong `pre-push-gate` | 5 gate exit 0 · 27 self-test · **probe 17/17** |
| **S3** | `uistd-w0-tokens` / `feat/uistd-w0-tokens` | Đo light theme (script 979d) + ADR — **đo đủ, KHÔNG sửa** | số đo tái lập được tuyệt đối |

⇒ Đã merge theo thứ tự **S3 → S1 → S2** vào `feat/uistd-w0` (3 merge commit, không conflict).

## 2. Vì sao W0 **không** đụng light theme

Đo thật (không suy đoán): H1 `/admin/users` = **20.1728:1 (dark)** nhưng **1.0000:1 (light — vô hình)**; 60 phần tử chữ: dark 8/60 dưới AA, **light 28/60**; canvas `oklch(0.13 0.028 261.692)` → `#030712` ở **cả 2 theme** ⇒ `index.css:53` **không có** override light cho họ `--color-*` (chỉ `theme/tokens.css:65` + `soc.tokens.css:124` override họ `--text-*`).
H1 admin dùng `text-slate-950` **cứng** (`packages/web/src/pages/admin/adminUi.tsx:24`) ⇒ **đổi `--text-primary` không sửa được**; override toàn cục phá ≥8 trang admin (20.17:1 → 1.0955:1).
⇒ **Sửa light theme là thay đổi >89 file** ⇒ **NG-1 của plan cấm** ⇒ W0 chỉ **đo + ghi ADR + hỏi Owner**.

## 3. ⚠️ CẦN OWNER CHỐT (2 câu, chặn wave W1)

### Câu 1 — Light theme (ADR `docs/ADR_THEME_LIGHT_20261020.md` §5)

| Phương án | Nội dung | Chi phí | Rủi ro |
|---|---|---|---|
| **(a)** | Làm light theme **đúng** | ≥89 file / 497 chỗ màu chữ cứng + 36 file nền tối cứng | Rộng, phải chia wave |
| **(b)** | **Tắt** light theme khỏi bộ chọn | ~3 dòng | Người dùng mất theme sáng (đã hỏng) |

*(Hiện tại: light theme vẫn **hỏng** và **vẫn hiện** trong bộ chọn ⇒ H1 admin **vô hình**.)*

### Câu 2 — M-10: họ token của template mới

`packages/web/src/components/commercial/CommercialPage.module.css` dùng `var(--color-text-primary|secondary|muted)` + `var(--color-bg-panel)` — họ **không đảo theo light theme** ⇒ ở light theme chữ `#f1f5f9` trên nền sáng = **1.0955:1 (vô hình)**.
Template shell sẵn có dùng họ **có đảo** (`--text-primary`/`--text-secondary`, `ShellPageTemplate.module.css:60,98`).
⇒ **Đổi họ token của template mới TRƯỚC W1** (khuyến nghị) — đây là sửa **template mới**, **không** phải sửa light theme ⇒ không đụng NG-1, nhưng vẫn cần Owner đồng ý vì nó là quyết định hệ token.

## 4. Việc còn lại (backlog W1) — đã ghi ở `SUMMARY_uistd-w0-gates.md` §11

| # | Việc | Vì sao chưa làm ở W0 |
|---|---|---|
| T-1 | Sửa **6 inline `outline:"none"`** (`TenantAdminCommandPalette.tsx:57`, `ScreenerFilterBuilder.tsx:77,96,120,143`, `ScreenerSchedulePanel.tsx:145`, `SocScreenerConfigForm.tsx:127`, `SocScreenerRuleModal.tsx:45,47,48`, `ScreenerPage.tsx:92`) | ngoài scope W0; file thuộc wave W1–W3. **Gate đã bắt được, baseline đã ghi** |
| T-2 | `check-a11y-runtime`: lấy mẫu **phân bố theo vùng** (hiện lấy 250 phần tử text **đầu** ⇒ mới đo **shell**, chưa đo nội dung route) | đổi cách lấy mẫu ⇒ phải **đo lại baseline trên staging** |
| T-3 | Đọc 12 token `--pf-*` (màu tăng/giảm) ở **runtime** (qua canvas) thay vì bỏ qua | cần staging + đo lại baseline |
| T-4 | `check-theme-contrast`: CONTROL của `--self-test` nên assert "số cặp **đã đo** ≥ N" | nhỏ |
| T-5 | `check-heading-contract`: bắt `<h1>` tạo qua **biến** (`const Tag="h1"`) | giới hạn phân tích tĩnh |
| T-6 | Gộp **5 key i18n** `commercialPage.*` vào `src/i18n/{vi,en}.js` | **KHÔNG** nằm trong deny-list §2 ⇒ coordinator làm được ở PR riêng, **không cần `--no-verify`**; phải sửa **cả 2 locale** cùng lúc (`i18n/index.js:42` fallback về từ điển VI nếu thiếu key EN) |

## 5. Gate đã chạy (exit code thật, xem `docs/TEST_REPORT.md`)

`tsc` 0 · `lint` 0 error (4251 warning) · `vitest` 0 (169 file/1162 test) · `jest` **1** (3 suite/9 test = **đúng baseline dev**, delta 0) · `build` 0 · `check:tokens` **1** (1 lỗi nền, delta 0) · `check:contrast` 0 · `check:dom-landmarks` 0 · `i18n:scan:strict` 0 · `check-lessons` 0 · `check-multi-agent` 0 · `normalize-eol` 0 · `pre-push-gate` **27 PASS / 1 SKIP / 0 FAIL** · **5 gate UI exit 0** · 5 self-test 27 case · **probe 17/17**.

> **CHƯA CHẠY (không ghi PASS):** `npm run test:visual` · BE test (cần Postgres; Docker Desktop hay tắt) · staging E2E ngoài 10 route ghim.
> **1 SKIP trong pre-push:** `ui-check-a11y-runtime` **hết 300 s** (10 route × 30 s + login trên staging) ⇒ in `CHUA CHAY`, **không chặn push** (thiết kế M-9) ⇒ **cần nới timeout hoặc đưa gate ra khỏi đường push** (xem T-2).

## 6. Audit code — vòng 1 FAIL, vòng 2 PASS_WITH_MAJOR

Audit độc lập (read-only) tìm **2 BLOCKER xanh giả** đã **chứng minh bằng chạy thật**:
- **B-1** — `check-a11y-runtime` coi route **không đo được** là "không có vi phạm" ⇒ in xanh **+ gợi ý hạ baseline** (4/10 route timeout ⇒ 44/113 vi phạm bị coi "đã hết").
- **B-2** — `check-theme-contrast`: cặp FAIL đổi sang `oklch()` ⇒ rơi khỏi tập ⇒ **xanh** (đường lách 1 dòng).

Đã sửa **2 BLOCKER + 9 MAJOR**; **probe suite 17/17** (fixture ngoài repo, baseline đo trên fixture **sạch** rồi mới mutate) ⇒ tất cả đường lách đã bị chặn.
Baseline được **tái-key** (id mang **giá trị**/**số lần**) với **tập vi phạm gốc giữ nguyên** (thêm 0, bớt 0) — kiểm bằng script so tập.
⇒ Chi tiết: `docs/AUDIT_UI_STANDARDIZATION_W0.md`.

## 7. Bẫy môi trường (đã gặp — đừng lặp lại)

| Bẫy | Hiện tượng | Xử lý |
|---|---|---|
| **Gate so BYTE + worktree checkout LF** | `verify-global-config` **FAIL ở worktree**, **PASS ở main tree** dù `sha256(HEAD) == sha256(dev) == sha256(worktree disk)` (chỉ khác EOL) | **push từ main tree**; **không** sửa gate (gate đúng, môi trường lệch) — L-G08 |
| **PowerShell `Set-Content -Encoding utf8` thêm BOM** | commit message bắt đầu bằng `﻿` | viết message ra **file** bằng Node (`fs.writeFileSync`) rồi `git commit -F` |
| **Append file CRLF bằng Node (LF) ⇒ lệch EOL** | pre-commit hook `normalize-eol` **BLOCKED** | `node scripts/normalize-eol.mjs --fix` → kiểm `git diff --numstat` → commit lại (L-T01) |
| **staging route timeout** | `check-a11y-runtime` đo được 6/10 (lần audit) hoặc 9/10 (lần tôi) | gate nay in `CHUA CHAY` + **không** kết luận xanh (đã sửa B-1) ⇒ cần staging ổn định + nới timeout (T-2) |

## 8. Claim

| Agent | Claim | Trạng thái |
|---|---|---|
| `uistd-w0-template` | `docs/CLAIMS.md` (S1) | **done** |
| `uistd-w0-gates` | `docs/CLAIMS.md` (S2) | **done** |
| `uistd-w0-tokens` | `docs/CLAIMS.md` (S3) | **done** |
| `uistd-w0-coord` | `docs/CLAIMS.md` (tích hợp + audit vòng 2 + ledger + handover) | **done** |

## 9. Sau khi PR #272 merge

1. `pwsh -File scripts/agent-cleanup.ps1 -Branch feat/uistd-w0 -Execute` (xoá worktree `agent-uistd-a1/a2/a3`)
2. Sửa **plan v1.4**: bỏ "AC-5" (`PLAN:15,47`) và "AC-6" (`PLAN:39`) — chỉ có **AC-1..AC-4**; thêm "AC-5b" (quét hex trong JSX) như một AC riêng vì `check:tokens` **không** quét `.tsx` (C-1)
3. Mở **wave W1** sau khi Owner chốt §3
4. Cân nhắc đưa `check-a11y-runtime` ra khỏi **đường push** (chạy theo lịch) để push không mất 5 phút
