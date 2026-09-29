# R0 — Phản biện DESIGN_TOKEN_AUDIT (lệnh verify, 2026-09-24)

## CONFIRMED (chạy thật)
- `Select-String "font-size:\s*34px" ShellPageTemplate.module.css` → `:72`; `28px` aiSettings → `:91`; `21px` soc.components.css → `:2642`.
- `text-[10px]` 3 admin files (PATs/Usage/ServiceAccounts) → Count 12.
- `dotColor #10b981` → `SocOverviewPanel.tsx:501` (full ternary `#10b981/#f59e0b/#ef4444/#94a3b8`).
- `#a855f7` → `SocQueueTierFieldSet.tsx:117`.
- `:root` ở cả 3 files (`aiSettings:7`, `ShellPageTemplate:2`, `soc.tokens.css:5`); grep `[data-theme="light"]` trong `components/*.css` + `soc/*.css` → **0 hit**.
- `index.css:13` custom-variant dark; `main.tsx:177,179` set/remove attribute (dark = default).
- `theme.module.css` + `tokens.css` (56 dòng) + `ui/button.tsx` (86 dòng) tồn tại.

## CONTRADICTIONS (C1–C7, xem plan)
- C1: SSOT `tokens.css` cũng dark-only → Wave 1 thiếu light target (ticket bịa `#f8fafc` chưa duyệt).
- C2: `components/soc/ui/Button` KHÔNG TỒN TẠI (`Get-ChildItem` fail); Button thật ở `components/ui/button.tsx`, variants default/destructive/outline/secondary/ghost/link/success (không có `danger`).
- C3: alias value-preserving có chủ ý (`aiSettings.module.css:1-6` comment).
- C4: raw button 51 occurrences / 12 files (audit ghi "~12" = files).
- C5: severity Critical + Regression Low cho đổi 34→22px (mâu thuẫn nội bộ).
- C6: W1-5 nhầm file 34px; gates Wave 1 thiếu check:shell/contrast/vitest.
- C7: ledger trùng Entry 213 (dòng 23 UI audit vs dòng 150 W1) — đã renumber W1→217; git log mới nhất `df8f2ddf`, audit doc + ledger + AGENTS chưa commit (claim commit-push SAI trên working tree này).
