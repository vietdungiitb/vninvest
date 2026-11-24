# Ý kiến — Chuẩn hóa lưu trữ giá thô / giá điều chỉnh (2026-11-24)

> Owner hỏi ý kiến về việc `close` đang lưu giá đã điều chỉnh, `adj_close` bị điều chỉnh lần 2.
> Tài liệu này là **khuyến nghị thiết kế**, không phải lệnh triển khai. Mục hiệu chỉnh hiện DEFERRED.

## 1. Tôi đồng ý với chẩn đoán của owner

Mô hình đúng phải là:
- `close` = **giá thô** (giá khớp lệnh thực tế tại phiên, không bị back-adjust).
- `adj_close` = **giá đã điều chỉnh** (back-adjusted theo mọi sự kiện chia cổ tức/tách cổ *sau* ngày đó).
- Khi có sự kiện mới ⇒ phải **tính lại toàn bộ chuỗi `adj_close`** của mã đó (không chỉ dán thêm hệ số vào dòng cũ).

Hiện tại ta làm ngược: `vnbroker_adapter.py:763` chép `close` đã back-adjusted của VCI/KBS vào `DailyPrice.close`, rồi `corporate_actions/adjustment.py:100` lại nhân tiếp hệ số ⇒ `adj_close` thấp hơn giá thật 17–45% (audit `AUDIT_PRICE_ADJUSTMENT_VNINVEST_20261124.md`).

## 2. Điểm mấu chốt: không nên tự tính `adj_close` từ hệ số nữa

Có 2 cách duy trì `adj_close`:

| Cách | Đánh giá |
|---|---|
| Tự tính `adj_close = close_thô × Π factor` từ `CorporateAction` | ❌ Đang lỗi: factor tự tính từ giá đã chỉnh (`adjustment.py:16-23`), parser chỉ hiểu ~30% event (VIC 14/84), fail-closed reset làm mất cả factor đúng. Muốn đúng phải giải quyết hết 3 cái này — tốn kém và vẫn sai số. |
| **Lấy `adj_close` trực tiếp từ provider có cả 2 cột** (CafeF `Giá đóng cửa` + `Giá điều chỉnh`) | ✅ Khớp thị trường (đã đo: DB `close` hiện ≈ CafeF adjusted với median 1.0). Sự kiện mới tự động lan vào chuỗi provider ⇒ không cần tự recompute. |

⇒ Khuyến nghị: **vendor-adjusted làm nguồn sự thật cho `adj_close`**; corporate-action factor chỉ dùng để **kiểm chứng chéo** (cảnh báo khi `raw × factor` lệch vendor adjusted quá ngưỡng), không dùng để ghi đè.

## 3. Mô hình đích đề xuất

| Trường | Nguồn | Ghi chú |
|---|---|---|
| `DailyPrice.close` | CafeF `Giá đóng cửa × 1000` | Giá thô; với mã ngoài phạm vi CafeF giữ provider cũ + cờ `price_source` |
| `DailyPrice.adj_close` | CafeF `Giá điều chỉnh × 1000` | Không tự nhân factor |
| `DailyPrice.is_adjusted` | True khi có nguồn adjusted | Không còn là "self-adjusted" |
| `DailyPrice.price_source` (mới) | `cafef` / `vnbroker_vci` / `vnbroker_kbs` | Provenance để biết dòng nào đã chuẩn hóa |
| `CorporateAction` / `AdjFactor` | giữ nguyên | Chỉ phục vụ overlay sự kiện + đối chiếu, không ghi `adj_close` |
| Quy trình khi có event mới | re-fetch/re-ingest chuỗi adjusted của symbol | Idempotent; không cộng dồn hệ số |

## 4. Chiến lược chuẩn hóa dữ liệu (khi owner cho phép)

1. **Backfill đầy đủ** CafeF vào `CafefDailyPrice` (đang có C1–C3): HOSE + HNX + UPCOM, mọi năm có dữ liệu. Phải kiểm tra độ phủ trước — riêng HOSE 2022 là 101.756 dòng, trong khi DB 2022 có ~365k dòng (gồm HNX/UPCOM và nhiều mã hơn).
2. **Đo độ phủ**: số `(symbol,date)` có CafeF / tổng DB theo năm; liệt kê mã thiếu. Không apply nếu độ phủ thấp.
3. **Dry-run diff**: sinh báo cáo `close cũ → close mới`, `adj_close cũ → adj_close mới`, số dòng đổi, phân bố chênh lệch.
4. **Apply theo lô** `(exchange, year)`, có backup toàn bộ `DailyPrice` trước, rollback từng lô.
5. **Ngắt nguồn ghi đè**: tạm dừng `sync_corporate_actions` ghi `adj_close` cho dòng đã chuẩn hóa; bỏ qua VCI nightly upsert trên `(symbol,date)` đã có `price_source='cafef'`.
6. **Cập nhật FE/consumer**: `/chart/` sẽ trả giá thô ⇒ giá hiển thị TPB 2022 đổi từ ~16.723 sang 42.750. Cần thông báo và cân nhắc công tắc "hiện giá đã điều chỉnh" trong UI.

## 5. Rủi ro / điều kiện chốt trước khi làm

- **ToS/rate-limit** tải ~228 MB (bằng export ALL) chưa được owner chốt.
- **`openpyxl`** chưa khai báo trong `requirements.txt` (deny-list) — cần coordinator.
- **Độ phủ CafeF** với HNX/UPCOM và các năm sâu chưa đo hết.
- **Hành vi UI**: đổi `close` sang giá thô là thay đổi lớn về mặt người dùng; phải chốt default hiển thị raw hay adjusted.
- Không migration DB cần thiết nếu chỉ đổi giá trị + thêm cờ; nhưng cần backup dữ liệu.

## 5b. Phản biện đề xuất hybrid của owner (đo lại 2026-11-24)

Owner đề xuất: `close` = CafeF thô, `adj_close` = VCI/KBS (giá `close` hiện lưu trong DB), thêm cột `cafef_adj_close` vì nghĩ CafeF chỉ có đến 2018.

**Tiền đề bị refute bằng số liệu thật:**

| Năm | CafeF HOSE rows | Cột điều chỉnh có giá trị | DB symbols | CafeF HOSE symbols |
|---|---|---|---|---|
| 2011 | 66.363 | 63.629 dòng khác giá thô | 618 | 280 |
| 2015 | 74.064 | 68.985 | 789 | 313 |
| 2018 | 93.323 | 84.267 | 1.298 | 391 |
| 2020 | 100.646 | có | 1.409 | — |
| 2022 | 101.756 | có | 1.484 | 418 (HOSE) + 346 (HNX) + 922 (UPCOM) |

Độ phủ 2022 sau khi gộp 3 sàn: CafeF **399.315** cặp `(symbol,date)` / DB **365.459** → giao **360.329 = 98,6%**; DB-only 5.130 (1,4%).

⇒ CafeF có từ **2011**, bằng với năm sớm nhất của DB, và có cả giá điều chỉnh. Không có khoảng trống lịch sử như owner lo ngại.

**Đánh giá đề xuất hybrid:**
- ✅ Ý tưởng tách `close` thô / `adj_close` chỉnh là đúng; thêm cột đối chiếu cũng hợp lý.
- ⚠️ Nhưng dùng **VCI/KBS làm nguồn `adj_close`** có nhược điểm đã đo: chuỗi provider back-adjust lại theo thời gian (VNM 2019-12-23: gọi lại 66.154,52 vs DB 69.141,43, drift ~4,5%). Nếu lấy VCI làm `adj_close` canonical, DB sẽ tiếp tục drift mỗi lần có sự kiện mới.
- ⇒ Khuyến nghị vẫn dùng **CafeF làm nguồn cho CẢ HAI cột** (98,6% phủ, có cả thô lẫn chỉnh, từ 2011). Giữ VCI/KBS `close` hiện tại làm `vci_adj_close` **chỉ để đối chiếu/drift monitoring**, không làm nguồn canonical.
- Với 1,4% `(symbol,date)` DB-only: giữ nguyên giá cũ + cờ `price_source='unmapped_cafef'`, liệt kê riêng cho owner quyết định (mã huỷ niêm yết / sàn khác).

## 6. Kết luận / khuyến nghị

Owner đúng: lưu sai cột dẫn đến `adj_close` sai hoàn toàn so với thị trường. Tôi khuyến nghị đi theo hướng **"raw từ CafeF + adjusted từ CafeF, không tự nhân factor"**, làm theo 6 bước §4, với điều kiện chốt §5. Đây là việc P0 về độ đúng dữ liệu, nhưng nên tách thành slice riêng (C5) có plan + audit độc lập riêng, không gộp vào slice đối chiếu đang làm.

Trước mắt: giữ nguyên slice đối chiếu (CafefDailyPrice), **không dùng `adj_close`/`is_adjusted` hiện tại** cho indicator hay hiển thị.
