# ADR-005: Danh mục phải tường minh theo nguồn — danh mục thủ công không liên quan broker

- **Ngày:** 2026-10-14 · **Trạng thái:** ĐÃ CHỐT (Owner) · **Claim:** `multibroker-plan`
- **Bối cảnh:** `docs/PLAN_MULTI_BROKER_SYNC_20261014.md` mục 6 câu 1 (QĐ-A/B/C)

## Quyết định

Chọn **QĐ-C (cô lập mặc định + tổng hợp chỉ đọc)**:

1. Mọi danh mục thuộc đúng 1 trong 4 làn, có nhãn nguồn bắt buộc:
   `manual` (thủ công) · `broker_backed` (DNSE/TCBS/SSI theo tiểu khoản) ·
   `aggregate` (tổng hợp, chỉ đọc).
2. **Danh mục thủ công không liên quan gì đến broker**: không đọc từ broker, không đẩy
   ngược lên broker (broker không có đối tượng "danh mục" qua API — kiểm chứng 3 lane
   vnbroker 3.7.2: 100% method ghi là lệnh, 0 method nhận danh mục/vị thế/watchlist).
3. Mọi dòng tài chính (`Transaction`, `LedgerEntry`, `PositionSnapshot`,
   `AccountSnapshot`) bắt buộc mang `broker_account` FK — "không trộn lẫn" do cấu trúc
   DB bảo chứng, không phải quy ước miệng.
4. Hướng đồng bộ duy nhất: **broker → app** (vị thế/số dư/lệnh); **app → broker chỉ qua
   lệnh** (trade path, ngoài phạm vi Wave 1–3).

## Hệ quả

- Wave 0 schema: `SubAccount` +broker_config FK/+provider, `Portfolio` +kind/+is_archived,
  `PortfolioBrokerBinding`, `+broker_account` 4 bảng tài chính, `BrokerSyncRun/Issue`.
- Danh mục `broker_backed` auto-tạo khi sync, tên chuẩn `"DNSE — 0012345678"`.
- UI holdings bắt buộc badge nguồn (provider + số tiểu khoản).
