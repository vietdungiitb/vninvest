# BÁO CÁO TRẠNG THÁI THỰC TẾ — SaaS Migration VNInvest

**Ngày**: 2026-05-13  
**Tác giả**: GitHub Copilot (đọc code trực tiếp — không dựa vào conversation summary)  
**Phương pháp**: Scan actual code files, grep patterns, cross-check compose configs  
**Mục đích**: Để ban lãnh đạo ra quyết định chính xác về lộ trình tiếp theo

---

## 1. KIẾN TRÚC HIỆN TẠI — SƠ ĐỒ THỰC TẾ

```
Internet
    │
    ▼
frontend:80 (React, nginx)
    │
    │── /api/*          ──► core-api:8100 (Django/Daphne)
    │                           │
    │                           │── Native routes (/core/v1/*) → xử lý tại core
    │                           │── Bridge routes (/api/*) → proxy sang backend:8000
    │                           │
    │                           └──► backend:8000 (Legacy Django/runserver)
    │
    └── /core/v1/*      ──► core-api:8100 (Direct)
```

**Điều quan trọng cần hiểu**: Đây là kiến trúc SFI-B1 (Option B) đã được triển khai.  
- Frontend KHÔNG gọi legacy backend trực tiếp — tất cả đều qua core-api  
- core-api đóng vai trò **proxy gateway** — proxies các route chưa được migrate về backend:8000  
- Người dùng cuối chỉ thấy một entry point: `localhost/api/*`

---

## 2. TÌNH TRẠNG TỪNG DOMAIN — ĐỌC TỪ CODE

### Domain A: Infrastructure & DevOps

| Hạng mục | Trạng thái | File dẫn chứng |
|---|---|---|
| Dockerfile (production, multi-stage) | ✅ DONE | `packages/core/backend/Dockerfile` |
| entrypoint.sh (migrate + daphne) | ✅ DONE | `packages/core/backend/entrypoint.sh:18` |
| CI/CD GitHub Actions | ✅ DONE | `.github/workflows/core-api.yml`, `backend.yml`, `web.yml` (5 files) |
| Celery workers (core) | ✅ DONE — 6 workers | `docker-compose.dev.yml:102-340` |
| Celery beat (core) | ✅ DONE | `docker-compose.dev.yml:313` |
| Prometheus metrics | ✅ DONE | `settings.py:324` — `django_prometheus` in INSTALLED_APPS |
| **Tách core-db** | ❌ CHƯA LÀM | Dev dùng chung `@db:5432/vninvest` cho cả legacy và core |
| Proxy gateway (SFI-B1) | ✅ DONE | `legacy_http_bridge.py`, `LEGACY_BACKEND_URL` config |

---

### Domain B: Security

| Hạng mục | Trạng thái | Chi tiết |
|---|---|---|
| JWT | ✅ REMOVED | `backend/config/settings.py`: JWT removed, `LegacyCorePATAuthentication` thay thế |
| PAT HMAC+pepper | ✅ DONE | `identity_access/models.py:37` — `hmac.new(pepper.encode(), ...)` |
| CORE_PAT_PEPPER (dev) | ✅ Set | `compose.dev.env:13` = `dev-pat-pepper-replace-in-production` |
| CORE_PAT_PEPPER (prod) | ⚠️ RISK | Placeholder — phải set secret thật khi deploy prod |
| ALLOWED_HOSTS (core) | ✅ SECURE | `settings.py:18-26` — raise `ImproperlyConfigured` nếu wildcard trong prod |
| ALLOWED_HOSTS (dev) | ⚠️ WILDCARD | `docker-compose.dev.yml:64` — `DJANGO_ALLOWED_HOSTS: "*"` (OK cho dev) |
| CORS | ✅ SECURE | `settings.py:170` — `CORS_ALLOW_ALL_ORIGINS = False`, explicit origins |
| Docker secrets | ✅ IMPROVED | Compose dùng `${VAR:?error}` cho critical vars |
| Default passwords (dev) | ⚠️ EXPECTED | `devpassword` trong dev compose là intentional |

---

### Domain C: Authentication & Identity (identity_access)

| Hạng mục | Trạng thái | URL |
|---|---|---|
| Login (PAT-based) | ✅ DONE | `GET /core/v1/auth/login` |
| Profile / Me | ✅ DONE | `GET /core/v1/auth/me` |
| Logout | ✅ DONE | `POST /core/v1/auth/logout` |
| Tenant management | ✅ DONE | `GET /core/v1/tenant` |
| Service accounts | ✅ DONE | `GET /core/v1/service-accounts` |
| PAT issue/rotate/revoke | ✅ DONE | `/core/v1/partner/pats/*` |
| User onboarding/register | ✅ DONE | `POST /core/v1/onboarding/register` |
| **Frontend gọi core auth?** | ⚠️ PARTIAL | Frontend gọi `/core/v1/partner/*` (tenant-admin only), không gọi `/core/v1/auth/login` |

**Kết luận**: Core auth endpoints **đầy đủ**, nhưng frontend main flow vẫn dùng legacy `/api/auth/*`.

---

### Domain D: Market Data (market_data)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Intraday OHLCV bars | ✅ DONE | 22 tests passing, Phase 2 complete |
| Intraday tape (tick) | ✅ DONE | Redis cache 5 min TTL |
| Daily prices | ✅ DONE | `GET /core/v1/market-data/*` |
| **Frontend gọi core?** | ❌ KHÔNG | Frontend dùng `/stock-management/stocks/{symbol}/chart/` → legacy |

---

### Domain E: Market Serving (market_serving)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| SymbolSnapshot model | ✅ DONE | `market_serving/models.py` |
| SessionFacts model | ✅ DONE | `market_serving/models.py` |
| Materializer từ legacy DB | ✅ DONE | `materializers.py` với SM-P0.1 fix |
| Celery materialize tasks | ✅ DONE | `materialize_symbol_snapshot` (60s), `materialize_session_facts` (5min) |
| Symbol Snapshot endpoint | ✅ DONE | `GET /core/v1/symbol-snapshot` |
| Session Facts endpoint | ✅ DONE | `GET /core/v1/session-facts` |
| **Frontend gọi core?** | ❌ KHÔNG | Frontend dùng legacy price/snapshot endpoints |

---

### Domain F: Signal Intelligence & Whale Analytics (signal_intelligence)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| UnifiedAlert model | ✅ DONE | `signal_intelligence/models.py` |
| WhaleAlertCanonical model | ✅ DONE | |
| Materializer từ legacy | ✅ DONE | `materialize_unified_alerts` (2 min) |
| UnifiedAlert endpoint | ✅ DONE | `GET /core/v1/unified-alert` |
| WhaleFeed aggregate | ✅ DONE | `GET /core/v1/whale-feed` |
| OrderFlow event | ✅ DONE | `GET /core/v1/signals/order-flow/{symbol}/` |
| **Frontend gọi core?** | ❌ KHÔNG | Frontend dùng `/stock-management/stocks/{symbol}/order-flow/` → legacy |

---

### Domain G: User Workspace — Portfolio & Watchlist (user_workspace)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Portfolio CRUD models | ✅ DONE | `user_workspace/models.py:14` |
| Transaction models | ✅ DONE | `user_workspace/models.py:53` |
| Watchlist models | ✅ DONE | `user_workspace/models.py:99` |
| Portfolio CRUD views | ✅ DONE | `PortfolioListCreateView`, `PortfolioDetailView`, `TransactionListCreateView` |
| Watchlist CRUD views | ✅ DONE | `WatchlistListCreateView`, `WatchlistItemListCreateView` |
| Core native URLs (`/core/v1/workspace/*`) | ✅ DONE | Fully wired |
| Legacy compat URLs (`/api/portfolio/*`) | ✅ DONE | Same native views, legacy paths |
| Portfolio analytics (holdings, summary, chart) | ⚠️ STUB | `PortfolioAnalyticsStubView` — trả về empty |
| SubAccounts | ❌ CHƯA | Core không có SubAccount concept |
| Screener | ⚠️ STUB | `GenericEmptyListView` — trả về empty list |
| **Frontend gọi core?** | ⚠️ ROUTING | Frontend gọi `/portfolio/*` → core-api nhận (via compat URLs), NHƯNG holdings/summary/chart là stub |

---

### Domain H: Advisory & AI (advisory)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| AdvisoryRecord model | ✅ DONE | `advisory/models.py` |
| Advisory Latest endpoint | ✅ DONE | `GET /core/v1/advisory/latest/{symbol}/` |
| Advisory Refresh endpoint | ✅ DONE | `POST /core/v1/advisory/refresh/{symbol}/` |
| Advisory History endpoint | ✅ DONE | `GET /core/v1/advisory/history/{symbol}/` |
| **Frontend gọi core?** | ❌ KHÔNG | Frontend gọi `/stock-management/stocks/{symbol}/ai-advisory-session/` → legacy |

---

### Domain I: Commercial (commercial)

| Hạng mục | Trạng thái |
|---|---|
| Subscription model | ✅ DONE |
| Quota model | ✅ DONE |
| Invoice model | ✅ DONE |
| Billing endpoints | ✅ DONE |
| **Frontend gọi core?** | ✅ CÓ — `/core/v1/partner/billing/*` |

---

### Domain J: Screener

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Core screener domain | ❌ KHÔNG TỒN TẠI | Chỉ có stub view trả empty |
| Legacy screener | ✅ ACTIVE | `backend/portfolio/urls.py:74-80` |
| **Frontend gọi core?** | ⚠️ STUB | Core trả empty → frontend hiển thị trống |

---

### Domain K: Notification (Telegram, Preferred Symbols)

| Hạng mục | Trạng thái |
|---|---|
| Telegram notifications | ✅ LEGACY ACTIVE | `backend/portfolio/urls.py:108-113` |
| Core equivalent | ❌ KHÔNG TỒN TẠI |

---

## 3. FRONTEND ROUTES — PHÂN LOẠI THỰC TẾ

Dựa trên `frontend/src/api/client.js`:

### ✅ Đã gọi Core (`/core/v1/`)

| Route | Mục đích |
|---|---|
| `/core/v1/partner/service-accounts/` | Tenant admin — service accounts |
| `/core/v1/partner/tenant/` | Tenant info |
| `/core/v1/partner/pats/` | PAT management |
| `/core/v1/partner/usage/meters/` | Usage metering |
| `/core/v1/partner/usage/quotas/` | Quota info |
| `/core/v1/partner/billing/subscription/` | Billing |
| `/core/v1/partner/billing/invoices/` | Invoices |
| `/core/v1/operator/jobs/` | Operator jobs |
| `/core/v1/operator/audit/requests/` | Audit log |

**Nhận xét**: Chủ yếu là **SaaS admin/operator surface** — không phải main user flows.

### ⚠️ Gọi `/portfolio/*`, `/stock-management/*` — ROUTING QUA CORE, XỬ LÝ CHƯA ĐẦY ĐỦ

| Route Frontend | Core nhận? | Core xử lý được không? |
|---|---|---|
| `/portfolio/portfolios/` | ✅ | ✅ (native view) |
| `/portfolio/portfolios/{id}/` | ✅ | ✅ (native view) |
| `/portfolio/portfolios/{id}/holdings/` | ✅ | ❌ STUB (empty) |
| `/portfolio/portfolios/{id}/summary/` | ✅ | ❌ STUB (empty) |
| `/portfolio/portfolios/{id}/chart/` | ✅ | ❌ STUB (empty) |
| `/portfolio/portfolios/{id}/equity-curve/` | ✅ | ❌ STUB (empty) |
| `/portfolio/portfolios/{id}/analytics/` | ✅ | ❌ STUB (empty) |
| `/portfolio/portfolios/{id}/sync/` | ✅ | ❌ legacy bridge hoặc stub |
| `/portfolio/subaccounts/` | ✅ | ❌ STUB (empty) |
| `/portfolio/watchlist/groups/` | ✅ | ✅ (native) |
| `/portfolio/watchlist/groups/{id}/items/` | ✅ | ✅ (native) |
| `/portfolio/screener/rules/` | ✅ | ❌ STUB (empty list) |

### ❌ Vẫn gọi legacy qua bridge (routing tới backend:8000)

| Route Frontend | Tính năng |
|---|---|
| `/stock-management/stocks/{symbol}/` | Stock profile |
| `/stock-management/stocks/{symbol}/chart/` | Price chart |
| `/stock-management/stocks/{symbol}/order-flow/` | Order flow |
| `/stock-management/stocks/{symbol}/news/` | News |
| `/stock-management/stocks/{symbol}/ai-advisory-session/` | AI advisory |
| `/stock-management/stocks/{symbol}/overview/` | Stock overview |
| `/portfolio/portfolios/{id}/sync/` | Price sync |
| `/portfolio/watchlist/sync/` | Watchlist sync |
| `/admin-sync/stockprofile/` | Admin sync |
| `/ai-command-center/*` | AI config |
| Whale analytics, screener, Telegram | Nhiều features |

---

## 4. DATABASE — TRẠNG THÁI THỰC TẾ

```
Dev environment:
┌─────────────────────────────────────────────────┐
│  PostgreSQL (db:5432)                            │
│  Database: vninvest                              │
│                                                  │
│  Tables dùng bởi legacy backend:                │
│  - portfolio_portfolio                           │
│  - portfolio_transaction                         │
│  - portfolio_watchlistgroup                      │
│  - portfolio_tickersessionclose                  │
│  - portfolio_whalealertevent                     │
│  - portfolio_advisoryaggregatesnapshot           │
│  - ... (50+ legacy tables)                       │
│                                                  │
│  Tables dùng bởi core-api (CÙNG DB):            │
│  - market_serving_symbolsnapshot  (materializer) │
│  - market_serving_sessionfacts    (materializer) │
│  - signal_intelligence_unifiedalert (materializer)│
│  - user_workspace_portfolio       (native)       │
│  - user_workspace_watchlist       (native)       │
│  - identity_access_coretenant     (native)       │
│  - ... (core tables)                             │
└─────────────────────────────────────────────────┘

Vấn đề: legacy DB và core DB chưa tách. Cả hai viết vào cùng một PostgreSQL instance.
CORE_DATABASE_URL = postgres://postgres:devpassword@db:5432/vninvest (SAME as legacy)
```

---

## 5. CELERY WORKERS — TRẠNG THÁI THỰC TẾ

### Core Workers (packages/core) — ĐẦY ĐỦ

| Container | Queue | Nhiệm vụ |
|---|---|---|
| `core-worker` | general | General tasks |
| `core-worker-realtime-prefetch` | `realtime_prefetch` | Market data prefetch |
| `core-worker-analytics` | analytics | Analytics computation |
| `core-worker-realtime-stream` | realtime_stream | WebSocket data |
| `core-worker-enrichment` | enrichment | Data enrichment |
| `core-worker-manual` | manual | On-demand tasks |
| `core-beat` | — | Django Celery Beat scheduler |

### Legacy Workers — VẪN ACTIVE

| Container | Nhiệm vụ |
|---|---|
| `backend-worker` | `realtime_prefetch` + `offpeak_vnbroker_ingest` |
| `backend-beat` | Legacy Celery beat (schedule ingest từ vnbroker) |

**Nhận xét**: Ingest dữ liệu từ vnbroker vẫn do legacy worker làm → materializers của core đọc từ legacy DB.

---

## 6. TÓM TẮT: NHỮNG GÌ ĐÃ XONG VS CHƯA XONG

### ✅ Đã Hoàn Thành (Không cần làm lại)

1. Kiến trúc proxy gateway (SFI-B1) — core-api làm entry point duy nhất
2. Dockerfile multi-stage production
3. 6 Core Celery workers với queues riêng biệt
4. Celery beat scheduler (django_celery_beat)
5. Security: HMAC+pepper PAT, ALLOWED_HOSTS, CORS locked
6. JWT removed, PAT-only architecture
7. Materializers cố định (SM-P0.1) — đọc đúng legacy tables
8. Market Data Phase 2 — 22 tests passing
9. Portfolio CRUD trong core (native views + compat URLs)
10. Watchlist CRUD trong core
11. Advisory endpoints trong core
12. Signal Intelligence endpoints trong core
13. CI/CD GitHub Actions (5 workflows)
14. Prometheus metrics integration
15. SaaS Admin/Operator surface (commercial, identity_access partner APIs)

### ❌ Chưa Làm — Critical Path

1. **Portfolio Analytics** (holdings, summary, chart, equity-curve, allocation) — STUB trong core, cần implement
2. **SubAccounts** — legacy concept, cần quyết định migrate hay drop
3. **Stock Management surface** — chart, profile, order-flow, news, ai-advisory — vẫn qua legacy bridge
4. **AI Advisory frontend wire** — endpoint có, frontend chưa gọi core
5. **Screener** — chưa có core implementation, stub trả empty
6. **Tách core-db** — cần PostgreSQL instance riêng cho vninvest_core

### ⚠️ Partial / Cần Quyết Định

7. **Telegram Notifications** — không có core equivalent, cần quyết định giữ legacy hay drop
8. **SubAccount concept** — core không có model SubAccount; legacy có; frontend gọi `/portfolio/subaccounts/` → stub empty
9. **CORE_PAT_PEPPER production** — placeholder; phải set secret thật
10. **WebSocket** — core có Channels (SFI-B7 tag), chưa verify consumer hoạt động end-to-end

---

## 7. RỦI RO VÀ BLOCKERS THỰC TẾ

### Blocker Cấp Cao (Ảnh Hưởng UX Người Dùng Ngay)

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| B1 | Portfolio Analytics = STUB | Màn hình portfolio chính không hiển thị holdings, P&L, equity curve |
| B2 | SubAccounts = STUB | Chức năng sub-account trả về trống |
| B3 | Screener = STUB | Màn hình screener không hoạt động |
| B4 | Stock chart/overview = legacy bridge | Nếu legacy backend down, stock chart không hoạt động |

### Blocker Cấp Trung (Ảnh Hưởng Sau Khi Tắt Legacy)

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| B5 | AI Advisory frontend không gọi core | Advisory từ core không hiển thị |
| B6 | Market data frontend không gọi core | Chart dữ liệu từ legacy |
| B7 | Ingest data vẫn từ legacy worker | Nếu tắt legacy, không còn dữ liệu mới |
| B8 | Core DB chưa tách | Khi tắt legacy DB, core mất luôn |

### Rủi Ro Bảo Mật (Còn Tồn Tại)

| # | Vấn đề | Severity |
|---|---|---|
| S1 | `CORE_PAT_PEPPER=dev-pat-pepper-replace-in-production` trong prod | HIGH — nếu prod dùng placeholder này |
| S2 | Legacy backend `DJANGO_SECRET_KEY` dùng default trong dev | LOW — dev only, nhưng cần kiểm tra prod |
| S3 | `DJANGO_ALLOWED_HOSTS: "*"` trong dev core-api | LOW — dev only, prod sẽ raise error |

---

## 8. KIẾN TRÚC ĐÍCH — KHI NÀO CÓ THỂ TẮT LEGACY BACKEND?

Legacy backend (`backend/` + `backend-worker`) có thể tắt khi **TẤT CẢ** các điều kiện sau đúng:

```
Điều kiện tắt legacy backend:

□ Portfolio Analytics được implement trong core (holdings, summary, chart, equity-curve)
□ Stock Management surface được implement trong core (chart, profile, order-flow, news)  
□ AI Advisory frontend gọi /core/v1/advisory/
□ Ingest data được migrate từ backend-worker sang core-worker
□ SubAccount quyết định: migrate model sang core HOẶC drop feature
□ Screener quyết định: implement trong core HOẶC drop feature
□ Telegram notifications quyết định: migrate HOẶC drop
□ Core DB tách riêng (vninvest_core trên PostgreSQL riêng)
□ Production CORE_PAT_PEPPER được set thành random secret thật
□ Parity test tất cả critical tables >= 99%
```

---

## 9. KHUYẾN NGHỊ CHO QUYẾT ĐỊNH

### Phương án 1: Hoàn tất core, tắt legacy (Full migration)

**Thời gian ước tính**: 4-6 tuần  
**Chi phí**: 6-10 FTE × 4 tuần  
**Rủi ro**: Cao nếu không test kỹ từng feature

**Việc cần làm**:
- Implement Portfolio Analytics trong core (quan trọng nhất)
- Implement Stock Management surface trong core
- Migrate AI Advisory frontend calls
- Migrate ingest worker
- Tách core-db
- Viết migration scripts chuyển dữ liệu user (portfolios, watchlists, transactions)

### Phương án 2: Giữ hybrid, cải thiện dần (Incremental)

**Thời gian**: Ongoing, không deadline  
**Chi phí**: Thấp hơn, nhưng kéo dài  
**Rủi ro**: Thấp, nhưng technical debt tích lũy

**Việc cần làm**:
- Implement từng feature một, có thể test trước khi switch
- Không cần tắt legacy ngay
- Phù hợp nếu team nhỏ, không muốn rủi ro

### Phương án 3: Feature Freeze + Data Migration Focus (Fastest Path)

**Thời gian**: 2-3 tuần  
**Chi phí**: 3-4 FTE × 3 tuần  
**Rủi ro**: Trung bình

**Việc cần làm**:
- Implement chỉ Portfolio Analytics stub → native (1 tuần)
- Viết data migration script (portfolios, transactions, watchlists từ legacy sang core)
- Tắt legacy write paths, core làm SSOT
- Giữ legacy read-only trong 30 ngày rồi xóa
- Drop/simplify Screener, SubAccounts, Telegram (nếu ít dùng)

---

**Bạn cần thêm thông tin gì để ra quyết định? Tôi có thể drill-down vào bất kỳ domain nào.**
