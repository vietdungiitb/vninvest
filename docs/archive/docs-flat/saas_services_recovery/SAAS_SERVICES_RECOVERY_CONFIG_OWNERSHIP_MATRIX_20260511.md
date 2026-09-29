# CONFIG OWNERSHIP MATRIX — SaaS Services Recovery

**Ngày**: 2026-05-11

| Config area | File/Surface | Primary Owner | Backup Owner | Validation Gate |
|---|---|---|---|---|
| Core DB config | docker-compose*.yml env | DevOps Lead | Backend Lead | R1 |
| Core Redis config | docker-compose*.yml env | DevOps Lead | Backend Lead | R1 |
| Core API runtime env | core-api environment | Backend Lead | DevOps Lead | R2 |
| Worker/Beat broker/schedule config | core-worker/core-beat env + celery config | Backend Lead | DevOps Lead | R3 |
| Frontend upstream routing | frontend/nginx config + compose deps | Frontend Lead | DevOps Lead | R2/R4 |
| Health endpoints and checks | core backend health views | Backend Lead | QA Lead | R2 |
| Observability stack | prometheus/grafana configs | DevOps Lead | QA Lead | R5 |
| Legacy cutover toggles | runtime route/cutover settings | Tech Lead | Backend Lead | R4 |
| Recovery governance docs | handoff/taskboard/protocol/evidence | Tech Lead | PM/QA | R6 |

## Ownership rules
1. Không đổi owner mà không ghi lại trong taskboard.
2. Mỗi thay đổi config phải có validator owner độc lập.
3. Mọi config thay đổi phải có evidence command và kết quả.
