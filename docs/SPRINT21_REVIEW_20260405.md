# Sprint 21 review (as of 2026-04-05)

## Tong quan

Sprint 21 backlog gom S21-01..S21-12. Phan code boundary da tien trien rat xa; phan con lai chu yeu la van hanh canary/observability runtime.

## Trang thai theo task

| ID | Trang thai | Ghi chu |
| :--- | :--- | :--- |
| S21-01 | PARTIAL | Nguong rollback da xuat hien trong backlog va canary templates; can van ban chot metrics co ky duyet owner Tech Lead/DevOps. |
| S21-02 | DONE | Flags da co trong backend/config/settings.py (default false). |
| S21-03 | DONE | portfolio/exceptions.py da co ExternalSystemException + BusinessLogicRuleException va map dung trong code/test. |
| S21-04 | PENDING OPS | Chua the verify Grafana/APM + alert fire test trong moi truong code local. |
| S21-05 | DONE | Da co inventory tai docs/SPRINT21_MARKET_DATA_ENDPOINT_INVENTORY.md. |
| S21-06 | DONE | adapters/vnbroker_adapter.py da tach network/timeout/rate-limit wrapper. |
| S21-07 | DONE | adapters/cache_adapter.py da tach cache boundary; them test happy/miss path trong backend/portfolio/tests/test_adapters.py. |
| S21-08 | DONE | market_data_service.py da gom business logic market data, giu boundary mot chieu. |
| S21-09 | DONE | market_views.py + toggle routes realtime/stock da hoat dong sau flag. |
| S21-10 | DONE | Contract tests toggle endpoint market data da co trong test_api_routes.py. |
| S21-11 | DONE | Regression auth/cache/fallback (whale feed, aggregate, workspace) da co test focused. |
| S21-12 | PENDING OPS | Canary 10% benchmark 24h can chay tren staging/ops (ngoai pham vi local workspace). |

## Cong viec con phai hoan thanh de dong Sprint 21

1. Chot bien ban measurement contract ky boi Tech Lead/DevOps (S21-01).
2. Thuc thi dashboard baseline + alert test fire tren APM/Grafana (S21-04).
3. Chay benchmark + canary 10% trong 24h, luu bao cao va ky sign-off (S21-12).

## Ket luan

- Ve code va test trong repo: Sprint 21 da dat muc san sang cao, khong con blocker ky thuat lon.
- Ve exit gate chinh thuc: chua the dong 100% do thieu 3 muc Ops/QA runtime ben tren.
