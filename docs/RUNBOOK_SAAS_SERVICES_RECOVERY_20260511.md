# RUNBOOK — SaaS Services Recovery

**Ngày**: 2026-05-11

---

## 1. Recovery quick path

1. Xác nhận trạng thái hiện tại:
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

2. Khởi động data plane trước:
```powershell
docker compose -f docker-compose.dev.yml up -d db redis
```

3. Khởi động core runtime:
```powershell
docker compose -f docker-compose.dev.yml up -d core-api core-worker core-beat frontend
```

4. Kiểm tra health:
```powershell
curl -s -o /dev/null -w "%{http_code}" http://localhost/core/v1/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health/
```

---

## 2. Incident playbook

## 2.1 DB/Redis down
1. Restart service bị lỗi.
2. Kiểm tra healthcheck.
3. Kiểm tra logs boot.
4. Chỉ mở tiếp runtime khi dependency đã healthy.

## 2.2 core-api stuck at starting
1. Kiểm tra logs `core-api`.
2. Kiểm tra migrate/check command.
3. Kiểm tra DB/Redis connectivity.
4. Nếu quá ngưỡng thời gian, rollback về snapshot ổn định.

## 2.3 Worker không consume task
1. Kiểm tra broker URL.
2. Kiểm tra worker logs và task registration.
3. Kiểm tra beat dispatch.
4. Kiểm tra queue depth.

## 2.4 Duplicate processing suspicion
1. Kiểm tra legacy worker/beat có đang xử lý cùng workload không.
2. Tạm dừng path gây trùng.
3. Ghi incident evidence và quyết định cutover rule.

---

## 3. Rollback trigger

Kích hoạt rollback khi:
1. API health fail liên tục.
2. Queue backlog tăng không hồi phục.
3. Background jobs fail hàng loạt.
4. Data path có dấu hiệu sai lệch nghiêm trọng.

Rollback nguyên tắc:
1. Dừng rollout hiện tại.
2. Khôi phục compose/env snapshot gần nhất đã pass.
3. Bring up lại theo thứ tự data plane -> core runtime -> frontend.
4. Chạy health + smoke suite trước khi mở traffic.

---

## 4. Handover checklist

1. Update taskboard.
2. Update audit ledger.
3. Update progress dashboard.
4. Tạo evidence docs theo template cho mọi slice.
5. Chốt sign-off với Tech Lead, DevOps Lead, QA Lead.
