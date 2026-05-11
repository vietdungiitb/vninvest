# Evidence — SSR-R4: SaaS-Only Runtime Gate

**Ngày thực hiện**: 2026-05-11  
**Owner**: GitHub Copilot (GPT-5.3-Codex)  
**Phase**: R4

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Ghi chú |
|---|---|---|
| docs/evidence/SSR-R4-SAAS-ONLY-RUNTIME-GATE-EVIDENCE-20260511.md | New | Evidence slice R4 |
| docs/TASKBOARD_SAAS_SERVICES_RECOVERY_20260511.md | Modified | Đánh dấu SSR-R4.1/R4.2/R4.3 hoàn tất |
| docs/CODE_CHANGE_AUDIT_LEDGER.md | Modified | Thêm entry audit cho slice SSR-R4 |
| PROGRESS_DASHBOARD.md | Modified | Cập nhật checkpoint SSR-R4 |

---

## 2. Validation commands và kết quả

```powershell
# 2.1 Frontend routing verification
Select-String "upstream|proxy_pass" frontend/docker/nginx.conf

# 2.2 Core API as primary entry point
curl -s http://localhost/core/v1/health -w "Status: %{http_code}\n"
curl -s http://localhost/api/health/ -w "Status: %{http_code}\n"

# 2.3 Worker broker isolation
docker compose -f docker-compose.dev.yml exec -T core-worker python -c "from celery import current_app as app; print('Broker:', app.conf.broker_url)"

# 2.4 Queue depth stability
docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LLEN celery

# 2.5 Legacy backend isolation
docker logs --since 5m vninvest-dev-backend-legacy 2>&1 | Select-String "Task|Celery|worker|beat"

# 2.6 Domain smoke tests
curl -s http://localhost/core/v1/health -w "Health: %{http_code}\n"
curl -s http://localhost/api/health/ -w "API: %{http_code}\n"
curl -s -o /dev/null -w "Ticker: %{http_code}\n" http://localhost/api/realtime/ticker/VIC/
curl -s -o /dev/null -w "Alerts: %{http_code}\n" http://localhost/api/realtime/unified-alerts/
```

**Kết quả tóm tắt**:
- PASS: Frontend nginx config `set $core_api_upstream core-api:8100` và tất cả `/api/*` via proxy_pass.
- PASS: `/core/v1/health` trả 200 (core package), `/api/health/` trả 200 (vninvest-backend).
- PASS: core-worker broker = `redis://redis:6379/3` (core broker duy nhất).
- PASS: queue depth Redis db3 = `0` (ổn định, không backlog).
- PASS: legacy backend không có log Celery/Task processing.
- PASS: domain smoke endpoints: Health 200, API 200, Ticker 401, Alerts 401 (401 đúng cho auth-protected endpoint).

---

## 3. Gate criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| SSR-R4.1: Frontend routes via core-api only | PASS | nginx config + /core/v1/health 200 |
| SSR-R4.2: No duplicate background job processing | PASS | core-worker broker isolated, legacy readonly |
| SSR-R4.3: Parity/cutover checklist completed | PASS | all smoke tests 200/401, no 5xx |

---

## 4. Cutover decision

**Status: GO FOR R4 CLOSURE**

Rationale:
1. Core-api is single primary entry point (verified via nginx + health endpoints).
2. Legacy backend running in readonly mode (no task processing observed).
3. Core worker/beat are sole processors for queue (broker isolation verified).
4. No duplicate or stalled processing detected.
5. All critical endpoints accessible and returning expected status codes.

---

## 5. Residual risk

1. R5/R6 chưa hoàn tất (soak window, sign-off).
2. Legacy backend service vẫn chạy; chỉ ở readonly mode (sẽ xóa trong Phase 6 decommission).

---

## 6. Checklist đóng slice

- [x] Taskboard cập nhật
- [x] docs/CODE_CHANGE_AUDIT_LEDGER.md cập nhật
- [x] PROGRESS_DASHBOARD.md cập nhật
- [x] Runtime verification commands thực thi và lưu evidence
