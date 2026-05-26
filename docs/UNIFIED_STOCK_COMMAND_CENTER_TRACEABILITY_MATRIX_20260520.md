# TRACEABILITY MATRIX — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## Requirement → Component → Test mapping

| ID | Requirement | Component | File | Test method |
|----|-------------|-----------|------|-------------|
| R01 | KLineChart là surface trung tâm duy nhất | `KLineChartPanel` | `KLineChartPanel.jsx` | Manual: Chỉ có 1 chart trên trang |
| R02 | Pane CVD riêng, cùng trục X | `KLineChartPanel` | `KLineChartPanel.jsx` | Manual: Pane CVD sync khi pan/zoom |
| R03 | Pane Strength riêng, cùng trục X | `KLineChartPanel` | `KLineChartPanel.jsx` | Manual: Pane Strength sync khi pan/zoom |
| R04 | Whale marker top 10% viewport | `KLineChartPanel` | `KLineChartPanel.jsx` (hàm `buildVisibleWhaleSharkMarkers`) | Manual: zoom in/out, đếm markers |
| R05 | Tab Cá Mập hiển thị Bubble Chart | `AnalyticsTabDeck`, `FactsFirstWhaleBubbleChart` | `AnalyticsTabDeck.jsx`, `FactsFirstWhaleBubbleChart.jsx` | Manual + existing test `FactsFirstWhaleBubbleChart.test.jsx` |
| R06 | Tab Order Flow hiển thị radar | `AnalyticsTabDeck`, `OrderFlowRadarPanel` | `AnalyticsTabDeck.jsx`, `OrderFlowRadarPanel.jsx` | Manual |
| R07 | Tab AI Advisory theo session | `AnalyticsTabDeck`, `AIAdvisoryPanel` | `AnalyticsTabDeck.jsx`, `useAIAdvisor.js` | Manual: click nến, AI context đổi |
| R08 | Click nến → toàn bộ tab cập nhật | `StockDetailUnifiedPage` | `StockDetailUnifiedPage.jsx` (`handleKlineSessionChange`) | Manual: click nến, quan sát 3 tab |
| R09 | Hover nến không đổi session | `KLineChartPanel` | `KLineChartPanel.jsx` | Manual: hover nhiều nến, tab không đổi |
| R10 | Sidebar collapsible | `CommandCenterTopBar` hoặc sidebar wrapper | `StockDetailUnifiedPage.jsx` | Manual: click toggle |
| R11 | `/whale-alerts/:symbol` redirect | Router config | `App.jsx` | Manual: navigate URL |
| R12 | Immutable: không sửa WhaleBubbleChart | `WhaleBubbleChart.jsx` | `WhaleBubbleChart.jsx` | Git diff: file unchanged |
| R13 | Immutable: không sửa WhaleAnalyticsTab | `WhaleAnalyticsTab.jsx` | `WhaleAnalyticsTab.jsx` | Git diff: file unchanged |
| R14 | Immutable: không sửa ModularPositionDeck | `ModularPositionDeck.jsx` | `ModularPositionDeck.jsx` | Git diff: file unchanged |
| R15 | i18n text mới đầy đủ tiếng Việt | i18n keys | locale files | Code review: grep `commandCenter.tab.*` |
| R16 | Build pass không lỗi mới | All | All | `npm run build` |
| R17 | Không tạo backend mới | Backend | N/A | Code review: no new Django views |
| R18 | StockDetail cũ không regress | `StockDetailUnifiedPage` | `StockDetailUnifiedPage.jsx` | Smoke test: tất cả sections hiện đúng |

---

## File change tracking

| File | Action | Slice | Ghi chú |
|------|--------|-------|---------|
| `frontend/src/pages/StockDetailUnifiedPage.jsx` | NEW | S1 | Page chính mới |
| `frontend/src/components/CommandCenterTopBar.jsx` | NEW | S1 | Tách từ StockDetail topbar |
| `frontend/src/components/AnalyticsTabDeck.jsx` | NEW | S2 | Tab system |
| `frontend/src/pages/StockDetail.jsx` | MODIFY | S1 | Refactor hoặc thay bằng page mới |
| `frontend/src/pages/WhaleAlertsDashboard.jsx` | MODIFY | S5 | Cleanup redundant logic |
| `frontend/src/pages/WhaleAlertsShellHost.jsx` | MODIFY | S5 | Redirect wrapper |
| `frontend/src/App.jsx` | MODIFY | S5 | Thêm redirect route |
| `frontend/src/locales/vi/*.json` | MODIFY | S2 | Thêm i18n keys |
| `frontend/src/components/WhaleBubbleChart.jsx` | **NO CHANGE** | — | Immutable |
| `frontend/src/components/WhaleAnalyticsTab.jsx` | **NO CHANGE** | — | Immutable |
| `frontend/src/components/modern/ModularPositionDeck.jsx` | **NO CHANGE** | — | Immutable |
| `frontend/src/components/KLineChartPanel.jsx` | **NO CHANGE** | — | Chỉ đọc prop onSessionChange |
| `frontend/src/components/OrderFlowRadarPanel.jsx` | **NO CHANGE** | — | Import nguyên |
| `frontend/src/components/FactsFirstWhaleBubbleChart.jsx` | **NO CHANGE** | — | Import nguyên |
| `frontend/src/components/modern/AIAdvisorAlertPanel.jsx` | **NO CHANGE** | — | Import nguyên |

---

## Test file mapping

| Test file | Requirement | Status |
|-----------|-------------|--------|
| `frontend/src/components/FactsFirstWhaleBubbleChart.test.jsx` | R05 | Có sẵn — phải pass |
| `frontend/src/components/FactsFirstWhaleAnalyticsTab.test.jsx` | R05 | Có sẵn — phải pass |
| `frontend/src/components/WhaleBubbleChart.sync.test.jsx` | R08 | Có sẵn — phải pass |
| `frontend/src/hooks/useWhaleAnalyticsData.test.js` | R07 | Có sẵn — phải pass |
| `[NEW] AnalyticsTabDeck.test.jsx` | R05, R06, R07, R08 | Phải tạo mới ở S2 |
