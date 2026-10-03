# Audit and Implementation Blueprint: SSOT Whale Alert - Bubble Chart Sync

**Date**: 2026-04-22  
**Status**: Approved for implementation kickoff  
**Owner**: Backend + Frontend shared

---

## 1. Executive Summary

Hien trang ton tai do lech giua canh bao Ca map (whale alert) va bieu do bong bong (bubble chart) trong Modern Dashboard.  
Nguoi dung co the thay alert mua lon xuat hien nhung bubble chart khong co diem du lieu, gay mat niem tin vao he thong.

Ket luan audit:
- Day la van de sai khop pipeline du lieu, khong phai loi giao dien don thuan.
- Alert va bubble chart dang doc hai endpoint co logic fallback va guard khac nhau.
- Can chot mot nguon su that duy nhat (SSOT) cho whale events, sau do hai man hinh chi render tu cung mot event stream da chuan hoa.

---

## 2. Problem Statement

### 2.1 Trieu chung
- He thong co canh bao whale mua lon.
- Tab Ca map tren Modern Dashboard khong hien thi bubble tuong ung.
- Trong mot so truong hop gia tham chieu khong co, chart trang hoac chi hien khung.

### 2.2 Tac dong
- Nguoi dung danh gia he thong sai lech/kem tin cay.
- Team van hanh kho phan biet "khong co su kien" va "co su kien nhung render path bi dut".
- Tang chi phi support va giam kha nang mo rong tinh nang whale intelligence.

---

## 3. Audit Scope and Evidence

### 3.1 Frontend path (Bubble)
- Modern Dashboard render whale tab qua `WhaleBubbleChart`.
- API client goi endpoint `GET /api/portfolio/whale/orders/{symbol}/`.

### 3.2 Backend path (Bubble)
- Endpoint bubble: `whale_orders_by_symbol_api`.
- Nguon du lieu: `IntradayTick` + `TickerSessionClose` (gia tham chieu).
- Neu thieu `ref_price` thi tra ve danh sach orders rong.

### 3.3 Backend path (Alert)
- Whale feed endpoint dang dung pipeline fallback: Redis stream -> IntradayTick DB -> vnbroker.
- Alert co the ton tai khi stream co du lieu, ngay ca khi bubble endpoint khong du dieu kien.

### 3.4 Root cause tong hop
1. Lech nguon du lieu giua alert va bubble.
2. Bubble endpoint phu thuoc cung vao `ref_price`; thieu la empty.
3. Bubble endpoint khong dung cung co che fallback theo stream-first nhu alert.
4. Co nguy co lech ngay/khung gio neu quy uoc trade_date khac nhau giua cac path.

---

## 4. SSOT Decision

### 4.1 Nguyen tac bat buoc
- Alert co su kien nao thi bubble phai co diem tuong ung cho cung bo loc symbol + time window.
- Khong chap nhan hai pipeline song song cho cung nghiep vu whale event.

### 4.2 SSOT duoc chon
- SSOT cho whale event: Whale Event Pipeline trong service layer (stream-first with canonical normalization).
- Moi endpoint whale-facing chi duoc lay du lieu tu SSOT service.

---

## 5. Target Architecture

### 5.1 Canonical service moi
`get_whale_events_by_symbol(user, symbol, window, timeframe, options)`

Tra ve event list da chuan hoa:
- symbol
- ts
- side
- price
- volume
- matched_value
- threshold_vnd
- source
- quality_flags

### 5.2 Render strategy
- Alert cards: render truc tiep tu canonical events.
- Bubble chart: map cung canonical events thanh toa do x/y/size.
- Neu thieu `ref_price`: van render bubble theo mode fallback (khong trang), dong thoi gan `quality_flags`.

### 5.3 Source selection policy
- Tier 1: Redis stream (neu fresh).
- Tier 2: IntradayTick DB.
- Tier 3: vnbroker fallback.
- Tat ca tier deu normalize ve cung contract truoc khi tra output.

---

## 6. Unified Data Contract

```json
{
  "symbol": "DGC",
  "ts": "2026-04-22T09:32:10+07:00",
  "side": "buy",
  "price": 108000,
  "volume": 12000,
  "matched_value": 1296000000,
  "threshold_vnd": 500000000,
  "source": "redis_stream",
  "quality_flags": {
    "has_ref_price": true,
    "price_unit_normalized": true,
    "degraded_mode": false
  }
}
```

Quy tac:
- `matched_value` luon la VND canon.
- `side` normalize ve `buy|sell|unknown`.
- `ts` luon ISO-8601 co timezone.
- `quality_flags` phai cho phep UI giai thich ro ly do fallback.

---

## 7. API Consolidation Plan

### 7.1 Muc tieu
- Khong thay doi route public ngay lap tuc (de giam rui ro).
- Refactor ben trong de ca hai endpoint alert/bubble cung goi 1 service.

### 7.2 Ke hoach endpoint
1. Giu route hien tai:
   - `/api/realtime/whale-feed/{symbol}/`
   - `/api/portfolio/whale/orders/{symbol}/`
2. Chuyen implementation ben trong:
   - Cung dung canonical whale event service.
3. Them metadata contract:
   - `source`, `quality_flags`, `degraded_mode_reason`.

### 7.3 UI behavior contract
- Neu co events va `has_ref_price=false`:
  - Van hien bubble trong fallback mode.
  - Hien thong diep: "Du lieu dang o che do du phong do thieu gia tham chieu".
- Khong cho phep hien empty state neu event count > 0.

---

## 8. Implementation Phases

### Phase 0 - Alignment and guardrails
- Chot canonical event schema.
- Chot source priority va freshness policy.
- Add feature flag `WHALE_BUBBLE_USE_SSOT_EVENTS`.

### Phase 1 - Backend unification
- Tao service `get_whale_events_by_symbol`.
- Refactor whale feed endpoint dung service moi.
- Refactor whale orders endpoint dung service moi.
- Bo sung `quality_flags` va `degraded_mode_reason`.

### Phase 2 - Frontend sync and fallback UX
- Update `WhaleBubbleChart` de render tu contract moi.
- Bo sung banner fallback mode khi thieu `ref_price`.
- Dam bao khong hien empty state sai sematic.

### Phase 3 - Hardening
- Add test parity alert vs bubble.
- Add observability metric mismatch.
- Rollout theo canary va monitor regression.

---

## 9. Test Matrix (Mandatory)

1. Stream has events, DB empty:
- Alert co su kien.
- Bubble phai co diem.

2. DB has events, stream stale:
- Alert va bubble cung event count parity.

3. Missing ref_price:
- Alert co su kien.
- Bubble van render fallback mode, khong trang.

4. Price unit mixed (VND + THOUSAND_VND):
- `matched_value` parity, khong sai x1000.

5. Timeframe 15m/30m/1h/session:
- Alert va bubble cung bo loc tra ve tap su kien dong nhat.

6. Multi-symbol scope:
- Chon symbol nao thi alert panel con va bubble cua symbol do phai dong bo.

---

## 10. Observability and SLO

Metric moi de bat buoc theo doi:
- `whale_ssot_alert_bubble_event_count_delta` (theo symbol/window).
- `whale_ssot_degraded_mode_total`.
- `whale_ssot_missing_ref_price_total`.
- `whale_ssot_source_distribution` (stream/db/vnbroker).

Canh bao:
- Neu `event_count_delta != 0` lien tuc 3 chu ky poll -> raise warning.
- Neu `degraded_mode_total` tang dot bien -> inspect TickerSessionClose feed.

---

## 11. Release Gate

Chi duoc release khi dat tat ca:
1. Test parity pass.
2. Khong con case "alert co, bubble rong" trong UAT matrix.
3. Feature flag rollback duoc verify.
4. Dashboard co thong diep fallback ro rang, khong mo ho.

---

## 12. Risk Register

1. R1 - Regression do thay doi contract endpoint
- Mitigation: giu backward-compatible fields + feature flag.

2. R2 - Tang do tre do normalize chung
- Mitigation: cache ngan han + vectorized processing.

3. R3 - Lieu event duplicate giua stream va DB
- Mitigation: dedupe key theo event_id/ts/side/matched_value.

4. R4 - Degraded mode bi lam dung
- Mitigation: metric + alert threshold + runbook clear owner.

---

## 13. Definition of Done

- Alert va bubble su dung cung canonical whale event service.
- Khong con dual-path logic gay mismatch ket qua.
- Co test va observability cho parity.
- Co fallback UX ro rang khi thieu ref_price.
- Co audit ledger + progress dashboard cap nhat day du.

---

## 14. Implementation Checklist

- [ ] Chot contract canonical whale event.
- [ ] Tao backend service SSOT.
- [ ] Refactor 2 endpoint alert/bubble ve chung service.
- [ ] Cap nhat WhaleBubbleChart fallback UX.
- [ ] Bo sung test parity va mixed-unit.
- [ ] Bo sung metric mismatch/degraded.
- [ ] Canary rollout + verify.

---

## 15. Final Recommendation

Day la bug trust-critical. Uu tien xu ly ngay theo huong SSOT unification, khong tiep tuc patch tung endpoint rieng le.  
Sau khi hoan thanh, whale intelligence se co tinh nhat quan cao hon, giam ticket support, va tang do tin cay voi nguoi dung Pro.
