# M6c hotfix — query plan cho price_migration_persist (2026-11-25)

## 1. Phản chứng (L-V02)
```
EXPLAIN SELECT ... FROM market_data_dailyprice WHERE EXTRACT(YEAR FROM date)=2022 LIMIT 1;
→ Seq Scan on market_data_dailyprice (cost=0.00..153014.06 rows=22918)
```
Dù đã có index `market_data_dailyprice_date_e5322378`, `EXTRACT(YEAR...)` khiến planner không dùng được.

Lỗi thật khi chạy driver cũ (một process Django cho 45 lô): lô HOSE 2011 mất **744,2s**, lô sau bị OOM **exit 137** — không khả thi.

## 2. Fix
`price_migration_persist.py`: `date__year=year` → `date__range=(date(year,1,1), date(year,12,31))`. Không đổi logic classify/write, chỉ thay predicate.

## 3. Gate đo thật
```
time docker exec -e PRICE_MIGRATION_PAUSED=1 ... manage.py price_migration_persist \
  --exchange HOSE --year 2012 --out /tmp/m6c_2012.json
real 0m33.931s ; exit 0
```
~**22× nhanh hơn** (744s → 34s). Kèm thay đổi vận hành: mỗi lô chạy bằng process `docker exec` riêng (tránh tích tụ bộ nhớ Django), pacing 1s giữa các lô.

## 4. Phạm vi
Chỉ query predicate. Chưa đổi consumer/flag. Dùng cho đợt apply các lô còn lại.
