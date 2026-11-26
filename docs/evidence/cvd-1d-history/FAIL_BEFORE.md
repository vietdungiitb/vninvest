# FAIL-BEFORE — CVD 1D history (BE `cvd-1d-history-be`)

- **Ngày:** 2026-11-26 · **Commit (tests only):** `c166374d0` trên `feat/cvd-1d-history-be`
- **Code dưới test:** `views.py` **chưa sửa** (`SessionFactsCvdView.get` vẫn lấy 1 session, cache v2)
- **Môi trường:** VPS staging `14.225.255.47`, image `vninvest-core-api:staging`, DB tạm `cvd1d_verify`,
  worktree VPS `/tmp/wt-cvd1d` (đều đã dọn sau chạy).

## Lệnh tái tạo

```bash
# từ local: push branch chứa RIÊNG file test (chưa sửa views.py)
git push origin feat/cvd-1d-history-be

# trên VPS (script /tmp relative, xoá DB tạm có FORCE)
git -C /opt/vninvest fetch origin feat/cvd-1d-history-be
git -C /opt/vninvest worktree add /tmp/wt-cvd1d origin/feat/cvd-1d-history-be
PW=$(grep -E '^CORE_DB_PASSWORD=' /opt/vninvest/compose.staging.env | cut -d= -f2-)
docker exec vninvest-core-db psql -U vninvest -d vninvest_core -c "CREATE DATABASE cvd1d_verify;"
docker run --rm --network vninvest-staging_vninvest_network \
  -v /tmp/wt-cvd1d/packages/core/backend:/app \
  -e CORE_DATABASE_URL="postgresql://vninvest:${PW}@vninvest-core-db:5432/cvd1d_verify" \
  -e DJANGO_DEBUG=1 -e CORE_DB_CONN_MAX_AGE=0 \
  --entrypoint python vninvest-core-api:staging \
  manage.py test tests.test_cvd_1d_history_api --noinput
```

## Kết quả thật (log VPS `/tmp/cvd1d-gates.log`)

```
Ran 11 tests in 1.118s
FAILED (failures=4, errors=1)
```

| Test | Kết quả | Lý do đỏ ở code cũ |
|---|---|---|
| `test_t01_no_period_is_byte_for_byte_legacy_shape` | PASS | Path legacy đã đúng (đây là baseline cần giữ) |
| `test_t02_period_3m_returns_monotonic_history` | **ERROR** (`line 98`) | `period` bị bỏ qua ⇒ `payload['history']` không tồn tại |
| `test_t03_cumulative_is_running_sum_not_per_session_reset` | **FAIL** (`line 113`) | `bucket_count=1`, không có cumulative dồn |
| `test_t04_last_history_bucket_matches_legacy_session` | PASS | Fixture parity của bucket cuối vẫn khớp |
| `test_t05_unsupported_period_returns_400` | **FAIL** (`line 131`) | `period=999M` bị bỏ qua ⇒ 200 thay vì 400 |
| `test_t06_trade_date_overrides_period_even_invalid_period` | PASS | `trade_date` đã thắng từ trước |
| `test_t07_revision_bump_invalidates_v3_cache` | PASS* | Chạy ở code cũ nên chỉ kiểm được cache v2 (sẽ đo lại sau fix) |
| `test_t08_auth_is_enforced_before_period_parsing` | PASS | Scope gate đã đúng |
| `test_t09_missing_whale_day_is_zero_filled_from_daily_price` | **FAIL** (`line 183`) | Không đọc DailyPrice, không có bucket fill |
| `test_t10_10y_is_bounded_and_still_monotonic` | **FAIL** (`line 212`) | `period=10Y` bị bỏ qua |
| `test_t11_period_is_ignored_outside_1d_window` | PASS | window 15m legacy đã đúng |

**5/11 đỏ** — đúng các test history/contract mới. Đây là bằng chứng test có khả năng phát hiện lỗi,
không phải test xanh giả (L-V04).

## Sự cố môi trường đã xử lý (không phải lỗi code)

Lần chạy đầu teardown báo `psycopg2.errors.ObjectInUse: database "test_cvd1d_verify" is being accessed
by other users` — do `settings.py:236` `CORE_DB_CONN_MAX_AGE=60` giữ connection. Cách sửa đã áp dụng
cho lần chạy pass-after: thêm `-e CORE_DB_CONN_MAX_AGE=0` và `DROP DATABASE ... WITH (FORCE)` cho cả
`cvd1d_verify` lẫn `test_cvd1d_verify`. Kết quả test ở trên **không** bị sự cố này làm sai (test đã chạy
xong trước teardown).

## Cập nhật artifact (audit trail)

Sau commit fail-before `c166374d0`, bản test đổi 3 chỗ trước pass-after:
1. T-10 `date_from`: `today-2599` → `today-3650` (chốt R2: `date_from` là khoảng truy vấn).
2. Fixture anchor: `localdate()` → `now().date()` để hết flaky theo giờ +07 (legacy dùng UTC date).
3. Thêm T-12 patch clock ở biên UTC date = local date − 1.

T-10 đã đỏ ở `bucket_count` **trước** dòng `date_from`, T-02/T-03/T-05/T-09 cũng đỏ ở assert
kiểu/history ⇒ 3 dòng đổi đó **không làm sai** kết luận fail-before 5/11. Ghi rõ để artifact đỏ/xanh
không bị hiểu nhầm là cùng bản byte-for-byte.
