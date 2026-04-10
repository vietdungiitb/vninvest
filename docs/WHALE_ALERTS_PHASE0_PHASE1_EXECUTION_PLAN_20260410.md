# Whale Alerts Phase 0-1 Execution Plan

Ngay: 2026-04-10
Pham vi: Thuc thi 2 phase dau cua roadmap professionalization cho `/whale-alerts`
Nguon goc: `docs/WHALE_ALERTS_PROFESSIONALIZATION_ROADMAP_20260410.md`
Muc tieu: Chuyen tu tai lieu chien luoc thanh backlog co the giao viec ngay

## 1. Muc tieu Phase 0

Phase 0 tap trung vao `trust + consistency + observability`.

Neu Phase 0 chua xong, khong nen lam campaign intelligence hay advisory v2 vi se nang cap tren mot nen tang chua on dinh.

### Ket qua can dat

1. Threshold override nhat quan tren moi surface.
2. Event freshness/source semantics ro rang.
3. Dark money/order-flow dung market-time semantics.
4. Co metric baseline cho freshness, fallback, dedup, event loss proxy.

## 2. Backlog Phase 0

### WA-P0-1 Threshold override consistency

Loai: Backend root-fix
Uu tien: P0
Owner: BE
Estimate: 2 ngay

Van de:

- `whale_alert_threshold_million` chua di xuyen suot qua realtime publish, advisory accumulation, va merge logic.

Task:

1. Refactor threshold resolution helper de ho tro `user + symbol + tracked_symbol context`.
2. Ap dung cung helper cho:
   - realtime publish
   - stream alert engine neu co user scoping
   - advisory accumulation
   - advisory generation context metadata
3. Bo sung field `threshold_source` trong payload: `user_default|symbol_override`.
4. Add focused tests cho:
   - realtime whale alert payload
   - aggregate feed
   - advisory merge path

DoD:

- Khong con duong nao dung threshold cap user khi symbol override ton tai.
- Test regression pass.

### WA-P0-2 Market-time normalization for order flow

Loai: Backend root-fix
Uu tien: P0
Owner: BE
Estimate: 1.5 ngay

Van de:

- order_flow dang dung UTC instead of local market time.

Task:

1. Chuyen `_today()` sang local trading date.
2. Chuyen `_now_time()` sang local market time.
3. Review nhung ham co cutoff theo `trade_time`.
4. Add tests cho 5m/15m/30m windows trong gio VN.

DoD:

- Detector dung dung cua so du lieu theo gio thi truong.
- Khong lam vo hien tai cua whale detail va stock order flow API.

### WA-P0-3 Unified event metadata

Loai: Backend + FE contract hardening
Uu tien: P0
Owner: BE + FE
Estimate: 1.5 ngay

Van de:

- Live alerts va recovery snapshot cung duoc render, nhung payload semantics chua ro hoan toan.

Task:

1. Chot schema metadata toi thieu cho moi whale event:
   - `event_id`
   - `source`
   - `source_layer`
   - `event_origin`
   - `threshold_source`
   - `freshness_bucket`
   - `recovered`
2. FE hien badge `live` hoac `recovered`.
3. FE hien `threshold source` khi la symbol override.

DoD:

- User co the phan biet alert live va alert do snapshot recovery.
- Payload duoc tai lieu hoa va khong mu mo nghia nghiep vu.

### WA-P0-4 Realtime observability baseline

Loai: Ops + Backend observability
Uu tien: P0
Owner: BE + DevOps
Estimate: 2 ngay

Task:

1. Ghi metric:
   - alert freshness median/p95
   - dedup hit ratio
   - snapshot recovery ratio
   - stream source ratio
   - vnstock fallback ratio
2. Tao health endpoint summary cho whale pipeline.
3. Tao runbook alerting baseline.

DoD:

- Co the tra loi 3 cau hoi:
  - alert co tre khong
  - alert co bi duplicate khong
  - he thong dang phu thuoc stream/DB/vnstock o muc nao

### WA-P0-5 FE trust hardening

Loai: Frontend UX clarification
Uu tien: P0
Owner: FE
Estimate: 1 ngay

Task:

1. Add chips:
   - `Live`
   - `Recovered`
   - `User threshold`
   - `Symbol override`
2. Giai thich source succinctly trong hub/dashboard cards.
3. Hien freshness age theo bucket.

DoD:

- User khong can doan alert nay den tu dau va co moi den muc nao.

## 3. Muc tieu Phase 1

Phase 1 tap trung vao `intelligence upgrade`.

Day la buoc bien `/whale-alerts` tu event board thanh intelligence board.

### Ket qua can dat

1. Aggregate feed co window filter va anomaly score.
2. Co campaign grouping engine.
3. Whale Hub tach duoc `Live Tape` va `Campaigns`.
4. User bat dau co triage workflow thay vi chi click tung event.

## 4. Backlog Phase 1

### WA-P1-1 Aggregate feed window filter v2

Loai: Backend + FE
Uu tien: P1
Owner: BE + FE
Estimate: 2 ngay

Task:

1. API nhan `window=5m|15m|1h|session|5d`.
2. Cursor semantics van deterministic theo tung window.
3. FE them segmented control trong Whale Hub.

DoD:

- User co the xem whale activity theo nhieu khung co nghia nghiep vu.

### WA-P1-2 Anomaly scoring layer

Loai: Backend intelligence
Uu tien: P1
Owner: BE
Estimate: 3 ngay

Task:

1. Tinh them cac feature:
   - relative size vs symbol baseline
   - session percentile
   - volume abnormality
   - liquidity stress proxy
2. Expose fields:
   - `abnormality_score`
   - `actionability_score`
   - `baseline_context`
3. Update FE card display.

DoD:

- Alert khong chi lon theo so tuyet doi, ma lon bat thuong theo boi canh.

### WA-P1-3 Campaign grouping engine

Loai: Backend service
Uu tien: P1
Owner: BE
Estimate: 4 ngay

Task:

1. Group events theo symbol + side + time window.
2. Sinh `campaign_id`, `campaign_type`, `campaign_strength`, `campaign_event_count`.
3. Co API `/api/realtime/whale-campaigns/`.

DoD:

- Co the xem mot loat event thanh mot pattern co nghia.

### WA-P1-4 Whale Hub v2 UI

Loai: Frontend UX
Uu tien: P1
Owner: FE
Estimate: 3 ngay

Task:

1. Tach 2 khu vuc hoac 2 tabs:
   - `Live Tape`
   - `Campaigns`
2. Them filters:
   - side
   - severity
   - freshness
   - source
   - threshold source
3. Them pin symbol va quick investigate.

DoD:

- Whale Hub khong con la list card thuan tuy.

### WA-P1-5 Symbol summary API

Loai: Backend API
Uu tien: P1
Owner: BE
Estimate: 2 ngay

Task:

1. Tao endpoint `whale-symbol-summary/<symbol>`.
2. Tra ve:
   - latest campaign
   - buy/sell campaign balance
   - abnormality summary
   - confidence summary

DoD:

- FE co mot summary surface de triage nhanh truoc khi vao dashboard chi tiet.

### WA-P1-6 Trust explanation chips

Loai: FE + BE
Uu tien: P1
Owner: FE + BE
Estimate: 1.5 ngay

Task:

1. Hien `why this matters` chips tren feed cards.
2. Hien `compared to normal` context.
3. Hien `what to check next` hints.

DoD:

- User khong can tu suy dien qua nhieu tu score so.

## 5. Dependency Graph

### Must-do truoc

- WA-P0-1
- WA-P0-2
- WA-P0-3

### Co the chay song song sau Phase 0 core

- WA-P0-4
- WA-P0-5
- WA-P1-1

### Phu thuoc vao contract v2

- WA-P1-2
- WA-P1-3
- WA-P1-4
- WA-P1-5
- WA-P1-6

## 6. Sprint Slice De Xuat

### Sprint A - Trust & Consistency

- WA-P0-1
- WA-P0-2
- WA-P0-3

### Sprint B - Observability & UX clarity

- WA-P0-4
- WA-P0-5
- WA-P1-1

### Sprint C - Intelligence foundation

- WA-P1-2
- WA-P1-3

### Sprint D - Whale Hub v2

- WA-P1-4
- WA-P1-5
- WA-P1-6

## 7. QA Checklist Toi Thieu

1. Symbol override duoc ton trong o dashboard, hub, symbol detail, advisory.
2. Event live va recovered duoc label dung.
3. Window filter khong lam vo cursor sorting.
4. Campaign cards khong duplicate voi raw tape theo cach gay roi UX.
5. Score/anomaly data khong null-break card rendering.

## 8. Release Gate

Chi nen mo Phase 2 khi:

1. Alert freshness p95 on dinh.
2. Snapshot recovery ratio nam trong nguong chap nhan.
3. Threshold consistency bugs da dong.
4. Whale Hub v2 duoc smoke test tren du lieu that.

## 9. Artefacts Tiep Theo Can Tao

1. API contract v2 draft
2. Wireframe spec Whale Hub v2
3. Test matrix cho whale pipeline
