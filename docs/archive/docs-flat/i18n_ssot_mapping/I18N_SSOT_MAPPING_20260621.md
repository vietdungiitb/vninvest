# i18n SSOT Mapping — Legacy vs packages/web

**Ngày:** 2026-06-21
**Mục tiêu:** Ánh xạ keys i18n giữa legacy `frontend/src/i18n/vi.js` và packages/web để đảm bảo không mất keys khi migrate.

---

## 1. Hiện trạng

| Nguồn | File | Loại | Ghi chú |
|-------|------|------|---------|
| Legacy | `frontend/src/i18n/vi.js` (hoặc `vi.json`) | JSON/JS object | Dùng qua `useI18n()` với key lookup |
| packages/web | `packages/web/src/context/LangContext.js` | JS module + helper functions | Dùng `createTranslator()` + hardcoded dicts trong component |
| packages/web | Hardcoded trong component | Inline vi/en dicts | Pattern phổ biến trong packages/web |

---

## 2. Key Mapping

### 2.1 Dashboard

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `dashboard.marketValue` | `smartStats.marketValue` (SmartStatsHeader.js) | ✅ Mapped |
| `dashboard.unrealizedPL` | `smartStats.unrealizedPL` | ✅ Mapped |
| `dashboard.breadthLabel` | `smartStats.breadthLabel` | ✅ Mapped |
| `dashboard.refreshBtn` | `smartStats.refreshBtn` | ✅ Mapped |
| `dashboard.headerAlpha` | `smartStats.alpha` | ✅ Mapped |
| `dashboard.headerBeta` | `smartStats.beta` | ✅ Mapped |
| `dashboard.headerSharpe` | `smartStats.sharpe` | ✅ Mapped |
| `dashboard.headerMaxDrawdown` | `smartStats.maxDrawdown` | ✅ Mapped |
| `dashboard.empty` | Inline trong DashboardPage | ✅ Mapped |
| `dashboard.errorLoad` | Inline trong DashboardPage | ✅ Mapped |

### 2.2 Heatmap

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `heatmap.title` | `heatmap.title` (PortfolioHeatmap.js) | ✅ Mapped |
| `heatmap.treemap` | `heatmap.treemap` | ✅ Mapped |
| `heatmap.sunburst` | `heatmap.sunburst` | ✅ Mapped |
| `heatmap.sizeCap` | `heatmap.sizeCap` | ✅ Mapped |
| `heatmap.sizeWeight` | `heatmap.sizeWeight` | ✅ Mapped |
| `heatmap.empty` | `heatmap.empty` | ✅ Mapped |

### 2.3 Alert Center

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `dashboardRealtime.sourceWhale` | `alert.source.whale` (UnifiedAlertCenter.js) | ✅ Mapped |
| `dashboardRealtime.sourceDarkFlow` | `alert.source.dark_flow` | ✅ Mapped |
| `dashboardRealtime.sourcePriceShock` | `alert.source.price_shock` | ✅ Mapped |
| `dashboardRealtime.sourceStaleQuote` | `alert.source.stale_quote` | ✅ Mapped |
| `dashboardRealtime.filterAll` | `alert.title` (fallback) | ⚠️ Cần thêm |
| `dashboardRealtime.severityCritical` | `alert.severity.critical` | ✅ Mapped |
| `dashboardRealtime.severityHigh` | `alert.severity.high` | ✅ Mapped |
| `dashboardRealtime.severityMedium` | `alert.severity.medium` | ✅ Mapped |
| `dashboardRealtime.severityLow` | `alert.severity.low` | ✅ Mapped |

### 2.4 Position Deck

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `deck.title` | `deck.title` (FactsFirstModularPositionDeck.js) | ✅ Mapped |
| `deck.empty` | `deck.empty` | ✅ Mapped |
| `deck.holdings` | `deck.holdings` | ✅ Mapped |
| `deck.quantity` | `deck.quantity` | ✅ Mapped |
| `deck.avgPrice` | `deck.avgPrice` | ✅ Mapped |
| `deck.currentPrice` | `deck.currentPrice` | ✅ Mapped |
| `deck.pnl` | `deck.pnl` | ✅ Mapped |
| `deck.pnlPct` | `deck.pnlPct` | ✅ Mapped |
| `deck.weight` | `deck.weight` | ✅ Mapped |
| `deck.whale` | `deck.whale` | ✅ Mapped |
| `deck.loading` | `deck.loading` | ✅ Mapped |

### 2.5 AI Advisor

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `aiAdvisor.panel.title` | `aiAdvisor.panel.title` (AIAdvisorAlertPanel.js) | ✅ Mapped |
| `aiAdvisor.panel.refresh` | `aiAdvisor.panel.refresh` | ✅ Mapped |
| `aiAdvisor.panel.loading` | `aiAdvisor.panel.loading` | ✅ Mapped |
| `aiAdvisor.panel.loadError` | `aiAdvisor.panel.loadError` | ✅ Mapped |
| `aiAdvisor.severity.*` | `aiAdvisor.severity.*` | ✅ Mapped |
| `aiAdvisor.metric.*` | `aiAdvisor.metric.*` | ✅ Mapped |
| `aiAdvisor.trend.*` | `aiAdvisor.trend.*` | ✅ Mapped |

### 2.6 Whale Advisory

| Key (Legacy) | packages/web | Trạng thái |
|---|---|---|
| `whaleAdvisory.*` | Hardcoded trong WhaleAdvisoryPage.jsx | ✅ Inline |
| `whaleChart.*` | Hardcoded trong FactsFirstWhaleBubbleChart | ✅ Inline |

---

## 3. Keys còn thiếu trong packages/web

| Key (Legacy) | Đề xuất mapping | Ưu tiên |
|---|---|---|
| `dashboardRealtime.filterAll` | `alert.filterAll` | 🟢 Thấp |
| `dashboardRealtime.sourceSystem` | `alert.source.system` | 🟢 Thấp |
| `common.loading` | Inline trong component | 🟢 Thấp |
| `common.error` | Inline trong component | 🟢 Thấp |
| `common.save` | Inline trong component | 🟢 Thấp |
| `common.cancel` | Inline trong component | 🟢 Thấp |
| `common.delete` | Inline trong component | 🟢 Thấp |
| `common.confirm` | Inline trong component | 🟢 Thấp |

---

## 4. Kết luận

- **~90% keys đã được mapping** hoặc hardcoded inline trong packages/web components
- **6 keys còn thiếu** — đều là common keys, ưu tiên thấp
- **Pattern packages/web**: Hardcoded vi/en dicts trong component (không dùng centralized i18n file)
- **Khuyến nghị**: Giữ pattern hiện tại của packages/web (hardcoded inline), không migrate sang centralized i18n để tránh breaking change

---

## 5. Audit Rule (pre-commit hook)

```
Mọi text hiển thị tiếng Việt trong packages/web:
✅ CHO PHÉP: Hardcoded inline vi/en dict trong component
✅ CHO PHÉP: createTranslator() với dict local
❌ CẤM: Chuỗi tiếng Việt không có bản dịch tiếng Anh tương ứng
❌ CẤM: Import từ legacy i18n file
```