# OPEN QUESTIONS — Bộ tài liệu AS-IS

> **Đây là danh sách việc cần **Owner / Coordinator quyết**, không phải việc tôi
> tự làm.** Mỗi mục có: vấn đề · bằng chứng · **vì sao tôi không tự quết** · đề xuị.
>
> Mục nào đã quyết thì chuyển sang `D01` §6.3 hoặc sửa tài liệu tương ứng, và
> **xoá** mục khỏi đây. Danh sách phải **thu**, không được phình.
>
> Đo tại `0ee1b8b4b`, 2026-10-03.

---

## A. XUNG ĐỘT QUY TRÌNH — chặn việc, ưu tiên cao nhất

### Q-01 — Ledger bị cấm commit nhưng lại bắt phải cập nhật

| | |
|---|---|
| **Vấn đề** | `AGENTS.md` yêu cầu cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` sau **mọi** thay đổi. Chính `AGENTS.md` §2 lại đặt file đó vào **danh sách cấm commit** |
| **Bằng chứng** | `AGENTS.md` mục "Không được" liệt kê `docs/CODE_CHANGE_AUDIT_LEDGER.md`; `scripts/agent-pr.ps1:44` có nó trong `$deny` |
| **Vì sao không tự quết** | Sửa `AGENTS.md` hoặc sửa `agent-pr.ps1` đều là **thay đổi quy tắc dùng chung** — không phải việc một agent tự ý quyết |
| **Hệ quả hiện tại** | Ledger **mãi lệch** với code. Mọi "cập nhật ledger" trong AGENTS.md là chỉ dẫn không thi hành được — giống hệt `D-2` ở Q-06 |
| **Đề xuị** | Chọn 1: (a) gỡ khỏi deny-list, hoặc (b) bỏ yêu cầu cập nhật khỏi AGENTS.md |
| **Ưu tiên** | **P0** |

### Q-02 — CI tắt vì billing, mọi "gate" trên PR là ảo

| | |
|---|---|
| **Vấn đề** | Check `scan` FAILURE **không phải** do gate hỏng. Job chạy **2 giây** với `steps: []`, không có log — không có runner |
| **Bằng chứng** | Đo 2026-10-02: `scan` fail 2 s; "Copilot Code Review" fail 6 s; `actions/permissions` = `enabled` (không phải bị tắt tay) ⇒ hạn mức billing. 8/9 workflow nằm ở `.github/workflows-disabled/` |
| **Đã kiểm chứng** | Cả 3 gate trong `secret-scan.yml` PASS khi chạy tay: `--self-test` **52/52**, `scan-secrets` **OK / 3.448 file**, `check-multi-agent` **0 lỗi** |
| **Vì sao không tự quết** | Bật lại Actions là quyết định tài chính/chính sách của Owner |
| **Đề xuị** | Khi hết hạn mức: bật `secret-scan` **trước**, rồi thêm BE test. Trong lúc đó **quy ước**: chạy tay 3 lệnh trên trước khi coi là xong |
| **Ưu tiên** | **P0** — vì nó biến mọi PR thành "không có kiểm chứng tự động" |

---

## B. TÀI LIỆU

### Q-03 — Hai bộ tài liệu AS-IS / TO-BE không phân biệt được bằng tên file

| | |
|---|---|
| **Vấn đề** | `docs/architecture/D01…` (AS-IS, **có**) và `docs/saas_design_pack/D01…` (TO-BE, **có**) — cùng tiền tố `D0x`, cùng thư mục cha. `saas_design_pack/D06` mô tả 12 bảng **chưa tồn tại** |
| **Đã giảm thiểu** | `docs/architecture/README.md` §0 ghi rõ quy tắc chọn bộ nào |
| **Vì sao không tự quết** | Đổi tên file của `saas_design_pack/` là sửa việc của **session khác** đang sở hữu |
| **Đề xuị** | Tiền tố `AS-` / `TOBE-`: `AS_D01_…` và `TOBE_D01_…`. Rẻ nhất là sửa `docs/saas_design_pack/README.md` trỏ sang bộ AS-IS |
| **Ưu tiên** | P1 |

### Q-04 — `saas_design_pack/` không có README/index

| | |
|---|---|
| **Vấn đề** | 13 file, ~6.850 dòng, **không có lối vào** — không biết đọc file nào trước |
| **Vì sao không tự quết** | Cùng lý do Q-03 |
| **Đề xuị** | Thêm `README.md` có bảng "file này trả lời câu gì" |
| **Ưu tiên** | P2 |

### Q-05 — Nợ kỹ thuật có nằm trong phạm vi hai bộ tài liệu không?

| | |
|---|---|
| **Vấn đề** | `D01`/`D03` liệt kê ~60 finding. `saas_design_pack` có lộ trình thiết kế mới. Nếu sản phẩm mới thay thế `vninvest` thì **nhiều finding không còn đáng sửa** |
| **Ví dụ** | Sửa 14 chỗ `if tenant:` fail-open (F-01/F-02) tốn công, nhưng nếu kiến trúc mới có `ScopedManager` thì không cần |
| **Cần Owner trả lời** | Có kế hoạch thay thế `vninvest` không? Nếu **có** ⇒ đánh dấu finding nào "vá tạm" và finding nào "sửa gốc" |
| **Ưu tiên** | **P1** — quyết định này đổi cả thứ tự ưu tiên trong `D01` §6.3 |

---

## C. SỬA CHỈ DẪN SAI TRONG `AGENTS.md`

### Q-06 — `AGENTS.md` trỏ tới `soc.module.css`, nhưng file đó rỗng

| | |
|---|---|
| **Vấn đề** | `AGENTS.md`: *"SOC glassmorphism patterns, **soc.module.css** tokens"*. `src/components/soc/soc.module.css` là **barrel 3 dòng / 139 byte**, 0 token 0 class |
| **Bằng chứng** | `soc.module.css:1-3` chỉ có 2 dòng `@import`. Token thật: `soc.tokens.css:5-130` (69 token). Class thật: `soc.components.css` (3.916 dòng, 522 selector) |
| **Hệ quả** | Bảo thêm token vào `soc.module.css` là chỉ dẫn **không làm được** |
| **Đề xuị** | Sửa `AGENTS.md`: đổi `soc.module.css` → `soc.tokens.css` (token) và `soc.components.css` (class) |
| **Ưu tiên** | **P0** — nó làm người mới tin nhầm ngay từ dòng đầu |

### Q-07 — `pyproject.toml` khai `Django>=4.2,<5.0` nhưng repo chạy 6.0.6

| | |
|---|---|
| **Vấn đề** | Ràng buộc phiên bản sai ⇒ `pip install` theo file này sẽ lên bản sai, và mọi cài đặt mới sẽ hỏng |
| **Bằng chứng** | `packages/core/pyproject.toml` vs `Django 6.0.6` đang chạy (interpreter WindowsApps) |
| **Hệ quả thực tế** | Đã gây **9 lỗi giả** khi chạy nhầm interpreter `.venv` (Django 5.2.14, không có `django.utils.timezone.UTC`) |
| **Vì sao không tự quết** | `pyproject.toml` nằm trong **deny-list §2**; đồng thời chốt version là quyết định dependency |
| **Đề xuị** | Nới thành `Django>=5.2,<7.0` |
| **Ưu tiên** | **P0** |

---

## D. SỬA NGAY, KHÔNG CẦN HỎI (nhưng cần ai đó làm)

Mục này **không cần Owner quyết** — đã rõ là lỗi. Ghi ở đây để không bị quên.

| ID | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| Q-08 | 7 component `Shell*` **không tới được** sau khi `main.tsx` remap route id | `main.tsx:24-30`; 7 file tồn tại trong `pages/` | P1 |
| Q-09 | `coreAdapter.js` gửi request **không có** `Authorization`/`X-Tenant-ID` | không chứa chuỗi `Authorization` | **P0** |
| Q-10 | `features_map` thiếu `custom`/`internal` ⇒ tenant đã thương lượng bị tính như `free` | `views_webhooks.py:240-248` | **P0** |
| Q-11 | `api_calls_limit` mặc định 10000 vs catalog `free` = 1.000 | `models.py:107` vs `plan_catalog.py:64` | P1 |
| Q-12 | 13 token trùng tên khác giá trị ở `:root`; thứ tự nạp quyết định thắng | `theme/tokens.css` vs `soc.tokens.css` | P1 |
| Q-13 | 9 `exports` trong `package.json` trỏ tới file `.ts` **không tồn tại** | `package.json:36-47` | P1 |
| Q-14 | `gen_data_doc.py` trước đây sinh file **không tất định** | **ĐÃ SỬA** ở `4bd974540` | ✅ xong |

---

## E. CHƯA XÁC MINH — cần người tra cứu sâu hơn

Không phải lỗi, là **chỗ tôi chưa đọc tới**. Ghi lại để không ai tưởng đã phủ.

| # | Cần xác minh | Vì sao chưa làm được |
|---|---|---|
| Q-15 | `ShellEmptyState` nào thắng lúc runtime | Hai bản cùng tên: `ShellPageTemplate.js:164` và `ShellEmptyState.tsx:4` |
| Q-16 | `layout.nav.*` có trong danh mục i18n không | `routeCatalog.js:211` dùng, không thấy trong 89 nhóm của `vi.js` |
| Q-17 | Số request hardcode `/core/v1` trong **production** | Đếm 88 dòng trong `src` nhưng phần lớn là **test và comment**; chưa tách riêng |
| Q-18 | Thuật toán ký webhook đi ra + cơ chế retry | Chưa truy tới dòng ký trong `views_webhooks.py` |
| Q-19 | Call chain đầy đủ của bộ đếm quota | Biết có `commercial/quota_period.py`, chưa truy từ middleware tới `api_calls_used` |
| Q-20 | 246 route trùng — đối chiếu bằng test client | Đếm bằng walk `get_resolver()`; chưa gọi thử từng cặp |
| Q-21 | `request_id_var` (ContextVar) đúng dưới ASGI/daphne | Chưa trace end-to-end |
| Q-22 | Grafana dashboard có tồn tại không | Chỉ thấy file provision datasource |
| Q-23 | Mức cô lập `READ COMMITTED` thực tế | Cần đọc cấu hình Postgres, không phải code |

---

## F. CÁI TÔI **KHÔNG** LÀM, VÀ LÝ DO

Ghi lại để không bị hiểu nhầm là bỏ sót.

| Việc | Vì sao không làm |
|---|---|
| Xoá `/api/soc/*` (135 route) hoặc `/core/v1/partner/partner/*` (108) | Cần biết **client nào** còn dùng. Xoá nhầm là hỏng production |
| Thêm `ScopedManager` cho tenant | Thay đổi kiến trúc truy vấn — cần P2-5 nối tiếp `D01` §6.3 |
| Sửa 14 chỗ `if tenant:` | Chờ Q-05 trả lời (vá tạm hay sửa gốn) |
| Bật lại GitHub Actions | Q-02 |
| Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` | Q-01 |
| Chạy BE/FE test cho phiên tài liệu | Doc-only, không sửa code. Lần chạy gần nhất: 2.805 test · 83F + 8E, 0 regression |

---

*Bộ tài liệu AS-IS hoàn tất 3/3. File này là phần còn **mở** — cập nhật nó mỗi khi
Owner quyết được một mục.*