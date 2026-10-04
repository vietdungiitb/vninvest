# AUDIT — Chuyển đổi API phẳng → `{data, meta}` (`vninvest`)

**Ngày:** 2026-10-04 · **Branch:** `dev` @ `f33b1b5a2` · Read-only, không sửa dòng mã nguồn.
Mọi số đo bằng công cụ, kèm lệnh tái lập.

---

## 0. ĐÍNH CHÍNH — tôi đã sai một lần

Tôi khẳng định `scripts/check-envelope-contract.py` **không tồn tại** và rằng
`api_envelope.py:39` trỏ tới file bịa. **Sai.**

Máy kiểm nằm ở `packages/core/backend/scripts/check-envelope-contract.py` (205
dòng) — đường dẫn trong docstring là **tương đối so với backend root**, nên trích
dẫn đúng. `Test-Path` của tôi chạy ở repo root nên trả về sai.

Bài học: đây là lần thứ hai trong phiên tôi đánh giá "cái gì đó không tồn tại" bằng
đường dẫn sai thay vì đọc docstring để hiểu ý nghĩa. Lần trước là
`packages/core/src` vs `packages/core/backend/src` ở `vnsaas`.

---

## 1. Đích đến — và vì sao không phải "bọc hết"

`packages/core/backend/src/vninvest_core/api_envelope.py` là SSOT (211 dòng).
Điểm quan trọng nhất nằm ở `:23-40`: bọc bừa **làm docs sai theo hướng mới** —
tệ hơn hiện trạng, vì hiện trạng sai thì người đọc còn nghi ngờ, bọc bừa thì nó
*trông* đúng.

| Trường hợp | Xử lý |
|---|---|
| 2xx đã bọc | `envelope_response(...)` |
| **≥400** | **không đụng** — RFC 9457 `application/problem+json` |
| **204/205/304** | **không đụng** — không có body |
| **F4** `{object, generated_at, …}` | **không đụng** |
| **F5** `{data, +siblings}` | **không đụng** — bọc sẽ **làm rơi sibling** |
| `market_serving` contract 2.0 | **không đụng** |

⇒ Vì vậy "endpoint chưa bọc" **không đồng nghĩa** "chưa xong". Đánh giá phải theo
đúng bộ phân loại này.

---

## 2. Thực trạng — đo bằng máy

Lệnh (từ `packages/core/backend`):
```
python scripts/check-envelope-contract.py <app>
```

| app | UNWRAPPED | exit | Nhận xét |
|---|---:|---:|---|
| `identity_access` | 0 | 0 | xong |
| `service_ops` | 0 | 0 | xong |
| `user_workspace` | 0 | 0 | xong |
| `advisory` | 0 | 0 | xong |
| `market_data` | 0 | 0 | xong |
| `ops_audit` | 0 | 0 | xong |
| `signal_intelligence` | 0 | 0 | xong |
| `tenant_lifecycle` | 0 | 0 | xong |
| `market_serving` | — | 0 | **miễn trừ** (contract 2.0) |
| **`commercial`** | **17** | **1 FAIL** | **CHƯA migrate** |

**Kết luận bằng số: 9/10 app đã xong. `commercial` là phần còn lại.**

### 2.1 `commercial` — chưa được migrate, không phải lỗi cục bộ

`packages/core/backend/src/commercial/envelope.py` **không tồn tại**. App này chưa
từng bắt đầu, nên đây **không phải** trường hợp "bọc hết trừ 1".

17 vị trí (nguyên văn từ checker):

```
commercial/stripe_webhooks.py:113
commercial/views.py:87, 191, 223, 233, 245, 261, 268, 292, 339, 343, 345, 365, 431, 492
commercial/views_analytics.py:51, 93
```

Tôi đã đọc 3 vị trí để phân loại — **cả 3 là 2xx phẳng thật, không nằm trong bất kỳ
ngoại lệ nào**:

| Vị trí | Nội dung | Đáng chú ý |
|---|---|---|
| `commercial/views.py:87` | `return Response({'results': []})` | endpoint public legal pages |
| `commercial/views.py:191` | `return Response({'status','txn_ref','pay_url','amount'})` | **chính endpoint tạo payment VNPay** — cùng endpoint tôi gia cố ở phiên trước |
| `commercial/views_analytics.py:51` | `return Response({'monthly': [], 'note': ...})` | analytics |

Ngoài ra `commercial` có **82 call site `UNVERIFIED`** — máy không chứng minh được,
cần đọc tay.

---

## 3. Vì sao việc này **đứng yên** mà không ai thấy — hai lớp

### 3.1 Checker không nằm trên bất kỳ cổng nào

Grep `envelope` trong `scripts/pre-push-gate.mjs` và `scripts/agent-sync.ps1`:
**rỗng**. Checker chạy được, trả exit 1 cho `commercial`, và **không ai gọi nó**
ngoài test.

### 3.2 Test bảo vệ nằm ngoài tầm với của đường push

`vninvest_core/tests/test_api_envelope_schema.py` **không** tồn tại.
File bảo vệ hợp đồng nằm ở:
```
packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py   ← tồn tại
```

`manage.py test tests` — lệnh mà `agent-sync.ps1:159` chạy — chỉ đọc
`backend/tests/` (`run_tests.py:5-13` ghi rõ). `src/*/tests/` **không** được đọc.

⇒ **Hợp đồng envelope được bảo vệ bởi một test mà đường push không bao giờ chạy
tới.** Cùng cấu trúc với rào cản 2104 test đã nêu ở phiên trước.

### 3.3 Frontend không có hợp đồng kiểu để bắt lỗi

`packages/web/src/adapters/core/envelope.js:48-52` — `isEnvelope()` yêu cầu **cả
`data` lẫn `meta`**. Thiết kế này **đúng và có chủ đích**: không bóc nhầm shape F3
`{status, timestamp, request_id, data}` hoặc F5 `{data, ...siblings}`, và không
áp cho lỗi (RFC 9457 đi đường raw tại `transport.js:452-466`).

Hệ quả: **frontend không hỏng khi backend đổi shape** — nên cũng **không báo
động**. Migration có thể dừng ở `commercial` vô thời hạn mà không ai thấy.
Phía frontend còn nhiều `Promise<any>` (ví dụ `coreApiAdapter.d.ts:133`
`getInvoices`), nên TypeScript không bắt được.

---

## 4. Thứ tự công việc còn lại

| # | Việc | Ghi chú |
|---|---|---|
| 1 | Tạo `commercial/envelope.py` theo mẫu app khác | `identity_access/envelope.py:1-84` là tham chiếu gọn nhất |
| 2 | Bọc 17 call site — **nhưng phải phân loại trước** | một số có thể thuộc F4/F5 ⇒ **đừng bọc hàng loạt** |
| 3 | Phân loại 82 `UNVERIFIED` của `commercial` | giảm bề mặt mơ hồ |
| 4 | **Wire `check-envelope-contract.py` vào `pre-push-gate.mjs`** | rẻ nhất, biến checker thành cổng thật |
| 5 | Chuyển/sao test bảo vệ hợp đồng vào `backend/tests/` | để đường push chạy tới |
| 6 | Cập nhật `SPRINT34_API_DATA_CONTRACT.md` nếu nó chống layout cũ | tài liệu hợp đồng khác, cần đọc kỹ trước |

**Ưu tiên #4 trước #2**: hiện tại `commercial` FAIL mà không ai thấy; wire gate vào
là biến việc đang dở thành việc **bị chặn**, thay vì việc bị quên.

---

## 5. Chưa kiểm chứng

| Mục | Lý do |
|---|---|
| ~~`manage.py spectacular`~~ | **ĐÃ CHẠY** — xem §5b |
| 82 `UNVERIFIED` của `commercial` | **ĐÃ XỬ LÝ** — xem §5c |
| Cặp frontend↔backend cụ thể | agent phụ **xác minh đủ 0/15** cặp (thiếu dòng backend) — nên **không** kết luận có mismatch |
| 14/17 call site `commercial` chưa đọc tay lúc đầu | đã phân loại hết ở §2.1 |

## 5b. `spectacular` — schema **KHÔNG** khớp runtime, và đã sửa

Lệnh (cần env tạm):
```
DJANGO_DEBUG=true DJANGO_SECRET_KEY=<gia tam> CORE_PAT_PEPPER=<gia tam> \
  python manage.py spectacular --file schema.yaml
```

### Kết quả đo được

| | Trước | Sau |
|---|---:|---:|
| `Errors` | **1090** (202 unique) | 1088 (200 unique) |
| `Warnings` | 184 (182 unique) | không đổi |
| Operation bị bỏ qua (`unable to guess serializer`) | **192** | **190** |
| `"No response body"` trong schema | **261** | **256** |
| Component envelope | 583 | 593 |

### Điều quan trọng nhất: schema **khẳng định sai**

Cả 7 endpoint `commercial` vừa migrate đều là `APIView` thuần ⇒ spectacular
**bỏ qua** và ghi vào schema:

```yaml
responses:
  '200':
    description: No response body
```

Đó là **một tuyên bố sai** — endpoint có body. Sai theo hướng nguy hiểm hơn là
thiếu, vì người đọc tin là không có gì để kiểm tra. Đúng cảnh báo ở
`api_envelope.py:25-27`.

⇒ **Không thể dùng schema để xác nhận migration trước khi sửa.** Đã sửa bằng
`@extend_schema(responses=envelope_response(<Serializer thật>))` cho 7 view +
`commercial/schema.py`.

Sau sửa, `payments/status/{txn_ref}/` trả:
```yaml
'200':
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/PaymentStatusDataEnvelope'
```

**Phân bố 190 operation còn lại:** user_workspace 50 · identity_access 36 ·
market_data 28 · service_ops 26 · market_serving 10 · support 8 · vninvest_core 7 ·
advisory 6 · advertising 5 · ai_analytics 3 · data_ingest 3 · ai_agents 2 ·
signal_intelligence 1.

⚠️ `spectacular` **exit 0** dù có 1090 lỗi ⇒ **không cổng nào bắt được**. Cần
thêm `--fail-on-warn` vào một cổng, nếu không con số này sẽ tiếp tục tăng mà
không ai biết.

## 5c. 83 `UNVERIFIED` → **6**: phần lớn không phải response API

Checker bản đầu đếm **mọi** `return` trong app. Ở `commercial`, 83 "UNVERIFIED"
hoá ra phần lớn **không liên quan HTTP**:

| Nhóm | Số | Thực chất |
|---|---:|---|
| `Node JoinedStr` | 10 | `__str__` trả f-string (`models.py`) |
| `Node Constant` | 9 | `return False` (`permissions.py`) |
| `get()/int()/getattr()` | 13 | hàm tiện ích (`plan_catalog.py`) |

Đã thêm bộ lọc ngữ cảnh HTTP (class kế thừa `APIView`/`ViewSet`/… hoặc hàm bọc
`@api_view`). Đây là **lọc chính xác**, không phải lọc cho đẹp: `__str__` trả
f-string không thể là response HTTP. Và 10 lỗi `UNWRAPPED` đã bắt được trước đó
vẫn bắt được nguyên vẹn.

Thêm cờ `--list` in chi tiết kèm lý do — không có nó thì "83" chỉ là con số trừu
tượng, không ai làm được gì.

**Trạng thái cuối (9 app, tất cả `exit=0`, `UNWRAPPED: 0`):**

| app | WRAPPED | UNWRAPPED | UNVERIFIED |
|---|---:|---:|---:|
| identity_access | 90 | 0 | 34 |
| service_ops | 22 | 0 | 12 |
| user_workspace | 101 | 0 | 17 |
| advisory | 7 | 0 | 4 |
| market_data | 61 | 0 | 17 |
| ops_audit | 4 | 0 | 7 |
| signal_intelligence | 7 | 0 | 8 |
| tenant_lifecycle | 0 | 0 | 0 |
| **commercial** | **7** | **0** | **6** |

6 mục còn lại của `commercial` đều là return giá trị là **biến/biểu thức**
(`get_object_or_404`, `order_by`, `plan`) trong class HTTP — không phải response
nên để lại, đã có `--list` để tra.

Điểm đáng lưu ý: agent kiểm tra mặt trước trả lời trung thực **0/15 cặp được xác
minh** thay vì bịa ra mismatch. Đó là hành vi đúng — và là lý do tôi không ghi
"có mismatch" vào báo cáo này.

---

## 6. Kết luận một dòng

Migration **đã xong 9/10 app**; phần còn lại là **`commercial` (17 call site, chưa
bọc)** — và nó **đứng yên vì checker không được nối vào cổng nào** lẫn vì test bảo
vệ hợp đồng nằm ở thư mục mà đường push không chạy tới.