# Gates — CafeF đối chiếu slice C1–C3 (2026-11-24)

Branch `feat/cafef-ref`. Plan: `docs/PLAN_CAFEF_OHLC_COC_BACKFILL_FINAL_20261124.md` (AGREE).

## RED → GREEN
| Slice | RED | GREEN |
|---|---|---|
| C1 contract | `ModuleNotFoundError: market_data.cafef` | 6/6 OK (SimpleTestCase + TestCase, migration 0010 apply trong test DB) |
| C2 fetch/parser | `ModuleNotFoundError: market_data.cafef.parser` | 4/4 OK |
| C3 importer | xoá tạm `importer.py` → ImportError | 3/3 OK (dry-run 0 ghi, apply→insert 1, apply lại→update 1/insert 0) |
| C3 FE adapter | — | 4/4 vitest OK (`soc-cafef.component.test.js`) |

## Đo thật
- XLSX `ALL HOSE 2022`: **101.756 data rows**, 0 reject; TPB `04/01/2022 = 42750 / 17940`.
- Perf parse: **19,78 s / 310 MB** (budget <30 s / <500 MB).
- BE test chạy trên VPS `14.225.255.47`, DB riêng `vnsaas_core` (kết nối tạm vào `vnsaas-staging_data`, đã ngắt ngay).
- `manage.py check`: chỉ 1 warning W004 không liên quan.
- Reverse URL: `/core/v1/operator/scraping/dataops/cafef/{preview,run,run/<id>/status,run/<id>/abort}/`.
- FE: `npx tsc --noEmit` = 0; `npm run check:shell` exit 0.

**CHƯA CHẠY trên VPS**: vitest FE (VPS repo không có `node_modules`; đã chạy local, không dùng Docker) — ghi rõ theo L-007.

## Phạm vi
Chỉ ghi `CafefDailyPrice`. **Không** đụng `DailyPrice`, `apply_adjustments`, parser CA, VCI nightly, widget/host. Mục hiệu chỉnh (C5) DEFERRED theo owner.

## Reservation trước khi apply thật
- ToS/rate-limit tải ~228 MB chưa được owner chốt.
- `openpyxl` có trong image staging nhưng chưa khai trong `requirements.txt` (deny-list) — cần coordinator + trailer `Claim-Deny-List:`.
- C4 (nút đối chiếu read-only trên cùng sub-tab) chưa làm.
