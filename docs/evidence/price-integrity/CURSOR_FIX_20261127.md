# Fix `InvalidCursorName` trên staging — 2026-11-27

## Fail-before (bằng chứng thật từ staging)

Sau khi merge PR #569 + deploy `dev@92ff56a17`, chạy:

```
docker exec -e DJANGO_DEBUG=1 -w /app/src vninvest-core-api \
  python manage.py check_price_integrity --since 2026-01-01 --json
```

Kết quả: `psycopg2.errors.InvalidCursorName: cursor "_django_curs_134355705234304_sync_1" does not exist`, traceback điểm cuối:

```
check_price_integrity.py:25  rows = collect_rows(...)
integrity.py:149             for row in qs.iterator(chunk_size=5000)
django/.../compiler.py:2174   cursor.close()
```

→ `.iterator()` dùng **server-side named cursor**; pool trên staging không giữ cursor giữa các lần fetch. Không phải lỗi dữ liệu, không phải lỗi logic audit.

## Fix

`market_data/cafef/integrity.py::collect_rows()` đổi sang **keyset pagination** theo `id`:

- `qs.order_by('id')` → lặp `qs.filter(id__gt=last_id).values(*fields)[:batch]`;
- mỗi lô là client-side slice (không named cursor) → chạy được mọi cấu hình pool;
- giữ nguyên `since` / `symbol` / `limit`; thêm tham số `batch` (mặc định 5000).

## TDD

- Đỏ: `test_integrity_collect_rows.py` stub `iterator()` ném `AssertionError` → 2 failed.
- Xanh: **22 passed** (2 collect-row + 14 integrity + 3 command + 3 task) trên code đã sửa.

## Verification

| Hạng mục | Kết quả |
|---|---|
| Unit 4 file | **22 passed** |
| `pre-push-gate` | Lần đầu `1 FAIL / 35 PASS` tại `hook-mode` (`node:fs:2413` sau 8 case PASS); chạy riêng `node tools/opencode-global/verify-hook-mode.mjs` → **PASS**, chạy lại `pre-push-gate` → **36 PASS / 0 FAIL**. Ghi là flake transient, không bỏ qua. |
| Chạy lại `check_price_integrity` trên staging sau deploy | **CHƯA CHẠY** (chờ PR merge + deploy) |

## Bài học cần ghi

Môi trường staging dùng pool transaction ⇒ **không dùng `.iterator()`/`chunk_size`** trong script audit chạy độc lập. Đã thêm test chặn tái diễn (`iterator` bị cấm trong `collect_rows`).
