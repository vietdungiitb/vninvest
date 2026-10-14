# Nghiên cứu: Watchlist broker (SSI/TCBS/DNSE) — có API không? có tự động được không?

- **Ngày:** 2026-10-14 · **Trạng thái:** HOÀN TẤT NGHIÊN CỨU (4/4 nguồn đã đọc)
- **Claim:** `multibroker-plan` · **Lessons áp dụng:** [L-V02, L-T02, L-006]
- **Thư viện đối chiếu:** `vnbroker==3.7.2` đã cài trong `.venv`
  (`C:\Mujoco Projects\vninvest\.venv\Lib\site-packages\vnbroker`)

## 0. Kết luận trước (đọc 6 dòng)

1. **Đồng bộ 2 chiều watchlist user ↔ broker: KHÔNG THỂ** — cả 3 provider đều không mở API.
2. Đây là **giới hạn của provider, không phải thiếu code vnbroker**.
3. TCBS ligo `watchlist/preview` là **screener công khai** (`tcbsID: None`, không cần auth),
   không phải watchlist của user — dùng sai sẽ trộn danh sách thị trường vào theo dõi cá nhân.
4. SSI có watchlist nhưng **chỉ ở UI iBoard** (tạo/sửa/xoá trong app), FastConnect API không expose.
5. DNSE Trading API (30+ endpoint đã liệt kê) **không có** endpoint watchlist/favorite nào.
6. **Tự động hoá khả thi mà không cần provider mở thêm gì:** (a) watchlist dẫn xuất từ vị thế
   broker; (b) watchlist thủ công gắn phạm vi 1 tiểu khoản. Cả hai làm ở tầng vninvest.

## 1. Nguồn 1 — `openapi-v1.0.0.json` (Owner ghi "DNSE", nội dung thật là TCBS)

> L-T02: mở đúng file, trích nguyên văn. Kiểm chứng:
> `info.title` = **"TCBS iFlash Open API"**, `info.version` = **"1.0.0"**,
> `servers.url` = **"https://openapi.tcbs.com.vn"**.

Danh sách path (đếm thật, 0 path watchlist/favorite):

| Nhóm | Path tiêu biểu |
|---|---|
| Auth | `/gaia/v1/oauth2/openapi/apikey/extend`, `/apikey/info`, `/token` |
| Tài khoản | `/khronos/v1/account/status`, `/khronos/v1/account/portfolio/status`, `/khronos/v1/account/portfolio/position/close` |
| Lệnh | `/khronos/v1/order/place|/cancel|/change`, `/khronos/v1/order/condition/place|/cancel|/detail`, `/khronos/v2/order/condition/change`, `/khronos/v1/order/in-day` |
| Tiền | `/khronos/v1/cash/deposit/update`, `/khronos/v1/cash/withdraw/update`, `/physis/v1/stock/transfer` |
| Thị trường | `/nyx/v2/stock/bars|/bars-long-term`, `/nyx/v1/intraday/{ticker}/his/paging|/bsa|/bsa-ext|/bsa-month`, `/tartarus/v1/tickerSnaps|/tickerCommons|/putThroughSnaps|/derivatives` |
| Khác | `/aion/...` (ppse, cashInvestments, matching-details, orders), `/khaos/v1/loan`, `/hydros/v1/account/.../pricing-policy|/risk`, `/ananke/v1/securities`, `/erebos/v2/...` (cashStatements, margin-info), margin subscription, `/api/v1/derivatives/contracts` |

**Verdict nguồn 1:** TCBS iFlash Open API v1.0.0 **không có** endpoint watchlist/favorite.
Grep `watchlist|favorite` trên toàn file: **0 match ở path** (xác minh bằng liệt kê path).

## 2. Nguồn 2 — `tcbs-openapi-v1.0.0.postman_collection.json` (53 request, 7 folder)

`info.name` = "TCBS iFlash Open API v1.0.0". Liệt kê toàn bộ request name:

- Stock - Orders (11): Sub account information · Supplementary loan package · OHLCV bars
  (long-term/intraday) · Cash statement · Debt lookup · Loan list · Price matching history ·
  Daily/Intraday-15m/Monthly supply & demand
- Authentication (3): Extend API Key · Get API Key expiration · Exchange API Key for JWT
- Derivative - Orders (13) · Derivative - Market (2) · Money (3) · Account (14) ·
  Stock - Market Data (4)

**Verdict nguồn 2:** **0/53 request** liên quan watchlist/favorite.

## 3. Nguồn 3 — `developers.dnse.com.vn/docs/dnse/account` (fetch trực tiếp THẤT BẠI)

`webfetch` 3 lần đều `Transport error`. Ghi trung thực theo L-006: **CHƯA ĐỌC ĐƯỢC trang này**.

Thay thế bằng nguồn tương đương đã đọc thành công: `hdsd.dnse.com.vn/.../ii.-trading-api.md`
(fetch markdown thành công, toàn bộ mục lục Trading API, 30+ endpoint):

1. Giới thiệu · 2. Đăng nhập/xác thực (login + OTP) · 3. Tài khoản/tiểu khoản/tiền ·
2. Cơ sở: gói vay, sức mua/bán, đặt lệnh, sổ lệnh, chi tiết lệnh, huỷ lệnh,
   **danh sách deal nắm giữ (4.6)** · 5. Phái sinh (tương tự + chốt lời/cắt lỗ theo
   deal/account, đóng deal) · 6. Lệnh điều kiện (đặt/sổ/chi tiết/huỷ).

**Verdict nguồn 3:** DNSE Trading API **không có** watchlist/favorite. Endpoint gần nhất với
"nắm giữ" là **4.6 Danh sách deal nắm giữ** — ánh xạ đúng tới `DNSEClient.get_positions`
(`connector/dnse/client.py:310`, 3.7.2). Đối chiếu chéo: toàn bộ method DNSE trong
`connector/dnse/client.py` 3.7.2 (accounts, balances, loan_packages, ppse, orders,
order_detail, execution_detail, order_history, positions, position_by_id,
security_definition, ohlc, quotes, ...) — **0 method watchlist**.

## 4. Nguồn 4 — vnbroker 3.7.2 đã cài + tài liệu SSI công khai

### 4.1 Grep toàn package 3.7.2: `watchlist|watch_list|favorite|favourite`

Chỉ trúng 3 file, **không file nào là broker-account watchlist**:

| Vị trí 3.7.2 | Nội dung nguyên văn | Bản chất |
|---|---|---|
| `explorer/tcbs/listing.py:4-6` | "Sử dụng TCBS ligo watchlist preview API để truy xuất danh sách mã chứng khoán. API: POST _BASE_URL/ligo/v1/watchlist/preview" | Screener công khai |
| `explorer/tcbs/listing.py:47-56` | "Sử dụng TCBS ligo API **(screener)** để lấy danh sách cổ phiếu theo sàn/nhóm" + `auth_token: JWT token (**không bắt buộc** cho listing công khai)` | Không auth ⇒ không gắn user ⇒ không phải watchlist cá nhân |
| `explorer/tcbs/tcbs_compatibility.py:296-308` | `def get_watchlist(self, filters: List[dict], ...)` với payload `{"tcbsID": None, "filters": filters, "size": size}`, trả `searchData.pageContent` | `tcbsID: None` = không user; `filters` = điều kiện lọc ⇒ screener |
| `api/screener.py:64` | cùng URL ligo `watchlist/preview` | Dùng cho screener |

### 4.2 SSI FastConnect (`guide.ssi.com.vn/.../api-specs`, search excerpt)

Endpoint: AccessToken, GetOTP, auditOrderBook, OrderBook, orderHistory, cashAcctBal,
**stockPosition**, derivAcctBal, derivPosition, rateLimit, cashInAdvance... — **không có
watchlist**. Watchlist SSI chỉ tồn tại ở **iBoard Web/App** (user guide: tạo/đổi tên/xoá
watchlist trong giao diện, vd `ssi.com.vn/en/individual-customer/watchlist-iboard-web`).

### 4.3 Ma trận khả năng watchlist (tổng hợp 4 nguồn)

| Khả năng | DNSE | SSI | TCBS |
|---|---|---|---|
| Đọc watchlist user qua API | ❌ | ❌ | ❌ |
| Ghi/sửa watchlist user qua API | ❌ | ❌ | ❌ |
| Watchlist tồn tại ở app broker | ❌ (không công bố) | ✅ iBoard UI (không API) | ❌ (ligo là screener công khai) |
| Vị thế → suy ra "đang theo dõi" | ✅ `get_positions` | ✅ `get_holdings` | ✅ `get_holdings` |

## 5. Trả lời Owner

**Q1 — Có watchlist không?** Không, ở nghĩa "đồng bộ danh sách theo dõi của user với broker".
Cả 3 nhà đều không mở API cho việc này.

**Q2 — Có tự động được không?** Có, 2 cơ chế không cần provider:

- **(a) Watchlist dẫn xuất (derived, đề xuất làm ở Wave 1):** mỗi lần sync vị thế xong, tự
  duy trì 1 watchlist hệ thống "Đang nắm giữ @ <provider>/<tiểu khoản>" = tập symbol từ
  `PositionSnapshot(source='broker')`. Giá trị: cảnh báo giá + theo dõi tự động đúng nghĩa
  "theo dõi mã đang nắm giữ". Dữ liệu đã có đủ ở 3.7.2, 0 phụ thuộc mới.
- **(b) Watchlist thủ công có phạm vi (Wave 3):** `Watchlist.source=managed` +
  `provider` + `broker_account?` nullable. Quy tắc: watchlist gắn tiểu khoản chỉ hiện trong
  ngữ cảnh broker đó; không bao giờ trộn với watchlist thủ công chung. Không đẩy ngược lên
  broker (không có API nhận).

**Q3 — Yêu cầu vnbroker phải làm gì?**

| # | Yêu cầu | Mức | Lý do |
|---|---|---|---|
| R-W1 | Khai báo trung thực `WatchlistCapability = unsupported` cho cả 3 lane trong `broker/registry.py` (kèm `verified_contract` như capability matrix hiện có) | P1 | Chặn dev tương lai "đoán" có API watchlist; UI đọc capability thì không bao giờ hứa sai |
| R-W2 | KHÔNG reverse-engineer private web API (iBoard/EntradeX web) để lấy watchlist | Quy tắc | Rủi ro ToS + vỡ lặng khi provider đổi web; không có contract test nào bắt được |
| R-W3 | Đường chính thống duy nhất: đề xuất SSI/TCBS/DNSE mở API watchlist (giống IBKR `GET /iserver/watchlist`) | P3 | IBKR đã chứng minh mẫu chuẩn: CRUD watchlist + realtime; VN chưa nhà nào có |
| R-W4 | Tái dùng có sẵn: `get_holdings`/`get_positions` 3 lane cho cơ chế (a); ligo `get_watchlist(filters)` cho gợi ý mã (screener, không phải watchlist user) | P0 | 0 việc mới ở vnbroker cho Wave 1–3 |

## 6. Phát hiện bổ sung 2026-10-14: vnbroker 3.7.2 đã CHỦ ĐỘNG GỠ method theo 2 file TCBS

`broker/tcbs/equity.py:50-58` (`_REMOVED_PATHS`, 5 path) + `broker/tcbs/account.py:315-403`
(13 method erebos) — mọi method trong danh sách gọi `_raise_removed()` thay vì gọi server.
Comment nguyên văn: gỡ "theo quyết định Owner dựa trên 2 tài liệu chính thức, CHƯA probe
server". Hai tài liệu đó chính là 2 file Owner cung cấp cho phiên này.

| Method 3.7.2 | Trạng thái thật | Ảnh hưởng vninvest |
|---|---|---|
| `get_order_history` (`equity.py:169-183`) | **RAISE** `NotImplementedError` (path `/aion/.../orders/history` không có trong 2 file) | Đối soát TCBS nhiều ngày **không làm được** — chỉ còn `get_orders` (trong ngày, `:143`) + `get_executions` (đã khớp, `:219`) |
| `get_orders`, `get_executions`, `get_holdings` (`:143`, `:219`, `:265`) | Thật (không raise) | Read path TCBS đủ cho Wave 1 |
| erebos v1/v2 (asset, balance, stock_statistic, orders_history/matching, withdraw/deposit, dividend) | **RAISE** toàn bộ | Không dùng — đã có path thay thế (`get_balance`, `get_cash_statements`) |
| stop-limit read/write erebos (4 method) | **RAISE** | Trade TCBS sau này chỉ qua order thường + condition chuẩn |
| DNSE `get_positions(account_no, market_type)` (`connector/dnse/client.py:310-320) | Thật, nhưng `market_type` **bắt buộc** (không default) | vninvest phải truyền `"STOCK"` (khớp vòng retry `ALL/STOCK/EQUITY` ở `vnbroker_dnse_compat.py:113`) |
| TCBS `place_order` cần `pin_code`, `modify_order` đổi chữ ký 2026-10-10 (`pin_code` → `request_id`, `client.py:464`) | Thật | Cảnh báo cho pha trade: phải khớp chữ ký mới |

**Yêu cầu vnbroker (trả lời câu hỏi Owner "cần hiệu chỉnh gì không"):**

| # | Yêu cầu | Mức | Lý do |
|---|---|---|---|
| R-V1 | Expose `capabilities()` theo lane (method nào thật / method nào removed) qua `broker/registry.py`, thay vì để vninvest đọc `_REMOVED_PATHS` nội bộ (private, có thể đổi) | P1 | vninvest hiện chỉ phát hiện removed bằng try/except lúc chạy — sai fail-closed |
| R-V2 | Khôi phục `get_order_history` TCBS **khi và chỉ khi** probe server chứng minh path sống (401 chạy trước routing nên không phân biệt được route có/không — ghi CHƯA XÁC MINH) | P2 | Quyết định thuộc Owner vnbroker; không khôi phục đoán mò |
| R-V3 | Cho Wave 1–3: **không cần thay đổi gì thêm** — read path 3 lane đã đủ | — | Bằng chứng ở bảng trên |

## 7. Bổ sung 2026-10-14: tiếp nhận phản hồi vnbroker + chốt tách bạch (ADR-007)

- **Khung 3 mệnh đề** (nhận từ phản hồi §2 REQ-003, dùng từ nay): (1) *tại thời điểm
  này* không provider nào có watchlist **API** (đã chứng minh); (2) SSI **có**
  watchlist trong **sản phẩm** iBoard (thiếu là API, không phải tính năng);
  (3) **không kết luận** "sẽ không bao giờ có". Cụm đúng: "tại thời điểm này".
- **Holdings không thay watchlist** (ý định khác nhau: sở hữu vs theo dõi) — gộp
  là mất khả năng theo dõi mã chưa mua. Quyết định tách bạch ghi tại
  `docs/adr/ADR-007-holdings-tach-bach-watchlist-thu-cong.md`.
- **Cảnh báo trùng tên** (phản hồi §2): `get_watchlist(filters)` ở
  `explorer/tcbs` là screener ligo công khai + fail-open `return []` — cấm dùng
  làm nguồn watchlist; CRUD tương lai phải xử lý đụng tên.
- **Đính chính sai lệch #1, #9** (phản hồi §7): trích `_REMOVED_PATHS` đúng là
  `equity.py:57-63` (bản nháp ghi `:50-58`); file nghiên cứu này tồn tại ở nhánh
  `feat/multibroker-plan-research` (chưa merge `dev`) — trích dẫn kèm nhánh.
- **R-W4 chốt theo ADR-007:** (a) watchlist dẫn xuất `source='derived'` từ
  `PositionSnapshot(source='broker')`; (b) thủ công `source='manual'`, không đẩy
  ngược. `Watchlist` thiếu `source`/`provider`/`broker_account` — bổ sung ở B0.2
  trước dữ liệu dẫn xuất đầu tiên.

## 8. Việc còn lại (CHƯA CHẠY / CHƯA ĐỌC)

- Trang `developers.dnse.com.vn/docs/dnse/account` (OpenAPI V2 mới): **CHƯA ĐỌC** (transport
  error ×3). Nếu DNSE V2 mở watchlist thì kết luận DNSE ở mục 3 phải sửa — cần Owner hoặc
  phiên sau fetch lại.
- Probe live cả 3 lane (`LiveBrokerContractTests`): **CHƯA CHẠY** (không có credential).
