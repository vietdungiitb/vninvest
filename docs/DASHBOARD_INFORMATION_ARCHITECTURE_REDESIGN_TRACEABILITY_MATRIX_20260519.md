# TRACEABILITY MATRIX — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Scope**: 7 slices, 30 requirements

---

## 1. Requirements

| ID | Requirement | Priority | Slice |
|---|---|---|---|
| `DIR-REQ-01` | `Workstation` non-mobile top fold dùng triad 3 cột đều | P0 | `DIR-01`, `DIR-02` |
| `DIR-REQ-02` | `Workstation` đặt heatmap ở center lane; `Classic` đặt heatmap full-width ở hàng 1 | P0 | `DIR-02` |
| `DIR-REQ-03` | FactsFirst deck span full-width ở hàng dưới | P0 | `DIR-03` |
| `DIR-REQ-04` | `StickyAlertBar` bị gỡ khỏi default `/dashboard` | P0 | `DIR-04` |
| `DIR-REQ-05` | `ModernSidebar` bị gỡ khỏi default `/dashboard` | P0 | `DIR-04` |
| `DIR-REQ-06` | `UnifiedAlertCenter` nằm bên trái heatmap trong `Workstation`, và ở hàng 2 trong `Classic` | P0 | `DIR-02` |
| `DIR-REQ-07` | `AIAdvisorAlertPanel` nằm bên phải heatmap trong `Workstation`, và cạnh alert lane ở hàng 2 trong `Classic` | P0 | `DIR-02` |
| `DIR-REQ-08` | Risk/performance metrics còn lại phải nén vào header strip, không giữ sidebar riêng | P1 | `DIR-04` |
| `DIR-REQ-09` | Không thêm backend endpoint mới cho redesign v1 | P0 | `DIR-00`, `DIR-06` |
| `DIR-REQ-10` | Không tăng fetch fan-out so với baseline | P0 | `DIR-06` |
| `DIR-REQ-11` | `DashboardPage.js` có dedicated AI lane slot | P0 | `DIR-01`, `DIR-05` |
| `DIR-REQ-12` | `renderBubble` không còn là top-fold default responsibility | P1 | `DIR-01`, `DIR-05` |
| `DIR-REQ-13` | Package-host route bám cùng IA contract với live route | P0 | `DIR-05` |
| `DIR-REQ-14` | `Workstation` non-mobile giữ 1 hàng 3 cột đều; `Classic` non-mobile giữ heatmap hàng trên và alert + AI hàng dưới | P1 | `DIR-06` |
| `DIR-REQ-15` | Mobile order: heatmap → alert → AI → deck | P1 | `DIR-06` |
| `DIR-REQ-16` | Deck empty state + CTA `Mở Transactions` được giữ | P0 | `DIR-03` |
| `DIR-REQ-17` | `UnifiedAlertCenter` là event truth lane duy nhất trên default route | P0 | `DIR-02`, `DIR-04` |
| `DIR-REQ-18` | AI lane không hiển thị raw alert stream trùng với alert lane | P1 | `DIR-02`, `DIR-04` |
| `DIR-REQ-19` | `frontend/npm run build` PASS sau thay đổi | P0 | `DIR-07` |
| `DIR-REQ-20` | `./start_dev.ps1` PASS sau thay đổi UI/runtime | P0 | `DIR-07` |
| `DIR-REQ-21` | Run code review + run spec audit checklist được thực thi | P0 | `DIR-07` |
| `DIR-REQ-22` | `CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md` được cập nhật | P0 | `DIR-07` |
| `DIR-REQ-23` | Không có overflow ngang / focus trap / scroll trap ở viewport chính | P1 | `DIR-02`, `DIR-06` |
| `DIR-REQ-24` | Tooltip / popover heatmap không bị clip sau relayout | P1 | `DIR-02`, `DIR-06` |
| `DIR-REQ-25` | Kiến trúc đích của dashboard là `PackageDashboardHost -> DashboardPage -> coreApiAdapter -> /core/v1/*` | P0 | `DIR-00`, `DIR-05`, `DIR-07` |
| `DIR-REQ-26` | `ModernDashboard` / `apiClient` / legacy `/api` dashboard path chỉ được xem là transition bridge có owner + expiry | P0 | `DIR-05`, `DIR-07` |
| `DIR-REQ-27` | Không có redesign logic chỉ tồn tại ở legacy monolith path | P0 | `DIR-05`, `DIR-07` |
| `DIR-REQ-28` | Nếu backend bị sửa, thay đổi phải nằm trong `packages/core/backend/` và expose qua `/core/v1/*` | P0 | `DIR-07` |
| `DIR-REQ-29` | Nếu backend contract bị đổi, OpenAPI metadata + PR gate checklist là bắt buộc | P0 | `DIR-07` |
| `DIR-REQ-30` | Final sign-off bị block nếu legacy monolith vẫn là accepted canonical architecture hoặc package-host chưa parity | P0 | `DIR-05`, `DIR-07` |

---

## 2. Requirement → Task mapping

| Requirement | Task IDs | Verification method |
|---|---|---|
| `DIR-REQ-01` | `DIR-01.1`, `DIR-02.1` | Screenshot + grid class/code review |
| `DIR-REQ-02` | `DIR-02.2` | DOM/layout inspection + screenshot |
| `DIR-REQ-03` | `DIR-03.1`, `DIR-03.2` | Screenshot + wrapper span review |
| `DIR-REQ-04` | `DIR-04.1` | Grep no render/import path |
| `DIR-REQ-05` | `DIR-04.2` | Grep no render/import path |
| `DIR-REQ-06` | `DIR-02.3` | DOM order + screenshot |
| `DIR-REQ-07` | `DIR-02.4` | DOM order + screenshot |
| `DIR-REQ-08` | `DIR-04.3` | Header review |
| `DIR-REQ-09` | `DIR-00.1`, `DIR-06.4` | Diff review: no backend files / no new endpoint docs |
| `DIR-REQ-10` | `DIR-06.4` | Network tab / call-count comparison |
| `DIR-REQ-11` | `DIR-01.2`, `DIR-05.1`, `DIR-05.2` | Grep slot contract |
| `DIR-REQ-12` | `DIR-01.2`, `DIR-05.3` | Code review |
| `DIR-REQ-13` | `DIR-05.1`, `DIR-05.2` | Side-by-side screenshot audit |
| `DIR-REQ-14` | `DIR-06.1` | 1024px screenshot |
| `DIR-REQ-15` | `DIR-06.2` | 390px screenshot |
| `DIR-REQ-16` | `DIR-03.3` | Empty-state smoke |
| `DIR-REQ-17` | `DIR-02.3`, `DIR-04.4` | Visual audit + grep |
| `DIR-REQ-18` | `DIR-02.4`, `DIR-04.4` | Visual audit of AI lane contents |
| `DIR-REQ-19` | `DIR-07.1` | `npm run build` |
| `DIR-REQ-20` | `DIR-07.2` | `./start_dev.ps1` |
| `DIR-REQ-21` | `DIR-07.4` | Checklist sign-off |
| `DIR-REQ-22` | `DIR-07.5` | File diff / audit entry |
| `DIR-REQ-23` | `DIR-02.5`, `DIR-06.3` | Manual UI smoke |
| `DIR-REQ-24` | `DIR-02.5`, `DIR-06.3` | Hover/tooltip smoke |
| `DIR-REQ-25` | `DIR-05.4`, `DIR-07.6` | Docs/code review + architecture sign-off |
| `DIR-REQ-26` | `DIR-05.4`, `DIR-07.6` | Evidence has owner+expiry for any bridge |
| `DIR-REQ-27` | `DIR-05.5`, `DIR-07.6` | Diff review of live + host paths |
| `DIR-REQ-28` | `DIR-07.6` | Backend diff review |
| `DIR-REQ-29` | `DIR-07.6` | OpenAPI docs/checklist review |
| `DIR-REQ-30` | `DIR-05.4`, `DIR-05.5`, `DIR-07.6` | Tech lead sign-off |

---

## 3. Slice → Files mapping

| Slice | Files expected to change |
|---|---|
| `DIR-01` | `frontend/src/index.css`, `packages/web/src/pages/DashboardPage.js`, `frontend/src/pages/PackageDashboardHost.jsx` |
| `DIR-02` | `frontend/src/pages/modern/ModernDashboard.jsx`, optional sizing tweaks in `PortfolioHeatmap.jsx`, `UnifiedAlertCenter.jsx`, `AIAdvisorAlertPanel.jsx` |
| `DIR-03` | `frontend/src/pages/modern/ModernDashboard.jsx`, optional layout tweaks in `FactsFirstModularPositionDeck.jsx` |
| `DIR-04` | `frontend/src/pages/modern/ModernDashboard.jsx`, `frontend/src/components/modern/SmartStatsHeader.jsx` |
| `DIR-05` | `frontend/src/pages/PackageDashboardHost.jsx`, `packages/web/src/pages/DashboardPage.js`, optional route smoke helper in `frontend/src/App.jsx` |
| `DIR-06` | `frontend/src/index.css`, `frontend/src/pages/modern/ModernDashboard.jsx`, `frontend/src/pages/PackageDashboardHost.jsx`, `packages/web/src/pages/DashboardPage.js` |
| `DIR-07` | `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md` |

---

## 4. Residual-risk registry

| Risk ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| `DIR-R-01` | Slot rename breaks package-host integration | M | H | Update host + page in same slice |
| `DIR-R-02` | Heatmap tooltip clipped by overflow wrappers | M | H | Explicit hover test in `DIR-02.5` |
| `DIR-R-03` | Removing sidebar loses metrics some users value | M | M | Compact metrics strip in header |
| `DIR-R-04` | Alert duplication still leaks via AI lane content | L | M | Manual content audit + review checklist |
| `DIR-R-05` | Layout looks correct in live route but not in package-host route | H | H | Blocking parity gate in `DIR-05` |
