# AUDIT VERIFICATION ADDENDUM — Portfolio Commercial Redesign

**Ngày verify:** 2026-09-26
**Audit nền:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` (Rev.1)
**Plan nền:** `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (Rev.2)
**Verify tại:** branch `dev`, HEAD `523cd346`
**Audit baseline:** HEAD `8b479d24` (là ancestor của HEAD)
**Phương pháp:** 4 sub-agent read-only, phân chia theo file, không agent nào sửa file.
**Quy ước trích dẫn:** `path:line @ 523cd346` theo `docs/AGENT_PROTOCOL.md` §6.

> **Đây là addendum, không sửa audit gốc.** Audit gốc là bản ghi lịch sử tại thời điểm
> 2026-09-25. Tài liệu này ghi những gì đã thay đổi giữa `8b479d24` → `523cd346`, chỗ nào
> audit sai, chỗ nào audit đánh giá thấp, và **2 P0 mới mà audit không có**.

---

## 0. Tóm tắt điều hành

| Kết luận | Số |
|---|---:|
| P0 trong audit vẫn còn đúng ở HEAD | **7 / 7** |
| Sub-claim bị **refute** (audit sai, không phải code đã sửa) | **3** |
| `file:line` sai (code đúng, vị trí sai) | **20** |
| Finding audit **đánh giá THẤP** (thực tế nặng hơn) | **4** |
| Finding audit **đánh giá CAO** (thực tế nhẹ hơn) | **2** |
| **P0 MỚI** không có trong audit | **2** |
| P1/P2 mới phát hiện | **8** |

**Không có P0 nào đã được đóng kể từ `8b479d24`.** Commit `275fcd78` thêm validate +
throttle + audit wrapper cho order, nhưng đồng thời **tạo ra 2 P0 mới** (X.1, X.2 dưới).

### Ba kết luận làm thay đổi kế hoạch

1. **P0-ISO-01 nhỏ hơn audit nghĩ, và cách sửa rẻ hơn nhiều.** Audit đề xuất "tạo dependency
   `resolve_active_tenant(request)`". **Không cần** — `request.tenant` đã được
   `TenantResolutionMiddleware` gán sẵn. Chỉ cần thêm 1 filter. Ngoài ra chỉ **4** analytics
   endpoint thực sự reachable; 4 view còn lại là **code chết** (import ở `urls.py:9-13` nhưng
   không có trong `urlpatterns`) — sửa chúng không đóng được lỗ hổng.
2. **P0-DATA-01 bị audit đánh giá quá cao.** `signals.py:68-87` đã tự điền tenant cho
   `Portfolio` và `Transaction`. Chỉ **`SubAccount`** là không có receiver ⇒ đó mới là
   lỗ hổng duy nhất thật.
3. **P0-SEC-01 nghiêm trọng hơn audit nghĩ rất nhiều.** Audit tìm 4 dòng; thực tế
   **21 dòng / 20 file / 4 token khác nhau**, trong đó **11 file `scratch/*.py` chứa token
   trong code chạy được**. Nặng nhất: `compose.dev.env` đang tracked và chứa
   `DNSE_CREDENTIAL_FERNET_KEY` dài 44 ký tự — đúng dạng Fernet hợp lệ — tức **mọi
   `UserDNSECredential` trong DB đều giải mã được**. Chi tiết: `SEC-01-REPORT.md`.

---

## 1. Bảng trạng thái từng finding

| Mã | Trạng thái HEAD | Sai `file:line` | Ghi chú |
|---|---|---|---|
| P0-SAFETY-01 | **CÒN ĐÚNG** | 5 dòng | 1 sub-claim đã được sửa, 1 sub-claim sai |
| P0-ISO-01 | **CÒN ĐÚNG** | 0 | Blast radius nhỏ hơn; cách sửa không cần resolver mới |
| P0-ISO-02 (BE) | Chưa verify — **bị chặn** | — | `middleware.py` + `permissions.py` do `tenantreg-b` claim |
| P0-ISO-02 (FE) | **CÒN ĐÚNG** | 0 | `X-Tenant-ID` **không bao giờ** được gửi |
| P0-ISO-03 | **CÒN ĐÚNG** | 0 | Thêm 2 helper tenant-blind ngoài audit |
| P0-MIG-01 | **CÒN ĐÚNG** | 1 dòng nhẹ | Tìm ra nguyên nhân gốc + điều kiện kích hoạt |
| P0-DATA-01 | Đúng ở mức code, **đánh giá cao** | 1 | `signals.py` cứu 2/3 call site |
| P0-DATA-02 | **CÒN ĐÚNG** | 0 | `MinValueValidator` đã import sẵn, chỉ dùng 1 lần ở `PriceAlert` |
| P0-DATA-03 | **CÒN ĐÚNG** | 0 | + `Transaction.Meta` thiếu unique cho `external_id` |
| P0-LEGAL-01 | Chưa verify | — | Cần owner, không phải code |
| P0-SEC-01 | **CÒN ĐÚNG, nặng hơn nhiều** | 0 | Xem `SEC-01-REPORT.md` |
| P1-CONTRACT-00 | **CÒN ĐÚNG, nhẹ hơn** | 0 | 2 khối byte-identical ⇒ **không** misroute live |
| P1-SYNC-01 | **CÒN ĐÚNG** | 3 | `place_order` cũng là broker I/O trong request (audit bỏ sót) |
| P1-SEC-01 | **CÒN ĐÚNG** | 1 dòng | Không có validate scheme/host nào |
| P1-AUTH-01 | **CÒN ĐÚNG** | 0 | `BrokerSession` **không tồn tại** trong repo |
| P1-CONTRACT-01 | **CÒN ĐÚNG** | 2 | Thêm 1 method chết nữa |
| C-06 | **CÒN ĐÚNG, nặng hơn** | 0 | `currency`/`status` thiếu cả ở **model** |
| C-07 | **CÒN ĐÚNG, nặng hơn** | 0 | 125 literal / 4 file, không phải 101 / 3 file |
| C-11 | **CÒN ĐÚNG, nhẹ hơn** | 1 | Đã thành split-brain **một chiều** |
| C-14 | **CÒN ĐÚNG** | 0 | Line chuẩn tuyệt đối |

---

## 2. Sai `file:line` — phải sửa trước khi dùng làm input

Plan Rev.2 §7 **trích nguyên văn** các dòng sai này
(`IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:44`, `:45`, `:1386`).
Các dòng đó sẽ sai **ngay lần đọc kế tiếp**.

| Audit nói | Thật @ `523cd346` | Vì sao đổi |
|---|---|---|
| `views_dnse.py:190` (`dry_run` default) | **`views_dnse.py:292`** | file +130 dòng ở `275fcd78` |
| `views_dnse.py:99-176` / `:127-176` (không parse `dry_run`) | **`:354` (OTP)**, **`:377` (token)** | cả hai **có** parse |
| `views_dnse.py:204-213` (`post_order`) | **`views_dnse.py:310-321`** | đã có validate + throttle + audit |
| `views_dnse.py:219-220` (raw `str(exc)`) | **đã bị xoá** | `275fcd78` sửa thành `:331-339` |
| `views_dnse.py:111,140,169` (gọi task trực tiếp) | **`:208, :237, :266`** | +130 dòng |
| `views_dnse.py:179-181` (permission) | **`views_dnse.py:276-279`** | +130 dòng |
| `views_dnse.py:53-62` (đọc store mới) | **`views_dnse.py:145-160`** | `:53-62` là `_validate_order_payload` |
| `DNSEConnectionPanel.js:387-500` | **`:387-504`** | lệch nhẹ, 2 nhãn đúng tại `:388`/`:500` |
| `workspace.js:341-356` | **`:363-371`** (`placeDNSEOrder`) | trỏ nhầm sang block OTP/token |
| `core/workspace.js:145-183` | **`:150-184`** | `:145` là mở đầu JSDoc |
| `coreApiAdapter.d.ts:79-83` | **`:79, :80, :82, :83`** | dòng 81 (`getPortfolioTransactions`) **có thật** |
| `broker/tcbs.py:47-55` | **`:46-54`** | lệch +1 |
| `broker/adapters.py:292-295` | **`:294`** (dòng truyền `base_url`) | lệch +1 |
| `broker/ssi.py:91-98` | **`:97`** (dòng `authenticate()`) | block chứa nó thì đúng |
| `tasks.py:78-84` (tạo Portfolio) | **`:80-84`** | `:78` là `.filter().first()` |
| `models.py:56-98` (`Transaction`) | **`:56-109`** | thiếu `Meta` + `__str__` |
| `identity_access/migrations/0004:17-27` | **`:16-34`** (field list `:18-27`) | `CreateModel` mở đầu ở `:16` |
| `test_portfolio_analytics_native_routes.py:98-102` | **`:98-101`** | lệch nhẹ |
| `portfolio_analytics_views.py:25-252` (8 view) | **chỉ 4 view có route** | 4 view là code chết |
| `tasks.py:59,131,189` (query store cũ) | **`:39, :50, :59, :131, :189`** | thiếu 2 chỗ nguy hiểm nhất |

**ĐÚNG, không cần sửa:** `urls.py:81-86` + `:99-104` · `DNSEConnectionPanel.js:190-225` ·
`portfolio_analytics_views.py:25-27` · `:30-61` · `models.py:452-511` + `:511` ·
`0008_...py:74` · `PortfolioContext.js:25-28,103-107,296-300` ·
`transport.js:169-177,335-338` · `PortfoliosPage.tsx:12-19,125-133` ·
`serializers.py:41-45` · `ops_audit/models.py:12-19` · `queue_policy.py:6-22`.

---

## 3. Sub-claim bị REFUTE

### R-1 — "challenge / send-email-otp / create-trading-token không parse `dry_run`"

**Audit sai cả về sự thật lẫn line.** Audit tự mâu thuẫn: §0 ghi `:99-176`, §D1 ghi
`:127-176` — hai range này trỏ vào 3 view **sync**, không endpoint nào có `dry_run`.

- **"challenge endpoint" KHÔNG TỒN TẠI.** Grep `challenge|create_challenge|trading_challenge`
  toàn `packages/core/backend/src` → đúng **1 hit**: `identity_access/serializers.py:441`
  (URL Cloudflare Turnstile). Không có endpoint challenge nào trong `user_workspace`.
  ⇒ Tên "challenge" trong audit §0/§B và plan §G3 là **sản phẩm phỏng tưởng**.
- `dnse_send_email_otp_api` **CÓ** parse: `views_dnse.py:354`
- `dnse_create_trading_token_api` **CÓ** parse: `views_dnse.py:377`

**Vẫn là P0** vì default vẫn là live. Nhưng câu "không parse" thì sai.

### R-2 — "`place_order` trả raw `f'Đặt lệnh DNSE thất bại: {exc}'`"

**ĐÃ ĐƯỢC SỬA** bởi `275fcd78`. HEAD `views_dnse.py:331-339` trả message chung +
`logger.exception`.

**NHƯNG cùng lỗi còn sống ở 2 endpoint anh em** (xem X.5).

### R-3 — "Adapter không tự fail-closed" + `_compute_holdings` là toàn bộ NAV

Không refute, nhưng **thiếu sắc**: adapter `workspace.js:363-371` còn **không có
idempotency key**, và `_compute_holdings` **không theo dõi tiền mặt** ⇒
`PortfolioSummaryView` (`:99-130`) không có NAV tổng.

---

## 4. Finding audit đánh giá THẤP

### U-1 — P0-SEC-01: 4 dòng → **21 dòng / 20 file / 4 token**

Audit §0 nói "PAT dạng `github_pat_...` trong 3 tracked file". Thật:

| Token (mã sha8, **không in giá trị**) | Độ dài | File | Dòng |
|---|---:|---|---:|
| `[A] b69d8e77` | 93 | `DOCKER_STARTUP_GUIDE.md` | 14, 116 |
| `[B] 8591126c` | 93 | `docker-start.ps1` · `set-docker-env.ps1` | 8 · 4 |
| `[C] 6eaab992` | 40 | `scratch/*.py` (11 file) | xem report |
| `[D] 8841c239` | 40 | `packages/core/backend/tests/test_ai_audit_logs.py` | 45 |

- **[C] là token `ghp_` format thật nằm trong 11 file `scratch/*.py` — code chạy được**
  (script dispatch CI), không phải tài liệu. Audit bỏ sót toàn bộ.
- **[D]** là fixture test nhưng vẫn format `ghp_` thật; không phân biệt được dummy/không mà
  không in giá trị ⇒ **xử lý như thật**.
- Placeholder (đúng, không tính): `SYSTEM-CONNECTIVITY-TROUBLESHOOT-20260513.md:22,27,39,48`
  (len 25, chứa ký tự `x` lặp) · `compose.prod.env.example:122` (len 15).
  ⇒ Audit đúng khi nói `compose.prod.env.example:122` là placeholder.

### U-2 — P0-SEC-01 thiếu `compose.dev.env` (nghiêm trọng nhất)

`git ls-files --error-unmatch compose.dev.env` → **tracked, exit 0**
`git check-ignore -v compose.dev.env` → **không ignored, exit 1**
`.gitignore:13-45` — không có pattern `compose*.env`.

Key có trong file (chỉ tên + độ dài, **không giá trị**):

| Dòng | Key | Độ dài | Ghi chú |
|---:|---|---:|---|
| 11 | `CORE_DJANGO_SECRET_KEY` | 37 | secret Django |
| 14 | `CORE_PAT_PEPPER` | 36 | băm PAT |
| 15 | `CORE_AD_SIGNING_SECRET` | 43 | |
| **16** | **`DNSE_CREDENTIAL_FERNET_KEY`** | **44** | **đúng dạng Fernet hợp lệ ⇒ KHÔNG phải placeholder** |
| 19-20 | `DNSE_API_KEY` / `DNSE_API_SECRET` | 96 / 86 | |
| 21 | `GRAFANA_ADMIN_PASSWORD` | 5 | yếu, brute-force được |
| 104 | `GITHUB_CLIENT_SECRET` | 40 | |

**Fernet key lộ ⇒ mọi `UserDNSECredential` trong DB giải mã được**
(`identity_access/models.py:877-879`). Không cơ chế placeholder nào khớp các dòng trên.

### U-3 — C-07: 101 literal / 3 file → **125 literal / 4 file**

Audit §D `P2-UX-02` bỏ sót cặp trang `Shell*` đi song song với `core-*`:

| Route key | File | VI literal | `t()` |
|---|---|---:|---:|
| `core-portfolios` | `pages/PortfoliosPage.tsx` | 20 | 0 |
| `portfolios` | `pages/workspace/ShellPortfoliosPage.tsx` | **25** | 0 |
| `core-transactions` | `pages/TransactionsPage.tsx` | 25 | 0 |
| `transactions` | `pages/workspace/ShellTransactionsPage.tsx` | **26** | 0 |

`routeCatalog.js:119-134` **chỉ** có `transactions` + `portfolios` ⇒ nav dẫn tới bản
`Shell*`; `core-*` chỉ vào được bằng URL thẳng. Cả 4 trang đều dead i18n.

**Cũng sửa 2 điểm audit khác:**
- Namespace `brokerConnections` mà audit §D `P2-UX-02` đề xuất dùng **KHÔNG TỒN TẠI** ở
  cả 2 locale. Phải tạo mới.
- Parity `portfolioManagement` = **52/52**, `transactions` = **73/73**, `only_vi=0`,
  `only_en=0` — **125 key đã có sẵn, parity sạch, nhưng 0 call site**.

### U-4 — C-06: thiếu ở serializer → thiếu ở **cả model**

`Portfolio` (`models.py:17-45`) không có `currency`, không có `status`. Không chỉ là lỗi
serializer. `PortfoliosPage.tsx:76` gửi `currency` lên ⇒ BE bỏ qua **âm thầm**, user tưởng
đã chọn tiền tệ.

---

## 5. Finding audit đánh giá CAO

### D-1 — P0-DATA-01: `signals.py` cứu 2/3 call site

`packages/core/backend/src/user_workspace/signals.py` (đăng ký qua `apps.py:9-10 ready()`):

```
:68-81  auto_populate_tenant_from_user  → sender = Portfolio, Watchlist, TrackedSymbol,
                                         PriceAlert, ScreenerRule
:84-87  auto_populate_transaction_tenant → sender = Transaction
```

| # | `tasks.py` | Call site | Truyền tenant? | Signal cứu? |
|---:|---:|---|---|---|
| 1 | `:78` | `Portfolio.objects.filter(user_id=…).first()` | không (chọn "first portfolio") | n/a |
| 2 | `:80-84` | `Portfolio.objects.create(…)` | không | **CÓ** `:68-81` |
| 3 | **`:103-119`** | `SubAccount.objects.update_or_create(…)` | không | **KHÔNG — lỗ hổng thật duy nhất** |
| 4 | `:153-162` | `AccountSnapshot.update_or_create(…)` | n/a — model không có field tenant | n/a |
| 5 | `:234-247` | `Transaction.objects.update_or_create(…)` | không | **CÓ** `:84-87` |

Audit §B3 viết *"các record mới từ sync có thể gặp integrity error"* ⇒ chỉ đúng cho
**`SubAccount`**. Với `Portfolio`/`Transaction` signal lấp **im lặng** — tệ hơn theo nghĩa
khác: ai cũng tưởng đã có tenant, không ai kiểm tra. `subaccount.tenant` là `NOT NULL`
(`models.py:348` + `migrations/0012...:25-29` không khai `null=`) ⇒ `IntegrityError` tại
nhánh CREATE.

**Ngoài ra audit không nêu:** `test_broker_connection_task` (`tasks.py:269-308`) đọc store
**MỚI** (`:279` `UserBrokerConfig`) — nên `tasks.py` không "toàn bộ query store cũ".

### D-2 — C-11: split-brain đã thành **một chiều**

Writer duy nhất của `DNSECredential` là `_mirror_to_legacy_dnse` (`views_broker.py:73`),
gọi đúng 2 chỗ trong `broker_config_api`: `:129` (DELETE) và `:152` (POST).
`views_dnse.py:190-192` xác nhận route config cũ **đã bị xoá**.

⇒ Đúng hơn: **1 đường ghi** (store mới) + **5 chỗ đọc read-only store cũ**
(`tasks.py:39, :50, :59, :131, :189`). Ba rủi ro cụ thể còn lại:
1. `views_dnse.py:151-157` — store mới có `client_id` nhưng thiếu `client_secret` ⇒ rơi
   xuống store cũ **âm thầm**, dùng secret user đã xoá.
2. Xoá row `UserBrokerConfig` ngoài đường `broker_config_api` ⇒ mirror còn nguyên, task
   vẫn chạy bằng secret cũ. **Không checksum/reconciliation nào.**
3. `views_broker.py:73` `get_or_create` — row legacy bị xoá ngoài lề thì hàm **tự tái tạo
   với secret rỗng** thay vì fail, mất dấu vết "chưa từng mirror".

Hai chỗ `:39` / `:50` nguy hiểm nhất vì **fan-out tới mọi user có credential** ⇒ lịch định
kỳ sẽ kích hoạt sync bằng secret legacy cho **mọi** user, kể cả user đã đổi config.

⇒ Xếp **P1 thật**, không phải P0 như audit ngầm ý.

---

## 6. P0 MỚI — không có trong audit

### X.1 — P0 — MỌI lệnh DNSE từ UI đang trả HTTP 400 (regression)

`views_dnse.py:72` đọc **chỉ** `payload.get('volume')`; `:73-78` `int(None)` →
`TypeError` → `"Khối lượng phải là số nguyên."`

Nhưng **cả hai** caller FE gửi `quantity`:
- `DNSEConnectionPanel.js:216` → `quantity,`
- `advisory/AdvisoryOrderTicket.js:51` → `quantity: qtyNum,`

Không có fallback `quantity`→`volume` ở BE. Grep `volume|quantity` trong `views_dnse.py` +
`dnse_adapter.py` + `broker/*.py`: `broker/adapters.py` chỉ dùng `quantity` cho READ model,
không liên quan order write.

**Nguyên nhân:** chính commit `275fcd78` thêm `_validate_order_payload`. Baseline không có
validate ⇒ payload đi thẳng xuống broker.

**Vì sao test không bắt:** `__tests__/whale-advisory-alert-order.component.test.tsx:54-59`
assert payload `{ …, quantity: 100, … }` và **mock** `placeOrder` ⇒ luôn xanh.
Không có test BE nào chạm `place_order` / `dry_run` / `_validate_order_payload` /
`broker_order` (grep toàn bộ `test_*.py`).

### X.2 — P0 — Audit order **không bao giờ ghi được** (silent no-op)

`views_dnse.py:110` `action='broker.place_order'` — **18 ký tự**.
`ops_audit/models.py:25` `action = models.CharField(max_length=16, …)` ⇒ PostgreSQL
`varchar(16)` ném `DataError`.

Bị nuốt bởi `views_dnse.py:121-122` `except Exception: logger.exception(…)`.
⇒ **Không còn dòng audit nào cho `broker.place_order`.** Lớp audit là dead code, tạo cảm
giác an toàn giả.

Lưu ý: Django **không** validate `choices` khi `.create()`; chỉ `max_length` mới bị DB chặn
⇒ lỗi là `DataError` chứ không phải `ValidationError`. `request.tenant` **có** sẵn
(`identity_access/middleware.py:112`) nên `tenant_id` lấy được — vấn đề chỉ là `action`.

**Cách sửa rẻ (không cần migration):** đổi `views_dnse.py:110` sang `action='create'`
(hợp lệ theo `ops_audit/models.py:13-19`) + đưa `broker.place_order` vào `metadata`.
Nới `max_length` 16→32 sẽ cần migration ⇒ `*/migrations/*` đang do `tenantreg-c` claim.

---

## 7. P1/P2 mới phát hiện

| ID | Mức | Vị trí @ `523cd346` | Nội dung |
|---|---|---|---|
| **X.3** | P1 | `views_dnse.py:288` + `:83` | `market_type` **không allowlist**; guard lô 100 chỉ chạy khi `== 'STOCK'` ⇒ gửi `market_type:"FUND"` + `volume:1` vượt qua, và giá trị unvalidated đó đi thẳng xuống broker (`:313`) |
| **X.4** | P1 | `views_dnse.py:289`, `:316` | `order_category` nhận và truyền thẳng, không validate |
| **X.5** | P1 | `views_dnse.py:364-365`, `:404-405` | Rò rỉ `str(exc)` **còn sống** ở OTP + trading-token (fix chỉ áp cho `place_order`) |
| **X.6** | P1 | `views_dnse.py:52` vs `:291`/`:314` | TOCTOU: validate bản copy đã `.upper()`/`.strip()`, nhưng `payload` gốc đi xuống broker ⇒ giá trị kiểm ≠ giá trị thực thi |
| **X.7** | P1 | `views_dnse.py:208,237,266` | `place_order` (`:311-312`) **cũng** là broker I/O đồng bộ trong request, vi phạm contract tự đặt tại `views_broker.py:5` |
| **X.8** | P1 | `broker/adapters.py:229,239,252,267,306,320,332,347` | Cả 2 adapter generic tạo **client MỚI cho mỗi lệnh read** ⇒ không cache token, không đóng connection. Audit chỉ nêu `authenticate` |
| **X.9** | P1 | `models.py:543-556` | `get_user_broker_config` / `set_user_broker_secrets` tenant-blind ⇒ **không có đường nào** trong code hiện tại lấy credential theo tenant, kể cả khi muốn |
| **X.10** | P1 | `models.py:100-106` | `Transaction.Meta` **không** `unique_together`; `external_id` chỉ `db_index=True` ⇒ `update_or_create` ở `tasks.py:234` chỉ dựa vào lookup app-level, **không có chốt chặn race ở DB** |
| **X.11** | P2 | `views_dnse.py:17,28,35` | Import thừa: `timezone`, `set_user_broker_secrets`, `NotFoundErrorException` |
| **X.12** | P2 | `DNSEConnectionPanel.css:15-20` | Audit ghi "`:15-20` hardcode dark palette" — thật chỉ là **comment**; hardcode thật ở `:2-13` |

---

## 8. P0-MIG-01 — nguyên nhân gốc + điều kiện kích hoạt

**Nguyên nhân gốc (audit chưa nêu):** tác giả lẫn `TenantMember` với `SubAccount.is_active`
— field **đúng** tồn tại tại `user_workspace/migrations/0002_add_subaccount.py:23`.
Cùng app, cùng ngữ cảnh backfill, dễ nhầm.

**Bằng chứng tác giả từng làm ĐÚNG trong cùng app:**
`user_workspace/migrations/0005_backfill_portfolio_tenant.py:26`
`TenantMember.objects.filter(user=portfolio.user).first()` — **không** `is_active`.
⇒ `0008` là lỗi sót, không phải chủ ý.

**`is_active` không tồn tại ở đâu trong `identity_access`:**
- `0004_...py:16-34` `CreateModel TenantMember`: 8 field (`public_id, role, joined_at,
  updated_at, invited_by, tenant, user, id`) — **không** `is_active`.
- **Không một migration nào** trong 27 file `identity_access/migrations/` thêm `is_active`
  cho `TenantMember`. Các `is_active` thuộc model khác: `SystemMailConfig` (0008:58),
  `ScheduledReport` (0015:23), `TenantWebhookConfig` (0017:22).
- Model sống cũng **không** có: `identity_access/models.py:578` `class TenantMember` —
  field `public_id, tenant, user, role, custom_role, invited_by, joined_at, updated_at`.
  ⇒ `FieldError` chắc chắn, không phụ thuộc state.

**Điều kiện kích hoạt thật (audit chưa nêu):**
`0008:104-106` chỉ depend `('user_workspace','0007_…')`, **không** depend `identity_access`;
nhưng `0007:12` đã depend `('identity_access','0004_…')`. Dù state nào, `is_active` cũng
không có.
Lỗi chỉ nổ khi **`SubAccount.tenant IS NULL` VÀ `SubAccount.portfolio_id IS NULL`** (đi vào
nhánh `else` ở `:71`). Fresh DB rỗng ⇒ `:60 if not subaccounts_to_update: return` bypass.

**Đã loại trừ 2 nghi về mình:** `SubAccount.portfolio` **có** trong migration state (thêm
tại `0003_dnse_lightspeed_credential_v2.py:31-35` `AddField … null=True blank=True`) ⇒
`:56 select_related('portfolio','user')` + `:57 values_list('portfolio__tenant_id')` hợp lệ.
`Transaction.portfolio` non-null tại `0001_initial.py:56-61` ⇒ `:17-19` hợp lệ.
⇒ **`0008` chỉ có đúng 1 lỗi (`is_active`).**

**Nguy hiểm hơn `FieldError`:** `reverse_backfill` (`0008:92-99`) xoá tenant của **TOÀN BỘ**
`Transaction`/`SubAccount` khi rollback.

**LEAF hiện tại:** `user_workspace` = `0018_broker_config_unverified` ·
`identity_access` = `0027_system_broker_credential`. Mỗi app đúng 1 leaf ⇒ cạm bẫng
"conflicting leaf" của `AGENTS.md` **không** tái diễn ở 2 app này.

---

## 9. P1-AUTH-01 — `BrokerSession` KHÔNG tồn tại

Audit §D nói `BrokerSession` như một thứ **đang tồn tại để sửa**. Thực tế:

- **KHÔNG có** class `BrokerSession` nào trong repo.
- `BrokerAdapter` (`adapters.py:94-115`) chỉ có 5 method — `is_available`, `list_accounts`,
  `get_balance`, `get_positions`, `get_orders`. **Không** `authenticate`, **không** `refresh`,
  **không** `close`, **không** `__enter__/__exit__`.
- **0/3 adapter** implement lifecycle.
- Grep `def authenticate|\.authenticate\(|def refresh|def close|BrokerSession` trong
  `broker/*.py` → **đúng 1 hit**: `ssi.py:97`.

**Đối chiếu 2 đường gọi cùng credential:**
- `ssi.test_connection()` (`ssi.py:92-98`) **CÓ** `client.authenticate()` ở `:97`
- `SsiBrokerAdapter` (`adapters.py:205-279`) **KHÔNG**, và mỗi read method tạo client mới
  (`:229, :239, :252, :267`)
- `tcbs.py:68-87` `test_connection` cố ý **không** authenticate (cần OTP) và trả
  `unverified: True` ở `:87` — hành vi an toàn. Nhưng `TcbsBrokerAdapter` im lặng gọi read
  (`:305-359`) và **không** trả `unverified`.

⇒ Đề xuất `BrokerSession` của audit là **greenfield**, không phải sửa chỗ có sẵn. Phải tạo
mới `authenticate`/`refresh`/`close` trên `BrokerAdapter`.

**Audit thiếu:** `get_positions` (`:331-344`) + `get_orders` (`:346-359`) của TCBS cùng lỗi —
audit chỉ nêu `:305-329`.

---

## 10. Blast radius thật của P0-ISO-01 (nhỏ hơn audit)

`_get_user_portfolio` (`portfolio_analytics_views.py:25-27`) đúng 100%:

```python
25: def _get_user_portfolio(request, portfolio_id):
26:     """Raise 404 if portfolio not owned by request.user."""
27:     return get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
```

Grep toàn file: `TenantScopePermission` **0 hit** (kể cả import). 8 view trong
`:64-252` đều `[permissions.IsAuthenticated]`.

**Nhưng chỉ 4 có route** (`urls.py:54-57`):

| Có route (reachable) | View | URL |
|---|---|---|
| ✅ | `PortfolioHoldingsView` (`:64`) | `/core/v1/workspace/portfolios/<id>/holdings/` |
| ✅ | `PortfolioSummaryView` (`:99`) | `…/summary/` |
| ✅ | `PortfolioAnalyticsView` (`:210`) | `…/analytics/` |
| ✅ | `PortfolioTechnicalsView` (`:232`) | `…/technicals/` |
| ❌ **code chết** | `PortfolioChartView` (`:133`) | import ở `urls.py:9-13`, **không** trong `urlpatterns` |
| ❌ **code chết** | `PortfolioEquityCurveView` (`:143`) | như trên |
| ❌ **code chết** | `PortfolioAllocationView` (`:178`) | như trên |
| ❌ **code chết** | `PortfolioSyncView` (`:223`) | như trên |

⇒ Sửa 4 view chết **không** đóng được lỗ hổng. Phạm vi đóng thật: **4 endpoint**.

**Cách sửa (đơn giản hơn audit nghĩ):** `request.tenant` **đã** có sẵn —
`settings.py:102` đăng ký `TenantResolutionMiddleware` → `middleware.py:112`
`request.tenant = tenant`. Không cần dependency `resolve_active_tenant` mới.

**Còn lại (thuộc `tenantreg-b`, không làm ở đây):** `_resolve_tenant` fallback
owner/first-member (`middleware.py:225-237`) khi không có header ⇒ chọn sai tenant. Sửa cái
đó mà chưa hợp nhất resolver sẽ tạo **resolver thứ 5** — đúng thứ `tenantreg-b` đang xoá.

**Thiếu coverage đã xác nhận:** `test_portfolio_analytics_native_routes.py:98-101` chỉ assert
404 cho portfolio của **user khác**; `setUp:31-32` tạo Portfolio **không truyền tenant**
(nhờ `signals.py:68-81` tự điền). Không test nào chứng minh tenant scope.

---

## 11. Chiến lược — những gì plan Rev.2 cần sửa

| Plan Rev.2 nói | Sửa thành |
|---|---|
| `:44` trích `views_dnse.py:190` | → `:292` |
| `:45` trích `portfolio_analytics_views.py:25-252` (8 view) | → chỉ 4 view reachable, `urls.py:54-57` |
| `:45` "FE lưu tenant ở `localStorage`… transport đọc `sessionStorage`" | Giữ, nhưng bổ sung: **`X-Tenant-ID` không bao giờ được gửi** (0 call site `setTenantId`) |
| `:47` "`migration 0008` query `TenantMember.is_active`" | Giữ; thêm điều kiện kích hoạt + `reverse_backfill` nguy hiểm hơn |
| `:46` "sửa DNSE worker tạo portfolio/subaccount/transaction với tenant" | **Chỉ `SubAccount`** là lỗ hổng thật; `Portfolio`/`Transaction` đã có signal cứu |
| `:47` "kill-switch fail-open … không có caller" | Giữ; thêm X.7 (`place_order` cũng I/O trong request) |
| `SAFE-02` "tách `paper-orders`/`live-orders`" | Phải fix **X.1** (400 regression) **trước** — hiện chức năng order đã hỏng |
| Không có | **Thêm X.2** (audit order no-op) vào `SAFE-02` — rẻ hơn nhiều nếu sửa `action` chứ không nới `max_length` |
| `:203` `utils/secret_store.py` (NEW) | OK, nhưng `*/migrations/*` đang do `tenantreg-c` claim ⇒ phải đi qua coordinator |
| Không có | `P0-MIG-01` cần **test seed tenantless row ở `0007` trước `0008`** (plan có nêu ở AC nhưng chưa có test file) |

---

## 12. Phân bổ file — cái gì bị chặn, cái gì FREE

`docs/CLAIMS.md` tại `523cd346` có **6 claim `in-progress`**. Bảng dưới là kết quả đối chiếu
từng file.

### 12.1 BỊ CHẶN — không được chạm (đã có agent giữ)

| File | Agent giữ | Portfolio finding bị chặn |
|---|---|---|
| `user_workspace/permissions.py` | `tenantreg-b` | P0-ISO-02 (BE), SAFE-03 |
| `identity_access/middleware.py` | `tenantreg-b` | P0-ISO-02 (BE), TEN-02 |
| `ops_audit/{middleware,views}.py` | `tenantreg-b` | P1-AUDIT-01, SAFE-04 |
| `identity_access/resolve_tenant.py` | `tenantreg-b` | TEN-01 |
| `identity_access/throttles.py` | `tenantreg-a` | P1-RATE-01 |
| `identity_access/models.py` | `tenantreg-c` | P1-CRED-01 |
| `*/migrations/*` | `tenantreg-c` | TEN-04, P0-ISO-03 |
| `web/context/PortfolioContext.js` | `tenantreg-e` | P0-ISO-02 (FE), TEN-03 |
| `web/adapters/core/transport.js` | `tenantreg-e` | P0-ISO-02 (FE), C-14 |
| `web/hooks/useCoreQuery.ts`, `web/providers/QueryProvider.tsx` | `tenantreg-e` | TEN-03 |
| `web/i18n/{vi,en}.js` | `tenantreg-d` | C-07, P2-UX-02 |
| `web/adapters/coreApiAdapter.d.ts` | `tenantreg-d` | P1-CONTRACT-01 |
| `vninvest_core/settings.py`, `env_validation.py` | `tenantreg-s` | P1-CRED-01 |
| `docker-compose*.yml`, `.env*`, `package.json`, `requirements.txt` | **deny list** §2 | SEC-01/02/03, SAFE-01, SAFE-06/07 |

⇒ **Khoảng 60% P0/P1 của audit đã nằm trong tay 6 agent hiện tại.** Không mở agent mới cho
phần này — sẽ tạo resolver thứ 5, storage SSOT thứ 3, và đụng file đang giữ.

### 12.2 FREE — 4 nhóm file-disjoint, không agent nào chạm

| Nhóm | File | Đóng finding |
|---|---|---|
| **PA-1** order safety | `user_workspace/views_dnse.py`, `user_workspace/urls.py`, `user_workspace/dnse_adapter.py` + test mới | P0-SAFETY-01, **X.1**, **X.2**, X.3–X.6, P1-CONTRACT-00 |
| **PA-2** analytics scope + ledger | `user_workspace/portfolio_analytics_views.py` + `ledger/` mới + test mới | P0-ISO-01, P0-DATA-03, X.10 |
| **PA-3** broker hub | `user_workspace/broker/{tcbs,adapters,ssi,base}.py` + test mới | P1-SEC-01, P1-AUTH-01, C-04, X.8 |
| **PA-4** models + worker | `user_workspace/models.py`, `user_workspace/tasks.py`, `user_workspace/signals.py` + migration | P0-ISO-03, P0-DATA-01, P0-DATA-02, X.9, X.10 |

**Kiểm tra chồng lấn giữa 4 nhóm (phải = 0):**
- PA-1 ↔ PA-4: PA-1 **không** tạo model `OrderJob` (đẩy sang `SAFE-05`); idempotency đặt
  ở file mới dùng cache ⇒ không đụng `models.py`.
- PA-2 ↔ PA-4: PA-4 thêm validator cho `Transaction`; PA-2 chỉ **đọc**, không phụ thuộc
  validator ⇒ không cần merge thứ tự.
- PA-1 ↔ PA-3: PA-1 dùng `dnse_adapter.py`/`vnbroker_dnse_compat.py`; PA-3 chỉ `broker/*`
  ⇒ tách bạch.
- Migration: `user_workspace` leaf = `0018`. `tenantreg-c` chỉ claim
  `identity_access`/`tenant_lifecycle`/`commercial`/`data_ingest` ⇒ **không trùng app**.
  Vẫn phải đọc head thật ở `dev` trước khi sinh (`AGENT_PROTOCOL.md` §4).

---

## 13. Test coverage gap — cập nhật sau verify

Thêm vào danh sách của audit §J3 (audit liệt 11 mục):

| # | Gap | Bằng chứng |
|---:|---|---|
| 12 | **Không có test BE nào chạm order path** | grep `place_order`/`dry_run`/`_validate_order_payload`/`broker_order` trong toàn bộ `test_*.py` ⇒ 0 hit. Đây là lý do X.1 lọt |
| 13 | Không có test khẳng định audit `action` ghi được | X.2 lọt vì không test nào assert `AuditEvent` cho order |
| 14 | Test FE order mock `placeOrder` nên không bắt được contract mismatch | `whale-advisory-alert-order.component.test.tsx:54-59` |
| 15 | Không có test cho `SubAccount` tenant NOT NULL qua signal | `signals.py:68-72` không có `SubAccount` receiver |
| 16 | Không có test cho 5 read-only call site `DNSECredential` trong `tasks.py` | `:39, :50, :59, :131, :189` |
| 17 | Không có test parity cho 4 trang portfolio (chỉ có key parity) | 125 key orphaned, 0 call site |
| 18 | Không có test cho `dnse_create_trading_token` / `send_email_otp` `dry_run` | audit tưởng không parse ⇒ không ai test |

---

## 14. Điều CHƯA verify — ghi rõ, không suy diễn

| Hạng mục | Trạng thái |
|---|---|
| `python manage.py check` / `makemigrations --check` | **CHƯA CHẠY** — phiên verify read-only, không chạy lệnh |
| BE test suite | **CHƯA CHẠY** |
| HTTP probe cross-tenant 200 (lại) | **CHƯA CHẠY** — chỉ xác nhận code path tĩnh |
| Reproduce `FieldError` của `0008` bằng seed thật | **CHƯA CHẠY** — chỉ đọc migration state + model |
| Cột `subaccount.tenant` NOT NULL ở DDL Postgres | **CHƯA CHẠY** — suy từ `AlterField` 0012 không khai `null=` + khớp `models.py:348` |
| `vnbroker` connector có thực sự tôn trọng `dry_run` không | **CHƯA XÁC MINH** — editable install trỏ `C:\Mujoco Projects\vnbrokder` (thư mục **KHÔNG TỒN TẠI**), `import vnbroker` → `ModuleNotFoundError` ⇒ không đọc được body thư viện ngoài repo |
| Broker nhận key `volume` hay `quantity` | **CHƯA XÁC MINH** — cùng lý do |
| 8 view còn lại trong `portfolio_analytics_views.py` (screener/userconfig) tenant scope | **CHƯA CHẠY** — mới chỉ đọc `permission_classes`, chưa trace query |
| Đường dẫn `/api/...` legacy qua `legacy_proxy` | **CHƯA CHẠY** |

**Sai sót của chính quá trình verify (minh bạch):**
1. Lúc đầu grep `subaccount` trong migrations, thấy `0003` có `AddField` nhưng tưởng
   không có field nào tên `portfolio`, suy ra thêm 1 lỗi thứ hai trong `0008`
   (`select_related('portfolio')` FieldError vô điều kiện). Đọc
   `0003_...py:31-35` mới xác nhận field **có** ⇒ kết luận sai đã bị loại.
2. `git grep -In -E … -- .` trả rỗng trong khi `git grep -n <pattern>` (không pathspec) ra
   kết quả. Nếu chỉ chạy bản có pathspec sẽ kết luận nhầm "không có secret nào".
3. `rg` không có trong PATH ⇒ 2 lượt grep đầu trả "NO MATCH" sai; đã chạy lại bằng
   `grep`/`Select-String`. Mọi kết luận dựa trên lượt chạy lại.

---

## 15. Kết luận

| Hạng mục | Đánh giá sau verify |
|---|---|
| Implementable | **Có** — 4 nhóm file-disjoint đã xác định, không cần chờ agent khác |
| Blocker live-money | **Có, không đổi** |
| Tenant isolation | **FAIL** — `X-Tenant-ID` không bao giờ được gửi; analytics cross-tenant vẫn 200 |
| Financial correctness | **FAIL** — `_compute_holdings` không phải sổ cái, không có tiền mặt, không có realized P&L |
| Order safety | **FAIL, nặng hơn** — chức năng đang **hỏng** (X.1) **và** audit **không ghi được** (X.2) |
| Migration readiness | **FAIL** — `0008` lỗi với tenantless row; `reverse_backfill` nguy hiểm hơn |
| Security readiness | **FAIL, nặng hơn nhiều** — 21 dòng/4 token + `compose.dev.env` lộ Fernet key |
| Broker readiness | **Partial** — SSRF không validate; 0/3 adapter có lifecycle |
| Test readiness | **FAIL** — 0 test BE cho toàn bộ order path |
| Legal readiness | **FAIL** — chưa verify, cần owner |

**Câu hỏi cần owner quyết (không tự trả lời được):**
1. Xoá 11 file `scratch/*.py` hay giữ làm script local? (`scratch/` có trong `.gitignore` không?)
2. `compose.dev.env` — untrack + tạo example sạch, hay giữ tracked cho dev?
3. Người duy nhất được sửa FE trang portfolio là ai, khi 6 agent đang chạy?
4. Có ký commercial license `vnbroker` không (quyết định R3 có tồn tại hay không)?
5. Cho phép live order trong phạm vi VNInvest, hay chỉ paper/analytics ở release đầu?
