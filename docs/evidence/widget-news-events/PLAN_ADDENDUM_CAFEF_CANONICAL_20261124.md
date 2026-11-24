# Addendum — CafeF thành nguồn CANONICAL để hiệu chỉnh dữ liệu (2026-11-24)

> Owner chốt 2026-11-24: "dữ liệu KBS/VCI tải về là dữ liệu đã hiệu chỉnh dẫn đến hệ thống ghi sai dữ liệu thật. Cần dữ liệu CafeF để đối chiếu và hiệu chỉnh lại cho chính xác; CafeF phải backfill đầy đủ toàn bộ dữ liệu đã có của thị trường."
> Đây là **đổi mục tiêu** so với `PLAN_CAFEF_OHLC_COC_BACKFILL_FINAL_20261124.md` (bản AGREE: CafeF chỉ đối chiếu, KHÔNG đụng `DailyPrice`).

## 1. Điều thay đổi

| | Plan AGREE | Addendum này |
|---|---|---|
| Vai trò CafeF | nguồn đối chiếu, bảng riêng | **nguồn CANONICAL** cho OHLC thật |
| `DailyPrice.close` | giữ nguyên VCI/KBS (đã chỉnh, sai) | thay bằng CafeF `Giá đóng cửa × 1000` (giá thật) |
| `DailyPrice.adj_close` | giữ nguyên (đang double-adjust) | thay bằng CafeF `Giá điều chỉnh × 1000` |
| Phạm vi backfill | đối chiếu mẫu | **toàn bộ thị trường**, mọi năm có dữ liệu |

## 2. Hệ quả bắt buộc phải xử lý (trước khi ghi đè)

1. **Nightly VCI ingest ghi đè trở lại**: `data_ingest/tasks.py:653-704` vẫn chạy và upsert `DailyPrice` từ VCI. Phải có cơ chế ưu tiên nguồn (ví dụ bỏ qua symbol/date đã có `source='cafef'`), nếu không backfill xong rồi bị ghi đè. Cần sửa `data_ingest/tasks.py` — **thoát non-goal cũ**.
2. **Corporate action pipeline**: `market_data/corporate_actions/adjustment.py:81-104 apply_adjustments` nhân factor trên mọi `DailyPrice`, không filter source → sẽ double-adjust cả row CafeF. Phải skip row `source='cafef'` — **thoát non-goal cũ**.
3. **Thay đổi giá hiển thị**: TPB 04/01/2022 trên chart đổi từ 16.723 (VCI đã chỉnh) sang 42.750 (giá thật CafeF). Đây là ý đồ owner, nhưng phải báo rõ trước rollout.
4. **Backup/rollback**: dump toàn bộ `DailyPrice` trước cutover; ghi theo `(exchange, year)` để rollback từng lô; không migration.
5. **ToS/rate-limit** vẫn chốt trước C2/C3 (backfill ~51 request/228 MB); `openpyxl` vào requirements (deny-list).

## 3. Trình tự đề xuất

- **C1/C2 (giữ nguyên, triển khai ngay)**: model `CafefDailyPrice` + contract/fetch/parser + backfill toàn bộ thị trường vào bảng riêng. Không đụng `DailyPrice`.
- **C3 (UI COC)**: preview/dry-run/apply/abort/đối chiếu trên DataOps sub-tab.
- **C5 (MỚI — hiệu chỉnh, cần audit riêng)**: sau khi bảng CafeF đầy đủ, bước "Áp dụng vào dữ liệu hệ thống" với preview diff (bao nhiêu row đổi, giá đổi thế nào), backup, apply theo lô, skip VCI nightly + skip CA adjustment cho row cafef, rollback.

## 4. Trạng thái
Addendum này **chưa được audit**. C1/C2 không phụ thuộc vào addendum ⇒ có thể làm ngay theo plan AGREE. C5 phải audit độc lập trước khi chạy trên staging/production.
