# PROMPT BÀN GIAO — PHIÊN MỚI

Copy nguyên khối dưới đây vào session mới. Nó tự chứa, không cần đọc lịch sử cũ.

---

Bạn là agent tiếp quản B5 (đổi success response sang `{data, meta}`) tại
`C:\Mujoco Projects\vninvest`. Nhánh `dev`, HEAD = `2b508bce4`.

## 1. B5 ĐÃ XONG GÌ — KHÔNG LÀM LẠI

7 app đã bọc `{data, meta}` cho **success 2xx**:

| App | Số điểm |
|---|---|
| `identity_access` | 92 |
| `service_ops` | 151 |
| `user_workspace` | 53 |
| `market_data` | 61 |
| `signal_intelligence` | 7 |
| `advisory` | 7 |
| `ops_audit` | 4 |

Thêm: OpenAPI schema (`src/vninvest_core/api_envelope.py::envelope_response`),
helper test `unwrapped()` / `unwrapped_json()` trong mỗi app, gate
`packages/core/backend/scripts/check-envelope-contract.py`, script giám sát
`scripts/verify-agent-handover.ps1`.

**Full suite hiện tại: 2798 test · 79F + 12E.** `failures = 79` bằng đúng
baseline trước B5 — không có failure mới.

### Đã xử xong, KHÔNG mở lại
- Lỗi RFC 9457 (error shape) — riêng hợp đồng, nằm ngoài B5.
- `market_data/stock_mgmt_native_views.py` — xoá code chết
  `_ensure_advisory_record_for_symbol`, chốt chặn 2 lớp trong
  `test_internal_advisory_call_safety.py`.
- `user_workspace` trùng `tests.py` + thư mục `tests/` — đã đổi thành
  `tests/test_data_isolation.py`; `manage.py test --noinput user_workspace` chạy được.
- `test_ledger_migration_backfill.py` làm bẩn schema — đã sửa, có test chốt chặn
  `test_schema_not_polluted_by_migration_tests.py`.
- `market_serving` — **cố ý không migrate** (contract `'2.0'` riêng, `data` là
  sibling). Gate đã có `EXEMPT_APPS` in kèm lý do.

## 2. VIỆC CẦN LÀM

**Mô tả 131 operation `@api_view` của `identity_access` trong schema OpenAPI.**

Con số thật: app có **360 operation**, đã mô tả 229, còn **131 chưa mô tả gì**.

Nguyên nhân chúng chưa làm được — đọc kỹ đây, đây là cả chìa khóa:
`@api_view` **không phải class DRF**. Nó mang `__module__ =
'identity_access.views_tenant'`. Bộ phân loại AST trong
`vninvest_core/tests/test_api_envelope_schema.py` gọi `_methods_of()`, hàm này
đi tìm **class** có tên đó trong source → không thấy → rỗng → `UNVERIFIED` →
**bỏ qua im lặng**.

⇒ **31 view `@api_view` nằm ngoài mô hình bảo vệ của bộ test dùng chung.**
Cách nhận biết đúng: *tên có `ClassDef` trong source hay không*. Nếu không
sửa điều này thì những view kia vẫn có thể bị sửa sai mà **không có gì bắt**.

File cần đọc (số operation):
- `views_personal.py` (28)
- `views_dashboard.py` + `views_forecast.py` + `views_usage_trend.py` (24)
- `views/login.py` (14)
- `views_security.py` (12) · `views_alert_config.py` (12) · `views_usage.py` (12)
- `views/register.py` · `password_*` · `profile.py` · `onboarding_views.py` (~18)

Cách đo lại (đừng tin con số của tôi):
```python
from drf_spectacular.generators import SchemaGenerator
gen = SchemaGenerator()
paths = gen._get_paths_and_endpoints()
```
rồi kiểm `success_props()` có rỗng không.

## 3. PHÂN LOẠI — ĐỪNG BỌC BỪA

Đọc `return` **thật** của handler. Bộ phân loại dùng chung nằm ở
`scripts/check-envelope-contract.py` — đọc `SKIP_F4`, `SKIP_F5_SIBLINGS`, `SKIP_ERROR`:

- success 2xx đã bọc → `envelope_response(X)` hoặc `envelope_response()`
- lỗi ≥400 → **giữ RFC 9457** (`application/problem+json`), **đừng** mô tả `{data, meta}`
- `F4_GENERATED` (có `generated_at`) → **phẳng**, không bọc
- `F5_DATA_PLUS` (sibling ngoài `data`) → **không** ép về `{data, meta}`
- 204/205/304 → không body

### Hai tiểu tiết đã có tiền lệ, giữ nguyên
- `partner_issue_pat` (`views_tenant.py:362`) **đã bọc**, nhưng
  `partner_rotate_pat` (`:414`) và `partner_revoke_pat` (`:434`) **vẫn phẳng**.
  **Đừng** bọc cả 3 như nhau.
- `success_response` (`views/helpers.py:333`) trả
  `{status, timestamp, request_id, data}` — **không có `meta`**. Nó **không phải
  envelope B5**. Đừng ép nó về `{data, meta}`.

## 4. BẪY ĐÃ MẮC THẬT — ĐỪNG PHẢI HỎI LẠI

### Bẫy thao tác (đã mất mát việc thật)
1. **`git stash` và `git checkout --` CẤM TUYỆT ĐỐI.** `git stash` từng fail
   `Permission denied` và đụng cả cây chính → 37 file conflict.
2. **`git show HEAD:p | Out-File` HỎNG chuỗi tiếng Việt** (console cp1252) ⇒
   fail giả. Copy file bằng byte: `shutil.copy2`.
3. **Tool `edit` từng báo lỗi `Could not find oldString` NHƯNG VẪN GHI một khối
   hỏng** vào file. Sau **mỗi** lần `edit`: đọc lại vùng sửa + chạy `ruff`.
4. **Một agent chết vì lỗi socket *sau khi đã commit***. Đừng `reset --hard` một
   worktree trước khi kiểm branch của nó tồn tại — commit có thể chỉ tồn tại trong
   object store chứ không có branch trỏ tới.
5. **Trước khi gộp/xoá worktree, kiểm tra bạn đang ở branch nào.** Trong phiên trước
   một session khác dùng chung thư mục; cherry-pick rơi nhầm lên branch của họ.

### Bẫy môi trường
6. **Full suite phải chạy bằng `python run_tests.py`.** `manage.py test` trần bỏ
   sót toàn bộ test trong `src/` (~2100 test).
7. **Có hai interpreter với Django khác nhau.** `where python`:
   - `vninvest\.venv` → Django **5.2.14**, **không có** `django.utils.timezone.UTC`
     ⇒ 9 lỗi giả ở `market_data/tests/test_ohlcv_bars_native_api.py`.
   - `…\WindowsApps\python.exe` → Django **6.0.6**, không lỗi đó.
   Con số baseline sinh ra bằng interpreter **thứ hai**. Dùng đúng nó, nếu không
   mọi so sánh đều lệch.
   (Lưu ý mâu thuẫn chưa ai sửa: `packages/core/pyproject.toml` ghi `Django>=4.2,<5.0`
   nhưng repo chạy 6.0.6.)
8. **DB riêng mỗi agent.** `test_b5c` đã bị agent khác chiếm giữa lúc chạy
   (`pg_stat_activity`: pid đổi `96265`→`96325`, `idle in transaction`). Tạo DB
   riêng ngay từ đầu, đừng dùng lại DB có tên quen.
9. `manage.py test --noinput user_workspace` **đã sửa xong**, giờ chạy được.

### Bẫy kiểm chứng
10. **Đừng tin báo cáo agent — tự chạy lại gate.** Agent trước báo "PASS" cho một
    test thực ra **xanh vì lý do sai** (`assertNotIn` trên `.data` luôn true vì
    `.data` chỉ có `{data, meta}`).
11. **Mọi test mới phải có negative proof hai chiều**: sửa sai → **đỏ** → khôi phục
    byte-exact → xanh. Không có bằng chứng này thì coi như chưa làm.
12. **Dựng baseline thật bằng worktree riêng ở commit trước**, DB riêng, chạy song
    song. Đừng đối chiếu bằng trí nhớ. Phiên trước tôi đối chiếu "đúng những
    module mình nghĩ tới", báo **1 regression**, thật ra là **55**.

## 5. GATE PHẢI CHẠY THẬT

```powershell
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/<DB-RIENG>"
$env:DJANGO_DEBUG="1"
# chạy từ packages/core/backend

python manage.py spectacular --file $env:TEMP\idoc.yml
python manage.py check
python manage.py makemigrations --check --dry-run        # phải No changes detected
python -m ruff check --output-format=concise <file đã sửa>
python manage.py test --noinput vninvest_core.tests.test_api_envelope_schema
python manage.py test --noinput identity_access
python scripts/check-envelope-contract.py identity_access   # phải exit 0
python run_tests.py                                          # full suite ~55-90 phút
```

**`scripts/verify-agent-handover.ps1`** kiểm tiến trình mồ côi, DB test mồ côi,
handshake Postgres, gate, worktree. Khi kiểm worktree agent **phải truyền
`-Backend`**, nếu không nó đọc `dev` và báo xanh cho thứ chưa merge.

## 6. LUẬT CỨNG

- **KHÔNG** commit thẳng vào `dev` — tạo `feat/<ten>` hoặc worktree riêng rồi để
  coordinator merge.
- **KHÔNG** tạo migration.
- **KHÔNG** sửa `scripts/check-envelope-contract.py` (dùng chung) trừ khi báo
  trước và được duyệt.
- **KHÔNG** sửa `docs/CLAIMS.md` cho tới khi merge xong.
- **KHÔNG** dùng `--no-verify` để lách hook. Một agent trước đã làm việc này với
  lý do "sợ hook chặn" — không được lặp lại.
- **KHÔNG** sửa logic response. Code đã đúng, chỉ mô tả.
- Không dùng `git stash`.

## 7. BÁO CÁO

Số operation đã mô tả / tổng, phân loại (bao nhiêu envelope / phẳng / lỗi RFC 9457),
negative proof **hai chiều** (không chỉ "PASS"), kết quả từng gate **kèm lệnh**,
và mục **CHƯA CHẠY**.

**Không báo xong khi còn nợ.** Nếu 131 quá nhiều cho một lượt, làm đến chỗ chắc
chắn rồi dừng và nói rõ đã làm bao nhiêu / còn bao nhiêu / vì sao dừng. Nói thẳng
"không phải xong" còn hơn báo xong rồi bị bắt sai.

## 8. GHI NHẬN SAI SÓT ĐỂ TRÁNH LẶP

Phiên trước còn lại trong `CLAIMS.md`:
- 87 đỏ hiện tại đã phân loại: 51 `vninvest_core/tests` (chứng minh pre-existing)
  + 36 còn lại từng đối chiếu y hệt trước/sau khi bọc.
- Branch `docs/saas-design-pack-20261002` (session khác) còn chứa commit trùng
  `457c74857` — **không** tự sửa branch của họ, phải báo coordinator.
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` chưa cập nhật (file nằm danh sách cấm commit).