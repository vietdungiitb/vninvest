# PA-5 — FE order contract (ghi nợ PA-1)

**Agent:** `pf5-orderfe` · **Branch:** `feat/pf5-orderfe` · **Worktree:** `C:\Mujoco Projects\pf5-orderfe`
**Base:** `dev` sau khi merge PA-1..PA-4
**Đóng nợ:** claim `pf1-ordersafety` đã ghi — *"Đặt lệnh đang TẮT cho tới khi FE sửa — `DNSEConnectionPanel.js:207-218` và `AdvisoryOrderTicket.js:43-53` gửi không `mode`/`Idempotency-Key` nên luôn 400"*

---

## 1. Vì sao order vẫn 400 trước PA-5

PA-1 (PR #14) làm BE fail-closed đúng như thiết kế, nhưng cả 3 endpoint DNSE đều gọi
`_resolve_order_mode(request.data)`:

| Endpoint | BE yêu cầu | FE gửi (trước PA-5) | Kết quả |
|---|---|---|---|
| `place-order` | `mode` ∈ {`paper`,`live`} trong **body** | không | 400 `order_mode_required` |
| `place-order` | `Idempotency-Key` là **header** | không | 400 `idempotency_key_required` |
| `send-email-otp` | `mode` trong body | `sendDNSEEmailOtp()` không arg | 400 `order_mode_required` |
| `create-trading-token` | `mode` trong body | không `mode` | 400 `order_mode_required` |

X.1 đã đóng phía BE trước đó (đọc `quantity` thay vì chỉ `volume`), nhưng lớp fail-closed mới
chặn ở tầng trên ⇒ **triệu chứng người dùng không đổi: vẫn 400**, chỉ khác mã lỗi.

## 2. Ràng buộc phối hợp — vì sao KHÔNG đụng `transport.js`

`Idempotency-Key` phải là **header**, mà `corePost` chỉ nhận `options`. Đã xác minh trước khi
sửa (không đoán):

- `transport.js:417` `corePost(path, body = undefined, options = {})` → `const { onRateLimit, ...fetchOptions } = options` → spread vào `requestWithAuth(path, { method, body, ...fetchOptions }, …)`.
- `requestWithAuth` dựng header: `{ "Content-Type", "X-Request-ID", ...getAuthorizationHeader(...), ...(init.headers || {}) }` ⇒ **`init.headers` được merge, không bị ghi đè**.

⇒ Truyền `{ headers: { "Idempotency-Key": key } }` qua `options` là đủ.
**`packages/web/src/adapters/core/transport.js` thuộc `tenantreg-e` ⇒ PA-5 KHÔNG sửa file đó.**

Cũng **không** thêm i18n key (`vi.js`/`en.js` thuộc `tenantreg-d`), **không** sửa
`coreApiAdapter.d.ts` (thuộc `tenantreg-d`).

## 3. Thay đổi

### `packages/web/src/adapters/core/workspace.js` (SSOT của contract)

- Thêm `newOrderIdempotencyKey()` — `crypto.randomUUID()`, fallback `dnse-<ts>-<rand>`.
  **Không** cache key theo symbol/form: BE so sánh fingerprint nên cùng key + khác payload ⇒
  `idempotency_key_conflict`.
- Thêm `resolveDnseMode(data)` — mặc định `paper`, validate chỉ nhận `paper|live`, **throw
  đồng bộ** để fail-fast không tốn request.
- `placeDNSEOrder(data, options = {})` — thêm `options.idempotencyKey` (cho replay có chủ
  đích), default `market_type`/`order_category` nếu caller không truyền, gửi header
  `Idempotency-Key`. **Bỏ** `dry_run` khỏi JSDoc — BE đã từ chối boolean này.
- `sendDNSEEmailOtp(params = {})` / `createDNSETradingToken(data)` — thêm `mode`.
  JSDoc `dry_run?: boolean` sai ⇒ đã sửa.

### `packages/web/src/components/DNSEConnectionPanel.js`

- `handlePlaceOrder` (`:207`) thêm `mode: "paper"`.
- `handleSendOtp` (`:160`) → `sendDNSEEmailOtp({ mode: "paper" })`.
- `handleCreateTradingToken` (`:177`) → `createDNSETradingToken({ …, mode: "paper" })`.

### `packages/web/src/components/advisory/AdvisoryOrderTicket.js`

- `handleConfirm` (`:43`) thêm `mode: 'paper'`.

**Chỉ gửi `paper`.** `live` bị BE từ chối `live_ordering_disabled` cho tới khi có policy +
OTP + confirm + risk limit + commercial license `vnbroker` (plan `D-01`, `D-21`, Exit-5).

## 4. Test

**MỚI — `packages/web/src/adapters/core/__tests__/dnse-order-contract.test.js` (16 test).**
Không có test nào trước đây kiểm tra contract này — đó mới là lý do X.1 lọt: test
`whale-advisory-alert-order` **mock** `placeOrder` nên luôn xanh dù payload sai.

Covers: `mode` default `paper` · header `Idempotency-Key` có mặt **và không** nằm trong body ·
key mới mỗi lần submit · caller truyền key được · `market_type`/`order_category` default ·
mode sai ⇒ throw **trước** khi gọi mạng · `mode: ''`/`undefined` ⇒ vẫn `paper` · thiếu
`trading_token`/`payload` ⇒ throw, không gọi mạng · **không còn** `dry_run` · OTP + trading
token cũng có `mode` · giữ nguyên `otp_type`/`passcode` · thiếu `passcode` ⇒ throw.

**CẬP NHẬT — `whale-advisory-alert-order.component.test.tsx:54`**
`toHaveBeenCalledWith` là deep-equal nên thêm `mode: "paper"` làm test đỏ. Đã cập nhật kỳ
vọng + comment giải thích vì sao `mode` bắt buộc.

### Sai lệch trong lúc viết test (ghi lại vì đáng nhớ)

Lần đầu 4 test đỏ vì tôi dùng `expect(...).rejects.toThrow()` trong khi adapter **throw
đồng bộ** (fail-fast trước network). Sửa thành `expect(() => ...).toThrow()`. Đây là lỗi của
kỳ vọng test, **không** phải lỗi code — sửa code theo test sai sẽ thành network call thừa.

## 5. Gate — kết quả thật

| Gate | Kết quả |
|---|---|
| `npx tsc --noEmit` | **PASS** — exit 0, 0 lỗi |
| `npm test` (jest) | **PASS** — 18 suites, **255/255** |
| `npm run test:components` (vitest) lần 1 | **PASS** — 92 files, **545/545** |
| `npm run test:components` lần 2 | **ĐỎ** — 1 failed / 544 passed (xem §6) |
| `npm run test:components` lần 3 | **ĐỎ** — 1 failed / 544 passed (xem §6) |
| `npx eslint` 3 file đã sửa | **PASS** — 0 error |
| `npm run build` | **PASS** — 3664 modules, built in 45.67s |
| `npm run i18n:scan` | exit 0 (chỉ cảnh báo `default value` pre-existing) |
| `npm run check:i18n-hardcoded` | **PASS** — `OK: 0 chuoi tieng Viet hardcode trong 19 file` |
| `npm run check:shell` | **PASS** — exit 0 |
| `node packages/web/scripts/check-multi-agent.mjs` | xem §7 |

## 6. D-19 **CHƯA ĐẠT** — 3 lần liên tiếp xanh

Plan `IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:120` (D-19) yêu cầu
`test:components` chạy 3 lần liên tiếp cùng commit, cả 3 xanh mới được ký release.

Kết quả: **1 xanh, 2 đỏ** — cùng một test:
`src/hooks/useAlertCenterSnapshot.pagination.component.test.ts` › *"bóc token cursor từ
`next` URL đầy đủ của BE (fix 404 Invalid cursor)"* · `expected "vi.fn()" to be called 2 times,
but got 1 times`.

**Đã chứng minh pre-existing, KHÔNG phải do PA-5:**

1. Chạy `npm run test:components` trên **main tree `dev` sạch** (không có PA-5) → **cùng
   test đỏ**, `1 failed | 544 passed (545)`. Kết quả giống hệt.
2. Chạy riêng file đó → **3/3 PASS** mọi lần.
3. PA-5 không sửa file nào liên quan: chỉ `adapters/core/workspace.js`,
   `components/DNSEConnectionPanel.js`, `components/advisory/AdvisoryOrderTicket.js`, 2 file
   test DNSE. Test flaky thuộc `hooks/useAlertCenterSnapshot` (Alert Center).
4. Đã ghi ở `AGENTS.md` Entry 231: *"test `useAlertCenterSnapshot.pagination.component.test.ts`
   fail **không ổn định** trong full suite (riêng file luôn 3/3). Tái lập ở HEAD:
   `1 failed | 79 passed`, cùng test này. Đừng quy cho code mới."* — khớp.

⇒ **Cần ticket riêng để dập test flaky này.** Không phải việc của PA-5, không sửa ở đây
(sửa test flaky bằng cách thêm delay là che triệu chứng, không phải gốc).

## 7. Còn lại / việc ngoài phạm vi

| Mục | Vì sao chưa làm |
|---|---|
| Expose `live` ở UI | Cần Exit-5: OTP + confirm + risk limit + **commercial license `vnbroker`** (plan `D-21`). License chưa ký ⇒ R3 không tồn tại |
| `Idempotency-Key` bền vững hơn | PA-1 dùng Django `cache`; `TESTING` là LocMemCache, prod Redis. Nếu prod cấu hình LocMemCache multi-process thì còn cửa sổ trùng ⇒ thay bằng `OrderJob` + unique `(user,scope,key)` ở wave sau |
| `ops_audit.AuditEvent.action` `max_length=16` | Quá hẹp cho `broker.*`. Nới + thêm choice cần migration ⇒ `ops_audit/**` (tenantreg-b) + `*/migrations/*` (tenantreg-c). PA-1 đi vòng bằng `action='create'` + `metadata['operation']` |
| `order_type` (`'LO'`) trong payload | Chưa validate — không có nguồn allowlist đáng tin trong repo thì thêm lúc này là **bịa contract**. Cần đối chiếu DNSE OpenAPI chính thức |
| `dry_run` còn ở `dnse.js:70` | Backfill path, không liên quan order |

## 8. Test đỏ trước fix (bằng chứng lỗi là thật)

`whale-advisory-alert-order.component.test.tsx` chạy trên `dev` sạch **không hề đỏ** dù
payload thiếu `mode` + `Idempotency-Key` — vì `placeOrder` là `vi.fn()` mock
(`:44`), không chạm network. Sau khi thêm `mode`, test đỏ:

```
FAIL  src/components/__tests__/whale-advisory-alert-order.component.test.tsx
      > AdvisoryOrderTicket (S14 G5) > prefills symbol/price, never auto-submits,
        posts only on explicit confirm
AssertionError: expected "vi.fn()" to be called with arguments: [ { market_type: 'STOCK', …(3) } ]
```

Đây chính là mẫu lỗi đã khiến X.1 lọt: **test mock transport ⇒ contract mismatch vô hình.**
`dnse-order-contract.test.js` mới kiểm tra ở tầng adapter, nơi `corePost` cũng là mock nhưng
**assert được header và mode thực sự được truyền**.
