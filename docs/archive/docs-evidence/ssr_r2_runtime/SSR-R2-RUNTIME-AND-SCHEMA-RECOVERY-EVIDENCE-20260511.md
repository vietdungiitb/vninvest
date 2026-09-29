# Evidence — SSR-R2/RX: Runtime and Schema Recovery

**Ngày thực hiện**: 2026-05-11  
**Owner**: GitHub Copilot (GPT-5.3-Codex)  
**Phase**: R2 (+ schema blocker hotfix)

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Ghi chú |
|---|---|---|
| docs/evidence/SSR-R2-RUNTIME-AND-SCHEMA-RECOVERY-EVIDENCE-20260511.md | New | Evidence slice |
| docs/TASKBOARD_SAAS_SERVICES_RECOVERY_20260511.md | Modified | Cập nhật trạng thái task đã hoàn tất |
| docs/CODE_CHANGE_AUDIT_LEDGER.md | Modified | Thêm entry audit cho slice runtime/schema recovery |
| PROGRESS_DASHBOARD.md | Modified | Cập nhật tiến độ recovery checkpoint |

---

## 2. Validation commands và kết quả

```powershell
# Kiểm tra runtime stack

docker compose -f docker-compose.dev.yml ps

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Truy vết lỗi thiếu bảng RuntimeVnbrokerConfig

docker compose -f docker-compose.dev.yml exec -T backend python manage.py showmigrations portfolio | Select-String "0038|0071"

docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d vninvest -c "\dt portfolio_runtimevnbrokerconfig"

# Recovery migration state + tạo bảng thiếu

docker compose -f docker-compose.dev.yml exec -T backend python manage.py migrate portfolio 0037_h2_whaleadvisory_aggregate_snapshot_fk --fake

docker compose -f docker-compose.dev.yml exec -T backend python manage.py migrate portfolio 0038_runtimevnbrokerconfig

docker compose -f docker-compose.dev.yml exec -T backend python manage.py migrate portfolio 0076_transaction_reconciliation_fields --fake

# Verify hậu-fix

docker compose -f docker-compose.dev.yml exec -T backend python manage.py showmigrations portfolio | Select-String "0038|0076"

docker compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from portfolio.models import RuntimeVnbrokerConfig; obj=RuntimeVnbrokerConfig.get_or_create_singleton(); print(obj.pk, obj.price_board_source)"

curl -s -o /dev/null -w "%{http_code}" http://localhost/core/v1/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health/
```

**Kết quả tóm tắt**:
- PASS: Stack `db`, `redis`, `core-api`, `core-worker`, `core-beat`, `frontend` đều up; các service có healthcheck báo healthy.
- PASS: Bảng `portfolio_runtimevnbrokerconfig` đã tồn tại trong DB.
- PASS: Migration marker quan trọng `0038` và `0076` đều ở trạng thái applied.
- PASS: `RuntimeVnbrokerConfig.get_or_create_singleton()` hoạt động (`1 KBS`).
- PASS: `/core/v1/health` và `/api/health/` đều trả 200.
- PASS: Không còn log mới chứa `portfolio_runtimevnbrokerconfig does not exist` trong cửa sổ kiểm tra hậu-fix.

---

## 3. Runtime health snapshot

- `core-api`: Up (healthy)
- `db`: Up (healthy)
- `redis`: Up (healthy)
- `mailpit`: Up (healthy)
- `core-worker`: Up
- `core-beat`: Up
- `frontend`: Up
- `backend-legacy`: Up

---

## 4. Root cause và fix

Root cause:
1. Migration ledger của app `portfolio` bị lệch so với schema thực tế: migration `0038_runtimevnbrokerconfig` được đánh dấu applied nhưng bảng `portfolio_runtimevnbrokerconfig` không tồn tại.

Fix applied:
1. Fake rollback về trước `0038`.
2. Apply thật migration `0038_runtimevnbrokerconfig` để tạo lại bảng thiếu.
3. Fake-forward ledger trở lại `0076_transaction_reconciliation_fields` để đồng bộ với schema hiện hữu.

---

## 5. Risk còn lại

1. Cần thực hiện thêm các gate R3-R6 (queue depth/latency sâu hơn, cutover SaaS-only, soak 24-72h) trước khi tuyên bố hoàn tất toàn chương trình.
2. Service `backend-legacy` có thời gian bootstrap apt/pip dài sau restart; cần theo dõi đến khi hoàn tất nếu dùng cho validation legacy-path kéo dài.

---

## 6. Checklist đóng slice

- [x] Taskboard cập nhật
- [x] docs/CODE_CHANGE_AUDIT_LEDGER.md cập nhật
- [x] PROGRESS_DASHBOARD.md cập nhật
- [x] Runtime stack đã được xác nhận sau recovery
