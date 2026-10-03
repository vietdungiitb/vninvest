# RUN INTEGRATION TESTS — SaaS Services Recovery

**Ngày**: 2026-05-11

---

## 1. Pre-check

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Kỳ vọng:
1. Core stack services đều running.
2. Data plane services healthy.

---

## 2. Health suite

```powershell
curl -s -o /dev/null -w "%{http_code}" http://localhost/core/v1/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health/
```

Pass criteria:
1. Cả hai endpoint trả 200.

---

## 3. Queue & scheduler suite

```powershell
docker logs --tail 120 vninvest-dev-core-beat
docker logs --tail 120 vninvest-dev-core-worker
```

Pass criteria:
1. Beat có dispatch.
2. Worker có consume/completion.
3. Không có `unregistered task`, `broker unavailable`, `localhost redis connection refused`.

---

## 4. Domain smoke suite

```powershell
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/realtime/ticker/VIC/
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/realtime/unified-alerts/
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/portfolio/watchlist/groups/
```

Pass criteria:
1. Không có 5xx.
2. Kết quả đúng kỳ vọng auth contract (200/401 tuỳ endpoint).

---

## 5. Compose stability suite

```powershell
docker compose -f docker-compose.dev.yml ps
```

Pass criteria:
1. Không service nào bị restart loop.
2. Core API không stuck lâu ở `starting`.

---

## 6. Report format

Sau khi chạy, bắt buộc ghi:
1. Commands đã chạy.
2. Kết quả pass/fail từng suite.
3. Residual risks.
4. Link evidence doc tương ứng.
