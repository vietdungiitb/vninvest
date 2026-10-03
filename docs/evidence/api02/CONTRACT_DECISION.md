# API-02 — Quyết định contract, và vì sao ledger cần sửa

`verified: 2026-09-30 @ 3280c32c`

Báo cáo nguồn: [`survey-a-success-envelopes.md`](survey-a-success-envelopes.md) ·
[`survey-b-error-envelopes.md`](survey-b-error-envelopes.md)

---

## 1. Phát hiện làm đổi bài toán

Ledger (Entry 232) viết API-02 là "OpenAPI 3.1 + envelope `{data, meta}`", nghe
như đây là thứ đang tồn tại và chỉ cần chuẩn hoá.

**Không. `{data, meta}` có 0 call site.**

Kiểm chứng lại bằng `grep -n "'meta':" src/**/*.py` → đúng **8** site (khớp
báo cáo A):

| Site | `'meta'` là gì |
|---|---|
| `market_serving/native_views.py:549, 1235, 1456` | key cấp trên cùng, cạnh key nghiệp vụ |
| `user_workspace/portfolio_analytics_views.py:284` | key cấp trên cùng, cạnh key nghiệp vụ |
| `user_workspace/portfolio_analytics_views.py:1719` | key cấp trên cùng, **anh em với** `bucket_count`, `session_summary`, `whale_analytics` |
| `user_workspace/ledger/holdings.py:332`, `services.py:134, 161` | payload cache nội bộ, không ra HTTP |

Không site nào có `'data'` và `'meta'` là **hai key cùng cấp** bọc payload.
`{data, meta}` là **mục tiêu**, không phải hiện trạng.

Hệ quả: "chuẩn hoá envelope `{data, meta}`" **không phải sửa 12 chỗ — là viết
lại 426 endpoint** và phá toàn bộ FE đang đọc phẳng.

---

## 2. Hiện trạng đo được

Báo cáo A đếm **10 họ envelope** trên ~591 call site trả 2xx:

| Họ | Mô tả | Số endpoint |
|---|---|---:|
| F0 | 204 rỗng | 21 |
| F1 | mảng trần | 19 |
| F2 | **`{data, meta}`** | **0** |
| F3 | `{status, timestamp, request_id, data}` | 12 |
| F4/F4b | `{object, generated_at, summary_cards, data}` | 4 / 2 |
| F5 | `{data, +siblings}` | 3 |
| F6 | paginated `{next, previous, results}` | 91 |
| F7/F7x | ACK `{message/ok/detail}` | 50 / 3 |
| F8/F9 | **phẳng** — `serializer.data` / dict dựng tay | **104 / 282** |

**386/591 là response phẳng.** Đó là hình dạng FE đang viết adapter theo.

Về lỗi (báo cáo B): contract đã hội tụ về RFC 9457 qua
`core_api_exception_handler`, nhưng **229 chỗ trong `src/` vẫn tự dựng shape lỗi
riêng** và không đi qua handler.

47 test đỏ trong `vninvest_core`: **23** sai URL, **12** sai format
(`req_` prefix, hậu tố `Z`), **5** tiền đề đã lỗi thời. Không cái nào là bug
tài chính.

---

## 3. Quyết định

**Envelope thành công: giữ phẳng, `meta` là key anh em tuỳ chọn.**

Payload tiếp tục nằm ở cấp trên cùng. `meta` (provenance) là key **anh em** khi
endpoint có provenance — đúng cái đã làm ở `portfolio_analytics_views.py:284`.

Ba lý do:

1. **Không phá gì.** 386 endpoint phẳng và toàn bộ adapter FE giữ nguyên.
2. **Khớp với cái code đang làm.** `'meta'` cấp trên cùng đã là mẫu của cả
   `market_serving` lẫn `user_workspace`. Chuẩn hoá *theo mẫu đang có* thì hội tụ
   nhanh hơn chuẩn hoá theo mẫu chưa có.
3. **Chỉ còn 1 quyết định thật.** Nếu bọc `{data, meta}`, phải chọn 426 lần.

**Envelope lỗi: giữ RFC 9457, đóng nốt 229 chỗ tự dựng** — đây là hướng đã đi,
không quay lại.

**Phân trang:** `{next, previous, results}` giữ nguyên. Nhưng
`settings.py:316` đặt `DEFAULT_PAGINATION_CLASS = CursorPagination`, nên **không
có `count`** trong 91 response — client không biết tổng số bản ghi.

---

## 4. Điều này MÂU THUẪN ledger — cần bạn chốt

Ledger Entry 232 viết API-02 là envelope `{data, meta}`. Quyết định ở §3
**không** làm `{data, meta}`.

Đây là cùng kiểu quyết định mà bạn đã tự đảo trước đây (LED-05 contract phase:
"bỏ hẳn, không phải hoãn"). Nên tôi **ghi ra đây, không tự sửa ledger**.

Hai đường:

| | `{data, meta}` (đúng ledger) | Phẳng + `meta` tuỳ chọn (đề xuất) |
|---|---|---|
| Endpoint phải sửa | ~426 | ~0 |
| FE | phải viết normalizer cho mọi endpoint | không đổi |
| Rủi ro revert | cao | thấp |
| Contract đồng nhất | có | một phần |

---

## 5. Chưa làm / chưa xác minh

- **Báo cáo C (triage 85 test) chưa chạy.** Đã bỏ vì người dùng hủy sau khi
  biết nó cần ~55 phút. 85 lỗi đã có phân loại sơ bộ từ báo cáo B + kiểm chứng
  trực tiếp; **chưa** phân loại đầy đủ từng test theo nguyên nhân gốc.
- **Chưa chạy lại full 2746 test** sau 2 fix (`timestamp` + `SyntaxError`).
- Báo cáo A: số *endpoint/route* thật chưa map `urls.py`; 591 là **call site**.
- Báo cáo A: SSE (`sse.py:42`) và WebSocket không đi qua `Response(dict)` nên
  không so sánh được với JSON envelope.
- Báo cáo B: chưa chạy được test nào ngoài app `vninvest_core`.
- Chưa chạy `spectacular` để xem OpenAPI hiện sinh ra gì.
- Con số của agent A/B **tôi mới tái dẫn 2 cái** (`'meta'` = 8 site; `fcode`
  = 1 site). Phần còn lại lấy nguyên từ báo cáo, chưa kiểm lại.
