# Plan — Lấy toàn bộ OHLC từ CafeF làm nguồn ĐỐI CHIẾU (2026-11-24)

> Trạng thái: **AGREE (audit v3) — plan được phê duyệt, chờ owner cho phép triển khai. Chưa sửa code.**
> Audit v1/v2/v3: `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_V{1,2,3}_20261124.md`.
> Reservation trước C2: owner chốt ToS/rate-limit + `openpyxl` (deny-list); đo perf thật trước khi PASS.
> Nguồn gốc: `docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md`.

## 0. Bằng chứng endpoint (auditor tự đo lại)

- JSON TPB 04/01/2022: `GiaDongCua=42.75`, `GiaDieuChinh=17.94`, volume `11.034.900`.
- `PageSize=5000` → cap 30; range 3 năm → clamp ~1 năm (`TotalCount=250`).
- Export `Symbol=ALL`, HOSE 2022: 4.467.581 byte, **101.756 data rows + 1 header**, 2–3 s; ALL 1 tháng = 8.911 dòng; HNX/UPCOM 247 dòng/năm.
- Đơn vị: giá nghìn VNĐ (×1000); giá trị tỷ VNĐ (×1e9); volume cổ phiếu.
- **⛔ Hai format ngày khác nhau**: **request** = `MM/DD/YYYY` (`12/31/2022`); **response XLSX** = `DD/MM/YYYY` (`30/12/2022`, `04/01/2022`). Gửi `31/12/2022` cho request → endpoint im lặng trả 246 dòng năm 2026.
- XLSX chứa **cả** `01/04/2022` (giá 41,25) và `04/01/2022` (giá 42,75) — swap day/month vẫn "nằm trong range" nếu chỉ validate range.
- `openpyxl 3.1.5` có trong image nhưng chưa có trong `requirements.txt` → blocker C2 (deny-list).
- Backfill 3 exchange × 17 năm ≈ 51 request × 4,47 MB ≈ **228 MB**.

## 1. Thiết kế (sửa O1–O8)

1. **CafeF là nguồn ĐỐI CHIẾU, bảng riêng `CafefDailyPrice`** (`symbol`, `date`, `close_raw`, `close_adjusted`, `open/high/low_raw`, `volume`, `value`, `source='cafef'`, unique `(symbol,date)`). Không ghi `DailyPrice` ⇒ không tạo hệ giá thứ 3; consumer (`advisory_helpers.py:219,233`, `advisory/views.py:963-989`, `vnbroker_materializer.py:103-109,190-198`, `portfolio_analytics_views.py:488-498`, `screener_helpers.py:381`, `adjustment.py:19-22,61`) không đổi.
2. **Không đụng** `apply_adjustments`, parser CA, `/chart/`, host, widget. Nightly `tasks.py:3498-3499` chỉ đụng `DailyPrice`.
3. **Date handling (sửa O8):**
   - Request: strict `MM/DD/YYYY` — reject `31/12/2022` **trước khi gửi network** bằng regex + `datetime.strptime`.
   - Response: parse **DD/MM/YYYY** bằng `strptime('%d/%m/%Y')` — KHÔNG dùng chung format với request.
   - Range validation so với `[Jan 1 của --year, Dec 31 của --year]` lấy từ **argument `--year`**, không parse từ input hay từ response.
   - Golden test assert **cả ngày lẫn giá**: `04/01/2022 → date=2022-01-04, close_raw=42750, close_adjusted=17940` **và** `01/04/2022 → date=2022-04-01, close_raw=41250`.
   - Control test: (a) request DD/MM bị reject; (b) mock response 246 dòng 2026 cho request 2022 → reject; (c) 2 golden date ở trên.
4. **Mapping 12 cột (sửa reservation):**

| Cột XLSX | Đích | Chuyển đổi |
|---|---|---|
| Mã | `symbol` | upper() |
| Ngày | `date` | `strptime('%d/%m/%Y')` |
| Giá đóng cửa | `close_raw` | ×1000 |
| Giá điều chỉnh | `close_adjusted` | ×1000 |
| Thay đổi | **bỏ qua** | chuỗi `'+1,65 (+4,01%)'`, không lưu |
| Khối lượng khớp lệnh | `volume` | nguyên |
| Giá trị khớp lệnh | `value` | ×1e9 |
| Khối lượng thỏa thuận | **bỏ qua** | ghi rõ drop |
| Giá trị thỏa thuận | **bỏ qua** | ghi rõ drop |
| Giá mở cửa | `open_raw` | ×1000 |
| Giá cao nhất | `high_raw` | ×1000 |
| Giá thấp nhất | `low_raw` | ×1000 |

Golden đủ 7 giá trị convert: `42750 / 17940 / 11034900 / 467260000000 / 41500 / 43250 / 41300`.

5. **Exchange list**: chỉ **HOSE / HNX / UPCOM** (có bằng chứng probe). VN30 / HNX30 là index — **out of scope**, không khẳng định có.
6. **Đăng ký model**: thêm `CafefDailyPrice` vào `market_data/admin.py:11` cho nhất quán. `service_ops/views/dataops_inventory.py:61,90` hardcode `market_data_dailyprice` — bảng đối chiếu **cố ý không hiện** trong SOC DataOps; ghi rõ trong plan.
7. **Perf (sửa reservation)**: parse <30 s / mem <500 MB là **target chưa đo** — đổi thành AC bắt buộc: đo thật trên VPS bằng `/usr/bin/time -v` (hoặc `resource.getrusage`), ghi evidence; **không báo PASS khi chưa đo** (L-V01).

## 2. Fan-out (đã mở rộng)

`data_ingest/tasks.py:653-704` · `market_data/vnbroker_adapter.py:680-724` · `models.py:63-94,222-289` · `corporate_actions/adjustment.py:26-104` · `stock_mgmt_native_views.py:1871+,1935,4056+,4138-4145,1495-1503,1603,1516-1522,1781` · `market_serving/vnbroker_materializer.py:103-109,156,190-198` · `market_serving/materializers.py:80` · `market_data/views.py:155,232-252` · `service_ops/views/prefetch.py:481,535` · `advisory/*`, `portfolio_analytics_views.py:488-498`, `screener_helpers.py:381`. Intraday (`IntradayBar`/`IntradayTick`) bảng riêng; `TickerSessionClose` chỉ docstring — không ảnh hưởng.

## 3. Slice

### Vị trí đặt trong repo (đường dẫn thật)

| Thành phần | Đường dẫn | Trạng thái |
|---|---|---|
| Model `CafefDailyPrice` | `packages/core/backend/src/market_data/models.py` (cạnh `DailyPrice:63-94`) | file có sẵn |
| Migration | `packages/core/backend/src/market_data/migrations/00XX_...py` | sinh bằng `makemigrations`; head hiện tại `0009` |
| Contract (12 cột, 2 format ngày, exchange) | `packages/core/backend/src/market_data/cafef/contract.py` | **thư mục mới** |
| Fetcher / parser | `packages/core/backend/src/market_data/cafef/fetcher.py`, `parser.py` | mới |
| **Backfill command** | `packages/core/backend/src/market_data/management/commands/import_cafef_ohlc.py` | **thư mục mới** (`management/__init__.py` + `management/commands/__init__.py`) |
| Báo cáo đối chiếu | `packages/core/backend/src/market_data/cafef/reconcile.py` (C4, read-only) | mới |
| Test | `packages/core/backend/src/market_data/tests/test_cafef_contract.py`, `test_cafef_parser.py`, `test_import_cafef_ohlc.py` | mới |
| Admin register | `packages/core/backend/src/market_data/admin.py:11` | file có sẵn |

Lý do chọn app `market_data`: model đích nằm ở đây; `data_ingest` hiện **không có** `management/commands/` (chỉ có tasks), trong khi convention repo là `<app>/management/commands/<tên>.py` (vd `signal_intelligence/management/commands/recompute_dark_flow_values.py`, `user_workspace/.../count_subaccount_backfill_gaps.py`).

- **C1** — model `CafefDailyPrice` + migration (`makemigrations`, không tự đặt số) + `contract.py` (12 cột, 2 format ngày, exchange list) + admin register. Test golden 2 ngày + 7 unit + 3 control date.
- **C2** — `fetcher.py` (`download_year(exchange, year, symbol='ALL')`, retry/backoff, pacing ≥1 s, timeout 45 s, temp file cleanup `finally`) + `parser.py` (parse DD/MM, validate range từ `--year`, drop 3 cột). **Blocker**: `openpyxl` vào requirements (coordinator + `Claim-Deny-List:`).
- **C3** — `import_cafef_ohlc --exchange --year --dry-run --apply`: ghi `CafefDailyPrice` only. AC: dry-run 0 write; apply 2 lần → `inserted=0, updated=count`; đo perf thật.
- **C4** — báo cáo đối chiếu read-only `CafefDailyPrice.close_adjusted` vs `DailyPrice.adj_close/close` cho TPB/VNM/VCB; **không tự sửa**.

## 4. Tiêu chí nghiệm thu
- TPB 04/01/2022 → `2022-01-04 / 42750 / 17940 / 11034900 / 467260000000 / 41500 / 43250 / 41300`.
- TPB 01/04/2022 → `2022-04-01 / 41250` (chống swap ngày).
- ALL HOSE 2022 = 101.756 data rows; DD/MM request reject; response 2026 cho request 2022 reject.
- dry-run 0 write; idempotent; perf đo thật ghi evidence; `git status` sạch sau lệnh tải file (L-V03).

## 5. Gate & quy trình
Nạp `project-lessons`; `check-lessons.mjs`; `agent-sync.ps1` (rebase→gate) + `check-multi-agent.mjs`; claim tên agent = tên branch (L-M02 trong `multi-agent.md` — trùng ID với file migrations); không commit thẳng `dev`. BE test trên VPS `14.225.255.47` với `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; cấm local Docker; `CHƯA CHẠY` nếu thiếu env. Owner chốt ToS/rate limit + openpyxl trước C2. Mỗi slice ≤ 3 vòng; ledger Entry riêng.

## 6. Non-goals / Rollback
Không sửa widget/host, parser, `apply_adjustments`, `DailyPrice`, dữ liệu VCI/KBS; không cutover source. Rollback: drop bảng `CafefDailyPrice` / xoá row `source='cafef'` — không ảnh hưởng dữ liệu hiện hữu.

## 7. Lessons áp dụng
`[L-V01, L-V02, L-V04, L-V03, L-002, L-M02 (multi-agent.md)]`.
