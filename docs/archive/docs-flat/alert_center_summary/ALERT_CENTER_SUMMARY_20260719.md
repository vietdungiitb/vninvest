# TỔNG KẾT TÍNH NĂNG ALERT CENTER

> Tài liệu tổng hợp trạng thái phát triển tính năng Alert Center: việc đã hoàn thành,
> việc còn dang dở, và lộ trình nâng cấp lên đẳng cấp phần mềm thương mại thực sự.
>
> Ngày cập nhật: 2026-07-19
> Phạm vi: `packages/web` (React/Vite) — Alert Center frontend.

---

## 1. CÔNG VIỆC ĐÃ HOÀN THÀNH

### Phase 1–5 (P0 — đã verify xanh: tsc + lint + build + test)

| Phase | Nội dung | Trạng thái | Bằng chứng |
|-------|----------|-----------|-----------|
| **1. Real-time WS** | `useAlertCenterRealtime.js` bọc `useRealtimeFeedCore({ symbols: ['market_discovery'] })`, integrate WS vào page, sửa `WEBSOCKET_EVENT_CONTRACT.md` | ✅ Hoàn thành | 6 test PASS |
| **2. Filter + family/severity** | `useAlertCenterData.js` forward query; filter UI severity / alert_family / lane / timeframe trên page | ✅ Hoàn thành | 3 test PASS |
| **3. i18n** | namespace `alertCenter` 85 keys vi/en parity; mọi string qua `t()` trong 5 file | ✅ Hoàn thành | tsc/lint/build PASS, jest 9/9 |
| **4. Contract** | `unified-alert.contract.json` v1.1.0 (thêm alert_family / lane / summary / evidence / confidence / freshness_state), xóa file rác `UnifiedAlertCenter (1).js` | ✅ Hoàn thành | valid JSON |
| **5. Theme system** | Chuyển từ `AlertCenterPage.styles.js` + `<style dangerouslySetInnerHTML>` → `AlertCenterPage.module.css` dùng SOC tokens | ✅ Hoàn thành | tsc/lint/build PASS |

### Đợt nâng cấp UI (SOC design system — hoàn thành 2026-07-19)

**Root cause đã tìm ra & fix**: `AlertCenterPage` là page DUY NHẤT trong toàn bộ app
không sử dụng `ShellPageChrome` → render như một "island" tách biệt, trông thô/không
khớp thiết kế chung. Đây là nguyên nhân chính của cảm giác "mất style / dính vào nhau / thô kệch".

**Các thay đổi đã thực hiện:**

- Page được wrap trong `ShellPageChrome` (eyebrow / title / subtitle) + `ShellMetric`
  KPI row (total / high+critical / AI-suggest / unseen) + `ShellPanel` cho feed & stats.
- Controls: lane + timeframe thành `soc.subTabBar` (segmented tabs); symbol filter +
  refresh dùng `soc.searchWrapper` / `buttonSecondary` (kèm icon spin).
- Filter chip severity / family dùng `soc.filterBtn` / `filterBtnActive` + nút clear.
- Feed: `AlertCard` trên `soc.feedCard` + `soc.statusBadge` (severity pill) +
  `soc.btnPrimary` / `btnSecondary` (actions) + buy/sell strength meter + evidence drawer.
- Stats: `soc.coverageTable` + `soc.searchWrapper` + frequency badge + ticker link.
- Drawer forensic `acDrawer` với gradient accent cyan → signal.
- **Fix bug tiềm ẩn**: `AlertCard.renderEvidenceList` gọi `t` undefined (ReferenceError
  runtime khi mở evidence) → nay truyền `t` từ scope đúng.

**Kết quả verify:**
- `npx tsc --noEmit` → ✅ (0 error)
- `npx eslint` → ✅ (0 error, 3 warning không liên quan logic)
- `npm run build` → ✅ (chỉ còn chunk-size warning tiền lệ)
- Không còn global class `core-alert-center-*` (đã grep xác nhận sạch)

**File đã sửa:**
- `packages/web/src/pages/AlertCenterPage.tsx` (rewrite dùng ShellPageChrome + soc classes)
- `packages/web/src/pages/AlertCenterPage.module.css` (chỉ giữ style AlertCenter-specific)
- `packages/web/src/components/alert-center/AlertCard.js`
- `packages/web/src/components/alert-center/SymbolStatsTable.js`
- `packages/web/src/components/alert-center/SummaryMetrics.js`
- `packages/web/src/components/alert-center/DetailDrawer.js`

---

## 2. VIỆC CÒN DANG DỞ / CHƯA LÀM

| # | Hạng | Việc | Lý do chưa làm |
|---|------|------|---------------|
| D1 | P1 | **Cache HMR stale** — dev server có thể vẫn hiện "mất css" do xóa `AlertCenterPage.styles.js` trước đó; cần xác nhận fresh `npm run dev` render đúng | Chưa có browser verify |
| D2 | P2 | **Visual snapshot / screenshot test** — chưa có baseline ảnh để so sánh trước/sau | Thiếu tool e2e |
| D3 | P2 | **Empty/Loading/Error state** dùng class riêng (`acLoading`/`acError`) chưa chuẩn hóa hoàn toàn theo `soc.emptyState` | Đã có nhưng chưa đồng bộ style |
| D4 | P3 | **Responsive mobile** — `opsLayoutContainer` 2 cột chưa có breakpoint gập 1 cột cho AlertCard/stats | Chưa test mobile |
| D5 | P3 | **A11y** — aria-label trên filter chip / button chưa đủ; focus-visible chưa đồng bộ SOC | Chưa audit |

---

## 3. HƯỚNG NÂNG CẤP LÊN ĐẲNG CẤP THƯƠNG MẠI THỰC SỰ

### A. Hữu ích cho người dùng (UX thực tế)

1. **Bulk actions** — chọn nhiều alert → Acknowledge / Mute hàng loạt (hiện chỉ đơn lẻ).
2. **Sound / desktop notification** cho critical — real-time WS đã có, thiếu layer notify.
3. **Alert rules tự cấu hình** — user tạo điều kiện (giá, khối lượng, whale %) → nhận alert
   thay vì chỉ xem hệ thống đẩy. (Tính năng biến "xem" thành "công cụ vận hành".)
4. **Drill-down chart** — click alert → mở mini price chart + volume tại thời điểm xảy ra
   (tái dùng `vninvestcharts-widget` đã có trong repo).
5. **Severity SLA** — alert chưa xử lý quá X phút → highlight đỏ cảnh báo người vận hành.
6. **Export CSV** danh sách alert / stats để báo cáo.

### B. Đẳng cấp kỹ thuật (commercial-grade)

7. **Virtualized feed** — danh sách alert dài (hàng ngàn) cần `react-window` thay slice 5/page.
8. **Optimistic UI** — Acknowledge / Mute cập nhật ngay, rollback nếu lỗi (hiện chờ refresh 5s).
9. **Error boundary** riêng cho feed / stats để 1 phần lỗi không sập cả page.
10. **React Query cache** đồng bộ với TenantAdmin (`useTenantAdminQuery`) thay polling thủ công 5s.
11. **E2E Playwright** cover flow: filter → detail → acknowledge (Sprint 6 đã có framework).
12. **Telemetry** — track alert được click / mute nhiều để cải thiện ranking.

### C. Polishing còn thiếu

13. Đồng bộ D3/D4 (empty / loading / error) vào `soc.*`.
14. Dark / light theme toggle tuân thủ token (hiện chỉ dark).
15. Animation vào/ra cho card mới từ WS (hiện chỉ badge live).

---

## 4. ĐỀ XUẤT ƯU TIÊN TIẾP THEO

- **Ngắn hạn (1–2 ngày)**: D1 (verify fresh dev) + D3/D4 (chuẩn hóa state + responsive)
  — tốn ít effort, ảnh hưởng trực quan lớn.
- **Trung hạn**: A1 (bulk) + A4 (drill-down chart) + B7 (virtualize) + B10 (React Query).
- **Dài hạn**: A3 (custom rules) — tính năng giá trị cao nhất, biến Alert Center từ "xem"
  thành "công cụ vận hành thực thụ".

---

## 5. LIÊN KẾT THAM CHIẾU

- `docs/IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md` — kế hoạch P0 gốc.
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` — ledger cập nhật thay đổi mã nguồn.
- `WEBSOCKET_EVENT_CONTRACT.md` — hợp đồng sự kiện realtime.
- `packages/web/src/components/soc/soc.module.css` — design system baseline.
- `packages/web/src/components/ShellPageTemplate.js` + `.module.css` — Shell chrome/panel/metric.
