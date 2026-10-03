# AUDIT — TÍNH NĂNG ALERT-CENTER (PACKAGES/WEB)

**Ngày audit:** 2026-07-18
**Phạm vi:** `packages/web/src/*` (SaaS React+TS) + backend `packages/core/backend/src/signal_intelligence/*` + adapter `packages/web/src/adapters/core/market.js`
**Mục tiêu:** Tìm bug, gap kỹ thuật, đề xuất nâng cấp lên chuẩn phần mềm thương mại (TradingView Alerts, Finviz, Benzinga Pro, StockTwits Alert).

---

## A. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **[GAP/RISK] Frontend không dùng WebSocket realtime** — Backend đã có `consumers.py` (RealtimeConsumer, `/ws/realtime/`) + `broadcasting.py` nhưng `AlertCenterPage` chỉ polling mỗi 5s (3 request/5s = ~36 req/phút/user). Trễ 0–5s, tải server cao, không đạt chuẩn realtime của TradingView.
2. **[GAP] Không expose filter `severity` & `alert_family`** — Backend `views.py:347,486` hỗ trợ filter này nhưng `AlertCenterPage` + `useAlertCenterData` chỉ truyền `symbol/session_date/timeframe`. Người dùng không thể lọc "chỉ critical" hay "chỉ whale".
3. **[GAP/i18n] Toàn bộ text hardcode tiếng Việt** — `AlertCenterPage.tsx` (title "Whale Alerts Workspace", labels, buttons) + 4 component con KHÔNG dùng i18n keys. Vi phạm nguyên tắc 5 AGENTS.md. EN users thấy 100% tiếng Việt.
4. **[BUG/RACE] Polling 5s không có request-dedupe / race-guard** — `useAlertCenterData.js:16-89` mỗi `refreshToken` đổi chạy `Promise.all` mới. Nếu request chậm hơn 5s, response cũ ghi đè response mới (mountedRef chỉ chặn unmount, không chặn stale-response). Sai thứ tự dữ liệu.
5. **[GAP] Pagination feed client-side trên `results` page đầu** — `AlertCenterPage:236-242` cắt `sortedAlerts` (chỉ page_size mặc định của backend, thường 20). Cursor `next/previous` từ backend (`useAlertCenterData` có lưu nhưng không dùng) bị bỏ phí. Feed không load được lịch sử dài.

---

## B. BẢN ĐỒ KIẾN TRÚC

| File | Line count | Trách nhiệm | Note |
|------|-----------|-------------|------|
| `packages/web/src/pages/AlertCenterPage.tsx` | 490 | Trang chính: filter, lane, feed, stats, drawer | Hardcode VN, polling 5s, sort client-side |
| `packages/web/src/hooks/useAlertCenterData.js` | 92 | Fetch feed+summary+symbolStats qua adapter | Không dedupe, bỏ cursor |
| `packages/web/src/hooks/useAlertCenterSnapshot.ts` | 89 | Hook alt có cursor pagination | **KHÔNG ĐƯỢC DÙNG** (chết/orphan) |
| `packages/web/src/components/alert-center/AlertCard.js` | 135 | Card alert: metrics, evidence, actions | Dùng `alert.alert_family` (không có trong contract) |
| `packages/web/src/components/alert-center/SummaryMetrics.js` | 21 | 5 card tổng hợp | Tĩnh |
| `packages/web/src/components/alert-center/SymbolStatsTable.js` | 119 | Bảng thống kê theo mã | Link `/stocks/{symbol}` |
| `packages/web/src/components/alert-center/DetailDrawer.js` | 44 | Drawer pháp y | Chỉ 2 section, không chart |
| `packages/web/src/adapters/core/market.js` | 560 (từ 40) | Map API alert-center ↔ core | Đầy đủ, nhất quán |
| `packages/core/backend/src/signal_intelligence/views.py` | 713 | 9 endpoint alert-center/ai-alerts | Hỗ trợ severity/alert_family filter |
| `packages/core/backend/.../consumers.py` | ~250 | WebSocket RealtimeConsumer | **Frontend không consume** |
| `packages/core/backend/.../outbound_notification_service.py` | ~170 | email/FCM/WebPush | **Frontend không expose pref UI** |
| `packages/core/backend/.../services/delivery_service.py` | — | ack/mute/seen state machine | Đầy đủ |
| `shared/api-contracts/unified-alert.contract.json` | 108 | Contract chuẩn | `alert_type` enum whale/dark_flow/signal/system |

---

## C. LUỒNG DỮ LIỆU ĐÃ TRACE (use-case: load feed + ack)

1. `AlertCenterPage.tsx:115-121` — `setInterval(5s)` → `setRefreshToken+1`.
2. `AlertCenterPage.tsx:94` → `useAlertCenterData({lane,symbol,timeframe,refreshToken})`.
3. `useAlertCenterData.js:16-89` — `useEffect` dep `refreshToken` → `Promise.all([getAlertCenterFeed, getAlertCenterSummary, getAlertCenterSymbolStats])` (adapter `market.js:50,62,74`).
4. Adapter `market.js:50` → `coreGet('/signals/alert-center/feed?symbol=...')`.
5. Backend `views.py:356 AlertCenterFeedView` → `_apply_common_alert_filters` → `delivery_service.apply_user_delivery_policy` → CursorPaginated response.
6. `AlertCenterPage.tsx:175-192 handleLoadDetail` → `getAlertCenterEventDetail` + `getAlertCenterSymbolContext` (parallel).
7. `AlertCenterPage.tsx:194-206 handleAcknowledge` → `acknowledgeAlertCenterEvent` (`market.js:110` → POST `.../events/{id}/ack`) → backend `views.py:583` → `delivery_service.acknowledge_delivery`.
8. **Không có push ngược** — sau ack, UI chỉ `setRefreshToken+1` (đợi tối đa 5s mới reflect).

---

## D. CONTRADICTIONS (plan/doc vs code)

| Plan/Doc | Code thực tế | Tác động |
|----------|--------------|----------|
| Contract `unified-alert.contract.json:19` enum `alert_type` = whale/dark_flow/signal/system; required `alert_type` | `AlertCard.js:46` đọc `alert.alert_family \|\| alert.alert_type`; `AlertCard.js` render field `alert_family` không tồn tại trong contract | Nếu backend trả `alert_type` (chuẩn) mà không có `alert_family`, card hiển thị "—" ở family lane. Nhầm lẫn taxonomy. |
| AGENTS.md nguyên tắc 5: i18n scan bắt buộc, không hardcode | `AlertCenterPage.tsx:295,299,319,329,387,388,353,419,447` + 4 component con toàn bộ hardcode VN | EN users thấy 100% VN; vi phạm quality gate |
| AGENTS.md: SOC glassmorphism, soc.module.css tokens | `AlertCenterPage.tsx:292` inject `CORE_STYLES` (AlertCenterPage.styles.js) thay vì dùng design system chung | Divergence style vs SOC tab khác |
| Backend `views.py:347` hỗ trợ `severity` filter | `useAlertCenterData.js:23-27` query chỉ `symbol/session_date/timeframe` | Filter severity vô dụng ở UI |
| `useAlertCenterSnapshot.ts` có cursor pagination chuẩn | `AlertCenterPage.tsx` KHÔNG import hook này (dùng `useAlertCenterData`) | Dead code 89 dòng; cursor backend bị bỏ |

---

## E. FINDINGS CHI TIẾT

### F1 [GAP/RISK] Không dùng WebSocket realtime — Cao
- `file`: `packages/web/src/pages/AlertCenterPage.tsx:115-121`
- Thực tế: polling `setInterval(5000)` gọi `Promise.all` 3 endpoints.
- Tác động: (a) Trễ 0–5s vs realtime; (b) ~36 req/user/phút → áp lực core không cần thiết; (c) Flcik/sởn khi re-render toàn bộ list mỗi 5s.
- Đề xuất: Consume `RealtimeConsumer` (`consumers.py:129` group `market_discovery` / `alerts_{user}`). Dùng SSE hoặc WS để push incremental. Giữ polling làm fallback (backoff khi WS down).

### F2 [GAP] Thiếu filter severity & alert_family — Cao
- `file`: `packages/web/src/hooks/useAlertCenterData.js:23-27`, `AlertCenterPage.tsx:317-331`
- Thực tế: backend hỗ trợ (`views.py:347,486`) nhưng UI chỉ lọc symbol.
- Tác động: Không thể "chỉ xem critical của whale" — thiếu tính năng cốt lõi của Benzinga/TradingView.
- Đề xuất: Thêm filter bar severity (critical/high/medium/low multi-select) + alert_family chips (whale/dark_flow/price_shock/ai_suggest...).

### F3 [GAP/i18n] Hardcode tiếng Việt toàn trang — Cao (vi phạm AGENTS.md)
- `file`: `AlertCenterPage.tsx` + `AlertCard.js` + `SummaryMetrics.js` + `SymbolStatsTable.js` + `DetailDrawer.js`
- Thực động: 0 key i18n được dùng; text literal VN.
- Đề xuất: Thêm namespace `alertCenter.*` trong `vi.js`/`en.js`, refactor dùng `useLang()`/`t()`. Đưa vào `npm run i18n:scan`.

### F4 [BUG/RACE] Polling không dedupe stale response — Trung bình/Cao
- `file`: `useAlertCenterData.js:16-89`
- Thực tế: `mountedRef` chỉ guard unmount. Nếu req#1 (chậm 6s) resolve sau req#2 (nhanh 1s), state ghi đè bằng data cũ.
- Tác động: Feed hiển thị dữ liệu lỗi thời hoặc nhảy lùi thời gian.
- Đề xuất: Thêm `requestIdRef`/`AbortController`; chỉ apply response có `requestId` mới nhất. Hoặc chuyển sang WS (F1) bỏ polling.

### F5 [GAP] Pagination feed sai kiến trúc (client-side trên page đầu) — Trung bình
- `file`: `AlertCenterPage.tsx:236-242`, `useAlertCenterData.js:44-48`
- Thực tế: `payload.next/previous` có nhưng bị bỏ; UI slice `sortedAlerts` (tối đa page_size backend).
- Tác động: Không xem được lịch sử dài; sort "largestValue" chỉ đúng trên page đầu.
- Đề xuất: Dùng cursor pagination (pattern có sẵn trong `useAlertCenterSnapshot.ts` đã viết nhưng bỏ hoang) hoặc server-side sort.

### F6 [GAP] DetailDrawer nghèo nàn, không có chart/evidence visual — Trung bình
- `file`: `DetailDrawer.js:17-43`
- Thực tế: Chỉ 2 text section (title/summary + 4 context số). Không chart, không sparkline, không liên kết order-flow.
- So sánh: TradingView/Finviz mở chart inline + context.
- Đề xuất: Embed mini-chart (`vninvestcharts-widget`) cho `symbol`, hiển thị `recent_events` (context có sẵn `recent_events` ở `views.py:570`), evidence structured thay vì JSON.stringify.

### F7 [GAP] Không có Notification Preferences UI — Trung bình
- `file`: backend `outbound_notification_service.py` có email/FCM/WebPush; frontend không có UI.
- Thực tế: `muteAlertCenterPreference` chỉ hardcode `mute_minutes:30` (`AlertCenterPage.tsx:213-217`). Không có toggle email/push, không cooldown tùy chỉnh, không unmute list.
- Đề xuất: Tab "Cài đặt thông báo": toggle channel, threshold severity nhận, mute list quản lý.

### F8 [GAP] Không có "seen" auto-mark / bulk actions — Thấp/Trung bình
- `file`: `AlertCenterPage.tsx:194-206` chỉ ack từng cái.
- Thực tế: Không đánh dấu "seen" khi scroll, không bulk ack, không "mark all read".
- Đề xuất: Bulk acknowledge, mark-all-read, auto-seen on view.

### F9 [GAP] Sound/Desktop alert & severity color system lỏng lẻo — Thấp
- `file`: `AlertCenterPage.styles.js` severity colors hardcode; `AlertCard.js:40` `severity-${alert.severity||"medium"}` default medium nếu thiếu.
- Thực tế: Không có âm thanh, không có toast ngoài trang, không thể cấu hình.
- Đề xuất: Toast global (`StickyAlertBar` đã có ở `frontend` nhưng `packages/web` chưa tích hợp alert-center), sound option.

### F10 [BUG] `sessionDate` state luôn `""` và không dùng — Thấp
- `file`: `AlertCenterPage.tsx:78` `const [sessionDate] = useState("")` — khởi tạo nhưng không bao giờ set.
- Tác động: Filter ngày phiên vô dụng; user không chọn được ngày.
- Đề xuất: Thêm date picker hoặc auto = hôm nay.

### F11 [GAP] Duplicate file — `UnifiedAlertCenter (1).js` — Thấp
- `file`: `packages/web/src/components/dashboard/UnifiedAlertCenter (1).js` (bản copy của `UnifiedAlertCenter.js`).
- Tác động: Dead/confusing code, rủi ro merge sai.
- Đề xuất: Xóa file `(1)`.

### F12 [GAP] Accessibility — Thấp
- `file`: Toàn bộ component dùng `createElement` thủ công, thiếu `aria-*`, `role`, keyboard nav cho drawer/pagination.
- Đề xuất: Thêm role="alert"/aria-live cho feed, focus trap cho drawer.

---

## F. QUALITY GATES AUDIT

| Gate | Lệnh | Kết quả |
|------|------|---------|
| Lint | `npx eslint src/pages/AlertCenterPage.tsx src/components/alert-center src/hooks/useAlertCenterData.js` | ✅ EXIT 0 (sạch) |
| Type-check | `npx tsc --noEmit` | ✅ EXIT 0 (sạch) |
| i18n scan | manual grep `vi.js`/`en.js` | ❌ AlertCenterPage + 4 component KHÔNG dùng key nào → hardcoded VN |
| Test | backend `signal_intelligence/tests` (9 files) | ✅ tồn tại test cho feed/summary/ack/mute; frontend thiếu test component AlertCenterPage |

---

## G. CÂU HỎI CẦN LÀM RÕ

1. `consumers.py` RealtimeConsumer đã deploy production chưa? Frontend có auth token (PAT) cho WS không?
2. Có kế hoạch gộp `frontend/UnifiedAlertCenter` vào `packages/web` không, hay `packages/web` là single source of truth?
3. `alert_family` vs `alert_type` — backend thực tế trả field nào trong feed response? (Cần trace serializer `UnifiedAlertSerializer`.)
4. Ngân sách cho notification (FCM/VAPID keys) đã config chưa?

---

## H. ĐÁNH GIÁ TỔNG THỂ & ĐỀ XUẤT NÂNG CẤP (ROADMAP)

**Trạng thái hiện tại:** Backend xuất sắc (9 endpoint + WS + notification + delivery state machine + contract chuẩn). Frontend ở mức MVP: hoạt động đúng nhưng thiếu realtime, thiếu filter nâng cao, thiếu i18n, thiếu notification UI, drawer nghèo.

**Ưu tiên sửa (theo impact):**

| Priority | Hạng mục | Effort | Impact |
|----------|----------|--------|--------|
| P0 | F3 i18n hóa toàn trang (vi/en) | M | Cao (compliance) |
| P0 | F2 thêm filter severity + alert_family | S | Cao (core feature) |
| P0 | F4 race-guard / dedupe polling | S | Cao (data integrity) |
| P1 | F1 tích hợp WebSocket realtime (thay polling) | L | Rất cao (CX) |
| P1 | F5 cursor/server pagination đúng kiến trúc | M | Cao |
| P1 | F6 enrich DetailDrawer (chart + recent_events) | M | Cao |
| P2 | F7 Notification Preferences UI | M | Cao |
| P2 | F8 bulk ack / mark-all-read / auto-seen | S | TB |
| P2 | F9 global toast + sound + severity system | M | TB |
| P3 | F10 sessionDate picker, F11 xóa dup file, F12 a11y | S | Thấp |

**Kết luận:** Tính năng có thể đạt đẳng cấp thương mại (TradingView/Finviz class) bằng cách tận dụng hạ tầng backend đã có sẵn — trọng tâm là frontend: realtime (WS), filter, i18n, notification UI. Không cần thay đổi contract.

---

# PHẦN 2 — REFACTOR THEME/TEMPLATE SYSTEM (SAAS FRONTEND)

**Mục tiêu bổ sung:** Đưa alert-center về chuẩn design system của `packages/web` (token chuẩn + CSS Module + ShellPageTemplate) thay vì inline `CORE_STYLES` tự chế.

## P. BẢN ĐỒ THEME SYSTEM HIỆN TẠI (chuẩn hệ thống)

| Lớp | File | Trách nhiệm | Cách dùng |
|-----|------|-------------|-----------|
| Global tokens | `src/theme/tokens.css` (56 dòng) | `--accent-cyan`, `--text-primary`, `--border-default`, `--bg-panel`, font/spacing scale | Load qua `src/index.css:2` `@import "./theme/tokens.css"` → available global |
| Component tokens | `src/theme/theme.module.css` (383 dòng) | `.btn/.card/.panelGlass/.badge/.table/.drawer/.alert/.metric` compose từ tokens | `import styles from ".../theme.module.css"` |
| SOC glass | `src/components/soc/soc.module.css` (2657 dòng) | Glassmorphism, tab bar, severity colors SOC | `import styles from ".../soc.module.css"` |
| Shell template | `src/components/ShellPageTemplate.module.css` + `.js` | `ShellMetric/ShellField/ShellSelectField/ShellTable` reusable | `import styles from ".../ShellPageTemplate.module.css"` |
| Page wrapper | `src/components/ShellPageTemplate.js` | Wrapper chuẩn cho mọi page SaaS | Dùng ở `Shell*.tsx`, `BillingCenterPage`, `TenantAdmin*` |

**Quy tắc vàng (AGENTS.md):** SOC dùng `soc.module.css`; component dùng `theme.module.css`; KHÔNG dùng `dangerouslySetInnerHTML` style string; KHÔNG định nghĩa `--neon-*` riêng.

## Q. CONTRADICTIONS — ALERT-CENTER vs THEME SYSTEM

| Chuẩn hệ thống | Code alert-center thực tế | Tác động |
|---------------|---------------------------|----------|
| `index.css:2` global tokens (`--accent-cyan` etc) | `AlertCenterPage.tsx:292` inject `CORE_STYLES` (`AlertCenterPage.styles.js:1-1053`) định nghĩa lại `--neon-*` riêng | Alert-center không nhận theme light/dark của user; style lệch toàn bộ app |
| `theme.module.css` + CSS Module scoping | `AlertCenterPage.styles.js` là 1 string 1053 dòng inline qua `<style dangerouslySetInnerHTML>` | Không scoping → tên class `core-alert-center-*` có thể conflict; không tree-shake; không lint CSS |
| `ShellPageTemplate.js` wrapper chuẩn | `AlertCenterPage.tsx` tự viết header/filter/section thủ công | Divergence layout vs mọi page SaaS khác |
| `theme.module.css` `.drawer*` chuẩn | `DetailDrawer.module.css` dùng `--acdrawer-*` token tự chế + `DetailDrawer.js` KHÔNG import nó (object literal) | **File module css chết hoàn toàn**; drawer không dùng token system |
| `theme.module.css` `.table*` chuẩn | `SymbolStatsTable.module.css` dùng `--acsym-*` token tự chế + `SymbolStatsTable.js` KHÔNG import nó | **File module css chết hoàn toàn** |
| Severity colors chuẩn (`--accent-rose/amber/emerald/cyan`) | `AlertCenterPage.styles.js:509-527` tự định nghĩa `.severity-critical/.high/.medium/.low` | Màu severity không đồng bộ với SOC/badge system |
| `theme.module.css` `.btn/.btnPrimary` | `AlertCenterPage.tsx:329,401,419` tự style button inline + `.core-feed-sort-btn` | Button không có hover/focus chuẩn, không a11y |

## R. FINDINGS REFACTOR THEME

### R1 [GAP] Inline `CORE_STYLES` thay vì CSS Module — Cao
- `file`: `AlertCenterPage.tsx:292`, `AlertCenterPage.styles.js:1` (1053 dòng)
- Thực tế: Toàn bộ style là 1 template string inject qua `dangerouslySetInnerHTML`.
- Tác động: (a) Không scoping; (b) không nhận global tokens (light theme user bị phá); (c) không lint/type-check CSS; (d) bundle không tree-shake.
- Đề xuất: Tách thành `AlertCenterPage.module.css` dùng `import styles from "./AlertCenterPage.module.css"`; thay `--neon-*` bằng `--accent-cyan/--border-default/--bg-panel` từ `tokens.css`. Xóa `AlertCenterPage.styles.js`.

### R2 [BUG] 2 file `.module.css` alert-center là dead code — Trung bình
- `file`: `DetailDrawer.module.css`, `SymbolStatsTable.module.css` + `DetailDrawer.js:2-12`, `SymbolStatsTable.js:2-27`
- Thực tế: JS định nghĩa object literal class names (ví dụ `detailDrawer: "core-detail-drawer"`) → KHÔNG import file module. 2 file css trên không bao giờ được bundle.
- Tác động: Style thực tế đến từ `CORE_STYLES` (AlertCenterPage inject) — tức là DetailDrawer/SymbolStatsTable phụ thuộc vào parent inject style. Dễ gãy, khó maintain.
- Đề xuất: Xóa 2 file module css chết; trong `DetailDrawer.js`/`SymbolStatsTable.js` import `AlertCenterPage.module.css` (sau khi refactor R1) hoặc dùng `soc.module.css`/`theme.module.css`.

### R3 [GAP] Tự định nghĩa token `--neon-*` thay vì system — Cao
- `file`: `AlertCenterPage.styles.js:3-17`
- Thực tế: `--neon-green:#00e676` etc — trùng think nhưng khác giá trị với `--accent-emerald:#10b981` của system.
- Tác động: Khi user đổi theme (light mode từ `UserSettingsPage.tsx:71`), alert-center giữ màu tối cứng → mismatch.
- Đề xuất: Map `--neon-*` → system token: green→`--accent-emerald`, red→`--accent-rose`, orange→`--accent-amber`, blue→`--accent-cyan`, purple→`--accent-shell` (hoặc thêm `--accent-purple`).

### R4 [GAP] Không dùng ShellPageTemplate wrapper — Trung bình
- `file`: `AlertCenterPage.tsx:293-332` (tự viết header), so với `ShellPageTemplate.js`
- Thực tế: Mọi SaaS page khác dùng `ShellPageTemplate` (title/back/actions slot). Alert-center tự build header.
- Đề xuất: Wrap bằng `ShellPageTemplate` hoặc ít nhất dùng `.pageHeader`/`.toolbar` classes chuẩn.

### R5 [GAP] Severity color system không đồng bộ — Thấp/Trung bình
- `file`: `AlertCenterPage.styles.js:447-465`, `AlertCard.js:40`
- Thực tế: `.severity-critical/high/medium/low` tự định nghĩa; SOC dùng `socStatusColors.ts` + `theme.module.css` `.badgeDanger/.badgeWarning`.
- Đề xuất: Tạo `severity.module.css` hoặc reuse `socStatusColors.ts` (`src/components/soc/socStatusColors.ts:2` đã resolve system vars) cho color nhất quán.

### R6 [GAP] Button/Input không theo `theme.module.css` — Thấp
- `file`: `AlertCenterPage.tsx:320-328,401-441`
- Thực tế: Input filter + sort btn + refresh btn tự style; không `.input`/`.btnPrimary`/`.btnSecondary`.
- Đề xuất: Dùng `theme.module.css` `.input`, `.btn`, `.btnSecondary`; hoặc `ShellField`/`ShellSelectField`.

## S. PHƯƠNG ÁN REFACTOR ĐỀ XUẤT (CHI TIẾT)

**Bước 1 — Thống nhất token (R3):** Trong `AlertCenterPage.module.css` mới, thay mọi `--neon-*` bằng reference token system. Không định nghĩa `:root` mới (tokens đã global qua `index.css`).

**Bước 2 — Tạo `AlertCenterPage.module.css` (R1):** Chuyển 1053 dòng `CORE_STYLES` → CSS Module. Pattern:
```css
.page { background: var(--bg-panel); color: var(--text-primary); font-family: var(--font-sans); padding: var(--sp-6); }
.header { display:flex; justify-content:space-between; gap: var(--sp-5); border-bottom:1px solid var(--border-default); padding-bottom: var(--sp-5); }
.liveBadge { display:inline-flex; align-items:center; gap: var(--sp-2); }
/* severity map */
.severity-critical { border-left: 3px solid var(--accent-rose); }
.severity-high { border-left: 3px solid var(--accent-amber); }
.severity-medium { border-left: 3px solid var(--accent-cyan); }
.severity-low { border-left: 3px solid var(--text-muted); }
```
AlertCenterPage.tsx: xóa `import { CORE_STYLES }`, xóa `<style dangerouslySetInnerHTML>`, import `styles`.

**Bước 3 — Fix dead module css (R2):** Xóa `DetailDrawer.module.css` + `SymbolStatsTable.module.css`. Trong `DetailDrawer.js`/`SymbolStatsTable.js` import `AlertCenterPage.module.css` (shared) hoặc tách `alertCenter.shared.module.css`. Đổi object-literal classNames → `styles.xxx`.

**Bước 4 — Reuse system components (R4,R6):** Header dùng `ShellPageTemplate` pattern; filter input dùng `ShellField`/`.input`; buttons dùng `.btn/.btnPrimary/.btnSecondary` từ `theme.module.css`.

**Bước 5 — Severity consistency (R5):** Import `socStatusColors.ts` cho color resolve; hoặc thêm `.severityBadge` vào `theme.module.css`.

## T. REFACTOR QUALITY GATES
| Gate | Trước | Sau mục tiêu |
|------|-------|--------------|
| CSS Module usage | 0/5 component dùng module | 5/5 (page + 4 component) |
| `dangerouslySetInnerHTML` style | 1 (CORE_STYLES) | 0 |
| Dead `.module.css` | 2 file | 0 |
| Token system alignment | `--neon-*` riêng | 100% `--accent-*`/`--border-*`/`--bg-*` |
| Theme light/dark support | Không (cứng tối) | Có (nhờ global tokens) |
| ESLint CSS (`css-modules`/stylelint) | N/A | Pass |

## U. ROADMAP REFACTOR (ghép với phần 1)
| Priority | Hạng mục | Effort | Depends |
|----------|----------|--------|---------|
| P0 | R3 + R1: token system + AlertCenterPage.module.css | M | — |
| P0 | R2: xóa dead module css, wire DetailDrawer/SymbolStatsTable vào module | S | R1 |
| P1 | R4 + R6: ShellPageTemplate wrapper + system btn/input | M | R1 |
| P1 | R5: severity color đồng bộ socStatusColors | S | R1 |
| P2 | Visual regression test (đã có `tests/visual/alert-center-*.png` snapshots) re-baseline | S | R1-R5 |

**Kết luận phần 2:** Alert-center là "island" style tách biệt hoàn toàn khỏi design system. Refactor không đổi logic/API, chỉ đổi presentation layer → rủi ro thấp, tác động cao (đồng bộ UX, hỗ trợ light theme, dễ maintain). Nên làm song song với P0 của phần 1 (i18n + filter + race-guard).
