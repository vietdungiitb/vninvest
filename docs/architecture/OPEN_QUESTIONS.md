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

### Q-01 — Ledger bị cấm commit nhưng lại bắt phải cập nhật · **ĐÃ XỬ LÝ 2026-10-03**

| | |
|---|---|
| **Vấn đề** | `AGENTS.md` yêu cầu cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` sau **mọi** thay đổi. Chính `AGENTS.md` §2 lại đặt file đó vào **danh sách cấm commit** |
| **Bằng chứng** | `AGENTS.md` mục "Không được" liệt kê `docs/CODE_CHANGE_AUDIT_LEDGER.md`; `scripts/agent-pr.ps1:44` có nó trong `$deny` |
| **Vì sao không tự quết** | Sửa `AGENTS.md` hoặc sửa `agent-pr.ps1` đều là **thay đổi quy tắc dùng chung** — không phải việc một agent tự ý quyết |
| **Hệ quả hiện tại** | Ledger **mãi lệch** với code. Mọi "cập nhật ledger" trong AGENTS.md là chỉ dẫn không thi hành được — giống hệt `D-2` ở Q-06 |
| **Quyết định Owner** | **Chọn (a) — gỡ khỏi deny-list.** Owner phán 2026-10-03 |
| **Lý do** | Ledger là append-only **một Entry = một khối riêng**, nên commit tách được, không dính hunk của agent khác. Vấn đề gốc ở `AGENT_PROTOCOL.md` §1 dòng 2 là do `AGENTS.md` bị **gộp hunk** vì mọi agent ghi chung một mục Progress — Ledger không có đặc tính đó |
| **Đã sửa 7 nguồn** | `docs/AGENT_PROTOCOL.md:25-34` (§2, 6 dòng → 5) + ghi chú ngoại lệ · `AGENTS.md` (11 → 10 file) · `.githooks/pre-commit:21` (`DENY`) · `scripts/agent-pr.ps1:44` (`$deny`) · `packages/web/scripts/check-multi-agent.mjs:27` (`DENY_LIST`) · `tools/opencode-global/verify-deny-extract.mjs` (`KNOWN`, 9 → 8) · `tools/opencode-global/agent-preflight.mjs:54` (`DEFAULT_DENY_LIST`) |
| **Cố tình KHÔNG sửa** | `scripts/quality/check_opencore_doc_sync.ps1:66` — đây **không phải** deny-list, mà là gate **bắt buộc** ledger phải được cập nhật khi có thay đổi OpenCore. Giữ nguyên |
| **Gate** | `check-multi-agent` PASS (exit 0) · `verify-deny-extract` PASS 8/8 + 9/9 negative test · `scan-secrets` PASS 3591 file |

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

### Q-07 — ~~`pyproject.toml` khai `Django<5.0`~~ **ĐÃ SỬA** — và tìm ra vấn đề lớn hơn

| | |
|---|---|
| **Sửa** | `packages/core/pyproject.toml:12` `Django>=4.2,<5.0` → **`Django>=5.2,<6.0`** (commit xem `git log`) |
| **Vì sao 5.2 chứ không phải 6.0** | Bản đầu tôi đề xuất `<7.0` dựa trên **giả định sai**. Đo lại trong container: `django 5.2.17`, `requirements.txt:1` = `Django>=5.2,<6.0` ⇒ **5.2 mới là sự thật**, `pyproject.toml` là kẻ lệch |

#### ⚠ Phát hiện lớn hơn: baseline chạy **khác major** với production

| Nơi | Django |
|---|---|
| Container `vninvest-dev-core-api` / `core-worker` (cái **thật sự chạy**) | **5.2.17** |
| `vninvest\.venv` | 5.2.14 |
| `…\WindowsApps\python.exe` | **6.0.6** |

**Hệ quả:** baseline `run_tests.py` của đợt B5 (2.805 test · 83F + 8E) và toàn bộ
phiên audit này đều chạy trên **6.0.6**, tức **khác major với production**. Test
xanh trên 6.0.6 **không** bảo chứng xanh trên 5.2.17.

> **Cần Owner quyết:** có chủ đích nâng lên Django 6.0 không?
> - **Không** (giữ 5.2) ⇒ mọi gate phải chạy trên `>=5.2,<6.0`; 9 lỗi ở
>   `test_ohlcv_bars_native_api` **là thật**, không phải lỗi giả.
> - **Có** ⇒ nới `requirements.txt` (`<6.0` → `<7.0`) **kèm** `pyproject.toml`,
>   và chạy lại toàn bộ suite trên 6.0 để lấy baseline mới.
>
> **Không tự quết** vì nó quyết định thứ tự nâng cấp dependency của cả hệ thống.

#### Đã kiểm tra và **KHÔNG** phải bug

`django.utils.timezone.utc` đã bị Django 5.0 **xoá**, nên tôi nghi ngờ 33 chỗ
trong production còn sót. **AST kiểm từng file: 0 chỗ nào dùng `django.utils.timezone`.**
Tất cả là `datetime.timezone.utc` của **stdlib** — hợp lệ. Cảnh báo của tôi **sai**,
không có bug nào ở đây. Ghi lại để không ai đào lại.

---

## D. SỬA NGAY, KHÔNG CẦN HỎI (nhưng cần ai đó làm)

Mục này **không cần Owner quyết** — đã rõ là lỗi. Ghi ở đây để không bị quên.

| ID | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| Q-08 | 7 component `Shell*` **không tới được** sau khi `main.tsx` remap route id | `main.tsx:24-30`; 7 file tồn tại trong `pages/` | P1 |
| Q-09 | `coreAdapter.js` gửi request **không có** `Authorization`/`X-Tenant-ID` | không chứa chuỗi `Authorization` | **P0** |
| Q-10 | `features_map` thiếu `custom`/`internal` ⇒ tenant đã thương lượng bị tính như `free` | `views_webhooks.py:240-248` | **P0** |
| Q-11 | `api_calls_limit` mặc định 10000 vs catalog `free` = 1.000 | `commercial/models.py:44` vs `plan_catalog.py:64` | P1 |
| Q-12 | 13 token trùng tên khác giá trị ở `:root`; thứ tự nạp quyết định thắng | `theme/tokens.css` vs `soc.tokens.css` | P1 |
| Q-13 | 9 `exports` trong `package.json` trỏ tới file `.ts` **không tồn tại** | `packages/web/package.json:36-47` | P1 |
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
| ~~Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`~~ | **Xong 2026-10-03** — Owner chọn phương án (a), ledger gỡ khỏi deny-list ở cả 7 nguồn |
| Chạy BE/FE test cho phiên tài liệu | Doc-only, không sửa code. Lần chạy gần nhất: 2.805 test · 83F + 8E, 0 regression |

---

*Bộ tài liệu AS-IS hoàn tất 3/3. File này là phần còn **mở** — cập nhật nó mỗi khi
Owner quyết được một mục.*
