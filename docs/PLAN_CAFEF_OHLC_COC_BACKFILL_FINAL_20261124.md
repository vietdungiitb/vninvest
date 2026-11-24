# PLAN (FINAL) — Backfill OHLC CafeF & quản lý trên UI COC

> Ngày lập: 2026-11-24 · Trạng thái: **AGREE** (audit độc lập), chờ owner chốt 2 reservation rồi mới B5 (claim + code).
> Tài liệu nguồn/audit:
> - `docs/PLAN_CAFEF_OHLC_INGEST_20261124.md` (REVISION 4 — lịch sử sửa đổi)
> - `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_V{1,2,3}_20261124.md` (bản command)
> - `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_UI_V{1,2}_20261124.md` (bản UI)
> - `docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md` (nguyên nhân)

---

## 1. Mục tiêu & phạm vi

Lấy toàn bộ OHLC từ CafeF làm **nguồn đối chiếu**, lưu bảng riêng, và cho phép vận hành (preview / dry-run / apply / abort / đối chiếu) **trên UI COC** (`/operations-center` → tab DataOps), không dùng management command.

**Không làm**: sửa `DailyPrice`, `apply_adjustments`, parser corporate action, widget/host, dữ liệu VCI/KBS, cutover nguồn.

## 2. Căn cứ (đã đo thật)

| Hạng mục | Số liệu |
|---|---|
| Export `PriceHistoryExport.ashx?ExchangeType=HOSE&Symbol=ALL&StartDate=01/01/2022&EndDate=12/31/2022` | 4.467.581 byte, **101.756 data rows** (+1 header), 2–3 s |
| Quy mô backfill | 3 exchange (HOSE/HNX/UPCOM) × 17 năm ≈ **51 request ≈ 228 MB** |
| JSON `PriceHistory.ashx` | `PageSize` cap 30; range >1 năm bị clamp; phải pagination |
| Format ngày | **request** `MM/DD/YYYY`; **response XLSX** `DD/MM/YYYY`. Gửi `31/12/2022` → im lặng trả 246 dòng 2026 |
| Golden TPB | `04/01/2022 → 2022-01-04: close 42.750 / adj 17.940 / vol 11.034.900 / value 467.260.000.000 / O 41.500 / H 43.250 / L 41.300`; `01/04/2022 → 2022-04-01: close 41.250` |
| Nguyên nhân | VCI/KBS đã trả giá điều chỉnh (DB `close` ≈ 0,932 × CafeF adjusted); `adj_close` hiện bị điều chỉnh lần 2 (× 0,3085) |

## 3. Thiết kế dữ liệu

Bảng mới `CafefDailyPrice` cạnh `DailyPrice` (`market_data/models.py:63-94`):

| Field | Từ cột XLSX | Chuyển đổi |
|---|---|---|
| `symbol` | Mã | upper() |
| `date` | Ngày | `strptime('%d/%m/%Y')` |
| `close_raw` | Giá đóng cửa | ×1000 |
| `close_adjusted` | Giá điều chỉnh | ×1000 |
| `open_raw`, `high_raw`, `low_raw` | Giá mở/cao/thấp nhất | ×1000 |
| `volume` | Khối lượng khớp lệnh | nguyên |
| `value` | Giá trị khớp lệnh | ×1e9 |
| — | Thay đổi, KL/GT thỏa thuận | **bỏ qua** (ghi rõ trong contract) |

Unique `(symbol, date)`; `source='cafef'`. Migration do `makemigrations` sinh (head hiện tại `0009`).

## 4. Vị trí triển khai

### BE
| Việc | File |
|---|---|
| Model + migration | `packages/core/backend/src/market_data/models.py`, `market_data/migrations/00XX_*.py` |
| Contract / fetch / parse / reconcile | `market_data/cafef/{contract,fetcher,parser,reconcile}.py` (thư mục mới) |
| 3 route `/operator/scraping/dataops/cafef/...` | `service_ops/operator_urls.py:29-31` |
| View Preview/Run/Abort (`SOCBaseView`, staff-only) | `service_ops/views/dataops_cafef.py` (mới) |
| Ownership | reuse `_build_market_data_ownership_payload()` (`service_ops/views/dataops_base.py:100-104`, `ownership.py:71-78`) — **không tạo action-map** |
| Task async | `service_ops/tasks.py` — commit theo `(exchange, year)`, abort cooperative, counters |
| Run log | `ServiceRunLog` với `service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']` (`dataops_planner.py:107`) |
| Inventory | `service_ops/views/dataops_inventory.py:61,90,174-195` — thêm entry `cafef_daily_price` |

Mọi view mới: `@extend_schema` **cả request lẫn response** (`dataops_planner.py:349-354`). Abort theo pattern `revoke(terminate=True, SIGTERM)` + run `'skipped'` (`dataops_planner.py:402-407,416-426`).

### FE (COC)
| Việc | File |
|---|---|
| Adapter | `packages/web/src/adapters/core/soc.js:452-462` — `previewCafefImport`, `runCafefImport`, `abortCafefImport`, `getCafefImportStatus` |
| State | `components/soc/DataOpsContext.tsx:84-85,165-174` |
| UI | sub-tab trong `DATAOPS_SUB_TABS` (`SocDataOpsPanel.tsx:14-20`, query-param `dataops_tab`) — **không** đụng pageRegistry/routeCatalog/SocTabNavigation |
| Style | `soc.tokens.css` + `soc.components.css` — **KHÔNG dùng `soc.module.css`** (barrel 3 dòng) |
| i18n | `i18n/vi.js` + `i18n/en.js`, key `soc.*` đủ 2 locale |
| Test | `adapters/core/__tests__/soc.test.js:372-385` + `components/soc/__tests__/*` |

## 5. Hành vi Preview (quan trọng)

- Bảng còn trống trước apply ⇒ preview **phải fetch CafeF tức thời**, parse in-memory, trả `row_count`.
- Cache 10 phút theo `(exchange, year)`; timeout 20 s; pacing ≥1 s giữa các request.
- UI phân biệt rõ **"số dự kiến (fetch)"** và **"số đã lưu (bảng)"**.
- Dry-run: fetch + parse nhưng **0 ghi DB**.
- Apply: ghi `CafefDailyPrice`; chạy lại → `inserted=0, updated=count`.

## 6. Slice & nghiệm thu

| Slice | Nội dung | AC |
|---|---|---|
| **C1** | Model + migration + `cafef/contract.py` + admin register | Golden TPB 2 ngày/7 đơn vị; 3 control date (DD/MM reject, mock 2026 reject, swap day/month bắt được) |
| **C2** | `fetcher.py` + `parser.py` | ALL HOSE 2022 = 101.756 data rows; 0 duplicate; 0 date parse-fail; perf đo thật (parse <30 s, mem <500 MB) ghi evidence |
| **C3** | BE 3 endpoint + task + run log + inventory; FE adapter/context/sub-tab/i18n/style/test | preview 101756; dry-run 0 row; apply ghi row, apply lại idempotent; abort đóng run terminal; staff-only; E2E Playwright staging + mở ảnh |
| **C4** | Nút "Đối chiếu" trên cùng sub-tab (read-only) | So sánh `close_adjusted` vs `DailyPrice.adj_close/close` cho TPB/VNM/VCB; **không tự sửa** |

## 7. Gate trước khi báo PASS

- **Owner chốt trước C2 & C3**: (a) ToS/rate-limit tải ~228 MB; (b) `openpyxl` vào `packages/core/backend/requirements.txt` — file **deny-list**, cần coordinator + trailer `Claim-Deny-List:`.
- BE test: VPS `14.225.255.47`, cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; cấm local Docker; thiếu ⇒ ghi `CHƯA CHẠY`.
- FE: `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run test`, `npm run check:shell` (7 sub-script theo `package.json:12`).
- Baseline UI: update `scripts/check-ui-baseline/check-a11y-runtime.json`, `check-theme-contrast.json` (`--update-baseline`); `check-uiux-budget.mjs:103-139` nếu thêm CSS rule.
- Quy trình: `agent-sync.ps1` (rebase→gate) → `check-multi-agent.mjs` → `check-experiment-env.mjs`; claim tên agent = tên branch (`feat/<agent>`); không commit thẳng `dev`; mỗi slice ≤ 3 vòng; ledger Entry riêng.
- `git status --short` sạch sau mọi lệnh có side effect (tải file/screenshot).

## 8. Rollback
Ẩn route/sub-tab + xoá row `source='cafef'` hoặc drop bảng `CafefDailyPrice`. Không ảnh hưởng dữ liệu hiện hữu, không migrate ngược phức tạp.

## 9. Reservation còn lại
- Prefix `/operator/scraping/` (không đăng ký `/operator/soc/` như `urls.py:187-189`); **owner = implementer C3** khi khai claim.
- Perf parse chưa đo — phải đo thật theo L-V01 trước khi PASS.
