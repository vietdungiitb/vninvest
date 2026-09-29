# Config Ownership Matrix — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## Config registry

| Config | Mục đích | Owner | Writer | Runtime Surface | Rotate/change procedure |
|---|---|---|---|---|---|
| `GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS` | Mặc định `daily_delta` window | Tech Lead Backend | Backend config owner | settings/runtime policy | config change + evidence |
| `GLOBAL_MARKET_DATA_DEEP_BOOTSTRAP_DAYS` | Window mặc định cho `deep_bootstrap` | Tech Lead Backend | Backend config owner | settings/runtime policy | config change + evidence |
| `GLOBAL_MARKET_DATA_FAST_PATH_HOT_SLA_MINUTES` | SLA bootstrap cho hot promoted symbols | Tech Lead Backend | Backend config owner | scheduler/planner policy | config change + smoke test |
| `GLOBAL_MARKET_DATA_FAST_PATH_WARM_SLA_MINUTES` | SLA bootstrap cho warm promoted symbols | Tech Lead Backend | Backend config owner | scheduler/planner policy | config change + smoke test |
| `BACKFILL_MAX_BATCH_SYMBOLS` | Kích thước batch executor | Core Backend | Backend config owner | execution planner | config change + throughput test |
| `BACKFILL_MAX_CONCURRENCY_PER_PROVIDER` | Giới hạn concurrency/provider | Core Backend | Backend config owner | executor runtime | config change + throttle audit |
| `BACKFILL_PROGRESS_RETENTION_DAYS` | Giữ run/batch progress bao lâu | Service Ops | Backend config owner | progress persistence | config change + cleanup evidence |
| `BACKFILL_CRITICAL_GAP_THRESHOLD_DAYS` | Ngưỡng coi là critical gap | Product + Tech Lead | Backend config owner | anomaly guard | config change + alert evidence |
| `SCHEDULER_QUEUE_MAP['daily-backfill-prices-1700']` | Queue cho daily backfill job | Service Ops | Backend config owner | Celery routing | config change + worker smoke |
| `SCHEDULER_QUEUE_MAP['deep-history-bootstrap-weekly']` | Queue cho deep backfill job | Service Ops | Backend config owner | Celery routing | config change + worker smoke |

---

## Ownership rules

1. Frontend không được ghi trực tiếp các config backfill policy.
2. Operator UI chỉ trigger runs hoặc xem progress; không mutate planner rules ngoài surface được duyệt.
3. Thay đổi scheduler queue hoặc frequency phải có evidence worker health và rollback note.
4. Thay đổi thresholds completeness/anomaly phải cập nhật docs và test expectations liên quan.
5. Không hardcode production fallback nguy hiểm cho scheduler/operator APIs.
