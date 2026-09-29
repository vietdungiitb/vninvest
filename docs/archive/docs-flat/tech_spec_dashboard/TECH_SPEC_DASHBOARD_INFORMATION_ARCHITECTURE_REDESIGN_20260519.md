# TECH SPEC — Dashboard Information Architecture Redesign

**Ngày tạo**: 2026-05-19  
**Scope**: Layout contract, component responsibilities, slot changes, responsive behavior, runtime constraints  
**Level**: Frontend-heavy, backend inventory-only  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Nguyên tắc kỹ thuật bất biến

1. `Workstation` non-mobile đặt `Heatmap` ở cột giữa của một hàng 3 cột đều nhau; `Classic` non-mobile đặt `Heatmap` ở hàng đầu full-width.
2. `UnifiedAlertCenter` là alert lane duy nhất của default route; không có alert bar/song song khác ở trên cùng.
3. `AIAdvisorAlertPanel` là insight lane duy nhất; không gộp lẫn với event alerts.
4. `FactsFirstModularPositionDeck` là khối hành động chính và phải span full-width dưới top triad.
5. `DashboardPage.js` phải có dedicated AI lane slot; `renderBubble` không còn là lane top-fold mặc định.
6. Không có backend/API contract changes ở v1 của redesign.
7. Không thêm fetch mới; chỉ tái tổ chức các data source đang có.
8. `ModernDashboard` và `PackageDashboardHost` phải cùng theo một layout contract.
9. Kiến trúc đích của dashboard là SaaS native: `PackageDashboardHost -> DashboardPage (@vninvest/web) -> coreApiAdapter -> /core/v1/*`.
10. `ModernDashboard`/`apiClient`/legacy `/api` path chỉ là transitional bridge, không phải canonical end-state.

---

## 1a. SaaS native and OpenAPI design rules

### Canonical dashboard architecture

```text
Browser
→ /dashboard
→ PackageDashboardHost
→ DashboardPage (@vninvest/web)
→ coreApiAdapter
→ /core/v1/*
```

### Forbidden architectural outcomes

1. Giữ `frontend/src/pages/modern/ModernDashboard.jsx` làm trang dashboard canonical sau khi workstream complete.
2. Giữ `frontend/src/api/client.js` hoặc direct fetch làm data plane chuẩn cho dashboard end-state.
3. Thêm dashboard-only business logic mới vào legacy `backend/` monolith.
4. Tạo compat/proxy/bridge endpoint mới ngoài core-api native path chỉ để nuôi layout mới.

### If backend change becomes unavoidable

Backend change chỉ hợp lệ nếu:

1. Nằm trong `packages/core/backend/`.
2. Expose qua `/core/v1/*`.
3. Tuân thủ contract-first theo `CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`.
4. Có OpenAPI metadata, status semantics, error envelope, auth/rate limit/pagination rules đúng chuẩn.
5. Pass `CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`.

Không được:

- vá `backend/` legacy monolith như lời giải dài hạn,
- thêm `/api/` dashboard business endpoint mới,
- hoặc giữ `legacy-only` contract như acceptance path.

---

## 2. Current-state technical audit

### 2.1 Live route composition

`frontend/src/pages/modern/ModernDashboard.jsx` hiện có cấu trúc:

```text
SmartStatsHeader
StickyAlertBar
Main rail (2 columns): Heatmap + UnifiedAlertCenter
Below main rail: FactsFirstModularPositionDeck
Side rail: AIAdvisorAlertPanel + ModernSidebar
```

Vấn đề kỹ thuật:

- `StickyAlertBar` lặp lại domain alert đã có trong `UnifiedAlertCenter`.
- `ModernSidebar` lại chứa `live signal stream`, tạo duplication thêm một lần nữa.
- `FactsFirstModularPositionDeck` bị giới hạn bề ngang dù đây là block cần thao tác nhiều nhất.

### 2.2 Package-host gap

`packages/web/src/pages/DashboardPage.js` hiện mới có slots:

```js
renderStats
renderDeck
renderAlerts
renderHeatmap
renderBubble
```

Khoảng trống kỹ thuật:

- Không có `renderAiPanel` dedicated slot.
- `renderBubble` hiện không mang giá trị cho dashboard overview route.
- Nếu future route swap xảy ra mà không đổi slot contract, layout parity sẽ fail.

---

## 3. Target composition contract

### 3.1 Dashboard shell contract

#### Workstation non-mobile

```text
Header
TopTriad = [AlertLane] [HeatmapLane] [AiLane]
BottomFull = [DeckFullWidth]
```

#### Classic non-mobile

```text
Header
TopRow = [HeatmapLane span 2]
SecondRow = [AlertLane] [AiLane]
DeckFullWidth
```

#### Mobile

```text
Header
HeatmapLane
AlertLane
AiLane
DeckFullWidth
```

### 3.2 Recommended CSS proportions

Desktop:

```css
grid-template-columns: repeat(3, minmax(0, 1fr));
gap: 0.75rem-1.5rem;
```

Additional rule:

- `Workstation` non-mobile dùng 3 cột đều nhau.
- `Classic` non-mobile dùng grid 2 cột, với `HeatmapLane` span toàn hàng 1 và `AlertLane` + `AiLane` ở hàng 2.
- Mobile tiếp tục stack theo thứ tự `Heatmap -> Alert -> AI -> Deck` cho cả hai mode.

Recommended top-triad min heights:

- Alert lane: `min-height: 526px`
- Heatmap lane: `min-height: 526px`
- AI lane: `min-height: 526px`

Bottom deck min height:

- `min-height: 460px` desktop
- `min-height: 420px` tablet/mobile

---

## 4. Slot/API surface changes

### 4.1 `DashboardPage.js`

Current contract cần được thay bằng contract sau:

```js
renderStats({ summary, analytics, holdings, loading, onRefresh })
renderAlertLane({ alertFeed, loading })
renderHeatmap({ holdings, quotesBySymbol, technicals, analytics, loading })
renderAiPanel({ holdings, technicals, analytics, digest, alerts, loading })
renderDeck({ holdings, technicals, analytics, quotesBySymbol, alerts, loading })
```

`renderBubble` options:

1. **Preferred**: deprecate hoàn toàn khỏi dashboard route contract.
2. **Fallback**: giữ nhưng không render trên default dashboard layout, chỉ alias nội bộ sang `renderAiPanel` trong giai đoạn chuyển tiếp.

### 4.2 `PackageDashboardHost.jsx`

Host phải inject:

```js
renderStats
renderAlertLane
renderHeatmap
renderAiPanel
renderDeck
```

Không import thêm component từ `packages/web/src` ngoài public entry `@vninvest/web`.

---

## 5. Component responsibilities

### 5.1 `SmartStatsHeader`

Giữ vai trò:

- Summary KPIs
- Breadth
- Refresh CTA
- Optional micro-metrics strip: `alpha`, `beta`, `sharpe`, `max_drawdown`

Không được mở rộng thành một panel cao thêm một hàng riêng.

### 5.2 `UnifiedAlertCenter`

Giữ vai trò:

- Event truth cho whale/dark flow/price shock/stale quote
- Severity summary chips
- Filters, mute, mark-as-read, pagination

Không được trùng domain với bất kỳ sticky/live stream panel nào khác trên default route.

### 5.3 `PortfolioHeatmap`

Giữ vai trò:

- Primary scanning surface cho symbol universe
- Read at-a-glance of winners/losers/weight distribution

Không gắn thêm summary cards hoặc chatter text làm nhiễu vùng chart.

### 5.4 `AIAdvisorAlertPanel`

Giữ vai trò:

- Lane riêng cho `AI Alerts` và `AI News`
- Toggle giữa 2 tabs
- Optional collapse behavior vẫn được phép nếu không phá layout

Không được nhúng thêm alert feed raw items từ `UnifiedAlertCenter`.

### 5.5 `FactsFirstModularPositionDeck`

Giữ vai trò:

- Khối điều phối mã và hành động chính
- Filter theo scope/symbol
- Overview / Technical / Whale / AI tabs
- Empty state với CTA rõ ràng

Phải được ưu tiên không gian ngang để bảng/tabs dễ dùng.

---

## 6. Removed or downgraded surfaces

### 6.1 Remove from default dashboard route

- `StickyAlertBar`
- `ModernSidebar`

### 6.2 Retain only as optional reusable modules elsewhere

- `StickyAlertBar` có thể dùng ở route khác nếu cần spotlight feed.
- `ModernSidebar` có thể tái dùng trong route analysis sâu, không phải default dashboard.

### 6.3 Metrics relocation

Nếu cần giữ insight từ sidebar, chỉ retain 4 KPI sau ở header:

- `alpha_annual_pct`
- `beta`
- `sharpe_ratio`
- `max_drawdown_pct`

---

## 7. Data flow and runtime constraints

### 7.1 Data sources giữ nguyên

- Portfolio summary / holdings / analytics / technicals
- Realtime feed (`quotesBySymbol`, `alerts`, `darkFlowAlerts`)
- `useAlertCenterFeed`
- `useAIAdvisor`
- `getPortfolioNewsDigest`

### 7.2 Forbidden changes in this workstream

- Không thêm endpoint “dashboard summary” mới.
- Không thêm polling loop mới.
- Không duplicate fetch cho cùng data source chỉ để phục vụ layout mới.
- Không đổi alert taxonomy hoặc AI recommendation logic.

### 7.3 Performance target

- Không tăng số lượng API calls so với current dashboard load path.
- Không tạo thêm `useEffect` độc lập cho data đã có ở parent.
- Không tạo layout shift lớn khi realtime quotes update.

---

## 8. Scroll and interaction model

1. Page scroll là container chính.
2. Alert lane và AI lane có thể scroll nội bộ nếu content dài.
3. Heatmap không được nested-scroll theo chiều ngang.
4. FactsFirst deck có internal scroll hợp lệ cho tables, nhưng wrapper ngoài không được tạo double-scroll vô nghĩa.
5. Tooltip heatmap và popovers không bị che bởi `overflow-hidden` không cần thiết.

---

## 9. Responsive behavior

### 9.1 Desktop >= 1280px

- `Workstation`: triad 3 cột đều nhau trên một hàng.
- `Classic`: heatmap full-width hàng trên, alert + AI ở hàng dưới.
- Deck full-width hàng dưới.

### 9.2 Tablet 768px–1279px

- `Workstation`: vẫn giữ triad 3 cột đều nhau trên một hàng.
- `Classic`: vẫn giữ 2 hàng với heatmap ở hàng trên và alert + AI ở hàng dưới.
- Deck hàng dưới full-width.

### 9.3 Mobile < 768px

- Cả `Workstation` và `Classic` stack theo thứ tự `Heatmap -> Alert -> AI -> Deck`.
- Deck cuối cùng để giữ luồng overview → signal → action.

---

## 10. Backend contract position

### 10.1 Default decision

No backend changes required.

### 10.1a Architectural interpretation

`No backend changes required` **không** có nghĩa đội code được phép neo final dashboard vào legacy frontend/data plane.  
Thiết kế chuẩn vẫn là SaaS native packages/web + coreApiAdapter; “không đổi backend” chỉ là lý do để frontend phải tự hội tụ vào kiến trúc đó, không phải lý do để giữ monolith cũ.

### 10.2 Optional future enhancement — explicitly out of scope

Nếu sau rollout team muốn giảm client composition complexity, có thể đề xuất workstream khác cho aggregated `dashboard shell summary` endpoint. Điều này **không** thuộc redesign v1 và không được xen vào implementation hiện tại.
