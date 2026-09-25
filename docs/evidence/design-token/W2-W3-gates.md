# Wave 2 + Wave 3 gates — SOC TSX + SOC còn lại/dashboard (2026-09-25)

## Implement
- **Hex→token** (13 files, grep 0 còn lại ngoài `var()` fallbacks): color maps, dotColor, HERO bgVars, tierIconMap (purple W1-2), gradients, rgba triplets (+2 triplets mới `d97706`, `38bdf8`), toast/boxShadow/modal/input backgrounds.
- **fontSize→SOC scale**: 0.7/0.68/0.65/0.6→`--fs-xs`, 0.75/0.78/0.72→`--fs-sm`, 0.82/0.80→`--fs-md`, 0.875→`--fs-md` (ConfigForm), 13(numeric)→`--fs-sm` (EmptyState); PositionDeck `text-[10px]/[11px]`→`text-[var(--fs-2xs)]`.
- **Raw buttons → Button** (26 occurrences, 14 files: ghost/sm, icon cho close, default cho submit-primary; giữ className/style/handlers): Wave 2 9 files (20) + W3 MatrixScrape/DnseBackfill×2/ScreenerConfigForm×4. Sửa audit: `soc/ui/Button` không tồn tại → dùng `components/ui/button.js`.
- **Không đụng**: `var(--x, #hex)` fallbacks, micro paddings/radii ngoài matrix, `SignalsPanel` (24 buttons + sizes — audit miss, follow-up riêng).

## Gates chạy thật
- Grep hex/rgba-numeric/gradient-hex/fontSize-lẻ/raw-button 13 files W2 + 8 files W3: **0** (trừ `var()` fallbacks có chủ ý).
- tsc 0 · vitest soc 4 suites **28/28 PASS**.
- **Visual QA thật** (dev server + login testuser staff, `W2-shots/` 4 ảnh đã xem):
  - Dark ops-overview: hoàn hảo (28/28 services, metric colors mới render đúng).
  - Light ops-overview: panel/cards adapt trắng/chữ tối đọc tốt; page chrome (header/title/tabs) còn tối → thuộc Wave 4 page-level + layout shell (ghi rõ, không phải regression).
  - AI CC dark/light: adapt toàn diện (cards trắng, chữ tối, tabs đúng) — validate approach alias-override.

## Chưa làm
- Screenshots từng button (26 sites) — thay bằng unit coverage (handlers giữ nguyên, diff review) + page-level shots.
- `SignalsPanel` follow-up (audit miss).
