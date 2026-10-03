# Kế hoạch: chuẩn hoá success envelope sang `{data, meta}`

`verified: 2026-09-30 @ 3ebe9424` · trạng thái: **DRAFT — chờ owner duyệt, chưa code**

Bối cảnh và số đo: [`../evidence/api02/CONTRACT_DECISION.md`](../evidence/api02/CONTRACT_DECISION.md)
· [`survey-a`](../../evidence/api02/survey-a-success-envelopes.md)

---

## 0. Đảo thứ tự: vài sao lệch so với trực giá ban đầu

Tôi từng đề xuất "migrate dần vì phí FE cao". Đo thật thì **sai**:

| Giả định ban đầu | Đo được |
|---|---|
| Phí FE cao, cần viết normalizer mới | **5 điểm unwrap**, `transport.js:459/490/512/535` + `coreAdapter.js:69`. 26 file component **không đụng**. |
| Normalizer là thứ mới | Đã có sẵn **10 nơi** dual-read (`response.data ?? response`) |

Nhưng đo ra cũng lộ ra một rủi ro mà lúc đề xuất tôi không nghĩ tới, và nó **lớn hơn**
phần việc kỹ thuật:

> Trong FE có `const marketValue = Number(summary?.total_market_value) || 0;`
> (`smart-stats-header-null-value.component.test.js:8` ghi lại chính cái bẫy này).
> Nếu unwrap hỏng ⇒ `undefined` ⇒ `Number(undefined) || 0` ⇒ **hiển thị 0**.
> Đó là "0 giả" — loại lỗi người dùng **không báo lỗi**, chỉ thấy tiền bằng 0.

Nên thứ tự đúng là: **chữa nền test trước, migrate sau.** Lý do ở §5.

---

## 1. Mục tiêu

1. Mọi response 2xx có body trả về một hình dạng thống nhất mà client đọc được bằng **một** quy tắc.
2. Provenance (`as_of`, `stale`, `calculation_version`, `source`) có **một** schema, thay vì 8 chỗ tự phát minh tên key.
3. Migration **không** làm hỏng bất kỳ màn hình nào đang chạy đúng.

## 2. KHÔNG làm (non-goals)

- **KHÔNG** đụng envelope lỗi. Đã hội tụ RFC 9457 ở `59b459dd`; việc đó là scope riêng.
- **KHÔNG** sửa 85 test đang đỏ trong một cùng PR. Tách ticket.
- **KHÔNG** đổi schema response của `/api/*` (legacy proxy) — nằm ngoài repo.
- **KHÔNG** đụng SSE (`sse.py:42`) và WebSocket/channels: không đi qua `Response(dict)`, không so sánh được với JSON envelope.
- **KHÔNG** sinh `count` cho `CursorPagination` trong PR này (xem §6, quyết định còn treo).
- **KHÔNG** bọc 204 rỗng (21 endpoint) — không có body để bọc.

## 3. Quy tắc bọc, theo từng họ

Bọc **không đồng loạt** — 5 họ khác nhau cần cách khác nhau:

| Họ | Số | Quy tắc | Ghi chú |
|---|---:|---|---|
| F1 mảng trần | 19 | `{data: [...], meta: {...}}` | |
| F3 `{status,timestamp,request_id,data}` | 12 | giữ nguyên — **đã khớp ý đích** | Đây là mẫu duy nhất đã đúng |
| F6 phân trang | 91 | `{data: {results, next, previous}, meta: {...}}` | Bọc cả khối, **không** nhét `results` lên cùng |
| F7/F7x ACK | 53 | `{data: {message/ok}, meta: {}}` | `meta` rỗng vẫn phải có — thiếu nó là lệch luật |
| F8 `serializer.data` | 104 | `{data: serializer.data, meta: {}}` | |
| F9 dict dựng tay | 282 | `{data: {...}, meta: {...}}` | khối lớn nhất |
| F0 204 rỗng | 21 | **không bọc** | |

**Còn lại 4 endpoint F4/F4b/F5** (`object`/`generated_at`/`summary_cards`) là nghiệp vụ riêng — tách khỏi đợt này, ghi rõ trong OpenAPI riêng.

## 4. Các bước

### B1 — Bản đồ (CHƯA LÀM, là bước chặn)

Script map, cho ra 4 cột: `route` · `call site (file:line)` · `test bảo vệ` · `FE consumer`.

Không có cột "test bảo vệ" thì không được migrate — không có gì bắt sai.

**Gate B1:** script chạy thật, output vào `docs/evidence/api02/endpoint-map.csv`, số dòng khớp tổng call site đếm được ở `survey-a`.

### B2 — Chữa nền test (đề xuất mới, chèn trước B3)

Hiện có **85 test đỏ chưa phân loại đầy đủ** (`survey-c` bị hủy), và **chưa từng chạy lại full 2746 test** sau 2 fix cuối.

Không có nền xanh thì không phân biệt được "hỏng vì migrate" với "hỏng sẵn". Đây là lý do B3 phải sau B2.

**Gate B2:** `python run_tests.py` chạy thật, lưu output. 85 lỗi được phân loại theo nhóm (`STALE_URL` / `SUPERSEDED` / `TEST_BUG` / `REGRESSION` / `TIME_DEPENDENT` / `ENV` / `REAL_BUG`). Mọi `REAL_BUG` sửa hoặc ghi ticket. Số lỗi còn lại **ghi rõ trong commit**, không ghi "PASS".

### B3 — Unwrap ở FE, trước khi backend đổi

Thêm helper `unwrapEnvelope(res)` = `res?.data ?? res`, đặt tại `transport.js`, dùng ở 5 điểm: `transport.js:459/490/512/535` + `coreAdapter.js:69`.

**Điều kiện bắt buộc — chống "0 giả":**

Helper **không** được ép `undefined` → `0`/`null`. Kiểm tra bằng test: payload không có `data` thì trả nguyên payload, **không** trả `{}`.

**Gate B3:** `npm run test` xanh; có test riêng chứng minh (a) unwrap đúng, (b) unwrap **không** nuốt payload phẳng, (c) `undefined` không thành `0`.

Sau B3, FE chịu được **cả hai** format ⇒ B4 không còn đợt nào phá màn hình.

### B4 — OpenAPI 3.1

Sinh schema từ serializer, kèm `example` thật cho từng họ.

**Gate B4:** `spectacular` chạy được (chưa từng chạy — CHƯA XÁC MINH); schema validate.

### B5 — Migrate backend theo bản đồ

Chia theo app, mỗi agent một nhóm `file` rời nhau. Không migration trước khi B3 xanh.

**Gate B5 mỗi lô:** `manage.py check` · `makemigrations --check` (phải 0 thay đổi — bọc envelope **không** được sinh migration) · test của nhóm đó · ruff không có lỗi mới.

### B6 — Dọn fallback

Khi một endpoint đã migrate xong, xoá fallback ở unwrap của endpoint đó — nhưng **chỉ** khi bản đồ xác nhận không còn consumer nào đọc dạng cũ.

## 5. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| **`Number(undefined) \|\| 0` ⇒ hiển thị 0 tiền** | CAO | Gate B3 chặn; test âm tính bắt buộc |
| Endpoint vừa là success vừa là error cùng shape | CAO | B1 bắt buộc; test trước, đổi sau |
| 85 test đỏ che lỗi migrate | CAO | B2 trước B5 — đây là lý do đảo thứ tự |
| Nửa vời: contract nói mới, thực tế hỗn hợp | TRUNG BÌNH | B3 cho phép cả hai; B6 dọn dần |
| 426 chỗ sửa tay sót | TRUNG BÌNH | Gate B1 (bản đồ) + test theo route |
| Không có CI (GitHub Actions đã tắt) | CAO | Mọi gate chạy tay + `CHƯA CHẠY` ghi rõ |

**Chưa đo được:** có bao nhiêu endpoint mà `meta` sẽ **rỗng** — `meta: {}` ở hơn nửa số endpoint là hình thức, không phải hữu ích. Có thể phải quyết định `meta` là bắt buộc hay tuỳ chọn.

## 6. Quyết định còn treo (cần owner)

1. **`meta` bắt buộc hay tuỳ chọn?** Bắt buộc ⇒ luật kiểm được nhưng nhiều `{}` rỗng. Tuỳ chọn ⇒ khớp `survey-a` (8/8 site có `meta` cấp trên cùng) nhưng không ép được.
2. **`CursorPagination` không có `count`** (91 response phân trang). Client không biết tổng số bản ghi. Có sửa trong PR này không?
3. **Có làm không?** B5 là 426 call site cơ học, **không có CI**, và 85 test đỏ chưa phân loại. Tôi đánh giá đây là việc **nên làm, nhưng không phải ngay** — và nếu làm thì B2 là điều kiện tiên quyết, không phải tuỳ chọn.

## 7. Ước lượng

| Bước | Cỡ |
|---|---|
| B1 bản đồ | nhỏ |
| B2 chữa nền test | trung bình — 85 test |
| B3 unwrap FE | nhỏ — 5 chỗ |
| B4 OpenAPI | trung bình |
| B5 migrate | **lớn — 426 call site**, chia được 3-4 agent song song |

Ước lượng này **chưa** kiểm chứng được tới khi B1 xong — nó dựa trên số call site của `survey-a`, chưa phải số dòng thực sự phải sửa.
