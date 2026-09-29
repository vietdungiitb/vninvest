# Thống nhất bảng dữ liệu realtime cho Dashboard & Watchlist
**Ngày**: 2026-04-16  
**Vấn đề chính**: Dashboard bị "rung" (flashing) quá mường; Watchlist không có cơ chế hiển thị bảng "Trạng thái thị trường theo mã"  
**Mục tiêu**: Đề xuất một `RealtimeQuoteTable` component dùng chung để tối ưu hóa hiệu suất và UX

---

## 1. PHÂN TÍCH NGUYÊN NHÂN FLASHING TRÊN DASHBOARD

### 1.1 Root Causes

| Nguyên nhân | Chi tiết | Tác động |
|-------------|---------|---------|
| **Recovery polling 5s** | Khi WS healthy nhưng có missing symbols, hook chạy batch fetch mỗi 5s | Re-render quá mường (p95 ~50-100ms/update) |
| **Quote update từ polling** | Mỗi polling batch gây `setQuotesBySymbol()` → re-render toàn component | Bảng bị redraw liên tục |
| **No row memoization** | `quoteList.map()` trong JSX render tạo object mới mỗi lần parent render | Mỗi row không có React.memo bảo vệ |
| **Bootstrap hydrate 10 batches** | Sau hard refresh, 10 batch × 10 symbols = 10 API calls trong 1s | Instant re-render surge |
| **Poll cursor cycling** | Polling batch size 8, nhưng recovery mode mỗi 5s lặp toàn bộ → gây duplicate update | Cùng quote update 2-3 lần trước khi move sang next batch |
| **Dashboard re-compute all** | `buildLiveHoldingsOverlay()` + `buildLiveSummaryFromHoldings()` chạy mỗi render | Toàn trang đều render, không phải chỉ table |

### 1.2 Visible Symptoms (từ video)

- Rows "nhảy" position liên tục
- Price/% change color blink (green → red → green)
- Freshness badge (0s, 1s, 2s...) cập nhật quá nhanh
- Watchlist không có tab/view "Trạng thái thị trường theo mã" → user phải tự mapping dữ liệu

---

## 2. SO SÁNH WATCHLIST VS DASHBOARD

### 2.1 Watchlist

**Hiện tại:**
- Dùng `useRealtimeFeed()` hook để lấy realtime data
- Hiển thị 2 tab chính:
  1. **Nhóm thị trường** (Securities Groups) → danh sách symbol theo sector/market-cap
  2. **Mã Theo dõi** (Tracked Symbols) → user-tracked list + price alert rules
- Có heuristic scale `resolveWatchlistPriceScale()` để map giá VND → thousand VND
- **Không có tab "Trạng thái thị trường theo mã"** (missing UI feature)

**Table structure:**
- Group table: mã, ngành, giá, change, % change, updated_at, actions
- Tracked table: mã, condition, target price, current price, status, cooldown, last trigger, actions
- Group detail inline: mã, sector, giá, change, % change, updated_at, actions

### 2.2 Dashboard

**Hiện tại:**
- Dùng `useRealtimeFeed()` hook qua RealtimeContext (shared manager)
- Hiển thị:
  1. **HoldingsTable** → danh sách cổ phiếu đang nắm giữ
  2. **DashboardRealtimePanel** → 2 tab "Trạng thái thị trường theo mã" + "Cảnh báo thống nhất"
- Có `quoteList` memoized nhưng map trực tiếp → không memo row
- Có heuristic scale (REMOVED trong vừa rồi, nhưng Watchlist vẫn keep)
- Re-render toàn panel mỗi quote update

**Table structure:**
- Market status table: mã, giá, % change, freshness, (missing: sector, status badge)
- Alert table: severity, headline, value, confidence, symbol

### 2.3 Key Differences

| Aspect | Watchlist | Dashboard |
|--------|-----------|-----------|
| **Data source** | Same realtime feed | Same realtime feed |
| **Table memoization** | No row memo | No row memo |
| **Polling strategy** | Same bootstrap + recovery | Same bootstrap + recovery |
| **Scale heuristic** | Có (resolveWatchlistPriceScale) | Không (removed) |
| **Freshness display** | Hiếm (chỉ trong group detail) | Có (mỗi row) |
| **Status column** | Có (rule matching status) | Không có |
| **Missing UI** | None | "Trạng thái thị trường" tab nên reuse watchlist table |

---

## 3. ĐỀ XUẤT GIẢI PHÁP UNIFIED

### 3.1 Tạo `RealtimeQuoteTable` Component

**Mục đích:**
- Reusable table component cho cả Watchlist & Dashboard
- Memoization ở row level để ngăn re-render unnecessary
- Configurable columns (symbol, price, change%, freshness, status, actions)
- Consistent styling & behavior

**File structure:**
```
frontend/src/components/RealtimeQuoteTable/
├── RealtimeQuoteTable.jsx (main component)
├── QuoteTableRow.jsx (memoized row)
├── useQuoteTableSort.js (sorting logic)
└── useQuoteTableFilter.js (filtering logic)
```

**Props interface:**
```javascript
<RealtimeQuoteTable
  quotes={[{symbol, current_price, change_pct, freshness_seconds, ...}]}
  columns={['symbol', 'price', 'change%', 'freshness', 'status']}
  onRowClick={(symbol) => {}}
  onAction={(symbol, action) => {}}
  sortBy={{key: 'symbol', direction: 'asc'}}
  isLoading={false}
  emptyMessage="Không có mã nào"
/>
```

### 3.2 Tối ưu hóa Polling Strategy

**Current (gây flashing):**
- Bootstrap: 10 batches × 10 symbols = 100 API calls trong 1s
- Recovery: batch 8, mỗi 5s, lặp toàn bộ symbols

**Improved:**
- **Bootstrap**: Batch 20 symbols, sequential (tránh surge)
- **Recovery**: Batch 16 (WS healthier → fewer candidates), mỗi 8s (từ 5s)
- **Polling baseline**: 15s (từ 15s, nhưng tăng xén recovery aggressive)
- **Condition**: 
  - Nếu WS healthy + < 3 missing → skip recovery (chỉ base polling)
  - Nếu WS healthy + >= 3 missing → recovery mode 8s batch 16

### 3.3 Chuẩn hóa Quote Scale

**Vấn đề hiện tại:**
- Watchlist: heuristic `resolveWatchlistPriceScale()`
- Dashboard: removed scale heuristic
- Canonical refactor khẳng định backend trả THOUSAND_VND

**Solution:**
- Remove heuristic từ Watchlist
- Backend đảm bảo canonical THOUSAND_VND (already done)
- Unified `formatQuotePrice()` qua i18n

### 3.4 Memoization Strategy

**Row-level memoization:**
```javascript
const QuoteTableRow = React.memo(({ quote, columns, onRowClick, onAction }) => {
  // Render row
}, (prev, next) => {
  // Custom comparison: chỉ re-render nếu quote.current_price hoặc quote.freshness_seconds thay đổi
  return (
    prev.quote.current_price === next.quote.current_price &&
    prev.quote.freshness_seconds === next.quote.freshness_seconds &&
    prev.columns === next.columns
  );
});
```

**Batch memoization:**
- Polling batch size = 16 (instead 8) → ít batch updates
- Recovery interval = 8s (instead 5s) → ít polling triggers

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Create Unified Component (2-3 giờ)
- [ ] Tạo `RealtimeQuoteTable.jsx` core component
- [ ] Tạo `QuoteTableRow.jsx` với React.memo + custom comparison
- [ ] Port Watchlist table rendering logic
- [ ] Port Dashboard market-status table logic
- [ ] Test component với mock data

### Phase 2: Integrate Watchlist (1-2 giờ)
- [ ] Replace group/tracked table rendering bằng RealtimeQuoteTable
- [ ] Test realtime updates không bị flashing
- [ ] Verify Watchlist behaviors (filtering, sorting, actions)

### Phase 3: Integrate Dashboard (1-2 giờ)
- [ ] Replace DashboardRealtimePanel market-status table
- [ ] Add "Trạng thái thị trường theo mã" tab (sử dụng RealtimeQuoteTable)
- [ ] Test polling performance

### Phase 4: Polling Optimization (1 giờ)
- [ ] Tăng bootstrap batch size từ 10 → 20
- [ ] Tăng recovery interval từ 5s → 8s
- [ ] Tăng recovery batch size từ 8 → 16
- [ ] Add conditional recovery (skip nếu < 3 missing)

### Phase 5: Testing & Validation (1-2 giờ)
- [ ] Render performance profiling (DevTools)
- [ ] Memory leak check (long-running test)
- [ ] User scenarios: hard refresh, toggle pages, realtime updates

---

## 5. EXPECTED OUTCOMES

### Before (Current)
- Dashboard table flashing 5-10 times/min (polling every 5s)
- Bootstrap hydrate causes 100 API calls in 1s surge
- No memoization → full row re-render on quote update
- Watchlist không có bảng market status

### After (Proposed)
- Dashboard table flashing <= 2-3 times/min (polling every 8s, conditional)
- Bootstrap hydrate sequential → 20 API calls in ~2-3s (smoother)
- Row memoization → mỗi row chỉ re-render khi quote change meaningful
- Watchlist có tab "Trạng thái thị trường theo mã" reusing unified component
- Consistent UX giữa 2 pages

---

## 6. RISKS & MITIGATION

| Risk | Mitigation |
|------|-----------|
| Longer recovery interval (8s) → slower missing quote update | Increase batch size (16) + condition (activate nếu >=3 missing) |
| Row memoization complexity | Use shallow comparison first, then optimize |
| Breaking Watchlist alerts logic | Separate status column rendering logic, configurable |
| Backend scale heuristic conflict | Already removed from Dashboard, clean up Watchlist next |

---

## 7. DECISION CHECKPOINT

**Recommendation**: Tiến hành Phase 1 ngay để prototype component, sau đó integrate Watchlist (low risk), cuối cùng Dashboard (higher risk nhưng manageable).

**Timeline**: 6-8 giờ tổng cộng (có thể chia 2 ngày nếu cần verify từng phase).

---

**Document Owner**: Copilot AI  
**Approval Status**: PENDING USER REVIEW
