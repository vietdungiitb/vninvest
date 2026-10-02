# SaaS Platform Design — Quản lý phần mềm B2B (2026-10-02)

**Trạng thái:** Thiết kế (doc-only) · **Chưa viết code**
**Quyết định đã chốt:** Phương án A — gate ở tầng SaaS, không refactor thư viện
**Phạm vi:** Kiến trúc + mô hình dữ liệu + cơ chế entitlement + rủi ro pháp lý

---

## 0. TL;DR

| Nội dung | Kết luận |
|---|---|
| Có làm SaaS bán quyền phần mềm `vninvestcharts-widget` + `vnbroker` được không | **Được** |
| Có tách thư viện `vnbroker` theo tầng không | **Không cần** — gate ở tầng SaaS rẻ hơn và ít rủi ro hơn |
| Thêm phần mềm thứ 4 sau này có dễ không | **Có, nếu** làm đúng 9 bảng dữ liệu; **không** nếu hardcode tên sản phẩm |
| `vnbroker` có làm SaaS trở thành "cửa vào chuỗi tài chính" không | **Không theo nghĩa trung gian tài chính** — tầng C không chuyển tiền, không cầm tài sản. Rủi ro còn lại là **use-based**, xử lý bằng hợp đồng |
| Blocker kỹ thuật | 1 lỗ hổng P1 trong `brokerage/` (thiếu `write_gate`) |
| Blocker pháp lý | ~~Không có~~ — `LICENSE.md` Mục 0 giải phóng chủ sở hữu. Chỉ cần văn bản cấp quyền cho khách là licensee |

---

## 1. Bối cảnh & mục tiêu

### 1.1 Yêu cầu gốc

Xây SaaS B2B cho phép khách hàng doanh nghiệp tự quản lý quyền sử dụng các phần mềm của họ, với các ràng buộc:

- Không cung cấp trực tiếp dịch vụ tài chính
- Khách tự lo dữ liệu, hạ tầng, tài khoản broker
- SaaS chỉ làm **control plane**: tenant, PAT, entitlement, license key, metering, billing, audit
- Có thể bổ sung phần mềm mới trong tương lai mà không phải viết lại hệ thống

### 1.2 Sản phẩm dự kiến ban đầu

| Mã sản phẩm | Nội dung | License | Rủi ro |
|---|---|---|---|
| `vninvestcharts` | Widget biểu đồ | MPL-2.0 | Thấp |
| `vnbroker-data` | Dữ liệu giá/listing/company/financial | Proprietary → cần commercial | Trung bình |
| `vnbroker-brokerage` | Tích hợp đặt/hủy lệnh | Proprietary → cần commercial | **Cao nhất** |

> **Quyết định quan trọng:** tách `vnbroker-data` và `vnbroker-brokerage` thành **hai sản phẩm riêng** dù cùng một repo. Lý do pháp lý — đây chính là ranh giới để áp ràng buộc pháp nhân khác nhau. Gộp chung sẽ mất đúng thứ đáng giá nhất.

---

## 2. Ba quyết định kiến trúc đã chốt

### QĐ-1: Không refactor thư viện, gate ở tầng SaaS

**Phương án A được chọn.** Ship `vnbroker` nguyên trạng, kiểm soát runtime bằng entitlement do SaaS quyết định.

| | Phương án A (gate ở SaaS) | Phương án B (refactor 3 tầng) |
|---|---|---|
| Công sửa thư viện | **0** | 8 file + tách 1 file |
| Rủi ro regression | **0** | Cần test lại `explorer/ssi` |
| **Giảm rủi ro pháp lý** | **Không** | **Không** |
| Tách bạch kiểm toán được | Không | Có |

**Lý do:** gỡ tier C khỏi thư viện không giảm rủi ro pháp lý — rủi ro nằm ở việc *có cấp entitlement hay không*, không nằm ở việc code có mặt trong gói hay không. Vì vậy chọn cái rẻ hơn và ít rủi ro hơn.

### QĐ-2: `brokerage/` là lớp brokerage đúng, không phải `broker/`

`vnbroker` hiện có **hai** implementation brokerage song song:

| | `broker/` | `brokerage/` |
|---|---|---|
| Kiểu | sync (`requests`) | async (`httpx`) |
| `write_gate` / `dry_run` | ✅ đủ cả 3 | ❌ **không có** |
| Coupling với SaaS/Gateway | ✅ có | ❌ **không** (`base.py:1-9`) |
| Được import từ ngoài | ✅ 6 module | ❌ mồ côi |

### QĐ-3: Entitlement là dữ liệu, không phải nhánh code

Backend **không bao giờ biết tên sản phẩm**. Chi tiết ở §7.

---

## 3. Bằng chứng: phân tích `vnbroker`

> Nguồn: đọc trực tiếp tại `C:\Mujoco Projects\vnbroker` (v3.4.0)
> Mọi khẳng định dưới đây đã verify bằng grep/read thực tế.

### 3.1 Credential do khách cung cấp — SaaS không chạm vào

`broker/security/credentials.py:48` `from_env()` đọc từ biến môi trường của chính khách:

- TCBS: `:65-67` `VNBROKER_BROKER_TCBS_API_KEY` → `VNBROKER_TCBS_OPENAPI_API_KEY` → `TCBS_OPENAPI_API_KEY` → `TCBS_API_KEY`
- SSI: `:154-155` `VNBROKER_BROKER_SSI_API_KEY` / `VNBROKER_BROKER_SSI_API_SECRET`
- `:164-165` `VNBROKER_BROKER_SSI_CLIENT_ID` / `PRIVATE_KEY`

⇒ **Không có đường để credential đi qua SaaS.** Đây là phát hiện quan trọng nhất về mặt pháp lý.

### 3.2 Tầng C không có khả năng chuyển tiền

**Mọi** write method trong toàn bộ `broker/`:

| File | Write method | Cổng chặn |
|---|---|---|
| `broker/ssi/equity.py` | `place_order:72`, `cancel_order:341` | `@write_gate` |
| `broker/ssi/client.py` | `place_order:288`, `cancel_order:370` | `@write_gate` |
| `broker/ssi/fco.py` | `place_fco_gtd/stop/stop_limit/trailing_stop/trailing_stop_limit/oco/bull_bear:105-362`, `cancel_fco:377` | qua `_gated_fco_post:364`, `_gated_fco_cancel:382` |
| `broker/tcbs/equity.py` | `place_order`, `cancel_order` | `@write_gate` |
| `broker/tcbs/client.py` | `place_order:333`, `cancel_order:380` | `@write_gate` |
| `broker/tcbs/derivatives.py` | `place_derivative_order:389`, `place_derivative_condition_order:478`, `change_derivative_order:551`, `change_derivative_condition_order:611` | qua `_gated_*:451,522,592,646` |

⇒ Toàn bộ là **đặt / hủy / sửa lệnh**. Không rút tiền, không chuyển khoản, không phân bổ, không bù trừ.

**Read-only — đã xác nhận 0 write:**

| File | Bằng chứng |
|---|---|
| `broker/ssi/money.py:6` | docstring `RULE: Read-only` — chỉ `get_balance:85`, `get_ppmmr:144`, `get_max_buy_sell:181` |
| `broker/tcbs/money.py:3,7` | `read-only cash & margin data` / `RULE: Không có write method` |
| `broker/tcbs/portfolio.py` | 0 `write_gate` |
| `broker/ssi/account.py` | 0 `write_gate` |
| `broker/tcbs/market.py`, `broker/ssi/market.py` | 0 `write_gate` |
| `broker/session.py`, `broker/base.py`, `broker/registry.py` | 0 `write_gate` |
| `broker/tcbs/account.py:586,643` | `get_erebos_v2_orders_history`, `..._matching` (đọc) |
| `broker/ssi/stream.py:659,674` | `subscribe_order_status`, `subscribe_fco_order_status` (WebSocket, không đặt lệnh) |

### 3.3 Write phải bật thủ công

`broker/security/guards.py`:
- `:24` `dry_run = kwargs.get("dry_run", True)` → mặc định **không gọi HTTP**
- `:60-69` nếu `dry_run=False` mà `session.is_write_enabled=False` → raise
- `session.enable_write()` là opt-in tường minh

⇒ Không có chuỗi tự động giao dịch (auto-trading loop) trong thư viện.

### 3.4 Hàng rào an toàn có sẵn

| File | Kích thước | Vai trò |
|---|---|---|
| `broker/security/credentials.py` | 9 487 B | Nạp credential từ env |
| `broker/security/redaction.py` | 5 465 B | Che secret trong log |
| `broker/security/audit.py` | 3 602 B | Ghi vết thao tác |
| `broker/security/idempotency.py` | 2 756 B | Chống double-submit |
| `broker/security/guards.py` | 2 711 B | Cổng chặn write |

---

## 4. Phân tích coupling — vì sao không thể tách sạch

### 4.1 Lane sạch (8 lane)

Grep `vnbroker.broker` trong các lane sau cho **0 kết quả**:

`vci` · `kbs` · `rss_cafef` · `rss_vneconomy` · `fmarket` · `misc` · `news` · `analytics` · `ui` · `bot`

⇒ Khách dùng phần mềm này **không cần tài khoản môi giới**.

### 4.2 Lane SSI — coupling cứng, nhưng chỉ ở tầng auth

`explorer/ssi/_auth.py:1-9`:
```
Shared market-data-only auth for the SSI explorer lane.
... Wraps the broker lane (SSICredentialConfig + BrokerSession + SSIHttpClient
+ SSIAuthService) without duplicating any wire logic.
```

Toàn bộ 15 import trong `explorer/ssi/`:

| File:line | Import |
|---|---|
| `_auth.py:19` | `broker.exceptions.BrokerError` |
| `_auth.py:20` | `broker.security.credentials.SSICredentialConfig` |
| `_auth.py:21` | `broker.session.BrokerSession` |
| `_auth.py:22` | `broker.ssi._transport.SSIHttpClient` |
| `_auth.py:23` | `broker.ssi.auth.SSIAuthService` |
| `_auth.py:24` | `broker.ssi.exceptions.BrokerSessionExpiredError` |
| `_auth.py:25` | `broker.ssi.market.SSIMarketService` |
| `_auth.py:145` | `broker.ssi.stream.SSIStreamManager` |
| `indices.py:15`, `listing.py:17`, `quote.py:20`, `screener.py:15`, `securities.py:15`, `trading.py:17` | `SSIMarketService` |
| `live.py:17` | `broker.ssi.stream` (MarketStatus, QuoteUpdate, TradeTick) |

Grep `broker\.(ssi|tcbs)\.(equity|fco|client|derivatives)|place_order|cancel_order` trong `explorer/ssi/` → **SẠCH, 0 hit**.

⇒ **SSI explorer lane chỉ dùng market/stream read-only. Coupling nằm ở auth plumbing, không ở khả năng trading.**

### 4.3 Ràng buộc vật lý: SSI bắt buộc cần tài khoản môi giới

SSI là ngân hàng chứng khoán. Open API của họ **là** API trading, không có public data API riêng.

`explorer/ssi/_auth.py:30-33` `_MISSING_KEY_MESSAGE` yêu cầu `VNBROKER_BROKER_SSI_API_KEY` / `VNBROKER_BROKER_SSI_API_SECRET`.

⇒ **Không thể bán "dữ liệu SSI" như sản phẩm độc lập không cần broker.** Đây là ràng buộc của nhà cung cấp, không phải lựa chọn kiến trúc.

### 4.4 Coupling ngoài `explorer/`

| File:line | Import | Bản chất |
|---|---|---|
| `core/unified_registry.py:16` | `broker.registry.BrokerRegistry` | docstring: *"Unified registry combining ProviderRegistry and BrokerRegistry"* |
| `common/client.py:278` | `import vnbroker.broker  # ensures register-once` | `:281` `UnifiedRegistry.get_broker(provider)` |
| `api/broker.py:69` | `broker.tcbs.client.TCBSBrokerClient` | lazy import |
| `api/broker.py:73` | `broker.registry.BrokerRegistry` | lazy import |
| `connector/trade.py:63` | `broker.exceptions.BrokerPermissionError` | chỉ exception |
| `connector/websocket.py:96` | `broker.security.redaction.Redactor` | chỉ redaction |

Chiều ngược lại: chỉ **1** import từ `broker/` sang `core/` — `tcbs/money.py:24` `from vnbroker.core.utils.parser import camel_to_snake`.

⇒ Coupling là **một chiều B → C**.

### 4.5 Ghi nhận: `common/client.py:274`

```
>>> ssi.authenticate()  # market-data-only, không OTP
```

⇒ Chính tác giả `vnbroker` đã xác nhận SSI hỗ trợ chế độ chỉ đọc, không cần OTP.

---

## 5. Phát hiện mới: `brokerage/` đã tách sẵn khỏi SaaS

`brokerage/base.py:1-9`:
```
Brokerage Base Module

Abstract base classes for direct broker API access (Private Brokerage).
These classes bypass Gateway/PAT entirely and connect directly to broker APIs.

Security: Credentials (API Key, Secret, OTP, PIN) never leave this module.
No GatewayHttpClient, no PAT, no vninvest SaaS dependency.
```

⇒ **Tác giả `vnbroker` đã thiết kế sẵn lớp brokerage không phụ thuộc SaaS.** Đây là nền tảng đúng cho mô hình của bạn.

### 5.1 Cấu trúc `brokerage/`

| File | Kích thước | Ghi chú |
|---|---|---|
| `base.py` | 10 346 B | ABC + dataclass + enum |
| `tcbs/client.py` | 17 965 B | implementation TCBS |
| — | — | **Không có `__init__.py`** |

### 5.2 API surface của `BrokerageBase` (`base.py:125`)

| Nhóm | Symbol:line |
|---|---|
| Enum | `OrderSide:19`, `OrderType:24`, `OrderStatus:32`, `TimeInForce:41` |
| DTO | `OrderRequest:49`, `OrderResponse:61`, `Balance:77`, `Position:89`, `MarginInfo:102`, `TickData:112` |
| Read | `get_balance:256`, `get_positions:261`, `get_orders:266`, `get_margin_info:271`, `get_intraday:294` |
| **Write** | **`place_order:278`**, **`cancel_order:283`**, **`modify_order:288`** |
| Stream | `intratick_stream:301` (async generator) |
| Hạ tầng | `_request:203`, `_async_request:221`, `_sign_request:186`, `_handle_otp_challenge:194` |

### 5.3 Trạng thái: mồ côi

Grep `vnbroker.brokerage|from .brokerage|from ..brokerage` trong toàn repo → chỉ `brokerage/tcbs/client.py:20`.

⇒ **Không module nào bên ngoài import `brokerage/`.** Đây là lý do coupling §4 không thấy nó.

---

## 6. Rủi ro pháp lý

### 6.1 Đánh giá đúng

| Rủi ro | Mức | Cơ sở |
|---|---|---|
| SaaS trở thành công ty chứng khoán / môi giới | **Rất thấp** | Không nắm tài khoản, không nhận tiền, không đặt lệnh, không tư vấn. Credential ở env khách |
| Rò rỉ broker credential qua SaaS | **Không xảy ra** | `credentials.py:48` chỉ đọc env khách |
| SaaS có thể thực hiện giao dịch thay khách | **Không** | `guards.py:24` `dry_run=True` mặc định + `:60-69` cần `enable_write()` |
| **Use-based risk** — khách dùng entitlement sai mục đích | **Cao** | Bạn cấp entitlement có khả năng đặt lệnh, dù bạn không viết dòng `place_order` nào |
| **Áp lực dây chuyền** trong hợp đồng B2B dài hạn | **Cao** | Khách sẽ yêu cầu theo dõi lệnh → tự động đóng lệnh → bạn bị kéo vào vận hành |
| Định vị thương hiệu sai | **Trung bình** | Tên gọi chứa "broker"/"trade"/"sàn" dễ bị hiểu là sàn giao dịch |

### 6.2 Chi phí thật của phương án có tier C

| Hạng mục | Chỉ data | Có brokerage |
|---|---|---|
| Model DB | 8 | 9 (`+BrokerageEntitlement`) |
| Code SaaS | ~25 900 LOC | ~25 950 LOC (**+50**) |
| **Tổng chi phí kỹ thuật** | — | **≈1 ngày công** |
| Hợp đồng | 1 bộ điều khoản | **+ bộ điều khoản tài chính riêng** |
| Tư vấn pháp lý | Không | **Bắt buộc** |
| Rủi ro đền đổi 1 lệnh sai | Không | Không giới hạn |
| KYC tầng C | Không | Bắt buộc |

⇒ **Phương án có tier C rẻ nhất về kỹ thuật nhưng đắt nhất về rủi ro vận hành.**

### 6.3 Sáu biện pháp giảm thiểu

| # | Biện pháp | Cách làm |
|---|---|---|
| 1 | Tách pháp nhân trong hợp đồng | Ghi rõ SaaS không phải bên môi giới, không cầm tài sản, không nhận lệnh, không tư vấn đầu tư |
| 2 | Disclaimer ở UI | Mọi màn hình tier C phải hiện disclaimer |
| 3 | Đổi tên | Tên SaaS không chứa "broker"/"trade"/"sàn". Tầng C gọi *"Private Brokerage Integration"* — mô tả việc, không mô tả vai trò |
| 4 | Log tách riêng | `Entitlement` + `ProductActivation` + audit, giữ lâu |
| 5 | KYC tầng C | Xác minh pháp nhân trước khi bật — dùng cột `Capability.requires_approval` |
| 6 | Cửa sổ không tham gia | Khoảng thời gian khách chịu trách nhiệm hoàn toàn về thao tác giao dịch |

### 6.4 License — đã đọc lại, không phải blocker

**Bản nháp trước đây trích `LICENSE.md:28-36` và kết luận "phải có văn bản cho phép" — kết luận đó SAI.**

`vnbroker/LICENSE.md:9-16` — Mục 0:

> *"Giấy phép này chỉ ràng buộc **người nhận giấy phép** (bên thứ ba cài đặt hoặc sử dụng vnbroker). **Chủ sở hữu bản quyền không bị ràng buộc bởi chính giấy phép này** và giữ toàn quyền, bao gồm không giới hạn: sử dụng, sao chép, sửa đổi, và tích hợp vnbroker vào **bất kỳ sản phẩm, dịch vụ, hoặc hệ thống nội bộ nào của chủ sở hữu** — kể cả khi sản phẩm đó thu phí hoặc được phân phối thương mại."*

`:15-16`: *"Các sản phẩm do chủ sở hữu phát triển (ví dụ: VNInvest) được phép dùng vnbroker mà **không cần xin phép thêm**."*

⇒ **Chủ sở hữu không cần xin phép ai.** Vấn đề thật không phải "bán có cần giấy phép không" mà là "**khách hàng** (bên thứ ba) có được phép chạy thương mại không".

#### Điểm then chốt: ai cài code

| Ai cài `vnbroker` | Vai trò | Ràng buộc |
|---|---|---|
| Chủ sở hữu (bạn) trên máy chủ của mình | Chủ bản quyền | ✅ Mục 0 — không ràng buộc |
| **Khách hàng trên máy của họ** | **Bên thứ ba** | ⚠️ Mục 1–2 — phi thương mại |

#### Mô hình đã chốt: khách tự chạy

Owner quyết định 2026-10-02: **`vnbroker` chạy trên hệ thống của khách. SaaS chỉ quản lý xác thực và tính phí theo tenant.**

Đây là mô hình đúng, vì ba lý do:

| Tiêu chí | Khách tự chạy ✅ | Chủ sở hữu chạy ❌ |
|---|---|---|
| Credential broker | Ở máy khách | **Ở máy chủ bạn** |
| Chi phí vận hành cho bạn | Thấp | Cao |
| Rủi ro rò rỉ dữ liệu | Thấp | Cao |
| Phù hợp §3.1 | ✅ `credentials.py:48` chỉ đọc env khách | ❌ Đảo ngược |

**Lợi ích pháp lý trực tiếp:** vì bạn không bao giờ chạm vào credential broker và không nắm tài sản, bạn không có đường để trở thành bên trung gian. Đây chính là lý do phân tích rủi ro ban đầu kết luận mức rủi ro thấp.

#### Cách xử lý giấy phép cho khách

Vì bạn là chủ bản quyền, có ba cách — **không cách nào cần xin phép ai**:

| Cách | Việc phải làm |
|---|---|
| **B (khuyến nghị)** | Viết văn bản cấp giấy phép thương mại cho khách, tham chiếu Mục 0 và Mục 36 |
| C | Sửa `LICENSE.md` Mục 1–2 để cho phép thương mại có điều kiện |
| A | Chuyển sang chạy `vnbroker` trên máy chủ bạn — **không khuyến nghị**, đảo ngược mô hình |

**Cách B** giữ nguyên `LICENSE.md` cho thư viện, chỉ thêm một văn bản cấp quyền.

#### `vninvestcharts-widget`

MPL-2.0 — cho phép thương mại, nhưng **không được sửa file để thêm license check/telemetry**. Phải dùng host wrapper riêng.

### 6.5 Giới hạn

Phần này là **phân tích rủi ro dựa trên hành vi kỹ thuật của code**, không phải ý kiến pháp lý.
CHƯA XÁC MINH: khung pháp lý Việt Nam hiện hành xếp loại "cấp phần mềm có khả năng đặt lệnh chứng khoán" vào nhóm nào.

**Việc cần làm:** 1 buổi tư vấn luật sư chuyên ngành chứng khoán, cầm theo: `LICENSE.md`, `broker/security/guards.py`, `broker/tcbs/money.py`, `README.md` của `vnbroker`.

---

## 7. Mô hình dữ liệu — 9 bảng

> Ghi chú: ban đầu dự kiến 8 bảng. Khi thiết kế chi tiết luồng approval phát hiện cần tách `Entitlement` và `CapabilityGrant` thành 2 bảng → **9 bảng**. Ghi lại ở đây để không lệch với tài liệu cũ.

### 7.1 Tại sao phải generic

Grep `product_code|product_id|module_code|feature_key|capability` trong `packages/core/backend/src/` → **không có khái niệm "product"**. Hệ thống hiện là single-product.

### 7.2 Phân tích module `commercial` hiện có

| Thành phần | File:line | Đánh giá |
|---|---|---|
| `QuotaHistory` | `commercial/models.py:133-149` | ✅ **Đúng chuẩn** — `meter_code:137`, `meter_name:138`, `unit:139`, `entitled_amount:140`, `risk_state:142`, `hard_stop:148` |
| `Invoice.line_items` | `:79` | ✅ JSONField, co giãn tự do |
| `Subscription.plan` | `:23` | ⚠️ `CharField(max_length=32)` phẳng — thêm plan OK nhưng **không có chiều sản phẩm** |
| `Subscription.tenant` | `:18` | ❌ **`OneToOneField`** — mỗi tenant chỉ mua được 1 sản phẩm |
| `QuotaRecord` | `:43-50` | ❌ **Cột cứng** `api_calls_used/limit`, `symbols_used/limit`, `users_used/limit`, `storage_mb_used/limit`. Thêm metric = migration |
| Feature map | `commercial/plan_catalog.py:52,56` | ❌ Hardcode ở `identity_access/views_webhooks.py:196-201`, tự ghi *"nguồn DUY NHẤT"* |

**Mâu thuẫn phải giải quyết:** `QuotaRecord` (cột cứng) và `QuotaHistory` (meter-driven) tồn tại song song với hai triết lý ngược nhau. → **Chọn `QuotaHistory` làm nguồn sự thật.**

### 7.3 Bốn thay đổi bắt buộc

**(1) Cho phép một tenant mua nhiều sản phẩm**
```python
# commercial/models.py:18 — hiện tại
tenant = models.OneToOneField(...)
# → đổi thành
tenant = models.ForeignKey(..., related_name="subscriptions")
product = models.ForeignKey("Product", on_delete=models.PROTECT)
class Meta:
    unique_together = ("tenant", "product")
```

**(2) Bảng `Product`** — quan trọng nhất
```python
class Product(models.Model):
    code = models.CharField(max_length=64, unique=True)   # "vninvestcharts"
    name = models.CharField(max_length=128)
    vendor = models.CharField(max_length=64)
    source_repo = models.URLField(blank=True)
    license_type = models.CharField(max_length=32)   # MPL-2.0 | PROPRIETARY | COMMERCIAL
    license_note = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

`license_type` không phải chi tiết vô nghĩa — nó ghi ràng buộc pháp lý **riêng từng sản phẩm**, và sẽ nhắc bạn rằng `vnbroker` đang ở `PROPRIETARY` chưa ký commercial.

**(3) `QuotaRecord` cột cứng → dùng `QuotaHistory`**
Xóa 8 cột ở `:43-50`. Mọi metric đi qua `QuotaHistory.meter_code`. Cột cứng chỉ nên là cache ghi bằng `update()`, không phải nguồn.

**(4) `features_map` → bảng `Capability`**
```python
class Capability(models.Model):
    code = models.CharField(max_length=64, unique=True)   # "brokerage.place_order"
    product = models.ForeignKey("Product", on_delete=models.CASCADE, related_name="capabilities")
    display_name = models.CharField(max_length=128)
    requires_approval = models.BooleanField(default=False)   # tier C = True
    is_write_capability = models.BooleanField(default=False) # cảnh báo tới khách
```

`requires_approval` là chỗ cài quy tắc "tầng C phải duyệt" **bằng khai báo**, không phải bằng `if`.

### 7.4 Đầy đủ 9 bảng

```
Product
├── ProductTier          (code, product, display_name, price, billing_period, is_active)
├── Capability           (code, product, requires_approval, is_write_capability)
│   └── TierCapability   (tier, capability)          ← M2M
│   └── Meter            (code, unit, is_billable)  ← M2M qua TierMeterLimit
│       └── TierMeterLimit(tier, meter, limit_amount=-1 unlimited)
├── Entitlement          (tenant, product, tier, status, granted_by, granted_at,
│                         legal_terms_version, approved_by, approved_at)
└── EntitlementCapabilityGrant (entitlement, capability, granted_at, granted_by, reason)
    └── AuditLog         (reuse PATAuditLog)
```

| # | Bảng | Vai trò | Loại |
|---|---|---|---|
| 1 | `Product` | Sản phẩm đăng ký | Tham chiếu |
| 2 | `ProductTier` | Bậc giá của sản phẩm | Tham chiếu |
| 3 | `Capability` | Tính năng, có cờ approval | Tham chiếu |
| 4 | `TierCapability` | Tier ↔ capability | M2M |
| 5 | `Meter` | Đơn vị đo | Tham chiếu |
| 6 | `TierMeterLimit` | Hạn mức theo tier | M2M có dữ liệu |
| 7 | `Entitlement` | Cấp quyền cho tenant | Giao dịch |
| 8 | `EntitlementCapabilityGrant` | Cấp quyền capability, có approval | Giao dịch |
| 9 | `UsageRecord` | Tiêu thụ theo meter × kỳ | Giao dịch |

### 7.5 Test mở rộng: thêm sản phẩm thứ 4

| Việc | Công sức |
|---|---|
| 1 dòng `Product` | INSERT (sau migration đầu tiên) |
| N dòng `Meter` | INSERT |
| M dòng `ProductTier` + `TierCapability` + `TierMeterLimit` | INSERT |
| 1 SDK adapter | ~200 LOC |
| **Migration mới** | **0** |
| **Endpoint mới** | **0** |
| **Sửa code core** | **0** |

**Nếu thiết kế sai:** sản phẩm thứ 2 là lúc trả giá — thêm bảng `Product`, đổi `OneToOne`→`FK`, thêm cột quota, tách `features_map` khỏi `views_webhooks`, viết lại `plan_catalog`.

### 7.6 Dữ liệu khởi tạo

| `Product.code` | `license_type` | `Capability` mẫu |
|---|---|---|
| `vninvestcharts` | `MPL-2.0` | `chart.render` |
| `vnbroker-data` | `PROPRIETARY` → `COMMERCIAL` | `data.quote`, `data.ssi.quote` |
| `vnbroker-brokerage` | `PROPRIETARY` → `COMMERCIAL` | `brokerage.place_order` ⚠️ `requires_approval=True`, `is_write_capability=True` |

---

## 8. Luật bất di bất dịch

> **Backend không bao giờ được biết tên sản phẩm.**

1. Không có `if product == 'vnbroker'` ở bất kỳ đâu trong backend
2. Tên sản phẩm và tên tính năng là **chuỗi trong DB**, không phải `Enum` trong code
3. Backend không biết "chart render" nghĩa là gì — nó chỉ đếm và trả về số
4. **Chỉ SDK biết** ý nghĩa. Backend là kho quyền, SDK là bộ diễn giải

Vi phạm điều 1 ⇒ hệ thống trở thành single-product mà vỏ ngoài giống multi-product, và sản phẩm thứ 4 sẽ phá hỏng thiết kế.

---

## 9. Cơ chế entitlement end-to-end

### 9.1 Luồng

```
Khách code                    SaaS backend                      DB
    │
    ├─ POST /api/v1/entitlements/verify
    │  Authorization: Bearer <PAT>
    │  { "product": "vnbroker-brokerage",
    │    "capabilities": ["brokerage.place_order"] }
    │                            │
    │                            ├─ xác thực PAT ──────────► CorePATCredential
    │                            ├─ tra tenant ────────────► CoreTenant
    │                            ├─ lấy Entitlement ───────► Entitlement
    │                            ├─ kiểm tra CapabilityGrant
    │                            ├─ kiểm tra approval ────► requires_approval
    │                            ├─ kiểm tra quota ────────► UsageRecord
    │                            └─ kiểm tra license expiry► Product.license_type
    │                            │
    ◄── { "allowed": true,
    │      "reason_code": null,
    │      "limits": {...},
    │      "expires_at": "..." }
    │
    ├─ SDK kiểm tra allowed
    │      false → raise, KHÔNG gọi broker API
    │      true  → mới gọi vnbroker (SDK tự đọc env credential của khách)
```

### 9.2 `reason_code` chuẩn

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `ok` | 200 | Được phép |
| `pat_invalid` | 401 | PAT sai/hết hạn |
| `tenant_suspended` | 403 | Tenant bị khoá |
| `entitlement_missing` | 403 | Chưa mua sản phẩm này |
| `tier_insufficient` | 403 | Tier không đủ quyền |
| `capability_not_granted` | 403 | Tier không có capability này |
| `approval_pending` | 403 | Tier C đang chờ duyệt |
| `license_expired` | 403 | License phần mềm hết hạn |
| `quota_exceeded` | 429 | Vượt hạn mức meter |
| `product_retired` | 410 | Sản phẩm không còn bán |

### 9.3 Vì sao `approval_pending` tách riêng

Nó là **lý do pháp lý** không phải lý do kỹ thuật. `capability_not_granted` = khách mua gói không đủ; `approval_pending` = khách đủ điều kiện nhưng tầng C chưa được duyệt pháp nhân. Hai thông điệp này phải khác nhau vì cách xử lý khác nhau.

---

## 10. Security gap — P1

### 10.1 Vấn đề

`brokerage/base.py` có `place_order:278`, `cancel_order:283`, `modify_order:288`.

Grep `write_gate|dry_run|is_write_enabled` trên `brokerage/base.py` + `brokerage/tcbs/client.py` → **0 hit**.

Trong khi `broker/security/guards.py` có đủ cả 3.

⇒ **Ai implement provider mới vào `brokerage/` sẽ không được ép `dry_run`.** Đây là hàng rào an toàn bị bỏ sót ở đúng module được thiết kế cho SaaS.

### 10.2 Đề xuất

Bổ sung `write_gate` cho `brokerage/`, dùng lại từ `broker/security/guards.py`. Song song đó `brokerage/base.py` nên có cờ `requires_approval` ở tầng SDK để khớp với `Capability.requires_approval`.

### 10.3 Độc lập với Phương án A/B

Nên làm bất kể chọn phương án nào.

---

## 11. Tái sử dụng từ `vninvest`

| Thành phần | File:line | Tái sử dụng |
|---|---|---|
| `CoreTenant` | `identity_access/models.py:44` | ✅ Trực tiếp |
| `CoreServiceAccount` | `identity_access/models.py:180` | ✅ Trực tiếp |
| `CorePATCredential` | `identity_access/models.py:254` | ✅ Trực tiếp |
| `TenantMember` | `identity_access/models.py:596` | ✅ Trực tiếp |
| `PATAuditLog` | `identity_access/models.py:423` | ✅ Trực tiếp |
| `TenantQuotaMiddleware` | `identity_access/middleware.py:323` | ⚠️ Cần generalize theo meter |
| `Subscription` | `commercial/models.py:11` | ⚠️ Sửa `tenant` + thêm `product` |
| `QuotaHistory` | `commercial/models.py:133` | ✅ **Làm nguồn sự thật** |
| `QuotaRecord` | `commercial/models.py:38` | ❌ Bỏ 8 cột cứng |
| `Invoice` + `line_items` | `commercial/models.py:61,79` | ✅ Trực tiếp |
| `PaymentTransaction` | `commercial/models.py:91` | ✅ Trực tiếp |
| `VNPayIPNLog` | `commercial/models.py:118` | ✅ Trực tiếp |
| `stripe_service.py`, `vnpay_service.py` | `commercial/` | ✅ Cổng thanh toán có sẵn |

⇒ **Không cần viết lại billing từ đầu.** Phần đắt nhất (thanh toán VNPay/Stripe + webhook IPN) đã có.

### 11.1 Chưa verify

| Mục | Trạng thái |
|---|---|
| `identity_access/views_webhooks.py:196-201` nội dung `features_map` | **CHƯA ĐỌC** — cần xác nhận trước khi tách |
| `TenantQuotaMiddleware:323` logic hiện tại | **CHƯA ĐỌC** |
| `vninvestcharts-widget` adapter hardcode endpoint vninvest | **CHƯA XÁC MINH trong phiên này** (ghi nhận từ `AGENTS.md`) |
| Số LOC thực tế sau khi gọt | **ƯỚC LƯỢNG** — chưa đo bằng script |

---

## 12. Lộ trình

| Giai đoạn | Nội dung | Phụ thuộc |
|---|---|---|
| **P0** | 9 model mới + sửa `Subscription`/`QuotaRecord` + migration | Không |
| **P1** | `/api/v1/entitlements/verify` + `reason_code` chuẩn | P0 |
| **P2** | SDK gate: `require_capability("brokerage.place_order")` | P1 |
| **P3** | Billing đa sản phẩm (tái dùng `Invoice.line_items`) | P0 |
| **P4** | Metering theo `Meter` (thay `QuotaRecord`) | P0 |
| **P5** | Admin UI quản lý `Product` / `Tier` / `Capability` | P0 |
| **P6** | KYC + approval flow cho `requires_approval=True` | P1 |
| **P7** | Đóng P1 `brokerage/` write_gate | Độc lập |
| **P8** | Hợp đồng + tư vấn pháp lý | Owner |

**Điều kiện tiên quyết của P8 (owner):**
- ~~Ký license commercial cho `vnbroker`~~ — **không cần**, Mục 0 đã giải phóng chủ sở hữu
- **Viết văn bản cấp giấy phép thương mại cho khách** (vì khách là licensee bên thứ ba)
- Xác nhận phạm vi hoạt động pháp lý với luật sư

---

## 13. Điều kiện mở cửa bán hàng

| # | Điều kiện | Trạng thái |
|---|---|---|
| 1 | ~~License commercial `vnbroker`~~ | ✅ **Không cần** — Mục 0 giải phóng chủ sở hữu |
| 1b | Văn bản cấp giấy phép thương mại cho khách (licensee) | ⬜ Chưa làm — bước một trang |
| 2 | P0-P5 hoàn thành | ⬜ Chưa làm |
| 3 | Đóng P1 `brokerage/` write_gate | ⬜ Chưa làm — đã chuyển v2.0 |
| 4 | Hợp đồng B2B có mục định vị pháp nhân | ⬜ Chưa làm |
| 5 | Tư vấn luật (nếu bán tier C) | ⬜ Đã chuyển v2.0 theo Q-20 |
| 6 | P0-SEC-01 (secret trong git) | ❌ **Blocker repo** — xem `AGENTS.md` |
| 7 | Chỉ bán tier A + data | ✅ **Chỉ cần điều kiện 1b và 6** |

⇒ **Lộ trình an toàn: ra mắt `vninvestcharts` + `vnbroker-data` (chỉ lane VCI/KBS/RSS), trì hoãn tier C tới khi xong P6 + P8.**

---

## 14. Bảng bằng chứng

### 14.1 ĐÃ VERIFY (đọc/grep trực tiếp phiên này)

| Nội dung | Nguồn |
|---|---|
| Toàn bộ write method tầng C | `broker/{ssi,tcbs}/*.py` — grep + đọc |
| Tầng C không chuyển tiền | `ssi/money.py:6`, `tcbs/money.py:3,7`, grep 0 `write_gate` ở 7 file |
| Credential từ env khách | `broker/security/credentials.py:48,65-67,154-165` |
| `dry_run` mặc định True | `broker/security/guards.py:24,60-69` |
| SSI explorer coupling | `explorer/ssi/_auth.py:19-25,145` + 7 file khác |
| Explorer không import order | grep `equity\|fco\|client\|derivatives\|place_order` → 0 hit |
| Lane sạch | 8 lane, grep 0 hit |
| `brokerage/` bypass SaaS | `brokerage/base.py:1-9` |
| `brokerage/` thiếu write_gate | grep 0 hit trên 2 file |
| `brokerage/` mồ côi | grep chỉ ra `brokerage/tcbs/client.py:20` |
| License non-commercial **cho bên thứ ba** | `LICENSE.md:9-16` Mục 0 giải phóng chủ sở hữu · `:28-36` Mục 2 hạn chế bên thứ ba |
| `commercial` model shapes | `commercial/models.py:11-149`, `plan_catalog.py:52,56` |
| `identity_access` model shapes | `identity_access/models.py:44,180,254,423,596` |

### 14.2 CHƯA XÁC MINH

| Mục | Cần làm gì |
|---|---|
| `identity_access/views_webhooks.py:196-201` | Đọc trước khi tách `features_map` |
| `TenantQuotaMiddleware:323` | Đọc logic quota hiện tại |
| `vninvestcharts-widget` adapter | Kiểm tra endpoint hardcode (theo `AGENTS.md`, chưa xác minh phiên này) |
| Số LOC thực tế | Đo bằng script, không ước lượng |
| Khung pháp lý Việt Nam | Luật sư chuyên ngành |
| `brokerage/tcbs/client.py` đầy đủ | Chỉ đọc `base.py`, chưa audit implementation |
| `broker/stream.py` có cần tách không | Chỉ xác nhận 2 method write; chưa đọc toàn file (dài) |

---

## 15. Tài liệu liên quan

- `AGENTS.md` — khung audit, quy trình multi-agent, P0-SEC-01
- `docs/AGENT_PROTOCOL.md` — quy trình khi ≥2 agent
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` — ledger thay đổi
- `docs/COMMERCIAL_COMPARISON_ROADMAP_20260726.md` — roadmap commercial hiện có
- `docs/AUDIT_BROKER_MANAGEMENT_20260923.md` — audit broker hiện có
- `vnbroker/LICENSE.md`, `vnbroker/pyproject.toml` — ràng buộc license