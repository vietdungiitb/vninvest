# Wave 3 + Wave 4 gates (2026-09-25)

## Wave 3 — SOC còn lại + dashboard
- Hex→token: Vnbroker (ef4444/34d399/38bdf8-triplet mới/10b981), ParityGates, DnseBackfill, SchedulerBoard (`#64748b`), ScreenerPanel (rule/toast/boxShadow), ConfigForm (0f172a triplet + fs-md + r-sm).
- fontSize→scale: Vnbroker/MatrixScrape 0.7→xs; ParityGates 0.65/0.7→xs; DnseBackfill 0.75→sm; SchedulerBoard 0.65/0.7→xs; ScreenerPanel 0.68→xs/0.75→sm; EmptyState 13(numeric)→fs-sm; PositionDeck `text-[10/11px]`→`text-[var(--fs-2xs)]` (9 sites).
- Buttons: MatrixScrape×1, DnseBackfill×2, ScreenerConfigForm×4 (ghost; save=primary/default) + imports.
- Phát hiện: `var(--soc-*)` trong Billing SUÝT vỡ (soc.tokens không global) → chuyển sang theme tokens + quy tắc "non-SOC file chỉ dùng theme tokens" (ghi vào plan).
- Visual QA authed (W2-shots): dark hoàn hảo; light surfaces adapt tốt, page chrome còn tối (thuộc layout shell, ngoài audit scope → follow-up).

## Wave 4 — Pages
- Billing: radius/scale/pills, gradients→tokens/color-mix, status pills, `#486581`→text-secondary. Sửa lỗi tự gây: blind `rgba()`→thiếu `/` (đã fix + verify từng cái).
- Payment: radius/font/gradients/status icons/`#166534/#991b1b`→accent tokens.
- Screener: full tokenize (accent-blue + text-on-accent tokens mới), color-mix tints, font/padding/radius scale.
- Admin: 27 sites `text-[10/11px]`→`text-[var(--fs-2xs)]` (12 files), ShellOps 0.68→xs + dot token, Analytics ticks 11→12 + Bar fill token, UpgradePage 11px→fs-2xs.
- Toast/ShellToast: surfaces→`var(--bg-panel)`, text→`var(--text-primary)`; close button→Button (props qua object để giữ lint budget).
- Audit overcount: TenantAdmin TSX 0 hex (không đúng như W4-5 claim).
- Visual QA (W4-shots billing/screener/admin dark+light đã xem): cards/tables adapt tốt; page chrome + h1 còn tối (follow-up layout shell).

## Gates (chạy ở Wave 5 cuối)
tsc · build · lint (budget 3515) · vitest · check:shell — xem W5-gates.md.
