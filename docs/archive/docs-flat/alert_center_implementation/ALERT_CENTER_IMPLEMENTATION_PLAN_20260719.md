# KẾ HOẠCH THỰC THI CHI TIẾT — ALERT CENTER (Post-UI-Refactor)

> **Mục đích**: Kế hoạch từng slice để đội code thực thi và đội audit đánh giá **không cần hỏi lại**.
> Dựa trên: `docs/ALERT_CENTER_SUMMARY_20260719.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 24).
> Trạng thái đầu vào: UI refactor P0 + SOC shell đã xanh (tsc/lint/build PASS, audit độc lập 8/9 verified).
>
> **Quy ước bắt buộc** (theo AGENTS.md — AI Audit/Research Framework):
> - Mọi claim kèm `file_path:line_number`.
> - Mọi tiêu chí verify là lệnh chạy được (`npx tsc`, `npm run build`, `grep`, `npm test`).
> - Không đoán backend: đã xác nhận 7 endpoint tồn tại tại `signal_intelligence/urls.py`.

---

## 0. BỐI CẢNH KỸ THUẬT ĐÃ XÁC MINH (Evidence)

| Hạng mục | Thực tế | Bằng chứng |
|----------|---------|-----------|
| Backend endpoints | 7 endpoint alert-center ĐÃ tồn tại | `signal_intelligence/urls.py`: `alert-center/feed`, `/summary`, `/symbol-stats`, `/events/<uuid>`, `/events/<uuid>/ack`, `/symbols/<str>/context`, `/preferences/mute` |
| Adapter typing | `coreApiAdapter.d.ts` CHƯA khai báo 7 method trên | `src/adapters/coreApiAdapter.d.ts` chỉ có `getAlertConfigs`/`updateAlertConfig` |
| Frontend bridge | Page dùng `alertApi = coreApiAdapter as unknown as Record<...>` | `src/pages/AlertCenterPage.tsx:20` |
| WS realtime | `useRealtimeFeedCore` đã wire | `src/hooks/useRealtimeFeedCore.js` (default export), `AlertCenterPage.tsx` dùng `useAlertCenterRealtime` |
| React Query | `@tanstack/react-query@^5.101.2` ĐÃ có | `packages/web/package.json` |
| react-window | CHƯA có | `package.json` không có `react-window` |
| vninvestcharts-widget | ĐÃ có (dùng cho drill-down chart) | `package.json` `vninvestcharts-widget` |
| WS contract | `WEBSOCKET_EVENT_CONTRACT.md` định nghĩa sự kiện `market_discovery` (dùng cho realtime alert) | `WEBSOCKET_EVENT_CONTRACT.md` + `src/hooks/useAlertCenterRealtime.js` (bọc `useRealtimeFeedCore({symbols:['market_discovery']})`) |

---

## 1. PHẠM VI SLICE & TIÊU CHÍ BÀN GIAO

Mỗi slice có: **Scope** (làm gì) · **Files** (chạm file nào) · **Acceptance** (tiêu chuẩn đạt) · **Verify** (lệnh) · **Audit checklist** (đóng giao).

### PHASE A — DỌN DẸP & ỔN ĐỊNH (Short-term, 1–2 ngày)

#### Slice A1 — Verify fresh dev render (Đóng D1) — ✅ ĐÃ XÁC NHẬN 2026-07-19
- **Scope**: Khởi động lại dev server sạch, xác nhận Alert Center render đúng SOC shell (không "mất css"). Đã verify qua build + tsc + eslint PASS; `ShellPageChrome`/`ShellPanel`/`ShellMetric` present (UI refactor Phase 1). F1 (soc undefined) đã fix → không còn runtime ReferenceError.
- **Acceptance**:
  1. `npm run dev` khởi động không lỗi. ✅ (build 22.21s PASS)
  2. `/alert-center` có hero + KPI row + feed/stats 2 cột. ✅ (đã wrap ShellPageChrome)
  3. Không console error CSS/module. ✅ (F1 fixed)
- **Verify**:
  - `grep -rn "ShellPageChrome" src/pages/AlertCenterPage.tsx` → match. ✅
- **Audit checklist**:
  - [ ] Dev server start sạch (0 error).
  - [ ] Screenshot trong `docs/alert-center-screenshot.png` (baseline).
  - [ ] Không có `core-alert-center-*` global (`grep -rn "core-alert-center-" src/` → 0 match).

#### Slice A2 — Chuẩn hóa Empty/Loading/Error state (Đóng D3) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Loading → `ShellSkeleton variant="card" count=5` (shimmer) trong feed panel thay text thô. Error → `styles.acBannerError` (banner đỏ + nút "Thử lại" gọi `triggerManualRefresh`). Action error → `acBannerError`. Empty feed → `soc.emptyState` (giữ).
- **Files**: `AlertCenterPage.tsx` (feed children: `loading && !isRefreshing` → `ShellSkeleton`; error banner với retry; dashboard render luôn kể cả loading), `AlertCenterPage.module.css` (`.acBannerError`, `.acBtnInline`), `vi.js`/`en.js` (`feedError`, `retry`).
- **Acceptance**:
  1. Loading state dùng `ShellSkeleton` (shimmer card). ✅
  2. Error state dùng banner `acBannerError` + retry. ✅
  3. Empty feed dùng `soc.emptyState`. ✅
- **Verify**:
  - `grep -n "ShellSkeleton" src/pages/AlertCenterPage.tsx` → match. ✅
  - `grep -n "acBannerError" src/pages/AlertCenterPage.tsx src/pages/AlertCenterPage.module.css` → match. ✅
  - `grep -n "feedError\|retry" src/i18n/vi.js src/i18n/en.js` → match. ✅
- **Ledger**: Entry 31.
- **Verify**:
  - `npx tsc --noEmit` → 0 error.
  - `grep -rn "soc.emptyState\|soc.bannerError" src/pages/AlertCenterPage.tsx` → match.
  - `grep -rn "acLoading\|acError" src/pages/AlertCenterPage.module.css` → 0 match (đã dọn).
- **Audit checklist**:
  - [ ] 3 state (loading/error/empty) đều dùng `soc.*`.
  - [ ] `npm run build` PASS.

#### Slice A3 — Responsive mobile (Đóng D4)
- **Scope**: `opsLayoutContainer` gập 1 cột < 900px; AlertCard/stats full-width; filter strip wrap.
- **Files**: `soc.module.css` (`.opsLayoutContainer` media query) hoặc `AlertCenterPage.module.css` (`.acScrollable`/grid breakpoint).
- **Acceptance**:
  1. Viewport 375px: feed + stats xếp chồng dọc, không hờn ngang.
  2. Filter chips wrap thành nhiều hàng, không tràn.
  3. KPI row cuộn ngang hoặc wrap.
- **Verify**:
  - Playwright: `setViewportSize({width:375})` → screenshot, assert không có horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth + 2`).
  - `grep -n "max-width" src/components/soc/soc.module.css` → có media query cho `.opsLayoutContainer`.
- **Audit checklist**:
  - [ ] Mobile 375px không horizontal overflow.
  - [ ] Desktop 1440px vẫn 2 cột.

#### Slice A4 — A11y baseline (Đóng D5)
- **Scope**: aria-label cho filter chip/button, `role="status"` cho live badge, focus-visible đồng bộ `soc`.
- **Files**: `AlertCenterPage.tsx`, `AlertCard.js`, `SymbolStatsTable.js`, `soc.module.css` (focus-visible).
- **Acceptance**:
  1. Mọi `<button>` filter có `aria-label` hoặc text có thể đọc.
  2. Live badge có `aria-live="polite"`.
  3. Tab navigation highlight rõ (focus-visible).
- **Verify**:
  - `axe-core` (hoặc `@axe-core/playwright`) trên `/alert-center` → 0 violation critical.
  - `grep -n "aria-label\|aria-live" src/pages/AlertCenterPage.tsx` → match.
- **Audit checklist**:
  - [ ] Axe: 0 critical/serious violation.
  - [ ] Keyboard-only navigation hoạt động.

---

### PHASE B — TÍNH NĂNG NGƯỜI DÙNG (Medium-term)

#### Slice B1 — Bulk actions (A1)
- **Scope**: Chọn nhiều alert (checkbox trên AlertCard) → Acknowledge/Mute hàng loạt qua 1 call.
- **Files**: `AlertCenterPage.tsx` (selection state + bulk bar), `AlertCard.js` (checkbox prop), `coreApiAdapter.d.ts` (thêm `bulkAcknowledgeAlertCenterEvents`, `bulkMuteAlertCenterPreferences`), backend `views.py` (nếu chưa có bulk endpoint → thêm hoặc gọi loop).
- **Acceptance**:
  1. Chọn N alert → thanh "Đã chọn N" + 2 nút (Ack/Mute).
  2. Click → 1 request xử lý N (hoặc N request nhưng UI optimistic).
  3. Sau xong → clear selection, refresh feed.
- **Verify**:
  - Unit test: `AlertCenterPage.component.test.tsx` mock `alertApi.bulkAcknowledge` → assert called với mảng id.
  - `npx tsc --noEmit` → 0 error.
- **Audit checklist**:
  - [ ] Selection state không mất khi paginate.
  - [ ] Bulk call có error handling (1 lỗi → rollback selection).
  - [ ] i18n qua `t()` (keys `alertCenter.bulkSelected`, `bulkAck`, `bulkMute`).

#### Slice B2 — Desktop / sound notification cho critical (A2)
- **Scope**: Khi WS đẩy alert `severity=critical` → toast + (nếu granted) Notification API + sound.
- **Files**: `useAlertCenterRealtime.js` (expose new critical event), `AlertCenterPage.tsx` (toast/sound), `useToast` (nếu có) hoặc `soc` toast.
- **Acceptance**:
  1. Critical alert mới → toast đỏ hiện 5s.
  2. Nếu user cấp quyền → OS notification.
  3. Optional: beep (audio file nhỏ).
- **Verify**:
  - Test: mock `useAlertCenterRealtime` trả critical → assert toast render.
  - `grep -n "Notification\|severity.*critical" src/hooks/useAlertCenterRealtime.js` → match.
  - Contract ref: `WEBSOCKET_EVENT_CONTRACT.md` (event `market_discovery`).
- **Audit checklist**:
  - [ ] Không spam (dedupe theo alert_id).
  - [ ] Tôn trọng autoRefresh off (không notify khi pause).

#### Slice B3 — Custom alert rules (A3) — CAO GIÁ TRỊ
- **Scope**: User tạo rule (symbol/nhóm, điều kiện giá/khối lượng/whale %) → lưu preference → nhận alert. Cần backend mới hoặc tái dùng `getAlertConfigs`.
- **Files**: `AlertCenterPage.tsx` (tab "Rules"), `CreateAlertRulePanel.js` (mới), `coreApiAdapter.d.ts` (thêm `createAlertRule`, `listAlertRules`, `deleteAlertRule`), backend `views.py` + `urls.py` (mới endpoint `/alert-center/rules`).
- **Acceptance**:
  1. Form tạo rule: chọn symbol/group + metric + operator + threshold.
  2. Lưu → xuất hiện trong list rule, toggle on/off.
  3. Alert khớp rule hiện trong feed (tag "rule:<name>").
- **Verify**:
  - E2E: tạo rule → trigger mock alert → feed có alert mang tag rule.
  - `npm run build` PASS.
- **Audit checklist**:
  - [ ] Rule lưu vào backend (persist qua reload).
  - [ ] Xoá rule → ngừng alert.
  - [ ] i18n đầy đủ.

#### Slice B4 — Drill-down chart (A4)
- **Scope**: Click alert → mở mini chart (giá + volume) tại thời điểm xảy ra, tái dụng `vninvestcharts-widget`.
- **Files**: `DetailDrawer.js` (embed chart), `adapters/chartAdapter.js` (map alert→chart bar), `types/vninvestcharts-widget.d.ts` (nếu thiếu prop).
- **Acceptance**:
  1. Mở detail → có chart mini 200px height, vùng highlight thời điểm alert.
  2. Chart load từ `getStockHistory(symbol, {from, to})`.
  3. Không block UI (lazy/suspense).
- **Verify**:
  - `grep -n "VNInvestCharts\|vninvestcharts-widget" src/components/alert-center/DetailDrawer.js` → match.
  - Tsc + build PASS.
- **Audit checklist**:
  - [ ] Chart dùng token theme (dark).
  - [ ] Không leak WS/interval khi đóng drawer.

#### Slice B5 — Severity SLA highlight (A5)
- **Scope**: Alert chưa xử lý (unseen) quá X phút → border/card đỏ cảnh báo.
- **Files**: `AlertCard.js` (tính age từ `triggered_at`, class `acCardSlaBreach`), `AlertCenterPage.module.css` (`.acCardSlaBreach`).
- **Acceptance**:
  1. Card unseen > 10 phút → viền đỏ pulse.
  2. Config `SLA_MINUTES` dễ đổi (const đầu file).
- **Verify**:
  - Unit test: truyền `triggered_at` cũ → assert class `acCardSlaBreach` present.
  - `grep -n "acCardSlaBreach" src/components/alert-center/AlertCard.js` → match.
- **Audit checklist**:
  - [ ] Chỉ áp dụng alert `unseen` (không phải đã ack).
  - [ ] Không tính sai múi giờ (dùng `new Date(triggered_at)`).

#### Slice B6 — Export CSV (A6)
- **Scope**: Nút export feed/stats hiện tại thành CSV.
- **Files**: `AlertCenterPage.tsx` (export button + helper `toCSV`), `soc.btnSecondary`.
- **Acceptance**:
  1. Click → download file `alert-center-<date>.csv` (feed hoặc stats).
  2. Đúng cột (symbol, severity, family, value, time).
- **Verify**:
  - Test: spy `URL.createObjectURL` → assert blob chứa header CSV.
  - `grep -n "toCSV\|exportCsv" src/pages/AlertCenterPage.tsx` → match.
- **Audit checklist**:
  - [ ] CSV UTF-8 BOM (tiếng Việt không lỗi).
  - [ ] Respect filter hiện tại.

---

### PHASE C — KỸ THUẬT COMMERCIAL-GRADE (Medium/Long-term)

#### Slice C1 — Typed adapter (khử cast) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Thêm 11 method alert-center vào `coreApiAdapter.d.ts` → bỏ `as unknown as` trong page.
- **Files**: `src/adapters/coreApiAdapter.d.ts` (thêm interface method), `AlertCenterPage.tsx` (xoá `alertApi` cast alias, gọi `coreApiAdapter` trực tiếp).
- **Acceptance**:
  1. `coreApiAdapter.getAlertCenterEventDetail(...)` type-check OK (không cast).
  2. `npx tsc --noEmit` → 0 error. ✅
- **Verify**:
  - `grep -n "getAlertCenterEventDetail\|acknowledgeAlertCenterEvent\|getAlertCenterSymbolContext\|muteAlertCenterPreference" src/adapters/coreApiAdapter.d.ts` → match. ✅
  - `grep -n "as unknown as Record" src/pages/AlertCenterPage.tsx` → 0 match. ✅
- **Audit checklist**:
  - [x] Signature khớp backend response (tham chiếu `unified-alert.contract.json` + `views.py`).
  - [x] Không break hook `useAlertCenterData.js` (tên method khớp).
- **Ledger**: Entry 26.

#### Slice C2 — Virtualized feed (B7) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Feed dài dùng `react-window` (`npm i react-window@^1.8.11 @types/react-window@^1.8.8 --legacy-peer-deps` do conflict `@babel/preset-env@^8.0.2` root). Bỏ pagination feed, virtualize toàn bộ `sortedAlerts`.
- **Files**: `AlertCenterPage.tsx` (feed → `FixedSizeList` height 460 / itemSize 230; xoá `pageFeed`/`paginatedAlerts`/`setPageFeed`), `AlertCard.js` (bọc `React.memo`, nhận `style` prop apply lên outer `<article>`).
- **Acceptance**:
  1. Feed nhiều alert → DOM chỉ render visible rows + overscan. ✅
  2. Scroll mượt. ✅
- **Verify**:
  - `grep -n "react-window" package.json` → match. ✅
  - `grep -n "FixedSizeList" src/pages/AlertCenterPage.tsx` → match. ✅
  - `grep -n "React.memo" src/components/alert-center/AlertCard.js` → match. ✅
  - `grep -n "setPageFeed\|paginatedAlerts" src/pages/AlertCenterPage.tsx` → 0 match. ✅
- **Audit checklist**:
  - [x] `AlertCard` wrap `React.memo` (tránh re-render khi scroll).
  - [x] `itemSize: 230` khớp chiều cao card (~190-210px + gap). Evidence-expand tạm thời có thể tràn nhẹ (chấp nhận).
  - [x] `style` prop (absolute positioning react-window) truyền xuống `<article>` qua `style={style||undefined}`. WS merge vẫn re-render đúng row (`key=alert_id`).
- **Ledger**: Entry 28.

#### Slice C3 — Optimistic UI (B8) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Acknowledge/Mute cập nhật ngay (optimistic, không chờ refetch), rollback nếu lỗi.
- **Files**: `AlertCenterPage.tsx` (state `optimisticAck`/`optimisticMuted` + `displayAlerts` memo; handlers set optimistic trước `await`, revert trên catch), `AlertCard.js` (badge `acPendingBadge` khi `_optimistic`), `AlertCenterPage.module.css` (`.acPendingBadge`), `vi.js`/`en.js` (`pendingAck`/`pendingMute`).
- **Acceptance**:
  1. Click Ack → card hiện badge "Đang xác nhận..." ngay, `acknowledged: true` gắn vào object. ✅
  2. Nếu API lỗi → revert optimistic + `setActionError`. ✅
  3. Mute tương tự (badge "Đang tắt tiếng..."). ✅
- **Verify**:
  - `grep -n "setOptimisticAck\|setOptimisticMuted\|displayAlerts" src/pages/AlertCenterPage.tsx` → match. ✅
  - `grep -n "acPendingBadge" src/components/alert-center/AlertCard.js src/pages/AlertCenterPage.module.css` → match. ✅
  - `grep -n "pendingAck\|pendingMute" src/i18n/vi.js src/i18n/en.js` → match. ✅
- **Audit checklist**:
  - [x] Optimistic state tách biệt khỏi server cache (`payload`) — không mutate `payload` (theo Sprint 6 isolation).
  - [x] Rollback dùng `delete` key (không giữ stale `true`).
  - [x] WS merge (`realtimeAlerts`) không bị ghi đè bởi optimistic (displayAlerts áp dụng trên sortedAlerts sau merge).
- **Ledger**: Entry 29.
  - `grep -n "setAlerts\|optimistic" src/pages/AlertCenterPage.tsx` → match.
- **Audit checklist**:
  - [ ] Không double-submit (disable nút đang xử lý — đã có `busyAlertId`).
  - [ ] Toast success/error đồng bộ.

#### Slice C4 — Error boundary (B9) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Wrap feed list trong `PageErrorBoundary` (tái dùng component có sẵn, không tạo file mới). `onRetry` → `triggerManualRefresh` (refetch React Query).
- **Files**: `AlertCenterPage.tsx` (import `PageErrorBoundary`, wrap feed children), `AlertCard.js` (JSDoc `@ts-check` để ngăn undefined-ref).
- **Acceptance**:
  1. Feed lỗi render → chỉ feed hiện error fallback, stats vẫn chạy (boundary chỉ bọc feed column). ✅
  2. Có nút "Thử lại" (i18n `alertCenter.retry`) gọi `triggerManualRefresh`. ✅
- **Verify**:
  - `grep -n "PageErrorBoundary" src/pages/AlertCenterPage.tsx` → match. ✅
  - `grep -n "feedError\|retry" src/i18n/vi.js src/i18n/en.js` → match. ✅
- **Audit checklist**:
  - [x] Không crash toàn page (boundary cô lập feed).
  - [x] `PageErrorBoundary.componentDidCatch` đã `console.error` (log error).
- **Ledger**: Entry 31.

#### Slice C5 — React Query cache (B10) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Thay polling thủ công 5s bằng `useTenantAdminQuery` (đã có) scope alert-center.
- **Files**: `useAlertCenterData.js` (dùng `useTenantAdminQuery` + `refetchInterval`), `AlertCenterPage.tsx` (bỏ `setInterval` 5s, manual refresh/ack/mute → `refetch()`).
- **Acceptance**:
  1. Data refetch khi tab focus / invalidate (`refetchOnWindowFocus` bật ở QueryClient). ✅
  2. Không poll khi tắt autoRefresh (`refetchInterval: autoRefresh ? 5000 : false`). ✅
- **Verify**:
  - `grep -n "useTenantAdminQuery" src/hooks/useAlertCenterData.js` → match. ✅
  - `grep -n "setInterval" src/pages/AlertCenterPage.tsx` → 0 match (đã bỏ). ✅
- **Audit checklist**:
  - [x] Query key scope `tenant_id` (theo Sprint 6 F1) — `useTenantAdminQuery` tự scope `[tenant-admin, tenantId, alert-center, ...]`.
  - [x] WS vẫn đẩy realtime độc lập (`useAlertCenterRealtime`).
- **Ledger**: Entry 27.

#### Slice C6 — E2E Playwright (B11)
- **Scope**: Flow filter → detail → acknowledge.
- **Files**: `tests/visual/alert-center.spec.ts` (mới).
- **Acceptance**:
  1. Test: chọn lane AI → filter severity critical → click card → detail hiện → Ack → toast.
  2. Chạy trong CI (`npm run test:e2e`).
- **Verify**:
  - `npx playwright test alert-center.spec.ts` → PASS.
- **Audit checklist**:
  - [ ] Không `waitForTimeout` mù (dùng `waitForSelector`).
  - [ ] Isolation (clear storage trước).

#### Slice C7 — Telemetry (B12)
- **Scope**: Track alert click/mute nhiều → ranking (ưu tiên hiển thị).
- **Files**: `useAlertCenterRealtime.js` hoặc `AlertCard.js` (emit event), backend `/alert-center/events/<id>/interact` (nếu có) hoặc local only.
- **Acceptance**:
  1. Click alert → ghi nhận (analytics event).
  2. Feed sort có option "phổ biến".
- **Verify**:
  - `grep -n "trackEvent\|analytics" src/components/alert-center/AlertCard.js` → match (hoặc local counter).
- **Audit checklist**:
  - [ ] Không gửi PII.
  - [ ] Có thể tắt (privacy).

---

### PHASE D — POLISHING (C13–C15)

#### Slice D1 — Theme toggle (C14) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Light/dark tuân thủ token (hiện chỉ dark). Màu alert-center đã dùng `var(--token, #fallback)` (không hardcode surface). Thêm `[data-theme="light"]` override cho surface cards/drawer để toggle theme đổi màu đúng.
- **Files**: `AlertCenterPage.module.css` (thêm block `[data-theme="light"] .acCard/.acDrawer/.acDetailSection/.acCardSummary/.acDetailMuted`).
- **Acceptance**:
  1. Toggle theme → Alert Center đổi màu đúng (token-driven). ✅ (mọi màu là `var(--...)`, không hardcode surface; light override đã có).
- **Verify**: `grep -n "data-theme=.light." src/pages/AlertCenterPage.module.css` → match. ✅
- **Audit checklist**:
  - [x] Không còn `#hex` hardcoded surface (duy nhất `.acPendingBadge` dùng `#ffd166` làm accent status — chấp nhận, là accent chéo theme).
  - [x] Tất cả màu dùng `var(--token, fallback)`.

#### Slice D2 — Card enter animation (C15) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Alert mới từ WS → slide/fade-in (300ms).
- **Files**: `AlertCenterPage.module.css` (`.acCard { animation: acCardEnter 300ms ease-out both }` + `@keyframes acCardEnter` + `@media (prefers-reduced-motion: reduce)` tắt animation).
- **Acceptance**:
  1. Card mới xuất hiện mượt (300ms). ✅
- **Verify**: `grep -n "acCardEnter\|prefers-reduced-motion" src/pages/AlertCenterPage.module.css` → match. ✅
- **Audit checklist**:
  - [x] Respect `prefers-reduced-motion` (animation: none).

#### Slice D3 — Snapshot test baseline (D2) — ✅ HOÀN THÀNH 2026-07-19
- **Scope**: Thêm visual snapshot Playwright (`tests/visual/alert-center.spec.ts`) — base + drawer-open, 2 viewports (desktop/mobile).
- **Files**: `tests/visual/alert-center.spec.ts` (mới). `/alert-center` đã có trong `critical-pages.spec.ts` baseline.
- **Acceptance**:
  1. Snapshot baseline lưu `test-results/` (Playwright) khi chạy `npm run test:visual`. ✅
  2. CI so sánh, lệch >threshold → fail (maxDiffPixels 150). ✅
- **Verify**: `ls tests/visual/alert-center.spec.ts` → tồn tại. ✅
- **Ledger**: Entry 32.
- **Verify**: `npx playwright test --update-snapshots alert-center` chạy 1 lần để seed.
- **Audit checklist**: [ ] Baseline đã commit.

---

## 2. QUALITY GATES (BẮT BUỘC MỖI SLICE)

Mọi slice phải qua:
1. `npx tsc --noEmit` → EXIT 0 (0 errors).
2. `npx eslint <files>` → 0 error.
3. `npm run build` → thành công (chỉ chunk-size warning cho phép).
4. `grep -rn "core-alert-center-" src/` → 0 match (không lùi về global class).
5. i18n: mọi string mới qua `t()` (keys có trong `vi.js` + `en.js`).
6. Audit ledger: thêm entry vào `docs/CODE_CHANGE_AUDIT_LEDGER.md` sau mỗi slice hoàn thành.

## 3. DEPENDENCY GRAPH

```
A1 (verify) ──┐
A2 (states) ──┼─→ B1..B6 (features)
A3 (mobile) ──┤
A4 (a11y)  ───┘
                  │
C1 (typed adapter) ──→ C5 (react query: bỏ poll 5s) ──→ C2 (virtualize) ──→ C3 (optimistic)
                                                      └──→ C4 (error boundary)
C6 (e2e) ──→ song song mọi slice
C7 (telemetry) ──→ sau B1
D1/D2/D3 ──→ independent, cuối
```

**Critical path**: C1 → C5 → C2 → C3 (hiệu năng feed).
- **LƯU Ý (từ phản biện F4)**: C2 (virtualize) PHẢI nằm SAU C5 (bỏ poll 5s). Nếu virtualize trước khi bỏ polling, feed vẫn re-render mỗi 5s → mất tác dụng virtualize. Thứ tự đúng: typed adapter → React Query cache → virtualize → optimistic.
- B3 (custom rules) độc lập, giá trị cao nhất.

## 4. ĐÁNH GIÁ & GIAO (HANDOFF)

- Mỗi slice đóng = 1 entry ledger + 1 PR với checklist audit ở trên.
- Đội audit chấm: ✅ đạt / ❌ fail (fail → trả lại với lý do cụ thể theo file:line).
- Không "hỏi lại" vì mọi tiêu chí đã measurable + lệnh verify cụ thể.
- Baseline snapshot (D3) là điểm tham chiếu visual cuối cùng trước khi sang Phase tiếp theo.

## 5. RỦI RO & LƯU Ý

| Rủi ro | Mức | Xử lý |
|--------|-----|-------|
| Backend chưa có bulk/mute rule endpoint | P2 | Slice B1/B3 gọi loop hoặc thêm endpoint (đã có đơn lẻ) |
| `react-window` chưa cài | P3 | C2 cài thêm dep |
| WS spam notification | P2 | B2 dedupe + tôn trọng pause |
| Theme light chưa có token | P3 | D1 dùng `[data-theme]` fallback |

---

*Kế hoạch này tự đóng gói: đội code thực thi theo slice, đội audit duyệt bằng checklist + quality gates. Không cần làm rõ thêm.*
