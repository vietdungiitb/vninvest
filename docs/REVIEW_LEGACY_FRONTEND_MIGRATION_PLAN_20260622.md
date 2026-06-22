# Phản Biện: Kế Hoạch Di Trú Legacy Frontend sang SaaS Native

* **Tài liệu gốc:** `LEGACY_FRONTEND_MIGRATION_IMPLEMENTATION_PLAN_20260622.md`
* **Ngày phản biện:** 2026-06-22
* **Trạng thái:** Draft for Discussion
* **Người phản biện:** AI Session Review

---

## Tổng quan

Tài liệu kế hoạch di trú có cấu trúc tốt,覆盖面 rộng, và xác định đúng các vấn đề cốt lõi của hệ thống hybrid hiện tại. Tuy nhiên, có **9 nhóm vấn đề lớn** cần được giải quyết trước khi tài liệu có thể được approve để triển khai.

---

## 1. Thiếu liên kết với AGENTS.md và các hard constraints hiện có

### 1.1 Không đề cập §8 Hard constraints for SaaS Migration
- Rule #8: *"Tất cả API calls từ packages/web phải qua coreApiAdapter.js — không direct fetch"* — đây là yêu cầu bắt buộc, nhưng plan chỉ đề cập như một convention tùy chọn.
- Rule #9: *"Text mới trong packages/web phải qua i18n tiếng Việt đầy đủ dấu"* — cần được đưa vào DoD với verification cụ thể.

### 1.2 Không tham chiếu các feature pack docs đã có
Các route đang được migrate đã có spec riêng trong các tài liệu trước:
- `/dashboard` → `DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN_*` (heatmap center, alert lane, AI lane, FactsFirstModularPositionDeck)
- `/stocks/:symbol` → `WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_*` (KLine chart, whale markers, selected-session binding)
- `/watchlist` → `GLOBAL_MARKET_DATA_MATRIX_SSOT_*` (global symbol registry, demand sources)

**Rủi ro:** Plan này có thể implement sai nghiệp vụ nếu không follow các spec đã có.

### 1.3 Không đề cập §10 OpenAPI standardization constraints
- Mọi API contract mới phải có OpenAPI metadata
- Endpoint list phải có pagination
- Endpoint auth phải có rate limit policy
- Cấm `except: pass` trong API path

---

## 2. Gap Analysis — thiếu chiều sâu

### 2.1 Bảng 2.1 (Pages) — thiếu cột quan trọng
| Thiếu | Lý do |
|-------|-------|
| **Dependency risk** | `StockDetail.jsx` phụ thuộc vào `KLineChartPanel`, `OrderFlowRadarPanel`, `WhaleBubbleChart` — không có thông tin này, estimate không chính xác |
| **Component con** | Mỗi page dùng những shared components nào? Đang ở legacy hay packages/web? |
| **Backend readiness** | API endpoint cho page đó đã có trong core-api chưa? |

### 2.2 Bảng 2.2 (API Functions) — phân loại chưa đủ
- 38 hàm được liệt kê nhưng không phân biệt được:
  - Endpoint nào **đã có** trong `packages/core`?
  - Endpoint nào **chỉ tồn tại** ở legacy backend?
  - Endpoint nào **cần viết mới** cả backend lẫn frontend?

**Ví dụ:** `/stock-management/` routes — đã có trong core-api chưa? Nếu chưa, đây là backend work, không phải frontend work.

### 2.3 Thiếu shared components mapping
Các component dùng chung như `Modal`, `DataTable`, `ChartWrapper`, `i18n provider` đang ở đâu? Cần bảng mapping rõ ràng:
```
Legacy component → packages/web equivalent → Trạng thái
```

---

## 3. Lộ trình 7 giai đoạn — vấn đề nghiêm trọng

### 3.1 Giai đoạn 0 (1 ngày) — Security concern
- "Đồng nhất localStorage JWT token" — AGENTS.md §9 rule #6 yêu cầu *PAT hash phải dùng HMAC với pepper, tuyệt đối không plain SHA-256*.
- Nếu localStorage đang lưu plain JWT, đây là **security remediation**, không phải "đồng nhất".
- **Đề xuất:** Làm rõ cơ chế token storage hiện tại và plan remediation cụ thể.

### 3.2 Giai đoạn 1 (3 ngày cho 38 hàm) — quá optimistic
- 38 hàm / 3 ngày ≈ **13 hàm/ngày**
- Mỗi hàm cần: type definition, adapter implementation, unit test, error handling, i18n error messages, OpenAPI metadata
- **Đề xuất:** Tăng lên 5-7 ngày hoặc giảm scope (chỉ migrate hàm critical trước).

### 3.3 Giai đoạn 2 (2 ngày) — critical path blocker bị bỏ qua
- "Vá lỗi cú pháp `coreApiAdapter({ env })` và lỗi chính tả `coreApiReload()`"
- Nếu đây là bug đang tồn tại, **tại sao không fix trước khi bắt đầu migration?**
- **Đề xuất:** Đưa thành pre-requisite, không nằm trong giai đoạn 2.

### 3.4 Giai đoạn 3 (5 ngày) — underestimate nghiêm trọng

| Trang | Legacy size | Độ phức tạp | Estimate thực tế |
|-------|-------------|-------------|------------------|
| `StockDetailPage.tsx` | 141KB | Rất cao (KLine, whale markers, selected-session) | 2-3 ngày |
| `WatchlistPage.tsx` | 79KB | Cao (WebSocket heavy, realtime updates) | 1-2 ngày |
| `ScreenerPage.tsx` | 17.9KB | Trung bình (build mới hoàn toàn) | 1-2 ngày |
| 9 trang Admin Core | ~100KB tổng | Cao (gộp thành 1 module, sub-routing) | 2-3 ngày |
| `SOCPage.tsx` | Unknown | Cao (nâng cấp shell page lên page thật) | 1 ngày |
| Các trang còn lại (10 trang) | ~200KB tổng | Trung bình | 3-4 ngày |

**Tổng estimate thực tế:** 10-15 ngày, không phải 5 ngày.

### 3.5 Giai đoạn 4 (1 ngày) — external dependency risk
- "Clone và đóng gói VNStockCharts KLine engine" — nếu repo private, cần auth token. Nếu có breaking changes, 1 ngày không đủ.
- **Đề xuất:** Thêm buffer 1-2 ngày và test build trước khi bắt đầu giai đoạn này.

### 3.6 Giai đoạn 5 (Shadow Run 3-5 ngày) — thiếu parity metrics
- AGENTS.md §9 rule #6 yêu cầu *parity_score >= 0.99*.
- Plan không định nghĩa **parity score đo như thế nào**, trên những tiêu chí nào.
- **Đề xuất:** Bổ sung parity checklist cụ thể (API response match, UI pixel match, WebSocket message match, error handling match).

### 3.7 Giai đoạn 6 (0.5 ngày) — thiếu decommission checklist
- "Xóa bỏ hoàn toàn thư mục `frontend/`" — AGENTS.md §1 nói *"frontend/ cũ sẽ bị xóa bỏ hoàn toàn ngay khi toàn bộ các thành phần đã được chuyển đổi hết"*.
- **Đề xuất:** Bổ sung 7 pre-decommission gates (A-G) theo AGENTS.md §8 rule #4, với Tech Lead sign-off.

---

## 4. Quy chuẩn kỹ thuật — vấn đề với `createElement`

### 4.1 Anti-pattern trong ecosystem React 2026
- Rule #2: *"bắt buộc phải sử dụng React `createElement` thay vì cú pháp JSX"*
- JSX đã được Vite/TypeScript support native, không có lý do kỹ thuật hợp lệ để cấm JSX ở page level.
- Component con (`components/`) được phép dùng JSX, nhưng page (`pages/`) thì không — **mâu thuẫn kiến trúc**.

### 4.2 Friction không cần thiết
- Viết `createElement` thủ công làm chậm development speed ~30-40%.
- Khó đọc, khó maintain, khó onboard developer mới.
- Tooling (Prettier, ESLint, IDE IntelliSense) hoạt động kém hơn với `createElement`.

### 4.3 Đề xuất
- **Option A:** Cho phép JSX ở tất cả các level, dùng ESLint rule để enforce consistency.
- **Option B:** Nếu bắt buộc `createElement`, cần document rõ lý do kiến trúc và cung cấp code generator/snippet để giảm friction.

---

## 5. Verification Plan — thiếu nghiêm trọng

### 5.1 Thiếu E2E test
- Chỉ có TypeScript check, unit test, build check.
- Không có E2E test cho critical user flows (login, dashboard load, stock detail, watchlist update).

### 5.2 Thiếu accessibility audit
- Không đề cập WCAG compliance.
- Không có screen reader testing.

### 5.3 Thiếu performance budget
- Bundle size target?
- Lighthouse score target?
- Time to Interactive (TTI) target?
- First Contentful Paint (FCP) target?

### 5.4 Parity check thủ công không scale
- "Mở song song 2 tab so sánh" — không reproducible, không automated.
- **Đề xuất:** Dùng Playwright screenshot comparison hoặc visual regression testing tool.

---

## 6. Rollback Plan — good nhưng thiếu

### 6.1 Đã tốt
- Docker image tag rollback là hợp lý và thực tế.
- < 30 giây restore time là acceptable.

### 6.2 Thiếu
| Thiếu | Đề xuất |
|-------|---------|
| **Database migration rollback** | Nếu migration có chạm schema, cần rollback plan riêng |
| **Feature flag** | Sao không dùng feature flag để toggle giữa legacy và new frontend? |
| **Communication plan** | Ai thông báo cho user khi rollback? Email? In-app notification? |
| **Post-mortem trigger** | Khi nào cần viết post-mortem sau rollback? |

---

## 7. Definition of Done — vấn đề

### 7.1 DoD #9 — Unit test coverage 70% cho pages
- Unit test cho React pages thường không phải metric hữu ích.
- **Đề xuất:** Thay bằng integration test hoặc component test với user interaction scenarios.

### 7.2 DoD #17 — Bundle size so sánh
- Legacy dùng CRA (Webpack), new dùng Vite — so sánh trực tiếp là khập khiễng.
- **Đề xuất:** Dùng **gzip/brotli compressed size** làm metric, hoặc so sánh Lighthouse performance score.

### 7.3 Thiếu DoD quan trọng
| Thiếu | Đề xuất |
|-------|---------|
| **Security audit** | XSS, CSRF, token storage, CORS validation |
| **i18n quality check** | Coverage report ≠ quality — cần native speaker review |
| **Cross-browser testing** | Chrome, Firefox, Safari, Edge |
| **Mobile responsive** | iOS Safari, Android Chrome |
| **WebSocket resilience** | Reconnect, backoff, message ordering |

---

## 8. Thiếu sót cấu trúc tài liệu

### 8.1 Không có RACI matrix
| Role | Ai |
|------|-----|
| Responsible (người làm) | ? |
| Accountable (người chịu trách nhiệm) | ? |
| Consulted (người được hỏi ý kiến) | ? |
| Informed (người được thông báo) | ? |

### 8.2 Không có risk register
Top 5 risks cần được document:
1. **Estimate underestimate** — Giai đoạn 3 có thể trượt timeline 2-3x
2. **API contract mismatch** — 38 hàm có thể không match với core-api response
3. **WebSocket breaking changes** — realtime feed có thể không compatible
4. **Token storage security** — localStorage JWT có thể bị XSS exploit
5. **External dependency failure** — VNStockCharts build có thể fail

### 8.3 Không có dependency map
```
Giai đoạn 0 → Giai đoạn 1 → Giai đoạn 2 → Giai đoạn 3 → Giai đoạn 4 → Giai đoạn 5 → Giai đoạn 6
     │              │              │              │
     └──────────────┴──────────────┴──────────────┘
                    Pre-requisites cho Giai đoạn 3
```

### 8.4 Không có estimate tổng thời gian
- Tổng: 1 + 3 + 2 + 5 + 1 + 3-5 + 0.5 = **~15.5-17.5 ngày**
- Có realistic không với resource hiện có? (bao nhiêu developer, seniority level?)

### 8.5 Không đề cập CI/CD pipeline changes
- Ngoài DoD #15 (GitHub Action), không có plan cho:
  - Staging environment setup
  - Production deployment pipeline
  - Rollback automation
  - Monitoring/alerting setup

---

## 9. Mâu thuẫn tiềm ẩn với existing docs

### 9.1 Xóa frontend/ vs archive
- Plan: "xóa bỏ hoàn toàn thư mục `frontend/`"
- AGENTS.md: "frontend/ cũ sẽ bị xóa bỏ hoàn toàn ngay khi toàn bộ các thành phần đã được chuyển đổi hết"
- **Câu hỏi:** Xóa khỏi repo hay move sang `archive/`? Cần làm rõ.

### 9.2 `/dashboard` route
- Plan: "trỏ về .tsx"
- `DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN` spec: heatmap center, alert lane, AI lane, FactsFirstModularPositionDeck full-width, route swap giữa `ModernDashboard` và `PackageDashboardHost`
- **Câu hỏi:** Plan này có follow spec đó không? Hay chỉ port nguyên bản?

### 9.3 `/stocks/:symbol` route
- Plan: "viết lại sang StockDetailPage.tsx"
- `WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE` spec: KLineChart làm surface trung tâm, CVD pane riêng, Buy Strength/Institutional Strength pane riêng, whale marker viewport rule, selected-session binding
- **Câu hỏi:** Plan này có implement đầy đủ các hard constraints không?

---

## 10. Đề xuất cấu trúc lại tài liệu

### 10.1 Thêm các section bắt buộc
1. **Executive Summary** — 1 paragraph tóm tắt mục tiêu, scope, timeline
2. **RACI Matrix** — ai làm gì, ai review, ai approve
3. **Risk Register** — top 5 risks với mitigation plan
4. **Dependency Map** — giai đoạn nào block giai đoạn nào
5. **Resource Plan** — bao nhiêu developer, seniority level, availability
6. **Communication Plan** — status update frequency, escalation path
7. **Decommission Checklist** — 7 pre-decommission gates với sign-off criteria

### 10.2 Sửa các estimate không thực tế
| Giai đoạn | Estimate cũ | Estimate đề xuất | Lý do |
|-----------|-------------|------------------|-------|
| 1 (API Client) | 3 ngày | 5-7 ngày | 38 hàm cần type, test, error handling, OpenAPI metadata |
| 3 (UI & Routing) | 5 ngày | 10-15 ngày | 17 trang với complexity khác nhau, StockDetail rất phức tạp |
| 4 (Packaging) | 1 ngày | 2 ngày | External dependency risk, build testing |

### 10.3 Bổ sung verification methods
| Verification | Method | Tool |
|--------------|--------|------|
| TypeScript compilation | Automated | `tsc --noEmit` |
| Unit tests | Automated | Jest/Vitest |
| Integration tests | Automated | Playwright |
| E2E tests | Automated | Playwright |
| Visual regression | Automated | Playwright screenshot comparison |
| Performance budget | Automated | Lighthouse CI |
| Accessibility audit | Automated + Manual | axe-core, screen reader |
| Security audit | Automated + Manual | npm audit, manual review |
| Parity check | Automated | API response diff, screenshot diff |

---

## Kết luận

Tài liệu hiện tại là **khung tốt** để bắt đầu thảo luận, nhưng cần được bổ sung và điều chỉnh trước khi approve để triển khai. Ba vấn đề ưu tiên cao nhất cần giải quyết:

1. **Estimate Giai đoạn 3 quá thấp** — cần chia nhỏ hơn hoặc tăng thời gian lên 10-15 ngày.
2. **Thiếu liên kết với existing feature specs** — nguy cơ làm sai nghiệp vụ, cần cross-reference với các docs đã có.
3. **`createElement` convention cần justification** — hoặc nên bỏ để giảm friction, hoặc cần document rõ lý do kiến trúc.

**Đề xuất next step:** Tổ chức review meeting với Tech Lead và team frontend để thống nhất các điểm trên trước khi finalize tài liệu.
