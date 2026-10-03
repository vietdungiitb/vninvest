# Sprint 35 - Unified Alert Center on Dashboard (Detailed Plan)

## 1. Business Goal
Xay dung mot panel canh bao hop nhat tren dashboard de nha dau tu nhan biet bat thuong thi truong trong 3 giay va co hanh dong ngay.

Bai toan can giai:
- Whale alert da co, nhung dark flow va cac tin hieu bat thuong khac con phan tan.
- Nha dau tu kho uu tien khi nhieu canh bao cung xuat hien.
- Thieu mot diem nhin hop nhat theo severity va symbol.

## 2. Sprint Scope
Trong sprint 35, panel moi phai dat duoc:
- Unified Alert Strip theo severity: critical/high/medium/low.
- Unified Alert Center feed: hop nhat whale + dark flow + price shock + stale quote.
- Hot Symbols chips: group canh bao theo ma va hien cap do uu tien.
- Deep-link hanh dong nhanh toi stock detail/whale alerts.
- I18n day du cho vi/en.

Ngoai pham vi sprint 35:
- Khong thay doi luong AI advisory generation.
- Khong thay doi backend event producer contract hien tai (chi de xuat v2).

## 3. UX Design Contract
### 3.1 Unified Alert Strip
- Vi tri: trong DashboardRealtimePanel, ngay sau khoi stale CTA.
- Hien thi:
  - Tong canh bao dang noi bat.
  - 4 counter severity: Critical, High, Medium, Low.
- Muc tieu: user biet ngay do nong cua thi truong.

### 3.2 Unified Alert Center
- Danh sach theo uu tien severity truoc, sau do theo recency.
- Moi item bat buoc co:
  - Symbol
  - Source chip (WHALE / DARK FLOW / PRICE SHOCK / STALE)
  - Severity chip
  - Headline
  - Detail
  - Confidence (neu co)
  - Timestamp
- Link dieu huong:
  - Whale -> /whale-alerts/:symbol
  - Dark flow / Price shock / Stale -> /stocks/:symbol

### 3.3 Hot Symbols
- Group theo symbol.
- Hien thi:
  - Tong so canh bao tren ma.
  - So critical/high tren ma.
- Muc tieu: uu tien ma can xem truoc.

## 4. Data Model (Frontend Normalized)
```json
{
  "id": "string",
  "symbol": "string",
  "source": "whale|dark_flow|price_shock|stale_quote",
  "severity": "critical|high|medium|low",
  "headline": "string",
  "detail": "string",
  "confidence": "number|null",
  "ts": "ISO datetime",
  "to": "navigation path"
}
```

## 5. Severity Mapping Rules
### 5.1 Whale
- extreme -> critical
- high -> high
- medium -> medium
- khac -> medium (fallback)

### 5.2 Dark Flow
- confidence >= 80 hoac strength >= 80 -> critical
- confidence >= 65 hoac strength >= 65 -> high
- con lai -> medium

### 5.3 Price Shock (synthetic)
- abs(change_pct) >= 7 -> high
- abs(change_pct) >= 5 -> medium
- < 5 -> khong tao alert

### 5.4 Stale Quote
- stale quote co hien thi de canh bao chat luong du lieu
- severity mac dinh: low

## 6. Technical Implementation Plan
### 6.1 Frontend - Phase 1 (da coding)
- Dashboard truyen them `darkFlowAlerts` vao `DashboardRealtimePanel`.
- `DashboardRealtimePanel` tao `unifiedAlerts` bang cach merge:
  - whale alerts (realtime + aggregate snapshot)
  - dark flow alerts
  - price shock synthetic
  - stale quote synthetic
- Dedupe theo source/symbol/headline.
- Sap xep theo severity weight -> ts.
- Render:
  - alert strip
  - hot symbols
  - unified center feed

### 6.2 Frontend - Phase 2 (tiep theo)
- Them user filter: all / watchlist / holdings only.
- Them mark-as-read + mute symbol tam thoi.
- Them toast/notification cho critical moi.

Cap nhat 2026-04-11:
- Da implement filter theo source va severity trong unified strip.
- Da implement mark-as-read tren tung alert item.
- Da implement mute symbol tam thoi 30 phut.
- Da implement filter theo holdings/watchlist.
- Da implement critical toast voi cooldown anti-spam.
- Da implement sound toggle cho critical toast (persist localStorage).
- Da implement queue policy: toi da 2 toast, uu tien ma trong holdings, dedupe theo alert id.
- Hang muc con lai cho phase 2: tinh chinh tham so cooldown/ttl sau UAT.

### 6.3 Backend - Phase 2 (de xuat)
- Tao endpoint aggregate unified alerts v2:
  - GET /api/realtime/unified-alerts/?symbols=&limit=&window=
- Contract backend co `source`, `severity`, `reason_codes`, `confidence`, `priority_score`.
- Co cursor pagination deterministic.

Cap nhat 2026-04-11:
- Da implement endpoint `GET /api/realtime/unified-alerts/` (v2 light) trong `market_views` + `market_data_service`.
- Endpoint da hop nhat whale aggregate + dark flow signals theo symbol/window/severity_min/limit.
- Frontend dashboard da goi snapshot endpoint moi theo chu ky 30s va merge voi local realtime events.
- Da bo sung regression tests cho unified-alerts endpoint (success + severity filter + invalid severity).
- Da bo sung cursor pagination deterministic cho unified-alerts (`next_cursor`, `has_more`) va test khong overlap giua cac trang.

## 7. API Contract Proposal (V2)
### Request
- symbols: CSV
- window: 5m|15m|1h|session
- severity_min: low|medium|high|critical
- limit: int
- cursor: optional

### Response
```json
{
  "results": [
    {
      "event_id": "ua_...",
      "symbol": "FPT",
      "source": "dark_flow",
      "severity": "high",
      "confidence": 78,
      "headline": "Dark money signal detected",
      "detail": "Tick imbalance and small-order persistence rising",
      "reason_codes": ["DF_STRENGTH_HIGH", "DF_CONFIDENCE_HIGH"],
      "ts": "2026-04-11T10:12:02Z"
    }
  ],
  "next_cursor": "...",
  "has_more": true
}
```

## 8. QA Test Matrix
### Functional
- Feed merge dung du 4 nguon canh bao.
- Severity strip cap nhat dung theo so luong feed.
- Hot symbols sap xep dung uu tien (critical > high > total).
- Link dieu huong dung trang cho tung source.

### Realtime
- Event moi vao feed trong <= 2s (local stack).
- Khong duplicate khi co snapshot + realtime cung event.

### UX
- Contrast chip ro tren dark theme hien tai.
- Mobile view khong vo layout.
- Empty state ro rang khi khong co alert.

## 9. Rollout Plan
- B1: Bat theo feature flag `REACT_APP_DASHBOARD_UNIFIED_ALERTS=true` tren staging.
- B2: UAT voi watchlist 20-30 ma.
- B3: Theo doi KPI 48h.
- B4: Mo 100% neu KPI dat nguong.

Rollback:
- Tat feature flag de quay ve panel whale-only.

## 10. KPI va Success Criteria
- Time-to-awareness (critical/high) < 3s.
- Alert click-through rate tang >= 20% so voi baseline whale-only.
- Duplicate alert rate giam >= 30%.
- User feedback "de hieu" >= 80% trong UAT mau.

## 11. Deliverables
- Code:
  - frontend/src/pages/Dashboard.jsx
  - frontend/src/components/DashboardRealtimePanel.jsx
  - frontend/src/i18n/en.js
  - frontend/src/i18n/vi.js
- Docs:
  - docs/SPRINT35_UNIFIED_ALERT_CENTER_DETAILED_PLAN_20260411.md
  - docs/SPRINT35_ACCEPTANCE_CHECKLIST.md
  - docs/ROADMAP_STATUS.md
  - docs/ROADMAP_2026Q2_2026Q4.md
