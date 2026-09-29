# TRACEABILITY MATRIX — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Scope**: C1–C7 — Loại bỏ bridge, decommission legacy

---

## 1. Requirements

| ID | Requirement | Priority | Slice |
|----|-------------|----------|-------|
| CUT-REQ-01 | Ingest price board chạy trong core-beat (không phụ thuộc legacy-worker) | P0 | C1 |
| CUT-REQ-02 | 9 realtime endpoints native trong core — không forward về backend:8000 | P0 | C2 |
| CUT-REQ-03 | 11 stock-management endpoints native trong core | P0 | C3 |
| CUT-REQ-04 | Portfolio holdings trả real data (không empty stub) | P0 | C4 |
| CUT-REQ-05 | Portfolio equity-curve trả time-series data thực tế | P1 | C4 |
| CUT-REQ-06 | Portfolio summary (total_value, total_pnl) computed từ real transactions | P1 | C4 |
| CUT-REQ-07 | `POST /api/auth/verify/` hoạt động native (không 502) | P1 | C5 |
| CUT-REQ-08 | SubAccount trả `[]` HTTP 200 (không 502) | P0 | C6 |
| CUT-REQ-09 | Telegram status trả `{"status": "not_available"}` HTTP 200 | P0 | C6 |
| CUT-REQ-10 | `legacy_http_bridge.py` bị xóa hoàn toàn sau C7 | P0 | C7 |
| CUT-REQ-11 | `grep legacy_bridge_response packages/core/backend/src/` → 0 results | P0 | C7 |
| CUT-REQ-12 | Legacy containers (`backend`, `backend-worker`) stopped sau C7 | P0 | C7 |
| CUT-REQ-13 | `docker ps` → 0 containers tên `backend*` sau C7 | P0 | C7 |
| CUT-REQ-14 | SymbolSnapshot.fetched_at fresh < 90s (core-beat đang chạy ingest) | P0 | C1 |
| CUT-REQ-15 | Không còn 502 trên bất kỳ `/api/*` route sau C7 | P0 | C7 |
| CUT-REQ-16 | CoreRouter không bị sửa — không write vào legacy_readonly | P0 | ALL |
| CUT-REQ-17 | LEGACY_BACKEND_URL là env var — không hardcode trong source | P1 | ALL |
| CUT-REQ-18 | Port 8000 không expose trong compose files | P0 | ALL (B1 done) |
| CUT-REQ-19 | Watchlist update trigger ingest cho symbols mới | P2 | C6 |
| CUT-REQ-20 | Evidence files ghi nhận đầy đủ cho mỗi slice | P1 | ALL |

---

## 2. Requirement → Slice mapping

| Req ID | Slice | Verification method |
|--------|-------|-------------------|
| CUT-REQ-01 | C1.1 | `'ingest-price-board-60s' in settings.CELERY_BEAT_SCHEDULE` → True |
| CUT-REQ-02 | C2.1–C2.10 | Curl 9 routes khi backend stopped → tất cả 200 |
| CUT-REQ-03 | C3.1–C3.12 | Curl 11 routes khi backend stopped → tất cả 200 |
| CUT-REQ-04 | C4.1, C4.6 | `GET /api/portfolio/holdings/` → non-empty array |
| CUT-REQ-05 | C4.3, C4.6 | `GET /api/portfolio/equity-curve/` → `{dates: [...], values: [...]}` non-empty |
| CUT-REQ-06 | C4.2, C4.6 | `GET /api/portfolio/summary/` → `{total_value: N, total_pnl: N}` |
| CUT-REQ-07 | C5.2, C5.3 | `POST /api/auth/verify/` token valid → 200; invalid → 400 |
| CUT-REQ-08 | C6.1, C6.2 | `GET /api/account/sub-accounts/` → `[]` |
| CUT-REQ-09 | C6.3, C6.4 | `GET /api/telegram/status/` → `{"status": "not_available"}` |
| CUT-REQ-10 | C7.3 | `Test-Path packages/core/backend/src/vninvest_core/legacy_http_bridge.py` → False |
| CUT-REQ-11 | C7.3 | `grep -rn "legacy_bridge_response" packages/core/backend/src/` → 0 matches |
| CUT-REQ-12 | C7.1, C7.4 | compose files updated + containers stopped |
| CUT-REQ-13 | C7.7 | `docker ps` output không chứa "backend" hay "backend-worker" |
| CUT-REQ-14 | C1.3 | Django shell: `(now()-SymbolSnapshot.objects.order_by('-fetched_at').first().fetched_at).seconds < 90` |
| CUT-REQ-15 | C7.7 | Smoke test final — 0 requests trả 502/503 |
| CUT-REQ-16 | (existing) | `CoreRouter.db_for_write()` raises OperationalError for legacy_readonly |
| CUT-REQ-17 | (existing) | Code review: `grep -rn "backend:8000" packages/core/backend/src/` → 0 |
| CUT-REQ-18 | (B1 done) | `grep "8000:" docker-compose.dev.yml` → không có published port |
| CUT-REQ-19 | C6.5 | Watchlist create triggers `sync_market_groups` task |
| CUT-REQ-20 | ALL | `dir docs/evidence/CUT-C*` → ≥7 files |

---

## 3. Slice → Files mapping

| Slice | Files thay đổi | Ghi chú |
|-------|---------------|---------|
| **C1.1** | `packages/core/backend/src/vninvest_core/settings.py` | Thêm beat schedule entry |
| **C2.1–C2.9** | `packages/core/backend/src/market_serving/views.py` (hoặc `native_views.py`) | 9 native views mới |
| **C2.10** | `packages/core/backend/src/market_serving/api_urls.py` | Re-wire 9 routes |
| **C3.1–C3.11** | `packages/core/backend/src/market_data/views.py` | 11 native views mới |
| **C3.12** | `packages/core/backend/src/market_data/public_urls.py` | Re-wire 11 routes |
| **C4.1–C4.5** | `packages/core/backend/src/user_workspace/views.py` | Native analytics views |
| **C4.6** | `packages/core/backend/src/user_workspace/urls.py` | Re-wire portfolio routes |
| **C5.1** | `packages/core/backend/src/identity_access/models.py` | `EmailVerificationToken` (nếu chưa có) |
| **C5.1m** | `packages/core/backend/src/identity_access/migrations/` | Migration file |
| **C5.2** | `packages/core/backend/src/identity_access/views_auth.py` | `VerifyEmailView` |
| **C5.3** | `packages/core/backend/src/identity_access/compat_urls.py` | Wire verify endpoint |
| **C6.1** | `packages/core/backend/src/user_workspace/views.py` | `SubAccountListView` |
| **C6.2** | `packages/core/backend/src/user_workspace/urls.py` | Wire sub-accounts |
| **C6.3** | `packages/core/backend/src/market_serving/views.py` | `TelegramStatusView` |
| **C6.4** | `packages/core/backend/src/vninvest_core/urls.py` | Wire telegram status |
| **C6.5** | Watchlist create view file | Trigger sync task |
| **C7.3** | `packages/core/backend/src/vninvest_core/legacy_http_bridge.py` | **DELETE** |
| **C7.3b** | `packages/core/backend/src/market_serving/legacy_views.py` | Remove `RealtimeLegacyBridgeView` + import |
| **C7.3c** | `packages/core/backend/src/user_workspace/legacy_views.py` | Remove bridge view + import |
| **C7.4** | `docker-compose.dev.yml` | Remove/comment backend services |
| **C7.5** | `docker-compose.prod.yml` | Remove/comment backend services |

---

## 4. Test coverage matrix

| Domain | Unit tests | Integration tests | E2E / Smoke |
|--------|-----------|-------------------|-------------|
| Ingest (C1) | Check beat schedule in settings | Django shell: SymbolSnapshot fresh | docker logs core-beat |
| Realtime views (C2) | `test_realtime_views.py` (new) | curl 9 routes when backend stopped | — |
| Stock mgmt views (C3) | `test_stock_mgmt_views.py` (new) | curl 11 routes when backend stopped | — |
| Portfolio analytics (C4) | `test_portfolio_analytics.py` (new) | Holdings / equity-curve with seed data | — |
| Auth verify (C5) | `test_auth_verify.py` (new) | POST /api/auth/verify/ round-trip | — |
| Misc stubs (C6) | Inline | curl sub-accounts + telegram | — |
| Decommission (C7) | Gate A–G scripts | Full smoke test suite | `docker ps` post-decommission |

---

## 5. Non-regression matrix

Sau C7, tất cả các tính năng sau phải vẫn hoạt động (không bị broke):

| Feature | Endpoint | Kiểm tra |
|---------|---------|---------|
| Whale alerts dashboard | `/api/realtime/unified-alerts/` | 200 |
| Whale feed aggregate | `/api/realtime/whale-feed-aggregate/` | 200 |
| AI advisory | `/core/v1/advisory/latest/<symbol>/` | 200 |
| WebSocket ticker | `ws://localhost/ws/market/VCB/` | Kết nối OK |
| Admin panel | `/admin/` | 200 (core-api admin) |
| Signal universe | `/api/admin-ops/signal-universe/` | 200 |
| Auth PAT | `POST /api/auth/token/` | 200 |

---

*Tài liệu này là cross-reference — dùng để audit: mỗi REQ phải có slice, slice phải có file, file phải có test.*
