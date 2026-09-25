# BL-13 gates — k6 smoke + saturation baseline (2026-09-24)

## Deviation (ghi rõ): k6-via-docker BLOCKED
- `docker run` treo toàn bộ (kể cả `redis:7-alpine echo`, kể cả `k6 version`): 3 lần timeout 90–600s, 0 output. Container cũ vẫn chạy → Docker Desktop runtime stall, không liên quan code.
- Fallback: `infra/load-tests/smoke-fallback.ps1` (host-native, cùng ngưỡng smoke profile: p95<1000ms, errors<5%).

## Kết quả (dev stack, 20 req/endpoint)
- Qua nginx `:8080` (production-like, gồm rewrite): health p95 69.5ms · api-health p95 64.7ms · capability-bootstrap p95 56.7ms · **0 fails → PASS**.
- Phát hiện phụ (không phải bug app): đánh thẳng core-api `:8001/api/core/v1/health` → 502 `LEGACY_BACKEND_DOWN` (rơi vào proxy catch-all do thiếu rewrite của nginx — đúng thiết kế, không crash).
- Saturation proxy: `pg_stat_activity` = **143 connections** trong lúc đo (baseline cho BL-21/22/23 unlock).

## Ngưỡng verdict (ghi trước, dùng cho lần sau)
- PASS khi p95<1000ms và fail-rate<5% trên cả 3 paths qua `:8080`. FAIL → mở ticket bottleneck kèm số.

## Còn lại
- [ ] Chạy lại bằng k6 thật khi Docker Desktop hồi phục (script `api-load.js` smoke profile đã sẵn).
- [ ] Load có auth (PAT) + soak pooler gộp BL-05 post-deploy.

## DoD tick
- [x] baseline số · [x] verdict thresholds · [x] saturation proxy number · [ ] k6-native rerun (blocked env).
