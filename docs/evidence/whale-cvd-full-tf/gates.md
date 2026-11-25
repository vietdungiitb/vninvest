# Gate evidence — whale-cvd-full-tf (2026-11-25)

Scope: `feat/whale-cvd-full-tf`, mọi lệnh dưới đây do coordinator tự chạy (không phải self-reported của subagent).

## BE syntax
```powershell
cd "D:\Mujoco Projects\vninvest"
python -m py_compile `
  packages/core/backend/src/market_data/stock_mgmt_native_views.py `
  packages/core/backend/src/market_serving/native_views.py `
  packages/core/backend/src/market_serving/views.py `
  packages/core/backend/src/market_serving/session_facts_engine.py `
  packages/core/backend/src/market_data/tests/test_whale_cvd_full_tf.py
```
Kết quả: `PY_COMPILE_OK` (exit 0).

## BE tests — Postgres trên staging VPS (bắt buộc theo AGENTS.md)
Host: `14.225.255.47`, container `vninvest-core-api`, repo `/opt/vninvest`.
Overlay: 4 file BE + test file copied vào container từ `/tmp/whale_overlay/`; `CORE_DATABASE_URL` đổi `@pgbouncer:6432/` → `@vninvest-core-db:5432/`; chạy xong `restore.sh` (đã verify: `grep -c build_whale_buckets` = 0, test file = `TEST_REMOVED`).

```
python manage.py test \
  market_data.tests.test_whale_cvd_full_tf \
  market_data.tests.test_stock_management_native_api.StockManagementNativeApiTestCase.test_stock_dark_money_history_returns_native_envelope \
  market_data.tests.test_stock_management_native_api.StockManagementNativeApiTestCase.test_core_v1_stock_dark_money_history_route_matches_public_contract \
  market_serving.tests.test_native_views.SessionFactsCvdViewTestCase \
  --noinput --keepdb
```
Kết quả:
```
CONTAINER_OVERLAY_DONE
TEST_EXIT=0
Ran 9 tests in 1.579s
OK
```
5 test trong `test_whale_cvd_full_tf.py`: aggregate/side, fill bucket rỗng, floor 500M + empty neutral, whale-feed alias/invalid window, window 1D price/ts. 4 test regression: dark-money envelope (2) + session-facts CVD (2).

## FE type-check
```powershell
cd packages/web
npx tsc --noEmit
```
Kết quả: exit 0, không có diagnostic.

## FE unit tests
```
npx vitest run src/features/stock-detail
```
Kết quả:
```
Test Files  2 passed (2)
Tests       16 passed (16)
```
13 test cũ + 3 test mới: dark-money fetch/expose, clear-on-symbol, whale marker `price`/`matched_value === 18200` (close, không phải 900000000 VND).

## FE build
```
npm run build
```
Kết quả: `✓ built in 49.64s` (exit 0). Cảnh báo chunk >1000 kB là pre-existing (`RightSidebarDockHost` 1.994 MB), không liên quan slice này.

## Ghi chú rebase
Sau khi rebase `origin/dev`, coordinator chạy lại toàn bộ gate ở trên và cập nhật kết quả vào file này nếu có thay đổi.
