# Wave 5 gates — polish + rescan + DoD (2026-09-25)

## Polish
- aiSettings: 10px→scale (radius→r-md, gap→sp-2, font→fs-2xs, paddings→sp) — audit đếm "~18", thực tế ~25 sites.
- Billing spacing còn lại → sp-* (40px empty-state giữ nguyên, exception có ghi).
- On-scale literal radius → var (soc 11× + aiSettings 4×, zero visual change).

## Rescan đối chiếu ERR-01..65 (lệnh trong R0-REVIEW + file này)
- text-[10/11px] repo-wide: **0** · raw `createElement("button"` (trừ SocSignalsPanel follow-up): **0** · hex/rgba-numeric/fontSize-lẻ/radius-lẻ trong files Waves 2–4 (trừ `var()` fallbacks): **0**.
- Còn lại ngoài scope waves (follow-up, đã liệt kê): SocSignalsPanel 24 buttons + sizes · ~50 off-grid spacing soc.components.css · `border-radius: 2px` edges · `var(--x, #hex)` fallbacks · page-chrome/layout-shell light · prose 12 i18n keys reconstructed (chờ owner).

## Full gates (chạy thật, cuối Waves 2–5)
- tsc 0 · build PASS 59.90s · lint 0 errors, **3515 warnings = baseline** (+3 từ JSX Button props đã dẹp bằng object spread) · vitest **465/466** (1 flaky alert-center pagination, pass lẻ, không liên quan) · check:shell PASS (scanner "Added" log là nhiễu, verify không ghi file) · i18n authoritative recheck **0 missing vi+en**.
- Visual QA authed (dev server + staff login): W2-shots (ops-overview, ai-command-center) + W4-shots (billing, screener, admin-users) dark+light đã xem — dark hoàn hảo, light surfaces adapt tốt, page chrome còn tối (follow-up).

## DoD Waves 1–5: ĐẠT (với follow-ups đã liệt kê, không blocker).
