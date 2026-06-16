# IMPLEMENTATION PLAN — Stock Detail Information Upgrade
## Feature: STOCK_DETAIL_INFO_UPGRADE | Ngày: 2026-06-12

---

## 1. Bối cảnh và Mục tiêu

### 1.1 Bối cảnh

Trang chi tiết cổ phiếu Stock Detail (`/stocks/:symbol`) hiện tại đang ở trạng thái:

- **Header**: Hiển thị tối giản, thiếu thông tin floor/ceiling/reference prices, open/average, volume đầy đủ
- **Tabs**: Đang ở trạng thái stub hoặc degraded (hiển thị "Dữ liệu đang di trú")
- **Tham chiếu**: Bảng giá thương mại cao cấp như SSI iBoard

### 1.2 Mục tiêu

**Mục tiêu 1 — Nâng cấp Header chi tiết cổ phiếu:**
- Hiển thị đầy đủ: Mã cổ phiếu, Tên công ty, Sàn, Giá hiện tại (kèm biến động số và %), Giá Trần - Sàn - Tham chiếu, Mở cửa / Trung bình, Thấp / Cao, Tổng Khối Lượng

**Mục tiêu 2 — Xây dựng hệ thống Tab Thông tin Doanh nghiệp (8 tabs):**
- **Giao dịch**: Whale Alerts, Order Book depth, Strength Matrix
- **Hồ sơ**: Company overview, founded date, listing date, Officers
- **Cổ đông**: Top shareholders table với ownership %
- **Vốn và cổ tức**: Charter capital, listed shares, dividend history
- **Tin tức**: Latest company news
- **Lịch sử sự kiện**: Corporate events timeline
- **Thống kê**: P/E, P/B, EPS, ROE, ROA, Beta, BVPS grid
- **Tài chính**: Income Statement, Balance Sheet by quarter

---

## 2. Hiện trạng vs Mục tiêu

| Thành phần | Trạng thái hiện tại | Gap cần xử lý | Priority |
|---|---|---|---|
| Header - Giá Trần/Sàn/Tham chiếu | Chưa hiển thị | Cần bổ sung từ snapshot API | P0 |
| Header - Open/Average/Volume | Tối giản hoặc thiếu | Cần hiển thị đầy đủ | P0 |
| Tab Giao dịch | Đã có OrderFlowRadarPanel | Cần mở rộng w/ Order Book, Strength Matrix | P1 |
| Tab Hồ sơ | Stub "Dữ liệu đang di trú" | Cần tích hợp vnbroker.Company() | P1 |
| Tab Cổ đông | Stub | Cần shareholders data từ vnbroker | P1 |
| Tab Vốn và cổ tức | Stub | Cần capital/dividend data | P2 |
| Tab Tin tức | Stub | Cần vnbroker.News() integration | P1 |
| Tab Lịch sử sự kiện | Chưa có | Cần corporate events data | P2 |
| Tab Thống kê | Stub | Cần financial ratios từ vnbroker.Finance() | P1 |
| Tab Tài chính | Stub "Dữ liệu đang di trú" | Cần quarterly reports từ vnbroker | P1 |

---

## 3. Architecture Notes

### 3.1 Data Source Strategy

```
Data Sources:
├─ Primary: vnbroker (KBS)
│  ├─ vnbroker.Company(symbol, source='KBS')
│  ├─ vnbroker.Finance(symbol, source='KBS')
│  └─ vnbroker.News(source='KBS')
├─ Fallback: RSS feeds (VNECONOMY, CafeF, Vietstock)
└─ Cache: Redis TTL by data type
```

### 3.2 Cache Strategy

| Data Type | Cache TTL | Reason |
|---|---|---|
| Company/Profile | 24 hours | Infrequently updated |
| Shareholders | 24 hours | Quarterly disclosure |
| Financials | 12 hours | Quarterly reports |
| Dividends | 24 hours | Annual distribution |
| News | 30 minutes | Real-time |
| Statistics (P/E, P/B, etc.) | 12 hours | Daily changing |

### 3.3 API Contract

```python
# Backend endpoints needed:
GET /core/v1/stock-management/stocks/{symbol}/overview/
GET /core/v1/stock-management/stocks/{symbol}/profile/
GET /core/v1/stock-management/stocks/{symbol}/shareholders/
GET /core/v1/stock-management/stocks/{symbol}/capital-dividends/
GET /core/v1/stock-management/stocks/{symbol}/news/
GET /core/v1/stock-management/stocks/{symbol}/statistics/
GET /core/v1/stock-management/stocks/{symbol}/financials/
```

### 3.4 Frontend State Management

**Blocking lane:**
- Symbol identity
- Quote snapshot (ceiling/floor/reference/open/average/high/low/volume)

**Deferred lane:**
- Profile, Shareholders, Capital, News, Events, Statistics, Financials
- Lazy load on tab click

---

## 4. Scope

### Trong scope

- Nâng cấp StockDetailHeader với 3-row layout đầy đủ
- Xây dựng StockDetailTabs component với 8 tabs
- Tích hợp vnbroker data sources
- Redis caching cho từng data type
- Fallback handling với degrading states

### Ngoài scope

- Không xây dựng feature business mới trong root frontend/backend
- Không thay đổi VNStockChart integration
- Không tái thiết kế toàn bộ page architecture

---

## 5. Implementation Tasks

### Phase 1: Header Enhancement

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-01 | Enhance snapshot API to include all price fields | packages/core/backend | 2h |
| SD-INFO-02 | Update StockDetailHeader component (3-row layout) | packages/web | 4h |
| SD-INFO-03 | Add price formatting and color coding | packages/web | 2h |
| SD-INFO-04 | Verification gate | test | 1h |

### Phase 2: Profile + Shareholders Tabs

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-05 | Create /profile/ endpoint with vnbroker.Company() | packages/core/backend | 4h |
| SD-INFO-06 | Create /shareholders/ endpoint | packages/core/backend | 3h |
| SD-INFO-07 | Build Profile tab component | packages/web | 3h |
| SD-INFO-08 | Build Shareholders tab component | packages/web | 3h |
| SD-INFO-09 | Verification gate | test | 1h |

### Phase 3: Capital + Dividends + Statistics

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-10 | Create /capital-dividends/ endpoint | packages/core/backend | 3h |
| SD-INFO-11 | Create /statistics/ endpoint (P/E, P/B, etc.) | packages/web | 3h |
| SD-INFO-12 | Build Capital & Dividends tab | packages/web | 2h |
| SD-INFO-13 | Build Statistics tab | packages/web | 2h |
| SD-INFO-14 | Verification gate | test | 1h |

### Phase 4: News + Events + Financials

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-15 | Create /news/ endpoint with vnbroker.News() | packages/core/backend | 4h |
| SD-INFO-16 | Create /financials/ endpoint | packages/core/backend | 4h |
| SD-INFO-17 | Build News tab | packages/web | 3h |
| SD-INFO-18 | Build Financials tab | packages/web | 4h |
| SD-INFO-19 | Build Events tab | packages/web | 2h |
| SD-INFO-20 | Verification gate | test | 1h |

### Phase 5: Trading Tab Enhancement

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-21 | Integrate OrderFlowRadarPanel | packages/web | 2h |
| SD-INFO-22 | Add Order Book depth panel | packages/web | 3h |
| SD-INFO-23 | Add Strength Matrix panel | packages/web | 3h |
| SD-INFO-24 | Verification gate | test | 1h |

### Phase 6: Final Integration

| Task ID | Mô tả | Files | Duration |
|---|---|---|---|
| SD-INFO-25 | Integrate all tabs into StockDetailTabs | packages/web | 2h |
| SD-INFO-26 | Lazy loading for deferred tabs | packages/web | 2h |
| SD-INFO-27 | Error handling and degraded states | packages/web | 2h |
| SD-INFO-28 | Browser smoke test (FPT, HPG, VNM, TCB) | test | 2h |

---

## 6. File Ownership

### Backend (packages/core)

```
packages/core/backend/src/market_data/views.py
packages/core/backend/src/market_data/serializers.py
packages/core/backend/src/market_data/urls.py
packages/core/backend/src/market_data/cache.py
```

### Frontend (packages/web)

```
packages/web/src/features/stock-detail/components/StockDetailHeader.js
packages/web/src/features/stock-detail/components/StockDetailTabs.js
packages/web/src/features/stock-detail/components/tabs/TradingTab.js
packages/web/src/features/stock-detail/components/tabs/ProfileTab.js
packages/web/src/features/stock-detail/components/tabs/ShareholdersTab.js
packages/web/src/features/stock-detail/components/tabs/CapitalDividendsTab.js
packages/web/src/features/stock-detail/components/tabs/NewsTab.js
packages/web/src/features/stock-detail/components/tabs/EventsTab.js
packages/web/src/features/stock-detail/components/tabs/StatisticsTab.js
packages/web/src/features/stock-detail/components/tabs/FinancialsTab.js
packages/web/src/adapters/core/market.js
```

---

## 7. Dependencies

```
Phase 1 (Header) ──┬──► SD-INFO-01 -> SD-INFO-04 (No deps)
                    │
Phase 2 (Profile) ──┼──► SD-INFO-05 -> SD-INFO-09 (Depends on Phase 1)
                    │
Phase 3 (Cap+Stat) ─┼──► SD-INFO-10 -> SD-INFO-14 (Depends on Phase 2)
                    │
Phase 4 (News+Fin) ─┼──► SD-INFO-15 -> SD-INFO-19 (Depends on Phase 3)
                    │
Phase 5 (Trading) ─┼──► SD-INFO-21 -> SD-INFO-24 (Depends on Phase 1)
                    │
Phase 6 (Final)   ──┴──► SD-INFO-25 -> SD-INFO-28 (All phases complete)
```

---

## 8. Validation Gates

### Technical Gates

- [ ] `npm run build` pass
- [ ] Python tests for new endpoints pass
- [ ] Adapter calls resolve correctly

### Browser Smoke Test

- [ ] `/stocks/FPT` - Header displays full price info
- [ ] `/stocks/TCB` - All 8 tabs load correctly (with degrading states if backend unavailable)
- [ ] `/stocks/HPG` - Trading tab order flow renders
- [ ] `/stocks/INVALID` - Not-found state displays

---

## 9. Risks

| Risk | Probability | Mitigation |
|---|---|---|
| vnbroker API unavailable | Medium | Fallback to RSS feeds + cache |
| Data stale | Low | Redis cache with appropriate TTL |
| Performance impact | Medium | Lazy loading for heavy tabs |
| Responsive on mobile | Low | Mobile layout for tabs |

---

## 10. Exit Criteria

Workstream được coi là done khi:

- Header hiển thị đầy đủ: ceiling/floor/reference/open/average/low/high/volume
- 8 tabs hoạt động (có dữ liệu hoặc degrading state đúng)
- Profile, Shareholders, News có dữ liệu thật từ vnbroker
- Statistics và Financials có dữ liệu thật hoặc degrading state
- Trading tab với OrderFlowRadarPanel + Order Book + Strength Matrix
- Lazy loading hoạt động cho tabs nặng
- Xác minh thủ công với SSI iBoard reference

---

## 11. Estimated Timeline

| Phase | Duration | Total |
|---|---|---|
| Phase 1: Header | 9h | 9h |
| Phase 2: Profile + Shareholders | 14h | 23h |
| Phase 3: Capital + Statistics | 11h | 34h |
| Phase 4: News + Financials | 16h | 50h |
| Phase 5: Trading | 9h | 59h |
| Phase 6: Final Integration | 9h | 68h |

**Total Estimate**: ~68 hours (~10 working days)

---

## 12. Reference Documents

- **Source plan**: `c:\Mujoco Projects\vninvestcharts\docs\planning\stock_detail_enrichment_plan.md`
- **Existing implementation**: `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md`
- **Tech spec**: `docs/TECH_SPEC_STOCK_DETAIL_INFO_UPGRADE_20260612.md` (to be created)
- **Taskboard**: `docs/TASKBOARD_STOCK_DETAIL_INFO_UPGRADE_20260612.md` (to be created)
