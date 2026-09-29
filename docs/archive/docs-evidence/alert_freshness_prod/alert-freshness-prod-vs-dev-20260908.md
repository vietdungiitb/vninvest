# Evidence: Alert Freshness — dev vs prod/beta

**Ngày:** 2026-09-09  
**Lệnh:** `docker compose -p vninvest-dev exec core-api python manage.py shell` (dev), so sánh với prod/beta khi có quyền.

## Dev (`vninvest-dev`, 2026-09-09T11:11:50Z)

| Metric | Giá trị | Age | Ngưỡng DoD | Kết luận |
|---|---|---|---|---|
| `IntradayTick` latest | `2026-05-22T07:59:58+00:00` | **2643.20h (110 ngày)** | <1h (giờ mở) / <24h (ngoài giờ) | **FAIL** |
| `SymbolSnapshot` latest | `2026-08-05T13:36:59` | **50254m (34.9 ngày)** stale=False | <5m | **FAIL** |
| `UnifiedAlert` latest | `2026-08-10T01:25:43` type=system symbol=VCI | **30 ngày** | <5m | **FAIL** |
| Count | IntradayTick 89k, Snapshot 5705, Alert 2162 | — | — | — |

**Kết luận dev:** Cả 3 đều stale >30 ngày → P0-DEV đúng. `detect_and_store_global_whale_alerts` chạy `session=2026-05-22 whale_ticks=0` (log) và `backfill no_system_credentials` liên tục.

## Prod/Beta

- **CHƯA XÁC MINH** — chưa có quyền SSH vào `beta.edusuccess.vn` / prod. Cần chạy cùng lệnh trên prod để phân biệt:
  - Nếu **prod tươi (<1h)** → F01-F02 hạ P0→P2 DX, Phase A chỉ mock cho dev (0.5 ngày).
  - Nếu **prod cũng stale** → giữ P0 khẩn cấp, cần credential vendor (phụ thuộc bên thứ 3, không cam kết cứng 2 ngày).

**Khuyến nghị:** Chạy ngay `ssh beta.edusuccess.vn "docker exec ..."` trước khi merge Phase A.

## Raw log

```
now=2026-09-09T11:11:50.973513+00:00
tick_latest=2026-05-22T07:59:58+00:00 age_h=2643.20 count=89204
snapshot_latest=2026-08-05T13:36:59.979106+00:00 age_m=50254.85 stale=False
alert_latest=2026-08-10T01:25:43.635042+00:00 age_d=30 type=system symbol=VCI
```
