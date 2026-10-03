# Kế hoạch: chuẩn hoá success envelope sang `{data, meta}` — **bản 2**

`verified: 2026-09-30 @ 3ebe9424` · trạng thái: **DRAFT v2 — qua audit với NEED_REVISION, đã sửa**

Bản 1: [`PLAN_ENVELOPE_MIGRATION.md`](PLAN_ENVELOPE_MIGRATION.md) (đã bị audit bác bỏ, giữ lại để thấy dấu vết)
Audit: [`PLAN_AUDIT.md`](PLAN_AUDIT.md) · Số đo: [`CONTRACT_DECISION.md`](CONTRACT_DECISION.md)

---

## 0. Bản 1 sai ở đâu

Audit trả `NEED_REVISION`. Tôi đã **tự kiểm chứng** từng điểm, không nhận mặc định:

| Kế hoạch bảo | Thực tế | Kiểm chứng |
|---|---|---|
| "5 điểm unwrap, 26 file FE không đụng" | 5 dòng đó **chưa có** logic unwrap nào — chỉ là `return response.json()`. Thêm unwrap vào đó **là** thay đổi, không phải dùng sẵn được | đọc `transport.js:459/490/512/535`, `coreAdapter.js:69` |
| non-goal "không đụng `/api/*`" | `urls.py:62,63,66,68` mount `service_ops` + `identity_access` + `commercial` **dưới `/api/`** ⇒ phần lớn call site **nằm trong repo**. Non-goal này tự mâu thuẫn với B5 | đọc `vninvest_core/urls.py` |
| "591 call site" | Chạy lại script `survey-a` cho **583**. Chênh 8 là hằng số của chính script (F3 đếm qua `success_response()`, F4b thiếu nhánh) | chạy lại script |
| Gate B1 "số dòng khớp tổng call site" | Không đạt được — số phụ thuộc quy tắc của script, không phải thuộc tính của code | suy ra từ sai lệch 8 |

**Điểm auditor sai** (nói công bằng): 11 chỗ dual-read rải rác **không** làm hỏng tiền đề. Unwrap tập trung ở transport thì các chỗ `?? x` đó vẫn chạy — không có `.data` thì rơi về `x`. `grep` pattern hẹp cho **11**, rộng hơn thì nhiều hơn.

## 1. Rủi ro P0 mà bản 1 BỎ SÓT — và nó nặng hơn mọi thứ đã nêu

**Server tự gọi chính view của nó bằng `as_view()()` rồi đọc `Response.data`.**

6 call site production (không tính test):

- `market_data/stock_mgmt_native_views.py:2635` → `:2639`
- `market_data/stock_mgmt_native_views.py:2764` → `:2768`
- `market_data/stock_mgmt_native_views.py:2913` → `:2916`
- `user_workspace/portfolio_analytics_views.py:558, 567, 584`

3 chỗ đầu đọc `refresh_response.data.get('advisory_id')`. Nếu `AdvisoryRefreshView` bị bọc `{data: {...}}`:

```
.data.get('advisory_id')  →  None
if advisory_id:           →  False
                           ↓
record is None            →  _latest_ai_record(user, symbol)   (:2645 / :2770 / :2919)
```

`status_code` **không đổi** khi bọc, nên phép kiểm ở `:2636` / `:2765` / `:2914` vẫn lọt qua — **không có exception, không có log lỗi**.

Kết quả: thay vì khuyến nghị AI của phiên vừa refresh, hệ thống trả khuyến nghị của **phiên cũ nhất**. Người dùng thấy khuyến nghị mua/bán sai **mà không có dấu hiệu nào là sai**.

Đây đúng loại P0 mà `AGENTS.md` Entry 231 ghi đã phải sửa một lần (`AdvisorySession` không có FK tới `AdvisoryRecord` ⇒ rơi về record phiên cũ). Bản 1 của kế hoạch không nhắc tới.

⇒ **B0 bắt buộc:** trước mọi thứ, chặn bằng test rằng 3 chỗ này **không** rơi vào fallback khi `advisory_id` vắng mặt. Test phải **đỏ trước**, xanh sau — không phải test viết sau để hợp thức hoá.

Ngoài ra 2 chỗ mutate `Response.data` sau khi dựng (`market_data/views.py:117-118`, `service_ops/views/scheduler.py:268-269`) — bọc sẽ ghi sai tầng. Phải soi.

## 2. Quy tắc bọc — sửa lại

Bản 1 nói "bọc mọi họ". Sai ở **F6**.

Đã kiểm chứng: `market_serving/native_views.py:535-563` **đã có contract có phiên bản** (`contract_version: '2.0'`) dùng **payload phẳng + `meta` cấp trên cùng**.

Nếu bọc F6 thành `{data: {results,...}, meta: {...}}` ⇒ tồn tại **cả** `data.meta` (nếu payload con có meta) **và** `meta` ngoài ⇒ hai nguồn provenance trùng tên.

| Họ | Số | Quy tắc sửa |
|---|---:|---|
| F0 204 rỗng | 21 | không bọc |
| F1 mảng trần | 19 | `{data: [...], meta}` |
| F3 `{status,timestamp,request_id,data}` | 12 | giữ — đã khớp ý đích |
| F6 phân trang | 91 | **`market_serving` giữ nguyên** (contract 2.0). Chỉ nhóm khác mới bọc, và phải khai báo `contract_version` |
| F7/F7x ACK | 53 | `{data: {...}, meta}` |
| F8 `serializer.data` | 104 | `{data: ..., meta}` |
| F9 dict dựng tay | 282 | `{data: {...}, meta}` |
| F4/F4b/F5 | 9 | tách khỏi đợt này |

## 3. Thứ tự — sửa lại

Bản 1 đặt B4 (OpenAPI) **trước** B5 (migrate). Sai: schema sinh từ code, đặt trước thì mô tả contract cũ rồi bị vô hiệu. Ngoài ra 201 `APIView` trần không có `serializer_class` ⇒ nó **không mô tả được** 282 dict dựng tay.

Bản 2:

| Bước | Nội dung | Gate |
|---|---|---|
| **B0** | Chặn fallback im lặng ở 3 chỗ `stock_mgmt_native_views.py` | test âm tính đỏ trước → xanh sau |
| **B1** | Bản đồ route → call site → test bảo vệ → FE consumer | script chạy thật; **không** đòi khớp tổng call site (gate vô nghĩa ở bản 1) |
| **B2** | Ổn định nền test: phân loại phần còn lại của 85 lỗi | chỉ phân loại **success envelope**, không triage 85 lỗi toàn bộ — 47 lỗi đã phân loại, không cái nào chạm success envelope |
| **B3** | Unwrap tập trung ở FE (5 điểm) + helper chống "0 giả" | test chứng minh (a) unwrap đúng (b) không nuốt payload phẳng (c) `undefined` **không** thành `0` |
| **B5** | Migrate backend theo bản đồ, chia theo app | mỗi lô: `check` · `makemigrations --check` = 0 · test nhóm · không lỗi ruff mới |
| **B4** | OpenAPI 3.1 — **sau** B5 | schema sinh được; validate |
| **B6** | Dọn fallback khi từng endpoint đã xong | bản đồ xác nhận hết consumer |

## 4. Rủi ro (bản 2)

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| **Fallback im lặng → khuyến nghị phiên cũ** | **P0** | **B0**, test âm tính |
| `Number(undefined) \|\| 0` → hiển thị 0 tiền | Cao | Gate B3 |
| Mutate `Response.data` sau khi dựng | Cao | soi 2 chỗ nêu ở §1 |
| `data.meta` trùng `meta` ngoài (F6) | Cao | §2 — `market_serving` giữ nguyên |
| Non-goal `/api/*` tự mâu thuẫn | Cao | đã gỡ; scope là **call site trong repo** |
| 85 test đỏ che lỗi | TB | B2 giới hạn phạm vi |
| Không có CI (Actions đã tắt) | Cao | gate tay; `CHƯA CHẠY` ghi rõ |

## 5. Còn treo (cần owner)

1. **`meta` bắt buộc hay tuỳ chọn?** Bắt buộc ⇒ luật kiểm được, nhiều `{}` rỗng. Tuỳ chọn ⇒ khớp 8/8 site có sẵn + khớp `market_serving` contract 2.0.
2. **Có bọc `market_serving` không?** Nó đang ở contract 2.0 có phiên bản. Bọc là **phá contract đã version**.
3. **`CursorPagination` không có `count`** (91 response). Client không biết tổng số bản ghi.
4. **Có làm không?** B5 là hàng trăm call site cơ học, **không CI**, 85 test đỏ chưa phân loại hết, và **không có CI nào bắt lỗi khi hợp nhất 3-4 agent**. Tôi vẫn đánh giá: nên làm, nhưng B0 là điều kiện tiên quyết.

## 6. Ước lượng

B0 nhỏ · B1 nhỏ · B2 nhỏ (giới hạn phạm vi) · B3 nhỏ (5 điểm) · **B5 lớn** · B4 trung bình.

Chưa kiểm chứng được tới khi B1 xong: số **dòng** thực sự phải sửa ≠ số call site. 583 là call site, không phải dòng.
