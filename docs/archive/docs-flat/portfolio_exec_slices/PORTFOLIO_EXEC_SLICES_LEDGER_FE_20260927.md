# TẬP SLICE 2 — WAVE 2 LEDGER + ANALYTICS · WAVE 3 API + FE WORKSPACE

**Ngày:** 2026-09-27 · 22 slice · 63–80 ed
**Đọc trước:** `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` §0 · `docs/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md` §3 · `docs/AGENT_PROTOCOL.md`
**Điều kiện mở Wave 2:** Wave 1 hoàn tất, checklist Wave 1 xanh
**Điều kiện mở Wave 3:** `ANA-01..05` hoàn tất, `API-01/02` xanh
**Serialize bắt buộc:** `LED-05` (migration) sau `TEN-05`

---

# WAVE 2 — LEDGER + ANALYTICS

> **Mục tiêu:** làm cho NAV/P&L **đáng tin cậy**. Hiện `nav: null`, holdings algorithm sai (clamp oversell, bỏ dividend, không trừ phí/thuế bán).

## LED-01 — Model `LedgerEntry` + `CashFlow`

**Ước lượng:** 4 ed · **Phụ thuộc:** Wave 1 · **File:** `user_workspace/models.py` + migration

### 3. Yêu cầu
- **R1:** `LedgerEntry`: `tenant`, `portfolio`, `entry_type` (BUY/SELL/DIVIDEND/SPLIT/BONUS/FEE/TAX/ADJUSTMENT), `symbol`, `trade_date`, `quantity`, `price`, `fee`, `tax`, `source` (manual/broker/adjustment), `external_id`, `reversal_of` (self-FK), `created_by`, `created_at`
- **R2:** **Append-only**: không có API sửa/xoá entry đã commit. Sửa = tạo entry `ADJUSTMENT` trỏ `reversal_of`
- **R3:** `CashFlow`: `entry` FK, `flow_type` (dividend/fee/tax/deposit/withdrawal/interest), `amount`, `currency` — tách dòng tiền khỏi số lượng/giá
- **R4:** Unique `(tenant, external_id)` khi `external_id` khác null — idempotency
- **R5:** Index `(portfolio, symbol, trade_date)` để truy vết nhanh
- **R6:** `quantity >= 0`; `price >= 0`; `fee >= 0`; `tax >= 0` — validator ở model

### 4. Tiêu chí nghiệm thu
- **AC1:** `makemigrations --check` sạch
- **AC2:** Insert 2 entry cùng `external_id` ⇒ IntegrityError (test)
- **AC3:** `reversal_of` trỏ entry không tồn tại ⇒ validation error
- **AC4:** Index có trong migration SQL (kiểm tra `sqlmigrate`)
- **AC5:** Test ≥ 7 case

### 5. Phản biện bắt buộc
- **PB1:** Có đường nào ghi `LedgerEntry` rồi sửa trực tiếp bằng `QuerySet.update()` không? Grep `.update(` trong user_workspace
- **PB2:** `quantity` cho entry `DIVIDEND` là 0 hay null? Rõ ràng để tránh bug tương tự hiện tại
- **PB3:** `external_id` null thì idempotency thế nào?

### 6. Test
`test_ledger_entry_model.py` — 8 case: tạo entry hợp lệ · unique external_id · reversal hợp lệ · reversal không tồn tại · validator số âm · index tồn tại · tenant bắt buộc · entry_type choices

### 7–8. Bằng chứng + Gate
`docs/evidence/LED-01/` — kèm output `sqlmigrate` chứng minh index · GT6 GT7 GT8 GT9 GT14

### 10. Rollback
Migration **expand** (chỉ thêm bảng) ⇒ rollback an toàn bằng cách drop bảng mới, không mất dữ liệu cũ.

---

## LED-02 — Model `PositionSnapshot`

**Ước lượng:** 3 ed · **Phụ thuộc:** LED-01

### 3. Yêu cầu
- **R1:** `PositionSnapshot`: `tenant`, `portfolio`, `symbol`, `as_of_date`, `quantity`, `avg_cost`, `current_price`, `market_value`, `unrealized_pnl`, `realized_pnl_cum`, `weight`, `calculation_version`, `source`, `created_at`
- **R2:** Unique `(portfolio, symbol, as_of_date)`
- **R3:** Mỗi snapshot có `calculation_version` để truy vết thuật toán
- **R4:** Không sửa snapshot đã tạo (append theo ngày)

### 4. Tiêu chí nghiệm thu
- **AC1:** Tạo 2 snapshot cùng `(portfolio, symbol, date)` ⇒ IntegrityError
- **AC2:** `calculation_version` bắt buộc có giá trị
- **AC3:** Truy vết 1 ngày có đủ mọi trường P&L

### 5. Phản biện bắt buộc
- **PB1:** Snapshot lưu `weight` — nhưng `weight` phụ thuộc tổng portfolio. Tính lúc nào, lấy tổng nào? Ghi rõ trong docstring
- **PB2:** Backfill snapshot lịch sử có khả thi không, hay chỉ từ hôm nay?

### 6. Test
`test_position_snapshot.py` — 5 case: unique · version bắt buộc · đầy đủ trường · append-only · truy vết theo ngày

### 7–8. Bằng chứng + Gate
`docs/evidence/LED-02/` · GT6 GT7 GT8 GT9 GT14

---

## LED-03 — Model `ValuationSnapshot` + NAV engine

**Ước lượng:** 4 ed · **Phụ thuộc:** LED-01, LED-02 · **Slice quan trọng nhất Wave 2**

### 1. Mục tiêu
Tính NAV thật. Hiện `nav: null` vì không có opening balance.

### 3. Yêu cầu
- **R1:** `ValuationSnapshot`: `tenant`, `portfolio`, `as_of_date`, `stock_value`, `cash`, `debt`, `nav`, `currency`, `opening_balance`, `calculation_version`, `source`, `created_at`
- **R2:** Công thức NAV = `stock_value + cash − debt` (ghi rõ trong docstring + test)
- **R3:** `opening_balance` là nguồn gốc của `cash` — không tự bịa
- **R4:** `cash` tính từ `CashFlow` (dòng tiền thực), **không** từ giá trị lợi nhuận
- **R5:** Nếu `opening_balance` chưa biết ⇒ `nav = null` + `nav_reason` — **không** trả 0
- **R6:** `Portfolio` cần trường `opening_balance` hoặc lấy từ `SubAccount.balance`

### 4. Tiêu chí nghiệm thu
- **AC1:** 3 case mẫu tính tay, kết quả khớp từng đồng — bảng so sánh dán vào evidence
- **AC2:** `opening_balance` = null ⇒ `nav = null` + `nav_reason` khác null
- **AC3:** Không có màn hình nào hiển thị `nav: 0` khi chưa đủ dữ liệu
- **AC4:** Test khẳng định **không** có `0` giả: grep response `nav` khi thiếu dữ liệu

### 5. Phản biện bắt buộc
- **PB1:** Đưa 3 case mẫu đã dán vào tài liệu này vào test; tự tính tay lại — có khớp không? Nếu công thức trong docstring sai ⇒ sửa docstring **trước** khi sửa code
- **PB2:** `cash` lấy từ đâu khi có cả dividend lẫn bán? Có khớp với D-06 (phí/thuế SELL trừ khỏi cash) không?
- **PB3:** `debt` có bao giờ khác 0 với cash account? Margin account thì sao?

### 6. Test
`test_valuation_nav.py` — **7 case**, trong đó **3 case tính tay** (bắt buộc có bảng số trong test docstring):
| # | Tên | Kỳ vọng |
|---|-----|---------|
| 1 | `test_nav_simple_long` | stock+cash−debt |
| 2 | `test_nav_with_realized_pnl` | khớp tay |
| 3 | `test_nav_with_fees_and_tax` | phí/thuế đã trừ đúng |
| 4 | `test_nav_null_when_no_opening_balance` | null + reason |
| 5 | `test_cash_from_cashflow` | khớp tổng CashFlow |
| 6 | `test_no_zero_nav_display` | không có 0 giả |
| 7 | `test_dividend_increases_cash_not_decrease_cost` | D-06 |

### 7–8. Bằng chứng + Gate
`docs/evidence/LED-03/` — **bắt buộc** có bảng "tính tay vs hệ thống" cho 3 case · GT6 GT7 GT8 GT9 GT14

### 11. Ngoài phạm vi
Multi-currency (defer) · Margin/đòn bẩy (LIV-03)

---

## LED-04 — Validator tài chính

**Ước lượng:** 3 ed · **Phụ thuộc:** LED-01

### 3. Yêu cầu
- **R1:** `price > 0` cho BUY/SELL; `>= 0` cho DIVIDEND/SPLIT
- **R2:** `quantity > 0` cho BUY/SELL; = 0 cho DIVIDEND
- **R3:** `quantity % 100 == 0` cho VN spot (khớp `VN_SPOT_RULES.lotSize: 100` của widget)
- **R4:** **Oversell** ⇒ **không** clamp, mà trả **cảnh báo có cấu trúc** + `reconciliation_required: true` (D-06 + audit §0.5.5)
- **R5:** `fee`, `tax >= 0`
- **R6:** Lỗi trả `422` + `problem+json` nêu rõ field
- **R7:** SELL vượt holdings cho phép tồn tại trong ledger (để broker reconcile được), nhưng **NAV phải báo warning**

### 4. Tiêu chí nghiệm thu
- **AC1:** `quantity = 150` cho VNM ⇒ 422
- **AC2:** `price = 0` cho BUY ⇒ 422
- **AC3:** SELL 2000 khi chỉ có 1000 ⇒ **không** bị clamp; response có `warnings[]` + `reconciliation_required: true`
- **AC4:** `fee` âm ⇒ 422
- **AC5:** Mọi lỗi có `field` cụ thể trong body

### 5. Phản biện bắt buộc
- **PB1:** Test case SELL vượt: **in ra response thật** để xác nhận warning có mặt, không chỉ assert code
- **PB2:** Có nơi nào vẫn gọi `min()` để clamp không? Grep `min(` trong ledger/analytics
- **PB3:** Validator chạy ở serializer hay model? Kiểm tra cả 2 tầng không mâu thuẫn

### 6. Test
`test_financial_validators.py` — 10 case

### 7–8. Bằng chứng + Gate
`docs/evidence/LED-04/` — kèm **response body thật** của case oversell · GT6 GT9 GT14

---

## LED-05 — Migration `Transaction` → `LedgerEntry`

**Ước lượng:** 4 ed · **Phụ thuộc:** LED-01, LED-04, **TEN-05**

### 1. Mục tiêu
Chuyển dữ liệu cũ sang ledger mới theo D-24 (5 pha).

### 3. Yêu cầu
- **R1:** Đúng 5 pha: **expand → backfill → verify → cutover → contract**. Không gộp
- **R2:** Backfill map: BUY/SELL → `LedgerEntry` tương ứng; DIVIDEND → `CashFlow` + `LedgerEntry` (D-06: cổ tức là cash flow, **không** giảm cost)
- **R3:** Mỗi row backfill có marker `backfilled_by`
- **R4:** **Verify phase**: đếm số `Transaction` vs `LedgerEntry` phải khớp; lệch ⇒ **dừng**, không contract
- **R5:** Contract phase **chỉ** khi verify = 0 lệch; đặt `NOT NULL`, đổi tên bảng
- **R6:** **Không `print()` tiếng Việt có dấu** — dùng `logger`
- **R7:** Chạy được trên DB **có dữ liệu thật**

### 4. Tiêu chí nghiệm thu
- **AC1:** 5 pha là 5 migration riêng, tên đặt rõ (không tự đặt số — để `makemigrations` sinh)
- **AC2:** Verify: `SELECT count(*)` 2 bảng khớp — **dán SQL output**
- **AC3:** Dữ liệu cũ còn nguyên sau contract (truy vết 1 portfolio mẫu từ đầu đến cuối)
- **AC4:** Chạy trên **copy DB production**, không chỉ DB rỗng
- **AC5:** Mỗi phase rollback riêng, chỉ revert row do nó backfill

### 5. Phản biện bắt buộc
- **PB1:** Chạy trên copy DB production. Dán output verify count. Nếu lệch ⇒ dừng, ghi báo cáo.
- **PB2:** Transaction nào **không** map được (type lạ, số âm, symbol rỗng)? Đếm và báo cáo, đừng bỏ qua im lặng
- **PB3:** Sau contract, còn đường nào đọc bảng `Transaction` cũ không? Grep toàn repo

### 6. Test
`test_ledger_migration.py` — 5 case: fresh DB · DB có dữ liệu · verify count khớp · roundtrip 1 portfolio · rollback phase

### 7–8. Bằng chứng + Gate
`docs/evidence/LED-05/` — **SQL output verify count** + **ảnh truy vết 1 portfolio** · GT6 GT7 GT8 GT9 GT14

### 10. Rollback
Từng phase có rollback riêng. Contract phase không rollback an toàn nếu đã có dữ liệu mới ⇒ ghi rõ.

---

## LED-06 — Model `IdempotencyRecord`

**Ước lượng:** 2 ed · **Phụ thuộc:** SAFE-02

### 3. Yêu cầu
- **R1:** `IdempotencyRecord`: `tenant`, `actor`, `scope`, `key`, `request_hash`, `response_code`, `response_body`, `created_at`, `expires_at`
- **R2:** Unique `(tenant_id, actor_id, scope, key)` — hợp nhất với SAFE-02
- **R3:** TTL 7 ngày cho order (D-12)
- **R4:** `request_hash` để phát hiện cùng key khác payload ⇒ 409

### 4. Tiêu chí nghiệm thu
- **AC1:** Trùng key cùng hash ⇒ trả response cũ
- **AC2:** Trùng key khác hash ⇒ 409
- **AC3:** Hết TTL ⇒ tái dùng được
- **AC4:** SAFE-02 chuyển sang dùng bảng này, không tạo bảng thứ hai

### 6. Test
`test_idempotency_record.py` — 6 case

---

## LED-07 — Ledger cache + provenance `meta`

**Ước lượng:** 3 ed · **Phụ thuộc:** LED-03, TEN-06

### 3. Yêu cầu
- **R1:** `meta` bắt buộc có: `calculation_version`, `as_of`, `source`, `stale`, `stale_reason`, `cache_hit`
- **R2:** `calculation_version` = `holdings-wa-v1` cho weighted average
- **R3:** TTL cache theo D-28
- **R4:** Cache key có `tenant_id` (TEN-06) + `calculation_version` (để đổi thuật toán là invalidate)
- **R5:** `meta` **luôn** có, kể cả khi cache hit

### 4. Tiêu chí nghiệm thu
- **AC1:** Mọi response analytics có đủ 6 trường `meta`
- **AC2:** Đổi `calculation_version` ⇒ cache cũ không dùng lại
- **AC3:** Cache hit vẫn trả `meta` đầy đủ

### 6. Test
`test_ledger_meta.py` — 5 case

---

## ANA-01 — TWR / MWR

**Ước lượng:** 3 ed · **Phụ thuộc:** LED-03 · **Theo D-27**

### 3. Yêu cầu
- **R1:** **TWR là mặc định** (D-27)
- **R2:** MWR **chỉ** hiển thị khi có **≥ 2 external cash flow**; không đủ ⇒ `mwr: null` + `mwr_reason`
- **R3:** TWR chuẩn hoá theo giai đoản giữa các cash flow
- **R4:** Ghi `method` vào `meta.calculation_version`
- **R5:** XIRR (money-weighted) cùng tính, để so sánh

### 4. Tiêu chí nghiệm thu
- **AC1:** 2 case TWR tính tay khớp từng đồng — bảng số trong test docstring
- **AC2:** 0 cash flow ⇒ `mwr: null` + reason, **không** trả 0
- **AC3:** 1 cash flow ⇒ `mwr: null` + reason
- **AC4:** ≥2 cash flow ⇒ `mwr` có số
- **AC5:** TWR không đổi khi thêm/sửa cash flow nội bộ (buy/sell) — đây là **bản chất** của TWR, phải test

### 5. Phản biện bắt buộc
- **PB1:** Tính tay lại 2 case TWR. Khớp không? Nếu thuật toán sai mà docstring đúng thì sửa code; nếu ngược lại thì sửa cả hai.
- **PB2:** AC5 có thật sự pass không? Đây là test phân biệt TWR với MWR — nếu fail thì thuật toán đang làm MWR.
- **PB3:** XIRR có giải pháp khi không hội tụ? Xử lý thế nào, có `null` + reason?

### 6. Test
`test_performance_twr_mwr.py` — **7 case** (2 case tính tay TWR · 3 case MWR theo số cash flow · 1 case AC5 · 1 case XIRR)

### 7–8. Bằng chứng + Gate
`docs/evidence/ANA-01/` — bảng tính tay · GT6 GT9 GT14

---

## ANA-02 — Benchmark VN30/VN100 + alpha/beta

**Ước lượng:** 3 ed · **Phụ thuộc:** ANA-01 · **Theo D-27**

### 3. Yêu cầu
- **R1:** **VN30 là benchmark chính**, VN100 phụ
- **R2:** Tính `alpha`, `beta` bằng hồi quy portfolio return vs benchmark return
- **R3:** `beta` = covariance/variance của cùng kỳ
- **R4:** `tracking_error` = std dev của excess return
- **AC5 (bắt buộc):** `information_ratio` = alpha / tracking_error
- **R6:** Chuỗi benchmark phải **cùng tần suất** với portfolio; lệch tần suất ⇒ `null` + reason
- **R7:** Thiếu dữ liệu benchmark ⇒ `null` + reason, **không** trả 0

### 4. Tiêu chí nghiệm thu
- **AC1:** 2 case alpha/beta tính tay khớp
- **AC2:** Portfolio hoàn toàn đồng pha với benchmark ⇒ `beta ≈ 1`, `alpha ≈ 0` (test khó nhưng rất giá trị)
- **AC3:** Thiếu benchmark ⇒ `null` + reason
- **AC4:** Chuỗi khác tần suất ⇒ `null` + reason

### 5. Phản biện bắt buộc
- **PB1:** Test case AC2 (đồng pha) có thật sự cho `beta ≈ 1` không, hay test đang quá lỏng? In giá trị thật.
- **PB2:** Dùng chuỗi benchmark nào? Nguồn, tần suất, ngày bắt đầu. Ghi rõ trong evidence — nếu không ghi thì số không tái tạo được.

### 6. Test
`test_benchmark_alpha_beta.py` — 6 case

---

## ANA-03 — Risk metrics

**Ước lượng:** 4 ed · **Phụ thuộc:** ANA-01

### 3. Yêu cầu
- **R1:** `volatility` — std dev lợi nhuận ngày × √252
- **R2:** `var_95` — historical simulation, 5th percentile
- **R3:** `max_drawdown` — peak-to-trough
- **R4:** `concentration` — top1 / top5 / HHI, tính theo market value weight
- **R5:** Thiếu dữ liệu ⇒ `null` + reason (VD: < 20 phiên cho volatility)
- **R6:** Ghi `calculation_version` cho từng metric

### 4. Tiêu chí nghiệm thu
- **AC1:** 2 case volatility + max drawdown tính tay khớp
- **AC2:** < 20 phiên ⇒ `null` + reason
- **AC3:** `concentration.top1 + top2..5 + others = 1.0` (kiểm tra tổng)
- **AC4:** Drawdown luôn ≤ 0

### 5. Phản biện bắt buộc
- **PB1:** AC3 có đúng không? In tổng 3 phần.
- **PB2:** `max_drawdown` có bao giờ dương không? Test độc lập khẳng định ≤ 0.
- **PB3:** VaR dùng 5th percentile trên **daily** hay **theo chu kỳ**? Ghi rõ trong docstring + tên field.

### 6. Test
`test_risk_metrics.py` — 7 case

---

## ANA-04 — Allocation theo ngành

**Ước lượng:** 2 ed · **Phụ thuộc:** LED-03

### 3. Yêu cầu
- **R1:** Theo `symbol`, theo `sector`, theo `market_cap`
- **R2:** Tổng weight = 1.0
- **R3:** Symbol không có phân ngành ⇒ `sector: "unknown"` + đếm
- **R4:** Trả kèm nguồn phân ngành

### 4. Tiêu chí nghiệm thu
- **AC1:** Tổng weight mỗi cách phân bố = 1.0 (±0.001)
- **AC2:** Symbol chưa phân ngành xuất hiện ở `unknown` và được đếm

---

## ANA-05 — Freshness SLA + cờ `stale`

**Ước lượng:** 2 ed · **Phụ thuộc:** TEN-06 · **Theo D-28**

### 3. Yêu cầu
- **R1:** DNSE ≤ 15 phút · SSI ≤ 30 · TCBS ≤ 30 (giờ VN, phiên 09:00–11:30 và 13:00–14:45)
- **R2:** Ngoài phiên ≤ 24h
- **R3:** Quá ngưỡng ⇒ `stale: true` + `stale_reason`
- **R4:** `as_of` là thời điểm sync cuối, luôn có mặt

### 4. Tiêu chí nghiệm thu
- **AC1:** Giả lập giờ trong phiên, data 20 phút trước, DNSE ⇒ `stale: true`
- **AC2:** Cùng điều kiện, ngoài phiên ⇒ `stale: false` (≤24h)
- **AC3:** `as_of` không null

### 5. Phản biện bắt buộc
- **PB1:** Test có mock được thời gian không, hay chạy theo giờ thật? Nếu theo giờ thật thì test sẽ fail lúc 23h và pass lúc 10h — **test phải deterministic**
- **PB2:** Đây là bẫy tự nhiên. Dùng mock clock, không dùng `datetime.now()`

---

# WAVE 3 — API + FE WORKSPACE

> **Mục tiêu:** 5 trang workspace đạt chuẩn thương mại, dùng widget cho mọi chart trục thời gian (D-31).

## API-01 — RFC 9457 `problem+json`

**Ước lượng:** 3 ed · **Phụ thuộc:** Wave 0

### 3. Yêu cầu
- **R1:** Mọi lỗi API trả `Content-Type: application/problem+json`
- **R2:** Body: `type`, `title`, `status`, `detail`, `errors[]`, `request_id`
- **R3:** `request_id` khớp header `X-Request-ID` (để đối chiếu log)
- **R4:** `type` là URI thật hoặc `about:blank` + `title` chuẩn
- **R5:** Không lộ stack trace, path nội bộ, tên bảng

### 4. Tiêu chí nghiệm thu
- **AC1:** 10 loại lỗi khác nhau đều đúng shape (validation · 401 · 403 · 404 · 409 · 422 · 429 · 500 · 503 · timeout)
- **AC2:** Validate bằng schema RFC 9457 (dán output validator)
- **AC3:** 500 không lộ traceback
- **AC4:** `request_id` trong body khớp header

### 5. Phản biện bắt buộc
- **PB1:** Còn endpoint nào trả HTML lỗi (Django default) không? Kiểm tra 404 không có JSON handler — `OPEN_WORK_20260927.md` OW-01 ghi ~50 lỗi routing
- **PB2:** `request_id` có thật sự nối được tới log không? Test trace 1 lỗi 500 từ response tới log entry.

### 6. Test
`test_problem_json.py` — 10 case (1 case mỗi loại lỗi)

---

## API-02 — OpenAPI 3.1 + envelope `{data, meta}`

**Ước lượng:** 3 ed · **Phụ thuộc:** API-01

### 3. Yêu cầu
- **R1:** Endpoint mới trả `{data, meta}`; endpoint cũ giữ shape 1 release; FE có normalizer dual-read (D-10)
- **R2:** `openapi.json` valid theo OpenAPI 3.1, **không warning**
- **R3:** `meta` gồm `pagination`, `calculation_version`, `as_of`, `source`, `stale`
- **R4:** Mọi endpoint portfolio có entry trong OpenAPI

### 4. Tiêu chí nghiệm thu
- **AC1:** Validator OpenAPI: 0 error
- **AC2:** Tỉ lệ endpoint portfolio có mô tả = 100% — dán **bảng đếm** (số có / số tổng)
- **AC3:** FE normalizer đọc được cả 2 shape
- **AC4:** Có ví dụ request/response cho mỗi endpoint

### 5. Phản biện bắt buộc
- **PB1:** Đếm số endpoint portfolio thật trong `urls.py` rồi đối chiếu số entry trong `openapi.json` — lệch ⇒ AC2 fail
- **PB2:** Có endpoint nào không mô tả error response không?

---

## FE-01 — Workspace shell + tab routing

**Ước lượng:** 3 ed · **Phụ thuộc:** API-02

### 3. Yêu cầu
- **R1:** 5 tab: Overview · Holdings · Activity · Analytics · Allocation (D-36)
- **R2:** URL phản ánh tab (`/portfolios/:id/holdings`) để deep-link + refresh không mất tab
- **R3:** Breadcrumb đầy đủ
- **R4:** Portfolio selector có search + tìm kiếm + health badge
- **R5:** Tenant hiển thị rõ (chống nhầm tenant)
- **R6:** State tab đóng lại mở lại phải nhớ

### 4. Tiêu chí nghiệm thu
- **AC1:** Mỗi tab có URL riêng; copy URL sang tab mới vẫn đúng tab
- **AC2:** Chuyển tab giữ đúng portfolio context
- **AC3:** Breadcrumb đúng cấp
- **AC4:** Refresh trang giữ nguyên tab + portfolio
- **AC5:** Keyboard: Tab/Shift+Tab đi đúng thứ tự; focus visible

### 5. Phản biện bắt buộc
- **PB1:** Đổi tenant rồi F5 — portfolio selector có còn khớp tenant không? Đây là bug class TEN-02.
- **PB2:** URL chứa portfolio id của tenant khác ⇒ xử lý thế nào?

---

## FE-02 — Trang Overview (KPI + equity curve widget)

**Ước lượng:** 4 ed · **Phụ thuộc:** FE-01, ANA-01, **D-31**

### 1. Mục tiêu
Trang đầu tiên người dùng thấy: 6 KPI + equity curve + allocation preview.

### 3. Yêu cầu
- **R1:** 6 metric card: Total Value · Daily P&L · Return (1Y) · Holdings count · Sharpe · Max Drawdown
- **R2:** Mỗi card có sparkline
- **R3:** Equity curve dùng widget series `Line` + `Comparison` (VN30) — **không** dùng ECharts
- **R4:** **Map NAV vào field `close`** — `Line` đọc `d.close` (`SeriesRegistry.ts:292`). Đây là điểm dễ sai nhất
- **R5:** `showNonTradingDays={false}`
- **R6:** `StaleBanner` khi `stale: true`
- **R7:** `SkeletonScreen` khi loading
- **R8:** Số thiếu ⇒ `—` + lý do, **không** hiển thị `0`

### 4. Tiêu chí nghiệm thu
- **AC1:** Equity curve **vẽ đúng** (không phải đường 0) — kiểm tra bằng ảnh chụp + đọc giá trị từ chart
- **AC2:** `Comparison` series hiện đường VN30
- **AC3:** 6 card hiển thị đúng giá trị từ API
- **AC4:** Dữ liệu stale ⇒ banner hiện
- **AC5:** Loading ⇒ skeleton, không nhấp nháy layout
- **AC6:** Thiếu NAV ⇒ `—` + lý do, **không** có `0`
- **AC7:** axe 0 critical/serious

### 5. Phản biện bắt buộc
- **PB1:** **Đọc giá trị thực từ chart** (không chỉ nhìn ảnh) — xác nhận đường khớp `nav` từ API. Đây là bằng chứng quyết định AC1.
- **PB2:** Nếu map `value` thay vì `close` ⇒ chart có ra đường 0? Test bằng cách cố tình map sai, xem chart, rồi sửa lại. Dán output 2 lần.
- **PB3:** Widget 1.2.5 có đủ `Line`/`Comparison` không, hay cần 1.4.0? Nếu cần thì **serialize sau PAP-05**.

### 6. Test
`portfolio-overview.component.test.tsx` — 8 case: 6 card render · sparkline có · equity chart render với non-zero · comparison series · stale banner · skeleton · `—` khi null · axe

### 7–8. Bằng chứng + Gate
`docs/evidence/FE-02/` — **ảnh chụp chart** + giá trị đọc từ chart + output axe · GT1 GT2 GT3 GT4×3 GT5 GT12 GT13

---

## FE-03 — Trang Holdings (bảng 13 cột)

**Ước lượng:** 4 ed · **Phụ thuộc:** FE-01, ANA-04

### 3. Yêu cầu
- **R1:** 13 cột: select · symbol · name · quantity · avg cost · last price · market value · unrealized P&L · P&L % · weight · sector · 24h% · actions
- **R2:** Sort được mọi cột
- **R3:** Filter: search symbol, sector, P&L dương/âm
- **R4:** Phân trang (20/hàng)
- **R5:** Batch action: chọn nhiều → export CSV
- **R6:** P&L > 0 xanh · < 0 đỏ · = 0 xám — **không chỉ dựa vào màu** (WCAG 1.4.1): thêm dấu +/−
- **R7:** Click row → `/stocks/:symbol`
- **R8:** Số hiển thị `font-variant-numeric: tabular-nums`
- **R9:** Export CSV có BOM UTF-8

### 4. Tiêu chí nghiệm thu
- **AC1:** Đủ 13 cột header
- **AC2:** Sort mỗi cột hoạt động, thứ tự đảo đúng
- **AC3:** Filter kết hợp (search + sector + P&L) cùng lúc
- **AC4:** Phân trang đúng tổng
- **AC5:** Batch export CSV đủ dòng đã chọn, có BOM
- **AC6:** P&L dương có dấu `+` **và** màu xanh (không chỉ màu)
- **AC7:** Bảng cuộn ngang được trên mobile
- **AC8:** axe 0 critical

### 5. Phản biện bắt buộc
- **PB1:** Kiểm tra bằng công cụ độ tương phản: màu xanh trên nền glass có ≥ 4.5:1 không? In kết quả đo.
- **PB2:** Sort theo cột số có dùng so sánh số hay so sánh chuỗi? Test với `1.000.000` vs `900.000`
- **PB3:** Batch action có gửi nhầm sang endpoint khác khi không chọn dòng nào? Test empty selection.

---

## FE-04 — Trang Activity (timeline + CSV)

**Ước lượng:** 3 ed · **Phụ thuộc:** FE-01

### 3. Yêu cầu
- **R1:** Timeline nhóm theo ngày
- **R2:** Mỗi dòng: loại (BUY/SELL/DIVIDEND) · symbol · số lượng · giá · phí · thuế · tổng
- **R3:** Expand để xem chi tiết
- **R4:** Filter: loại · khoảng ngày · symbol
- **R5:** Summary card: Total Invested · Total Fees · Dividend Income · Realized P&L
- **R6:** Export CSV BOM
- **R7:** Phân trang

### 4. Tiêu chí nghiệm thu
- **AC1:** Nhóm theo ngày đúng
- **AC2:** Expand hiện phí/thuế/tổng
- **AC3:** Filter kết hợp hoạt động
- **AC4:** 4 summary card khớp tổng bảng (kiểm tra bằng tính tay 1 case)
- **AC5:** Export đủ dòng đã filter

---

## FE-05 — Trang Analytics (performance/risk/drawdown)

**Ước lượng:** 4 ed · **Phụ thuộc:** FE-01, ANA-01..03, **D-31**

### 3. Yêu cầu
- **R1:** Chart dùng widget: `Line` (cumulative return) + `Comparison` (VN30) · `Area` (drawdown) · `Bar` (monthly return)
- **R2:** **Map giá trị vào `close`** cho cả 3 loại series
- **R3:** Period selector 1M/3M/6M/1Y/3Y/YTD/ALL
- **R4:** Benchmark selector VN30/VN100/none
- **R5:** Method selector TWR/MWR — MWR chỉ hiện khi ≥2 cash flow
- **R6:** Metric card: total return · annualized · alpha · beta · Sharpe · Sortino · volatility · max drawdown · correlation · tracking error · information ratio
- **R7:** Attribution chart theo ngành
- **R8:** Best/worst day

### 4. Tiêu chí nghiệm thu
- **AC1:** Cả 3 loại chart vẽ đúng (không đường 0)
- **AC2:** Đổi period ⇒ chart cập nhật
- **AC3:** Đổi benchmark ⇒ `Comparison` đổi
- **AC4:** MWR chỉ hiện khi ≥2 cash flow; không đủ ⇒ ẩn + lý do
- **AC5:** 11 metric card có giá trị khớp API
- **AC6:** `max_drawdown` ≤ 0
- **AC7:** axe 0 critical

### 5. Phản biện bắt buộc
- **PB1:** `Bar` series có thật sự được register không? (`SeriesRegistry.ts:309`) — đọc từ dist đã cài
- **PB2:** Đổi period có reset zoom không, hay giữ zoom cũ gây hiển thị sai?
- **PB3:** Số liệu card khớp **chính xác** API, không làm tròn khác nhau? So sánh từng card với response.

---

## FE-06 — Trang Allocation (ECharts treemap)

**Ước lượng:** 3 ed · **Phụ thuộc:** FE-01, ANA-04

### 3. Yêu cầu
- **R1:** Dùng **ECharts**, **không** dùng widget (widget không có `Treemap`/`Sunburst` — D-31)
- **R2:** 4 chế độ: Treemap · Donut · Bar · Sunburst
- **R3:** Group by: sector / market cap / exchange
- **R4:** Màu theo P&L, diverging scale
- **R5:** Tile nhỏ (<2%) gộp vào "Khác", click để tách
- **R6:** Click sector → drill xuống danh sách symbol
- **R7:** Legend tương tác
- **R8:** Bảng chi tiết bên dưới

### 4. Tiêu chí nghiệm thu
- **AC1:** Cả 4 chế độ vẽ được
- **AC2:** Tổng weight hiển thị = 100%
- **AC3:** Tile <2% gộp, click tách ra
- **AC4:** Drill-down hoạt động
- **AC5:** Legend click lọc
- **AC6:** Light mode vẫn đọc được (audit ghi heatmap hiện chỉ có dark — phải sửa)

### 5. Phản biện bắt buộc
- **PB1:** Chuyển `data-theme="light"` ⇒ còn tương phản ≥ 4.5:1 không? Đo và dán.
- **PB2:** 100 holdings thì treemap có đọc được không, hay thành 1 khối?
- **PB3:** Có chế độ nào mất màu không?

---

## FE-07 — Design token portfolio + dark/light

**Ước lượng:** 3 ed · **Phụ thuộc:** FE-01

### 3. Yêu cầu
- **R1:** Tạo `portfolio-tokens.css` dựa trên `soc.tokens.css` (không tạo hệ mới)
- **R2:** Accent: Bloomberg amber `#FFA02F`; profit `#00B96B`; loss `#F23645`; info `#22D3ee`
- **R3:** `:root[data-theme="light"]` override đầy đủ
- **R4:** **Mọi** màu tài chính qua CSS variable — 0 hex hardcode trong component portfolio
- **R5:** Thang typography 8pt (`--fs-*`, `--sp-*`)
- **R6:** `tabular-nums` cho mọi số

### 4. Tiêu chí nghiệm thu
- **AC1:** Grep hex trong `pages/portfolio/`, `components/portfolio/`, `components/broker/` ⇒ **0 hit**
- **AC2:** Đổi theme ⇒ mọi trang portfolio đổi theo, không còn màu hardcode
- **AC3:** Contrast đo được ≥ 4.5:1 ở **cả** 2 theme — dán bảng đo
- **AC4:** Tất cả số dùng `tabular-nums`

### 5. Phản biện bắt buộc
- **PB1:** Đo contrast ở light mode cho profit/loss/muted — có đạt 4.5:1 không? Màu tối trên nền sáng thường fail.
- **PB2:** Còn CSS nào dùng `--port-c0` kiểu local không gắn theme?

---

## FE-08 — i18n VI/EN parity 100%

**Ước lượng:** 3 ed · **Phụ thuộc:** FE-01

### 3. Yêu cầu
- **R1:** Namespace `portfolioWorkspace` + `brokerHub` + `paperTrading` đầy đủ VI + EN
- **R2:** **0** chuỗi tiếng Việt hardcode trong component portfolio/broker — audit ghi hiện `PortfoliosPage.tsx` có 8+ chuỗi hardcode
- **R3:** Key set VI và EN **bằng nhau** (parity 100%)
- **R4:** Số/chuỗi format theo `localeTag`, không hardcode `vi-VN`
- **R5:** Dùng `createTranslator` cho shell page

### 4. Tiêu chí nghiệm thu
- **AC1:** `npm run i18n:scan` ⇒ 0 missing
- **AC2:** `npm run hardcode:scan` ⇒ 0 hit trong thư mục portfolio/broker
- **AC3:** Script parity: `|keys(vi)| == |keys(en)|` ⇒ bằng nhau — dán output
- **AC4:** Đổi `locale` ⇒ toàn bộ UI đổi, **không** còn tiếng Việt sót lại
- **AC5:** Ngày/giá format đúng locale

### 5. Phản biện bắt buộc
- **PB1:** Đổi sang EN rồi chụp ảnh **từng trang** — còn chuỗi tiếng Việt nào không? Đây là kiểm chứng thực tế, không thay bằng script.
- **PB2:** Chuỗi nằm trong `aria-label` / `title` / `placeholder` có được scan không?

---

## Checklist đóng Wave 3

- [ ] 5 trang chạy, deep-link đúng, refresh giữ state
- [ ] Equity curve / drawdown / monthly return **vẽ đúng** (đọc giá trị từ chart, không chỉ nhìn ảnh)
- [ ] `Line`/`Area`/`Bar` map đúng field `close`
- [ ] axe 0 critical trên 5 trang; 5/5 tiêu chí WCAG thủ công
- [ ] Contrast ≥ 4.5:1 ở **cả** dark và light — có bảng đo
- [ ] 0 hex hardcode trong component portfolio
- [ ] i18n parity 100%, 0 hardcode, ảnh chụp 2 locale
- [ ] `test:components` 3 lần liên tiếp xanh (D-19)
- [ ] GT1–GT13 xanh

---

*Tiếp theo: `docs/PORTFOLIO_EXEC_SLICES_BROKER_LIVE_OPS_20260927.md` (Wave 4, 5, 6, 7)*
