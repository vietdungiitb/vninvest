# Plan — CafeF OHLC: ingest đối chiếu + quản lý trên UI COC (2026-11-24)

> Trạng thái: **REVISION 4 — chờ audit vòng 2 của scope UI. CHƯA sửa code.**
> Bản command (AGREE) và các audit cũ: `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_V{1,2,3}_20261124.md`.
> Audit scope UI v1: `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_UI_V1_20261124.md`.

## 0. Bằng chứng (đã audit, giữ nguyên)
- Export ALL HOSE 2022: 4.467.581 byte, **101.756 data rows**, 2–3 s; 3 exchange × 17 năm ≈ 51 request ≈ 228 MB.
- Request `MM/DD/YYYY`, response XLSX `DD/MM/YYYY`; có cả `04/01/2022 (42,75)` và `01/04/2022 (41,25)`.
- Golden 7 unit: `42750 / 17940 / 11034900 / 467260000000 / 41500 / 43250 / 41300`.
- `openpyxl` có trong image, chưa có trong `requirements.txt` (deny-list).

## 1. Dữ liệu (giữ nguyên)
`CafefDailyPrice` bảng riêng (`symbol`,`date`,`close_raw`,`close_adjusted`,`open/high/low_raw`,`volume`,`value`,`source='cafef'`, unique `(symbol,date)`). **Không ghi `DailyPrice`**, không đụng `apply_adjustments`/parser/widget/host. O1 (hệ giá thứ 3) và O8 (format ngày) đã đóng.

## 2. Vị trí trên COC (UI)

| Lớp | file:line | Việc cần thêm |
|---|---|---|
| BE route | `service_ops/operator_urls.py:29-31` (prefix `/operator/scraping/`) | `dataops/cafef/preview|run|run/<run_id>/abort/`; **không** đăng ký thêm prefix `/operator/soc/` (`urls.py:187-189`) — reservation m4, không có test parity |
| BE view | `service_ops/views/dataops_planner.py:219,277,315+` (`SOCBaseView`) | `service_ops/views/dataops_cafef.py` mới: Preview/Run/Abort; **reuse** `_build_market_data_ownership_payload()` (`ownership.py:71`, `dataops_base.py:100-104`) — **không tạo action-map** (m3); `@extend_schema` **cả request lẫn response** (m6, cảnh báo `dataops_planner.py:349-354`) |
| BE task | `service_ops/tasks.py` pattern planner | `import_cafef_ohlc_task(exchange, year, run_id, dry_run)`: commit theo `(exchange, year)`, **abort cooperative**, counters nhất quán; revoke `terminate=True, SIGTERM` + đóng run `'skipped'` như `dataops_planner.py:402-407,416-426` (m6) |
| BE run log | `ServiceRunLog` | `service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']` (`dataops_planner.py:106-108`) để hiện trong run-logs (m5) |
| FE adapter | `adapters/core/soc.js:452-462` | `previewCafefImport`, `runCafefImport`, `abortCafefImport`, `getCafefImportStatus` |
| FE state | `components/soc/DataOpsContext.tsx:84-85,165-174` | state + hàm trigger/abort/status riêng |
| FE UI | `SocDataOpsPanel.tsx:14-20` `DATAOPS_SUB_TABS` + query-param `dataops_tab` (`DataOpsContext.tsx:92`) | **sub-tab mới** — không cần pageRegistry/routeCatalog/SocTabNavigation; dùng `soc.components.css` + biến `soc.tokens.css`, **không copy `styles.*`** từ `soc.module.css` (m7) |
| FE i18n | `i18n/vi.js` + `en.js` | key `soc.*` cả 2 locale |
| FE test | `adapters/core/__tests__/soc.test.js:372-385` + `components/soc/__tests__/*` | adapter + component test |
| Inventory | `service_ops/views/dataops_inventory.py:61,90,174-195` | thêm entry `cafef_daily_price` + `data_type` mới để bảng đối chiếu hiện trong COC (m5 — quyết định: có, vì owner muốn quản lý trên UI) |

## 3. Nguồn số Preview & ToS (sửa M1)
- Preview **PHẢI gọi CafeF network** (bảng còn trống trước apply): fetch XLSX + parse trong memory, trả `row_count` dự kiến; cache 10 phút theo `(exchange,year)`, timeout 20 s, pacing ≥1 s.
- AC: `preview(HOSE, 2022).row_count = 101756` (fetch tức thời); **sau apply**, `GET status` trả `imported_count` đếm từ `CafefDailyPrice`. Hai nguồn số phải ghi rõ trong UI ("dự kiến" vs "đã lưu").
- **Owner chốt ToS/rate-limit trước C2 VÀ C3** (preview cũng fetch mạng). `openpyxl` vào requirements trước C2 (coordinator + `Claim-Deny-List:`).
- Dry-run cũng fetch+parse 101k rows nhưng **0 ghi DB**.

## 4. Gate (sửa M2)
- FE: `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run test`, **`npm run check:shell`** (= `check:tokens` + `check:contrast` + `i18n:scan:strict` + `check:i18n-hardcoded`, `package.json:12`).
- Baseline UI: fingerprint staging đổi ⇒ chạy `--update-baseline` cho `scripts/check-ui-baseline/check-a11y-runtime.json` + `check-theme-contrast.json` (`check-a11y-runtime.mjs:850-857,902-904`); `check-uiux-budget.mjs:105-135` nếu thêm CSS rule. **Không báo PASS khi gate báo CHƯA CHẠY**.
- BE: test trên VPS `14.225.255.47` với `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; cấm local Docker.
- `agent-sync.ps1` (rebase→gate) + `check-multi-agent.mjs` + `check-experiment-env.mjs`; claim tên agent = tên branch (L-M02 trong `multi-agent.md`); không commit thẳng `dev`.
- E2E Playwright trên staging: preview → dry-run → apply → abort; **mở ảnh xác nhận** (L-V05). `git status` sạch sau lệnh có side effect.

## 5. Slice
- **C1** — model + migration (`makemigrations`, head `0009`) + `cafef/contract.py` + admin register + test golden 2 ngày/7 unit/3 control date.
- **C2** — `fetcher.py` + `parser.py` (DD/MM response, validate range từ `year`, drop 3 cột, temp cleanup `finally`), perf đo thật. Blocker: openpyxl.
- **C3 (UI)** — BE 3 endpoint + ownership reuse + Celery task (commit theo exchange/year, abort cooperative) + run log + inventory entry; FE adapter/context/sub-tab/i18n/style/test. AC: preview 101756 (fetch); dry-run 0 row; apply → row ghi, apply lại `inserted=0/updated=count`; abort đóng run terminal; staff-only.
- **C4** — báo cáo đối chiếu read-only trên cùng sub-tab: `close_adjusted` vs `DailyPrice.adj_close/close` cho TPB/VNM/VCB; không tự sửa.

## 6. Tiêu chí nghiệm thu
Golden TPB `04/01→2022-01-04/42750/17940` và `01/04→2022-04-01/41250`; DD/MM request reject; mock 2026 reject; preview/dry-run/apply/abort chạy thật; gate FE + baseline xanh; không regression widget.

## 7. Non-goals / Rollback
Không sửa parser, `apply_adjustments`, `DailyPrice`, widget chart, dữ liệu VCI/KBS; không cutover source. Rollback: ẩn route/sub-tab + xoá row `source='cafef'` / drop bảng — không ảnh hưởng dữ liệu hiện hữu.

## 8. Lessons
`[L-V01, L-V02, L-V04, L-V05, L-V03, L-002, L-M02 (multi-agent.md), L-A01 (multi-agent.md)]`.
