# Whale Alerts Professionalization Roadmap

Ngay: 2026-04-10
Pham vi: Toan bo tinh nang `/whale-alerts`, bao gom Whale Alerts Hub, Symbol Dashboard, aggregate feed, realtime alerting, advisory workflows, va lien ket dark money/reversal
Muc tieu: Nang cap tinh nang tu muc dashboard mid-tier thanh mot workspace whale intelligence phu hop voi cac giai phap chuyen nghiep

## 1. Executive Summary

Tinh nang `/whale-alerts` hien tai da tot hon mot bang dashboard thong thuong:

- Co aggregate feed cho tracked/watchlist scope.
- Co symbol-level dashboard voi feed, donut, bubble chart, RVOL, depth, order-flow radar.
- Co advisory flow rieng cho Pro/Premium.
- Co realtime WebSocket ket hop REST snapshot fallback.

Tuy nhien, neu so voi cac giai phap chuyen nghiep tren thi truong, he thong hien van dang o muc `good product foundation`, chua dat muc `professional intelligence workspace`.

Khoang cach lon nhat khong nam o giao dien, ma nam o 5 lop sau:

1. Detection intelligence
2. Event model va semantic grouping
3. Workflow orchestration cho trader/researcher
4. Explainability va trust layer
5. Operational consistency va observability

## 2. Product Scope Thuc Te Cua /whale-alerts

`/whale-alerts` khong chi la danh sach "whale alerts gan nhat". No la mot workspace co 3 tang:

### Tang A - Market Radar / Aggregate Feed

- Aggregate whale signals theo tracked symbols hoac watchlist group
- Sort theo time hoac matched value
- Source fallback: Redis stream -> IntradayTick DB -> vnstock
- Severity / score / threshold / source hien thi tren card

### Tang B - Symbol Investigation Workspace

- Symbol detail dashboard voi:
  - large-order feed
  - money flow donut
  - bubble distribution
  - RVOL
  - depth chart
  - dark money / order flow radar

### Tang C - Decision Support / Advisory

- AI summary
- AI deep detail
- advisory refresh
- reversal advisory
- merged sources / primary source
- explainability / checklist / freshness / trust telemetry

Neu muc tieu la nang cap triệt de, can xem `/whale-alerts` la mot `whale intelligence platform surface`, khong phai mot page feed.

## 3. Current State Assessment

### 3.1 Diem manh hien tai

#### Kien truc feed

- Co realtime event va co snapshot fallback de giam event loss.
- Aggregate API da co contract sort/cursor kha ro.
- Event payload da co `event_score`, `display_score`, `severity`, `size_class`, `source`.

#### Truc quan hoa theo symbol

- Whale detail page da vuot muc "list alert" va co kha nang dieu tra theo symbol.
- Da co su ket hop whale matched orders + order flow + depth + RVOL.

#### AI integration

- Advisory khong tach roi ma da gan voi whale signal workflow.
- Da co merged trigger model, reversal advisory, va trust/explainability components.

#### User scoping

- Feed aggregate ton trong tracked symbols/watchlist scopes.
- Whale threshold da co mo hinh user default + symbol override o mot so path.

### 3.2 Han che hien tai

#### Detection con mong

- Whale alert hien van chu yeu la matched_value vuot threshold.
- Chua co abnormality layer manh: ADV-relative, session percentile, participation rate, liquidity context.

#### Event semantics con tho

- He thong dang alert tung event rieng le nhieu hon la alert mot campaign/cohort.
- Chua co grouping thanh cac pattern nhung nha dau tu chuyen nghiep thuong can:
  - accumulation wave
  - sell program
  - breakout confirmation flow
  - distribution campaign

#### Workflow chua toi uu cho persona chuyen nghiep

- Chua co watch mode / triage queue / pinned symbols / explain-then-investigate flow.
- Chua co search, replay, compare sessions, saved filters, alert rules builder.

#### Trust layer chua day du

- User thay severity va score, nhung chua duoc giai thich ro alert nay bat thuong den muc nao so voi lich su/thi truong.
- Chua co confidence decomposition theo data quality, source freshness, anomaly confidence.

#### Operational consistency

- Audit da chi ra threshold override chua di xuyen suot moi path.
- Dark money co mot so logic chua on dinh theo market-time semantics.

## 4. Benchmark Against Professional Solutions

### 4.1 Nhom giai phap tham chieu

Nhom benchmark nen dung:

- Bookmap / Quantower / Sierra-style order flow workspaces
- Unusual Whales / FlowAlgo / Cheddar Flow style alert intelligence
- Institutional market surveillance / microstructure dashboards noi bo

### 4.2 Cac nang luc mot giai phap chuyen nghiep thuong co

#### Detection

- Notional threshold
- Relative abnormality vs normal flow
- Sweep / cluster / campaign recognition
- Auction/open-close context
- Liquidity / order book interaction
- Multi-timeframe classification

#### Event model

- Raw event
- Normalized event
- Grouped campaign
- Confirmed narrative
- Analyst/trader action suggestion

#### Workflow

- Live tape
- Investigate queue
- Saved filters
- Replay / history
- Link toi related symbols / sector / watchlist

#### Explainability

- Why this matters now
- Why this is unusual
- How reliable the alert is
- What to check next

#### Ops

- Clear observability
- deterministic dedup
- latency/freshness SLA
- source quality markers

### 4.3 Khoang cach cua du an hien tai

#### Dang co

- Realtime + fallback
- threshold + score + severity
- symbol dashboard
- AI advisory

#### Chua co / con yeu

- Event grouping / campaign engine
- advanced anomaly modeling
- professional triage workflow
- replay / history-first investigation
- analyst-grade filtering and saved views
- confidence / trust decomposition
- full consistency across thresholds and event semantics

## 5. Target State Product Vision

Muc tieu nen la:

> Whale Alerts tro thanh mot workspace intelligence gom 3 lop: discover -> investigate -> decide.

### 5.1 Discover

User thay duoc ngay:

- ma nao dang co dong tien bat thuong
- alert nao dang la campaign thay vi event don le
- muc do bat thuong so voi binh thuong cua chinh ma do
- do tuoi cua du lieu va muc do tin cay

### 5.2 Investigate

User co the di sau vao:

- whale tape theo session/timeframe
- dark money / order flow context
- depth / liquidity context
- lich su 5 ngay, 20 ngay, 60 ngay
- sector-relative flow va related symbols

### 5.3 Decide

User nhan duoc:

- AI summary co context
- action checklist
- risk mode mapping
- confidence / trust signal
- phan biet alert chi de watch hay alert xung dang nang cap thanh trade candidate

## 6. Strategic Pillars for Professionalization

### Pillar P1 - Detection Intelligence Layer

Muc tieu: nang cap tu threshold engine thanh anomaly engine.

Can co them:

- ADV-relative threshold
- Session percentile threshold
- Relative trade size vs symbol baseline
- Liquidity-aware threshold
- Time-of-day normalization
- Distinguish block trade vs actionable whale aggression

Output moi de xuat:

- `absolute_notional_score`
- `relative_abnormality_score`
- `session_impact_score`
- `liquidity_stress_score`
- `actionability_score`

### Pillar P2 - Event Semantics & Grouping Layer

Muc tieu: giam noise, tang nghia nghiep vu.

Can co them:

- grouping event theo symbol + side + window
- campaign labels:
  - accumulation_wave
  - distribution_wave
  - breakout_support
  - breakdown_pressure
  - close_ramp
  - exit_block
- raw event va grouped event song song

Output moi de xuat:

- `campaign_id`
- `campaign_type`
- `campaign_strength`
- `campaign_duration_seconds`
- `campaign_event_count`

### Pillar P3 - Professional Workflow UX

Muc tieu: chuyen tu board hien thi thanh workspace thao tac.

Can co them:

- triage queue view
- pinned symbols
- saved filters
- quick scope switch: holdings / tracked / watchlist / sector / custom basket
- session window filter: 5m / 15m / 1h / session / multi-day
- action states: watch / investigate / candidate / ignore

### Pillar P4 - Explainability & Trust Layer

Muc tieu: user biet vi sao he thong danh gia alert nay quan trong.

Can co them:

- confidence decomposition
- source freshness badge
- recovery-vs-live marker
- comparison to symbol baseline
- "what to check next" suggestions

Output moi de xuat:

- `confidence_breakdown`
- `freshness_bucket`
- `source_quality`
- `why_triggered`
- `next_checks`

### Pillar P5 - Advisory Orchestration Layer

Muc tieu: advisory khong phai lop rieng, ma la mot ket qua cua intelligence workflow.

Can co them:

- advisory generation theo grouped campaign thay vi event raw don le
- advisory policy theo risk mode
- event-type aware prompting:
  - whale only
  - dark flow only
  - merged whale + dark flow
  - reversal
- action checklist phu hop voi confidence va regime

### Pillar P6 - Reliability & Observability Layer

Muc tieu: tinh nang dat muc production-grade, co the do va cai tien duoc.

Can co them:

- event freshness SLA
- per-source coverage metric
- dedup hit ratio
- snapshot recovery ratio
- alert precision proxy
- click-through / engagement / conversion funnel

## 7. Recommended Product Architecture Evolution

### 7.1 Event Model de xuat

Nen tien toi 4 cap event:

1. RawWhaleTradeEvent
2. WhaleSignalEvent
3. WhaleCampaign
4. WhaleDecisionInsight

Y nghia:

- RawWhaleTradeEvent: tick/block vuot nguong
- WhaleSignalEvent: event da duoc scoring/chuan hoa
- WhaleCampaign: nhom event co y nghia theo thoi gian
- WhaleDecisionInsight: tong hop cho UI/advisory

### 7.2 API Surface de xuat

Can bo sung / doi chinh:

- `GET /api/realtime/whale-feed/aggregate/?window=5m|15m|1h|session|5d`
- `GET /api/realtime/whale-campaigns/`
- `GET /api/realtime/whale-symbol-summary/<symbol>/`
- `GET /api/portfolio/whale-history/?symbol=XXX&days=30`
- `GET /api/portfolio/whale-investigation/<symbol>/`
- `POST /api/realtime/whale-saved-filter/`
- `POST /api/realtime/whale-triage-action/`

### 7.3 Frontend Surface de xuat

`/whale-alerts` nen duoc to chuc thanh 4 tabs hoac 4 workspace sections:

1. Live Tape
2. Campaigns
3. Investigation Queue
4. Advisory & Outcomes

## 8. Gap-to-Action Matrix

### G1 - Feed dang tot nhung chua phan cap theo nghia

Van de:

- aggregate feed hien dang la list event, chua la list campaign

Hanh dong:

- them campaign engine
- ui tach raw feed va grouped feed

### G2 - Threshold engine chua du thong minh

Van de:

- block trade lon nhung khong y nghia van co the len top card

Hanh dong:

- abnormality score theo symbol/session/liquidity

### G3 - Advisory chua dung nguyen lieu intelligence day du

Van de:

- advisory dang noi gan voi event/merge, chua dua tren campaign va confidence decomposition

Hanh dong:

- generate advisory tu campaign summaries

### G4 - Workflow nghien cuu chua day du

Van de:

- chua co replay / history / saved filters / triage queue

Hanh dong:

- tao investigative workflow hoan chinh

### G5 - Trust layer chua du ky luat

Van de:

- severity va score da co, nhung chua du de user tin va hanh dong nhanh

Hanh dong:

- bo sung confidence_breakdown va source_quality markers

## 9. Phased Roadmap

## Phase 0 - Reliability & Consistency Hardening

Muc tieu:

- sua cac diem mat niem tin truoc khi them tinh nang moi

Workstreams:

### BE

- fix per-symbol threshold consistency end-to-end
- fix market-time consistency cho dark money/order flow
- unify event timestamp/source/config metadata
- add deterministic tests cho realtime + aggregate + advisory paths

### FE

- mark ro live alert vs recovered snapshot alert
- hien threshold source neu co symbol override
- hien source freshness marker

### QA/Ops

- alert freshness baseline
- snapshot recovery ratio baseline
- dedup ratio baseline

DoD:

- user config threshold khong con sai lech giua cac surfaces
- dark money semantics on dinh theo gio thi truong
- co dashboard metric cho freshness / fallback / dedup

## Phase 1 - Professional Feed & Campaign Intelligence

Muc tieu:

- nang cap /whale-alerts hub thanh market-intel board that su

### BE

- add window filter cho aggregate feed
- add campaign grouping service
- add whale symbol summary endpoint
- add abnormality scoring layer

### FE

- them tab `Live Tape` va `Campaigns`
- filters: side, severity, source, freshness, window, scope
- pin symbols / quick investigate

### KPI

- p95 aggregate response trong muc chap nhan voi window filters
- alert CTR tang so voi baseline
- giam so event raw user bo qua

## Phase 2 - Investigation Workspace

Muc tieu:

- bien whale symbol dashboard thanh noi dieu tra hoan chinh

### BE

- whale history endpoint
- session compare endpoint
- investigation summary endpoint
- related symbols / sector flow context

### FE

- tab timeline lich su
- compare sessions
- timeline whale + dark flow + reversal chung
- trust/explainability decomposition panel

### KPI

- time-to-investigate giam
- tang luot mo symbol dashboard tu feed

## Phase 3 - Decision Engine & Advisory Upgrade

Muc tieu:

- advisory tro thanh lop ra quyet dinh tren campaign intelligence

### BE

- campaign-based advisory generation
- event-type aware prompting
- win-rate / outcome tracking
- rule-based actionability score

### FE

- triage queue
- candidate board
- outcome badges
- manual note / analyst feedback loop

### KPI

- tang engagement voi advisory
- giam refresh vo nghia
- co feedback loop cho advisor quality

## Phase 4 - Professional Platform Features

Muc tieu:

- tiem can terminal-grade workflow

Can xem xet:

- saved filters
- custom baskets
- replay
- strategy-style alert builder
- sector rotation whale monitor
- mobile companion surface

## 10. Concrete PR Slices

### PR-1 Reliability & semantics

- threshold override end-to-end
- source/freshness markers
- tests + observability

### PR-2 Aggregate feed v2

- window filters
- source quality markers
- FE filter bar

### PR-3 Campaign engine backend

- campaign grouping model/service
- campaign API

### PR-4 Whale hub FE v2

- tabs: Live Tape / Campaigns
- pin + triage actions

### PR-5 Symbol investigation API pack

- whale history
- symbol summary
- session compare

### PR-6 Symbol dashboard FE v2

- history timeline
- campaign context
- unified whale + dark flow timeline

### PR-7 Advisory engine v2

- campaign-based advisory
- confidence decomposition
- improved checklist

### PR-8 Outcomes & feedback loop

- advisory outcome tracking
- win rate / usefulness badges

## 11. KPI & Success Metrics

Nen do 3 lop KPI:

### Product KPI

- CTR tu whale hub -> symbol dashboard
- time-on-workspace
- pinned symbol rate
- advisory open rate

### Intelligence KPI

- alert usefulness proxy
- campaign precision proxy
- false-positive review sample
- actionability score distribution

### Reliability KPI

- alert freshness median
- snapshot recovery ratio
- dedup hit ratio
- p95 aggregate latency
- p95 symbol dashboard latency

## 12. Risks & Dependencies

### Du lieu

- vnstock intraday quality va continuity la dependency lon
- can ro retention policy cua IntradayTick de phuc vu history/replay

### Hieu nang

- campaign grouping va multi-window aggregate can toi uu DB/cache

### Nghiệp vu

- threshold va anomaly model phai duoc calibrate theo dac thu thi truong VN

### UX

- neu them qua nhieu filter/trust chips ma khong co hierarchy se gay qua tai thong tin

## 13. Recommendation Uu Tien Cao Nhat

Neu chi duoc chon 5 viec de bat dau ngay, nen lam theo thu tu nay:

1. Fix consistency va trust issues hien co.
2. Them window filter + abnormality score cho aggregate feed.
3. Tao campaign engine va campaign board.
4. Nang cap symbol dashboard thanh investigation timeline.
5. Chuyen advisory sang campaign-based decision support.

## 14. Hanh Dong Tiep Theo De Xuat

Sau tai lieu nay, nen tao tiep 3 artefacts thuc thi:

1. Sprint backlog chi tiet cho Phase 0 va Phase 1
2. API/data contract v2 cho whale events va campaigns
3. FE wireframe spec cho Whale Hub v2 va Symbol Investigation v2

## 15. Tai Lieu Lien Quan

- docs/AUDIT_WHALE_DARK_MONEY_20260410.md
- docs/WHALE_ALERTS_PHASE0_PHASE1_EXECUTION_PLAN_20260410.md
- docs/WHALE_ALERTS_API_CONTRACT_V2_DRAFT_20260410.md
- docs/FEATURE_EXPANSION_BACKLOG.md
- docs/ROADMAP_2026Q2_2026Q4.md
- docs/IMPLEMENTATION_BOARDS.md
