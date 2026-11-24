# Audit độc lập đề xuất SSOT giá lịch sử qua vnbroker (2026-11-24)

**Phạm vi:** `docs/PROPOSAL_VNBROKER_SSOT_PRICE_SOURCE_20261124.md` + code liên quan ở 2 repo.  
**Trạng thái:** audit chỉ đọc + đo lường; **không sửa code ở cả 2 repo**.  
**Verdict:** **AGREE về hướng (CafeF làm SSOT giá lịch sử trong vnbroker)**, nhưng **NEED_REVISION** ở 3 điểm kỹ thuật then chốt trước khi chốt plan. Xem §2.

## 1. Các claim đã tự kiểm chứng

| Claim của đề xuất | Kiểm chứng | Kết luận |
|---|---|---|
| `Vnbroker.reference("cafef")` đã có | `vnbroker/common/client.py:268` | ✅ đúng |
| `CafefReference.history()` trả `close_raw` + `close_adjusted`, `:73 reconcile()` | `vnbroker/reference/cafef.py:36-71,73-95` | ✅ đúng |
| `adjusted=False` route sang CafeF, trả 6 cột tier-1 | `explorer/kbs/quote.py`, `vci/quote.py` helper `_cafef_raw_records` + 31 test | ✅ đúng |
| CafeF không vào provider pool | `tests/contract/test_cafef_reference_contract.py` (3 cổng) | ✅ đúng |
| `vnbroker_adapter.py:763` chép `row['close']` provider | đã mở file, đúng | ✅ đúng |
| `adjustment.py:100` tự nhân `close × factors` | `packages/core/backend/src/market_data/corporate_actions/adjustment.py:100` | ✅ đúng |
| `market_data/cafef/*` tự fetch/parse riêng | branch `feat/cafef-ref` đang checkout, 5 file | ✅ đúng |
| ALL HOSE 2022 = 101.756 dòng, 4,47 MB | tự export: 4.467.581 byte / 101.756 dòng | ✅ đúng |
| Parse ~20 s | đo: 2011 (66.363 dòng) **20,1 s**; 2022 (101.756 dòng) **34–40 s** | ⚠️ đúng 1 phần — peak năm ~35–40 s |
| "CafeF có từ 2011, default 2018 là sai" | **xem O-1** | ❌ sai ở mức độ quan trọng |

## 2. Objection

### O-1 (BLOCKER) — Dữ liệu 2011 chỉ có ở `Symbol=ALL`; đổi default `2018 → 2011` vô dụng cho 1 mã

Tự đo (lệnh tái lập §5):

| Truy vấn | 2011 | 2013 | 2015 | 2017 | 2018 |
|---|---|---|---|---|---|
| XLSX 1 mã `TPB` | 0 dòng | 0 | 0 | 0 | 177 |
| JSON 1 mã `TPB` | TotalCount 0 | 0 | 0 | 0 | 177 |
| XLSX `Symbol=ALL` HOSE | **66.363 dòng / 280 mã** | — | — | — | — |
| Trong đó riêng `TPB` | **0 dòng** | — | — | — | — |

⇒ Phát biểu "CafeF có từ 2011, bằng năm sớm nhất của DB" đúng ở **mức dataset**, **sai ở mức per-symbol**. TPB không có dữ liệu 2011–2017 dù ALL export có 66k dòng. Đề xuất §3.2 "đổi default start sang 2011" sẽ vẫn trả frame rỗng cho `daily_bars(symbol="TPB", start="2011-01-01")`.

**Hệ quả:** không được phép coi CafeF là SSOT mà không có **per-symbol coverage gate**. Nếu backfill theo năm rồi filter theo mã, nhiều mã sẽ bị trống im lặng (đúng dạng lỗi "frame rỗng tưởng ngày nghỉ" đã ghi trong `CLAUDE.md` của vnbroker).

### O-2 (MAJOR) — Độ phủ 98,6% là của năm 2022; các năm sâu thấp hơn nhiều

vninvest `OPINION_PRICE_STORAGE_NORMALIZATION_20261124.md:62-68` tự ghi: 2011 CafeF 280 mã / DB 618 mã (~45%); 2015 313 / 789 (~40%); 2018 391 / 1.298 (~30%). Con số 98,6% chỉ đúng sau khi gộp 3 sàn năm 2022, với 5.130 cặp DB-only (1,4%).

⇒ Đề xuất §5 viết "1,4% CafeF không phủ" như thể áp dụng mọi năm là **sai**. Phải có bảng độ phủ **theo năm × sàn**, ngưỡng tối thiểu (ví dụ ≥95%), và policy giữ giá cũ + cờ `price_source='unmapped_cafef'` cho phần thiếu.

### O-3 (MAJOR) — Chuyển nguồn gây bước nhảy giá rất lớn; đề xuất chưa có dual-write/rollback

Đo trước đó: TPB 04/01/2022 CafeF raw `42.750` / adjusted `17.940`; KBS `16.783`; DB hiện `close≈16.723`, `adj_close≈5.159`. Tỷ lệ `KBS/CafeF_adj = 0,9355 (std 0,00027)`.

⇒ Nếu đổi `close ← close_raw`, giá lịch sử tăng ~2,56×; nếu `adj_close ← close_adjusted`, tăng ~3,5× so với `adj_close` hiện tại. Đề xuất §4 chỉ nói "dry-run diff → apply" nhưng **không** quy định dual-write, feature flag, snapshot/version, hay tiêu chí dừng. Đây là thay đổi lớn về UI/consumer (`OPINION...md:44` cũng cảnh báo), cần chốt trước khi code.

### O-4 (MINOR) — `reconcile_prices` không phải cơ chế bảo đúng

CafeF tự rebase chuỗi adjusted khi có sự kiện mới (đo: hệ số `GiaDieuChinh/GiaDongCua` của TPB 2019 `0,2545` → 2026 `1,0`). Vì vậy correctness đến từ **luôn fetch lại chuỗi adjusted mới**, không cần trigger bằng ratio. `reconcile_prices` hữu ích cho **drift monitoring**, không nên nằm trên đường ghi dữ liệu (§3.3 hiện đặt nó như trigger). Đề xuất nên tách: (a) fetch fresh = correctness; (b) reconcile = monitoring/alert.

### O-5 (MINOR) — Đụng chí mạng vào công việc đang có của vninvest

`feat/cafef-ref` đã có `market_data/cafef/{contract,fetcher,parser,importer}.py` + UI COC (C1–C3). Đề xuất §4.1 "xoá fetch/parse CafeF khỏi vninvest" sẽ bỏ qua toàn bộ phần đã làm. Không cần xoá ngay: giữ `CafefDailyPrice` làm **bảng staging/đối chiếu** trong giai đoạn chuyển tiếp, chỉ ngừng ghi `adj_close` sai.

## 3. Phương án khả thi nhất cho vninvest (đề xuất của tôi)

Nguyên tắc: **không chờ vnbroker xong mới sửa cái sai**, nhưng **không big-bang migrate**.

| Giai đoạn | Việc | Phụ thuộc | Rủi ro |
|---|---|---|---|
| **P0 — ngay (vninvest)** | Đặt `PRICE_ADJUSTMENT_WRITES_ENABLED=False` (mặc định tắt) tại `adjustment.py:100`; ngừng ghi `adj_close` sai. Giữ `close` nguyên, đính kèm doc/flag semantics = "provider-adjusted". Dùng `CafefDailyPrice` hiện có để **đối chiếu** (không ghi đè DailyPrice) | none | thấp; đúng P0 audit `AUDIT_PRICE_ADJUSTMENT_VNINVEST...md:73` |
| **P1 — vnbroker (sau merge slice hiện tại)** | Thêm `daily_bars(symbol|ALL, start, end, exchange, basis='raw'|'adjusted'|'both')` là wrapper mỏng trên `CafefReference.history` + `parse_records`; `bulk_year(exchange, year)` dùng XLSX export; giữ `adjusted=False` route cũ **nguyên vẹn** (6 cột) để không vỡ 31 test. Default start đổi 2011 **chỉ** khi có coverage metadata | claim `cafef-reference` đã merge, bump version | trung bình |
| **P2 — vninvest (sau pin version mới)** | `vnbroker_adapter` gọi `daily_bars(basis='both')` sau feature flag; **dual-write** `close_raw`/`close_adjusted`/`price_source='cafef'` cạnh `close` cũ; chạy dry-run diff TPB/VNM/VCB × 2011/2015/2022; kiểm tra per-symbol coverage ≥ ngưỡng | P1 + owner chốt ToS/UI | trung bình |
| **P3 — cutover** | Đổi UI default theo quyết định owner; dừng `apply_adjustments` ghi `adj_close`; giữ VCI/KBS làm drift monitoring; dọn local fetcher/parser sau 2 tuần parity | owner chốt | cao — cần backup + rollback theo `(exchange,year)` |

**Khác với đề xuất gốc:** giữ `CafefDailyPrice` làm staging (O-5), không đặt reconcile trên đường ghi (O-4), thêm coverage gate theo mã/năm (O-1/O-2), dual-write + feature flag (O-3).

## 4. Kiểm thử bắt buộc (đúng bài học vnbroker)

- Test phải assert **ngày**, không chỉ giá (bài học nến 1970: `source="cafef"` → epoch hiểu nhầm là nanosecond).
- Golden: TPB `04/01/2022 → 42750 / 17940`, volume `11.034.900`, value `467,26e9`.
- Coverage test: `daily_bars("TPB", 2011)` phải trả **0 dòng + cờ `coverage='missing'`**, không im lặng trả frame rỗng kiểu "ngày nghỉ".
- Parity test cross-repo: vninvest adapter map `close_raw/close_adjusted` khớp vnbroker golden cho 3 mã × 3 năm.
- Dry-run diff report có số dòng đổi, phân bố chênh lệch, danh sách 1,4% DB-only.

## 5. Lệnh tái lập số liệu

```
python C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\probe_cafef_depth_xlsx.py
python C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\probe_xlsx_vs_json.py
python C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\probe_factor_by_year.py
```

## 6. Owner phải chốt trước khi code

1. ToS/rate-limit cho ~228 MB export.
2. UI default: hiển thị **giá thô** hay **giá đã điều chỉnh** (thay đổi 2,5–3,5× với dữ liệu cũ).
3. Ngưỡng độ phủ tối thiểu theo năm/sàn và policy cho phần DB-only.
4. Version bump vnbroker + thứ tự merge 2 repo.

## 7. Lessons áp dụng

`Lessons áp dụng: [L-E01, L-E06, L-P03, L-P06]`

- L-E01: mọi số có lệnh tái lập; con số "20s parse" và "2011" đã bị đo đính chính.
- L-E06: phản biện bằng gọi API thật + đối chiếu từng mã, không tin kết luận dataset-level.
- L-P03: chốt dual-write/coverage gate trong plan, không đẩy cho implementer tự quyết.
- L-P06: "đổi default 2011" là AC proxy — không thi hành được ở mức per-symbol.

## 8. Next steps / owner

Owner chốt §6 → viết plan P0 riêng (không gộp vào slice đối chiếu đang làm) → audit độc lập → claim → TDD → gate → cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`.
