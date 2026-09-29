# SAAS-15 — Legacy Decommission Final Gate

**Ngày:** 2026-05-03  
**Trạng thái:** Planned — bắt đầu sau khi SAAS-14 completed  
**Mục tiêu:** Kiểm tra toàn bộ điều kiện cần thiết trước khi decommission legacy roots (`backend/`, `frontend/`, `mobile-app/`). Chạy formal go/no-go gate. Thực hiện decommission có kiểm soát nếu tất cả gates pass.

> ⚠️ **Đây là slice không thể đảo ngược.** Decommission legacy roots là hành động permanent đối với production. Phải có explicit user confirmation và toàn bộ gates phải GREEN trước khi bắt đầu decommission.

---

## 1. Triết lý của slice này

SAAS-15 không phải "xóa code cũ cho gọn". Đây là:
1. **Proof of replacement** — packages/core, packages/web, packages/mobile đã phục vụ đủ tất cả business flows
2. **Risk reduction** — cutover có rollback plan rõ ràng
3. **Final audit** — tất cả contracts, APIs, data paths đều có evidence
4. **Controlled decommission** — không xóa lung tung, làm từng phase

---

## 2. Pre-conditions checklist (phải GREEN hết)

### Gate A — Core package completeness

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| A1 | `packages/core` chạy Django độc lập không cần `backend/` | `docker compose -f packages/core/docker-compose.core.yml up` | ⬜ |
| A2 | `/core/v1/auth/login` xác thực được | `curl -X POST /core/v1/auth/login` với credentials hợp lệ | ⬜ |
| A3 | `/core/v1/auth/profile` trả user profile | `curl /core/v1/auth/profile` với valid token | ⬜ |
| A4 | Tenant CRUD đầy đủ trong packages/core | Django admin + API tests | ⬜ |
| A5 | PAT issue/rotate/revoke trong packages/core | API tests | ⬜ |
| A6 | Tenant lifecycle transitions trong packages/core | `test_identity_access.py` pass | ⬜ |

### Gate B — Data-plane serving completeness

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| B1 | `SymbolSnapshot` có data fresh (< 2 phút old) cho top 20 symbols | Django shell query | ⬜ |
| B2 | `SessionFacts` có data cho current session | Django shell query | ⬜ |
| B3 | `UnifiedAlert` được populated từ whale + signal sources | Django shell query | ⬜ |
| B4 | Celery materializer jobs chạy on schedule không crash | Celery flower hoặc beat log 1 giờ | ⬜ |
| B5 | Serving endpoints trả đúng contract shape | Contract validation script | ⬜ |
| B6 | `stale=true` được set khi materializer fail | Unit test + manual trigger | ⬜ |

### Gate C — Client migration completeness

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| C1 | `packages/mobile` không còn gọi legacy paths | `grep -r "/portfolio/\|/stock-management/\|/whale-analytics/" packages/mobile/src/` → 0 matches | ⬜ |
| C2 | `packages/web` không còn gọi legacy paths | `grep -r "/portfolio/\|/stock-management/\|/whale-analytics/" packages/web/src/` → 0 matches | ⬜ |
| C3 | `packages/vip-app` không còn gọi legacy paths | `grep -r legacy packages/vip-app/` → 0 matches | ⬜ |
| C4 | Mobile TypeScript typecheck green | `tsc --noEmit` trong packages/mobile | ⬜ |
| C5 | Web build clean (no legacy import errors) | `npm run build` trong frontend | ⬜ |

### Gate D — Contract coverage

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| D1 | 6 data-plane contracts tồn tại và valid | `node shared/scripts/validate-contracts.mjs` | ⬜ |
| D2 | Contract validator chạy trong CI | CI log | ⬜ |
| D3 | Tất cả serving endpoints trả đúng shape so với contract | Contract parity test script | ⬜ |

### Gate E — Regression test coverage

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| E1 | `backend/portfolio/tests/` — tất cả existing tests vẫn pass | `python manage.py test portfolio --keepdb` | ⬜ |
| E2 | `packages/core/backend/tests/` — tất cả core tests pass | `pytest packages/core/backend/tests/` | ⬜ |
| E3 | Frontend smoke tests pass | `npm test -- --watchAll=false` | ⬜ |
| E4 | Mobile TypeScript check pass | `tsc --noEmit` | ⬜ |

### Gate F — Production traffic routing readiness

| # | Điều kiện | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| F1 | nginx/proxy config có thể route `/core/v1` → core-api | `curl http://localhost/core/v1/health` qua proxy | ⬜ |
| F2 | Rollback procedure đã được test (re-enable legacy routes) | Drill documented | ⬜ |
| F3 | Monitoring alerts cho core-api error rate | Grafana/logging dashboard | ⬜ |
| F4 | Database backup có trước khi decommission | `pg_dump` evidence | ⬜ |

---

## 3. Go/No-Go decision

### Tiêu chí Go:
- TẤT CẢ gate A, B, C, D, E phải GREEN
- Gate F phải GREEN hoặc có compensating control documented

### Tiêu chí No-Go:
- Bất kỳ gate nào RED là hard block
- Bất kỳ gate nào YELLOW (workaround) phải có explicit approval từ platform lead

---

## 4. Decommission sequence (nếu Go)

### Phase 1 — Route isolation (không xóa code)

1. Cập nhật nginx config để route tất cả traffic qua `/core/v1` và `/` qua packages/web shell
2. Disable legacy routes trong `backend/portfolio/urls.py` (comment out, không xóa)
3. Monitor 24 giờ — nếu không có error tăng → proceed Phase 2

### Phase 2 — Legacy read-only window (7 ngày)

1. Legacy backend vẫn chạy nhưng chỉ nhận đọc (GET-only)
2. Tất cả mutating operations (POST/PUT/DELETE) route qua packages/core
3. Monitor 7 ngày

### Phase 3 — Legacy shutdown

1. Stop legacy backend container
2. Monitor 24 giờ — nếu không có error → proceed
3. Rename legacy directories: `backend/` → `_legacy_backend_archive/`
4. Cập nhật docker-compose để remove legacy services

### Phase 4 — Archive

1. Create Git tag `pre-decommission-legacy` trước khi xóa
2. Archive legacy directories vào separate branch: `archive/legacy-pre-saas15`
3. Remove từ main branch
4. Cập nhật README, AGENTS.md với trạng thái mới

---

## 5. Rollback plan

### Nếu Phase 1 fail:
- Revert nginx config → legacy routes active lại ngay lập tức
- ETA rollback: < 5 phút

### Nếu Phase 2 fail:
- Re-enable mutating operations trên legacy backend
- ETA rollback: < 10 phút

### Nếu Phase 3 fail:
- `docker compose up legacy-backend legacy-frontend` để restart legacy services
- ETA rollback: < 15 phút (nếu containers còn tồn tại)

### Nếu Phase 4 — không rollback (archive là permanent)
- Restore từ Git branch `archive/legacy-pre-saas15`

---

## 6. Files cần update sau decommission

| File | Thay đổi |
|---|---|
| `AGENTS.md` | Cập nhật anchor files — xóa refs đến legacy paths |
| `PROGRESS_DASHBOARD.md` | Mark legacy decommission complete |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Append decommission event |
| `docker-compose.dev.yml` | Remove legacy-backend, legacy-frontend services |
| `docker-compose.prod.yml` | Remove legacy services |
| `shared/api-contracts/README.md` | Cập nhật — tất cả clients dùng /core/v1 |
| `module_tree_full.md` | Regenerate |

---

## 7. Exit criteria

| # | Tiêu chí | Kiểm tra bằng |
|---|---|---|
| 1 | Tất cả 6 Gates (A-F) GREEN | Gate checklist filled out |
| 2 | Decommission sequence hoàn thành đến Phase 3 hoặc Phase 4 | Log evidence |
| 3 | Production traffic 0 error tăng sau 24h | Monitoring |
| 4 | Legacy containers không còn trong docker ps | `docker ps` |
| 5 | module_tree_full.md đã regenerate | File timestamp |

---

## 8. Không thực hiện slice này nếu

1. Bất kỳ slice nào từ SAAS-12 đến SAAS-14 chưa có evidence packet
2. Data-plane materializers chưa chạy ổn định > 24 giờ
3. Chưa có database backup trước khi cutover
4. Không có explicit confirmation từ user/platform lead

---

## 9. Evidence template

Sau khi SAAS-15 hoàn thành, tạo:
`docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS15.md`

Nội dung bắt buộc:
1. Gate checklist A-F với trạng thái cuối cùng và evidence link
2. Go/No-Go decision với rationale
3. Decommission sequence log (timestamps cho từng phase)
4. 24h monitoring report sau cutover
5. Git tag và archive branch reference
6. Updated file list (README, AGENTS.md, module_tree, docker-compose)
