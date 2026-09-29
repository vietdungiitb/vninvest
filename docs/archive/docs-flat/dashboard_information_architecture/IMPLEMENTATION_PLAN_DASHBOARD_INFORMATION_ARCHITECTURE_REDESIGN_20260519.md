# IMPLEMENTATION PLAN — Dashboard Information Architecture Redesign

**Ngày lập**: 2026-05-19  
**Scope**: Re-layout `/dashboard` để dễ quét thông tin hơn, giảm trùng lặp, tăng diện tích cho FactsFirst deck, và khóa parity giữa live route với package-host route.

---

## 1. Hiện trạng vs mục tiêu

| Thành phần | Hiện trạng | Mục tiêu |
|---|---|---|
| Top fold | Heatmap + Alert Center ở main rail; AI + sidebar ở side rail | `Workstation`: Alert Center | Heatmap | AI trên 1 hàng 3 cột đều; `Classic`: Heatmap hàng 1, Alert Center | AI hàng 2 |
| FactsFirst deck | Span 2 cột dưới main rail | Span full 3 cột ở hàng dưới |
| Alert duplication | Sticky bar + alert center + live stream | Một alert lane chính, không lặp lại cùng loại thông tin |
| Risk/performance metrics | Nằm trong `ModernSidebar` riêng | Nén thành micro-metrics trong header |
| Package-host | Chưa có AI slot, `renderBubble` đang trống | Slot contract mới hỗ trợ AI lane, bubble bị de-prioritize |
| Backend | Không có lý do phải đổi contract | Giữ nguyên contract, frontend-only rollout |

---

## 2. Scope

### Trong scope

- Chuyển layout current route `ModernDashboard` sang mô hình triad + full-width deck.
- Giữ `Classic` non-mobile ở bố cục 2 hàng và chỉ nén `Workstation` non-mobile thành 1 hàng 3 cột đều.
- Cập nhật `DashboardPage.js` và `PackageDashboardHost.jsx` để cùng theo IA contract mới.
- Loại bỏ render của `StickyAlertBar` và `ModernSidebar` trên default dashboard route.
- Đưa metrics hữu ích lên `SmartStatsHeader` dưới dạng compact chips.
- Bảo toàn dữ liệu hiện có, không tăng fetch fan-out.

### Ngoài scope

- Không thay thuật toán cảnh báo, AI advisor, hay heatmap transform.
- Không thêm endpoint backend tổng hợp dashboard.
- Không rewrite `FactsFirstModularPositionDeck` business logic ngoài phần layout/props cần thiết.
- Không mở thêm panel phụ mới để thay thế sidebar vừa bỏ.

---

## 3. Architecture notes

1. `/dashboard` hiện đang dùng `ModernDashboard`; đây là first delivery surface.
2. `PackageDashboardHost` / `DashboardPage` phải được update trong cùng workstream để tránh drift khi route swap quay lại.
3. `renderBubble` không còn phù hợp với top-fold priorities của dashboard; slot contract nên đổi thành `renderAiPanel` hoặc equivalent dedicated AI lane.
4. Backend giữ nguyên. Nếu team cảm thấy thiếu aggregate endpoint, phải mở workstream riêng; không được scope-creep ở đây.
5. Kiến trúc đích **không phải** `ModernDashboard + apiClient`; đó chỉ là parity bridge tạm thời. End-state hợp lệ là `PackageDashboardHost -> DashboardPage -> coreApiAdapter -> /core/v1/*`.
6. Nếu vì bất kỳ lý do nào phải đổi API/backend, thay đổi phải ở `packages/core/backend/` và tuân thủ OpenAPI contract-first, không được vá `backend/` legacy monolith hoặc mở thêm compat `/api` business route.

---

## 4. Task breakdown overview

| Slice | Tên | Artifact chính | DoD cấp slice |
|---|---|---|---|
| `DIR-00` | Acceptance Freeze | screenshots baseline, IA contract | Product/engineering sign-off cho target layout |
| `DIR-01` | Shared Layout Contract | `index.css`, `DashboardPage.js` contract | Slot/grid contract mới được khóa |
| `DIR-02` | Live Top Area Contract | `ModernDashboard.jsx` | `Workstation`: alert left, heatmap center, AI right; `Classic`: heatmap row 1, alert + AI row 2 |
| `DIR-03` | Full-width Deck | `ModernDashboard.jsx`, deck wrapper | FactsFirst deck span 3 cột, empty state rõ |
| `DIR-04` | Remove Low-value Blocks | `ModernDashboard.jsx`, `SmartStatsHeader.jsx` | Sticky bar + sidebar removed, metrics retained in header |
| `DIR-05` | Package-host Parity | `PackageDashboardHost.jsx`, `DashboardPage.js` | Host route phản ánh cùng IA |
| `DIR-06` | Responsive + A11y Hardening | `index.css`, panel components | Tablet/mobile behavior và keyboard/contrast ổn |
| `DIR-07` | Validation + Evidence | docs ledger/progress + screenshots | Build/runtime/spec audit complete |

---

## 5. Dependency graph

```text
DIR-00
  ↓
DIR-01 → DIR-02 → DIR-03 → DIR-04 → DIR-05 → DIR-06 → DIR-07
```

---

## 6. Slice details

### Slice `DIR-00` — Acceptance Freeze

**Mục tiêu:** Khóa phạm vi, target layout, và baseline visual trước khi code.

**Files bị ảnh hưởng:**
- `docs/*DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN*_20260519.md` (CREATE)

**Tasks:**
1. Capture baseline audit findings từ code hiện tại.
2. Chốt target IA: triad top fold + full-width deck.
3. Chốt rule “không backend changes cho v1”.
4. Chốt KPI review và evidence obligations.

**DoD:**
- [ ] Handoff master + plan + tech spec + taskboard tồn tại.
- [ ] Target wireframe desktop/tablet/mobile được mô tả rõ.
- [ ] Scope/out-of-scope không còn ambiguity.

**Không thuộc scope slice này:**
- Không sửa code runtime.

---

### Slice `DIR-01` — Shared Layout Contract

**Mục tiêu:** Tạo contract layout dùng chung cho live route và package-host route.

**Files bị ảnh hưởng:**
- `frontend/src/index.css` (MODIFY)
- `packages/web/src/pages/DashboardPage.js` (MODIFY)
- `frontend/src/pages/PackageDashboardHost.jsx` (MODIFY)

**Interface / signature cần implement:**

```js
// DashboardPage slot contract sau redesign
renderStats({ summary, analytics, loading, onRefresh })
renderAlertLane({ alerts, alertSummary, loading })
renderHeatmap({ holdings, quotesBySymbol, loading })
renderAiPanel({ holdings, technicals, analytics, digest, loading })
renderDeck({ holdings, technicals, analytics, loading })
```

**Test cases bắt buộc:**
1. `DashboardPage` không còn phụ thuộc `renderBubble` cho top fold.
2. Khi `renderAiPanel` chưa được inject, fallback không phá layout.
3. Grid contract tách rõ theo mode: `Workstation` dùng 3 cột đều, `Classic` dùng heatmap span toàn hàng trên.

**DoD:**
- [ ] `DashboardPage` có AI lane slot rõ ràng.
- [ ] `renderBubble` bị deprecate hoặc loại khỏi default route contract.
- [ ] Có class/grid contract dùng lại được cho cả 2 surfaces.

**Không thuộc scope:**
- Không chỉnh business logic của AI advisor.

---

### Slice `DIR-02` — Live Top Triad

**Mục tiêu:** Áp contract top area mới vào `ModernDashboard`: `Workstation` là một hàng 3 cột đều, `Classic` là heatmap hàng trên + alert/AI hàng dưới.

**Files bị ảnh hưởng:**
- `frontend/src/pages/modern/ModernDashboard.jsx` (MODIFY)
- `frontend/src/components/PortfolioHeatmap.jsx` (MODIFY nếu cần height/props wrapper)
- `frontend/src/components/UnifiedAlertCenter.jsx` (MODIFY nếu cần sizing only)
- `frontend/src/components/modern/AIAdvisorAlertPanel.jsx` (MODIFY nếu cần sizing only)

**Tasks:**
1. Tạo contract mode-specific thay cho `lg:grid-cols-2` + side rail.
2. Với `Workstation`, giữ `PortfolioHeatmap` ở cột giữa, `UnifiedAlertCenter` ở trái, `AIAdvisorAlertPanel` ở phải trên 1 hàng 3 cột đều.
3. Với `Classic`, giữ `PortfolioHeatmap` full-width ở hàng trên.
4. Với `Classic`, đặt `UnifiedAlertCenter` và `AIAdvisorAlertPanel` cạnh nhau ở hàng dưới.
5. Đồng bộ chiều cao top-row và scroll nội bộ của 2 lane bên.

**Test cases bắt buộc:**
1. `Workstation` desktop 1440px hiển thị đủ 3 panel trong cùng một fold đầu.
2. `Classic` non-mobile giữ `Heatmap` ở hàng 1 và `Alert + AI` ở hàng 2.
3. Alert lane và AI lane đều scroll nội bộ, không kéo cả page khi chưa cần.
4. Tooltip heatmap không bị cắt bởi container mới.

**DoD:**
- [ ] `Workstation` non-mobile có top row là 3 panel ngang đều nhau.
- [ ] `Classic` non-mobile có heatmap hàng trên, alert + AI hàng dưới.
- [ ] Không có overflow ngang.

**Không thuộc scope:**
- Không thay đổi feed data hoặc alert severity logic.

---

### Slice `DIR-03` — Full-width FactsFirst Deck

**Mục tiêu:** Đưa khối điều phối mã xuống hàng dưới và cấp full-width.

**Files bị ảnh hưởng:**
- `frontend/src/pages/modern/ModernDashboard.jsx` (MODIFY)
- `frontend/src/components/modern/FactsFirstModularPositionDeck.jsx` (MODIFY layout-only nếu cần)

**Tasks:**
1. Chuyển `FactsFirstModularPositionDeck` xuống hàng dưới của page grid.
2. Wrapper span 3 cột ở desktop.
3. Giữ toolbar scope/symbol ở vùng đầu khối.
4. Bảo toàn empty state “Không có mã trong phạm vi đã chọn” + CTA “Mở Transactions”.

**Test cases bắt buộc:**
1. Empty state vẫn full-width, không bị nén trong 2 cột.
2. Bảng overview và technical tabs có thêm không gian ngang đủ đọc.
3. Không phát sinh double scroll khó chịu trong deck wrapper.

**DoD:**
- [ ] Deck span full-width hàng dưới.
- [ ] Empty state và CTA vẫn dễ nhìn.
- [ ] Table tabs không bị clip cột.

**Không thuộc scope:**
- Không thêm tab business logic mới.

---

### Slice `DIR-04` — Remove Low-value Blocks and Deduplicate Signals

**Mục tiêu:** Loại bỏ clutter, giữ lại thông tin có giá trị bằng cách nén lên header.

**Files bị ảnh hưởng:**
- `frontend/src/pages/modern/ModernDashboard.jsx` (MODIFY)
- `frontend/src/components/StickyAlertBar.jsx` (MODIFY only if import cleanup needed elsewhere)
- `frontend/src/components/modern/ModernSidebar.jsx` (no default render path)
- `frontend/src/components/modern/SmartStatsHeader.jsx` (MODIFY)

**Tasks:**
1. Gỡ `StickyAlertBar` khỏi default route.
2. Gỡ `ModernSidebar` khỏi default route.
3. Chọn tối đa 4 metrics từ sidebar để nén lên header: `alpha`, `beta`, `sharpe`, `max_drawdown`.
4. Đảm bảo không còn live signal duplication ngoài `UnifiedAlertCenter`.

**Test cases bắt buộc:**
1. Không còn 3 surface cùng nói về alerts ở fold đầu.
2. Risk metrics vẫn đọc được nhanh trong header.
3. Không có import dead code gây build warning.

**DoD:**
- [ ] `StickyAlertBar` không còn render trong `/dashboard`.
- [ ] `ModernSidebar` không còn render trong `/dashboard`.
- [ ] Header có micro-metrics đủ gọn, không tạo hàng thứ hai quá cao.

**Không thuộc scope:**
- Không xóa file source nếu còn được dùng ở route khác.

---

### Slice `DIR-05` — Package-host Parity

**Mục tiêu:** Khóa parity với bề mặt `PackageDashboardHost` / `DashboardPage` và đưa package-host trở thành kiến trúc chuẩn, không cho phép legacy monolith là end-state.

**Files bị ảnh hưởng:**
- `frontend/src/pages/PackageDashboardHost.jsx` (MODIFY)
- `packages/web/src/pages/DashboardPage.js` (MODIFY)
- `frontend/src/App.jsx` (MODIFY only nếu cần thêm route smoke hoặc switch strategy)

**Tasks:**
1. Update slot injection ở host để có AI lane mới.
2. Recompose page shell trong `DashboardPage.js` thành stats + triad + deck.
3. Ensure same ordering với `ModernDashboard`.
4. Nếu `renderBubble` còn tồn tại, mark deprecated và không dùng ở default dashboard layout.
5. Ghi rõ trong code/docs rằng `ModernDashboard` chỉ là parity bridge; không được coi là kiến trúc canonical.

**Test cases bắt buộc:**
1. `PackageDashboardHost` render được alert lane, heatmap, AI lane, deck.
2. Route smoke của host không còn panel drift so với live route.
3. Không import trực tiếp `frontend/src` từ `packages/web`.

**DoD:**
- [ ] Package-host bám cùng IA contract.
- [ ] No direct import rule vẫn sạch.
- [ ] Route parity diff chỉ còn cosmetic chấp nhận được.
- [ ] Không còn ambiguity rằng kiến trúc đích là SaaS native package-host path.

**Không thuộc scope:**
- Không bắt buộc switch `/dashboard` sang package-host trong slice này nếu parity chưa sign-off.

---

### Slice `DIR-06` — Responsive, Accessibility, Performance Hardening

**Mục tiêu:** Đảm bảo layout mới dùng được ở mọi viewport chính mà không tăng tải kỹ thuật.

**Files bị ảnh hưởng:**
- `frontend/src/index.css` (MODIFY)
- `frontend/src/pages/modern/ModernDashboard.jsx` (MODIFY)
- `frontend/src/pages/PackageDashboardHost.jsx` (MODIFY)
- `packages/web/src/pages/DashboardPage.js` (MODIFY)

**Tasks:**
1. Tablet/small-desktop workstation: giữ alert + heatmap + AI trong 1 hàng 3 cột đều nhau.
2. Classic non-mobile: giữ heatmap full-width hàng trên và alert + AI ở hàng dưới.
3. Mobile: stack theo thứ tự heatmap → alert → AI → deck.
4. Keyboard order, focus states, readable overflow, scrollbars rõ.
5. Kiểm tra top-row không gây layout shift mạnh sau realtime updates.

**Test cases bắt buộc:**
1. 390px, 768px, 1024px, 1280px, 1440px đều usable.
2. Tabbing đi qua header → alert lane → heatmap controls → AI lane → deck controls.
3. Không có extra fetch hoặc re-render storm vì đổi layout.

**DoD:**
- [ ] Responsive states rõ ràng.
- [ ] Contrast và focus states đủ dùng.
- [ ] No measurable API fan-out increase.

**Không thuộc scope:**
- Không tối ưu lại business polling cadence.

---

### Slice `DIR-07` — Validation, Evidence, Rollout

**Mục tiêu:** Chốt evidence đầy đủ để coder khác hoặc auditor có thể tiếp tục ngay.

**Files bị ảnh hưởng:**
- `CODE_CHANGE_AUDIT_LEDGER.md` (MODIFY)
- `PROGRESS_DASHBOARD.md` (MODIFY)
- `module_tree_full.md` (regenerate nếu source code đổi)
- `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_EXECUTION_EVIDENCE_TEMPLATE_20260519.md` (USE)

**Tasks:**
1. `npm run build`.
2. `./start_dev.ps1` refresh.
3. Browser smoke desktop/tablet/mobile.
4. Screenshot capture.
5. Code review checklist + spec audit checklist.

**DoD:**
- [ ] Build PASS.
- [ ] Runtime refresh PASS.
- [ ] Smoke screenshots đủ 3 viewport.
- [ ] Ledger/progress update xong.

**Không thuộc scope:**
- Không commit/push nếu chưa được user yêu cầu riêng.

---

## 7. Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `DashboardPage` slot contract change làm drift các call sites hiện tại | M | M | Chỉ đổi contract trong cùng slice `DIR-05`, update host cùng lúc |
| Heatmap/top-area panel bị clip tooltip sau grid change | M | H | Validate hover/resize ở `DIR-02` và `DIR-06` |
| Bỏ sidebar làm mất một phần metrics quen dùng | M | M | Di chuyển metrics giá trị cao lên `SmartStatsHeader` thay vì xóa trắng |
| Layout parity giữa live route và package-host bị lệch | H | H | Bắt buộc `DIR-05` trước close |
| Team vô tình thêm fetch mới để “làm đẹp panel” | M | M | Hard rule: no backend change and no new fetch fan-out |

---

## 8. Validation gates

- [ ] `frontend: npm run build` PASS
- [ ] `./start_dev.ps1` PASS sau mỗi code slice UI/runtime
- [ ] Desktop 1440px screenshot PASS
- [ ] Tablet 1024px screenshot PASS
- [ ] Mobile 390px screenshot PASS
- [ ] `StickyAlertBar` không còn trên default route
- [ ] `ModernSidebar` không còn trên default route
- [ ] Package-host parity checklist PASS
- [ ] Không có dashboard logic mới chỉ tồn tại ở legacy monolith path
- [ ] Không có dashboard-specific backend change nào chui vào `backend/` legacy
- [ ] Nếu backend contract bị đổi: `/core/v1/*` only + OpenAPI metadata updated + PR gate checklist PASS
- [ ] `CODE_CHANGE_AUDIT_LEDGER.md` updated
- [ ] `PROGRESS_DASHBOARD.md` updated

## 9. SaaS native / OpenAPI compliance gate

Workstream này chỉ được coi là COMPLETE khi đồng thời thỏa mãn:

1. Kiến trúc canonical đã được chốt là `PackageDashboardHost -> DashboardPage -> coreApiAdapter -> /core/v1/*`.
2. `ModernDashboard` nếu còn tồn tại chỉ là transition bridge có owner + expiry.
3. Không có yêu cầu nào buộc production đích phải tiếp tục phụ thuộc `apiClient` hay legacy `/api` dashboard path.
4. Nếu backend có thay đổi ngoài dự kiến, thay đổi đó đã qua OpenAPI constitution + PR gate checklist và không chạm `backend/` legacy monolith như giải pháp dài hạn.
