# Audit UI v1 — plan CafeF trên COC (2026-11-24)

> Auditor độc lập phiên mới, chỉ đọc. Verdict: **NEED_REVISION** — M1/M2 major do đổi scope; O1/O8 cũ vẫn đóng.

## Xác nhận đúng
- O1 bảng riêng `CafefDailyPrice` ✅; O8 golden kép ✅.
- Staff-only: `SOCBaseView.permission_classes=[IsAuthenticated, IsAdminUser]` (`views/base.py:104`) ✅.
- Không conflict tên task (grep `cafef` trong backend src = 0) ✅.
- FE section nên là sub-tab `DATAOPS_SUB_TABS` (`SocDataOpsPanel.tsx:14-20`, `dataops_tab` ở `DataOpsContext.tsx:92`) → không cần pageRegistry/routeCatalog ✅.

## Objection
- **M1 (MAJOR)**: preview lấy số 101.756 từ export CafeF, không phải bảng trống ⇒ phải gọi network. ToS/rate-limit chốt "trước C2" là chưa đủ, phải chốt trước cả C3. Ghi rõ nguồn số "dự kiến (fetch)" vs "đã lưu (table)" + cache/timeout.
- **M2 (MAJOR)**: thiếu `npm run check:shell` (`package.json:12`) và baseline UI (`check-a11y-runtime.json`, `check-theme-contrast.json` → `--update-baseline`; `check-uiux-budget.mjs:105-135`).
- m3: `ownership.py:21-79` chỉ domain-level `can_apply`, **không có action-map** → reuse `dataops_market_data`, đừng tạo action.
- m4: 3 route planner có cả ở `urls.py:187-189` (`/operator/soc/`); plan dùng scraping prefix — reservation, ghi rõ.
- m5: run log cần `service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']`; inventory hardcode `market_data_dailyprice` → owner muốn UI thì nên thêm entry `cafef_daily_price`.
- m6: abort `revoke(terminate=True, SIGTERM)` + run 'skipped' (`dataops_planner.py:402-407,416-426`); với 51 request cần commit theo `(exchange,year)` + abort cooperative; `@extend_schema` request **và** response.
- m7: section mới dùng `soc.components.css`/`soc.tokens.css`, không copy `styles.*` từ barrel `soc.module.css:1-3`.
