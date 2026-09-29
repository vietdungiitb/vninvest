# Backend Technical Diagram - Level 2.2 (Target State)

Muc tieu:
- Mo ta kien truc to-be sau khi chuan hoa route va contract API.
- Dung lam tai lieu trien khai cho Sprint 7 -> Sprint 10.

## 1) API namespace target (to-be)

```mermaid
flowchart LR
    FE[Frontend App] --> GW[Django API Router]

    GW --> N1[/api/auth/*]
    GW --> N2[/api/portfolio/*]
    GW --> N3[/api/stock-management/*]
    GW --> N4[/api/realtime/*]
    GW --> N5[/api/admin-sync/*]

    N1 --> A1[JWT Auth Service]
    N2 --> A2[Portfolio Domain Service]
    N3 --> A3[Stock Catalog Service]
    N4 --> A4[Realtime Read Service]
    N5 --> A5[Sync Orchestrator]
```

## 2) Service decomposition target (L2.2)

```mermaid
flowchart TB
    subgraph APP[Application Layer]
        S1[Auth Service]
        S2[Portfolio Service]
        S3[Analytics Service]
        S4[Stock Management Service]
        S5[Realtime Push Service]
        S6[Screener/Advisor Service]
        S7[Admin Sync Service]
        S8[Django Channels Gateway]
    end

    subgraph CORE[Core Compute]
        C1[Pandas Portfolio Engine]
        C2[Pandas Intraday Engine\nVWAP + Whale]
        C3[Rule Evaluator\nJSON DSL]
        C4[Risk Engine\nATR Entry/SL/TP]
    end

    subgraph DATA[Storage]
        DB[(PostgreSQL)]
        RD[(Redis)]
        TS[(TimescaleDB/InfluxDB optional)]
    end

    subgraph BG[Background Workers]
        B1[Celery Beat]
        B2[Collector Worker\nIntraday polling 5s + proxy rotation]
        B3[EOD Worker\nDaily price sync]
        B4[Snapshot Worker\n15:30 NAV/TWR]
        MK[vnbroker Provider]
    end

    S2 --> C1
    S3 --> C1
    S5 --> RD
    S8 --> RD
    S8 --> FEWS[WebSocket Clients]
    S6 --> C3
    S6 --> C4
    S7 --> B1

    C1 --> DB
    C2 --> RD
    C3 --> DB
    C4 --> DB

    B1 --> B2
    B1 --> B3
    B1 --> B4
    B2 --> MK
    B2 --> C2
    B2 --> TS
    B3 --> MK
    B3 --> DB
    B3 --> TS
    B4 --> C1
    B4 --> DB
```

## 3) Realtime to-be flow

```mermaid
sequenceDiagram
    autonumber
    participant BEAT as Celery Beat
    participant COL as Collector Worker
    participant VS as vnbroker
    participant ENG as Intraday Pandas Engine
    participant R as Redis Pub/Sub
    participant CH as Django Channels
    participant FE as Frontend WebSocket
    participant HTTP as Fallback Polling API

    BEAT->>COL: Trigger every 5-10s
    COL->>VS: Fetch intraday symbols by user watchlist
    VS-->>COL: ticks/orderbook payload
    COL->>ENG: Compute VWAP, whale, trend flags
    ENG-->>COL: normalized metrics
    COL->>R: Publish ticker/whale events
    CH->>R: Subscribe channel_{symbol}_ticker
    R-->>CH: New event payload
    CH-->>FE: Push JSON event

    alt WebSocket disconnected
        FE->>HTTP: GET /api/realtime/ticker/{symbol}
        HTTP-->>FE: stale-safe payload
    end
```

## 4) Target endpoint matrix (to-be)

| Namespace | Main endpoints | Purpose | Sprint |
|---|---|---|---|
| /api/auth/* | token, refresh, me | Xac thuc va phien dang nhap | 7 |
| /api/portfolio/* | portfolios, subaccounts, transactions, holdings, summary, chart, allocation | Nghiep vu danh muc va bao cao | 7-9 |
| /api/stock-management/* | stocks, groups, items, tracked-symbols | Danh muc ma thi truong | 7 |
| /api/realtime/* | ticker, watchlist, alerts | Du lieu trong phien tu Redis | 10-11 |
| /api/admin-sync/* | stockprofile sync, eod sync, snapshot trigger | Van hanh va dong bo | 7-10 |

## 5) Migration path from 2.1 to 2.2

1. Chot route ownership va deprecate endpoint trung y nghia.
2. Frontend doi API map theo namespace moi.
3. Bo sung /api/realtime/* va Redis read service.
4. Chuyen sync endpoint ve /api/admin-sync/* (hoac stock-management/sync).
5. Ban hanh OpenAPI v1.1 va contract tests.

## 6) Acceptance criteria for L2.2 rollout

- Khong con endpoint overlap giua portfolio va stock-management.
- 100% endpoint moi co contract docs.
- Frontend pages chinh khong con goi route legacy.
- Realtime API p95 < 50ms tren moi truong test.
