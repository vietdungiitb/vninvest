# PLAN — DataOps inventory dùng DB group cache, bỏ external KBS call (2026-11-20)

## 1. Bằng chứng reproduce (đã chạy thật)

- Playwright trên VPS với JWT staff, vào `https://docker.edusuccess.vn/operations-center?tab=dataops`, chờ 45s:
  - `GET /core/v1/operator/soc/dataops/inventory/` **không trả response** (không có `RESP`/`requestfinished`).
  - 4 endpoint khác (`run-logs`, `coverage`, `runtime-config`, `queue-tiers`) đều **200 trong ~5s**.
  - DOM: 4 skeleton cards vẫn còn; không có số liệu.
- Log daphne: `Application instance ... uri=/core/v1/operator/soc/dataops/inventory/ ... took too long to shut down and was killed`.
- Django test client (force_login, HTTP_HOST đúng) gọi view → **200** với `{"data":{"summary":{"total_rows":4582503,...}}}` ⇒ shape API đúng, lỗi nằm ở external call blocking.
- `DataOpsInventoryView.get()` (`service_ops/views/dataops_inventory.py:57-59`) gọi `fetch_symbol_group_members(g['id'])` cho mỗi `PREDEFINED_SYMBOL_GROUPS`; hàm này (`market_data/vnbroker_adapter.py:840-925`) thử KBS adapter + `fetch_listing_symbols` với retry ⇒ treo khi upstream chậm.
- DB có sẵn SSOT: `CachedSymbolGroup` 22 rows / `CachedSymbolGroupMember` 3968 rows; các group predefined đều có bản cache (`VN30`, `VNX50`, `VN100`, `HOSE`, `HNX`, `UPCOM`).

## 2. AC (Given/When/Then)

| ID | AC |
|---|---|
| AC1 | Given KBS external bị patch để **raise AssertionError nếu bị gọi**; When `GET /api/soc/dataops/inventory/`; Then vẫn **200**, response có `data.summary.total_rows > 0`, không gọi external. |
| AC2 | Given `CachedSymbolGroup` có members; When view chạy; Then `by_group` dùng members từ `CachedSymbolGroupMember` (DB), `symbol_count`/`covered_symbols` khớp DB. |
| AC3 | Group `vn50` map đúng cache `VNX50` (group_code `X50`), không trả 0 do sai tên. |
| AC4 | Custom group `custom_<slug>` vẫn đọc `CustomSymbolGroup.clean_symbols()` (DB), không external. |
| AC5 | Không migration, không đổi API shape/route; response vẫn `{data, meta}` envelope. |
| AC6 | Test **đỏ trước** (code cũ gọi external ⇒ AssertionError) → xanh sau. Chạy trên VPS Postgres riêng, drop sau. |

## 3. SCOPE / LIMIT / non-goals

- **SCOPE**: `dataops_inventory.py` (thay helper lấy members), 1 file test mới, docs/evidence, ledger.
- **LIMIT**: 1 slice, ≤3 vòng sửa. Không sửa `vnbroker_adapter.py` (dùng chỗ khác), không migration, không `package.json`.
- **Non-goals**: không tối ưu `by_year` aggregate; không đổi FE skeleton; không sửa KBS upstream.

## 4. Thiết kế tối thiểu

Helper module-level trong `dataops_inventory.py`:

```
_DB_GROUP_ALIASES = {'top100': 'VN100', 'vn50': 'VNX50'}

def _db_group_symbols(group_id):
    gid = str(group_id or '').strip().lower()
    if gid.startswith('custom_'): ... CustomSymbolGroup.clean_symbols()
    name = _DB_GROUP_ALIASES.get(gid, gid.upper())
    row = CachedSymbolGroup.objects.filter(is_active=True, group_name__iexact=name).first()
    if row is None: row = CachedSymbolGroup.objects.filter(is_active=True, group_code__iexact=gid.upper()).first()
    return list(row.members.values_list('symbol', flat=True)) if row else []
```

Trong `get()`: bỏ `from market_data.vnbroker_adapter import fetch_symbol_group_members`, thay `syms = _db_group_symbols(g['id'])`.

## 5. Gates

- [ ] BE test trên VPS (DB tạm `dataops_fix`, drop sau) — fail-before → pass-after.
- [ ] `python manage.py check` (VPS/main tree) exit 0.
- [ ] `node scripts/pre-push-gate.mjs` 36 PASS (sau rebase).
- [ ] Deploy staging + Playwright lại: inventory response 200 ~5s, có `4.6M`, không skeleton.
- [ ] CHƯA CHẠY ghi rõ nếu VPS unavailable.

## 6. Lessons áp dụng

L-V01 (mọi con số có lệnh tái tạo), L-V02 (không tin suy luận, đã reproduce), L-G02 (không báo PASS giả), L-M08 (chạy test/deploy trên VPS, không local Docker).
