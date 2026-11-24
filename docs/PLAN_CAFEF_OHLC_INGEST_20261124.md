# Plan — Lấy toàn bộ OHLC từ CafeF làm nguồn ĐỐI CHIẾU (2026-11-24)

> Trạng thái: **REVISION 1 sau audit NEED_REVISION — chờ audit vòng 2. KHÔNG sửa code.**
> Audit v1: `docs/evidence/widget-news-events/AUDIT_PLAN_CAFEF_V1_20261124.md`.
> Nguồn gốc: `docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md`.

## 0. Bằng chứng endpoint (tự probe; auditor đã tự đo lại)

| Hạng mục | Kết quả |
|---|---|
| JSON TPB 04/01/2022 | `GiaDongCua=42.75`, `GiaDieuChinh=17.94`, volume `11.034.900` |
| `PageSize=5000` | cap **30** dòng ⇒ JSON phải pagination |
| Range 3 năm | clamp ~1 năm (`TotalCount=250`) |
| Export `Symbol=ALL`, HOSE 2022 | **4.467.581 byte, 101.756 data rows (+1 header), ~2–3 s** |
| Export ALL 1 tháng HOSE | 8.911 dòng |
| HNX `SHS` / UPCOM `ACV` 2022 | 247 / 247 dòng |
| 12 cột | `Mã, Ngày, Giá đóng cửa, Giá điều chỉnh, Thay đổi, KL khớp lệnh, GT khớp lệnh, KL thỏa thuận, GT thỏa thuận, Giá mở cửa, Giá cao nhất, Giá thấp nhất` |
| Đơn vị | giá = nghìn VNĐ (×1000); giá trị = tỷ VNĐ (×1e9); volume = cổ phiếu |
| **Bẫy date format** | `EndDate=31/12/2022` (DD/MM) → endpoint **im lặng trả 246 dòng năm 2026**, không error. Phải strict MM/DD/YYYY + validate ngày trả về nằm trong range yêu cầu |
| Dependency | `openpyxl 3.1.5` có trong image nhưng **chưa có trong `requirements.txt`** → blocker C2 (deny-list, coordinator) |

Backfill 3 exchange × 17 năm ≈ **51 request × 4,47 MB ≈ 228 MB** (con số cũ 150/~600 MB là sai).

## 1. QUYẾT ĐỊNH THIẾT KẾ (sửa O1–O3)

1. **CafeF là nguồn ĐỐI CHIẾU, không ghi đè `DailyPrice`.** Lưu vào bảng riêng `CafefDailyPrice` (`symbol`, `date`, `close_raw`, `close_adjusted`, `open/high/low_raw`, `volume`, `value`, `source='cafef'`, unique `(symbol,date)`). Lý do: `DailyPrice.close` hiện đã là giá đã chỉnh của VCI/KBS (≈0,932 × CafeF điều chỉnh) và `adj_close` đang double-adjust — ghi đè sẽ tạo **hệ giá thứ 3** và trộn consumer (`advisory_helpers.py:219,233`, `advisory/views.py:963-989`, `vnbroker_materializer.py:103-109,190-198`, `portfolio_analytics_views.py:488-498`, `screener_helpers.py:381`, `adjustment.py:19-22,61`).
2. **Không đụng `apply_adjustments` / parser corporate action trong plan này.** Bảng đối chiếu tách biệt ⇒ nightly `tasks.py:3498-3499` không ghi đè dữ liệu CafeF. Việc sửa double-adjust là slice RIÊNG, chờ owner chốt basis.
3. **Không upsert vào `DailyPrice`** (unique `(symbol,date)` tại `models.py:90` khiến "không ghi đè vnbroker" + "updated=count" tự mâu thuẫn). Bảng riêng có unique riêng ⇒ import lại cùng năm: `inserted=0`, `updated=count`.
4. Hành vi widget không đổi: `/chart/` đọc `DailyPrice.close` (`stock_mgmt_native_views.py:1935,4138`) — ta **không sửa cột này**.

## 2. Fan-out đã mở rộng (theo audit O4)

| Nhánh | file:line | Xử lý |
|---|---|---|
| Ingest hiện tại | `data_ingest/tasks.py:653-704` | không đụng |
| Adapter VCI | `market_data/vnbroker_adapter.py:680-724` | không đụng |
| DailyPrice | `market_data/models.py:63-94` | không đụng; bảng mới cạnh nó |
| Adj cũ | `corporate_actions/adjustment.py:26-104` | không đụng (xem §1.2) |
| Đọc chart | `stock_mgmt_native_views.py:1871+, 1935, 4056+, 4138-4145, 1516-1522, 1781` | không đụng |
| Cache technicals | `stock_mgmt_native_views.py:1495-1503, 1603` | TTL theo ngày — bảng mới không vào cache này |
| Materializer | `market_serving/vnbroker_materializer.py:103-109,156,190-198`; `market_serving/materializers.py:80` | đọc DailyPrice, không đụng |
| Khác | `market_data/views.py:232-252`; `service_ops/views/prefetch.py:481,535` | không đụng |
| Intraday | `stock_mgmt_native_views.py:1923,4045` (`IntradayBar`/`IntradayTick`) | bảng riêng — không ảnh hưởng |
| Legacy | `TickerSessionClose` chỉ còn trong docstring `models.py:66` | 0 code |

## 3. Slice

### C1 — Contract + model (migration)
- `market_data/models.py`: thêm `CafefDailyPrice` (unique `(symbol,date)`), sinh migration bằng `makemigrations` — **không tự đặt số**.
- `market_data/cafef/contract.py`: 12 cột, unit, exchange list, strict MM/DD/YYYY.
- Test golden TPB 04/01/2022: `close_raw=42750`, `close_adjusted=17940`, `volume=11034900`.
- Negative: DD/MM → reject; response có ngày ngoài range → reject + log; thiếu ngày → reject + log.

### C2 — Fetch + parse (BLOCKER: openpyxl)
- `market_data/cafef/fetcher.py`: `download_year(exchange, year, symbol='ALL')` → XLSX bytes; retry/backoff; pacing ≥1 s; timeout 45 s; temp file + cleanup trên exception (kể cả `finally`).
- `market_data/cafef/parser.py`: `pandas.read_excel` → dict chuẩn hoá VNĐ; assert mọi ngày nằm trong range.
- Blocker: phê duyệt thêm `openpyxl` vào `requirements.txt` (deny-list ⇒ coordinator + trailer `Claim-Deny-List:`), Hoặc dùng engine khác đã có sẵn — phải chốt trước khi code.
- AC: ALL HOSE 2022 parse đúng **101.756** data rows (header không tính); có TPB 04/01/2022.

### C3 — Import command
- `import_cafef_ohlc --exchange --year --dry-run --apply`: ghi `CafefDailyPrice`, không đụng `DailyPrice`.
- AC: `--dry-run` 0 write; apply 2 lần → lần 2 `inserted=0, updated=count`; log inserted/updated/skipped.
- Perf budget: 1 file ~101k rows, parse < 30 s, bộ nhớ < 500 MB (đo thật, ghi evidence).

### C4 — Báo cáo đối chiếu (read-only)
- So sánh `CafefDailyPrice.close_adjusted` vs `DailyPrice.adj_close` và `close` cho mẫu TPB/VNM/VCB; output báo lệch, **không tự sửa**.
- Đây là đầu vào cho slice sửa double-adjust (riêng, chờ owner).

## 4. Tiêu chí nghiệm thu
- TPB 04/01/2022: raw 42.750 / adjusted 17.940 / volume 11.034.900 ± 0.
- ALL HOSE 2022: 101.756 data rows, 3 exchange, range clamp 1 năm, DD/MM bị reject.
- Idempotent + dry-run như §3.
- Staging: chạy C2+C3 HOSE 2021-2022; `git status` sạch sau lệnh tải file (L-V03).

## 5. Gate & quy trình
- Nạp `project-lessons`; `check-lessons.mjs`; `agent-sync.ps1` (rebase→gate) + `check-multi-agent.mjs`; claim tên agent = tên branch (L-M02, ghi kèm tên file do trùng ID); không commit thẳng `dev`.
- BE test trên VPS `14.225.255.47`, cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; cấm local Docker; `CHƯA CHẠY` nếu thiếu env.
- ToS/rate limit: owner chốt trước C2; pacing ≥1 s, không public CDN.
- Mỗi slice ≤ 3 vòng sửa; ledger Entry riêng.

## 6. Non-goals / Rollback
Không sửa widget/host, parser, `apply_adjustments`, `DailyPrice`, dữ liệu VCI/KBS. Không tự cutover source.
Rollback: drop bảng `CafefDailyPrice` (hoặc xoá row `source='cafef'`) — không ảnh hưởng dữ liệu hiện hữu, không migrate ngược phức tạp.

## 7. Lessons áp dụng
`[L-V01, L-V02, L-V04, L-V03, L-002, L-M02 (multi-agent.md)]` — control TPB, phản chứng kết luận cũ, assert giá thật + negative, `git status` sau tải file, claim trước code, tên branch đúng.
