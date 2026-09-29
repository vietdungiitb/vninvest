# Wave 2 gates — SOC TSX tokens + buttons (2026-09-25)

## Implement
- Hex→token (9 files, grep verify 0 còn lại ngoài `var()` fallbacks): METRIC_COLORS/BORDER/ICON_BG (color-mix pattern có sẵn), dotColor, HERO_METRIC_COLORS + bgVars (triplets), tierIconMap (purple → `var(--accent-purple)` W1-2 mới), gradient → `var()`, rgba triplets → `rgba(var(--soc-rgb-*)/α)` (+1 triplet mới `d97706`), Inventory/RuleModal/ConfigSection/PlannerConsole leftovers.
- fontSize→SOC scale: 0.7/0.68/0.65/0.6→`--fs-xs`, 0.75/0.78/0.72→`--fs-sm`, 0.82/0.80→`--fs-md` (mapping table, Δ≤0.05rem).
- Raw buttons 20 occurrences (9 files) → `Button` (ghost/sm, icon cho close) giữ nguyên className/style/handlers/disabled; submit giữ cyan + `#fff`→`var(--soc-c-ffffff)`; imports `../ui/button.js`.
- Sửa audit: 0.72rem tồn tại thật (Monitor:970) — rút lại nghi ngờ trước đó.

## Gates
- Grep hex/rgba-numeric/gradient-hex 9 files (trừ `var()` fallbacks): **0**.
- Grep `createElement("button"` 9 files: **0**; Button imports: 9.
- tsc 0 · vitest 4 suites soc **28/28 PASS**.
- Visual QA: screenshots SOC authed dark/light (xem W2-shots/, chạy sau).

## Chưa làm
- `var(--x, #hex)` fallbacks trong TSX giữ nguyên (pattern repo-wide, ngoài scope).
- Micro paddings/radii không trong matrix giữ nguyên (follow-up).
