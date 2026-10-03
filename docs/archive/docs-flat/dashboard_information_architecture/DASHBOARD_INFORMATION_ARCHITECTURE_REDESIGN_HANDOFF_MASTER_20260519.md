# HANDOFF MASTER — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Trạng thái**: APPROVED FOR DESIGN HANDOFF  
**Phiên bản**: 1.0  
**Phạm vi**: Tái cấu trúc `/dashboard` thành heatmap-centered control center, loại bỏ khối trùng lặp/ít giá trị, và khóa parity layout giữa `ModernDashboard` với `PackageDashboardHost` / `DashboardPage`

---

## 1. Vì sao cần workstream này

### Audit hiện trạng

`/dashboard` hiện vẫn route vào `frontend/src/pages/modern/ModernDashboard.jsx`, không phải `PackageDashboardHost`.

Audit code hiện tại cho thấy các vấn đề cấu trúc sau:

| Thành phần | Hiện trạng | Vấn đề UX/IA |
|---|---|---|
| Top fold | Heatmap + Unified Alert Center nằm ở main rail 2 cột; AI panel + ModernSidebar nằm ở side rail | Trọng tâm nhận thức bị tách đôi; heatmap chưa đóng vai trò trung tâm thị giác |
| Alert surfaces | `StickyAlertBar`, `UnifiedAlertCenter`, `ModernSidebar` live stream cùng hiển thị tín hiệu | Trùng lặp tín hiệu, gây nhiễu và lãng phí không gian dọc |
| FactsFirst deck | `FactsFirstModularPositionDeck` nằm dưới main rail, chỉ span 2 cột | Khối hành động quan trọng nhất chưa được cấp đủ chiều ngang |
| Package-host parity | `DashboardPage.js` chưa có dedicated AI lane slot; `renderBubble` đang không dùng | Nếu redesign chỉ sửa `ModernDashboard`, route swap sau này sẽ drift giao diện |
| Sidebar analytics | `ModernSidebar` chứa risk metrics + charts + live signal stream | Giá trị thấp hơn top-fold triad, nhưng chiếm nhiều chiều cao và kéo user khỏi task chính |

### Quyết định sản phẩm được chốt trong workstream này

1. `Workstation` non-mobile phải nén top area thành 1 hàng 3 cột đều nhau: `Unified Alert Center | Portfolio Heatmap | AI Alerts / AI News`.
2. `Classic` non-mobile giữ bố cục 2 hàng: `Portfolio Heatmap` full-width ở hàng trên, `Unified Alert Center | AI Alerts / AI News` ở hàng dưới.
3. `FactsFirstModularPositionDeck` xuống hàng dưới và chiếm full 3 cột.
4. `StickyAlertBar` và `ModernSidebar` bị loại khỏi default dashboard route.
5. Mọi risk metrics còn giữ lại phải được nén thành micro-metrics trong `SmartStatsHeader`, không giữ một sidebar riêng.

---

## 2. Target information architecture

### Workstation non-mobile >= 768px

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ SmartStatsHeader                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Unified Alert Center │ Portfolio Heatmap │ AI Alerts / AI News         │
│ Equal-width lane     │ Equal-width lane  │ Equal-width lane            │
├──────────────────────────────────────────────────────────────────────────┤
│ FactsFirst Modular Position Deck (full-width 3 columns)                │
│ scope filter • symbol filter • overview • technical • whale • AI tabs  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Classic non-mobile >= 768px

```text
SmartStatsHeader
Portfolio Heatmap
Unified Alert Center | AI Alerts/News
FactsFirst Deck (full-width)
```

### Mobile < 768px

```text
SmartStatsHeader
Portfolio Heatmap
Unified Alert Center
AI Alerts / AI News
FactsFirst Deck
```

---

## 3. Mục tiêu công việc

### Trong scope

- Re-layout desktop/tablet/mobile cho dashboard theo triad + full-width deck.
- Giữ `Classic` mode nguyên trạng; chỉ nén `Workstation` top triad thành 1 hàng 3 cột đều nhau ở non-mobile.
- Loại bỏ alert duplication trên default route.
- Di dời các risk/performance metrics hữu ích từ `ModernSidebar` lên header strip gọn.
- Chuẩn hóa slot contract ở `DashboardPage.js` để hỗ trợ AI lane thay vì bubble lane.
- Đảm bảo cùng một layout contract tồn tại ở `ModernDashboard` và `PackageDashboardHost` / `DashboardPage`.
- Cập nhật checklist, taskboard, review/test/spec-audit docs đủ cho team code và QA thực hiện.

### Ngoài scope

- Không thay đổi backend alert algorithms, AI recommendation algorithms, hay heatmap data semantics.
- Không thêm endpoint backend mới cho v1 redesign.
- Không redesign `WhaleBubbleChart`, `WhaleAnalyticsTab`, hoặc `ModularPositionDeck` immutable sources.
- Không đổi route `/dashboard` sang package-host nếu parity visual chưa đạt.

---

## 4. Các phase / slices

| Slice | Mục tiêu | Kết quả chính |
|---|---|---|
| `DIR-00` | Freeze acceptance + baseline audit | Lock target layout, route strategy, screenshots baseline |
| `DIR-01` | Shared layout contract | CSS/grid primitives + slot contract update |
| `DIR-02` | Top area live route | `Workstation`: alert left, heatmap center, AI right; `Classic`: heatmap row 1, alert + AI row 2 trên `ModernDashboard` |
| `DIR-03` | Full-width deck | `FactsFirstModularPositionDeck` span 3 cột, empty-state giữ CTA rõ |
| `DIR-04` | Rationalize content | Remove `StickyAlertBar`, remove `ModernSidebar`, move useful metrics to header |
| `DIR-05` | Package-host parity | `PackageDashboardHost` + `DashboardPage` match IA mới |
| `DIR-06` | Responsive + accessibility | Tablet/mobile order, scroll behavior, keyboard/contrast |
| `DIR-07` | Validation + evidence | Build, runtime refresh, screenshots, spec audit, ledger/progress sync |

---

## 5. Dependency graph

```text
DIR-00
  ↓
DIR-01 → DIR-02 → DIR-03 → DIR-04 → DIR-05 → DIR-06 → DIR-07
```

`DIR-05` không được bắt đầu nếu layout contract chưa khóa ở `DIR-01`.  
`DIR-07` là blocking gate trước khi đánh dấu workstream complete.

---

## 6. Anchor files

### Frontend — live route

- `frontend/src/pages/modern/ModernDashboard.jsx`
- `frontend/src/index.css`
- `frontend/src/App.jsx`
- `frontend/src/components/PortfolioHeatmap.jsx`
- `frontend/src/components/UnifiedAlertCenter.jsx`
- `frontend/src/components/modern/AIAdvisorAlertPanel.jsx`
- `frontend/src/components/modern/FactsFirstModularPositionDeck.jsx`
- `frontend/src/components/modern/SmartStatsHeader.jsx`
- `frontend/src/components/StickyAlertBar.jsx`
- `frontend/src/components/modern/ModernSidebar.jsx`

### Frontend — package-host / future route surface

- `frontend/src/pages/PackageDashboardHost.jsx`
- `packages/web/src/pages/DashboardPage.js`
- `packages/web/src/features/dashboard/useCoreDashboardData.js`

### Backend — inventory only, default no change

- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
- `packages/core/backend/src/signal_intelligence/*` (alert feed inventory)

---

## 7. Hard constraints

1. `Workstation` non-mobile top fold phải là 3-lane triad đều nhau: alert left, heatmap center, AI right.
2. `Classic` non-mobile phải giữ heatmap full-width ở hàng trên và alert + AI ở hàng dưới.
3. `FactsFirstModularPositionDeck` phải nằm hàng dưới và span full-width.
4. `StickyAlertBar` không được mount trên default `/dashboard` sau redesign.
5. `ModernSidebar` không được mount trên default `/dashboard` sau redesign.
6. Không tạo fetch mới ngoài các nguồn dữ liệu dashboard hiện đang có, trừ khi được phê duyệt riêng.
7. `DashboardPage.js` phải có dedicated AI lane slot; `renderBubble` không còn là top-fold default lane.
8. Text UI mới phải dùng tiếng Việt đầy đủ dấu theo chuẩn i18n của repo.
9. Không đóng workstream nếu `ModernDashboard` và `PackageDashboardHost` vẫn drift layout contract.
10. Sau mọi code slice UI/runtime, bắt buộc refresh stack qua `./start_dev.ps1` trước final evidence.

## 8. SaaS native + OpenAPI architecture hard constraints

1. Kiến trúc đích của dashboard là:

```text
Browser
→ /dashboard
→ PackageDashboardHost (frontend/src host bridge only)
→ DashboardPage (@vninvest/web)
→ coreApiAdapter
→ /core/v1/* core-api endpoints
```

2. `frontend/src/pages/modern/ModernDashboard.jsx`, `frontend/src/api/client.js`, và bất kỳ call path legacy `/api/*` nào chỉ được tồn tại như bridge chuyển tiếp để parity, **không bao giờ** được xem là end-state hợp lệ của workstream này.
3. Đội code **không được** chốt redesign bằng cách chỉ sửa `ModernDashboard` rồi để `PackageDashboardHost` / `DashboardPage` đứng ngoài hoặc stale.
4. Mọi logic dashboard mới phải được phản ánh vào bề mặt SaaS native (`packages/web/src/` + `coreApiAdapter`) trước khi được xem là complete.
5. Nếu redesign buộc phải đổi backend/API contract, thay đổi đó phải đi vào `packages/core/backend/`, phải expose qua `/core/v1/*`, và phải tuân thủ `CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` cùng `CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`.
6. Nghiêm cấm tạo compat route, proxy route, hoặc endpoint business mới trên legacy monolith chỉ để phục vụ dashboard redesign.
7. Nghiêm cấm thêm `apiClient`, direct fetch, hoặc dashboard-specific data logic mới như lời giải dài hạn trong `frontend/src/` ngoài vai trò host bridge.
8. Nếu vì lý do chuyển tiếp vẫn còn bridge legacy sau một slice, evidence bắt buộc phải ghi rõ: owner, expiry, và điều kiện xóa. Không có owner+expiry thì slice không được PASS.
9. Final sign-off bị block nếu team vẫn giữ “dashboard legacy monolith route” là kiến trúc chuẩn hoặc roadmap đích.

---

## 9. Evidence obligations

Mỗi slice phải có:

1. Danh sách file thay đổi.
2. Command validation và kết quả.
3. Screenshot desktop/tablet/mobile nếu có UI change.
4. Residual risk note nếu còn.
5. Ledger/progress update trước khi mark DONE.

Template nằm tại:

- `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_EXECUTION_EVIDENCE_TEMPLATE_20260519.md`

---

## 10. Deliverables của doc pack này

| Loại tài liệu | File |
|---|---|
| Handoff master | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_HANDOFF_MASTER_20260519.md` |
| Implementation plan | `docs/IMPLEMENTATION_PLAN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Tech spec | `docs/TECH_SPEC_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Taskboard | `docs/TASKBOARD_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Traceability matrix | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_TRACEABILITY_MATRIX_20260519.md` |
| Self-audit & test protocol | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md` |
| Execution evidence template | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_EXECUTION_EVIDENCE_TEMPLATE_20260519.md` |
| Config ownership matrix | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CONFIG_OWNERSHIP_MATRIX_20260519.md` |
| Code quality constitution | `docs/DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_CODE_QUALITY_CONSTITUTION_20260519.md` |
| Frontend design | `docs/FRONTEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Backend design | `docs/BACKEND_DESIGN_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Run code review | `docs/RUN_CODE_REVIEW_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Run integration tests | `docs/RUN_INTEGRATION_TESTS_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
| Run spec audit | `docs/RUN_SPEC_AUDIT_DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_20260519.md` |
