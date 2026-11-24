# YÊU CẦU cho đội code vnbroker — P1: CafeF làm SSOT giá lịch sử

> Ngày: 2026-11-24 · Người viết: session audit vninvest.
> Phạm vi: **chỉ đặc tả yêu cầu + report audit**. Không code, không đụng branch `feat/cafef-reference` đang in-progress.
> Căn cứ: `docs/AUDIT_PROPOSAL_VNBROKER_SSOT_20261124.md` (Entry 615), `docs/DECISION_SSOT_OWNER_ITEMS_20261124.md`, `docs/PLAN_PRICE_ADJUSTMENT_P0_20261124.md` (Entry 616).

## 1. REPORT AUDIT (tự kiểm chứng, không tin đề xuất gốc)

| Blocker | Số tự đo | Kết luận |
|---|---|---|
| O-1 per-symbol coverage | ALL HOSE 2011/2015: TPB **0 dòng**; 2018: 177; VIC/VNM/FPT/ACB 248–252 | "CafeF từ 2011" chỉ đúng ở mức dataset. Đổi default 2018→2011 mà không có coverage gate ⇒ trả rỗng im lặng cho TPB |
| O-2 độ phủ | Giao CafeF(HOSE)∩DB: 2011 **39,3%** · 2015 **39,5%** · 2018 **29,4%** · 2020 **28,1%** · 2022 **27,2%**; gộp 3 sàn 2022 **98,6%** | 98,6% chỉ đúng 2022/3 sàn; các năm sâu thấp |
| O-3 bước nhảy | TPB 04/01/2022 CafeF raw 42.750 / adj 17.940 vs DB 16.723 / 5.159 (×2,56 / ×3,5) | Cần dual-write + flag + snapshot, không dry-run rồi apply |
| O-4 | CafeF tự rebase (hệ số TPB 2019 0,2545 → 2026 1,0) | reconcile = monitoring, không nằm trên đường ghi |
| O-5 | `feat/cafef-ref` đã có C1–C3 + UI COC | Giữ `CafefDailyPrice` làm staging; không xoá ngay |

Audit P0 (vninvest) 3 vòng → **PASS**: guard phải đặt **đầu hàm `adjustment.py:83`** (freeze cả reset lẫn ghi); nếu đặt `:97`, vòng reset `:90-96` vẫn `save()` ⇒ vi phạm AC-1 "0 UPDATE". Test F1 `:100-113` chạy với flag ON.

## 2. ĐIỀU KIỆN OWNER ĐÃ CHỐT (§5)
ToS defer P2 (P0/P1 dùng mock, 0 request thật, pacing ≥1 s/req) · UI default giữ provider-adjusted tới P3 · ngưỡng 95% chỉ cho gộp 3 sàn (`CHƯA ĐO` chỉ chặn mở rộng) · thứ tự P0 → merge vnbroker → bump **3.9.0** → vninvest pin → P2 · tiêu chí dừng: nhảy basis = warn+báo cáo, lệch unit/ngày = dừng, drift 0,5% phân loại rebase trước khi alert.

## 3. YÊU CẦU KỸ THUẬT CHO vnbroker (P1)

### R1 — API duy nhất
Thêm facade `Vnbroker.daily_bars(symbol: str | "ALL", start: str, end: str, exchange: str = "HOSE", basis: "raw" | "adjusted" | "both" = "both")` — **wrapper mỏng** trên `CafefReference.history` + `parse_records` (`vnbroker/reference/cafef.py:36-71`). Không tự fetch riêng, không duplicate parse.

### R2 — Frame canonical (khác tier-1 để tránh nhầm)
Cột: `time, open_raw, high_raw, low_raw, close_raw, close_adjusted, volume, value, put_through_volume, put_through_value, source='cafef', price_basis, coverage, fetched_at`.
- tz `Asia/Ho_Chi_Minh`; giá ×1000; `value` ×1e9; request `MM/DD/YYYY`; response XLSX `DD/MM/YYYY` (parser hiện đã đúng).
- `basis='both'` trả cả 2 cột; `raw`/`adjusted` chỉ lọc — **cùng một code path**.

### R3 — Bulk cho backfill
`bulk_year(exchange, year)` dùng **XLSX `Symbol=ALL`** (1 request/năm/sàn; HOSE 2022 = 101.756 dòng, 4,47 MB). pacing ≥1 s/req, retry/backoff, temp-file cleanup trên `finally`, cache theo `(exchange,year)`. Parse peak đo **34–40 s** cho 101k dòng — ghi rõ perf budget, đừng ghi "~20 s".

### R4 — Coverage gate (BẮT BUỘC)
- Frame phải có `coverage` theo `(symbol, year, exchange)`.
- `daily_bars("TPB", "2011-01-01", …)` ⇒ trả **0 dòng + `coverage='missing'`**, không im lặng trả frame rỗng kiểu "ngày nghỉ".
- Đổi default `start` 2018→2011 **chỉ khi** kèm coverage metadata (không đổi mù quáng).
- Dưới ngưỡng 95% (gộp 3 sàn) ⇒ fail rõ ràng / báo cáo, không tự chặn scope 2022 (đã có 98,6%).

### R5 — Không phá work hiện có
- **Giữ nguyên** route `adjusted=False` 6 cột của KBS/VCI (đang có 31 test targeted, 153 contract).
- CafeF **không** đăng ký `ProviderRegistry` / `OPEN_SOURCE_CANDIDATES` / AUTO pool (contract test khóa).
- Không đụng `vnbroker/__init__.py`, `common/data.py`, `broker/`.

### R6 — Reconcile chỉ monitoring
`Vnbroker.reconcile_prices()` tách khỏi đường ghi; correctness đến từ **luôn fetch lại chuỗi adjusted mới** (CafeF tự rebase). Flag drift 0,5% phải phân loại rebase trước khi alert.

### R7 — Test bắt buộc
- **Assert ngày**, không chỉ giá (bài học nến 1970: `source="cafef"` → epoch nhầm nanosecond).
- Golden: TPB `04/01/2022 → close_raw 42750 / close_adjusted 17940 / volume 11034900 / value 467.26e9`.
- Coverage test `TPB 2011 → coverage='missing'`.
- Parity test cross-repo: vninvest map `close_raw/close_adjusted` khớp golden 3 mã × 3 năm.
- Existing 31 targeted + 153 contract phải xanh.

## 4. TRÌNH TỰ & GATE
1. Merge `feat/cafef-reference` hiện tại (chưa xong; `check_all.ps1` FULL cần `.venv`).
2. Implement R1–R6 trên branch mới, claim riêng.
3. Gate: pytest targeted → contract → full unit (kỳ vọng 1 fail version drift có sẵn) → ruff → mypy → `check_all.ps1` FULL → **re-audit độc lập**.
4. Bump version **3.9.0**; vninvest pin version trước P2.

## 5. PHẠM VI KHÔNG LÀM
Không bulk tải thật (ToS chưa ký — P0/P1 dùng mock, 0 request thật) · không ghi DB · không đổi UI default (P3) · không xoá `market_data/cafef/*` / UI COC trên vninvest (dọn sau 2 tuần parity ở P3).
