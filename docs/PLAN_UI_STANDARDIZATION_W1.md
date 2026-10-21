# PLAN — UI Standardization W1 (light theme (a) + phần còn lại)

> **Quyết định Owner (2026-10-21):** (1) light theme theo **phương án (a)** — làm light theme **đúng**; (2) M-10 + **phần còn lại** (T-1..T-6, M-6, M-7) làm theo khuyến nghị.
> **Base:** `feat/uistd-w0` (PR #272) · **Plan cha:** `docs/PLAN_UI_STANDARDIZATION_W0.md` (v1.3) · **ADR:** `docs/ADR_THEME_LIGHT_20261020.md` §4(a) · **Audit:** `docs/AUDIT_UI_STANDARDIZATION_W0.md`
> **Lessons áp dụng:** [L-F03] token → `soc.tokens.css`, **KHÔNG** `soc.module.css` · [L-F05] script sửa CSS giữ duration/easing · [L-F06] heuristic cửa sổ dòng → phải đọc `file:line` · [L-F08] giữ chuẩn Bloomberg (xanh=tăng, đỏ=giảm) · [L-F11] kết luận về class CSS module → đọc CSS **đã build** · [L-V01] script đo phải có **control** biết đáp án, ép `oklch`→`rgb` · [L-V02] gốc rễ thừa kế cần **fail-before** · [L-V03] lệnh đo có thể ghi file ⇒ `git status` sau mỗi lần · [L-V05] ảnh phải **mở ra xem** · [L-V06] parser `null` ≠ trong suốt · [L-003] rebase→gate · [L-005] worktree mới: status sạch + hook · [L-007] không có môi trường ⇒ "CHƯA CHẠY" · [L-008] không commit thẳng `dev` · [L-M02] branch = `feat/<tên-agent>` đúng y ký tự · [L-V08] "không đo được" ≠ "không có vi phạm" · [L-V09] id tập so phải mang giá trị/số lần

---

## 1. Vì sao (bằng chứng, không suy đoán)

Đo trên staging (build `6a127002e`, script `packages/web/scripts/measure-theme-tokens.mjs`, **có control** 21.00:1 / 4.48:1):

| Route (light) | H1 | Chữ dưới AA |
|---|---|---|
| `/admin/users` | **1.0000:1 — VÔ HÌNH** | 28/60 |
| `/dashboard` | 1.0471:1 (SIM-A) | 29/60 |
| `/operations-center` | 1.0471:1 (SIM-A) | 17/60 |

Nguyên nhân gốc (ADR R1–R4): `index.css:15` khai `@theme` **chỉ có giá trị tối** cho họ `--color-*` (canvas `--color-bg-primary: #020617`, chữ `--color-text-primary: #f1f5f9`) ⇒ **không có** override light (họ `--text-*` thì có: `theme/tokens.css:65`).

## 2. Quy mô đo được (script riêng, **có control**, READ-ONLY)

| Chỉ số | Số | Ghi chú |
|---|---|---|
| File JS/TS trong `packages/web/src` | 593 | quét `class` string + template literal |
| Màu chữ cứng (Tailwind `text-*`, `text-white`) | **≈ 900 hit** | `slate-500` 336 · `slate-400` 154 · `slate-100` 85 · `slate-300` 69 · `slate-600` 72 · `slate-200` 42 |
| Nền tối cứng (`bg-slate-900/950/800`, `bg-gray-900`) | **≈ 100 hit** | 36 file (ADR) |
| Biến thể alpha (`bg-slate-900/30`) | **185 token / 619 hit** | phải phủ cả nhóm |
| `slate-900/950` dùng **cả làm chữ (96) lẫn nền (48)** | — | ⇒ **không** remap biến palette (sẽ phá chữ admin), phải remap **theo property** |

## 3. Chiến lược (3 tầng, theo **đúng pattern repo đã có**)

Tầng 1 và 2 lấy **nguyên văn** pattern đã tồn tại ở `index.css:302-389` (light mode override **theo nhóm utility**, không liệt kê class lẻ) — mở rộng từ scope `.advisory-page` / `.core-dashboard-page` ra **global**.

| Tầng | Nội dung | File | Quy mô |
|---|---|---|---|
| **T1 — token** | override light cho họ `--color-*` (canvas sáng, chữ tối) theo **SSOT** `theme/tokens.css:65-71` | `packages/web/src/theme/light-theme.css` (mới) + import trong `index.css` | 1 file |
| **T2 — utility theo property** | `text-*` → chữ tối · `bg-*` → nền sáng · `border-*` → viền sáng — **kèm biến thể alpha** | cùng file | 1 file (~250 dòng, **sinh ra bằng script**) |
| **T3 — gate chống hồi quy** | `check-light-theme.mjs`: mỗi class màu cứng dùng trong `src` phải **có** trong khối light (hoặc allowlist) ⇒ class mới màu tối ⇒ gate đỏ | `packages/web/scripts/check-light-theme.mjs` (mới) + điểm gọi trong `pre-push-gate.mjs` | 1 file |

**Vì sao KHÔNG sửa 89 file:** cùng 1 biến `--color-slate-950` phục vụ **chữ** (admin: `text-slate-950`) lẫn **nền** (36 file) ⇒ remap biến sẽ phá chữ admin. Remap **theo property** giữ được cả hai, đúng như block `.advisory-page` đã làm.

## 4. Slice (mỗi slice 1 claim + 1 branch + 1 PR)

| Slice | Agent / branch | Nội dung | AC |
|---|---|---|---|
| **W1-A** | `uistd-w1-theme` / `feat/uistd-w1-theme` | T1 + T2 + T3 (token + utility remap + gate) | **AC-1** light theme: chữ dưới AA trên 4 route ghim **≤ 5/60** (mục tiêu) · H1 `/admin/users` ≥ 4.5:1 · **không** hồi quy dark (mọi route ≥ baseline dark) · gate T3 exit 0 + self-test |
| **W1-B** | `uistd-w1-fixes` / `feat/uistd-w1-fixes` | **M-10** (template dùng họ token đảo được) + **T-1** (6 inline `outline:"none"`) + **T-6** (gộp 5 key i18n `commercialPage.*`) | **AC-2** M-10: `CommercialPage.module.css` **0** `var(--color-*)` · T-1: `check-focus-ring` **0** vi phạm mới (8 → 2) · T-6: key có ở **cả 2** locale, `check:i18n-hardcoded` sạch |
| **W1-C** | (sau khi đo W1-A) | phần dư của light theme: trang còn fail, admin H1 cứng, ảnh chụp thật | **AC-3** mọi route ghim ≥ AA ở light |
| **W1-D** | (sau) | gate: M-6 (đọc token `--pf-*` ở runtime) · M-7 (lấy mẫu phân bố) · T-4 (CONTROL self-test) · T-5 (`<h1>` qua biến) · T-2 (staging seed ⇒ bỏ `--advisory`) | **AC-4** gate runtime chặn thật trên staging seed |

## 5. Quy trình đo (L-V01/L-V02 — **fail-before đã có**)

| Bước | Công cụ | Ghi |
|---|---|---|
| Fail-before | `node packages/web/scripts/measure-theme-tokens.mjs` (trên staging build `6a127002e`) | ADR §2: H1 `/admin/users` **1.0000:1**, 28/60 dưới AA |
| Triển khai | `REPO_BRANCH=feat/uistd-w1-theme bash scripts/deploy-staging.sh` | staging theo branch (AGENTS.md) |
| Fail-after | **cùng script**, `--scan-hardcoded` + đo runtime | so cùng 4 route, cùng cách đo |
| Chống hồi quy dark | `check:contrast` + đo dark cùng script | dark ≥ baseline (8/60) |
| Bằng chứng ảnh | chụp **mở ra xem** (L-V05) | 4 route × 2 theme |

## 6. Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R-1 | Remap global làm **vỡ** trang nào đó (nền tối chưa được phủ ⇒ chữ tối trên nền tối) | đo sau mỗi đợt; allowlist có kiểm soát; rollback 1 commit |
| R-2 | `text-slate-950` của admin (chữ tối) đụng `bg-slate-950` (nền tối) | remap **theo property** ⇒ không đụng; test riêng admin |
| R-3 | Chặn 500+ class ⇒ khối CSS rất dài | **sinh bằng script** + gate kiểm phủ; không liệt kê tay |
| R-4 | Đổi hàng loạt class ⇒ hồi quy layout | chỉ đổi **màu**, không đổi layout/spacing ⇒ `git diff --numstat` phải là **+0/-0** trong block CSS |
| R-5 | Nhiều agent cùng sửa `index.css` | claim trước khi sửa dòng đầu (L-M02, `docs/AGENT_PROTOCOL.md` §2) |

## 7. Ngoài phạm vi (không tự mở rộng)

- **Dark theme**: **không** đụng (baseline phải giữ nguyên) — trừ khi đo cho thấy cần.
- **Màu tăng/giảm**: giữ chuẩn Bloomberg (L-F08) — `--pf-gain` xanh / `--pf-loss` đỏ.
- **BE / migration**: không đụng.
- **`:root[data-theme="light"]` ở `theme/tokens.css` / `soc.tokens.css`**: **đã đúng** (SSOT) ⇒ dùng làm nguồn giá trị, không sửa.
