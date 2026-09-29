# TRACEABILITY MATRIX — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Truy vết từ yêu cầu → quyết định kiến trúc → task thực hiện → bằng chứng audit bắt buộc.

---

## 1. Ma trận truy vết chính

| Req ID | Yêu cầu | Quyết định đã khóa | Tài liệu | Task ID | Bằng chứng bắt buộc |
|---|---|---|---|---|---|
| SM-REQ-01 | Core API phải có data thật từ legacy DB qua materializers | Rewrite SQL materializers trỏ đúng `portfolio_tickersessionclose` và `portfolio_advisoryaggregatesnapshot` | Tech Spec mục 3 | SM-P0.1 | `upserted > 0` payload + API response không rỗng |
| SM-REQ-02 | `/core/v1/` endpoints phục vụ data, không phải mock/stub | Materializers chạy qua Celery beat mỗi 60s/5min | Tech Spec mục 3; Impl Plan mục 3.1 | SM-P0.1, SM-P2.2, SM-P2.5 | API payload snapshot + beat log |
| SM-REQ-03 | JWT refresh token phải invalid sau logout/rotation | `BLACKLIST_AFTER_ROTATION=True`, `ROTATE_REFRESH_TOKENS=True`, `token_blacklist` app | Tech Spec mục 4.1; Impl Plan mục 4 | SM-P1.1 | Test: 401 khi dùng refresh token cũ sau rotation |
| SM-REQ-04 | PAT hash phải dùng HMAC với pepper, không SHA-256 thuần | `_hash_pat_secret` dùng `hmac.new(pepper, secret, sha256)` ở cả hai codebase | Tech Spec mục 4.2; Impl Plan mục 4 | SM-P1.2 | Unit test hash function + auth integration test |
| SM-REQ-05 | `ALLOWED_HOSTS` và CORS không được wildcard/DEBUG-gated | `ImproperlyConfigured` raise khi thiếu explicit env vars trong production | Tech Spec mục 4.3-4.4 | SM-P1.3, SM-P1.4 | Container test output + curl test |
| SM-REQ-06 | Không có default passwords trong production Docker compose | `${VAR:?error}` syntax cho tất cả secrets | Tech Spec mục 4.5; Impl Plan mục 4 | SM-P1.5 | `docker compose config` fail test + `.env.prod.example` |
| SM-REQ-07 | Email credentials không được depend vào Django SECRET_KEY | Fernet key riêng cho email encryption; warning khi decrypt fail | Impl Plan mục 4 | SM-P1.6 | Startup warning test + Fernet round-trip test |
| SM-REQ-08 | Core DB phải tách hoàn toàn khỏi legacy DB | `vninvest_core` DB riêng, `CoreRouter` read-only legacy, không bao giờ write | Tech Spec mục 5; Impl Plan mục 5 | SM-P2.1 | DB router test + write-block test |
| SM-REQ-09 | Celery workers phải là real (không stub), beat schedule active | `core-worker` và `core-beat` chạy với real Celery commands | Tech Spec mục 7; Impl Plan mục 5 | SM-P2.2, SM-P3.x shadow slices | `celery inspect active` output + beat trigger log |
| SM-REQ-10 | data_ingest domain phải tồn tại với live ingest tasks | `packages/core/backend/src/data_ingest/` với IngestJob, tasks | Impl Plan mục 5 | SM-P2.3 | Task trigger output + SymbolSnapshot row count |
| SM-REQ-11 | Read endpoints phải có cache layer (15s TTL) | Redis cache với key `core:snapshot:{symbol}:{session_date}` | Tech Spec mục 8 | SM-P2.4 | Timing comparison + Redis key verify |
| SM-REQ-12 | UserProfile model phải tồn tại trong identity_access | Schema đúng spec, FK vào CoreTenant | Tech Spec mục 6.1; Impl Plan mục 6 | SM-P3.1.1 | Model migration + API test |
| SM-REQ-13 | Data migration phải đạt parity >= 99% trên mọi domain | Management commands với `--dry-run` và parity check | Impl Plan mục 6 + appendix | SM-P3.x.2 slices | Migration output + parity percentage |
| SM-REQ-14 | Subscription + Quota models thay thế UserConfig plan fields | `commercial.Subscription`, `commercial.Quota` với plan enforcement | Tech Spec mục 6.2-6.3; Impl Plan mục 6 | SM-P3.2.1, SM-P3.2.2 | API test + enforcement test (free user blocked) |
| SM-REQ-15 | Legacy backend phải có CONN_MAX_AGE >= 60 | `CONN_MAX_AGE=60` với env override | Impl Plan mục 3.2 | SM-P0.2 | Settings diff + restart log sạch |
| SM-REQ-16 | Production container phải build từ immutable Dockerfile | `packages/core/backend/Dockerfile` multi-stage; không source mount; entrypoint.sh | Tech Spec mục 9.1-9.2; Impl Plan mục 3.3-3.4 | SM-P0.3, SM-P0.4 | Build log + `check --deploy` output |
| SM-REQ-17 | UnifiedAlert replaces WhaleAlertEvent, parity preserved | `signal_intelligence.UnifiedAlert` với `event_id` unique key | Tech Spec mục 6.4; Impl Plan mục 6 | SM-P3.3.1, SM-P3.3.2 | Parity report + event_id check |
| SM-REQ-18 | advisory domain thay thế legacy AI advisory pipeline | `advisory.AdvisoryRecord`, ai_client.py, prompt_engine.py, shadow run | Tech Spec mục 6.7; Impl Plan mục 6 | SM-P3.4.x slices | Shadow parity log + API endpoint test |
| SM-REQ-19 | user_workspace domain thay thế portfolio/transaction/watchlist | `user_workspace.*` models với CRUD API | Tech Spec mục 2; Impl Plan mục 6 | SM-P3.5.x slices | CRUD integration test |
| SM-REQ-20 | ForensicWindow phải là physical carve-out, không tag-only | L5 physical table với expiry timestamp | Tech Spec mục 6; Impl Plan mục 6 | SM-P3.3.5 | Model migration + expiry field verify |
| SM-REQ-21 | market_data domain thay thế DailyPrice/StockProfile/VnbrokerConfig | `market_data.*` models + vnbroker adapter migration | Tech Spec mục 2; Impl Plan mục 6 | SM-P3.6.x slices | Adapter test + data migration parity |
| SM-REQ-22 | Frontend phải dùng coreApiAdapter cho tất cả API calls | `coreApiAdapter.js` là single source của API calls | Tech Spec mục 8.1; Impl Plan mục 7 | SM-P4.1, SM-P4.3-SM-P4.7 | Build PASS + adapter usage grep |
| SM-REQ-23 | Text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu | i18n files update cho mọi page mới trong packages/web | Handoff Master mục 5.5; AGENTS.md mục 3.8 | SM-P4.x page slices | Build PASS + i18n key check |
| SM-REQ-24 | StockDetail phải dùng KLineChart với CVD pane và strength pane riêng | KLineChart là surface trung tâm; CVD và strength riêng pane | AGENTS.md mục 3.1-3.3 | SM-P4.5 | Screenshot + build PASS |
| SM-REQ-25 | PgBouncer phải handling 500 concurrent connections | PgBouncer transaction mode, max 500 client conns | Tech Spec mục 9.3; Impl Plan mục 8 | SM-P5.1, SM-P5.7 | Load test: 500 VUs, 0 errors, p95 < 200ms |
| SM-REQ-26 | Prometheus + Grafana running với 4 dashboards | 4 required dashboards, alerts configured | Tech Spec mục 9.4; Impl Plan mục 8 | SM-P5.2 | Grafana screenshot + all targets UP |
| SM-REQ-27 | Sentry capturing errors từ core-api và core-worker | `sentry-sdk` installed, DSN configured | Impl Plan mục 8 | SM-P5.3 | Test exception captured in Sentry |
| SM-REQ-28 | GitHub Actions CI/CD: test → build → deploy pipeline | Pipeline fail nếu tests fail; deploy chỉ khi test PASS | Impl Plan mục 8 | SM-P5.4 | Pipeline run screenshot trên test PR |
| SM-REQ-29 | Automated daily backup với restore verify | `daily_db_backup` Celery task, R2/S3 upload, restore test | Impl Plan mục 8 | SM-P5.5 | Task execution log + restore test output |
| SM-REQ-30 | IntradayTick phải có partitioning theo tháng | Monthly partitions, auto-create logic | Impl Plan mục 8 | SM-P5.6 | Migration PASS + partition list query |
| SM-REQ-31 | 7 pre-decommission gates phải PASS trước khi xoá legacy | Gates A-G đều phải có evidence và Tech Lead sign-off | Handoff Master mục 10; Self-Audit mục 5 | SM-P6.0, SM-P6.x slices | Signed checklist + gate evidence |
| SM-REQ-32 | module_tree_full.md phải regenerate sau decommission | Regenerate phản ánh cấu trúc mới không có backend/ | User memory preference | SM-P6.7 | Diff output + new module_tree |
| SM-REQ-33 | Post-decommission: zero unhandled exceptions 7 ngày | Sentry monitoring intensive week 1 | Handoff Master mục 10 | SM-P7.1 | Sentry dashboard screenshot 7 days |
| SM-REQ-34 | Commercial billing activation | VNPay + MoMo + quota enforcement | Impl Plan mục 9 | SM-P7.2, SM-P7.3 | Payment test + quota block test |
| GOV-01 | Không coding trước explicit consent | Plan/docs freeze trước, coding sau | Handoff Master mục 8-9 | ARC-ALL | Owner confirmation / explicit approval record |
| GOV-02 | Mọi slice phải sync audit docs | `CODE_CHANGE_AUDIT_LEDGER.md` + `PROGRESS_DASHBOARD.md` update bắt buộc | Self-Audit mục 3 | ALL | Ledger + progress sync |
| GOV-03 | Không code ngoài scope slice hiện tại | Nếu phát hiện vấn đề khác → ghi issue, không tự ý fix | Handoff Master mục 9.7 | ALL | PR diff không vượt scope |
| GOV-04 | Shadow run bắt buộc cho mỗi Celery task migration | Ít nhất 3 ngày trade trade, parity >= 99% | Tech Spec mục 7.1; Impl Plan | SM-P3.x.3 slices | Shadow parity log 3 ngày |

---

## 2. Security issue traceability (từ audit)

| Audit Finding | Severity | Req ID | Fix Task | Verification |
|---|---|---|---|---|
| JWT `BLACKLIST_AFTER_ROTATION=False` | CRITICAL | SM-REQ-03 | SM-P1.1 | 401 test sau refresh |
| PAT SHA-256 không có pepper | HIGH | SM-REQ-04 | SM-P1.2 | HMAC hash unit test |
| `ALLOWED_HOSTS='*'` trong core settings | HIGH | SM-REQ-05 | SM-P1.3 | ImproperlyConfigured test |
| `CORS_ALLOW_ALL_ORIGINS=DEBUG` | HIGH | SM-REQ-05 | SM-P1.4 | CORS deny test |
| Default passwords trong prod compose | HIGH | SM-REQ-06 | SM-P1.5 | `docker compose config` fail |
| Email credentials tied to SECRET_KEY | MEDIUM | SM-REQ-07 | SM-P1.6 | Fernet round-trip test |

---

## 3. Performance issue traceability (từ audit)

| Audit Finding | Req ID | Fix Task | Verification |
|---|---|---|---|
| Không có DB connection pooling | SM-REQ-15, SM-REQ-25 | SM-P0.2, SM-P5.1 | Load test 500 VUs |
| Source mount trong production | SM-REQ-16 | SM-P0.3 | `check --deploy` pass |
| Core Celery workers là stubs | SM-REQ-09 | SM-P2.2 | `celery inspect active` |
| Materializers query wrong tables | SM-REQ-01 | SM-P0.1 | API data non-empty |
| IntradayTick unbounded growth | SM-REQ-30 | SM-P5.6 | Partition table verify |

---

## 4. Dependency graph giữa tasks

```
SM-P0.1 ─┐
SM-P0.2  ─┤
SM-P0.3  ─┤─► SM-P1.x (security) ─┐
SM-P0.4  ─┘                        │
                                    ▼
                           SM-P2.1 (DB separate) ─┐
                           SM-P2.2 (real workers) ─┤─► SM-P3.x (domain migration)
                           SM-P2.3 (data_ingest)  ─┘    │
                                                         │
                                    SM-P4.x (frontend) ◄─┤ (sau P3.3 + P3.4)
                                    SM-P5.x (infra)    ◄─┘ (song song với P3-4)
                                         │
                                         ▼
                              SM-P6.0 (gates verify)
                              SM-P6.x (decommission)
                                         │
                                         ▼
                              SM-P7.x (post-production)
```

---

## 5. Quy tắc sử dụng matrix

1. Mỗi slice phải map ít nhất một `Req ID` trước khi bắt đầu code.
2. Không có bằng chứng ở cột cuối thì slice chưa được PASS.
3. Nếu một slice không thể map Req ID nào, dừng lại và hỏi Tech Lead.
4. Shadow run slice: parity log phải cover ít nhất 3 ngày trade thật.
5. Decommission slices: không được execute nếu chưa sign-off tất cả gates trong SM-P6.0.
