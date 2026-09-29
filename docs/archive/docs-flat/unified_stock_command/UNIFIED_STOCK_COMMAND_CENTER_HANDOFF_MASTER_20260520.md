# HANDOFF MASTER — Unified Stock Command Center
## Ngày: 2026-05-20 | Feature: UNIFIED_STOCK_COMMAND_CENTER

---

## 1. Mục tiêu bàn giao

Gộp hai trang `/stocks/:symbol` (`StockDetail.jsx`) và `/whale-alerts/:symbol` (`WhaleAlertsDashboard.jsx`) thành một trang **Unified Stock Command Center** duy nhất tại route `/stocks/:symbol`, với bố cục tối ưu mật độ thông tin, sử dụng **Tabbed Deck** phía dưới KLineChart để tổ chức nhiều module phân tích (Whale Analytics, Order Flow Radar, AI Advisory).

Đây là task **thuần frontend**, không có backend mới. Mọi API và hook hiện có được tái sử dụng.

---

## 2. Kết quả cuối bắt buộc

1. Route `/stocks/:symbol` kế thừa **toàn bộ** nội dung hiện có của `StockDetail.jsx` **và** toàn bộ nội dung Whale Analytics từ `WhaleAlertsDashboard.jsx`.
2. `KLineChartPanel` là surface trung tâm duy nhất — không được có chart engine thứ 2.
3. Khu vực dưới KLine được tổ chức thành một **AnalyticsTabDeck** với 3 tab tối thiểu: Phân tích Cá Mập, Order Flow Radar, AI Advisory.
4. Dữ liệu trong mỗi tab bám đúng **selected session** từ KLine (click nến → toàn bộ tab update).
5. Sidebar bên phải giữ nguyên: Sổ lệnh 3 mức giá + Khớp lệnh trong phiên.
6. Route `/whale-alerts/:symbol` chuyển redirect 301 về `/stocks/:symbol`.
7. Không sửa các file immutable: `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx`, `ModularPositionDeck.jsx`.
8. Mọi text mới trên UI phải có i18n tiếng Việt đầy đủ dấu.

---

## 3. Bộ tài liệu trong gói này

| # | File | Mục đích |
|---|------|----------|
| 1 | `UNIFIED_STOCK_COMMAND_CENTER_HANDOFF_MASTER_20260520.md` | Tài liệu này — master điều phối |
| 2 | `IMPLEMENTATION_PLAN_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Chi tiết kỹ thuật và lộ trình |
| 3 | `TECH_SPEC_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Layout spec, component tree, state contract |
| 4 | `TASKBOARD_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Slice taskboard có owner/acceptance/test gate |
| 5 | `FRONTEND_DESIGN_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Wireframe, CSS grid, animation spec |
| 6 | `BACKEND_DESIGN_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Route redirect, API impact (minimal) |
| 7 | `UNIFIED_STOCK_COMMAND_CENTER_TRACEABILITY_MATRIX_20260520.md` | Map requirement → component → test |
| 8 | `UNIFIED_STOCK_COMMAND_CENTER_SELF_AUDIT_AND_TEST_PROTOCOL_20260520.md` | Checklist QA/audit |
| 9 | `UNIFIED_STOCK_COMMAND_CENTER_CODE_QUALITY_CONSTITUTION_20260520.md` | Coding standards áp dụng |
| 10 | `UNIFIED_STOCK_COMMAND_CENTER_EXECUTION_EVIDENCE_TEMPLATE_20260520.md` | Template evidence pack |
| 11 | `RUN_CODE_REVIEW_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Checklist code review |
| 12 | `RUN_INTEGRATION_TESTS_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Lệnh test tích hợp |
| 13 | `RUN_SPEC_AUDIT_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` | Spec audit protocol |

---

## 4. Thứ tự ưu tiên tài liệu

Khi có xung đột diễn giải:
1. `TECH_SPEC_UNIFIED_STOCK_COMMAND_CENTER_20260520.md` (layout contract)
2. `IMPLEMENTATION_PLAN_UNIFIED_STOCK_COMMAND_CENTER_20260520.md`
3. `TASKBOARD_UNIFIED_STOCK_COMMAND_CENTER_20260520.md`
4. `FRONTEND_DESIGN_UNIFIED_STOCK_COMMAND_CENTER_20260520.md`
5. `UNIFIED_STOCK_COMMAND_CENTER_TRACEABILITY_MATRIX_20260520.md`
6. AGENTS.md và quality/QUALITY.md

---

## 5. Các quyết định đã khóa

### 5.1 Route và navigation
- Route chính: `/stocks/:symbol` — `StockDetailUnifiedPage` (component mới).
- Route redirect: `/whale-alerts/:symbol` → `301 Redirect` → `/stocks/:symbol`.
- Breadcrumb: `RADAR THỊ TRƯỜNG / STOCK WORKSPACE / :symbol`.

### 5.2 Layout
- **Top bar**: Thông tin giá cô đọng (Symbol, Giá, %, Vol, Ref/Trần/Sàn, 52W) + badge "Theo dõi realtime" + CTA actions.
- **Center**: KLineChartPanel (60–70% chiều rộng) với pane CVD và pane Strength bên dưới (cùng trục X).
- **Right sidebar**: Sổ lệnh 3 mức + Khớp lệnh — collapsible.
- **Bottom Tabbed Deck**: AnalyticsTabDeck với tabs sau:
  - Tab 1 `🐋 Cá Mập`: FactsFirstWhaleBubbleChart + Cảnh báo dòng tiền + RVOL.
  - Tab 2 `📊 Order Flow`: OrderFlowRadarPanel + MoneyFlowDonut.
  - Tab 3 `🤖 AI Advisory`: AI Advisory panel (session-linked).

### 5.3 Selected session truth
- Click nến trên KLine → `handleKlineSessionChange` → cập nhật `selectedTradeDate` state.
- Tất cả Tab đọc từ `selectedTradeDate` shared context — không được có local session state độc lập.

### 5.4 Immutable source protection
Không được sửa các file sau:
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`

### 5.5 Whale marker rule
- Top 10% nến trong viewport hiện tại, không theo toàn dataset.
- Logic giữ nguyên từ `KLineChartPanel.jsx`.

---

## 6. File anchors hiện tại

### Frontend — MODIFY
- `frontend/src/pages/StockDetail.jsx` → Refactor thành `StockDetailUnifiedPage`
- `frontend/src/pages/WhaleAlertsDashboard.jsx` → Tách các hooks/logic, chuyển redirect

### Frontend — NEW
- `frontend/src/pages/StockDetailUnifiedPage.jsx`
- `frontend/src/components/AnalyticsTabDeck.jsx`
- `frontend/src/components/CommandCenterTopBar.jsx`

### Frontend — READ-ONLY (dùng nhưng không sửa)
- `frontend/src/components/KLineChartPanel.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`
- `frontend/src/components/FactsFirstWhaleBubbleChart.jsx`
- `frontend/src/components/FactsFirstWhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/AIAdvisorAlertPanel.jsx`
- `frontend/src/hooks/useWhaleAnalyticsData.js`
- `frontend/src/hooks/useAIAdvisor.js`
- `frontend/src/api/client.js`

### Backend — MODIFY
- Frontend routing config (React Router) hoặc Nginx/Django redirect cho `/whale-alerts/:symbol`.

---

## 7. Chỉ dẫn cho đội code

1. Đọc `module_tree_full.md` trước — đặc biệt là section `StockDetail.jsx` (dòng 6506–6511) và `WhaleAlertsDashboard.jsx` (dòng 6601–6606).
2. Bắt đầu từ **Slice 1** (layout skeleton), không nhảy vào Tab logic trước khi có grid chuẩn.
3. Mỗi slice phải có focused build validation trước khi mark done.
4. Không gộp nhiều slice vào một PR.
5. Mọi text UI mới phải có key i18n tiếng Việt đầy đủ dấu.
6. Sau mỗi slice: chạy `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`.

---

## 8. Checklist nghiệm thu tối thiểu

### Visual / UX
- [ ] KLineChart là surface trung tâm duy nhất.
- [ ] AnalyticsTabDeck có đủ 3 tab: Cá Mập, Order Flow, AI Advisory.
- [ ] Sidebar phải/trái không che khuất KLine khi fullscreen.
- [ ] Mọi text mới có i18n VN.

### Functional
- [ ] Click nến KLine → toàn bộ 3 tab cập nhật đúng session.
- [ ] Whale marker chỉ tính top 10% viewport.
- [ ] `/whale-alerts/:symbol` redirect thành công về `/stocks/:symbol`.
- [ ] Trang `/stocks/:symbol` cũ không regress.

### Evidence
- [ ] Frontend build pass (không lỗi, không warning mới).
- [ ] Screenshot/video cho tab switching + session sync.
- [ ] Payload snapshot cho ít nhất 2 symbols (BMP, FPT).
