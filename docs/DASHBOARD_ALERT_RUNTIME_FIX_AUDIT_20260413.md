# Dashboard Alert Runtime Fix Audit - 2026-04-13

## Pham vi
- Audit sau refactor fat files cho Dashboard + Alert Configuration Board.
- Khac phuc loi runtime: whale aggregate 500, unified alerts 502.
- Doi soat yeu to prefetch health va rate-limit vnstock.

## Trieu chung ban dau
- `GET /api/realtime/whale-feed/aggregate/` tra `500`.
- `GET /api/realtime/unified-alerts/` tra `502` do phu thuoc aggregate.
- `GET /api/health/prefetch/` van `healthy=true` (status `throttled_by_policy`).

## Nguyen nhan goc
1. Nhanh aggregate whale (legacy/refactored) co fallback vnstock intraday.
2. Khi vnstock tra 429 duoi dang exception khong map vao `ExternalSystemException`, code cu khong catch du.
3. Exception noi bot lam vo endpoint aggregate, keo theo unified alerts loi day chuyen.
4. Prefetch health do pipeline ticker cache va policy profile, khong do truc tiep nhanh aggregate intraday fallback.

## Thay doi da ap dung

### 1) Harden fallback vnstock (legacy helper)
- File: `backend/portfolio/whale_feed_helpers.py`
- Them `except Exception` trong `_build_vnstock_aggregate_records`:
  - Neu message mang dau hieu rate-limit => danh dau cooldown `vnstock:rate-limit:intraday`.
  - Khong nem loi ra ngoai; fallback ve danh sach rong an toan.

### 2) Harden fallback vnstock (refactored service)
- File: `backend/portfolio/market_data_service.py`
- Them `except Exception` trong `_build_vnstock_aggregate_records`:
  - Rate-limit generic -> mark cooldown + observability fallback.
  - Khong lam vo response aggregate/unified.

### 3) Guard tai diem goi legacy aggregate
- File: `backend/portfolio/views_realtime_aggregate_campaigns.py`
- Tai khoi goi `legacy_views._build_vnstock_aggregate_records(...)`:
  - Bo sung `except Exception` de chan toan bo exception generic.
  - Neu la rate-limit -> mark cooldown, ghi log info.
  - Nguoc lai log warning va tiep tuc voi `vnstock_records=[]`.
- Bo sung `logger = logging.getLogger(__name__)`.

### 4) Sửa cooldown lock sau refactor + da dang cache backend
- File: `backend/portfolio/views_portfolio_watchlist.py`
- `_acquire_sync_cooldown` duoc cap nhat:
  - Dung `cache.add(...)` de lock atomically neu backend ho tro.
  - Parse `locked_until` ve `int` de tuong thich backend tra string/bytes.
  - Fallback `cache.set(...)` neu lock da het han.

### 5) Sửa test patch target
- File: `backend/portfolio/tests/test_watch_sync.py`
- Doi patch target thanh `portfolio.views_portfolio_watchlist.sync_watchlist_prices`.

## Kiem chung

### Unit/targeted tests
- `portfolio.tests.test_watch_sync.WatchSyncApiCooldownTests.test_watchlist_sync_endpoint_enforces_user_cooldown`: PASS.
- `portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_unified_alerts_endpoint_returns_combined_whale_and_dark_flow`: PASS.

### Runtime smoke sau redeploy backend
- Rebuild/recreate backend voi compose dev stack (`vninvest-dev`).
- Ket qua:
  - `GET /api/realtime/whale-feed/aggregate/?scope=tracked&limit=5&sort=ts` => `200`.
  - `GET /api/realtime/unified-alerts/?window=session&limit=5` => `200`.
- `GET /api/health/prefetch/`:
  - `cache_backend=django.core.cache.backends.redis.RedisCache`
  - `status=throttled_by_policy`
  - `reason=policy_throttled`

## Giai thich ve cooldown runtime
- Smoke 2 lan goi `/api/portfolio/watchlist/sync/` voi user staff van co the deu `200` neu request thu nhat chay lau hon cooldown staff (mac dinh 10s).
- Do do ket qua nay khong phu dinh logic cooldown; no phu thuoc do dai request thuc te va profile user.

## Tac dong
- Dashboard khong con vo aggregate/unified khi vnstock bi 429 generic.
- Alert workspace tiep tuc hoat dong voi fallback an toan, khong error 500/502 day chuyen.
- Phan biet ro: prefetch health (ticker cache) va aggregate fallback health (intraday).

## De xuat tiep theo
1. Bo sung metric/health rieng cho aggregate fallback (`aggregate_vnstock_rate_limited`) de tranh nham voi prefetch health.
2. Them test api route cho truong hop exception generic (khong phai `ExternalSystemException`) tai aggregate legacy view.
3. Canh bao UI khi source aggregate la `intraday_tick_db` va `results=0` trong gio cao diem de user biet dang fallback.
