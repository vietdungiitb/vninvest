# Audit Chuyen Sau Dark Money Flow (2026-04-10)

Pham vi audit:
- Dark money detection (order flow)
- Whale alert realtime va aggregate feed
- Advisory merge/generation lien quan dark_flow + whale_alert
- Do bao phu test cho cac nhanh logic tren

## Executive Summary

He thong da co khung pipeline kha day du (detect -> store -> websocket -> merge -> advisory).
Tuy nhien, hien tai ton tai 4 rui ro can uu tien, trong do co 2 rui ro muc do High:

1. Dark flow advisory dang bi "lam phang" severity do matched_value bi gan bang threshold thay vi bien do su kien thuc te.
2. Aggregate cursor cho stream/vnbroker co nguy co phan trang khong on dinh do id synthetic thay doi theo moi request.
3. Realtime whale detection co the phat duplicate event cho cung mot trade khi runtime config co nhieu threshold.
4. Realtime threshold helper chua dung chinh sach fallback an toan va chua support symbol override cho user-specific publish.

## Findings

### F1 - High - Dark flow severity bi flatten (mat do phan biet muc do su kien)

Bang chung code:
- backend/portfolio/tasks.py:1454 set matched_value_vnd = threshold_vnd cho source dark_flow.
- backend/portfolio/tasks.py:309 tinh severity dua tren ratio matched_value_vnd / threshold.
- backend/portfolio/tasks.py:940 generate_whale_advisory_task su dung _compute_advisory_severity neu khong co override.

Tac dong:
- Nhieu dark_flow event manh/yeu deu co ratio ~1x => severity thuong roi vao info.
- Advisory downstream khong phan biet du do manh yeu cua dark_flow, giam gia tri ra quyet dinh.

De xuat nang cap:
- Tach severity mapper rieng cho dark_flow, dua tren strength + confidence + cvd_change.
- Khong dung threshold ratio cua whale matched order cho dark_flow.
- Luu them truong "signal_strength"/"signal_weight" vao merge metadata de truy vet.

### F2 - High - Cursor aggregate khong on dinh voi stream/vnbroker records

Bang chung code:
- backend/portfolio/market_data_service.py:2172 tao stream records voi synthetic_id bat dau tu 1 moi request.
- backend/portfolio/market_data_service.py:2206 tao vnbroker records voi synthetic_id bat dau tu 1 moi request.
- backend/portfolio/market_data_service.py:2297 va backend/portfolio/market_data_service.py:2339 dung id lam tie-breaker/cursor.

Tac dong:
- next_cursor cua page truoc co the khong tuong thich voi page sau neu id synthetic bi tao lai.
- Nguy co duplicate/missing event khi client phan trang trong nguon redis_stream/vnbroker.

De xuat nang cap:
- Dung event_id deterministic (symbol + ts + side + matched_value) thay cho synthetic_id trong cursor.
- Hoac bo tie-breaker id synthetic, thay bang hash key on dinh.
- Bo sung regression test cho pagination stream source va vnbroker source.

### F3 - Medium - Co the emit duplicate whale events tren cung mot trade

Bang chung code:
- backend/portfolio/services.py:533 build runtime thresholds tu shark_threshold + whale_threshold (co the >1 threshold).
- backend/portfolio/realtime/compute.py:120-145 detect_whale_signals append event cho moi threshold ma trade vuot.
- backend/portfolio/realtime/compute.py:36 event_id bao gom threshold nen dedup khong loai duoc duplicate theo trade.

Tac dong:
- Cung 1 trade lon co the phat 2 events (vuot whale va shark), tang nhieu noise feed.
- Merge/advisory co the nhan side_score du lieu lap, lam lech tong hop.

De xuat nang cap:
- Chon threshold cao nhat thoa dieu kien cho moi trade (single winner threshold).
- Hoac giu 1 event chinh + metadata ve all crossed thresholds, khong phat nhieu event.
- Bo sung test khang dinh 1 trade -> 1 event trong realtime publish path.

### F4 - Medium - Helper threshold realtime chua dung safe policy domain

Bang chung code:
- backend/portfolio/tasks.py:526-538 _whale_thresholds_for_user nhan float(config)*1_000_000 truc tiep.
- backend/portfolio/tasks.py:284 da co _resolve_advisory_threshold_vnd + resolve_user_whale_threshold_vnd an toan hon.

Tac dong:
- Neu gia tri threshold bat thuong (<=0, null edge), helper nay co the tra nguong khong an toan.
- User-specific realtime publish (neu dung user_id mode) chua xet symbol override nhu aggregate feed.

De xuat nang cap:
- Refactor _whale_thresholds_for_user dung resolve_user_whale_threshold_vnd.
- Bo sung support symbol override theo TrackedSymbol khi user_id mode.
- Dong bo chinh sach threshold giua realtime feed, aggregate feed, advisory.

## Test Coverage Gaps

Quan sat nhanh:
- Da co test cho advisory merge metadata va threshold_source (test_whale_advisory_task.py).
- Chua thay test rieng cho:
  - dark_flow severity mapping thong qua generate_whale_advisory_task.
  - aggregate pagination on stream/vnbroker khi co cursor.
  - duplicate threshold emission trong detect_whale_signals.

## Benchmark Quoc Te (Tom tat so sanh nang luc)

Muc dich phan nay la de quy doi ke hoach fix/nang cap theo nang luc ma cac nen tang lon tren the gioi dang lam tot.

### Nhom real-time unusual flow (FlowAlgo, Unusual Whales, BlackBoxStocks)
- Diem manh pho bien:
  - Phat hien dong tien bat thuong realtime.
  - Scoring muc do quan trong + giam nhieu alert.
- Khoang cach hien tai:
  - Dark flow severity mapper chua phan tang tot (F1).

### Nhom microstructure/pro desk (Bookmap, Jigsaw)
- Diem manh pho bien:
  - Absorption/iceberg context ro rang va co tinh giai thich cao.
  - Replay va campaign context de trader hieu chuoi hanh vi.
- Khoang cach hien tai:
  - Da co engine nen tang, nhung con thieu lop explainability va campaign-quality metadata.

### Nhom institutional data quality (Bloomberg, Refinitiv)
- Diem manh pho bien:
  - Contract on dinh, pagination tin cay, provenance ro rang.
- Khoang cach hien tai:
  - Cursor aggregate voi stream/vnbroker con nguy co khong on dinh (F2).

### Nhom retail decision UX (TradingView, Koyfin overlays)
- Diem manh pho bien:
  - Tin hieu duoc dat trong boi canh ra quyet dinh (why now, why this symbol, risk level).
- Khoang cach hien tai:
  - Alert/noise ratio va thong diep dark flow cho trader can duoc toi uu tiep.

## Ke Hoach Fix Loi + Nang Cap (3 pha)

### Pha 0 - Signal Integrity First (5-7 ngay)

Muc tieu: sua loi anh huong truc tiep den tinh dung/sai cua tin hieu.

1. Fix F1 - severity rieng cho dark_flow
- Cong viec:
  - Tao mapper rieng cho dark_flow dua tren strength, confidence, cvd_change, persistence.
  - Khong dung ratio matched_value/threshold cua whale cho dark_flow.
  - Luu them metadata can thiet de audit nguoc severity.
- Ket qua mong doi:
  - Severity distribution co do gian, khong bi don vao info.

2. Fix F2 - cursor deterministic cho aggregate stream/vnbroker
- Cong viec:
  - Thay synthetic id bang event key on dinh.
  - Chuan hoa next_cursor tie-breaker bang truong deterministic.
  - Regression test cho paging >= 3 trang lien tiep.
- Ket qua mong doi:
  - Giam duplicate/missing event khi phan trang.

3. Hardening regression tests
- Bo sung test cho:
  - dark_flow severity mapping -> advisory output.
  - stream/vnbroker cursor consistency.
  - single trade khong phat nhieu event do multi-threshold.

4. KPI pha 0 (go/no-go)
- Duplicate event rate < 1%.
- Pagination consistency > 99.9%.
- Ti le severity=info cua source dark_flow giam ve muc hop ly theo baseline pilot.

### Pha 1 - Signal Quality & Noise Reduction (2-3 tuan)

Muc tieu: nang chat luong tin hieu de trader dung duoc cho quyet dinh ngan han.

1. Fix F3 - single-event policy cho multi-threshold
- Cong viec:
  - Moi trade chi phat 1 event chinh (threshold cao nhat dat duoc).
  - Luu crossed_thresholds trong metadata, khong phat duplicate event.

2. Fix F4 - thong nhat threshold policy realtime/aggregate/advisory
- Cong viec:
  - Reuse resolver an toan cho tat ca luong.
  - Ho tro nhat quan symbol override trong user-specific publish.

3. Scoring v2 cho dark_flow/whale merge
- Cong viec:
  - Them thanh phan percentile, burst pattern, liquidity stress, side persistence.
  - Tinh confidence score chuan hoa 0-100.

4. KPI pha 1
- Alert ignore rate giam >= 25% (so voi baseline truoc pha 1).
- Precision top decile signal tang >= 20% tren tap symbol pilot.
- Ty le user mo advisory sau alert tang >= 15%.

### Pha 2 - Trader Intelligence Layer (4-6 tuan)

Muc tieu: bien tinh nang thanh cong cu ho tro quyet dinh that su, khong chi la feed su kien.

1. Explainability panel
- Hien ro ly do event: absorption, iceberg, tick-rate anomaly, cvd divergence.
- Hien dong gop score theo tung thanh phan.

2. Campaign intelligence
- Gom event thanh campaign (start, continuation, climax, fade).
- Hien market context: net flow, side dominance, reversal risk.

3. Portfolio-aware prioritization
- Uu tien signal lien quan ma trong danh muc/theo doi cua user.
- Them impact estimate cho trader (muc uu tien xu ly).

4. KPI pha 2
- Time-to-decision giam (do bang thao tac + survey trader).
- Ty le signal duoc action tang (watch -> entry/exit decision).
- User retention cua nhom dung whale/dark dashboard tang on dinh.

## Dinh Huong San Pham: Tam hoan AI, uu tien non-AI theo chuan quoc te

Quyet dinh cho giai doan hien tai:
- Khong mo rong AI.
- Tap trung hoan thien core signal, UX, va operation reliability de trader dung ngay lap tuc.

Ly do:
- Neu core chua on dinh, AI se khuech dai noise thay vi tao gia tri.
- Chuan quoc te uu tien tinh dung va tinh nhat quan truoc, sau do moi toi lop thong minh bo sung.

## Backlog Trien Khai Chi Tiet (non-AI, international-grade)

### Workstream A - Data Integrity & Contract Stability

1. A1 - Deterministic event identity
- Scope:
  - Chuan hoa event_id cho stream + vnbroker + db fallback.
  - Dung event key on dinh cho cursor tie-break.
- Acceptance criteria:
  - Paging 5 trang lien tiep khong duplicate/missing event.
  - Cursor replay trong 30 phut cho ket qua nhat quan.

2. A2 - Pagination contract v2
- Scope:
  - Chot contract response nhat quan giua moi source.
  - next_cursor null/khong-null phai dung theo has_more.
- Acceptance criteria:
  - Contract test pass cho redis_stream, intraday_tick_db, vnbroker.
  - Khong co field optional thay doi bat thuong giua 2 lan goi lien tiep.

3. A3 - Threshold policy unification
- Scope:
  - Mot bo resolver duy nhat cho realtime, aggregate, advisory.
  - Support nhat quan user_default/symbol_override.
- Acceptance criteria:
  - Cung 1 symbol + user => threshold giong nhau tren moi endpoint/luong.

### Workstream B - Signal Quality & Noise Control

1. B1 - Dark flow severity remap (khong dung AI)
- Scope:
  - Severity mapper rieng theo strength/confidence/cvd_change/persistence.
  - Metadata truy vet cho tai sao event duoc gan severity.
- Acceptance criteria:
  - Ti le dark_flow severity=info khong bi don bat thuong nhu baseline hien tai.
  - Kiem thu manual 30 event cho ket qua hop ly theo rulebook.

2. B2 - Single-event policy for multi-threshold
- Scope:
  - Moi trade chi tao 1 event chinh.
  - crossed_thresholds la metadata bo sung, khong push them event.
- Acceptance criteria:
  - events/trade ratio xap xi 1.0 tren tap pilot.
  - Duplicate suppression metric dat muc muc tieu.

3. B3 - Merge correctness hardening
- Scope:
  - Tranh over-count side score khi event den gan nhau.
  - Chot merge window va lock behavior theo config.
- Acceptance criteria:
  - Khong co truong hop merge state phinh score do duplicate source khong hop le.

### Workstream C - Trader UX (de su dung nhat)

1. C1 - Alert hierarchy and triage-first UI
- Scope:
  - Uu tien hien event theo severity + freshness + portfolio relevance.
  - Tinh nang "Top events now" cho 5-10 event quan trong nhat.
- Acceptance criteria:
  - Trader co the xac dinh 3 event quan trong nhat < 10 giay.

2. C2 - Explainability khong AI
- Scope:
  - Hien "Why this alert" bang rule-based evidence:
    - size class
    - threshold source
    - score breakdown
    - campaign context
- Acceptance criteria:
  - Moi event co it nhat 3 bang chung ro rang, khong text chung chung.

3. C3 - Action-centric flows
- Scope:
  - Tu alert den watch/add note/open chart trong 1-2 click.
  - Giam thao tac lap lai khi xu ly nhieu event lien tiep.
- Acceptance criteria:
  - Median click-to-action giam >= 30% tren user test nho.

4. C4 - Accessibility + readability standards
- Scope:
  - Contrast, font scale, state color coding, mobile compact mode.
  - Kha nang doc nhanh trong gio giao dich.
- Acceptance criteria:
  - Dat checklist UX co ban cho desktop va mobile.

### Workstream D - Reliability, Observability, Operations

1. D1 - SLO/SLA cho pipeline
- Scope:
  - Dinh nghia SLO:
    - ingest-to-alert latency
    - error rate
    - missing event rate
  - Dashboard theo dõi theo phien giao dich.
- Acceptance criteria:
  - Co canh bao som khi vi pham SLO, co runbook xu ly.

2. D2 - Canary rollout for scoring/rules
- Scope:
  - Rollout theo nhom symbol/user.
  - Co rollback nhanh khi metric xau.
- Acceptance criteria:
  - Rollback <= 5 phut, khong mat du lieu event.

3. D3 - Regression gate truoc release
- Scope:
  - Bat buoc pass bo test contract + paging + merge + dedup truoc deploy.
- Acceptance criteria:
  - Khong cho phep release neu fail 1 test gate bat buoc.

## Ke Hoach Thoi Gian De Xuat (6 tuan)

1. Tuan 1-2
- Hoan tat A1, A2, B1 (critical correctness).

2. Tuan 3-4
- Hoan tat A3, B2, B3, D3.

3. Tuan 5-6
- Hoan tat C1, C2, C3, C4, D1, D2.

## KPI Xac Nhan Tong The Sau 3 Pha

- Advisory severity distribution co do gian cho source=dark_flow (khong bi don vao info).
- Aggregate pagination khong duplicate/miss trong 3 trang lien tiep (stream source).
- Realtime whale events/trade ratio ve gan 1.0 trong sample symbols.
- So luot merge state bi over-count giam ro ret.
- Alert ignore rate giam, alert-to-action tang theo muc tieu pha 1.
- Time-to-decision va user retention cai thien theo muc tieu pha 2.

## Implementation Board (phan cong thuc thi)

Quy uoc role de phan cong nhanh:
- BE-Lead: backend lead
- FE-Lead: frontend lead
- QA-Lead: quality lead
- DevOps-Lead: platform/ops lead
- PM-Lead: product/project owner

### Bang task chi tiet

| ID | Workstream | Hang muc | Owner chinh | Phoi hop | Uoc luong | Dependency | Priority | Sprint/Tuan | Acceptance gate |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Data Integrity | Deterministic event identity | BE-Lead | QA-Lead | 3-4 ngay | none | P0 | Tuan 1 | Paging 5 trang khong duplicate/missing |
| A2 | Data Integrity | Pagination contract v2 | BE-Lead | QA-Lead, FE-Lead | 2-3 ngay | A1 | P0 | Tuan 1-2 | Contract test pass cho 3 source |
| B1 | Signal Quality | Dark flow severity remap | BE-Lead | QA-Lead, PM-Lead | 2-3 ngay | none | P0 | Tuan 1-2 | Severity distribution dat baseline moi |
| A3 | Data Integrity | Threshold policy unification | BE-Lead | FE-Lead, QA-Lead | 2 ngay | A2 | P1 | Tuan 3 | Cung user/symbol cho threshold nhat quan |
| B2 | Signal Quality | Single-event multi-threshold | BE-Lead | QA-Lead | 2-3 ngay | A1 | P1 | Tuan 3 | events/trade ratio xap xi 1.0 |
| B3 | Signal Quality | Merge correctness hardening | BE-Lead | QA-Lead | 2 ngay | B1, B2 | P1 | Tuan 4 | Khong over-count score trong merge window |
| D3 | Operations | Regression release gate | QA-Lead | BE-Lead, DevOps-Lead | 2 ngay | A2, B2, B3 | P1 | Tuan 4 | CI fail neu rot gate bat buoc |
| C1 | Trader UX | Alert hierarchy + top events | FE-Lead | BE-Lead, PM-Lead | 3 ngay | B1, B2 | P1 | Tuan 5 | Trader xac dinh top 3 event < 10s |
| C2 | Trader UX | Explainability panel (rule-based) | FE-Lead | BE-Lead, PM-Lead | 3-4 ngay | C1 | P1 | Tuan 5 | Moi event co >=3 evidence blocks |
| C3 | Trader UX | Action-centric flow 1-2 click | FE-Lead | PM-Lead, QA-Lead | 2-3 ngay | C1 | P2 | Tuan 5-6 | Median click-to-action giam >=30% |
| C4 | Trader UX | Accessibility/readability pass | FE-Lead | QA-Lead | 2 ngay | C1, C2 | P2 | Tuan 6 | Pass checklist desktop + mobile |
| D1 | Operations | SLO dashboard + alerts | DevOps-Lead | BE-Lead, QA-Lead | 3 ngay | A1, A2 | P1 | Tuan 6 | Co alert khi vuot latency/error budget |
| D2 | Operations | Canary + rollback <=5m | DevOps-Lead | BE-Lead | 2-3 ngay | D1 | P2 | Tuan 6 | Rollback test pass <= 5 phut |

### Gate theo tung moc

1. Gate M1 (cuoi Tuan 2)
- Bat buoc pass: A1, A2, B1.
- Neu truot M1: dung phat trien UI moi, uu tien sua correctness.

2. Gate M2 (cuoi Tuan 4)
- Bat buoc pass: A3, B2, B3, D3.
- Neu truot M2: khong rollout user-facing changes.

3. Gate M3 (cuoi Tuan 6)
- Bat buoc pass: C1, C2, C3/C4, D1, D2.
- Neu truot M3: cho phep release phan backend da on dinh, hoan cac enhancement UX/ops chua dat.

## Ke hoach hop va quan tri tien do

### Lich hop toi thieu

1. Daily 15 phut (BE/FE/QA/DevOps)
- Bao cao theo ID task (A1, A2, B1...).
- Nguyen tac: blocker > 24h phai escalte trong ngay.

2. Mid-week review (45 phut)
- Demo ket qua theo acceptance gate.
- Chot risk va quyet dinh de-scope neu can.

3. End-week milestone review (60 phut)
- So KPI voi muc tieu tuan.
- Quyết dinh go/no-go cho gate M1/M2/M3.

### Dashboard tracking khuyen nghi

- Burnup theo Workstream A/B/C/D.
- Quality panel:
  - duplicate event rate
  - pagination consistency
  - merge over-count incidents
- UX panel:
  - time-to-first-meaningful-action
  - click-to-action median
  - alert ignore rate

## Risk register (thuc dung)

| Risk ID | Mo ta | Xac suat | Tac dong | Nguoi theo doi | Ke hoach giam thieu |
|---|---|---|---|---|---|
| R1 | Data source fallback khong on dinh gio giao dich | Medium | High | BE-Lead | Bat buoc A1/A2 truoc rollout UX |
| R2 | Scope UX phinh vuot 6 tuan | Medium | Medium | PM-Lead | Uu tien C1/C2, de C3/C4 thanh optional |
| R3 | Regression test chua bao phu nguon stream | High | High | QA-Lead | Chot D3 som o Tuan 4 |
| R4 | Rollback cham khi production issue | Low | High | DevOps-Lead | D2 canary + rollback drill truoc release |

## Ticket Ready Backlog (de import Jira/Trello)

Huong dan su dung nhanh:
- Moi dong la 1 ticket.
- Co san title, mo ta ngan, output, va dieu kien dong ticket.

### Epic A - Data Integrity

1. Ticket A1.1 - Standardize deterministic event_id across sources
- Mo ta: Chuan hoa event_id cho redis_stream, vnbroker fallback, intraday_tick_db.
- Output:
  - Event key spec doc.
  - Event id generator map theo source.
- Done when:
  - Cung event logic => id on dinh qua nhieu lan fetch.

2. Ticket A1.2 - Replace synthetic cursor tie-breaker
- Mo ta: Loai bo synthetic id non-deterministic khoi cursor flow.
- Output:
  - Cursor schema v2.
  - Migration strategy cho FE pagination.
- Done when:
  - Pagination 5 trang khong duplicate/missing.

3. Ticket A2.1 - Contract compatibility matrix
- Mo ta: Chot contract response nhat quan giua 3 source.
- Output:
  - Bang contract matrix (required/optional fields).
  - Contract test checklist.
- Done when:
  - QA sign-off matrix pass.

### Epic B - Signal Quality

1. Ticket B1.1 - Dark flow severity rulebook v1
- Mo ta: Viet bo quy tac severity rieng cho dark_flow.
- Output:
  - Rulebook severity v1 (input -> output examples).
  - Baseline distribution benchmark.
- Done when:
  - PM + QA dong y rulebook va sample set.

2. Ticket B2.1 - Multi-threshold single-event policy
- Mo ta: Dinh nghia 1 trade -> 1 event chinh, crossed thresholds chi la metadata.
- Output:
  - Policy note + test cases list.
- Done when:
  - events/trade ratio dat muc tieu tren pilot.

3. Ticket B3.1 - Merge scoring anti-overcount
- Mo ta: Chot logic merge de tranh cong don sai.
- Output:
  - Merge decision table.
  - Edge-case catalog.
- Done when:
  - Khong con incident over-count tren test scenario.

### Epic C - Trader UX

1. Ticket C1.1 - Top events now information architecture
- Mo ta: Thiet ke luong triage cho event quan trong nhat.
- Output:
  - UX wireframe (desktop/mobile).
  - Prioritization logic mapping.
- Done when:
  - 5/5 user test noi bo tim duoc top 3 event < 10s.

2. Ticket C2.1 - Why this alert evidence block
- Mo ta: Thiet ke va chot bo evidence khong AI cho moi alert.
- Output:
  - Component spec + empty/error/loading states.
- Done when:
  - Moi alert hien >=3 evidence blocks co y nghia.

3. Ticket C3.1 - Action in 1-2 clicks
- Mo ta: Rut gon thao tac tu alert den watch/open chart/add note.
- Output:
  - Interaction flow + hotkeys (neu co).
- Done when:
  - Median click-to-action giam >=30% trong UAT.

### Epic D - Ops & Reliability

1. Ticket D1.1 - SLO dashboard and alerting
- Mo ta: Dinh nghia metric + dashboard + nguong canh bao.
- Output:
  - Dashboard panel + alert routing.
- Done when:
  - Co alert that khi vuot error/latency budget.

2. Ticket D2.1 - Canary and rollback drill
- Mo ta: Chot quy trinh canary + dien tap rollback.
- Output:
  - Rollback playbook.
  - Drill report.
- Done when:
  - Rollback <=5 phut trong bai test.

3. Ticket D3.1 - Release quality gate policy
- Mo ta: Chot danh muc test gate bat buoc truoc release.
- Output:
  - Go/no-go checklist.
- Done when:
  - Release bi chan neu fail bat ky gate critical nao.

## UAT Checklist (khong code, de test gia tri voi trader)

### Nhom 1 - Correctness
1. Cung 1 query paging, ket qua khong duplicate/missing event.
2. Cung 1 user + symbol, threshold dong bo tren moi man hinh/endpoint.
3. Event severity dark_flow phan bo hop ly theo sample that.

### Nhom 2 - Usability
1. Trader tim top 3 event quan trong trong <=10 giay.
2. Trader hieu ly do canh bao ma khong can mo tai lieu huong dan.
3. Trader thao tac den hanh dong tiep theo trong <=2 click.

### Nhom 3 - Reliability
1. Trong tai cao, event van den dung thu tu tuong doi.
2. Khi fallback source, UI van ro tinh trang du lieu (khong gay hieu nham).
3. Alerting ops phat hien su co truoc khi user bao loi.

## Priority Matrix (de tranh phinh scope)

Nguyen tac:
- P0: Anh huong truc tiep tinh dung/sai, bat buoc xong truoc.
- P1: Tang chat luong su dung, can cho release chinh.
- P2: Toi uu trai nghiem, co the phase sau neu can.

| Hang muc | Impact trader | Risk neu tre | Priority |
|---|---|---|---|
| A1, A2, B1 | Rat cao | Rat cao | P0 |
| A3, B2, B3, D3 | Cao | Cao | P1 |
| C1, C2, D1 | Cao | Trung binh | P1 |
| C3, C4, D2 | Trung binh-Cao | Trung binh | P2 |

## Kickoff Plan Tuan 1 (khong code)

1. Ngay 1
- Chot owner va timeline cho A1/A2/B1.
- Freeze scope P0 (khong chen them feature).

2. Ngay 2-3
- Workshop rulebook severity dark_flow (PM + BE + QA).
- Chot contract matrix va pagination scenarios.

3. Ngay 4
- Review risk register + update mitigation theo tinh hinh.
- Chuan bi UAT scripts cho correctness.

4. Ngay 5
- Milestone check M1 readiness (phan planning va artifact, chua release).
- Quyết dinh cong viec qua tuan 2 theo dung priority matrix.

## Sprint Readiness Assessment (du de mo sprint moi trong roadmap?)

### Ket luan danh gia
- Co, noi dung hien tai da du de mo mot sprint moi trong roadmap.
- De xuat mo sprint moi voi ten: Sprint Dark Money Integrity & Usability - Phase 1.

### Diem san sang (thang 10)
- Scope ro rang: 9/10
- Acceptance criteria ro rang: 9/10
- Ownership va dependency: 8/10
- Risk va gate: 8/10
- Tong hop: 8.5/10 (Ready)

### Dieu kien can khoa truoc kickoff (bat buoc)
1. Chot owner that su theo role trong Implementation Board.
2. Chot baseline KPI hien tai de do truoc/sau sprint:
- duplicate event rate
- pagination consistency
- alert ignore rate
3. Chot sprint capacity (story points/nguoi) de tranh over-commit.

### De xuat cau truc sprint moi

1. Sprint objective
- Dat nen tang dung va de dung cho dark money flow o muc release candidate.

2. In-scope (goi sprint khuyen nghi)
- A1, A2, B1 (P0 bat buoc)
- Mot phan A3 hoac B2 neu con capacity

3. Out-of-scope (de tranh truot sprint)
- C3, C4, D2
- Moi thay doi non-critical ve UI cosmetics
- Bat ky hang muc AI

4. Definition of Sprint Success
- Gate M1 pass:
  - A1, A2, B1 hoan tat
  - Khong blocker critical mo > 48h
  - KPI correctness cai thien theo muc tieu P0

### Tieu chi go/no-go de dua vao roadmap chinh thuc

Go neu:
1. Ban lich sprint + owner da duoc PM xac nhan.
2. KPI baseline va dashboard tracking da san sang.
3. Backlog import board da hoan tat (CSV + mapping fields).

No-go neu:
1. Chua chot owner thuc thi cho A1/A2/B1.
2. Chua co kha nang do KPI baseline.
3. Scope bi chen them hang muc ngoai P0.

## Board Sync Pack (san sang import)

Tai lieu nay di kem 1 file import:
- docs/DARK_MONEY_FLOW_JIRA_IMPORT_20260410.csv

### Muc dich
- Chuyen backlog A/B/C/D thanh ticket de team theo doi tien do theo sprint.
- Dong bo nhanh giua PM, BE, FE, QA, DevOps ma khong can viet lai ticket thu cong.

### Cach dung de import
1. Tao project board/sprint theo timeline 6 tuan.
2. Import file CSV vao issue tracker.
3. Map cac cot quan trong:
- Summary
- Issue Type
- Description
- Priority
- Labels
- SprintHint
- OwnerRole
- Dependency
- AcceptanceCriteria
4. Gan owner cu the tuong ung role (BE-Lead, FE-Lead, QA-Lead, DevOps-Lead, PM-Lead).
5. Dat dashboard theo 4 workstream A/B/C/D.

### Quy tac trang thai de dung ngay
- Todo: chua bat dau.
- In Progress: dang lam.
- In Review: da xong dev/planning, cho review/QA.
- Done: dat acceptance criteria.
- Blocked: co blocker >24h.

### Dinh ky cap nhat toi thieu
- Daily: cap nhat status theo ID ticket.
- Mid-week: cap nhat risk + dependency.
- End-week: cap nhat KPI va gate M1/M2/M3.

## Definition of Done (cap tinh nang)

Tinh nang dark money flow duoc xem la dat chuan quoc te trong pham vi san pham nay khi:
1. Dung va on dinh:
- Pagination/contract tin cay tren moi source, co regression gate.
2. It nhieu, de dung:
- Trader nhin thay duoc event quan trong nhanh, hieu ly do canh bao, thao tac hanh dong gon.
3. Van hanh an toan:
- Co SLO, canary, rollback, va quan sat du lieu theo phien giao dich.

## Ket luan

Nen uu tien dung lo trinh non-AI ben tren de hoan thien core signal va UX truoc.
Muc tieu la bien dark money flow thanh cong cu giao dich thuc dung: dung, de hieu, de hanh dong, va van hanh on dinh trong gio giao dich.

## Artefact Mo Sprint Moi (ready-to-use)

De dua vao roadmap ngay, su dung bo tai lieu sau:
- docs/SPRINT_CHARTER_DARK_MONEY_PHASE1_20260410.md
- docs/DARK_MONEY_PHASE1_JIRA_IMPORT_20260410.csv

### Checklist mo sprint Phase 1

1. PM xac nhan sprint objective va in-scope A1/A2/B1.
2. Chot owner thuc te cho tung ticket P0.
3. Import CSV vao board va map dung truong.
4. Ghi baseline KPI truoc sprint (duplicate rate, pagination consistency, alert ignore).
5. Chot lich gate review giua va cuoi sprint.

### Exit criteria sprint Phase 1

1. A1, A2, B1 dat acceptance criteria.
2. Khong con blocker critical mo qua 48h.
3. KPI correctness cai thien theo muc tieu da chot.
4. Co de xuat scope tiep theo cho Phase 2 (A3/B2/B3/D3).
