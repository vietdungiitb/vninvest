# Đo test discovery — `dev` @ `c1678ad5`

Đo bằng chứng cho câu hỏi: *"bật discovery cho `src/<app>/tests/` được không?"*
Câu trả lời ngắn: **được, nhưng không phải trong một bước** — và con số dưới đây là lý do.

## Cách đo (tái tạo được)

```powershell
# baseline: full run mac dinh, khong truyen label
python manage.py test --noinput          # -> Ran 642 tests, FAILED (failures=11, errors=2)

# phia bi an: 149 file test nam duoi src/, goi bang dotted path
$prefix = (Get-Item (Join-Path $PWD "src")).FullName
$mods = Get-ChildItem -Recurse -Path $prefix -Filter "test_*.py" -File |
        Where-Object { $_.FullName -notmatch "migrations" } |
        ForEach-Object { ($_.FullName.Substring($prefix.Length+1) -replace '\\','.') -replace '\.py$','' }
python manage.py test @mods -v 1 --noinput
```

Chạy **một lệnh duy nhất**. Lần đầu tôi chia 12 lệnh theo app — mỗi lệnh tạo lại test
DB và chạy lại ~200 migration, tốn hàng giờ cho cùng kết quả. Với một lệnh: **2008s**.

> Phải copy artifact `collectstatic` từ main tree trước, nếu không
> `test_admin_login_page_is_servable` lỗi giả (xem `SESSION_HANDOFF_20260928.md`, bẫy #3).

## Con số

| | Số test | Fail | Error |
|---|---|---|---|
| Full run hiện tại (`manage.py test`) | 642 | 11 | 2 |
| 149 file dưới `src/` (chưa từng chạy) | **1802** | 55 | 47 |
| Gộp lại | 2444 | 66 | 49 |

Phần bị ẩn **lớn hơn 2,8 lần** phần đang chạy. Và 101 vấn đề gom lại chỉ còn **12 nguyên
nhân gốc**:

| Số test | Nguyên nhân gốc | Đánh giá |
|---|---|---|
| 39 | `AssertionError: N != N` — 404 vs 429/400/200 (14 + 9 + 4) | endpoint chưa vào URLconf; gom theo từng feature, **không** phải sửa một lần |
| 23 | `ModuleNotFoundError: No module named 'vnbroker'` | package `vnbroker` **không tồn tại trong repo**; production import ở 6 chỗ (`vnbroker_adapter.py:186,359,961,1043,1120`, `stock_mgmt_native_views.py:2192`) và degrade bằng `logger.warning` |
| 9 | `AssertionError: 'X' not found in 'X'` | cần xem từng case |
| 8 | `AttributeError: module 'django.utils.timezone' has no attribute 'utc'` | **Django 5 đã xoá `timezone.utc`**, repo chạy Django 6.0.6. Sửa 1 dòng cho cả 8 |
| 8 | `ValueError: Content-Type header is "X", not "X"` | format response lệch kỳ vọng |
| 6 | `django.db.utils.OperationalError: the connection is closed` | **lỗi test tự đóng connection** — rẻ nhất để sửa |
| 3 | `AssertionError: N not found in [N, N]` | endpoint chưa route |
| 1 | **`SecretKeyMissingError`** trong `test_secret_store.py:133` | **đã được sửa trong PR #51** (xem dưới) |
| 5 còn lại | rời rạc | |

### Một điểm đáng chú ý: phép đo này tự tái hiện bug mà PR #51 đã sửa

`test_bare_fernet_token_is_treated_as_legacy` (test của PR #47) chỉ fail **khi chạy đông**,
vì singleton `store` giữ cache key v1 cũ. Worktree đo này lấy từ `origin/dev` nên **chưa có**
fix cache của PR #51 — và phép đo đã tái hiện đúng lỗi đó. Đây là xác nhận độc lập cho
giá trị của PR #51, không phải lỗi mới.

## Kết luận

**Đừng bật trong một bước.** Bật sẽ đưa 101 vấn đề vào màn hình đỏ cùng lúc — đúng cái bẫy
claim `off-github-actions` đã ghi: *"gate chặn ngay sẽ bị bỏ qua, tệ hơn không có gate"*.

Thứ tự đề xuất, mỗi bước đều nhỏ và đo được:

1. **Sửa 6 lỗi connection + 8 lỗi `timezone.utc`** — khoảng 14 test, cơ học thuần, rủi ro
   thấp, không đụng hành vi.
2. **Quyết định về 23 test `vnbroker`.** Chúng cần package không tồn tại. Ba lựa chọn:
   đánh dấu skip với lý do, hoặc chấp nhận `vnbroker` là dependency ngoài và cài vào CI,
   hoặc xoá nếu đã lỗi thời. **Cần owner quyết** — tôi không tự chọn.
3. **Chia nhỏ 39 lỗi endpoint** theo feature; mỗi feature một ticket.
4. **Chỉ sau khi 1-3 xanh** thì bật discovery, và **bật ở mức cảnh báo trước** (không
   chặn), quan sát vài ngày rồi mới chuyển sang chặn.

Nếu chỉ làm bước 1 thì đã xử lý được ~14/101 vấn đề với rủi ro thấp nhất.

## Ghi chú về phương pháp

Lần đầu tôi gom nguyên nhân bằng cách lấy dòng exception **đầu tiên** trong khối lỗi, và
con số bị sai: 16 test bị quy cho `ModuleNotFoundError: vnbroker` — nhưng đó là dòng
`WARNING` của adapter chạy đúng chức năng degrade, không phải nguyên nhân fail. Lấy
dòng exception **cuối** khối mới cho 12 nhóm đúng. Ghi lại vì đây là loại sai sót dễ lặp
lại khi tổng hợp log.
