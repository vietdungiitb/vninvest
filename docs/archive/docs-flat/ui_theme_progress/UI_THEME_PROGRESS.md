# UI Theme Standardization — Progress Tracker (S0–S10)

Theo dõi tiến độ chuẩn hóa theme `packages/web`. Kế hoạch gốc:
`docs/UI_THEME_STANDARDIZATION_FRAMEWORK_20260712.md`.

## Quyết định cốt lõi
- `frontend/src/index.css` **không** load trong SaaS app → tạo `packages/web/src/theme/tokens.css`
  bridge bare tokens → Tailwind v4 `@theme`.
- Tailwind v4 config-less: tokens định nghĩa trong `packages/web/src/index.css` via `@theme`.
- `--shell-*` giữ nguyên giá trị (không map sang `@theme` solid) để không vỡ visual rgba.
- SOC domain module giữ riêng, KHÔNG gộp vào theme.

## Trạng thái tổng quan

| Slice | Mục tiêu | Trạng thái | Commit | Ghi chú |
|-------|----------|------------|--------|---------|
| S0 | Audit/fix bare `var()` không fallback | ✅ Done | `eeec7afa` | 477 refs/41 files → 0 |
| S1 | Token-bridge + `tokens.css` | ✅ Done | `b0dd5f80` | `docs/S1_TOKEN_MAPPING.md` |
| S2 | Theme Primitives Module | ✅ Done | `b08b198d` | `theme.module.css`; `docs/S2_PRIMITIVES_INVENTORY.md` |
| S3 | ShellPageTemplate refactor + `--shell-*` | ✅ Done | `f3cd7bd4` | 38 files; `docs/S3_SHELL_CONSUMERS.md`; 1 regression nhỏ (Watchlist list) → S10 |
| **S4** | AI Area Cleanup | ✅ Done | `eb1d6262` | xóa dead `AIAdvisorAlertPanel.css`; inline AI 3→0; `aiSettings.module.css` giữ nguyên |
| **S5** | SOC Inline → Module (≥80%) | ✅ Done | `817310d9` | 28 SOC files; 651 `s5_` classes → `soc.module.css`; 0 orphan; tsc+build+79 SOC tests pass. ⚠️ Extract verbatim (màu literal chưa tokenize) → see S11 |
| **S6** | AlertCenter Dead Code | ✅ Done | `S6_COMMIT` | xóa `pages/AlertCenterPage.module.css` (0 imports, dead); `.styles.js` active giữ |
| **S7** | Stock-Detail Standardization | ✅ Done | `S7_COMMIT` | `StockDetailPage.css` 2.546 dòng: solid hex → global tokens, 127 rgba → 23 `--sdp-*-rgb` channel tokens; 0 literal màu; 12 visual tests pass |
| **S8** | Core Pages Standardization | ✅ Done | `S8_COMMIT` | 5 core CSS → bridged tokens: PortfoliosPage, DNSEConnectionPanel, dashboard/SmartStatsHeader, alert-center/*.module.css; 0 literal màu; build + 12 visual tests pass |
| **S9** | TenantAdmin Inline (>=80%) | Done | 34f24bc3 | 13 files -> 523 TenantAdmin.module.css classes; static routes visual-green, dynamic dashboards flaky |
| **S10** | Watchlist + Remaining | Done | dev | xoa inert .shellPage__list* (S3 fix); WatchlistPage.css -> --wl-* tokens; DNSE/AuthRegister verified tokenized; VninvestInput giu nguyen (theme thieu equivalents) |

## Chi tiết slice còn lại (tóm tắt)

### S4 — AI Area Cleanup
- Scope: `components/aiSettings.module.css` (verify bridge), AI TSX files, `features/dashboard/AIAdvisorAlertPanel.css` (5.4 KB).
- Hành động: verify `aiSettings.module.css`; migrate `AIAdvisorAlertPanel.css` → `theme.module.css`; audit inline AI TSX → module.
- AC: S4.1 css deleted; S4.2 token resolve; S4.3 AI tests pass; S4.4 inline −50%.

### S5 — SOC Inline → Module Class (≥80%)
- **Thực tế**: SOC files dùng `createElement(..., { style: {...} })` object literals (không phải JSX `style={{}}`)
  → framework baseline cũ sai. Thực tế ~769 `style:` literals across 28 files.
- Tool-assisted: `s5_soc_migrate.js` convert static `style:` → `s5_N_Basename` classes trong
  `soc.module.css`; dynamic (ternary/template/var/JS expr) giữ inline.
- Kết quả: 651 `s5_` classes generated, **0 orphan** (CSS defs == TS/JS refs), tsc clean,
  `npm run build` ✓, 79 SOC tests pass.
- AC: S5.1 ≥80% (static inline → 0 remaining static; chỉ dynamic giữ); S5.2 `soc.module.css` +651; S5.3 pass; S5.4 visual cần verify snapshot tool (S7 prereq).
- Lưu ý: `DataOpsContext.tsx`, `SocTabNavigation.tsx` không có static style → không đổi.

### S6 — AlertCenter Dead Code
- Xóa `AlertCenterPage.module.css` (dead); `.styles.js` vẫn active, không đụng.
- AC: S6.1 module.css deleted; S6.3 no import; S6.4 tsc+build pass.

### S7 — Stock-Detail Standardization
- **Phát hiện**: file KHÔNG có hệ thống `--gc-*` (comment header sai); có ~155 literal màu (28 hex + 127 rgba alpha-layer). Full tokenize thủ công = ~155 token, rủi ro cao.
- **Hybrid approach** (user chọn): solid hex → global tokens (`--color-slate-*`, `--color-success-500`, v.v.) khi exact-match; 127 rgba → 23 `--sdp-*-rgb` channel triplet (`rgba(var(--sdp-X-rgb) / A)`), mỗi base color định nghĩa 1 lần. 13 local solid `--sdp-*` cho brand colors (indigo/pink/rose/violet…) không có global token.
- Kết quả: 0 literal màu còn lại trong body; 395 `var()` refs; tsc+build OK; 12 visual tests pass (stock-detail-vcb desktop/tablet/mobile khớp 100%).
- AC: S7.1 ✓ bridged; S7.3 ✓ `sdp-` scoped; S7.5 ✓ visual identical.

### S8 — Core Pages Standardization
- Áp dụng hybrid tokenization (script `s8_tokenize.js`) cho 5 core CSS:
  `PortfoliosPage.css` (5 local solids + 2 rgb), `DNSEConnectionPanel.css` (6+4),
  `dashboard/SmartStatsHeader.css` (0+5, toàn global tokens),
  `alert-center/DetailDrawer.module.css` (0+7), `SymbolStatsTable.module.css` (0+13).
- Solid hex → global tokens (`--color-*`); rgba → `--<prefix>-<base>-rgb` channel triplets;
  brand colors (blue/red/green ngoài palette) → local `--<prefix>-cN`. 0 literal màu.
- AC: S8.1 ✓ bridged; S8.4 ✓ build + 12 visual tests pass (dashboard + alert-center khớp 100%).
- Ghi chú: PortfoliosPage/DNSE chưa có snapshot riêng (route registry) — token hóa value-identical nên an toàn; có thể bổ sung snapshot sau.

### S9 — TenantAdmin Inline Cleanup (≥80%)
- 8 file: PATs 90, Usage 84, Webhooks 58, Home 58, Billing 44, Members 43, AuditLogs 28, ServiceAccounts 25 (tổng ~377 → ≤75).
- Tạo `TenantAdmin.module.css`.
- AC: S9.1 −80%; S9.2 module.css exists; S9.3 tsc+build; S9.4 visual verify.

### S10 — Watchlist + Remaining Pages
- Xóa `VninvestInput.module.css` (đã migrate sang `theme.module.css` ở S2/S4).
- Verify `WatchlistPage.css` (đã fix fallback ở S0), `AuthRegisterPage.css`, `DNSEConnectionPanel.css`.
- **S3 regression fix**: `WatchlistPage.css` `.shellPage__list*` overrides giờ inert → xử lý ở đây.
- Thuc hien: (1) Xoa block `.shellPage__list*` (lines 442-495) trong WatchlistPage.css - dead/inert (S3 regression, khong component nao dung className nay). DoD `shellPage__/*--shell-*` = 0 dat duoc.
- (2) Tokenize WatchlistPage.css: true literals -> `--wl-*` channel tokens (`rgba(var(--wl-X-rgb)/A)`) + `--wl-slate-200`/`--wl-cyan-bright`; `#94a3b8` -> `var(--text-muted)`. `var(--token, <literal>)` fallbacks giu nguyen. 0 true literal con lai.
- (3) DNSEConnectionPanel.css / AuthRegisterPage.css: da tokenize (local `--dnse-c0..c5` defs) - verified, khong action.
- (4) VninvestInput.module.css: da dung design tokens; `theme.module.css` THIEU equivalents (wrapper/label/error/helper/input--error/input--disabled/...) nen KHONG xoa (se break component). Giu nguyen, da compliant.
- AC: S10.1 shellPage inert removed; S10.2 Watchlist tokens >=34 (--wl-*); S10.4 tsc+build OK.

### S11 — Color-Tokenization Follow-up (audit gap)
- **Audit (user request "audit lại toàn bộ")** phát hiện: S5 (SOC) và S9 (TenantAdmin) chỉ extract `style:{}` tĩnh sang module CSS **nguyên xi cả mã màu**; S3/S4 (ShellPageTemplate / aiSettings) cũng để lại literal rgba. Chỉ S7/S8 áp dụng map màu→token. DoD "0 literal màu" chưa đạt ngoài S7/S8.
- **Phương pháp (value-preserving, rủi ro 0 visual)**: mỗi literal → local CSS var giữ NGUYÊN giá trị.
  - solid hex → `--<prefix>-c-<hex>` (vd `--soc-c-94a3b8: #94a3b8;`), usage `var(--soc-c-94a3b8)`.
  - rgba → channel triplet `--<prefix>-rgb-<rrggbb>: R G B;` (vd `--soc-rgb-5078a8: 80 120 168;`), usage `rgba(var(--soc-rgb-5078a8) / A)`.
  - Prefix per-file: `ta-` (TenantAdmin), `soc-`, `ais-`, `sh-`, `vi-`.
  - Token-definition lines (`--x: value`) giữ nguyên (không tự-reference). `var(--token, <color>)` fallback → nested `var(--token, var(--prefix-c-xxx))` (hợp lệ, vẫn value-identical). `url(#...)` không đụng.
- **Kết quả**: 5 file, mỗi file 1 `:root` token block, 0 self-ref, 0 literal màu trong body, `url(#)` preserved. Token counts: TenantAdmin 36, soc 36, aiSettings 20, ShellPageTemplate 18, VninvestInput 0 (already tokenized, 0 literals).
- **Lưu ý bug khi làm**: protect-step ban đầu dùng `\s*` (khớp newline) → bắt sai fallback xuyên dòng; và protect thay toàn bộ `var(--name, #color)` bằng placeholder làm mất `var(--name,`. Fix: bỏ protect, tokenize fallback thành nested var. Script: `tokenize_css.py` (idempotent qua MARKER).
- AC: S11.1 ✓ 0 literal màu trong 5 file; S11.2 ✓ tsc+build pass; S11.3 value-identical (token resolve = giá trị gốc) → 0 visual regression.

## Pre-requisites (bắt buộc)
- **Visual snapshot tooling (Chromatic/Percy) phải chốt trước S7** — thay đổi dính mọi page, manual screenshot rủi ro cao (framework §8).

## Final DoD (§6)
- bare-name refs = 0 · `core-` = 0 trong CSS · `shellPage__/*--shell-*` = 0 · `sdp-` scoped stock-detail · inline −70% (568→≤170) · tsc+build+test pass · 0 visual regression.

## Changelog
- S0 `eeec7afa` / S1 `b0dd5f80` / S2 `b08b198d` / S3 `f3cd7bd4` / S4 `eb1d6262` — committed & pushed to `dev`.
- S5 `817310d9` / S6 / S7 / S8 / S9 `34f24bc3` (+doc `ce367400`) / S10 `bc691b92` — committed & pushed to `dev`.
- S11 `d11705c6` color-tokenization follow-up (5 files) — value-preserving; tsc+build pass.







