# HANDOFF MASTER — SaaS Full Independence: Loại bỏ Hoàn toàn Phụ thuộc Legacy

**Ngày**: 2026-05-04  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Phiên bản**: 1.0  
**Phạm vi**: Option B — core-api trở thành single entry point, legacy backend bị ẩn sau đó tắt hẳn

---

## 1. Bối cảnh và lý do tạo gói tài liệu này

Sau khi hoàn thành SaaS Migration Phases 0–5 (đã documented tại `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`), hệ thống vẫn có một vấn đề kiến trúc cơ bản:

- **nginx frontend container đang route thẳng đến `backend:8000` (legacy)** cho `/api/*` và `/ws/*`
- **core-api chỉ phục vụ `/core/v1/` endpoints** — ~20% tổng traffic
- **Legacy backend đang xử lý ~80 endpoints** mà core-api chưa implement
- Kết quả: không thể tắt legacy backend, hệ thống thực chất vẫn là hybrid

Gói tài liệu này định nghĩa **Option B** — lộ trình 8 phases để core-api trở thành **single entry point duy nhất**, sau đó legacy backend bị tắt hoàn toàn.

---

## 2. Kiến trúc mục tiêu

### Hiện tại (hybrid)
```
Browser → nginx:80
          ├── /api/*    → backend:8000 (legacy Django, port exposed)
          ├── /ws/*     → backend:8000 (legacy WebSocket)
          └── /core/v1/* → core-api:8100
```

### Sau khi hoàn thành Option B
```
Browser → nginx:80
          └── /api/*    → core-api:8100 (mọi traffic)
                          ├── Domain đã migrate: xử lý natively
                          └── Domain chưa migrate: proxy → backend:8000 (internal, không exposed)

          (backend:8000 ẩn hoàn toàn — không có port mapping ra ngoài)

Phase B8: backend container bị tắt, legacy code bị xóa.
```

---

## 3. Phân tích API surface phải migrate

### 3.1 Tổng thể
| Nhóm | Số endpoints | Phase xử lý |
|------|-------------|------------|
| Auth (register, email verify, password reset, OAuth) | 8 | B2 |
| Realtime (ticker, intraday, price-board, whale, RVOL, depth) | 10 | B3 |
| Market data (stock profile, overview, chart, technicals, financials) | 8 | B3 |
| Portfolio & Workspace (portfolios, subaccounts, transactions, holdings, watchlist) | 22 | B4 |
| AI Advisory (sessions, components, summary, observability) | 14 | B5 |
| Admin Ops (vnbroker-config, prefetch, signal admin, runtime-kpi) | 35 | B6 |
| WebSocket (/ws/*) | 1 namespace | B7 |
| **Tổng** | **~98** | B1–B7 |

### 3.2 Endpoints đã có trong core-api (không cần làm)
```
/core/v1/health
/core/v1/auth/login, /auth/profile, /auth/logout
/core/v1/market/symbol-snapshot/, /session-facts/
/core/v1/market-data/symbols/, /daily-prices/
/core/v1/signals/unified-alert, /whale-feed, /order-flow/
/core/v1/advisory/latest/, /refresh/, /history/
/core/v1/workspace/portfolios/, /watchlists/ (skeleton)
/core/v1/partner/* (PAT, billing, usage)
/core/v1/operator/* (tenants, jobs, audit)
```

---

## 4. Bộ tài liệu trong gói này

### 4.1 Triad bắt buộc
1. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md`
2. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md`
3. `docs/TASKBOARD_SAAS_FULL_INDEPENDENCE_20260504.md`

### 4.2 Tài liệu audit và thực thi
4. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md` ← file này
5. `docs/SAAS_FULL_INDEPENDENCE_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_FULL_INDEPENDENCE_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
8. `docs/SAAS_FULL_INDEPENDENCE_CONFIG_OWNERSHIP_MATRIX_20260504.md`
9. `docs/SAAS_FULL_INDEPENDENCE_CODE_QUALITY_CONSTITUTION_20260504.md`
10. `docs/RUN_CODE_REVIEW_SAAS_FULL_INDEPENDENCE_20260504.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_FULL_INDEPENDENCE_20260504.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_FULL_INDEPENDENCE_20260504.md`

### 4.3 Repo rulebook phải tuân thủ
- `AGENTS.md`
- `quality/QUALITY.md`
- `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` (kế thừa)

---

## 5. Quy tắc làm việc bắt buộc

### 5.1 Luồng làm việc chuẩn
1. **Đọc spec trước khi code**: tech spec → taskboard → implementation plan
2. **Mỗi slice = 1 commit** với message format: `feat(SFI-Bx.y): <mô tả>`
3. **Sau mỗi slice**: chạy focused validation → cập nhật taskboard → cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`
4. **Không đánh dấu Done** nếu chưa có execution evidence theo template
5. **Mandatory Docker Rebuild**: Sau mỗi lần sửa code, bắt buộc chạy lệnh build/update docker dev (ví dụ: `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`) để đảm bảo code mới được cập nhật; nếu không hệ thống sẽ vẫn chạy code cũ.

### 5.2 Phase gate — không được bỏ qua
- **B1 phải PASS** trước khi bắt đầu B2+
- **Parity gate ≥ 99%** bắt buộc trước B4 cutover (user data)
- **Shadow run ≥ 3 ngày trade** bắt buộc trước B4 cutover
- **7 decommission gates** phải PASS trước B8

### 5.3 Hard constraints kế thừa từ AGENTS.md
1. Không ghi vào legacy DB từ core containers (CoreRouter phải block)
2. Không có default passwords trong prod compose — dùng `${VAR:?error}`
3. PAT hash phải dùng HMAC với pepper — tuyệt đối không plain SHA-256
4. ALLOWED_HOSTS và CORS không được wildcard/DEBUG-gated trong production
5. Tất cả API calls từ packages/web phải qua `coreApiAdapter.js`
6. Text mới trong packages/web phải qua i18n tiếng Việt đầy đủ dấu
7. Immutable production builds — không source mount, không runtime pip install

---

## 6. Anchor files quan trọng

### Core SaaS backend
- `packages/core/backend/src/vninvest_core/urls.py` — entry point URL routing
- `packages/core/backend/src/vninvest_core/compat_portfolio.py` — compat layer hiện có
- `packages/core/backend/src/identity_access/compat_urls.py` — auth compat URLs
- `packages/core/backend/src/vninvest_core/legacy_proxy.py` — **NEW** (Phase B1)
- `packages/core/backend/requirements.txt`
- `packages/core/backend/src/vninvest_core/settings.py`

### Legacy backend (read-only reference)
- `backend/config/urls.py` — danh sách đầy đủ ~98 endpoints cần migrate
- `backend/config/settings.py`
- `backend/portfolio/views.py` — business logic cần port
- `backend/portfolio/urls_realtime.py` — realtime routes
- `backend/portfolio/urls_stock.py` — stock management routes

### Frontend & nginx
- `frontend/docker/nginx.conf` — **PHẢI SỬA** trong Phase B1
- `frontend/src/api/client.js` — API contract reference
- `docker-compose.dev.yml` — **PHẢI SỬA** nhiều lần qua các phases

---

## 7. Build và test commands chuẩn

### Rebuild sau thay đổi
```powershell
# Sau thay đổi core-api code
docker compose -f docker-compose.dev.yml restart core-api core-worker core-beat

# Sau thay đổi nginx.conf
docker compose -f docker-compose.dev.yml up -d --build frontend

# Full rebuild stack
docker compose -f docker-compose.dev.yml up -d --build
```

### Validation commands
```powershell
# Health check
curl http://localhost/core/v1/health
curl http://localhost/api/health/

# Auth test
curl -X POST http://localhost/api/auth/token/ -H "Content-Type: application/json" -d '{"username":"test","password":"test"}'

# Portfolio test (sau B4)
curl -H "Authorization: Bearer <token>" http://localhost/api/portfolio/portfolios/

# Proxy smoke test (Phase B1)
curl -v http://localhost/api/portfolio/portfolios/ 2>&1 | Select-String "< HTTP"
```

### Backend focused test suites
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

---

## 8. Risk register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Proxy latency tăng (B1) | Thấp | Thấp | Benchmark p95 trước/sau; rollback = 1 dòng nginx |
| User data loss trong B4 | Thấp | Rất cao | Shadow run 3 ngày, parity ≥ 99%, không cutover trước khi đạt |
| WebSocket reconnect storm (B7) | Trung bình | Trung bình | Exponential backoff ở client side (đã có trong frontend) |
| Celery task duplication khi chạy 2 workers | Trung bình | Trung bình | Dùng Redis task lock; phân biệt queue name: `core.*` vs `portfolio.*` |
| Auth session invalidation sau B2 | Cao | Cao | JWT migration script đồng bộ secret key; grace period 24h |

---

## 9. Contacts và ownership

| Domain | Owner | Notes |
|--------|-------|-------|
| Core-api infrastructure | Backend Lead | Phases B1, B2 |
| Market & Realtime | Backend Dev 1 | Phase B3 |
| Portfolio & Workspace | Backend Dev 2 | Phase B4 (user data — cẩn thận nhất) |
| AI Advisory | Backend Dev 1 | Phase B5 |
| Admin Ops | Backend Dev 2 | Phase B6 |
| WebSocket | Backend Lead | Phase B7 |
| nginx / Docker | DevOps | Phases B1, B7, B8 |
| Frontend API adapter | Frontend Dev | Kế thừa từ coreApiAdapter.js |

---

## 10. Thứ tự đọc tài liệu khi bắt đầu một phase mới

1. File này (handoff master) — đọc 1 lần duy nhất khi onboard
2. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md` — contracts và constraints
3. `docs/TASKBOARD_SAAS_FULL_INDEPENDENCE_20260504.md` — tìm slice cần làm
4. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md` — context cho slice đó
5. Sau khi code xong: `docs/SAAS_FULL_INDEPENDENCE_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
6. Sau khi evidence xong: cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`
