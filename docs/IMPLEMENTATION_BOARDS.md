# Implementation Boards (Chi tiet de trien khai)

Huong dan dung nhanh:
- Moi board tuong ung 1 sprint.
- Cap nhat cot Status theo: Todo, In Progress, Review, Done, Blocked.
- Owner de xuat theo vai tro: BE, FE, QA, DevOps.
- Van hanh theo template: docs/WEEKLY_EXECUTION_TEMPLATE.md
- Danh sach uu tien Sprint 7: docs/SPRINT7_P0_P1_BACKLOG.md

## Board A - Sprint 7: Domain Alignment va API Contract

### Epic A1 - Chuan hoa Domain Model
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| A1-1 | Audit schema hien tai | Liet ke mismatch giua models, migration, command, serializer | BE | 1d | None | Co bao cao mismatch + huong xu ly | Todo |
| A1-2 | Chot schema muc tieu | Chot field/constraint cho SubAccount, Transaction, Snapshot, Watchlist | BE | 1d | A1-1 | ADR schema duoc review | Todo |
| A1-3 | Migration ke thua | Tao migration khong mat du lieu, co rollback | BE | 2d | A1-2 | Migrate len/xuong tren DB local pass | Todo |
| A1-4 | Data repair script | Viet command fix du lieu cu neu field sai | BE | 1d | A1-3 | Chay tren ban sao DB va pass | Todo |

### Epic A2 - API Contract va Route Consistency
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| A2-1 | Chuan hoa route stock management | Chot naming /api/stock-management/* va deprecate route cu | BE | 1d | A1-2 | Bang mapping old->new day du | Todo |
| A2-2 | OpenAPI spec | Viet schema request/response/error cho module Portfolio + Stock | BE | 1.5d | A2-1 | File OpenAPI review xong | Todo |
| A2-3 | Frontend API map | Dong bo frontend service theo contract moi | FE | 1.5d | A2-2 | Khong con endpoint 404 do lech route | Todo |
| A2-4 | Contract tests | Viet test cho endpoint critical | QA/BE | 2d | A2-2 | Test pass tren CI local | Todo |

## Board B - Sprint 8: Portfolio Engine v2 va Margin

### Epic B1 - Financial Accuracy
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B1-1 | Weighted average cost chuẩn | Xu ly BUY/SELL/DIVIDEND + fee + sell over-quantity | BE | 2d | A1-3 | 100% test case cost basis pass | Todo |
| B1-2 | Holdings engine | Chuan hoa holdings theo sub-account va portfolio | BE | 1.5d | B1-1 | API holdings dung voi fixture mau | Todo |
| B1-3 | NAV va P/L | Tinh NAV theo sub-account, tong hop portfolio | BE | 1.5d | B1-2 | Sai lech NAV < 0.1% | Todo |

### Epic B2 - Margin va Snapshot
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| B2-1 | Margin policy | Them buying power, margin ratio, canh bao nguong | BE | 2d | B1-2 | Co API tra canh bao margin | Todo |
| B2-2 | Snapshot 15:30 | Tao job tao AccountSnapshot moi ngay | BE/DevOps | 1.5d | B1-3 | Snapshot tao dung lich tren local test | Todo |
| B2-3 | UI summary update | Hien thi NAV tong + metric margin tren dashboard | FE | 1d | B2-1 | UI khong vo bo cuc, co loading state | Todo |

## Board C - Sprint 10: Realtime Event-Driven Foundation

### Epic C1 - Worker + Publish
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| C1-1 | Redis key design | Thiet ke key, ttl, namespace theo user/symbol | BE | 0.5d | A2-1 | Tai lieu key schema duoc chot | Todo |
| C1-2 | Celery periodic tasks | Poll intraday 5-10s cho tracked symbols | BE/DevOps | 2d | C1-1 | Worker chay on dinh 1h khong rot task | Todo |
| C1-3 | Rotating proxy layer | Tich hop proxy rotation cho collector jobs | DevOps/BE | 1d | C1-2 | Proxy healthcheck + failover pass | Todo |
| C1-4 | Retry/backoff | Them retry, timeout, circuit breaker nguon du lieu | BE | 1d | C1-2 | Log co reason khi fail va tu recover | Todo |
| C1-5 | Pandas intraday compute | Tinh VWAP va whale flag theo threshold user | BE | 1.5d | C1-2 | Ket qua compute dung theo fixture | Todo |
| C1-6 | Redis Pub/Sub publish | Publish su kien ticker/whale vao Redis channels | BE | 1d | C1-5 | Message schema duoc consume dung | Todo |

### Epic C2 - Channels + WebSocket + FE Realtime
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| C2-1 | Django Channels setup | Cau hinh ASGI, routing, consumer cho watchlist channels | BE | 1.5d | C1-6 | WebSocket handshake pass | Todo |
| C2-2 | Redis subscriber bridge | Channels consume message tu Redis Pub/Sub | BE | 1d | C2-1 | Push message den client dang subscribe | Todo |
| C2-3 | FE websocket client | FE subscribe ticker/alert channels theo watchlist | FE | 1d | C2-2 | UI update khong can polling | Todo |
| C2-4 | Fallback UX | Neu websocket loi, fallback sang polling API | FE | 0.5d | C2-3 | UI khong bi trang trong | Todo |
| C2-5 | Telegram notifier | Push whale alerts sang Telegram Bot | BE | 1d | C1-6 | Alert gui thanh cong theo threshold | Todo |

## Board D - Sprint 12 va 13: Screener + Robo-Advisor

### Epic D1 - Screener JSON Engine
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| D1-1 | Rule DSL schema | Dinh nghia JSON schema cho dieu kien RSI/MA/Volume | BE | 1d | A2-2 | Validate schema pass | Todo |
| D1-2 | Rule parser | Parse + validate + message loi than thien | BE | 1.5d | D1-1 | Sai rule tra loi ro rang | Todo |
| D1-3 | Rule evaluator | Chay evaluator tren Pandas cho tap symbol | BE | 2d | D1-2 | Ket qua dung voi bo test mau | Todo |
| D1-4 | Screener UI builder | Form tao rule va preview ket qua | FE | 2d | D1-1 | Co luu rule va chay scan | Todo |

### Epic D2 - Robo-Advisor Rule-based
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| D2-1 | Scoring framework | Cong thuc trend/momentum/volume/risk | BE | 1.5d | D1-3 | Co score va confidence | Todo |
| D2-2 | ATR risk bands | Tinh Entry/SL/TP tu ATR va risk profile | BE | 1d | D2-1 | API tra du 3 moc gia | Todo |
| D2-3 | Explainability payload | Tra ly do khuyen nghi de user tin cay | BE | 1d | D2-1 | Moi signal co explanation | Todo |
| D2-4 | Advisor UI | Hien thi khuyen nghi + canh bao rui ro | FE | 1.5d | D2-3 | UX ro rang, co disclaimer | Todo |
| D2-5 | Backtest engine | Simulate giao dich tu rule JSON tren 3-5 nam du lieu | BE | 2d | D1-3 | Backtest tra danh sach lenh da dong | Todo |
| D2-6 | Backtest metrics | Tinh Win Rate, Profit Factor, Max Drawdown | BE | 1d | D2-5 | Metric dung voi bo test fixture | Todo |
| D2-7 | Backtest report API/UI | API va UI hien thi ket qua backtest va explanation | BE/FE | 1.5d | D2-6 | User xem duoc report va luu lich su | Todo |

## Board E - Sprint 14: Production Hardening

### Epic E1 - Quality, Security, Operations
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| E1-1 | Test strategy | Unit + integration + contract + smoke | QA/BE/FE | 2d | A2-4 | Co report coverage va test matrix | Todo |
| E1-2 | Observability | Structured logs + metric + alerts | DevOps/BE | 1.5d | C2-1 | Co dashboard canh bao loi chinh | Todo |
| E1-3 | Security checklist | Permission matrix, token policy, rate limit | BE | 1d | A2-2 | Security checklist signed off | Todo |
| E1-4 | CI/CD release flow | Build, migrate, smoke, rollback | DevOps | 2d | E1-1 | Chay duoc 1 lan release thu nghiem | Todo |

## Nghi le quan tri board
- Daily: update status va blocker truoc 10:00.
- Weekly: review KPI sprint va dieu chinh estimate.
- Rule block: task > 2 ngay bi Blocked phai co owner giai quyet ro rang.

## Board F - Feature Expansion Backlog (sau dot review)

### Epic F1 - Realtime Value va Alerts
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| F1-1 | Shared realtime hook | Tao `useRealtimeFeed` dung chung cho Watchlist + Dashboard | FE | 2d | Sprint 12 current UI | Watchlist/Dashboard dung chung mot layer realtime | Done |
| F1-2 | Realtime portfolio value | Tinh NAV/P-L gan realtime tu ticker cache | BE/FE | 2d | F1-1, holdings engine | Dashboard hien thi NAV/P-L co stale state | Done |
| F1-3 | Price alerts | CRUD alert rule + evaluator + cooldown | BE/FE | 2d | F1-1 | Tao va nhan alert `above/below` khong spam | Done |
| F1-4 | Scheduled sync tracked symbols | Celery Beat sync cho tracked/watchlist symbols | BE/DevOps | 1.5d | realtime jobs | Job chay dinh ky va co retry/log | Done |

### Epic F2 - Analytics nang cao
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| F2-1 | Performance metrics | Them MDD, Sharpe, Sortino, Alpha/Beta, TWR | BE | 2d | analytics core | API metric pass voi fixture | Todo |
| F2-2 | Allocation analysis | Sector/industry + market-cap allocation | BE/FE | 1.5d | StockProfile, SecuritiesGroup | UI/API hien thi phan bo va tong hop dung | Todo |
| F2-3 | Risk metrics | HHI, VaR, stress test co ban | BE | 2d | F2-1 | Tra duoc metric rui ro va explanation | Todo |

### Epic F3 - Screener va Admin Operations
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| F3-1 | Pre-built screeners | Tao bo loc mau tang truong/gia tri/co tuc/breakout | BE/FE | 1.5d | ScreenerRule CRUD | User co the chon va chay bo loc mau | Todo |
| F3-2 | Screener indicators | Them RSI, MACD, MA cross, volume breakout | BE | 2d | Screener DSL | Parser/evaluator ho tro rule moi | Todo |
| F3-3 | Admin operations dashboard | Tong quan task failures, sync status, realtime mode, quick links | BE/FE | 1.5d | Admin home current | Admin home co them panel van hanh | Todo |

### Epic F4 - Long-term external integrations
| ID | Story | Task chi tiet | Owner | Estimate | Phu thuoc | DoD | Status |
|---|---|---|---|---|---|---|---|
| F4-1 | News/events feed | Tich hop tin tuc va su kien doanh nghiep theo symbol | BE/FE | 3d | data source | Co feed theo symbol va anti-spam co ban | Proposed |
| F4-2 | Broker integration | Dong bo giao dich/so du tu broker neu co API | BE/DevOps | 5d+ | doi tac ngoai | Co PoC ket noi 1 broker | Proposed |
| F4-3 | Order book data | Hien thi market depth realtime neu co du lieu | BE/FE | 4d+ | data vendor | Co panel DOM cho 1 symbol | Proposed |
