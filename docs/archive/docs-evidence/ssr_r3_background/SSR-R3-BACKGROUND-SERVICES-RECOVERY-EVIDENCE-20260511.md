# Evidence — SSR-R3: Background Services Recovery

**Ngay thuc hien**: 2026-05-11  
**Owner**: GitHub Copilot (GPT-5.3-Codex)  
**Phase**: R3

---

## 1. Files da thay doi

| File | Loai thay doi | Ghi chu |
|---|---|---|
| docs/evidence/SSR-R3-BACKGROUND-SERVICES-RECOVERY-EVIDENCE-20260511.md | New | Evidence slice R3 |
| docs/TASKBOARD_SAAS_SERVICES_RECOVERY_20260511.md | Modified | Danh dau hoan tat SSR-R3.1 -> SSR-R3.4 |
| docs/CODE_CHANGE_AUDIT_LEDGER.md | Modified | Them entry audit cho slice SSR-R3 |
| PROGRESS_DASHBOARD.md | Modified | Cap nhat checkpoint SSR-R3 |
| docker-compose.dev.yml | Modified | Chuan hoa DJANGO_SECRET_KEY cho backend service |
| module_tree_full.md | Regenerated | Dong bo module tree sau thay doi |

---

## 2. Validation commands va ket qua

```powershell
# Verify beat dispatch flow

docker logs --since 3m vninvest-dev-core-beat | Select-String -Pattern "Scheduler: Sending due task|due task|DatabaseScheduler"

# Verify worker consume -> complete flow

docker logs --since 10m vninvest-dev-core-worker | Select-String -Pattern "received|succeeded|ready|Connected"

# Verify queue depth

docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LLEN celery

# Domain critical endpoint smoke (expect no 5xx)

curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/ticker/?symbol=VNM
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/unified-alerts/?symbol=VNM
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/watchlist/groups/

# Apply updated dev runtime env for backend secret key

docker compose -f docker-compose.dev.yml up -d backend
```

**Ket qua tom tat**:
- PASS: Beat dispatch lien tiep cadence 60s/120s qua log `Scheduler: Sending due task ...`.
- PASS: Worker connected broker, ready, va co nhieu cycle `received` -> `succeeded` lien tiep.
- PASS: Queue depth Redis db3 (`celery`) = `0` tai thoi diem check.
- PASS: Domain smoke endpoints khong co 5xx; cac endpoint auth-protected tra `401` la phu hop contract khi chua truyen credential.
- PASS: `backend` da duoc cap nhat env `DJANGO_SECRET_KEY` ro rang trong compose de tranh fallback key trong runtime command path.

---

## 3. Evidence trich dan chinh

Beat (dispatch):
- `materialize-symbol-snapshot-60s` duoc dispatch lien tiep.
- `materialize-unified-alerts-2m` duoc dispatch theo cadence.

Worker (consume/complete):
- `materialize_symbol_snapshot` received va succeeded lap lai nhieu lan.
- `materialize_unified_alerts` received va succeeded.
- `materialize_session_facts` received va succeeded.

Queue:
- `LLEN celery` = `0`.

Domain smoke:
- `/api/v1/ticker/?symbol=VNM` -> `401`
- `/api/v1/unified-alerts/?symbol=VNM` -> `401`
- `/api/v1/watchlist/groups/` -> `401`

---

## 4. Ket luan gate R3

- `SSR-R3.1`: PASS  
- `SSR-R3.2`: PASS  
- `SSR-R3.3`: PASS  
- `SSR-R3.4`: PASS (voi tieu chi runtime no-5xx cho endpoint protected)

---

## 5. Residual risk

1. Chua co soak window 24h/72h (R5) de ket luan do on dinh dai han.
2. Chua dong R4 SaaS-only runtime gate (entrypoint, duplicate processing parity checklist).
3. `backend-legacy` container co bootstrap apt/pip dai; can theo doi log bootstrap den khi vao trang thai operational day du neu can dung cho test legacy path.

---

## 6. Checklist dong slice

- [x] Taskboard cap nhat
- [x] docs/CODE_CHANGE_AUDIT_LEDGER.md cap nhat
- [x] PROGRESS_DASHBOARD.md cap nhat
- [x] Runtime command evidence duoc ghi lai
