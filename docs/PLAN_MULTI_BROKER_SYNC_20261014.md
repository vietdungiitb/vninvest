# Kế hoạch Quản lý Broker đa-nhà (SSI/TCBS/DNSE) + Đồng bộ danh mục

- **Ngày:** 2026-10-14 · **Trạng thái:** DRAFT — chờ Owner chốt 5 câu hỏi ở mục 6
- **Vai trò:** PM/Tech Lead · **Claim:** `multibroker-plan` (`docs/CLAIMS.md`)
- **Lessons áp dụng:** [L-002, L-006, L-V01, L-V02, L-T01, L-T02, L-V03, L-M01]
- **Phiên bản thư viện:** `vnbroker==3.7.2` (`packages/core/backend/requirements.txt:38`,
  xác minh đã cài trong `.venv` là 3.7.2). Mọi kết luận về thư viện trong tài liệu này
  được kiểm chứng trên **3.7.2 đã cài**, không phải 3.4.0 (L-V02).

## 0. Đính chính so với bản trình bày trước (2026-10-14, plan mode)

| # | Bản trước viết | Sự thật đã kiểm chứng lại |
|---|---|---|
| 1 | vnbroker đang ghim 3.4.0 (`requirements.txt:29-30` SHA `1ff04e6`) | **Sai thời điểm.** Hiện tại `requirements.txt:38` là `vnbroker==3.7.2` (PyPI, không còn private GitHub dep). Đã xác minh `.venv` cài đúng 3.7.2 |
| 2 | P0-4 kiểm chứng trên tag 3.4.0 (`git show 1ff04e6:...`) | Đã kiểm chứng lại trên **3.7.2 đã cài**: `DNSEClient.get_positions` (`connector/dnse/client.py:310`), `SSIBrokerClient.get_holdings` (`broker/ssi/client.py:240`), `TCBSBrokerClient.get_holdings` (`broker/tcbs/client.py:409`) — **cả 3 lane đều có API đọc vị thế**. Kết luận giữ nguyên, bằng chứng đã đổi sang đúng version |
| 3 | "Không provider nào có API watchlist" (suy từ grep 3 `client.py`) | Đã nghiên cứu sâu 4 nguồn (mục 5 + `docs/RESEARCH_WATCHLIST_BROKER_20261014.md`): **đúng**, và phát hiện thêm TCBS ligo `watchlist/preview` là **screener công khai, không phải watchlist user** |

## 1. Audit hiện trạng (AS-IS) — đọc code thật, kèm `file:line`

### 1.1 Chuỗi liên kết hiện tại (đứt 2 chỗ)

```
UserBrokerConfig (models.py:519)  ← credential 1 dòng/(tenant,user,provider,label)
        ✗ KHÔNG FK xuống SubAccount · ✗ KHÔNG FK tới Portfolio
SubAccount (models.py:395)
   portfolio FK nullable (dòng 421)
   broker        = CharField(50) chuỗi tự do (dòng 429)
   broker_source = CharField(50) chuỗi tự do (dòng 443)
   sync_status   = JSONField, không lịch sử (dòng 444)
Portfolio (models.py:22) — KHÔNG có field broker/provider nào
```

### 1.2 Năm phát hiện P0

| # | Phát hiện | Bằng chứng | Tác động |
|---|---|---|---|
| P0-1 | Đồng bộ gán mọi tiểu khoản vào danh mục đầu tiên tùy ý | `tasks.py:161` `Portfolio.objects.filter(user_id, tenant).first()` → `defaults={"portfolio": portfolio}` (`:193`) | Mọi tiểu khoản DNSE đổ vào 1 danh mục; user không có đường chọn khác |
| P0-2 | Chỉ 1 credential / broker / tenant | `models.py:604-607` `UniqueConstraint(['tenant','user','provider','label'])` | Không quản lý được nhiều tiểu khoản cùng provider |
| P0-3 | Vị thế KHÔNG BAO GIỜ đồng bộ từ broker | `PositionSnapshot.objects` chỉ xuất hiện trong test + seed; `DnseBrokerAdapter.get_positions` raise (`broker/adapters.py:361-363`) | Holdings suy toán từ `LedgerEntry` (`portfolio_analytics_views.py:261`), sai khi có giao dịch ngoài hệ thống |
| P0-4 | Cả 3 lane ĐÃ CÓ API đọc vị thế ở 3.7.2 nhưng vninvest không nối | `connector/dnse/client.py:310` `get_positions`; `broker/ssi/client.py:240` `get_holdings`; `broker/tcbs/client.py:409` `get_holdings` (3.7.2 đã cài) | Lỗ hổng tích hợp của vninvest, không phải giới hạn thư viện ⇒ **không cần nâng vnbroker** cho read-only đa-broker |
| P0-5 | Sync chạy đồng bộ trong HTTP request + phá envelope | `views_dnse.py:515` gọi trực tiếp không `.delay()`; nhánh lỗi trả `Response` thô (`:510-513`, `:525-528`), vi phạm ADR-003 | Treo request theo độ trễ broker |

### 1.3 Ba mâu thuẫn tài liệu ↔ code

| # | Tài liệu nói | Code thật |
|---|---|---|
| C-1 | SSI/TCBS `verified_contract: False` (`broker/base.py:55,65`) | `views_broker.py:38` hardcode `FULLY_SUPPORTED = frozenset({'dnse','ssi','tcbs'})`, không dùng `is_fully_supported()` (`broker/base.py:78`) ⇒ UI báo "hỗ trợ đầy đủ" sai |
| C-2 | 409 "hãy ẩn danh mục" (`views.py:230-233`) | `Portfolio` **không có** `is_archived` |
| C-3 | `PortfolioSyncView` import ở `urls.py:14` | Không có `path()` nào trỏ tới; bản thân nó cũng chỉ là stub `{'status': 'sync_queued'}` (`portfolio_analytics_views.py:740`) |

### 1.4 Trùng lặp kiến trúc

`vnbroker` 3.7.2 đã có `broker/base.py::BaseBrokerClient` + `broker/registry.py::BrokerRegistry`
(`register/get/create`). vninvest duy trì tầng song song `user_workspace/broker/adapters.py`
(637 dòng) — giữ làm **anti-corruption layer** (có egress allowlist, capability matrix,
idempotency mà thư viện không có), ghi rõ vào ADR để không ai "dọn nhầm".

## 2. Kiến trúc mục tiêu (TO-BE)

### QĐ-1 — Tiểu khoản broker là đơn vị nguyên tử của mọi dữ liệu tài chính

`Transaction`, `LedgerEntry`, `PositionSnapshot`, `AccountSnapshot` **bắt buộc** mang
`broker_account` FK. Không ngoại lệ. "Không trộn lẫn" do cấu trúc DB bảo chứng.

### QĐ-2 — Đồng bộ theo vị thế (position-first)

Vị thế broker là nguồn sự thật (`PositionSnapshot.source='broker'`). Ledger giữ dòng tiền +
cost-basis + lịch sử. Đối soát dùng để **phát hiện lệch**, không để **suy ra** vị thế.

### QĐ-3 — Danh mục là ranh giới cô lập + lớp tổng hợp

`Portfolio.kind` ∈ `manual` | `broker_backed` | `aggregate` + bảng `PortfolioBrokerBinding`
(portfolio, sub_account, role, is_default). Danh mục `aggregate` **chỉ đọc**.

### Lược đồ quan hệ mới

```
UserBrokerConfig (giữ nguyên) ──1:N── SubAccount (+broker_config FK, +provider,
                                                 UNIQUE(tenant, broker_config, external_id))
                                                     │ 1:N
        ┌──────────────┬─────────────┴─────────┬──────────────────┐
  Transaction      LedgerEntry        PositionSnapshot      AccountSnapshot
  +broker_account  +broker_account    +broker_account       +broker_account
                                     UNIQUE(portfolio, broker_account, symbol, as_of)

PortfolioBrokerBinding (MỚI) · BrokerSyncRun + BrokerSyncIssue (MỚI)
Watchlist +source(manual|broker|derived) +provider +broker_account? (mục 5)
```

## 3. Hợp đồng API mới (tất cả envelope theo ADR-003)

```
GET  /broker/accounts/                    tiểu khoản đã liên kết + provider/label/status
POST /broker/accounts/sync-accounts/      202 + job_id
GET  /broker/accounts/<id>/positions/     vị thế nguồn thật từ broker
GET  /broker/accounts/<id>/orders/        sổ lệnh
GET  /broker/accounts/<id>/balance/       số dư + NAV + sức mua
POST /broker/accounts/<id>/sync/          202, đồng bộ 1 tiểu khoản
GET  /broker/sync-runs/  ·  GET /broker/sync-issues/  ·  GET /broker/capabilities/
PATCH /portfolios/<id>/broker-bindings/   gộp/tách tiểu khoản (explicit, confirm 2 bước)
```

## 4. Lộ trình Wave (tổng ~34 công ngày)

- **Wave 0 — Nền & sửa sai lệch (P0, ~6 ngày, 1 agent, LÀM ĐẦU TIÊN).**
  B0.1 SubAccount +broker_config FK/+provider/unique · B0.2 Portfolio +kind/+is_archived +
  PortfolioBrokerBinding + Watchlist +source/+provider/+broker_account? (schema-only, khong
  data migration; serializer/API de B1.6; KHONG doi 409 `suggested_action: rename` —
  audit B0.2 2026-10-15) · B0.3 +broker_account (nullable, expand) 4 bảng tài chính + trigger
  tenant guard · B0.4 BrokerSyncRun/Issue · B0.5 `.delay()` 3 view sync + envelope + route/xoá
  PortfolioSyncView · B0.6 `/broker/capabilities/` + dùng `is_fully_supported()`.
  Cổng: `makemigrations --check` exit 0 · 1 leaf · BE test Postgres xanh.
- **Wave 1 — Sync engine đa provider (P0, ~9 ngày, 2 agent).**
  B1.1 BrokerSyncService + registry 3 lane · B1.2 nối `get_positions`/`get_holdings` cả 3 lane
  (P0-4) · B1.3 position-first sync idempotent (chạy 2 lần ⇒ 0 row trùng) · B1.4 beat +
  quiet-hours + kill-switch + backoff · B1.5 drift detection → BrokerSyncIssue · B1.6 7 endpoint
  + contract test ≥ 12 BE.
- **Wave 2 — Broker Hub UI (P0/P1, ~9 ngày, 2 agent).**
  B2.1 `/broker`: 3 tile multi-account + badge capability · B2.2 connect schema-driven 3 lane ·
  B2.3 Account Manager 4 tab (Vị thế/Sổ lệnh/Khớp lệnh/Số dư), mọi dòng có badge provider +
  tiểu khoản · B2.4 Sync Center · B2.5 chiều "nguồn" trong holdings workspace · B2.6 hợp nhất
  2 bề mặt broker về `/broker` · B2.7 i18n VI/EN (`i18n:scan` 0 thiếu).
- **Wave 3 — Cô lập & gộp danh mục (P1, ~5 ngày).**
  B3.1 UI bind/gộp explicit + confirm · B3.2 `aggregate` chỉ đọc · B3.3 Watchlist scoped
  (chi tiết mục 5) · B3.4 migration contract NULL → NOT NULL khi backfill sạch.
- **Wave 4 — SOC Broker Ops (P1, ~5 ngày).** Health lane · queue depth · top lỗi · credential
  expiry · UI kill-switch · audit viewer + CSV.

**Ngoài phạm vi:** đặt lệnh tiền thật SSI/TCBS (`trade: False` cả 3 lane) — ticket riêng
~12–15 ngày, cần duyệt phạm vi tiền thật + hạn mức gói.

## 5. Watchlist — kết luận nghiên cứu (chi tiết: `docs/RESEARCH_WATCHLIST_BROKER_20261014.md`)

| Provider | API watchlist user? | Nguồn kiểm chứng |
|---|---|---|
| DNSE | **KHÔNG** — Trading API chỉ có: auth, tài khoản/tiểu khoản/tiền, gói vay, sức mua, đặt/sổ/huỷ lệnh, deal nắm giữ, chốt lời/cắt lỗ, lệnh điều kiện | `hdsd.dnse.com.vn/.../ii.-trading-api.md` (fetch thật, 30+ endpoint, 0 watchlist) + `connector/dnse/client.py` 3.7.2 (0 method watchlist) |
| SSI | **KHÔNG** — watchlist chỉ tồn tại ở UI iBoard (tạo/sửa/xoá trong app), FastConnect API không expose | `guide.ssi.com.vn/.../api-specs` (AccessToken/OrderBook/orderHistory/cashAcctBal/stockPosition/...) + `broker/ssi/client.py:179-729` 3.7.2 |
| TCBS | **KHÔNG** — iFlash (2 file Owner cung cấp: 50 path + 53 request) 0 watchlist; ligo `watchlist/preview` là **screener công khai** (`tcbsID: None`, không cần auth) | `openapi-v1.0.0.json` (thật ra là **TCBS iFlash**, không phải DNSE) + postman collection + `explorer/tcbs/listing.py:1-57` |

**Trả lời 2 câu hỏi của Owner:**

1. *Có watchlist không?* — Đồng bộ 2 chiều watchlist user ↔ broker: **KHÔNG THỂ** với API
   hiện tại của cả 3 nhà. Không phải thiếu code vnbroker mà là **provider không mở API**.
2. *Có tự động được không?* — Có, theo 2 cơ chế không cần provider mở thêm gì:
   **(a) watchlist dẫn xuất** — tự sinh từ vị thế broker (`get_positions`/`get_holdings` đã có
   ở 3.7.2); **(b) watchlist thủ công có phạm vi** — gắn 1 watchlist với 1 tiểu khoản cụ thể,
   lưu ở DB vninvest, không đẩy ngược lên broker.
3. *Yêu cầu vnbroker làm gì?* — Cho Wave 1–3: **không cần gì thêm** (đủ API đọc).
   Nếu muốn đồng bộ thật trong tương lai: (i) chuẩn hoá `WatchlistCapability =
   unsupported` trong registry để mọi lane khai báo trung thực; (ii) reverse-engineer
   private web API (iBoard/EntradeX/iCub) — rủi ro ToS + vỡ khi provider đổi web, **không
   khuyến nghị**; (iii) đường chính thống: đề xuất provider mở API (SSI/TCBS/DNSE đều chưa có).

## 6. Năm câu hỏi cần Owner chốt (chặn thiết kế)

1. ~~QĐ-A / QĐ-B / QĐ-C~~ — **ĐÃ CHỐT 2026-10-14: QĐ-C**, ghi tại
   `docs/adr/ADR-005-danh-muc-tuong-minh-theo-nguon.md`. Danh mục phải tường minh theo
   nguồn; danh mục thủ công không liên quan gì đến broker.
2. ~~Đặt lệnh tiền thật?~~ — **ĐÃ CHỐT 2026-10-14: READ-ONLY MỘT CHIỀU, không mở lệnh
   tiền thật.** Chỉ lấy thông tin 1 chiều từ broker (danh mục/vị thế, watchlist dẫn xuất).
   Lệnh DNSE live đang chạy giữ nguyên, không mở rộng sang SSI/TCBS. Pha trade tách ticket
   riêng sau này.
3. ~~Watchlist 2 chiều?~~ — **ĐÃ RÕ theo quyết định read-only 2026-10-14:**
   watchlist một chiều từ broker = **tự sinh từ vị thế** (cơ chế a) + watchlist thủ công
   có phạm vi tiểu khoản (cơ chế b). Không mở ticket đồng bộ 2 chiều (broker không có API).
4. ~~Backfill DNSE?~~ — **CHỐT theo khuyến nghị agent 2026-10-14:** backfill về danh mục
   `broker_backed` **riêng theo provider** (`"DNSE — <số tiểu khoản>"`), đúng tinh thần QĐ-C.
   Danh mục cũ đang chứa dữ liệu DNSE được giữ nguyên + gắn nhãn `manual`, không ghi thêm;
   user tự gộp thủ công qua binding nếu muốn (có confirm). Không giữ hành vi cũ (đổ chung).
5. ~~Migration?~~ — **CHỐT theo khuyến nghị agent 2026-10-14:** Wave 0 **được** tạo migration
   (B0.1–B0.4 bắt buộc cần). Điều kiện: Wave 0 **1 agent duy nhất** (tránh leaf conflict);
   số migration do `makemigrations` sinh sau rebase lên `dev`, không tự đặt (L-M01/M02);
   `makemigrations --check` exit 0 + 1 leaf là cổng Wave 0.

## 7. Bộ file sẽ tạo tiếp (sau khi Owner duyệt)

```
docs/system-design/06-DATA-ARCHITECTURE/06.03-mo-hinh-danh-muc-broker.md
docs/system-design/07-API-SPEC/07.04-hop-dong-broker-sync.md
docs/system-design/04-FUNCTIONAL-SPEC/04.02-trung-tam-mo-gioi.md
docs/adr/ADR-005-tai-khoan-broker-la-don-vi-nguyen-tu.md
```

## 8. Bổ sung 2026-10-14 (sau khi chốt QĐ-C)

- **ADR-005 đã tạo** (tên file chốt: `docs/adr/ADR-005-danh-muc-tuong-minh-theo-nguon.md`).
- **TCBS ở 3.7.2:** `get_orders` (trong ngày) + `get_executions` (đã khớp) thật, nhưng
  `get_order_history` (nhiều ngày) **RAISE** do Owner vnbroker chủ động gỡ
  (`broker/tcbs/equity.py:50-58` `_REMOVED_PATHS` — path không có trong 2 tài liệu TCBS
  chính thức). ⇒ Đối soát TCBS chỉ trong ngày + khớp lệnh. Yêu cầu vnbroker: R-V1
  (`capabilities()` theo lane), R-V2 (khôi phục `get_order_history` chỉ khi probe sống),
  R-V3 (Wave 1–3 không cần gì thêm). Chi tiết:
  `docs/RESEARCH_WATCHLIST_BROKER_20261014.md` mục 6.

- **Chốt read-only 2026-10-14 (câu 2+3):** không mở lệnh tiền thật; chỉ lấy 1 chiều từ
  broker. Toàn bộ Wave 1–3 là read-only; pha trade tách riêng. Watchlist = dẫn xuất từ
  vị thế + thủ công có phạm vi, không đồng bộ 2 chiều.
- **SSOT broker 2026-10-14 (ADR-006):** mọi vấn đề broker qua vnbroker, không tự phát
  triển. Thiếu chức năng ⇒ văn bản yêu cầu `docs/REQUESTS_TO_VNBROKER_20261014.md`
  (REQ-001..005). Code broker hiện có trong vninvest được miễn trừ, không mở rộng.
- **Không chờ vnbroker 2026-10-14:** 0/5 REQ chặn Wave 0–3 (bảng dưới). Khởi động Wave 0
  ngay, song song chờ vnbroker; mỗi REQ xong ⇒ 1 ticket adopt nhỏ.

  | REQ | Wave cần | Chặn? | Đường làm ngay |
  |---|---|---|---|
  | 001 `capabilities()` | B0.6 | Không | Dùng matrix có sẵn `broker/base.py:37-81`, map sang vnbroker khi có |
  | 002 TCBS history | B1.3/B1.5 | Không | TCBS đối soát = lệnh trong ngày + đã khớp (đã đủ); ghi giới hạn vào capability |
  | 003 watchlist | B3.3 | Không | Dẫn xuất từ vị thế + thủ công có phạm vi, không cần API broker |
  | 004 `market_type` docs | B1.2 | Không | Giữ retry ALL/STOCK/EQUITY hiện có (`vnbroker_dnse_compat.py:113`) |
  | 005 hút compat | — (nợ) | Không | Giữ nguyên compat đến khi vnbroker cung cấp |

## 9. Phản hồi vnbroker + điều chỉnh holdings/watchlist (2026-10-14)

- **Quyết định Owner (phiên này):** đồng bộ tường minh **holdings của broker** và
  **watchlist thủ công** của người dùng — 2 nhóm tách bạch, không trộn lẫn
  (chi tiết: `docs/adr/ADR-007-holdings-tach-bach-watchlist-thu-cong.md`).
- **Đã nhận phản hồi chính thức:** `vnbroker/docs/RESPONSE_TO_VNINVEST_20261014.md`
  (commit `f6cf68b`, nhánh `feat/vninvest-req-20261014` **chưa merge**, CHANGELOG
  `Unreleased`).

  | REQ | Kết quả vnbroker | Ảnh hưởng vninvest |
  |---|---|---|
  | 001 | **Đã làm** (`broker/capabilities.py`, class-level, JSON-serialisable) + sửa 3 lỗi AC (registry chỉ 2 lane; DNSE bắt buộc credential; base class chỉ 4 method) | B0.6 đọc `capabilities()`; nhớ `dnse.registered == False` |
  | 002 | **Văn bản, không code** (path không có trong spec; `get_executions` 0 query param; SSI/DNSE đã có history) | TCBS đối soát lịch sử ≥ 30 ngày **không làm được** — giữ giới hạn in-day + executions |
  | 003a | **Đã làm** (watchlist `unsupported` + contract test quét `dir()`) | UI đọc capability, không hứa sai |
  | 003b | **Chưa làm — không có gì để gọi** (+ cảnh báo trùng tên `get_watchlist` ligo) | Không ticket CRUD; giữ R-W3 đường provider |
  | 004 | **Đã làm, mở rộng** (`MARKET_TYPES={STOCK,DERIVATIVE}` + `ORDER_CATEGORIES`, choke point, 15 method) | `ALL`/`EQUITY` giờ **ném lỗi** — bỏ retry mù khi adopt |
  | 005 | **Đã làm, thu hẹp** (`normalize_payload` + `get_*_all_markets`; 12 method `Trade` còn nợ) | Xoá compat trong Wave 1 theo §5 văn bản |
  | F-01 | **Đã sửa** (`__version__` = 3.7.2, gate so pyproject vs dist metadata) | Hết chặn version cho REQ-001 |

- **Đã kiểm chứng độc lập (L-V02, không tin văn bản):** chạy trên nhánh
  `feat/vninvest-req-20261014` @ `f6cf68b`, không credential, không mạng —
  **26 passed** (`test_capability_contract.py` + `test_tcbs_order_history_contract.py`)
  + probe `capabilities('tcbs'/'dnse')` khớp văn bản (version 3.7.2,
  `order_history.supported == False`, `watchlist.supported == False`,
  `dnse.registered == False`).
- **Gate 3.8.0 (bắt buộc):** chỉ tích hợp API mới **sau khi vnbroker merge + bump
  3.8.0**. Lý do: `marketType` sai giờ ném `DNSEValidationError` (breaking) —
  code cũ retry `("ALL","STOCK","EQUITY")` sẽ nổ ở `"ALL"`; `requirements.txt`
  vẫn ghim `3.7.2` cho đến lúc đó.
- **P0 đã biết phía vninvest (vnbroker đo bằng chạy code, §5 văn bản):**
  (1) `fetch_account_balance` luôn trả 0 (DataFrame rơi vào `else: data = {}`) —
  sync số dư DNSE đang ghi NAV 0; (2) vòng retry là code chết (`break` ngay lần đầu).
  Sửa trong Wave 1 khi adopt 3.8.0 (xoá compat + test balance ≠ 0), không hotfix
  compat theo ADR-006.
- **B0.2 mở rộng:** thêm `Watchlist` +`source` (`manual`/`derived`) +`provider`
  +`broker_account`? cùng migration với `Portfolio.kind` (cảnh báo vnbroker: thiếu
  `source` trước dữ liệu dẫn xuất đầu tiên ⇒ phải viết script sửa dữ liệu cũ).
  `provider_watchlist_id` để sau.
