# IMPLEMENTATION PLAN — SaaS Full Independence: Loại bỏ Hoàn toàn Phụ thuộc Legacy

**Ngày tạo**: 2026-05-04  
**Scope**: Option B — 8 phases, core-api thành single entry point  
**Level**: A (routing overhaul, domain expansion, data migration)  
**Status**: APPROVED — READY FOR EXECUTION

---

## 1. Business objective

### Vấn đề cần giải quyết

Sau khi hoàn thành SaaS Migration Phases 0–5, hệ thống VNInvest vẫn ở trạng thái hybrid:

1. **nginx route thẳng `/api/*` đến `backend:8000`** — core-api chỉ phục vụ `/core/v1/` (~20% traffic)
2. **Legacy backend không thể tắt** vì ~80 endpoints chưa được implement trong core
3. **Port 8000 exposed ra host** — tạo surface attack không cần thiết
4. **2 Celery worker stacks chạy song song** — lãng phí tài nguyên, có nguy cơ task duplication
5. **Frontend depends on backend service** — không thể deploy core-api độc lập

### Mục tiêu nghiệp vụ

1. Tắt hoàn toàn legacy backend (`backend/`, `celery_worker`, `celery_beat`)
2. Core-api phục vụ 100% traffic với đầy đủ tính năng
3. Một Celery stack duy nhất (`core-worker`, `core-beat`)
4. Codebase gọn lại: ~80k lines (từ ~150k với legacy)

### KPI đầu ra

| Chỉ số | Baseline (sau Phase 5) | Target (sau B8) |
|--------|----------------------|----------------|
| Legacy containers chạy | 3 (backend + 2 celery) | 0 |
| Port exposed ra host | 8000 (legacy) + 8100 (core) | chỉ 80 (nginx) |
| API entry points | 2 (nginx→backend, nginx→core) | 1 (nginx→core only) |
| Celery worker memory | ~1.7GB (2 stacks) | ~400MB (1 stack) |
| Endpoints chưa migrate | ~98 | 0 |

---

## 2. Scope

### In-scope
1. Thêm transparent HTTP proxy trong core-api (B1)
2. Sửa nginx routing: `/api/*` → core-api (B1)
3. Implement tất cả ~98 endpoints còn thiếu trong core (B2–B6)
4. Migrate WebSocket sang Django Channels trong core (B7)
5. Tắt legacy containers (B8)

### Out-of-scope
1. Không thay đổi URL contracts (frontend client giữ nguyên)
2. Không thay đổi chart engine hoặc whale session semantics
3. Không thay đổi Prometheus/Grafana/Sentry setup (đã xong ở Phase 5)
4. Không migrate sang PostgreSQL 16 trong phase này (để sau)

---

## 3. Dependency map giữa các phases

```
B1 (Proxy Gateway)
    │
    ├── B2 (Auth Native)          ← không cần B3, B4, B5
    │
    ├── B3 (Market+Realtime)      ← không cần B4, B5
    │
    ├── B4 (Portfolio)            ← cần B3 (technicals) 
    │       └── shadow run 3 ngày ← blocking gate
    │
    ├── B5 (AI Advisory)          ← cần B4 (portfolio session context)
    │
    ├── B6 (Admin Ops)            ← không cần B2-B5
    │
    └── B7 (WebSocket)            ← cần B3 (realtime data)
            │
            └── B8 (Decommission) ← cần TẤT CẢ B1-B7 + 7 gates
```

**B2, B3, B6 có thể chạy song song sau khi B1 xong.**

---

## 4. Chi tiết từng phase

---

### Phase B1 — Proxy Gateway (2 ngày)

**Mục tiêu**: Phá vỡ dependency nginx→backend. Frontend chỉ biết core-api.

**Kết quả bắt buộc**:
- nginx `location /api/` proxy đến `core-api:8100`
- core-api forward toàn bộ `/api/*` (không có trong exclusion list) đến `backend:8000` (internal)
- Port `8000` không expose ra host
- `frontend.depends_on.backend` bị xóa
- Mọi existing `/api/*` endpoints vẫn hoạt động qua proxy (zero regression)

**Files thay đổi**:
1. `packages/core/backend/requirements.txt` — thêm `httpx>=0.27,<1.0`
2. `packages/core/backend/src/vninvest_core/legacy_proxy.py` — **NEW**
3. `packages/core/backend/src/vninvest_core/urls.py` — thêm wildcard proxy route cuối
4. `packages/core/backend/src/vninvest_core/settings.py` — thêm `LEGACY_BACKEND_URL`
5. `frontend/docker/nginx.conf` — sửa `location /api/`
6. `docker-compose.dev.yml` — thêm env, xóa port 8000, xóa depends_on backend
7. `docker-compose.prod.yml` — xóa port 8000 cho backend

**Validation**:
```powershell
# 1. Rebuild
docker compose -f docker-compose.dev.yml up -d --build frontend core-api

# 2. Smoke test
curl http://localhost/api/health/                          # → 200
curl http://localhost/api/portfolio/portfolios/            # → 401 (not 502)
curl http://localhost/api/realtime/ticker/VIC/             # → 200 with data
curl http://localhost/core/v1/health                       # → 200

# 3. Verify không còn port 8000
docker ps --format "table {{.Names}}\t{{.Ports}}" | Select-String "8000"
# → không có kết quả
```

**Risk**: Thấp. Rollback: thay 1 dòng nginx `proxy_pass` về `backend:8000`.

---

### Phase B2 — Auth Native (1 ngày)

**Mục tiêu**: Core tự handle register, email verify, password reset, Google OAuth.

**Prerequisite**: B1 PASS

**Kết quả bắt buộc**:
- Đăng ký user mới qua `/api/auth/register/` → nhận email verify từ mailpit (dev)
- Verify email qua `/api/auth/verify-email/` → account active
- Password reset flow đầy đủ
- Proxy rule cho `/api/auth/register/` và các auth endpoints mới bị xóa khỏi proxy fallback
- Users legacy đã được migrate hoặc có fallback mechanism

**Files thay đổi**:
1. `packages/core/backend/src/identity_access/views_auth.py` — thêm 5 views
2. `packages/core/backend/src/identity_access/compat_urls.py` — thêm 6 routes
3. `packages/core/backend/src/vninvest_core/settings.py` — email backend config
4. `packages/core/backend/src/vninvest_core/legacy_proxy.py` — thêm auth paths vào exclusion list
5. `scripts/migrate_users_to_core.py` — **NEW** migration script
6. `packages/core/backend/src/identity_access/migrations/` — new migration nếu cần

**Validation**:
```powershell
# Register
curl -X POST http://localhost/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456","username":"test"}'
# → 201 Created

# Check mailpit
curl http://localhost:8025/api/v1/messages
# → có email verify

# Login sau verify
curl -X POST http://localhost/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456"}'
# → 200 với access + refresh tokens
```

---

### Phase B3 — Market & Realtime Native (4–5 ngày)

**Mục tiêu**: Core serve toàn bộ market data và realtime feed.

**Prerequisite**: B1 PASS

**Kết quả bắt buộc**:
- Tất cả 10 realtime endpoints và 9 stock management endpoints trả đúng data
- Proxy rules cho `/api/realtime/*` và `/api/stock-management/*` bị xóa
- Response data parity ≥ 99% so với legacy (random sample 20 symbols, 3 ngày)
- Latency không tăng so với baseline legacy (p95 < 200ms)

**Files thay đổi**:
1. `packages/core/backend/src/signal_intelligence/views.py` — thêm realtime views
2. `packages/core/backend/src/signal_intelligence/urls.py` — thêm routes
3. `packages/core/backend/src/market_data/views.py` — thêm stock management views
4. `packages/core/backend/src/market_data/urls.py` — thêm routes
5. `packages/core/backend/src/vninvest_core/legacy_proxy.py` — cập nhật exclusion list
6. `packages/core/backend/src/vninvest_core/settings.py` — thêm DATABASES.legacy_readonly nếu chưa có

**Sub-tasks**:
- B3.1: `/api/realtime/ticker/` và `/api/realtime/tickers/` (1 ngày)
- B3.2: `/api/realtime/whale-feed/`, `/whale-campaigns/`, `/unified-alerts/` (1 ngày)
- B3.3: `/api/realtime/intraday/`, `/price-board/`, `/breadth/`, `/rvol/`, `/depth-chart/` (1.5 ngày)
- B3.4: `/api/stock-management/stocks/<symbol>/*` — profile, overview, chart, order-flow (1 ngày)
- B3.5: `/api/stock-management/technicals/`, `/groups/`, `/tracked-symbols/*` (0.5 ngày)

---

### Phase B4 — Portfolio & Workspace Native (5–7 ngày)

**Mục tiêu**: Core serve toàn bộ portfolio, subaccounts, transactions, watchlist với user data thật.

**Prerequisite**: B1 PASS, B3 PASS (technicals), shadow run ≥ 3 ngày trade

**Kết quả bắt buộc**:
- Tất cả 22 portfolio/workspace endpoints trả đúng data
- Portfolio P&L calculations khớp ±0.01% với legacy
- Shadow parity report: `parity_score >= 0.99`
- Migration script đã chạy thành công và có evidence
- Proxy rules cho `/api/portfolio/*` bị xóa sau cutover

**Sub-tasks**:
- B4.1: Models `SubAccount`, `Transaction` — migrate schema (1 ngày)
- B4.2: Shadow write — dual-write to both DBs (0.5 ngày)
- B4.3: Data migration script — copy existing data (1 ngày)
- B4.4: Portfolio CRUD views (1.5 ngày)
- B4.5: Holdings, summary, chart, equity-curve, allocation, analytics (2 ngày)
- B4.6: Parity verification — shadow run 3 ngày + report (3 ngày — blocking)
- B4.7: Cutover — switch read to core, remove proxy rules (0.5 ngày)

**CRITICAL**: Không được cutover trước khi parity ≥ 99%. Nếu không đạt, tìm bug và chờ thêm 1 ngày.

---

### Phase B5 — AI Advisory Native (3–5 ngày)

**Mục tiêu**: `advisory` app xử lý toàn bộ AI sessions, components, summary.

**Prerequisite**: B4 PASS (portfolio context)

**Sub-tasks**:
- B5.1: Models `AdvisorySession`, `AdvisoryComponent`, `AdvisoryObservability` (1 ngày)
- B5.2: Advisory session endpoints — GET, POST, DELETE (1 ngày)
- B5.3: Components CRUD — toggle-include, refresh, restore, delete (1 ngày)
- B5.4: Summary regenerate, ai-options, ai-config, system-ai-settings (1 ngày)
- B5.5: Migrate existing sessions (optional — có thể fresh start) (0.5 ngày)

---

### Phase B6 — Admin Ops Native (3–4 ngày)

**Mục tiêu**: Tất cả admin ops endpoints chạy trong core.

**Prerequisite**: B1 PASS (có thể chạy song song B2, B3)

**Sub-tasks**:
- B6.1: Stats, runtime-kpi, system-ai-settings endpoints trong `ops_audit` (1 ngày)
- B6.2: vnbroker-config CRUD + changelog (1 ngày)
- B6.3: Signal admin — universe, governance, retention, jobs (1.5 ngày)
- B6.4: Celery tasks cho prefetch, market-groups sync, intraday-universe (1 ngày)

---

### Phase B7 — WebSocket Migration (2–3 ngày)

**Mục tiêu**: `/ws/*` qua Django Channels trong core.

**Prerequisite**: B3 PASS (realtime data sources)

**Sub-tasks**:
- B7.1: Setup Django Channels + daphne (0.5 ngày)
- B7.2: ASGI config (0.5 ngày)
- B7.3: Port consumers (ticker, whale, portfolio) (1.5 ngày)
- B7.4: Sửa nginx WebSocket routing → core-api (0.5 ngày)

---

### Phase B8 — Legacy Decommission (1 ngày)

**Mục tiêu**: Tắt và xóa legacy containers.

**Prerequisite**: TẤT CẢ B1–B7 PASS + 7 gates A–G PASS

**Steps**: Theo `docs/SM-P6-DECOMMISSION-RUNBOOK.md` (đã có), điều chỉnh cho scope mới.

---

## 5. Timeline và resource

| Phase | Thời gian ước tính | Có thể song song với |
|-------|-------------------|---------------------|
| B1 Proxy Gateway | 2 ngày | — (blocking) |
| B2 Auth Native | 1 ngày | B3, B6 |
| B3 Market+Realtime | 4–5 ngày | B2, B6 |
| B4 Portfolio | 5–7 ngày + 3 ngày shadow | — (sau B3) |
| B5 AI Advisory | 3–5 ngày | — (sau B4) |
| B6 Admin Ops | 3–4 ngày | B2, B3 |
| B7 WebSocket | 2–3 ngày | — (sau B3) |
| B8 Decommission | 1 ngày | — (sau tất cả) |
| **Tổng** | **~3–4 tuần** | |

**Nếu có 2 dev chạy song song**: B2+B6 song song sau B1, tiết kiệm ~5 ngày.

---

## 6. Rollback plan

| Phase | Rollback action | Thời gian |
|-------|----------------|----------|
| B1 | Đổi nginx `proxy_pass` về `backend:8000`, thêm lại port mapping | < 5 phút |
| B2 | Xóa auth routes khỏi compat_urls, proxy fallback tự xử lý | < 5 phút |
| B3 | Comment out route trong urls.py → proxy fallback tự xử lý | < 5 phút |
| B4 | Switch read về legacy DB, dual-write vẫn active | < 10 phút |
| B5 | Comment out advisory routes → proxy fallback | < 5 phút |
| B6 | Comment out admin-ops routes → proxy fallback | < 5 phút |
| B7 | Đổi nginx /ws/ về backend:8000 | < 5 phút |
| B8 | Restart legacy containers (nếu chưa xóa image) | < 10 phút |

**Nguyên tắc rollback**: Proxy gateway (B1) đảm bảo mọi phase đều có rollback an toàn — chỉ cần xóa route native, proxy fallback tự đảm nhận.

---

## 7. Definition of Done cho toàn bộ Option B

- [ ] Zero endpoints qua proxy (proxy code vẫn tồn tại nhưng exclusion list = tất cả)
- [ ] Legacy containers (`backend`, `celery_worker`, `celery_beat`) không còn trong compose files
- [ ] Port 8000 không expose trên bất kỳ host nào
- [ ] `module_tree_full.md` đã regenerate
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã update với tất cả files changed
- [ ] `PROGRESS_DASHBOARD.md` section SaaS Full Independence = ✅ COMPLETE
- [ ] Frontend build pass: `npm run build` exit 0
- [ ] Backend tests pass: tất cả focused suites exit 0
- [ ] k6 load test: p95 < 200ms at 500 VUs
- [ ] Sentry: 0 critical errors trong 24h sau decommission
