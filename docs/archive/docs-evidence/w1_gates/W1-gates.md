# Wave 1 gates — Foundation dual-theme (2026-09-25)

## Implement (deviations khỏi audit ghi rõ)
- **W1-0**: `W1-0-palette.md` (11 contrast ratios, thấp nhất muted/light 4.76 — PASS AA) + `contrast-calc.mjs`. Quyết định C3: giữ alias, override light (dark pixel-identical).
- **W1-1**: light blocks cho `theme/tokens.css`, `soc/tokens.css`, `aiSettings.module.css`, `ShellPageTemplate.module.css`. TSX dùng `var(--soc-c-*)` tự adapt, không đụng TSX.
- **W1-2**: `--accent-purple(-rgb)` cả 2 token files (base #a855f7 + light #7e22ce).
- **W1-3**: 6× `10px` → `var(--r-md, 8px)` (cards/banners/icons, mapping trong gates này).
- **W1-4**: CHỈ tabBar/tabButton (`gap 0.35→sp-1`, `gap 0.4→sp-2`, `padding 0.55/0.9→sp-2/sp-4`) — ~50 off-grid còn lại trong file là follow-up (audit ticket scope hẹp hơn thực tế).
- **W1-5**: extend scale `--fs-3xl/--fs-4xl` (giữ intent hero) thay vì cắt 34→22; map 34→4xl, 28→3xl, 24→2xl, 21→2xl, 15→md (fallbacks giữ giá trị cũ).
- **Gate-script fix**: `check-tokens.mjs` strip thêm `:root[data-theme]` (definitions, không phải usage).

## Gates chạy thật
- tsc 0 · build PASS 36.16s · `check:shell` PASS (exit 0, không pollution i18n — keys rác không tồn tại trong file) · eslint (spec+script touched) 0.
- Playwright `theme-verify.spec.ts` (giữ lại làm gate): tokens `--bg-panel`/`--text-primary` khác nhau dark/light, non-empty — **PASS**.
- Dist verify: dark aliases nguyên vẹn + light values ship (aiSettings/soc/index mỗi loại 1+ hit).
- Dark no-regression: dark block bytes untouched (diff chỉ thêm blocks mới) + dist dark values khớp hex cũ.
- Screenshots `W1-shots/`: /login không đổi giữa themes (trang này không dùng theme vars — page-level light adoption thuộc Waves 2–5 theo từng file, đã ghi rõ trong plan).

## Chưa làm (đúng scope Wave 1)
- ~50 off-grid spacing còn lại trong soc.components.css → follow-up.
- Page-level light cho từng trang → Waves 2–5.
