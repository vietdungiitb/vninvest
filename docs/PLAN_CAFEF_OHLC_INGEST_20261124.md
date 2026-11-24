# Plan — Lấy toàn bộ OHLC từ CafeF làm nguồn đối chiếu / thay thế (2026-11-24)

> Trạng thái: **DRAFT — chờ audit độc lập. KHÔNG sửa code.**
> Xuất phát từ re-verify nến cũ: `docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md`
> (VCI/KBS đã trả giá điều chỉnh; pipeline `adj_close` hiện đang double-adjust).

## 0. Bằng chứng endpoint đã tự probe (không đoán)

| Hạng mục | Kết quả đo |
|---|---|
| JSON `PriceHistory.ashx` | `?ExchangeType=HOSE&Symbol=TPB&StartDate=01/04/2022&EndDate=01/06/2022&PageIndex=1&PageSize=10` → HTTP 200, `TotalCount=2`, 2 bản ghi |
| Page size | `PageSize=5000` vẫn trả **30** dòng ⇒ phải pagination (9 trang cho 249 dòng/năm) |
| Giới hạn range | yêu cầu 3 năm (2020-2022) → `TotalCount=250` (chặn ~1 năm) |
| `Symbol=ALL` (JSON) | HOSE 2022 `TotalCount=101.768` |
| **Export `PriceHistoryExport.ashx`** | `Symbol=TPB`, 1 năm 2022 → XLSX 14.171 byte, **249 dòng + header**, 3,1 s |
| Export `ALL` 1 tháng HOSE | 388.397 byte, 8.911 dòng |
| **Export `ALL` 1 năm HOSE** | **4.467.581 byte, 101.757 dòng, 3,1 s** |
| Exchange khác | HNX (`SHS`), UPCOM (`ACV`) cùng contract, 247 dòng/năm |
| 12 cột XLSX | `Mã, Ngày, Giá đóng cửa, Giá điều chỉnh, Thay đổi, Khối lượng khớp lệnh, Giá trị khớp lệnh, Khối lượng thỏa thuận, Giá trị thỏa thuận, Giá mở cửa, Giá cao nhất, Giá thấp nhất` |
| Quy ước đơn vị | giá = nghìn VNĐ (42,75 = 42.750đ); giá trị = tỷ VNĐ; volume = cổ phiếu |
| Dependency | `openpyxl 3.1.5`, `pandas 3.1.1` có trong container; **chưa khai báo trong `requirements.txt`** (file deny-list) |

⇒ Backfill toàn bộ ước **~3 exchange × 17 năm ≈ 51 request XLSX**, không phải hàng trăm nghìn request JSON.

## 1. Fan-out đường dữ liệu hiện tại (bắt buộc phải đọc trước khi code)

| Nhánh | file:line | Ghi chú |
|---|---|---|
| Ingest hàng ngày | `data_ingest/tasks.py:653-685 _fetch_daily_history_with_retry` → `:688+ _classify_daily_price_rows` | gọi `fetch_daily_history` |
| Adapter provider | `market_data/vnbroker_adapter.py:680-724 fetch_daily_history` | resolve source + fallback chain |
| Ghi DB | `market_data/models.py:63-94 DailyPrice` | `unique_together (symbol,date)`, có `source`, `is_adjusted`, `adj_close` |
| Tính adj_close cũ | `market_data/corporate_actions/adjustment.py:26-104` | `apply_adjustments` nhân dồn factor — **nghi double-adjust** |
| Đọc cho chart | `stock_mgmt_native_views.py:1871+ /chart/` (host dùng) + `:4056+ /bars/` | `/chart/` trả OHLC thô từ `DailyPrice.close` |
| Host adapter | `packages/web/src/adapters/chartAdapter.js:42-54,94-102` | bỏ `adj_close` |
| Widget bundle | `0.4.7-ent` | không consume `adjClose` để render |

**Không sửa** widget/host trong plan này — chỉ lớp BE ingest + dữ liệu.

## 2. Quyết định cần owner chốt TRƯỚC khi code (chặn)

1. **Vai trò CafeF**: (a) nguồn bổ sung để đối chiếu/sửa `adj_close`, hay (b) nguồn chính thay VCI/KBS? Khuyến nghị (a) cho slice đầu.
2. **Ép nghĩa giá**: CafeF có 2 cột riêng (`Giá đóng cửa` thô 42.750 vs `Giá điều chỉnh` 17.940 cho TPB 04/01/2022). Map `close` = cột nào? Đề xuất giữ `close` = giá đóng cửa CafeF, `adj_close` = giá điều chỉnh CafeF, và **ngừng chạy `apply_adjustments` trên row có `source='cafef'`**.
3. **Phạm vi backfill**: toàn bộ 2010-2026 (~51 request/exchange) hay chỉ 5 năm gần?
4. **ToS/rate limit**: tải ~150 request XLSX (~600 MB) có được phép không? Cần pacing (đề xuất ≥1 s/request) + không cache lại tài nguyên CafeF lên CDN công khai.
5. **Dependency**: thêm `openpyxl` vào `requirements.txt` (deny-list ⇒ coordinator + trailer) hay dùng `pandas.read_excel` với openpyxl đã có sẵn?

## 3. Thiết kế (slice hoá, mỗi slice ≤ 1 nhóm file)

### C1 — Contract & probe (read-only + test)
- File: `market_data/cafef/` (mới): `contract.py` định nghĩa 12 cột, unit, exchange list.
- Test golden với TPB 04/01/2022: thô 42.750, điều chỉnh 17.940, volume 11.034.900 (control biết đáp án — L-V01).
- AC: parse đúng số thập phân VN `,`; bỏ header; dòng thiếu ngày → reject + log; range > 1 năm → reject client-side.

### C2 — Fetch + parse XLSX
- `market_data/cafef/fetcher.py`: `download_year(exchange, year, symbol='ALL')` → XLSX bytes; retry/backoff; pacing; timeout 45 s.
- `market_data/cafef/parser.py`: pandas.read_excel → list dict chuẩn hoá sang VNĐ (`×1000` cho giá, `×1e9` cho giá trị).
- Test: 1-year ALL HOSE → 101.757 dòng; `Symbol=ALL` 2022 có TPB 04/01/2022.

### C3 — Persist (có flag, chưa đổi dữ liệu hiện hữu)
- Management command `import_cafef_ohlc --exchange --year --dry-run --apply --limit`.
- Upsert `DailyPrice` với `source='cafef'`; **không** ghi đè row `source='vnbroker_*'` khi chưa có lệnh cutover; log inserted/updated/skipped.
- Idempotent: chạy lại cùng năm không đổi số row (unique symbol+date).
- Test: dry-run 0 ghi; apply 2 lần → lần 2 `updated` = count, `inserted` = 0.

### C4 — Validation & cutover (chỉ sau owner chốt §2)
- So sánh mẫu TPB/VNM/VCB: CafeF `Giá điều chỉnh` vs `adj_close` hiện tại; báo lệch.
- Nếu chọn CafeF làm nguồn adj_close: command `reconcile_adj_close --apply` ghi `adj_close` từ CafeF, reset `is_adjusted`; **tắt** `apply_adjustments` cho row cafef.
- Rollback: giữ bản dump `DailyPrice` trước cutover; không migrate DB.

## 4. Tiêu chí nghiệm thu
- Given TPB 04/01/2022, When parse XLSX, Then `close=42750`, `adj_close=17940`, `volume=11034900` ± 0.
- Given chạy import 2022 twice, Then lần 2 không insert row mới.
- Given range 3 năm, Then reject trước khi gửi request (không tải về rồi mới chặn).
- Given `--dry-run`, Then 0 write DB.
- Staging: chạy C2+C3 cho HOSE 2021-2022, kiểm tra 2 năm × ~101k dòng/ năm, `git status` sạch sau mọi lệnh có side effect.

## 5. Gate & quy trình
- Nạp `project-lessons`; `check-lessons.mjs` nếu đụng LESSONS.
- `agent-sync.ps1` (rebase → gate) + `check-multi-agent.mjs`; claim tên agent = tên branch; không commit thẳng `dev`.
- BE test chỉ trên VPS `14.225.255.47` (`CORE_DATABASE_URL` + `DJANGO_DEBUG=1`), cấm local Docker; `CHƯA CHẠY` nếu thiếu env.
- `requirements.txt` là deny-list ⇒ coordinator xử lý, trailer `Claim-Deny-List:`.
- Mỗi slice tối đa 3 vòng sửa; quá ⇒ blocker dừng. Ledger Entry riêng.

## 6. Non-goals / Rollback
Không sửa widget/host, không sửa parser corporate action, không xoá dữ liệu VCI/KBS, không tự động cutover source.
Rollback: xoá row `source='cafef'` + khôi phục dump nếu đã chạy reconcile; không cần migration.

## 7. Lessons áp dụng
`[L-V01, L-V02, L-V04, L-V03, L-002, L-M02]` — control biết đáp án TPB, phản chứng root cause (đã refute 2 kết luận trước), assert giá trị thật, `git status` sau lệnh tải file, claim trước code, tên branch đúng.
