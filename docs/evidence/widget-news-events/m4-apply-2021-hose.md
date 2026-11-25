# M4 apply — lô HOSE 2021 (2026-11-25)

> Tiếp nối `m4-apply-20261125.md` (HOSE 2022). Chạy staging VPS `14.225.255.47`,
> `docker exec -e PRICE_MIGRATION_PAUSED=1`, backup S0 `before_20261124.dump` (99 MB) sẵn.

## 1. Dry-run (không ghi DB)
```
python manage.py price_migration_persist --exchange HOSE --year 2021 --out /tmp/m4_2021.json
```
Output JSON thật:
```
{"dry_run": true, "matched": 87947, "db_only": 3002, "cafef_only": 0,
 "counts": {"update": 87947, "keep_unmapped": 3002, "insert": 0},
 "expected_cafef_rows": 87947}
```

## 2. Apply + verify DB thật
```
python manage.py price_migration_persist --exchange HOSE --year 2021 --apply \
  --out /tmp/m4_2021_apply.json --inserted-keys-out /tmp/m4_2021_keys.txt
```
Exit **0**. Query đối chiếu sau apply:
```sql
SELECT price_source, count(*) FROM market_data_dailyprice
 WHERE EXTRACT(YEAR FROM date)=2021 GROUP BY 1 ORDER BY 1;
SELECT count(*) FROM market_data_dailyprice
 WHERE EXTRACT(YEAR FROM date)=2021 AND adj_factor IS NOT NULL;
```
Output dán thật:
```
by_source = {"cafef": 87947, "unmapped_cafef": 3002, "vnbroker_legacy": 266815}
adj_factor = 87947
```
`cafef == expected_cafef_rows == adj_factor` ⇒ nhất quán. `cafef_only=0` nên không có key insert mới.

## 3. Phạm vi / trạng thái
Đã apply: **HOSE 2022 (91.808) + HOSE 2021 (87.947)** = 179.755 dòng.
Chưa: HNX/UPCOM, các năm khác. Flag `PRICE_ADJUSTED_DISPLAY` vẫn off; guard M6a chặn provider ghi đè cả 2 nhóm `cafef`/`unmapped_cafef`. Chưa invalidate cache / resume beat / E2E.
