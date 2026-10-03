# Kiến trúc `vninvest` — bộ tài liệu AS-IS (Single Source of Truth)

> **Trạng thái: Lượt 3/3 — hoàn tất (§1, 2, 3, 4, 5, 6, 7).**

---

## 0. ĐỌC TRƯỚC — cảnh báo xung đột tài liệu (P0)

Repo này có **hai** bộ tài liệu kiến trúc **trái hướng nhau**, và cả hai đều trông
uy tín. Đọc nhầm là sai ngay.

| Bộ tài liệu | Mô tả | Hướng | Trạng thái |
|---|---|---|---|
| **`docs/saas_design_pack/`** (D01–D12, ~6.850 dòng) | Bản thiết kế **mới** để port ra sản phẩm SaaS mới, tái dùng `vninvest` làm nền | **TO-BE** (kế hoạch) | 12/13 file, **không có README/index** |
| **`docs/architecture/`** (thư mục này) | Bóc tách **hiện trạng thật** của `vninvest` | **AS-IS** (mô tả) | Lượt 1/3 |

**Vì sao đây là P0 chứ không phải chuyện vặt:** `saas_design_pack/D06_DATA_MODEL_ERD`
mô tả 12 bảng mới (`entitlement`, `catalog_product`, `audit_log`…) mà **chưa tồn tại**
trong `vninvest`. Một lập trình viên đọc `D06` rồi viết code theo đó sẽ import
model không tồn tại. Ngược lại, đọc `architecture/D01` rồi code theo sẽ viết
đúng với hệ thống đang chạy nhưng không đúng hướng sản phẩm.

**Quy tắc bắt buộc cho mọi người trong repo:**

| Cần biết | Đọc |
|---|---|
| Hệ thống **đang** chạy thế nào, code ở đâu | `docs/architecture/` (AS-IS) |
| Hệ thống **sẽ** được xây thế nào | `docs/saas_design_pack/` (TO-BE) |
| Muốn biết mục nào **chưa** viết | Mục 0.2 bên dưới |

> **Chưa giải quyết:** tên file hai bộ hiện **không** phân biệt được
> (`D01_PROCESS_PRD` vs `D01_AS_IS_...`). Đề xuất tiền tố `AS-` / `TOBE-` — chờ
> coordinator quyết, không tự đổi tên file của bộ `saas_design_pack` (do session
> khác sở hữu).

---

## 0.1 Nguyên tắc bất di bất dịch của bộ tài liệu này

1. **Code-grounded.** Mọi khẳng định có `path:line`. Không khẳng định nào thiếu
   dòng thì không có giá trị. Điều chưa kiểm chứng ghi `[CHƯA XÁC MINH]`.
2. **Đo, không đoán.** Số liệu đếm từ file thật bằng script, không ước lượng.
3. **Phân biệt lỗi sống với lỗi đã sửa.** Nhiều ghi chú trong code mô tả bug
   *đã được vá*; tài liệu này ghi rõ trạng thái, không báo lại là bug sống.
4. **Ưu tiên bằng chứng.** Khi sub-agent/AI báo cáo phát hiện, phải tự mở file
   kiểm lại trước khi đưa vào tài liệu. Ở Lượt 1 có **1 phát hiện bị bác** vì
   lý do này (mục 6.2, F-11).
5. **Ưu tiên P0–P2.** Không liệt kê "nên cải thiện" chung chung. Mỗi finding có
   `file:line` + hậu quả cụ thể + đề xuất sửa.

## 0.2 Chỉ mục & trạng thái

| File | Phần trong đặc tả | Nội dung | Trạng thái |
|---|---|---|---|
| `D01_AS_IS_OVERVIEW_AND_AUDIT.md` | §1, §2, §6 | Bối cảnh hệ thống, C4 context, glossary, FBD, RBAC, audit + nợ kỹ thuật | ✅ |
| `D02_DATA_AND_ARCHITECTURE.md` | §3, §4 | C4 container/component, DFD, **ERD + data dictionary 107 model (sinh tự động)**, cache/transaction/ACID | ✅ |
| `D03_API_UI_AND_SOP.md` | §5, §7 | Quy ước API, error JSON, navigation/state/design tokens, check-list 7 bước, DoD, bẫy đã mắc | ✅ |
| `tools/measure_repo.py` | — | Đo lại 8 chỉ số §0.4 · exit 1 nếu lệch | ✅ |
| `tools/gen_data_doc.py` | — | Sinh §4.1–4.2 từ Django runtime · exit 1 nếu sót model | ✅ |

**Vì sao tách 3 file chứ không 1 file:** `vninvest` có 15 Django app / 107 model /
1.029 route. Một file duy nhất sẽ vượt quá khả năng duy trì và mọi lần sửa đều
phải đọc lại toàn bộ.

## 0.2.1 Quy trình cập nhật khi code đổi

| Thay đổi | Phải làm |
|---|---|
| Thêm/sửa/xoá model | Chạy `tools/gen_data_doc.py` (kiểm `CLUSTERS` có cần bổ sung không) |
| Đổi kiến trúc, đổi finding | Sửa tay `D01`/`D02`/`D03` **kèm** `file:line` |
| Đổi số liệu kiến trúc | Chạy `tools/measure_repo.py`; nếu lệch thì sửa **cả** §0.4 lẫn kỳ vọng trong script |
| Đóng một finding | Ghi rõ **đã sửa ở đâu** + sửa finding, không xoá — xem `D01` F-11 làm mẫu |

## 0.3 Cách dùng khi phát triển tính năng mới

1. Mở `D01` → tìm app của mình ở §2.1 (FBD) → xem capability liên quan ở §2.3.
2. Kiểm tra finding P0/P1 đã mở ở §6.3 có chặn khu vực mình sửa không.
3. Trước khi code: đọc `scripts/check-envelope-contract.py` (gate bọc
   `{data, meta}`) và `vninvest_core/api_envelope.py`.
4. Sau khi code: quy trình 7 bước ở `D03` (Lượt 3).

---

## 0.4 Lịch sử đo (để lần sau đối chiếu)

| Số liệu | Giá trị | Cách đo |
|---|---|---|
| Django app | **15** | thư mục có `models.py`/`apps.py` dưới `packages/core/backend/src` |
| Model | **107** | `class X(*.models.Model)` ngoài `migrations/` |
| Migration | **115** | `migrations/0*.py` |
| Python (15 app + `vninvest_core`) | **117.464 + 4.167 dòng** | đếm dòng, trừ `migrations/` |
| Route đã resolve | **1.029** | walk `django.urls.get_resolver()` |
| Trong đó `/core/v1/*` | 609 | |
| Celery beat entry | **42** | `settings.py` `CELERY_BEAT_SCHEDULE` |
| Compose stack | **8** | 5 file root + 3 trong `packages/` |
| CI workflow đang bật | **1** (`secret-scan`) | `.github/workflows/` |

Đo tại commit `0ee1b8b4b` (merge PR #69), ngày 2026-10-03.

### Tái lập số liệu — bắt buộc chạy lại, đừng đọc là tin

```powershell
python docs/architecture/tools/measure_repo.py
```

Script **in ra số đo và so với bảng trên**, trả exit 1 nếu lệch. Tài liệu không
đứng một mình được.

> **Số liệu đã bị sửa sau khi đo:** ban đầu ghi **123** migration. Chạy script ra
> **115**. Nguyên nhân: cộng tay từ bảng theo app của một lượt quét khác và cộng
> nhầm. Sửa theo script, không sửa theo trí nhớ — đó là lý do script tồn tại.
> Tương tự, lần đo route đầu ra **5** thay vì 609 do đếm `leaf_pattern` thay vì
> **đường dẫn đầy đủ**; walker đã sửa và test lại.

> **Cảnh báo render C4:** khối `C4Context` ở `D01` cần Mermaid ≥ 10.1 (C4 vẫn là
> tính năng thử nghiệm). Trên GitHub/VS Code bản Mermaid cũ sẽ **không** hiện sơ
> đồ — nội dung `Person`/`System` vẫn đọc được dưới dạng văn bản. Nếu cần đảm
> bảo 100%, thay bằng `flowchart LR`.