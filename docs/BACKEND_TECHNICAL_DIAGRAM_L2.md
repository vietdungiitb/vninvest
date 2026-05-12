# Backend Technical Diagram - Level 2

Tai lieu nay luu so do ky thuat muc 2 de tai su dung cho:
- Thiet ke he thong
- Onboarding thanh vien moi
- Review scope Sprint 7-14
- Truyen thong giua BE/FE/QA/DevOps

## 1) So do thanh phan muc 2 (Container + Service decomposition)

```mermaid
flowchart TB
    U[React Frontend] -->|JWT API Calls| G[Django URL Router]

    subgraph API[API Layer - Django DRF]
        G --> A1[Auth API\nToken Obtain/Refresh]
        G --> A2[Portfolio API\nPortfolio/SubAccount/Transaction]
        G --> A3[Analytics API\nHoldings/Summary/Allocation/Chart]
        G --> A4[Stock Management API\nstock-management/*]
        G --> A5[Realtime API\nrealtime/ticker/*]
        G --> A6[Admin/Sync API\nsync-stockprofile]
    end

    subgraph CORE[Core Domain + Compute]
        A2 --> D1[Portfolio Service]
        A3 --> D2[Pandas Analytics Engine]
        A4 --> D3[Market Data Service]
        A5 --> D4[Realtime Read Service]
        A6 --> D5[Sync Orchestrator]
    end

    subgraph DATA[Data Layer]
        DB[(PostgreSQL/SQLite)]
        RC[(Redis Cache)]
    end

    subgraph BG[Background Processing]
        C1[Celery Beat Scheduler]
        C2[Celery Worker\nIntraday Polling 5-10s]
        C3[Batch Worker\nEOD Sync + Snapshot 15:30]
        MKT[vnbroker Provider]
    end

    D1 <--> DB
    D2 <--> DB
    D3 <--> DB
    D4 <--> RC
    D5 <--> DB

    C1 --> C2
    C1 --> C3
    C2 --> MKT
    C2 --> D2
    C2 --> RC
    C3 --> MKT
    C3 --> DB

    A3 -->|fallback when realtime unavailable| DB
    A5 --> RC
```

## 2) So do luong nghiep vu muc 2 (Realtime intraday)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend Polling (5s)
    participant API as Django Realtime API
    participant R as Redis
    participant WB as Celery Worker
    participant VS as vnbroker
    participant PE as Pandas Engine

    rect rgb(240,248,255)
    Note over WB,VS: Background loop every 5-10s
    WB->>VS: Fetch intraday ticks/orderbook
    VS-->>WB: DataFrame payload
    WB->>PE: Compute VWAP + whale filter
    PE-->>WB: enriched metrics
    WB->>R: Upsert cache keys with TTL
    end

    FE->>API: GET /api/realtime/ticker/{symbol}
    API->>R: Read latest cached payload
    R-->>API: current_price, vwap, whale_signals
    API-->>FE: JSON response (<50ms target)

    alt Cache miss / stale
      API-->>FE: fallback flag + stale payload
      FE->>API: optional fallback EOD endpoint
    end
```

## 3) Phan ra module backend (Level 2)

1. Authentication Module
- JWT issue/refresh
- Permission enforcement (IsAuthenticated, role-based extension)

2. Portfolio Domain Module
- Portfolio/SubAccount/Transaction CRUD
- UserConfig (theme, whale threshold)
- AccountSnapshot generation

3. Analytics Engine Module
- Weighted average cost
- Holdings and unrealized/realized P/L
- NAV/Allocation/Chart series

4. Market Data Module
- StockProfile sync
- DailyPrice EOD sync
- Securities groups and tracked symbols

5. Realtime Module
- Intraday collector worker
- Redis key-value cache for low-latency serving
- Whale tracking and VWAP metrics

6. Screener and Advisor Module (target)
- JSON rule parser/evaluator
- Technical signal scoring
- Entry/SL/TP recommendation by ATR

## 4) Redis key schema de xuat (Level 2 detail)

- realtime:ticker:{symbol}
- realtime:user:{user_id}:watchlist
- realtime:alerts:{user_id}
- meta:sync:last_success

TTL de xuat:
- Intraday ticker payload: 20-40s
- Alert queue snapshot: 60-120s
- Last success marker: den cuoi ngay giao dich

## 5) API namespace mapping hien tai va muc tieu

Hien tai:
- /api/auth/*
- /api/* (portfolio urls)
- /api/stock-management/*
- /api/sync-stockprofile/

Muc tieu sau chuan hoa:
- /api/auth/*
- /api/portfolio/*
- /api/stock-management/*
- /api/realtime/*
- /api/admin-sync/* (hoac gom vao stock-management/sync)

## 6) Kiem soat chat luong cho so do muc 2

- p95 latency Realtime API < 50ms
- p95 latency Portfolio summary < 200ms
- Worker success rate > 99% trong gio giao dich
- 0 endpoint mismatch giua frontend va backend sau Sprint 7
