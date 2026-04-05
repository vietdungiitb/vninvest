# Sprint 22 - Go/No-Go review (Trading rollout readiness)

Trang thai hien tai: PARTIAL (code-ready, ops gates pending)

## 1) Gate checklist

1. Market Data rollout 100% an toan (S22-02): PENDING OPS
2. Realtime connection manager khong leak socket, khong reconnect spam (S22-03..S22-06): IN PROGRESS
3. Trading path moi chay staging sau flag, regression toi thieu pass (S22-07..S22-10): READY FOR STAGING

## 2) Da hoan tat trong codebase

- Trading boundary skeleton:
  - backend/portfolio/trading_service.py
  - backend/portfolio/trading_views.py
- Toggle route:
  - backend/portfolio/urls.py voi ENABLE_NEW_TRADING_VIEWS
- Regression toi thieu cho Trading:
  - test toggle route portfolio
  - test SubAccount create error path
  - test Transaction create auth boundary
- Realtime connection manager frontend:
  - frontend/src/context/RealtimeContext.jsx
  - frontend/src/hooks/useRealtimeFeed.js (manager-aware wrapper)
  - frontend/src/hooks/useRealtimeFeedLegacy.js (legacy + reconnect jitter + circuit breaker + telemetry)

## 3) Con thieu de chot Go/No-Go production

- Canary 50%/100% + observability sign-off (DevOps/QA runtime window).
- Soak test FE/BE dai hoi (chuyen trang lien tuc, monitor socket leak).
- Bien ban rollback rehearsal runtime.

## 4) De xuat quyet dinh hien tai

- Trading production canary: NO-GO (tam thoi) cho den khi xong ops/qa gates tren moi truong staging/production.
- Trading staging rollout behind flag: GO.

## 5) Phe duyet

- Tech Lead: ____
- QA Lead: ____
- DevOps Lead: ____
- Ngay gio: ____
