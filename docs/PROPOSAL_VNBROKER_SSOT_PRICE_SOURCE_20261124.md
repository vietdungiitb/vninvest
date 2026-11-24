# Đề xuất (REVISION 1) — vnbroker làm SSOT giá lịch sử

> Ngày: 2026-11-24 · Verdict audit: AGREE hướng, **NEED_REVISION** 3 điểm O-1/O-2/O-3 (+O-4/O-5 minor).
> Audit: `docs/AUDIT_PROPOSAL_VNBROKER_SSOT_20261124.md` (Entry 615).
> **Chỉ đề xuất — không sửa code ở cả 2 repo.** Bản gốc đã bị thay bởi revision này.

## 0. Tiếp nhận phản biện (tự kiểm chứng lại)

| Objection | Tự đo của tôi | Kết luận |
|---|---|---|
| **O-1** per-symbol coverage | XLSX ALL HOSE: TPB **0 dòng** 2011, **0** 2015, **177** 2018; VIC/VNM/FPT/ACB 248–252 dòng mọi năm | ❌ Phát biểu "CafeF có từ 2011" chỉ đúng ở mức dataset. Đổi default 2018→2011 mà không có coverage gate sẽ trả rỗng im lặng cho TPB |
| **O-2** độ phủ | Giao `CafeF(HOSE) ∩ DailyPrice`: 2011 **39,3%**, 2015 **39,5%**, 2018 **29,4%**, 2020 **28,1%**, 2022 **27,2%** (HOSE-only); 2022 sau gộp 3 sàn **98,6%** | ❌ Con số 1,4% DB-only chỉ đúng 2022/3 sàn. Phải có bảng năm × sàn |
| **O-3** bước nhảy | TPB 04/01/2022: CafeF raw 42.750 / adj 17.940; DB `close≈16.723`, `adj_close≈5.159` → ×2,56 / ×3,5 | ❌ Đề xuất gốc thiếu dual-write/flag/snapshot |
| O-4 reconcile | CafeF tự rebase (hệ số TPB 2019 0,2545 → 2026 1,0) | ✅ correctness = luôn fetch chuỗi mới; reconcile chỉ monitoring |
| O-5 tài sản hiện có | `feat/cafef-ref` đã có C1–C3 + UI COC | ✅ giữ `CafefDailyPrice` làm staging, không xoá ngay |
| Parse time | 2011 (66k) 20,1 s; 2022 (101k) 34–40 s | ✅ con số "~20 s" chỉ đúng năm thấp |

## 1. Nguyên tắc thiết kế đã sửa

1. **Không coi CafeF phủ toàn bộ lịch sử.** Mọi đường đọc phải có **coverage gate theo `(symbol, year, exchange)`**; trả frame rỗng kèm cờ `coverage='missing'`, không nuốt.
2. **Không big-bang.** P0 → P1 → P2 → P3, mỗi bước có tiêu chí dừng.
3. **Correctness đến từ fetch lại chuỗi adjusted mới**, không từ reconcile hay tự nhân factor.
4. **Giữ nguyên** `CafefDailyPrice` + UI COC hiện có làm staging/đối chiếu trong giai đoạn chuyển tiếp.
5. Test bắt buộc assert **ngày**, không chỉ giá (bài học nến 1970 của vnbroker).

## 2. Lộ trình triển khai (theo audit §3, có bổ sung)

### P0 — ngay trên vninvest (độc lập vnbroker, rủi ro thấp)
- Đặt flag `PRICE_ADJUSTMENT_WRITES_ENABLED=False` (mặc định tắt) tại `market_data/corporate_actions/adjustment.py:100` ⇒ **ngừng ghi `adj_close` nhân đôi**.
- Giữ `DailyPrice.close` nguyên, đính kèm doc/flag semantics = "provider-adjusted".
- Dùng `CafefDailyPrice` hiện có để **đối chiếu**, chưa ghi đè `DailyPrice`.
- Tiêu chí dừng: mọi test corporate action cũ liên quan `adj_close` phải được cập nhật kỳ vọng (không giữ assertion cũ).

### P1 — vnbroker (sau khi merge `feat/cafef-reference`)
- Thêm wrapper mỏng `daily_bars(symbol|"ALL", start, end, exchange, basis='raw'|'adjusted'|'both')` trên `CafefReference.history` + `parse_records`; `bulk_year(exchange, year)` dùng XLSX export.
- **Giữ nguyên** route `adjusted=False` 6 cột (không vỡ 31 test hiện có).
- Default `start` đổi 2018→2011 **chỉ khi** trả kèm `coverage` metadata; không đổi mù quáng.
- Frame canonical: `time, open_raw/high_raw/low_raw, close_raw, close_adjusted, volume, value, put_through_*, source='cafef', price_basis, coverage, fetched_at`, tz `Asia/Ho_Chi_Minh`.

### P2 — vninvest sau khi pin version vnbroker mới
- `vnbroker_adapter.py:748-769` gọi `daily_bars(basis='both')` **sau feature flag**.
- **Dual-write**: `close_raw` / `close_adjusted` / `price_source='cafef'` cạnh `close` cũ; chưa đổi cột `close` hiển thị.
- Dry-run diff **TPB/VNM/VCB × 2011/2015/2022**; kiểm per-symbol coverage ≥ ngưỡng (đề xuất 95% cho năm/sàn đã có dữ liệu).
- Tiêu chí dừng: nếu coverage < ngưỡng hoặc bước nhảy giá vượt ngưỡng chốt ⇒ không apply.

### P3 — cutover (quyết định owner)
- Đổi UI default raw hay adjusted; giữ VCI/KBS làm **drift monitoring**; dọn local fetcher/parser sau **2 tuần parity**.
- Snapshot toàn bộ `DailyPrice` trước apply; rollback theo `(exchange, year)`.

## 3. Bảng độ phủ bắt buộc (đo thêm trước P2)

| Năm | CafeF HOSE pairs | DB pairs | Giao (HOSE-only) | Gộp 3 sàn |
|---|---|---|---|---|
| 2011 | 66.363 | 147.586 | 39,3% | CHƯA ĐO |
| 2015 | 74.064 | 175.418 | 39,5% | CHƯA ĐO |
| 2018 | 93.323 | 305.274 | 29,4% | CHƯA ĐO |
| 2020 | 100.646 | 345.079 | 28,1% | CHƯA ĐO |
| 2022 | 101.756 | 365.459 | 27,2% | **98,6%** (399.315 pairs) |

Policy phần thiếu: giữ giá cũ + `price_source='unmapped_cafef'`, liệt kê riêng cho owner. PER-SYMBOL gate: `TPB 2011 → coverage='missing'`.

## 4. Vai trò provider sau chuẩn hóa
- **CafeF**: SSOT daily raw + adjusted (có coverage gate).
- VCI: corporate actions, listing, realtime, drift monitoring.
- KBS: realtime, drift monitoring.
- CafeF vẫn **không** vào AUTO provider pool.

## 5. Điều kiện owner chốt
ToS/rate-limit ~228 MB · UI default raw/adjusted · **ngưỡng phủ theo năm × sàn** · thứ tự version-bump & merge 2 repo · tiêu chí dừng khi bước nhảy giá vượt ngưỡng.

## 6. Kết luận
Đề xuất gốc sai ở 3 chỗ đã sửa. Hướng vẫn đúng: CafeF là nguồn giá lịch sử trong vnbroker, nhưng triển khai theo P0–P3, có coverage gate, dual-write/flag, không đụng work-in-progress, reconcile chỉ monitoring.
