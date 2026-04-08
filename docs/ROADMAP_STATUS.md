# VNInvest — Trạng Thái Dự Án & Roadmap

> **Cập nhật lần cuối**: 2026-04-08  
> **Phiên bản codebase**: Sprint 17 COMPLETE / Sprint 18 CODE COMPLETE / Sprint 19 CODE COMPLETE FOR INTERNAL TEST / Sprint 23 CLOSED (CONDITIONAL GO) / Sprint 24 READY TO EXECUTE / Sprint 29 READY TO EXECUTE  
> **Tác giả**: Tự động tổng hợp từ toàn bộ quá trình phát triển Sprint 7–19

## Chuẩn hóa thuật ngữ

- Tên gọi chính thức: `User Management Core` được quy chiếu về `Sprint 12`.
- `Sprint 1-2` chỉ là bucket kế hoạch nội bộ cho plan/tier/CASL/auth design, không phải mốc sprint chính thức của chức năng đã deliver.
- `Sprint 13` là phần mở rộng `Admin Operations` và thống kê người dùng, không phải mốc `User Management Core`.
- Chức năng `Đăng ký người dùng` da duoc implement trong `Sprint 12 extension`; browser QA va sign-off van con mo.
- Huong mo rong `dang ky -> tu dong provision danh muc/tieu khoan mac dinh` duoc track tiep theo nhom `Sprint 12 extension` de tranh tach nhanh tai lieu.
- Tai lieu canonical cho nhanh nay:
  - `docs/SPRINT12_USER_REGISTRATION_PLAN.md`
  - `docs/SPRINT12_ACCEPTANCE_CHECKLIST.md`
  - `docs/SPRINT_EXECUTION_LOG.md`

### Tracking note (2026-04-08)

- Feature bo sung moi: Starter portfolios provisioning sau dang ky thanh cong.
- Sprint goc quy chieu: `Sprint 12 - User registration extension`.
- Huong tich hop: sau khi tao `User` + `UserConfig`, he thong tu tao bo `Portfolio` mac dinh va cac `SubAccount` thong dung.
- Nguyen tac van hanh: idempotent, fail-soft, co feature flag rollout, co command backfill user cu.
- Tinh trang hien tai: Planned (chua coding), da gan vao roadmap de theo doi dong bo cung nhanh Sprint 12.

---

## 0.0 Sprint 19 — CODE COMPLETE FOR INTERNAL TEST (Mobile App MVP Android + iOS)

**Focus**: Khoi dong mobile app MVP cho VNInvest voi React Native (Expo), ship internal build Android/iOS theo lo trinh 4 tuan.

**Muc tieu chinh**:
- Auth day du (register/login/refresh/logout) + secure token storage.
- Dashboard mobile (summary/holdings/allocation) + pull-to-refresh.
- Transactions CRUD + validation ma CK.
- Watchlist/tracked symbols + Whale alerts hub/detail + realtime fallback.

**Tai lieu chuan cho sprint nay**:
- `docs/SPRINT19_DETAILED_PLAN.md`
- `docs/SPRINT19_ACCEPTANCE_CHECKLIST.md`

**Trang thai hien tai**: CODE COMPLETE FOR INTERNAL TEST.

**Da hoan tat trong codebase:**
- Workspace mobile Expo + TypeScript da co va da type-check sach.
- Auth flow: login/register/refresh/session restore/logout + secure token storage.
- Dashboard mobile: summary/holdings/allocation + pull-to-refresh + i18n.
- Transactions: CRUD, symbol validation, autocomplete.
- Watchlist: tracked symbols add/remove.
- Whale: tab rieng, sort/filter, advisory refresh, websocket + polling fallback, foreground/background hardening.
- Profile tab: thong tin tai khoan, doi ngon ngu, logout.
- Tai lieu release noi bo: checklist, smoke test, release notes, rollback notes.

**Con mo truoc sign-off sprint:**
- Chay smoke test 30 phut tren Android/iOS.
- Tao artifact Android internal build va iOS build neu account readiness cho phep.
- Nhan sign-off Mobile / Backend / QA / PM.

---

## 0.2 Sprint 23 - CLOSED (CONDITIONAL GO)

Focus: chot no ky thuat sau audit backend v2, dong bo architecture boundary va rollout theo metric.

Trang thai hien tai: CLOSED FOR CODING DELIVERY (CONDITIONAL GO cho staging/prod sign-off).

Da hoan tat buoc chuan bi:
- Co execution board + owner matrix + daily tracker + endpoint checklist.
- Co run-day playbook de van hanh gate.
- Co coding plan sprint moi + acceptance checklist + taskboard CSV.

Muc tieu sprint:
1. Giam coupling external provider tren HTTP path.
2. Giam do phuc tap legacy views theo strangler pattern.
3. Chuan hoa validation + threshold policy.
4. Co baseline/canary/rollback gate du evidence.

Tai lieu chuan cho sprint nay:
- `docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md`
- `docs/SPRINT23_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT23_TASKBOARD.csv`
- `docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md`

## 0.3 Sprint 24 - READY TO EXECUTE (Dashboard Realtime Consistency Sprint)

Focus: dong bo data consistency tren Dashboard giua snapshot/live, giam UX noise va chot mini canary validation.

Trang thai hien tai: READY TO EXECUTE.

Muc tieu sprint:
1. Hoist single source quote state cho Dashboard.
2. Live overlay cho HoldingsTable + StatCards cung timestamp.
3. UX polish observability/sync behavior.
4. KPI evidence + mini canary + go/no-go note.

Tai lieu chuan cho sprint nay:
- `docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md`
- `docs/SPRINT24_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT24_TASKBOARD.csv`
- `docs/SPRINT24_TRUST_DECISION_STORIES.md`
- `docs/SPRINT24_QA_TEST_CHECKLIST_TRUST_DECISION.md`
- `docs/SPRINT24_DAILY_STANDUP_TEMPLATE.md`
- `docs/SPRINT24_CODING_BREAKDOWN_PLAN.md`
- `scripts/ops/sprint24_collect_dashboard_evidence.ps1`

## 0.4 Sprint 29 - IN PROGRESS (DEV COMPLETE, QA/CANARY PENDING)

Focus: dua context chart hien tai (du lieu so) vao luong tao AI advisory tabs de tang do chinh xac theo boi canh user dang xem.

Trang thai hien tai: IN PROGRESS.

Muc tieu sprint:
1. FE gui chart_context khi tao AI tab tren `/stocks/:symbol`.
2. BE validate/sanitize chart_context va inject vao prompt generation.
3. API response co `chart_context_used` + `chart_context_warnings` de FE hien thi minh bach.
4. Co telemetry + canary gate + rollback gate truoc full rollout.

Tien do cap nhat:
- Da hoan tat code BE/FE cho chart_context, prompt injection, response flags va runtime KPI telemetry.
- Da bo sung matrix API test (valid/invalid/missing/oversize) va pass targeted tests.
- Da hoan tat UI badge/warning + viewport visible-range collector tren Kline.
- Con lai: Q0-02 E2E VNM/VCB/FPT, Q0-03 performance report, R0-01 canary + go/no-go.

Tai lieu chuan cho sprint nay:
- `docs/SPRINT29_AI_ADVISORY_KLINE_CONTEXT_EXECUTION_PLAN.md`
- `docs/SPRINT29_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT29_TASKBOARD.csv`

Tai lieu implementation companion:
- `docs/AI_ADVISORY_KLINE_CONTEXT_UPGRADE_PLAN_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_TASKBOARD_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_EXECUTION_TRACKER_20260408.md`

---

## 0.1 Sprint 18 — CODE COMPLETE (Django Admin Google Mail OAuth2)

**Focus**: Quan tri tai khoan gui mail Google bang OAuth2 token trong Django Admin (thay vi phu thuoc SMTP password)

**Trang thai hien tai**: CODE COMPLETE — 19/19 tests PASS, `manage.py check` 0 issues. Con cho sign-off + canary staging.

**Da hoan tat:**
- Mo rong model `SystemEmailAccount` voi `auth_type=google_oauth2` va 10 truong OAuth token fields.
- Migration `0014_systememailaccount_google_oauth2` da apply, `makemigrations --check` sach.
- Services moi: `google_oauth_service.py` (authorize/exchange/refresh/userinfo), `gmail_service.py` (MIME + Gmail API).
- `mail_service.py` branch theo `auth_type`, `_humanize_gmail_error()` map HTTP 401/403/429/5xx.
- Django Admin: `SystemEmailAccountAdmin` voi routes `connect / callback / revoke`, security hardening (state TTL 600s, signing, account+user binding).
- Test suite: **19/19 PASS** (model methods / admin flow / callback security / token refresh isolated / email verification regression).
- Docs: runbook 10 sections + staging canary checklist (step A-D, exit criteria, rollback).

**Con lai truoc sign-off:**
- Canary rollout tren staging voi Google OAuth credentials thuat (theo `SPRINT18_STAGING_CANARY_CHECKLIST.md`).
- Monitoring 24-48h sau deployment staging.
- Sign-off BE Lead / QA / DevOps / PM.

**Tai lieu chuan cho sprint nay**:
- `docs/SPRINT18_DETAILED_PLAN.md`
- `docs/SPRINT18_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT18_GOOGLE_OAUTH_RUNBOOK.md`
- `docs/SPRINT18_STAGING_CANARY_CHECKLIST.md`

**Du kien timeline**: 7 ngay cong (Phase 0-5) — DONE

---

## 1. Tổng Quan Dự Án

**VNInvest** là ứng dụng theo dõi danh mục đầu tư chứng khoán Việt Nam (HOSE/HNX/UPCOM) kết hợp robo-advisor. Mục tiêu cung cấp công cụ theo dõi realtime, phân tích hiệu suất, cảnh báo whale, và tư vấn giao dịch tự động cho nhà đầu tư cá nhân người Việt.

### Stack Công Nghệ

| Lớp | Công nghệ | Phiên bản |
|-----|-----------|-----------|
| Backend framework | Django + Django REST Framework | 6.0.3 |
| ASGI server | Daphne | 4.2.1 |
| WebSocket | Django Channels | — |
| Task queue | Celery | — |
| Message broker | Redis | — |
| Market data | vnstock (nguồn VCI) | — |
| ORM | Django ORM | SQLite local / PostgreSQL prod |
| Frontend | React | — |
| Styling | Tailwind CSS | — |
| HTTP client | Axios + proxy dev | — |
| Runtime | Python 3.13 / Node 20 | — |

### Môi Trường

```
Backend : http://127.0.0.1:8000/
Frontend: http://localhost:3000/
Health  : http://127.0.0.1:8000/health/
Admin   : http://127.0.0.1:8000/admin/
venv    : backend/.venv/
```

---

## 2. Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend (3000)              │
│  Dashboard │ Watchlist │ StockDetail │ WhaleAlerts  │
│  AdminOps  │ Portfolio  │ Login/Auth                │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/REST + WebSocket (WS)
┌──────────────────▼──────────────────────────────────┐
│               Django + Daphne ASGI (8000)           │
│                                                     │
│  /api/portfolio/     → Portfolio CRUD, analytics    │
│  /api/stock-management/ → Mã CK, nhóm, StockProfile │
│  /api/admin-sync/    → Sync operations              │
│  /api/realtime/      → Ticker fallback, whale-feed  │
│  /api/admin-ops/     → System ops dashboard        │
│  /ws/realtime/       → WebSocket gateway           │
│  /health/            → Health check                 │
└─────────┬───────────────────┬───────────────────────┘
          │                   │
┌─────────▼──────┐   ┌────────▼──────────────────────┐
│  SQLite/PgSQL  │   │  Redis (Pub/Sub + Channels)   │
│  Dữ liệu app  │   │  channel_layer + cache        │
└────────────────┘   └─────────┬─────────────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │  Celery Worker           │
                  │  collect_and_publish     │
                  │  (vnstock → compute →   │
                  │   Redis publish)        │
                  └──────────────────────────┘
```

### Realtime Event Flow

```
vnstock VCI API
  → Celery: collect_and_publish_realtime (mỗi 5s)
    → portfolio/realtime/collector.py  → raw quotes
    → portfolio/realtime/compute.py    → VWAP, whale detection
    → portfolio/realtime/publisher.py  → Redis pub/sub
      → Django Channels consumer
        → WebSocket → useRealtimeFeed.js (frontend)
          → Watchlist.jsx, DashboardRealtimePanel.jsx
```

---

## 3. Cấu Trúc Thư Mục Quan Trọng

```
backend/
  config/
    settings.py       — Feature flags: REALTIME_ENABLED, REALTIME_DEFAULT_WHALE_THRESHOLD
    urls.py           — Route aggregator (portfolio + stock-management + admin-sync + realtime + admin-ops)
    celery.py         — Celery app config
    asgi.py           — ASGI + Channels routing
  portfolio/
    models.py         — Domain models
    views.py          — API views
    analytics.py      — Portfolio analytics (Sharpe, Sortino, MDD, TWR)
    services.py       — Business logic (StockProfile sync, exchange lookup)
    serializers.py    — DRF serializers
    consumers.py      — WebSocket consumer (JWT auth + subscribe/unsubscribe)
    tasks.py          — Celery tasks (collect_and_publish_realtime)
    realtime/
      collector.py    — vnstock polling
      compute.py      — VWAP, whale detection
      publisher.py    — Redis fan-out
    urls.py           — Portfolio CRUD routes
    urls_stock.py     — Stock management routes
    urls_admin_sync.py — Admin sync routes
    urls_realtime.py  — Realtime fallback + whale-feed routes
    tests/
      test_api_routes.py
      test_realtime_compute.py
      test_realtime_gateway.py
      test_analytics_advanced.py
      test_admin_ops.py
  management/commands/
    seed_user.py
    seed_demo_data.py
    seed_securities_groups.py
    seed_watchlist.py
    sync_stockprofile.py
    realtime_tick.py

frontend/src/
  hooks/
    useRealtimeFeed.js    — WebSocket + polling fallback hook (SINGLE SOURCE OF TRUTH)
  components/
    DashboardRealtimePanel.jsx  — Realtime radar: quotes + whale alerts
    RealtimeDebugPanel.jsx      — Dev observability panel (?debug=realtime)
  pages/
    Dashboard.jsx
    Watchlist.jsx
    StockDetail.jsx
    WhaleAlertsDashboard.jsx
    AdminOps.jsx
    Login.jsx
  api/
    client.js             — Axios instance + API functions
```

---

## 4. Domain Models

| Model | Mô tả |
|-------|-------|
| `Portfolio` | Danh mục đầu tư của user |
| `SubAccount` | Tiểu khoản (normal / margin) |
| `Transaction` | Giao dịch mua/bán |
| `Holding` | Vị thế đang nắm giữ |
| `AccountSnapshot` | Snapshot NAV theo ngày |
| `Watchlist` | Danh sách theo dõi user |
| `WatchlistItem` | Mã CK trong watchlist |
| `PriceAlert` | Cảnh báo giá của user |
| `TrackedSymbol` | Mã CK đang track realtime |
| `StockProfile` | Hồ sơ mã CK (tên, sàn, ngành) |
| `DailyPrice` | Giá lịch sử EOD |
| `MarketGroup` | Nhóm thị trường (VN30, HOSE, ...) |
| `MarketGroupMember` | Thành viên nhóm |
| `ScreenerRule` | Quy tắc lọc cổ phiếu JSON |
| `UserConfig` | Cấu hình user (ngưỡng whale, ...) |
| `WhaleConfigVersion` | Phiên bản config whale (immutable) |
| `WhaleConfigDraft` | Draft config chờ approve |
| `WhaleConfigApproval` | Bản ghi approve/reject maker-checker |
| `WhaleConfigAuditLog` | Lịch sử thay đổi config (who/when/why) |
| `OrderFlowSignal` | Tín hiệu dark flow (iceberg/absorption/twap) |

---

## 5. API Contract (v1.1)

### Portfolio
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST | `/api/portfolio/portfolios/` | Danh mục |
| GET/PUT | `/api/portfolio/portfolios/{id}/` | Chi tiết |
| GET | `/api/portfolio/portfolios/{id}/summary/` | NAV + P/L |
| GET | `/api/portfolio/portfolios/{id}/allocation/` | Phân bổ (`?by=sector\|symbol`) |
| GET | `/api/portfolio/portfolios/{id}/chart/` | Equity curve |
| GET | `/api/portfolio/portfolios/{id}/analytics/` | Sharpe, Sortino, MDD, TWR |
| CRUD | `/api/portfolio/transactions/` | Giao dịch |
| GET | `/api/portfolio/holdings/` | Vị thế |
| CRUD | `/api/portfolio/price-alerts/` | Cảnh báo giá |
| CRUD | `/api/portfolio/tracked-symbols/` | Tracked symbols |

### Stock Management
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/stock-management/market-groups/` | Nhóm thị trường |
| GET | `/api/stock-management/market-groups/{id}/members/` | Thành viên nhóm |
| GET | `/api/stock-management/stock-profiles/` | Hồ sơ CK |
| GET | `/api/stock-management/daily-prices/` | Giá lịch sử |
| CRUD | `/api/stock-management/watchlist/` | Watchlist |
| CRUD | `/api/stock-management/watchlist/{id}/items/` | Watchlist items |
| CRUD | `/api/stock-management/screener-rules/` | Screener rules |
| GET | `/api/stock-management/stocks/{symbol}/order-flow/` | Order flow CVD + dark flow (auth, `?window=5m\|15m\|30m\|1h`) |
| GET/POST | `/api/stock-management/stocks/{symbol}/ai-advisory-session/` | AI advisory session (auth, sync fallback khi không có Celery) |

### Realtime
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/realtime/ticker/{symbol}/` | Fallback HTTP ticker |
| GET | `/api/realtime/whale-feed/{symbol}/` | Whale orders history |
| WS | `/ws/realtime/?token={access_token}` | WebSocket gateway |

### Admin
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/admin-sync/sync-stockprofile/` | Sync StockProfile |
| GET | `/api/admin-ops/stats/` | System stats |
| GET | `/health/` | Health check |
| GET | `/health/realtime/` | Realtime / Redis health |

---

## 6. WebSocket Event Contract (v1.0)

**Channel naming**: `ticker:{SYMBOL}`, `whale:{SYMBOL}`, `user:{id}:alerts`

**Envelope**:
```json
{
  "contract_version": "1.0",
  "event_type": "ticker_update | whale_alert | heartbeat",
  "symbol": "SSI",
  "ts": "2026-04-01T09:30:05.123+07:00",
  "seq": 102934,
  "source": "collector-vnstock-vci",
  "data": {}
}
```

**`ticker_update`.data**: `price, volume, vwap, change_value, change_pct, session`  
**`whale_alert`.data**: `matched_value, threshold, side (buy|sell), volume, price, size_class (whale|shark)`  
**`heartbeat`.data**: `server_ts, uptime_seconds`

---

## 7. Feature Flags (settings.py)

| Flag | Default | Mô tả |
|------|---------|-------|
| `REALTIME_ENABLED` | `False` | Bật/tắt Celery realtime |
| `REALTIME_DEFAULT_WHALE_THRESHOLD` | `1_000_000_000` | Ngưỡng whale (1 tỷ VNĐ) |
| `REALTIME_REDIS_URL` | `redis://localhost:6379/0` | Redis URL |
| `REALTIME_CHANNEL_LAYER` | `inmemory` | `inmemory` cho dev / `redis` cho prod |

---

## 8. Lịch Sử Sprint

### Sprint 7 — Domain Alignment & API Contract ✅ DONE
- Chốt schema domain: Transaction, Holding, AccountSnapshot, Watchlist, StockProfile.
- Chuẩn hóa API route: `/api/portfolio/`, `/api/stock-management/`, `/api/admin-sync/`.
- Seed demo data.
- Smoke test tất cả route.

### Sprint 8 — Portfolio Engine v2 ✅ DONE
- Weighted average cost basis chuẩn.
- Margin sub-account: ratio, buying power.
- Snapshot NAV lúc 15:30.
- Unit test analytics core.

### Sprint 9 — Performance & Benchmark ✅ DONE
- TWR ngày/tuần/tháng.
- Benchmark so VN-Index.
- API report + equity curve chart.
- Export CSV.

### Sprint 10 — Realtime Event-Driven Foundation ✅ DONE
- Django Channels + ASGI stack.
- Redis Pub/Sub: `ticker:{symbol}`, `whale:{symbol}`, `user:{id}:alerts`.
- Celery collector → compute (VWAP/Whale) → publisher.
- WebSocket auth bằng JWT token qua query string.
- Fallback HTTP polling (`/api/realtime/ticker/{symbol}/`).

### Sprint 11 — Pro Watchlist & Realtime Pipeline ✅ DONE
- `portfolio/realtime/collector.py`, `compute.py`, `publisher.py`.
- Celery task `collect_and_publish_realtime`.
- Feature flags `REALTIME_ENABLED`, `REALTIME_DEFAULT_WHALE_THRESHOLD`.
- Frontend: Watchlist WS + Dashboard panel realtime slice.
- Heartbeat payload publish.
- Dev mode `REALTIME_CHANNEL_LAYER=inmemory`.
- 9 backend tests pass.

### Sprint 12 — User Management Core + Frontend Realtime UX + Resilience ✅ DONE  
*Chốt ngày 2026-04-02, 100% checklist pass*

**Backend**:
- Seed demo data mở rộng (holdings, snapshots, watchlist, tracked symbols).
- 12 backend tests pass (test_api_routes + test_realtime_compute + test_realtime_gateway).
- StockProfile sync: `sync_stockprofile --mode all` → 3249 profiles.
- SECRET_KEY 64 chars, JWT token 2h access / 7d refresh.
- Chuẩn hóa mốc `User Management Core`: `/api/auth/me/`, plan, CASL abilities, protected route flow quy chiếu về Sprint 12.
- Scope mo rong `Đăng ký người dùng` da duoc implement voi email required + auto-login (xem `docs/SPRINT12_USER_REGISTRATION_PLAN.md`).

**Frontend**:
- `useRealtimeFeed.js` là SINGLE SOURCE OF TRUTH cho toàn bộ WebSocket logic (243 lines).
- Watchlist.jsx + DashboardRealtimePanel.jsx dùng chung hook, 0 WebSocket logic trùng lặp.
- Watchlist: phân tách "Nhóm thị trường" vs "Danh sách theo dõi cá nhân".
- Thao tác 2 chiều trên Nhóm thị trường: thêm/xóa từng mã, thêm/xóa cả nhóm.
- `RealtimeDebugPanel.jsx`: observability panel với event counters, latency, channel layer badge.
- Dashboard panel: NAV realtime, P/L, market breadth (up/down/flat), whale alerts, stale count.
- `maxAlerts=5`, chống duplicate (key = symbol+ts+side), reconnect/backoff có giới hạn.
- Fallback polling khi socket disconnect.
- Build pass: `Compiled successfully! 251.69 kB`.

### Sprint 13 — Analytics Nâng Cao & Admin Dashboard ✅ DONE  
*Chốt ngày 2026-04-02, 100% checklist P0 pass*

**Portfolio Analytics**:
- `analytics.py`: `compute_max_drawdown`, `compute_sharpe`, `compute_sortino`, `compute_twr`, `compute_daily_returns`.
- API `GET /api/portfolio/portfolios/{id}/analytics/` → Sharpe, Sortino, MDD, TWR, Volatility, Best/Worst day.
- Allocation `?by=sector`: join với StockProfile, "Chưa phân loại" khi không có profile.
- 28 analytics tests pass.

**Stock Detail Workspace**:
- `/stocks/:symbol` nâng cấp: realtime quote từ `useRealtimeFeed`, company profile (tên/sàn/ngành/vốn hóa), session stats từ DailyPrice, active price alerts, whale alerts lọc theo symbol.

**Admin Operations Dashboard**:
- `/admin-ops`: chỉ `is_staff`, trả 403 nếu không.
- System health: `channel_layer_type`, `realtime_enabled`, `redis_ok`.
- User stats: tổng user, portfolio, tracked symbols, watchlist items.
- Last sync time từ `MarketGroupSyncLog`, `StockProfileSyncLog`.
- 13 tests pass (`test_admin_ops.py`).
- Tổng: 41 tests pass.
- `npm run build` pass: 0 errors.

**Hotfixes trong Sprint 13 (2026-04-02)**:
- `services.py`: `_fetch_exchange_lookup()` — chạy vnstock trong daemon thread 20s timeout, bắt `BaseException` (vnstock có thể gọi `sys.exit()` khi bị rate-limit VCI). Sau đó `build_stock_profile_payload()` merge `company_name` + `exchange` vào tất cả symbol → 3249 profiles đầy đủ.
- `AdminOps.jsx`: xử lý status 429 với UI riêng + retry button.
- `DashboardRealtimePanel.jsx`: sửa JSX `/div` bị thiếu.
- `Watchlist.jsx`: bọc fragment `<>...</>` để tránh adjacent JSX error.
- `DashboardRealtimePanel.jsx`: nâng cấp whale alerts panel — rich cards có border màu emerald/rose, emoji 🦈🐋, label "▲ MUA LỚN"/"▼ BÁN LỚN", `fmtBil()`, link tới `/whale-alerts/{symbol}`, animate alert mới nhất.

---

### Sprint 14 — Mission Control Foundation & Stock AI Advisory ✅ DONE
*Chốt ngày 2026-04-04*

**Backend**:
- `WhaleConfigVersion` + `WhaleConfigDraft` + `WhaleConfigApproval` + `WhaleConfigAuditLog`: immutable config versioning với maker-checker 2 vai trò (Analyst/Supervisor).
- `stock_ai_advisory_session_api`: `GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-session/` — sync fallback khi DEBUG=True + không có Celery worker.
- `_should_use_sync_fallback()` + `_queue_or_run()`: detect Celery worker availability, chạy task đồng bộ khi không có worker.
- AI advisor trả về `queued=false, advisory.ai_provider='copilot'` qua sync path — đã verify live với JWT Bearer + BCM symbol.
- 3 advisory session tests pass (`test_stock_advisory.py`).

**Hotfixes Sprint 14**:
- Rate-limit mitigation cho vnstock VCI API: daemon thread 20s timeout + `BaseException` guard.
- StockDetail.jsx: realtime quote + company profile + whale alerts lọc theo symbol.
- Sync fallback guard: chỉ bật khi `DEBUG=True` và host != `testserver`.

---

## 9. Sprint 15 — Order Flow & Dark Money Detection ✅ DONE
*Chốt ngày 2026-04-04*

**Backend**:
- `backend/portfolio/order_flow.py` (file mới): `compute_cvd_series`, `compute_tick_rate`, `compute_size_distribution`, `detect_absorption`, `detect_iceberg_clustering`, `detect_dark_flow`.
- `OrderFlowSignal` model + migration `0012_add_order_flow_signal`.
- Celery task `detect_and_store_order_flow` chạy mỗi 30s, env flag `ORDER_FLOW_DETECTION_ENABLED`, cooldown 300s/symbol.
- WebSocket event `dark_flow_alert` publish khi `strength > 50`, handler trong `consumers.py`.
- `build_symbol_ai_context()` mở rộng: key `order_flow` với `recent_signals`, `latest_signal_type`, `strength`, `confidence`.
- Endpoint `GET /api/stock-management/stocks/<symbol>/order-flow/` (authenticated, cache 15s).
- 38 unit tests (`test_order_flow.py`) PASS.

**Frontend**:
- `OrderFlowPanel` trong `StockDetail.jsx`: CVD AreaChart (recharts), strength meter, tick-rate, absorption badges, realtime dark_flow_alert block.
- `useRealtimeFeed` mở rộng: export `darkFlowAlerts`, `latestDarkFlowAlert`.
- `RealtimeDebugPanel.jsx`: Dark Flow counter + detail block.
- `DashboardRealtimePanel.jsx`: badge `🌊 N dark flow`.
- `getStockOrderFlow` trong `client.js`.

**QA**:
- `manage.py test portfolio.tests.test_order_flow` — 38/38 PASS
- `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_ai_context` — 7/7 PASS
- `npm run build` — Compiled successfully (293.13 kB gz)

---

## 10. Sprint 16 — Whale Volume Weighting & Order Flow Time Window ✅ DONE
*Chốt ngày 2026-04-04*

**Backend**:
- Aggregate whale feed (`_build_aggregate_event_payload`, `_build_aggregate_event_payload_from_record`, `_build_stream_aggregate_records`, `_build_vnstock_aggregate_records`): thêm field `volume: int` vào tất cả 4 builders, graceful fallback `or 0`.
- `stock_order_flow_api`: thêm `?window=5m|15m|30m|1h` query param, `_window_map`, fallback `30m`, trả `window` + `window_minutes` trong response.

**Frontend**:
- `WhaleAlertsHub.jsx`: tích lũy `totalVolume`, `getFrequencyLabel` dùng `totalValue` ngưỡng tỷ (5B/2B/500M), `TrackedSymbolCard` hiển thị "Avg giá: X VND/CP".
- `WhaleAdvisory.jsx`: tích lũy `totalVolume`, sort by `totalValue` desc, `SymbolCell` hiển thị "Avg giá: X VND/CP".
- `client.js`: `getStockOrderFlow(symbol, window = '30m')`.
- `StockDetail.jsx`: `orderFlowWindow` state + dependency, window selector UI 4 buttons (5m/15m/30m/1h).

**QA**:
- `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_order_flow` — **83/83 PASS** (49.2s)
- `npm run build` — Compiled successfully

---

## 11. Sprint 17 — AI Advisory Multi-Tab & Executive Summary ✅ DONE
*Chốt ngày 2026-04-04*

**Muc tieu da dat**: Nang cap AI Advisory Session thanh mo hinh da-thanh-phan voi tab component, co include/exclude, soft delete/restore, va Executive Summary co versioning va tong hop theo preference.

**Backend**:
- Migration + model cho component records va executive summary versions.
- API session/generate/toggle include/soft delete/restore/regenerate summary hoat dong end-to-end.
- Bo sung endpoint refresh theo component active (`ai-advisory-components/<id>/refresh/`).
- Nang cap regenerate summary nhan `synthesis_preference` (`short_term_action`, `risk_management`, `balanced`) de dieu huong prompt AI.
- Co fallback deterministic khi AI synthesis khong tra ket qua hop le.

**Frontend**:
- StockDetail AI Advisory panel da tab, co timestamp, include/exclude, xoa tab.
- Nut refresh AI theo tab active duoc dat canh nut xoa tab.
- Section "Thong tin tong hop" ho tro combobox preference + nut tong hop lai.
- Hien line "Che do hien tai" de user xac nhan mode tong hop dang ap dung.
- Chuan hoa nhan UI sang tieng Viet co dau cho advisory panel.

**Validation**:
- Targeted backend tests cho flow component refresh + summary regenerate PASS.
- Frontend `npm run build` PASS sau cac dot refactor UI/UX.

**Tai lieu cap nhat**:
- `docs/SPRINT17_DETAILED_PLAN.md`
- `docs/SPRINT17_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT_EXECUTION_LOG.md`
- `docs/TASKBOARD_SPRINT17.csv`

---

## 12. Hướng Dẫn Môi Trường Dev

### Khởi động backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py seed_user          # testuser / Test@123456
python manage.py seed_demo_data --reset
python manage.py seed_securities_groups --mode all
python manage.py sync_stockprofile --mode all
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Khởi động Celery worker
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A config worker -l info --pool=solo
```

### Khởi động frontend
```powershell
cd frontend
npm start
```

### Build production frontend
```powershell
cd frontend
npm run build
```

### Chạy tests
```powershell
cd backend
python manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway portfolio.tests.test_analytics_advanced portfolio.tests.test_admin_ops
```

### Realtime tick thủ công (1 chu kỳ)
```powershell
python manage.py realtime_tick --sync --user-id 3
```

---

## 11. Quy Tắc Phát Triển

1. **WebSocket logic chỉ ở một chỗ**: `frontend/src/hooks/useRealtimeFeed.js`. Page/component KHÔNG tự tạo WebSocket.
2. **API error boundary**: `AdminOps.jsx` xử lý 401, 403, 429, 5xx riêng biệt. Tương tự các trang quan trọng.
3. **vnstock calls**: luôn bọc trong `try/except BaseException` + thread timeout; vnstock có thể gọi `sys.exit()`.
4. **Feature flags**: mọi tính năng mới có thể bật/tắt qua `settings.py` trước khi commit.
5. **Test coverage**: mỗi endpoint mới có ít nhất 1 smoke test trong `test_api_routes.py`.
6. **StockProfile sync**: sau khi thêm nguồn dữ liệu mới, chạy `sync_stockprofile --mode all` để đồng bộ.
7. **Migrations**: không edit migration cũ. Thêm migration mới nếu thay đổi model.

---

## 13. Metrics Hiện Tại

| Metric | Giá trị |
|--------|---------|
| Backend tests pass | **83/83** |
| Frontend build | ✅ 0 errors (293 kB gz) |
| StockProfiles synced | 3249 |
| Web routes working | 100% |
| WebSocket duplication | 0 (single hook) |
| Sprint hoàn thành | 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 |
| Sprint tiếp theo | 29 (READY TO EXECUTE - AI Advisory + Kline Chart Context) |
