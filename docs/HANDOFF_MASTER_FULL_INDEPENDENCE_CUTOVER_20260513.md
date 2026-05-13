# HANDOFF MASTER — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Scope**: Cutover hoàn toàn khỏi legacy backend — C1 đến C7  
**Status**: READY TO EXECUTE  
**Assigned to**: Dev Team  
**Tech Lead**: Review & sign-off C7 decommission gate  

---

## 0. Tóm tắt tình trạng hiện tại

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| nginx routing `/api/*` → core-api | ✅ DONE (B1) | Port 8000 không exposed |
| WebSocket `/ws/market/{symbol}/` | ✅ DONE (B7) | MarketTickerConsumer native |
| Auth native | ✅ DONE (B2) | PAT-only, JWT removed |
| Admin ops native | ✅ DONE (B6) | IsCoreOperator guarded |
| AI advisory native | ✅ DONE (B5) | OpenAI via env var |
| Ingest core-beat schedule | ❌ MISSING | C1: thêm vào CELERY_BEAT_SCHEDULE |
| Realtime 9 routes | ❌ BRIDGE | C2: native views thay bridge |
| Stock-mgmt 11 routes | ❌ BRIDGE | C3: native views thay bridge |
| Portfolio analytics 5 routes | ❌ STUB (empty) | C4: real computation |
| Auth email verify | ❌ MISSING | C5: VerifyEmailView native |
| Misc (telegram, watchlist) | ❌ PARTIAL | C6: graceful stubs |
| Legacy decommission | ❌ PENDING | C7: sau khi C1–C6 pass |

**Kết quả**: 2 containers legacy (`backend`, `backend-worker`) vẫn chạy do bridge và Celery ingest chưa cắt.  
**Mục tiêu Mục tiêu C**: Không còn request nào forward về `backend:8000`. Stop legacy containers.

---

## 1. Kiến trúc sau khi hoàn thành Mục tiêu C

```
Browser
  └── nginx:80
        ├── /api/*        → core-api:8100 (ALL — đã done B1)
        ├── /core/v1/*    → core-api:8100
        ├── /ws/*         → core-api:8100 (B7)
        └── /admin/*      → core-api:8100

core-api:8100 (Django/Daphne, packages/core/backend)
  ├── ALL realtime routes     → NATIVE (C2)
  ├── ALL stock-mgmt routes   → NATIVE (C3)
  ├── Portfolio analytics     → NATIVE (C4)
  ├── Auth email verify       → NATIVE (C5)
  └── Misc stubs              → graceful 200 (C6)

Celery core-worker (realtime_prefetch queue)
  └── fetch_and_upsert_price_board (60s) ← C1 adds to CELERY_BEAT_SCHEDULE

PostgreSQL vninvest ← shared single DB (không tách)

legacy backend container   ← STOPPED at C7
legacy backend-worker      ← STOPPED at C7
legacy_http_bridge.py      ← DELETED at C7
```

---

## 2. Danh sách tài liệu đọc trước khi code

Đọc theo thứ tự sau:

| # | Tài liệu | Mục đích |
|---|---------|---------|
| 1 | `docs/SAAS_STATE_ASSESSMENT_20260513.md` | Hiểu trạng thái hiện tại chính xác |
| 2 | `docs/SAAS_REMAINING_WORK_20260513.md` | Danh sách gap thực tế |
| 3 | `docs/IMPLEMENTATION_PLAN_FULL_INDEPENDENCE_CUTOVER_20260513.md` | **Source of truth** cho C1–C7 |
| 4 | `docs/TECH_SPEC_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Contract code chi tiết |
| 5 | `docs/TASKBOARD_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Task tracking per sub-slice |
| 6 | `docs/TRACEABILITY_MATRIX_FULL_INDEPENDENCE_CUTOVER_20260513.md` | REQ → slice → file |
| 7 | `docs/SELF_AUDIT_TEST_PROTOCOL_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Test commands mỗi slice |
| 8 | `docs/EXECUTION_EVIDENCE_TEMPLATE_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Template ghi nhận bằng chứng |
| 9 | `docs/CONFIG_OWNERSHIP_MATRIX_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Env vars, secrets, file ownership |
| 10 | `docs/CODE_QUALITY_CONSTITUTION_FULL_INDEPENDENCE_CUTOVER_20260513.md` | Coding rules cho pack này |

---

## 3. Slice sequence và DoD summary

| Slice | Mô tả | Effort | Gating |
|-------|-------|--------|--------|
| **C1** | Kích hoạt ingest trong core-beat | 0.5h | SymbolSnapshot.updated_at fresh; legacy-worker không còn là sole source |
| **C2** | 9 realtime bridge routes → native | 4h | curl tất cả 9 routes khi backend dừng → 200 với data |
| **C3** | 11 stock-mgmt bridge routes → native | 6h | curl tất cả 11 routes khi backend dừng → 200 với data |
| **C4** | Portfolio analytics native | 4h | holdings non-empty, equity-curve có data, unrealized_pnl đúng |
| **C5** | Auth email verify native | 1h | POST /api/auth/verify/ → 200 |
| **C6** | Misc graceful stubs | 2h | SubAccount → [], Telegram → not_available, watchlist sync |
| **C7** | Decommission legacy | 2h | 7 gates PASS, legacy containers stopped, bridge code deleted |

**Tổng**: ~19.5h = ~3 ngày dev

---

## 4. Hard constraints

> Đây là bất biến — không được vi phạm trong bất kỳ commit nào

1. **Không ghi vào legacy DB từ core containers** — `CoreRouter` block; không workaround.
2. **LEGACY_BACKEND_URL là env var** — không hardcode trong source.
3. **legacy_http_bridge.py bị xóa hoàn toàn** trước khi mark C7 done.
4. **Port 8000 không được expose** trong bất kỳ compose file nào (đã done B1 — giữ nguyên).
5. **Sau C2, C3, C4**: curl mọi endpoint mới khi **backend container đã stop** để xác nhận native, không phải bridge.
6. **C7 chỉ được thực hiện sau khi C1–C6 pass** đầy đủ và evidence đã ghi nhận.
7. **Không có default password** trong prod compose — dùng `${VAR:?error}`.
8. **ALLOWED_HOSTS và CORS** không wildcard/DEBUG-gated trong production.
9. **SubAccount**: return `[]` HTTP 200 — không raise 500, không forward về legacy.
10. **Telegram**: return `{"status": "not_available"}` HTTP 200.

---

## 5. Anchor files thay đổi

| File | Slice | Loại thay đổi |
|------|-------|--------------|
| `packages/core/backend/src/vninvest_core/settings.py` | C1 | Thêm beat schedule |
| `packages/core/backend/src/market_serving/legacy_views.py` | C2 | Thêm native views (giữ file) |
| `packages/core/backend/src/market_serving/api_urls.py` | C2 | Re-route đến native views |
| `packages/core/backend/src/market_data/public_urls.py` | C3 | Re-route đến native views |
| `packages/core/backend/src/user_workspace/legacy_views.py` | C4 | Replace stubs với real computation |
| `packages/core/backend/src/user_workspace/urls.py` | C4 | Wire real endpoints |
| `packages/core/backend/src/identity_access/views_auth.py` | C5 | Thêm VerifyEmailView |
| `packages/core/backend/src/market_serving/views.py` | C6 | SubAccount, Telegram stubs |
| `packages/core/backend/src/vninvest_core/legacy_http_bridge.py` | C7 | **DELETE** |
| `docker-compose.dev.yml` | C7 | Remove backend + backend-worker |
| `docker-compose.prod.yml` | C7 | Remove backend + backend-worker |

---

## 6. Evidence obligations

Mỗi slice sau khi hoàn thành phải có evidence file tại:
```
docs/evidence/CUT-{SLICE_ID}-EVIDENCE-{YYYYMMDD}.md
```

Dùng template: `docs/EXECUTION_EVIDENCE_TEMPLATE_FULL_INDEPENDENCE_CUTOVER_20260513.md`

Tối thiểu phải có:
- Danh sách file đổi (có dòng cụ thể)
- Command validation + output (copy-paste thực tế)
- Docker health check (`docker ps`)
- Smoke test payload snapshot (JSON từ curl)

---

## 7. Go/No-Go checklist trước C7

- [ ] C1: `SymbolSnapshot.updated_at` fresh trong 90s (kiểm tra qua Django shell)
- [ ] C2: 9 realtime routes → 200 khi backend stopped (curl evidence)
- [ ] C3: 11 stock-mgmt routes → 200 khi backend stopped (curl evidence)
- [ ] C4: `/api/portfolio/holdings/` → non-empty JSON array
- [ ] C5: POST `/api/auth/verify/` → 200 (không 502)
- [ ] C6: `/api/account/sub-accounts/` → `[]`; `/api/telegram/status/` → `{"status":"not_available"}`
- [ ] `grep -rn "legacy_bridge_response" packages/core/backend/src/` → 0 results (sau delete)
- [ ] `docker ps` → không còn container tên `backend` hay `backend-worker`

---

## 8. Rollback plan

Nếu bất kỳ smoke test nào fail sau C7:

```powershell
# Rollback: khởi động lại legacy containers
docker compose -f docker-compose.dev.yml up -d backend backend-worker

# Re-enable bridge nếu cần (từ git restore)
git restore packages/core/backend/src/vninvest_core/legacy_http_bridge.py
git restore packages/core/backend/src/market_serving/api_urls.py
git restore packages/core/backend/src/market_data/public_urls.py
```

> Điều kiện rollback: bất kỳ P0 endpoint trả 502 hoặc 500 sau khi backend stopped.

---

## 9. Post-cutover validation (C7+1)

Sau 24h stable:
1. Kiểm tra Celery beat logs: `fetch_and_upsert_price_board` chạy mỗi 60s, no errors
2. Kiểm tra `SymbolSnapshot`: `count > 0`, `stale=False` cho top symbols
3. Kiểm tra error rate từ nginx logs: `grep "502\|503\|500" nginx.log | wc -l` → expected 0
4. Cập nhật `PROGRESS_DASHBOARD.md` và `docs/CODE_CHANGE_AUDIT_LEDGER.md`

---

*Tài liệu này là bootstrap artifact — đọc trước toàn bộ pack; tech spec + taskboard là working documents.*
