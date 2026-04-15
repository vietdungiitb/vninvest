# VNInvest — Pro Stock Tracker & Robo-Advisor

> **Trạng thái**: Sprint 17 ✅ COMPLETE — advisory multi-tab, preference-based synthesis, build success  
> **Stack**: React + Django 6.0.3 + Daphne ASGI + Django Channels + Celery + Redis + vnstock  
> **Tài liệu đầy đủ**: [docs/ROADMAP_STATUS.md](docs/ROADMAP_STATUS.md)

Portfolio Tracker cho chứng khoán Việt Nam (HOSE/HNX/UPCOM) với realtime WebSocket, analytics nâng cao (Sharpe/Sortino/Drawdown/TWR), whale alert detection, và admin operations dashboard.

---

## Quick Start Local

### 0. Bootstrap cau hinh mac dinh an toan (khuyen nghi)

```powershell
.\scripts\dev-setup.ps1
```

- Tu dong tao `backend/.env`, `backend/.env.dev`, `frontend/.env` neu chua co.
- Tu dong sinh `DJANGO_SECRET_KEY` an toan, giam thao tac cau hinh thu cong.
- Tai lieu chi tiet: `docs/SAFE_DEFAULT_SETUP_GUIDE_20260412.md`.

### 1. Backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_user              # testuser / Test@123456
python manage.py seed_demo_data --reset # holdings, snapshots, watchlist demo
python manage.py sync_stockprofile --mode all  # 3249 stock profiles
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 2. Celery Worker (realtime ticker)
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A config worker -l info --pool=solo
```

### 3. Frontend
```powershell
cd frontend
npm install
npm start   # http://localhost:3000
```

### Docker services (local)
- PostgreSQL: `my-postgres` → `localhost:5432`
- Redis: `redis-server` → `localhost:6379`
- Cấu hình tại `backend/.env` (xem `backend/.env.example`)

### Operational Runbook

Để ticker API chạy theo fast path `source=prefetch` thay vì fallback DB, cần đủ 4 thành phần:

```powershell
cd backend
.\start_stack.ps1
```

Hoặc chạy thủ công từng tiến trình như dưới đây:

```powershell
# Terminal 1 - Backend
cd backend
.\.venv\Scripts\Activate.ps1
python -m daphne --bind 127.0.0.1 --port 8000 --threads 20 config.asgi:application

# Terminal 2 - Celery worker
cd backend
.\.venv\Scripts\Activate.ps1
python -m celery -A config worker -l info -P solo

# Terminal 3 - Celery beat
cd backend
.\.venv\Scripts\Activate.ps1
python -m celery -A config beat -l info
```

Xác minh nhanh:
- Redis db=2 có key `vninvest:1:ticker:*`
- `/api/realtime/ticker/<symbol>/` trả `source=prefetch`
- `/api/health/prefetch/` trả `healthy=true`
- Benchmark kỳ vọng: ticker p95 khoảng 50-60ms
- Admin Ops có badge `Prefetch health` và nút `Warm Ticker Cache`

---

## Tính Năng Chính

| Module | Mô tả |
|--------|-------|
| **Portfolio** | NAV realtime, P/L chưa chốt, equity curve, cost basis |
| **Analytics** | Sharpe, Sortino, Max Drawdown, TWR, Volatility, sector allocation |
| **Watchlist** | Nhóm thị trường + danh sách theo dõi cá nhân + price alerts |
| **Realtime Radar** | WebSocket ticker updates, market breadth, whale alerts |
| **Whale Alerts** | Phát hiện lệnh lớn theo ngưỡng VNĐ, 🦈 shark / 🐋 whale |
| **Stock Detail** | Realtime quote + candlestick chart + company profile + signal summary |
| **Admin Ops** | System health, user stats, last sync time, Redis status |

---

## Kiến Trúc Realtime

```
vnstock API → Celery worker (5s) → collector → compute (VWAP/whale) → Redis pub/sub
  → Django Channels → WebSocket → useRealtimeFeed.js (frontend hook duy nhất)
    → Dashboard, Watchlist, StockDetail
```

**Feature flags** (`backend/config/settings.py`):
- `REALTIME_ENABLED` — bật/tắt Celery realtime  
- `REALTIME_DEFAULT_WHALE_THRESHOLD` — ngưỡng whale (mặc định 1 tỷ VNĐ)
- `REALTIME_CHANNEL_LAYER` — `inmemory` (dev) / `redis` (prod)

---

## API Endpoints (tóm tắt)

| Base | Mô tả |
|------|-------|
| `/api/portfolio/` | Portfolio CRUD, holdings, analytics |
| `/api/stock-management/` | Mã CK, nhóm, watchlist, price alerts |
| `/api/admin-sync/` | Sync StockProfile, market groups |
| `/api/realtime/` | Fallback ticker HTTP, whale-feed |
| `/api/admin-ops/` | System stats (is_staff only) |
| `/api/health/prefetch/` | Prefetch cache health, freshness và sample cache hits |
| `/api/admin-ops/prefetch/warm/` | Staff trigger warm cache ticker thủ công từ Admin Ops |
| `/ws/realtime/` | WebSocket gateway (JWT auth) |
| `/health/` | Health check |
| `/health/realtime/` | Redis + Channels health |

---

## Chạy Tests
```powershell
cd backend
python manage.py test portfolio.tests.test_api_routes portfolio.tests.test_realtime_compute portfolio.tests.test_realtime_gateway portfolio.tests.test_analytics_advanced portfolio.tests.test_admin_ops
# → 41/41 PASS
```

## Build Frontend
```powershell
cd frontend
npm run build   # → build/ ready, 0 errors
```

## Quy Dinh Bat Buoc: Anti-Fat-File

Quy dinh nay la bat buoc cho toan bo backend/frontend de tranh tai dien monolith va refactor lon ve sau.

- Muc canh bao: file >= 700 dong.
- Muc chan merge: file >= 1000 dong (neu khong nam trong allowlist da duoc phe duyet).
- Khong them logic moi vao file da vuot nguong, bat buoc tach module truoc.
- File vuot nguong tam thoi chi duoc phep khi co ghi chu ro ly do trong `scripts/quality/large_file_allowlist.txt`.

Kiem tra local truoc khi push:

```powershell
./scripts/quality/check_large_files.ps1 -WarnLines 700 -FailLines 1000 -AllowListPath scripts/quality/large_file_allowlist.txt
```

CI dang enforce quy dinh nay tai workflow `large-file-guard`.

## Quy Dinh Bat Buoc: Audit Danh Sach Tep Da Sua

- Sau moi cong viec hoan tat, ngoai nhat ky tien do, bat buoc cap nhat danh sach tep da sua vao tai lieu audit tap trung.
- Danh sach nay duoc dung de truy vet pham vi thay doi nhanh khi review, incident response, va compliance audit.
- Neu thieu file list, cong viec duoc xem la chua dong vong ban giao.

Tai lieu audit tap trung hien tai: `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

---

## Tài Liệu Kỹ Thuật

| Tài liệu | Nội dung |
|----------|----------|
| [docs/ROADMAP_STATUS.md](docs/ROADMAP_STATUS.md) | Trạng thái toàn dự án, kiến trúc, API contract, quy tắc phát triển |
| [docs/SPRINT_EXECUTION_LOG.md](docs/SPRINT_EXECUTION_LOG.md) | Lịch sử công việc chi tiết theo sprint |
| [docs/MODULE_TREE_WORKFLOW.md](docs/MODULE_TREE_WORKFLOW.md) | Quy trình tự động cập nhật cây module/class/function/variable |
| [docs/WEBSOCKET_EVENT_CONTRACT.md](docs/WEBSOCKET_EVENT_CONTRACT.md) | WS message envelope + event types |
| [docs/VNSTOCK_THROUGHPUT_RUNTIME_GUIDE.md](docs/VNSTOCK_THROUGHPUT_RUNTIME_GUIDE.md) | Hướng dẫn kỹ thuật cho runtime throughput mới của vnstock, Celery prefetch, Redis cache và benchmark |
| [docs/WHALE_ALERTS_DASHBOARD_ROADMAP.md](docs/WHALE_ALERTS_DASHBOARD_ROADMAP.md) | Tài liệu tổng hợp duy nhất cho hiện trạng, hardening, roadmap và admin của Whale Alerts |
| [docs/SPRINT13_DETAILED_PLAN.md](docs/SPRINT13_DETAILED_PLAN.md) | Kế hoạch Sprint 13 (analytics + admin ops) |
| [docs/FEATURE_EXPANSION_BACKLOG.md](docs/FEATURE_EXPANSION_BACKLOG.md) | Backlog tính năng P1/P2/P3 |

