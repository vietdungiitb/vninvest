# Probe Q-B4 — độ phủ `IntradayTick` (2026-11-13, VPS staging, read-only)

> **Claim:** `closeout-dot1-20261113` · **Kết luận:** phủ dày, E4 khả thi ở mức polling — không hứa sub-second push.

## Lệnh (tái hiện)

```bash
scp tmp-qb4probe.py root@14.225.255.47:/tmp/qb4probe.py
ssh root@14.225.255.47 "docker cp /tmp/qb4probe.py vninvest-core-api:/tmp/qb4probe.py && docker exec -i vninvest-core-api sh -c 'cd /app/src && python manage.py shell < /tmp/qb4probe.py'"
```

Đọc qua Django ORM (`market_data.models.IntradayTick`, `db_table='market_data_intraday_tick'`) — dùng DB config của app, không chạm secret, aggregate chỉ đọc.

## Kết quả (chạy thật)

| Metric | Giá trị |
|---|---|
| SYMBOLS (distinct) | **1377** |
| ROWS (tổng) | **5037134** |
| MIN_TS | 2026-05-22 02:00:03+00 |
| MAX_TS | **2026-11-13 07:59:31+00** (hôm nay, tape còn chảy) |
| TOP | GAS 287398 · TCH 276503 · BFC 266935 · GVR 258556 · DPR 256885 |

## Kết luận

- Tape history dày (5M rows / 1377 mã, tới hôm nay) → E4 (sub-second display) **không bị chặn bởi thiếu dữ liệu lịch sử**.
- Nhưng nguồn là tape DB + FE poll 5s (`chartAdapter.js:129-151` `setTimeout(poll, 5000)`) → E4 chỉ hứa ở mức **polling**, **không** hứa sub-second push. Realtime push là việc khác (ngoài scope Đợt 1).
- Không ghi DB, không đổi code, không vessel secret nào (chỉ in count/symbol).
