# Kế hoạch thực hiện — Design Token Waves (phản biện + chi tiết bàn giao) — 2026-09-24

> Đầu vào: `docs/DESIGN_TOKEN_AUDIT_20260924.md` (300 dòng, ERR-01..ERR-65, 5 Waves).
> Phản biện độc lập (verify bằng grep/read, xem `docs/evidence/design-token/R0-REVIEW.md` nếu cần chi tiết lệnh):
> - **CONFIRMED**: 34px (`ShellPageTemplate.module.css:72`), 28px (`aiSettings.module.css:91`), 21px (`soc.components.css:2642`); `text-[10px]` ×12 (3 admin files); `dotColor #10b981` (`SocOverviewPanel.tsx:501`); `#a855f7` (`SocQueueTierFieldSet.tsx:117`); `:root` dark-only ở cả 3 files + 0 `[data-theme="light"]` override trong `components/*.css`/`soc/*.css`; `data-theme` mechanism (`index.css:13`, `main.tsx:177,179`, dark là default).
> - **C1 (blocker)**: Wave 1 không có light target — SSOT (`theme/tokens.css`, 56 dòng) cũng dark-only, ticket tự bịa giá trị light (`#f8fafc`) chưa duyệt thiết kế. → Thêm **W1-0**: chốt palette light trước, không implementer nào được tự đoán.
> - **C2 (blocker)**: `components/soc/ui/Button` **KHÔNG TỒN TẠI** — toàn bộ ticket D (ERR-55..64) unimplementable as-written. Button thật: `components/ui/button.tsx` (shadcn-style, variants default/destructive/outline/secondary/ghost/link/success — **không có `danger`**), class dark-only, SOC dùng `createElement` (phải convert). → Sửa target + variant map + visual QA bắt buộc.
> - **C3**: alias `:root` (`sh-c-*`, `ais-*`, `soc-c-*`) là value-preserving có chủ ý (comment `aiSettings.module.css:1-6`), không phải "palette lỗi" đơn thuần; đổi sang semantic = bỏ self-containment — quyết định kiến trúc, ghi vào W1-0.
> - **C4**: đếm "12 raw button" = 12 files, thực tế **51 occurrences** — ước lượng effort D theo occurrences, không theo files.
> - **C5**: severity inflation — `font-size 34px→22px` gắn Critical nhưng Regression: Low, trong khi đổi 34→22 là thay đổi visual lớn (cần visual QA, không thể Low).
> - **C6**: W1-5 nhầm scope (34px thuộc ShellPageTemplate, không phải theme.module.css); Wave gates thiếu `check:shell`/contrast/vitest ở Wave 1.
> - **C7 (process)**: ledger trùng số **Entry 213** (UI audit + W1) — đã renumber W1→217; **chưa có commit nào** từ `df8f2ddf` (claim "commit-push" SAI trên working tree này: audit doc + ledger + AGENTS đều uncommitted).

## Quy ước bàn giao (Zero-Question)
Mỗi ticket: Scope (file:line) · Yêu cầu · AC đo được · Phản biện tự trả lời · Minh chứng (`docs/evidence/design-token/<ID>/gates.md` + screenshots dark/light) · Cấm: đụng state/API/logic, thêm dep, mass `eslint-disable`.

## Wave 1 — Foundation (làm theo thứ tự, W1-0 trước)

### W1-0 — Chốt light palette + SSOT light blocks (BLOCKER, 0.5–1d, Designer + FE lead)
- Yêu cầu: bảng màu light cho mọi semantic token (bg/text/border/accent/shadow) + contrast ≥4.5 (dùng `scripts/check-contrast.mjs` sẵn có); quyết định C3 (giữ alias value-preserving hay semantic hóa).
- AC: file `docs/evidence/design-token/W1-0/palette.md` (token → light/dark hex + contrast ratio số) được duyệt; `theme/tokens.css` + `soc/tokens.css` có `[data-theme="light"]` block.
- Minh chứng: palette.md + contrast script output + screenshot shell 2 themes.

### W1-1 — Dual-theme 3 files (1–2d)
- Scope: `aiSettings.module.css:7-28`, `ShellPageTemplate.module.css:2-21`, `soc/tokens.css:5-73` → semantic vars + light overrides từ W1-0 (giữ fallback hex để không vỡ khi SSOT thiếu).
- AC: `grep "#0b0f19\|#111827\|#070a13"` 3 files = 0; `data-theme="light"` đổi computed background (verify bằng Playwright eval, không review mắt); dark pixel-identical (screenshot diff vs baseline).
- Minh chứng: diff + grep + 2 screenshots + gates.md.

### W1-2 — Tokens thiếu (0.5d)
- Thêm `--accent-purple:#a855f7` (+rgb triplet), `--soc-c-*` helpers còn thiếu vào `soc/tokens.css` + light values. AC: mọi hex Wave 2 thay thế có token đích tồn tại (grep cross-check).

### W1-3/W1-4 — Radius + spacing soc (0.5d + 0.5d)
- `soc.components.css`: `10px`→`var(--r-md)`/`--r-lg` theo loại container (ghi mapping table trong gates.md, không đoán bừa); `gap 0.35/0.4rem`→`sp-1/sp-2`; `padding 0.55rem/0.9rem`→`sp-2/sp-3`. AC: grep non-scale values trong file = 0 (whitelist rõ ngoại lệ có lý do).

### W1-5 — Typography Shell/aiSettings lớn (1d, gồm visual QA)
- `34px:72`→`--fs-2xl` (hoặc extend scale nếu design giữ display size — quyết ở W1-0); `28px:91`, `24px`, `15px` tương tự. AC: không còn px ngoài scale + screenshot before/after designer duyệt (C5).

**Gate Wave 1**: tsc 0 · build PASS · lint 0 err · vitest soc/admin PASS · `check:shell` PASS · screenshots dark+light.

## Waves 2–5 (khung chi tiết, cùng quy ước)

### Wave 2 — SOC TSX (ERR-36..45, ~6d)
- Hex→token theo W1-2 (kể cả `mark color #000`, gradients → `var()` trong gradient, rgba → `rgba(var(--soc-rgb-*)/α)`); `fontSize 0.6–0.82rem`→`--fs-*` (mapping table, giữ `0.68rem` nếu = `--fs-xs` theme SOC `0.68rem` ở `soc.tokens.css:31` — kiểm tra, đừng blind-replace).
- Raw button (51 occurrences/12 files): convert sang `createElement(Button)` từ `components/ui/button` (đường dẫn đúng), variant map `danger→destructive`, giữ nguyên handlers/state; mỗi file 1 screenshot before/after.
- AC: `grep "#[0-9a-fA-F]{3,6}"` trong TSX Wave 2 (trừ `var()` fallback) = 0 · vitest soc PASS · không đổi behavior (click handlers giữ nguyên — diff review).

### Wave 3 — SOC còn lại + dashboard (~2.5d)
- W3-1..W3-4 như audit, cộng `text-[10px]×6/[11px]×3` ở `CoreDashboardPositionDeck` → `--fs-2xs`. AC: vitest dashboard+soc PASS.

### Wave 4 — Pages (~5d)
- W4-1/W4-2 (commercial/screener): gradients `linear-gradient(90deg,#00b4d8,#0077b6)` → tokens W1-2 (`--accent-shell` đã tồn tại `tokens.css:49-55` — dùng luôn, không tạo mới); font-size lẻ (`9px/13.5px/14.5px`) → scale + designer duyệt.
- W4-3/W4-4: `text-[10px]/[11px]` → `text-xs` (12px) — lưu ý 10→12px là tăng kích thước (a11y tốt hơn, nhưng chụp before/after).
- W4-5: `Toast/ShellToast` dark-only classes → `bg-[var(--bg-panel)]` + kiểm tra light.
- AC: tsc 0 · lint 0 err · build PASS.

### Wave 5 — Polish (~1.5d)
- `border-radius:10px` ×12 aiSettings + `20px/16px` commercial → scale; rescan toàn repo đối chiếu 122 findings (bảng đối chiếu ID→trạng thái trong gates.md); full gates (tsc/build/lint/vitest/check:shell).

## RACI · Deny-list
- Designer: W1-0 palette + duyệt screenshots mỗi wave. FE: implement. QA: gates + rescan. Cấm: logic/state/API, dep mới, đổi token khi chưa có trong W1-0/W1-2, review bằng mắt thay cho computed-style/screenshot-diff.
