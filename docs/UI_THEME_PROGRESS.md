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
| **S5** | SOC Inline → Module (≥80%) | ✅ Done | `S5_COMMIT` | 28 SOC files; 651 `s5_` classes → `soc.module.css`; 0 orphan; tsc+build+79 SOC tests pass |
| **S6** | AlertCenter Dead Code | ✅ Done | `S6_COMMIT` | xóa `pages/AlertCenterPage.module.css` (0 imports, dead); `.styles.js` active giữ |
| **S7** | Stock-Detail Standardization | 🔲 Todo | — | `StockDetailPage.css` 2.175 dòng → bridged tokens |
| **S8** | Core Pages Standardization | 🔲 Todo | — | per-page CSS bridged, `core-` −50% |
| **S9** | TenantAdmin Inline (≥80%) | 🔲 Todo | — | 8 file, tạo `TenantAdmin.module.css` |
| **S10** | Watchlist + Remaining | 🔲 Todo | — | xóa `VninvestInput.module.css`, verify Watchlist/Auth/DNSE |

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
- `StockDetailPage.css` (2.175 dòng, god-file) giữ domain, chỉ convert sang bridged tokens.
- AC: S7.1 tokens bridged; S7.2 inline −50%; S7.3 `sdp-` scoped; S7.5 visual identical.

### S8 — Core Pages Standardization
- Per-page CSS dùng bridged tokens; `core-` classes −50%.
- AC: S8.1 per-page CSS bridged; S8.2 `core-` −50%; S8.4 tsc+build+test.

### S9 — TenantAdmin Inline Cleanup (≥80%)
- 8 file: PATs 90, Usage 84, Webhooks 58, Home 58, Billing 44, Members 43, AuditLogs 28, ServiceAccounts 25 (tổng ~377 → ≤75).
- Tạo `TenantAdmin.module.css`.
- AC: S9.1 −80%; S9.2 module.css exists; S9.3 tsc+build; S9.4 visual verify.

### S10 — Watchlist + Remaining Pages
- Xóa `VninvestInput.module.css` (đã migrate sang `theme.module.css` ở S2/S4).
- Verify `WatchlistPage.css` (đã fix fallback ở S0), `AuthRegisterPage.css`, `DNSEConnectionPanel.css`.
- **S3 regression fix**: `WatchlistPage.css` `.shellPage__list*` overrides giờ inert → xử lý ở đây.
- AC: S10.1 module deleted; S10.2 Watchlist tokens ≥34; S10.4 visual verify.

## Pre-requisites (bắt buộc)
- **Visual snapshot tooling (Chromatic/Percy) phải chốt trước S7** — thay đổi dính mọi page, manual screenshot rủi ro cao (framework §8).

## Final DoD (§6)
- bare-name refs = 0 · `core-` = 0 trong CSS · `shellPage__/*--shell-*` = 0 · `sdp-` scoped stock-detail · inline −70% (568→≤170) · tsc+build+test pass · 0 visual regression.

## Changelog
- S0 `eeec7afa` / S1 `b0dd5f80` / S2 `b08b198d` / S3 `f3cd7bd4` / S4 `eb1d6262` — committed & pushed to `dev`.
