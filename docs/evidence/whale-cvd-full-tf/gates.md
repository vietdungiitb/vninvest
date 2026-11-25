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
Kết quả: ✓ built (exit 0, chạy lại sau rebase: `✓ built in 45.36s`). Cảnh báo chunk >1000 kB là pre-existing (`RightSidebarDockHost` 1.994 MB), không liên quan slice này.

## Re-run sau rebase `origin/dev` (bắt buộc)
Lệnh trên chạy lại toàn bộ sau khi rebase từ `07c0df94c` sang `origin/dev` = `a0fe2b00b`:
- `py_compile` 5 file BE: exit **0**.
- `npx tsc --noEmit`: exit **0**.
- `npx vitest run src/features/stock-detail`: **2 files / 16 tests passed**, exit **0**.
- `npm run build`: exit **0** (`✓ built in 45.36s`).
- `node packages/web/scripts/check-multi-agent.mjs`: exit **0** (in cảnh báo `! CLAIMS.md … không tồn tại trong worktree này` từ claim của agent khác — gate vẫn trả 0; không phải lỗi của slice này).
- `git diff --stat 4a8f79d94..HEAD`: **không có file BE/FE nào của slice này thay đổi** (chỉ docs + file `price_migration_persist.py` từ `dev`) ⇒ kết quả BE **9/9** trên VPS trước rebase vẫn áp dụng cho code hiện tại. Không chạy lại VPS overlay vì code BE của slice không đổi.

## Gate KHÔNG xanh — pre-existing trên `origin/dev`
`node docs/audit-uiux/scripts/check-ledger-entry.mjs` → **FAIL**: `Entry 626 xuất hiện 2 lần, baseline cho phép 0` (exit **1**). Đã kiểm chứng bằng `git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md | Select-String '^## Entry 626'` → **2 dòng** ngay trên `origin/dev`, tức lỗi có sẵn trước slice này. Hai block mang evidence khác nhau (main commit `9c45bd13c` / `dev=0111b729f` và main commit `1dd9554c5` / `dev=c029a9c12`) nên **không xoá bản nào** — việc gộp/đánh số lại là của coordinator/owner. Slice này chỉ thêm Entry **640** (`--next-entry` trước khi thêm = 640, sau = 641); không tự sửa entry của agent khác.

**Kết luận gates của slice:** mọi gate do slice này chạy đều xanh; 1 gate ledger FAIL là nợ pre-existing của `dev`, được ghi rõ ở đây và trong audit — không báo PASS cho gate này.
