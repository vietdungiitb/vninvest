# Plan — CafeF OHLC: ingest đối chiếu + vận hành trên UI COC (2026-11-24)

> Trạng thái: **REVISION 3 — thay C3 command bằng UI COC theo yêu cầu owner. Chờ audit lại. CHƯA sửa code.**
> Audit v1/v2/v3 (bản command): `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_V{1,2,3}_20261124.md` — bản đó AGREE nhưng đã bị thay scope.
> Nguồn gốc: `docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md`.

## 0. Bằng chứng (giữ nguyên, đã audit)

- Export `Symbol=ALL`, HOSE 2022: 4.467.581 byte, **101.756 data rows**, 2–3 s; 3 exchange × 17 năm ≈ 51 request ≈ 228 MB.
- Request `MM/DD/YYYY`, response XLSX `DD/MM/YYYY`; XLSX có cả `04/01/2022 (42,75)` và `01/04/2022 (41,25)`.
- Golden 7 unit: `42750 / 17940 / 11034900 / 467260000000 / 41500 / 43250 / 41300`.
- `openpyxl` có trong image, chưa có trong `requirements.txt` (deny-list).

## 1. Thiết kế dữ liệu (giữ nguyên)

CafeF là **nguồn đối chiếu**, lưu bảng riêng `CafefDailyPrice` (`symbol`, `date`, `close_raw`, `close_adjusted`, `open/high/low_raw`, `volume`, `value`, `source='cafef'`, unique `(symbol,date)`). **Không ghi `DailyPrice`**, không đụng `apply_adjustments`/parser/widget/host. Reservation cũ vẫn giữ: owner chốt ToS/rate-limit + `openpyxl` trước C2.

## 2. Vị trí UI trên COC (MỚI — thay command)

Owner muốn **mục quản lý trên UI COC**, không dùng management command. Bám đúng pattern DataOps planner hiện có:

| Lớp | file:line hiện có | Việc cần thêm |
|---|---|---|
| BE route | `service_ops/operator_urls.py:29-31` (`dataops/planner/preview|run|run/<id>/abort/`) | 3 route mới: `dataops/cafef/preview/`, `dataops/cafef/run/`, `dataops/cafef/run/<run_id>/abort/` |
| BE view | `service_ops/views/dataops_planner.py:219 (Preview), 277 (Run, SOCBaseView)` + pattern abort `:315+` | `service_ops/views/dataops_cafef.py` (mới): `CafefPreviewView`, `CafefRunView`, `CafefAbortView` — kế thừa `SOCBaseView`, ownership `can_apply` (`_build_market_data_ownership_payload`, `_build_market_data_write_denied_response`) |
| BE ownership | `service_ops/ownership.py:71` (`dataops_market_data`) | khai báo action mới (preview/run/abort) theo map hiện có |
| BE run log | `service_ops` `ServiceRunLog` + `create_global_planner_run` pattern | run record cho Cafef import (run_id, trigger `soc.dataops.cafef.run`, status, counters, error) |
| BE task | `service_ops/tasks.py` (planner task pattern) | `import_cafef_ohlc_task(exchange, year, run_id, dry_run)` —Celery async, tím progress |
| BE domain | `market_data/cafef/{contract,fetcher,parser,reconcile}.py` | giữ nguyên từ bản cũ (logic thuần) |
| FE adapter | `packages/web/src/adapters/core/soc.js:452-461` (`previewSocDataOpsPlanner`, `runSocDataOpsPlanner`, `abortSocDataOpsPlannerRun`) | thêm `previewCafefImport`, `runCafefImport`, `abortCafefImport`, `getCafefImportStatus` |
| FE state | `components/soc/DataOpsContext.tsx:84-85,165-174` (`triggerBackfill`, `abortRun`) | thêm state + hàm trigger/abort/status riêng cho Cafef |
| FE UI | `components/soc/SocDataOpsPanel.tsx` + `SocDataOpsOperationsSection.tsx:100,204` + `SocDataOpsPlannerConsole.tsx:78,102` + `SocBackfillProgressPanel.tsx:80-81` | section mới: chọn exchange, year, preview (#rows), Dry-run/Apply, progress + abort, link run log |
| FE style | `soc.tokens.css` + `soc.components.css` | **KHÔNG dùng `soc.module.css`** (barrel 3 dòng, AGENTS.md) |
| FE i18n | `packages/web/src/i18n/vi.js` + `en.js` (key `soc.*`) | thêm key đầy đủ 2 locale |
| FE test | `adapters/core/__tests__/soc.test.js:372-385` + `components/soc/__tests__/*` | adapter test + component test (preview/dry-run/apply/abort) |

## 3. Slice (cập nhật)

- **C1** — model `CafefDailyPrice` + migration (`makemigrations`, head `0009`) + `cafef/contract.py` (12 cột, 2 format ngày, exchange HOSE/HNX/UPCOM) + admin register. Test golden 2 ngày + 7 unit + 3 control date.
- **C2** — `fetcher.py` + `parser.py` (parse DD/MM, validate range từ `year`, drop 3 cột, temp cleanup `finally`). **Blocker**: `openpyxl` vào requirements (coordinator + `Claim-Deny-List:`). Perf đo thật.
- **C3 (UI, thay command)** — BE 3 endpoint + ownership + Celery task + run log; FE adapter/context/section/i18n/style. AC:
  - Preview trả số dòng dự kiến (HOSE 2022 = 101.756) **không ghi DB**.
  - Dry-run từ UI: 0 row `CafefDailyPrice`.
  - Apply từ UI: row được ghi; apply lại → `inserted=0, updated=count`.
  - Abort khi running → task revoke, run đóng terminal.
  - UI staff-only (SOCBaseView + ownership), không cho free/user thường.
- **C4** — báo cáo đối chiếu read-only (có thể nút "So sánh" trên cùng section): `CafefDailyPrice.close_adjusted` vs `DailyPrice.adj_close/close` cho TPB/VNM/VCB; **không tự sửa**.

## 4. Tiêu chí nghiệm thu
- Giữ nguyên golden TPB `04/01→2022-01-04/42750/17940` và `01/04→2022-04-01/41250`; DD/MM request reject; mock 2026 reject.
- UI: preview/dry-run/apply/abort chạy thật trên staging Playwright (theo `webapp-testing`, VPS `14.225.255.47`); **mở ảnh xác nhận** (L-V05).
- Gate: `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run test` (FE); BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; cấm local Docker.
- `git status` sạch sau mọi lệnh có side effect.

## 5. Quy trình
Nạp `project-lessons`; `check-lessons.mjs`; `agent-sync.ps1` (rebase→gate) + `check-multi-agent.mjs` + `check-experiment-env.mjs`; claim tên agent = tên branch (L-M02 trong `multi-agent.md`); không commit thẳng `dev`. Owner chốt ToS + openpyxl **trước C2**. Mỗi slice ≤ 3 vòng; ledger Entry riêng.

## 6. Non-goals / Rollback
Không sửa parser, `apply_adjustments`, `DailyPrice`, widget chart, dữ liệu VCI/KBS; không cutover source. Rollback: tắt route/UI flag + drop bảng `CafefDailyPrice` — không ảnh hưởng dữ liệu hiện hữu.

## 7. Lessons
`[L-V01, L-V02, L-V04, L-V05, L-V03, L-002, L-M02 (multi-agent.md), L-A01 (multi-agent.md)]`.
