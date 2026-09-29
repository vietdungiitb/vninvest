# Code Quality Constitution - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Absolute rules

1. Khong tao per-user crawl silo.
2. Khong bypass planner coordinator.
3. Khong full-scan overwrite as default.
4. Khong import direct vnbroker internals ngoai market_data/vnbroker_adapter.py.
5. Khong de except-pass trong planner/scheduler path.

---

## 2. Required implementation style

1. requested_window phai explicit va auditable.
2. Counters phai co inserted/updated/skipped_existing/failed.
3. Scheduler decisions phai explainable qua output summary.
4. Text moi cho operator UI phai qua i18n.

---

## 3. Required review questions

1. Thay doi nay co giu planner as coordinator khong?
2. Co phat sinh duplicate crawl path khong?
3. Co risk queue flood va da co quota gate chua?
4. Evidence va rollback plan da du chua?
