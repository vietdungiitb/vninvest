# Chốt 5 điều kiện §5 — SSOT giá lịch sử (2026-11-24)

> Dựa trên `PROPOSAL_VNBROKER_SSOT_PRICE_SOURCE_20261124.md` REVISION 1 và
> `AUDIT_PROPOSAL_VNBROKER_SSOT_20261124.md`. Đây là **khuyến nghị có căn cứ đo được**,
> không phải code; mục ToS vẫn cần owner ký duyệt pháp lý.

## 1. ToS / rate-limit ~228 MB

**Chốt: KHÔNG bulk tải trong P0/P1. ToS là gate của riêng P2, không chặn P0/P1.**

- P0 chỉ đụng 1 dòng flag trong `adjustment.py` — **0 request CafeF**.
- P1 thêm API wrapper trên vnbroker; test dùng fixture/mock — **0 request thật**.
- P2 mới cần export ALL (3 sàn × ~17 năm ≈ 51 request ≈ 228 MB).
- Ràng buộc khi P2: pacing ≥1 s/request, timeout 60–180 s, retry tối đa 2, log filename +
  sha256 mỗi file, **không** tải lại năm đã có nếu sha trùng.
- Nếu ToS chưa rõ ⇒ P2 dùng đường per-symbol JSON (chậm hơn nhưng ít tải), không tự ý bulk.

## 2. UI default raw hay adjusted

**Chốt: GIỮ NGUYÊN mặc định hiện tại (provider-adjusted) suốt P0–P2. Đổi default chỉ ở P3, sau khi owner ký.**

Lý do đo được: TPB 04/01/2022 DB `close≈16.723` → CafeF raw `42.750` (**×2,56**), DB
`adj_close≈5.159` → CafeF adjusted `17.940` (**×3,5**). Đổi default sớm sẽ làm mọi chart/indicator
nhảy 2,5–3,5× mà người dùng không được báo trước (`OPINION...md:44` cũng cảnh báo).
Thêm công tắt opt-in "Giá thô (CafeF)" ở P2 để đối chiếu, nhưng **không** đặt làm default.

## 3. Ngưỡng phủ theo năm × sàn

**Chốt: 95% chỉ áp cho `gộp 3 sàn` VÀ chỉ cho năm đã đo ≥95%; HOSE-only KHÔNG dùng ngưỡng 95%.**

Số tự đo/đã ghi trong REVISION 1 §3: HOSE-only 2011 `39,3%` · 2015 `39,5%` · 2018 `29,4%` ·
2020 `28,1%` · 2022 `27,2%`; chỉ gộp 3 sàn 2022 đạt `98,6%`. Các ô "CHƯA ĐO" (HNX/UPCOM các năm
sâu) **chỉ chặn mở rộng P2 sang năm đó**, không chặn P2 scope 2022 đã có bằng chứng 98,6%.

Quy tắc:
- P2 scope ban đầu = **2022 (3 sàn)** — năm duy nhất đã có bằng chứng 98,6%.
- Các năm 2011/2015/2018/2020: **giữ nguyên dữ liệu cũ**, chỉ đối chiếu; không apply dù có cột CafeF.
- Các ô `CHƯA ĐO` (HNX/UPCOM năm sâu) **chỉ chặn mở rộng P2 sang năm đó**, không chặn P2 scope 2022 đã có bằng chứng 98,6%.
- Per-symbol gate: `coverage='missing'` ⇒ bỏ qua mã đó, ghi `price_source='unmapped_cafef'`,
  **không** ghi frame rỗng vào DB (tránh lỗi "tưởng ngày nghỉ").
- Tiêu chí dừng P2: coverage gộp 3 sàn < 95% ⇒ dừng toàn lô.

## 4. Thứ tự version-bump & merge 2 repo

**Chốt: P0 chạy ngay (không phụ thuộc) → merge vnbroker `feat/cafef-reference` → bump vnbroker `3.9.0` + tag/PyPI → vninvest pin version mới → P2.**

- `daily_bars`/`bulk_year` là API additive ⇒ minor bump `3.8.2 → 3.9.0` (không phải patch).
- vninvest không thể pin bản chưa publish; P0 độc lập nên không bị chặn.
- Không merge vnbroker khi gate FULL còn đỏ. Tôi từng quan sát `pytest-full` đỏ do env thiếu
  `DNSE_API_SECRET` + atexit temp, nhưng **không có evidence doc trong vninvest** cho claim đó
  (`vnbroker/docs/REPORT_TCBS_ROUND4.md:222-225` ghi 8/8 xanh ở mốc cũ) ⇒ đánh dấu
  **CHƯA ĐO LẠI**, không dùng làm căn cứ chốt. Phải tự chạy `check_all.ps1` ở commit hiện tại.

## 5. Tiêu chí dừng khi bước nhảy giá

**Chốt: phân biệt "nhảy do đổi basis" (báo cáo, không dừng) và "nhảy do lỗi" (dừng ngay).**

| Loại | Ngưỡng | Hành động |
|---|---|---|
| Đổi basis raw/adjusted | ×2,56 / ×3,5 như đo được | **Warn + báo cáo**, có chữ ký owner trước P3 — không dừng P2 |
| Lệch `close_raw` vs CafeF `GiaDongCua` | bất kỳ lệch nào sau ÷1000 | **DỪNG** (sai unit/parse) |
| Lệch `close_adjusted` vs CafeF `GiaDieuChinh` | bất kỳ lệch nào sau ÷1000 | **DỪNG** |
| Tỷ lệ nội chuỗi `close_raw/close_adjusted` giữa 2 ngày kề nhau | lệch >1% | Phân loại như dòng dưới: rebase đã xác nhận ⇒ alert; không phải rebase ⇒ **DỪNG** (lỗi unit/parse) |
| KBS/CafeF adjusted ratio drift (monitoring) | lệch >0,5% so với mean `0,9355` (`std 0,00027` đo 120 ngày ≈ 17σ) | **Phân loại trước**: fetch chuỗi mới + so `GiaDieuChinh/GiaDongCua`. Xác nhận rebase ⇒ **Alert**, không dừng ghi. Không phải rebase ⇒ **DỪNG** (lỗi unit/parse) |
| Ngày ngoài `[start,end]` / sai tz | bất kỳ | **DỪNG** (bài học nến 1970) |
| Số dòng trả về khác kỳ vọng >0,1% | — | **DỪNG** |

## 6. Trạng thái chốt

| # | Mục | Chốt | Cần owner ký? |
|---|---|---|---|
| 1 | ToS/rate-limit | defer sang P2; ≥1 s/req; mock ở P0/P1 | **CÓ** (pháp lý) trước P2 bulk |
| 2 | UI default | giữ provider-adjusted tới P3 | **CÓ** trước P3 |
| 3 | Ngưỡng phủ | 95% gộp 3 sàn; CHƯA ĐO chỉ chặn mở rộng, không chặn 2022 | không (ngưỡng kỹ thuật) |
| 4 | Version/merge | P0 → merge vnbroker → 3.9.0 → pin → P2 | coordinator |
| 5 | Tiêu chí dừng | bảng §5 | không (kỹ thuật) |

Owner chỉ còn phải ký mục 1 & 2; mục 3–5 là quy tắc kỹ thuật đã chốt.
