# B4.4 kill-switch drill — mbw4 (staging, zero persistent change)

Ngay: 2026-10-15 · Nguoi chay: sup/PM · Worktree VPS: `/tmp/wt-mbw4-be`
Runner: `/tmp/mbw4_drill1.sh` (read-only) + `/tmp/mbw4_drill.py` qua `manage.py shell` (toggle trong transaction + rollback)

## Phase 1 — READ-ONLY

- `kill_now= False`, `write_allowed=True` (check_kill_switch('global') khong raise)
- `queue_celery= 0` (staging idle — cung helper `_get_redis_queue_depth` ma health card hien)

## Phase 2 — BAT kill-switch trong transaction + ROLLBACK

```
rows_before= 0
kill_effective_in_txn= True
DRILL_ON_blocked= True BrokerWriteDisabled
rows_after= 0 rollback_ok= True
DRILL_OFF_write_allowed=True
kill_final= False
```

Ket luan: BAT → ghi bi chan (`BrokerWriteDisabled`); TAT (rollback) → cho phep lai;
staging ve nguyen trang (0 row them, kill False). **Drill co che DAT.**

## Gioi han trung thuc

- **HTTP-path drill (order/sync-write tra 503 qua API) CHUA CHAY** — khong co staff credential
  staging de di het duong HTTP. Drill tren bao phu co che guard (`check_kill_switch`) ma
  moi duong ghi BE deu goi (fail-closed, da co test `test_broker_runtime` + `test_kill_switch`).
- Health card "khop so queue that": card doc `queues.celery` tu cung helper da do (`queue_celery= 0`);
  doi chieu truc quan tren UI staging thuoc E2E (CHUA CHAY).
