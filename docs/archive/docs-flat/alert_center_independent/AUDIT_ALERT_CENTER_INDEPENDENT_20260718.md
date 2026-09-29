# AUDIT ĐỘC LẬP — PIPELINE TÍNH NĂNG ALERT CENTER (PACKAGES/WEB + PACKAGES/CORE)

**Ngày audit:** 2026-07-18 (re-audit độc lập, bổ sung cho `AUDIT_ALERT_CENTER_20260718.md`)
**Phạm vi:** Toàn bộ pipeline Alert Center — backend `signal_intelligence/*`, adapter `market.js`, hooks `useAlertCenterData.js`/`useAlertCenterSnapshot.ts`, `AlertCenterPage.tsx` + 4 component con, WS client `useRealtimeFeedCore.js`/`RealtimeContext.js`, contract `unified-alert.contract.json` + `WEBSOCKET_EVENT_CONTRACT.md`, routing `pageRegistry.js`.
**Phương pháp:** Đọc thực tế từng file (line-by-line), trace 3 luồng (feed load, ack, realtime), đối chiếu code ↔ contract ↔ WS contract. Mọi claim kèm `file:line`.

---

## A. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT (INDEPENDENT)

1. **[GAP/KIẾN TRÚC] AlertCenterPage tái phát minh polling thủ công thay vì dùng WS client Production-grade đã có.** Codebase có `useRealtimeFeedCore.js` (1256 dòng, circuit-breaker, heartbeat, dedup, fallback polling) + `RealtimeContext.js` (manager), đã được `DashboardPage.tsx:177` dùng. Nhưng `AlertCenterPage.tsx:115-121` tự viết `setInterval(5000)` gọi `useAlertCenterData` → 3 HTTP calls/5s/user. **Lãng phí hạ tầng có sẵn, trái SSOT.**
2. **[BUG/CONTRACT] WS broadcast KHÔNG BAO GIỜ phát `market_discovery_event`** — `broadcasting.py:113-131` chỉ `group_send` vào `market_discovery` group, nhưng payload `event_type` vẫn là `whale_alert`/`dark_flow_alert`/`system_alert` (line 62-66). Trong khi đó `useRealtimeFeedCore.js:1127` chỉ xử lý `market_discovery_event` (KHÔNG xử lý `whale_alert`/`dark_flow_alert` ở mức discovery — nó xử lý chúng riêng). → **AlertCenterPage đăng ký `market_discovery` sẽ nhận được event có `event_type=whale_alert` nhưng không được parse thành discovery event.** Pipeline realtime bị đứt đoạn giữa broadcast và client handler.
3. **[CONTRADICTION] WS subscribe contract lệch 2 chiều.** `WEBSOCKET_EVENT_CONTRACT.md:148-153` quy định client gửi `{action:"subscribe", channels:[...]}` và server ack `{event_type:"subscription_ack", channels:[...]}`. Thực tế `consumers.py:192-216` nhận `{action:"subscribe", symbols:[...]}` và ack `{event_type:"subscribed", symbols:[...]}`. → Contract stale, client nào code theo contract sẽ fail.
4. **[GAP/SSOT] 2 hook feed song song + 2 trang Alert Center.** `useAlertCenterData.js` (polling, AlertCenterPage) và `useAlertCenterSnapshot.ts` (cursor, DashboardPage:166) làm trùng chức năng lấy feed. Đồng thời `AlertCenterPage.tsx` (route `alert-center`) và `components/dashboard/UnifiedAlertCenter.js` (+ bản dup `UnifiedAlertCenter (1).js`) là 2 UI alert-center chồng lấp. → SSOT bị phá vỡ, logic feed duplicate.
5. **[GAP/i18n+THEME] AlertCenterPage là "island" full hardcode VN + inline `CORE_STYLES` 1053 dòng, KHÔNG dùng design system.** Vi phạm nguyên tắc 5 AGENTS.md (i18n) và quy tắc design system (SOC `soc.module.css`/`theme.module.css`/ShellPageTemplate). 2 file `.module.css` (`DetailDrawer.module.css`, `SymbolStatsTable.module.css`) là dead code — JS con định nghĩa object literal classNames, không import file.

---

## B. BẢN ĐỒ KIẾN TRÚC (thực tế, có line count)

| File | Line | Trách nhiệm | Note |
|------|------|-------------|------|
| `pages/AlertCenterPage.tsx` | 490 | Trang alert-center: filter/sort/feed/stats/drawer, polling 5s | `createElement`, hardcode VN, `dangerouslySetInnerHTML` CORE_STYLES, KHÔNG ShellPageTemplate |
| `hooks/useAlertCenterData.js` | 92 | Fetch feed+summary+symbolStats (Promise.all) | Chỉ `mountedRef`, KHÔNG requestId/AbortController → race |
| `hooks/useAlertCenterSnapshot.ts` | 89 | Feed cursor pagination (severity/alert_family params) | Được DashboardPage:166 dùng, KHÔNG orphan |
| `components/alert-center/AlertCard.js` | 135 | Card alert | Hardcode VN, `createElement`, dùng `alert_family\|\|alert_type` |
| `components/alert-center/SummaryMetrics.js` | 21 | 5 card tổng hợp | Hardcode VN |
| `components/alert-center/SymbolStatsTable.js` | 119 | Bảng thống kê mã | Object-literal classNames, Dead `.module.css` |
| `components/alert-center/DetailDrawer.js` | 44 | Drawer pháp y | 2 section, object-literal classNames, Dead `.module.css`, hông chart |
| `pages/AlertCenterPage.styles.js` | 1053 | Toàn bộ CSS inline qua `<style>` | `--neon-*` riêng, không token system |
| `adapters/core/market.js` | 560 | Map alert-center ↔ core (9 method) | Đầy đủ, nhất quán; query `URLSearchParams` đúng |
| `hooks/useRealtimeFeedCore.js` | 1256 | WS client production-grade (circuit-breaker, dedup, fallback) | **KHÔNG được AlertCenterPage dùng** |
| `context/RealtimeContext.js` | — | Manager cung cấp `useRealtimeFeedFromManager` | Được DashboardPage dùng |
| `signal_intelligence/views.py` | 713 | 9 endpoint alert-center + order-flow + whale-feed | Hỗ trợ severity/alert_family filter đầy đủ |
| `signal_intelligence/serializers.py` | 74 | `UnifiedAlertSerializer` trả `alert_family`/`lane`/`summary`/`executed_at` | **Trái contract `additionalProperties:false`** |
| `signal_intelligence/consumers.py` | 250 | `RealtimeConsumer` subscribe/unsubscribe `market_{sym}`+`market_discovery` | Protocol lệch WS contract (symbols≠channels) |
| `signal_intelligence/broadcasting.py` | 148 | `broadcast_unified_alert` → group_send | Chỉ emit whale/dark_flow/system, KHÔNG market_discovery_event |
| `signal_intelligence/delivery_service.py` | 196 | ack/seen/mute state machine + user-scope | Đầy đủ, đúng |
| `shared/api-contracts/unified-alert.contract.json` | 108 | Contract chuẩn | `additionalProperties:false`, thiếu alert_family/lane/evidence... |
| `docs/WEBSOCKET_EVENT_CONTRACT.md` | 190 | WS event contract | Quy định `channels`/`subscription_ack` — lệch consumers |
| `pages/pageRegistry.js` | 302 | Route registry | `alert-center` là route `core` (KHÔNG ShellX baseline) |

---

## C. LUỒNG DỮ LIỆU ĐÃ TRACE

### C1. Feed load (REST) — hoạt động đúng nhưng lãng phí
1. `AlertCenterPage.tsx:115-121` `setInterval(5000)` → `setRefreshToken+1`.
2. `useAlertCenterData.js:16-89` dep `refreshToken` → `Promise.all([getAlertCenterFeed, getAlertCenterSummary, getAlertCenterSymbolStats])` (`market.js:50,62,74`).
3. Adapter → `coreGet('/signals/alert-center/feed?symbol=...')` → `views.py:356 AlertCenterFeedView` → `_apply_common_alert_filters` (hỗ trợ severity/alert_family đã có, line 141-197) → `delivery_service.apply_user_delivery_policy` → CursorPaginated.
4. Serializer (`serializers.py:14-18`) trả `alert_family`, `lane`, `summary`, `executed_at`, `evidence` — **vượt contract**.
5. UI slice client-side (`AlertCenterPage.tsx:236-242`) 5 item/page trên `results` (page_size backend mặc định). **Cursor `next/previous` bị bỏ** → không load lịch sử.

### C2. Acknowledge (REST) — đúng nhưng push ngược chậm
1. `AlertCenterPage.tsx:194-206 handleAcknowledge` → `acknowledgeAlertCenterEvent` (`market.js:110` → POST `.../events/{id}/ack`).
2. Backend `views.py:583` → `delivery_service.acknowledge_delivery` → state transition đúng (guard `transition_delivery_state`).
3. **Không push ngược**: UI chỉ `setRefreshToken+1` → đợi ≤5s mới reflect. Nếu có WS, nên nhận event ack để update tức thì.

### C3. Realtime (WS) — ĐỨT ĐOẠN (finding A.2)
1. `useRealtimeFeedCore.js:1013-1014` subscribe `['market_discovery', ...symbols]` → `consumers.py:208` group `market_discovery`.
2. Backend `tasks.py:364` (materialize) → `broadcasting.py:113 broadcast_unified_alert` → `group_send(market_discovery, {type:'market_update', data: payload})`.
3. **`serialize_unified_alert` (`broadcasting.py:56-110`) set `event_type` = `whale_alert`/`dark_flow_alert`/`system_alert`** (line 62-66), KHÔNG bao giờ `market_discovery_event`.
4. Client `useRealtimeFeedCore.js:1127` chỉ xử lý `event_type==='market_discovery_event'` → **event từ `market_discovery` group bị bỏ qua** (không match bất kỳ branch nào trừ khi `event_type` trùng). → Realtime feed cho AlertCenter bị chết ngay cả khi WS connect thành công.

---

## D. CONTRADICTIONS (code ↔ contract ↔ doc)

| Contract/Doc | Code thực tế | Tác động |
|--------------|--------------|----------|
| `unified-alert.contract.json:11` `additionalProperties:false`, chỉ có `alert_type` | `serializers.py:14-18` trả thêm `alert_family`,`lane`,`summary`,`executed_at`,`evidence` | Serializer vi phạm contract. Client nào validate theo contract sẽ reject. Contract stale. |
| `WEBSOCKET_EVENT_CONTRACT.md:148` client gửi `channels:[...]` | `consumers.py:192-216` nhận `symbols:[...]` | Client code theo contract → subscribe thất bại |
| `WEBSOCKET_EVENT_CONTRACT.md:164-172` server ack `subscription_ack`/`channels` | `consumers.py:213-216` ack `subscribed`/`symbols` | Client chờ `subscription_ack` → never resolves |
| WS contract §3.4 + §3 enum `whale_alert`/`dark_flow_alert`/`market_discovery_event` | `broadcasting.py:62-66` emit `whale_alert`/`dark_flow_alert`/`system_alert` (KHÔNG `market_discovery_event`, KHÔNG `system_alert` trong contract enum) | Client discovery listener chết |
| AGENTS.md nguyên tắc 5: i18n bắt buộc | `AlertCenterPage.tsx` + 4 component: 0 key i18n, 100% hardcode VN | EN user thấy toàn VN; vi phạm quality gate |
| AGENTS.md: SOC design system (soc.module.css/theme.module.css/ShellPageTemplate) | `AlertCenterPage.tsx:292` inject `CORE_STYLES` 1053 dòng, `DetailDrawer.js:2-12`/`SymbolStatsTable.js:2-27` object-literal classNames | 2 `.module.css` dead; không nhận light/dark theme; không lint CSS |
| `useAlertCenterSnapshot.ts` bị audit cũ gọi "orphan" | `DashboardPage.tsx:166` import & dùng | Audit cũ SAI — hook không chết, là SSOT feed của Dashboard |

---

## E. FINDINGS CHI TIẾT (independent)

### F1 [GAP/KIẾN TRÚC] AlertCenterPage không dùng WS client có sẵn — Cao
- `AlertCenterPage.tsx:115-121` vs `useRealtimeFeedCore.js:412-1256` + `RealtimeContext.js`.
- Tác động: (a) ~36 req/user/phút thay vì 0 HTTP cho feed realtime; (b) trễ 0–5s; (c) duplicate hạ tầng realtime đã được DashboardPage chứng minh hoạt động.
- Đề xuất: AlertCenterPage consume `useRealtimeFeedFromManager({symbols:['market_discovery']})` (hoặc hook mới `useAlertCenterRealtime` bọc `useRealtimeFeedCore`), giữ REST polling làm fallback (backoff khi WS down — logic đã có sẵn trong `useRealtimeFeedCore`).

### F2 [BUG/PIPELINE] WS discovery event không bao giờ được phát — Cao (blocker realtime)
- `broadcasting.py:56-110` (serialize) + `:113-131` (broadcast).
- Thực tế: `market_discovery` group nhận event `event_type=whale_alert`/`dark_flow_alert`/`system_alert`. Client (`useRealtimeFeedCore.js:1127`) chỉ xử lý `market_discovery_event`.
- Tác động: Ngay cả khi AlertCenterPage đăng ký `market_discovery`, nó không nhận được alert realtime nào. **Realtime feed hoàn toàn chết.**
- Đề xuất (chọn 1): (a) Sửa `serialize_unified_alert` phát `event_type='market_discovery_event'` khi publish vào `market_discovery` group; hoặc (b) Sửa `useRealtimeFeedCore` xử lý `whale_alert`/`dark_flow_alert` từ discovery group. Ưu tiên (a) — đồng bộ với WS contract §3 enum.

### F3 [CONTRACT] WS subscribe protocol lệch 2 chiều — Cao
- `WEBSOCKET_EVENT_CONTRACT.md:148-172` vs `consumers.py:192-216`.
- Đề xuất: Hoặc update contract thành `symbols`/`subscribed`, hoặc update `consumers.py` thành `channels`/`subscription_ack`. Phải làm song song với F2 để client (DashboardPage đang chạy OK với `symbols`) không gãy. **Recommend: giữ `symbols`/`subscribed` (đã implement + đang chạy) và sửa contract doc.**

### F4 [BUG/RACE] Polling không dedupe stale response — Trung bình/Cao
- `useAlertCenterData.js:16-89`: `mountedRef` chỉ guard unmount. Request chậm (6s) resolve sau request nhanh (1s) → state ghi đè data cũ.
- Đề xuất: Thêm `requestIdRef`/`AbortController`; chỉ apply response có id mới nhất. (Sẽ tự giải quyết nếu chuyển sang WS theo F1.)

### F5 [GAP] Thiếu filter severity & alert_family ở UI — Cao
- Backend: `views.py:141-197` (`_apply_common_alert_filters`) + OpenAPI params `alert_family`/`severity` (`views.py:346-347,486`).
- Frontend: `useAlertCenterData.js:23-27` chỉ truyền `symbol/session_date/timeframe`. `AlertCenterPage.tsx:317-331` chỉ filter symbol.
- Đề xuất: Thêm `severity` multi-select (critical/high/medium/low) + `alert_family` chips (whale/dark_flow/price_shock/ai_suggest...). `useAlertCenterSnapshot.ts:6-11` ĐÃ có params `severity`/`alert_family` sẵn → tái dùng.

### F6 [GAP] Pagination sai kiến trúc (client-side trên page đầu) — Trung bình
- `AlertCenterPage.tsx:236-242` slice `sortedAlerts` (tối đa page_size backend). `useAlertCenterData.js:44-48` lưu `next/previous` nhưng không dùng.
- Đề xuất: Dùng cursor pagination (pattern có trong `useAlertCenterSnapshot.ts` đã viết & tested) hoặc server-side sort. Sort "largestValue" hiện chỉ đúng trên page đầu.

### F7 [GAP] DetailDrawer nghèo, không chart/evidence visual — Trung bình
- `DetailDrawer.js:17-43` chỉ 2 text section. `views.py:553 AlertCenterSymbolContextView` có `recent_events` sẵn.
- Đề xuất: Embed mini-chart (`vninvestcharts-widget`) cho symbol + hiển thị `recent_events` + evidence structured (KHÔNG `JSON.stringify` như `AlertCard.js:16`).

### F8 [GAP] Không có Notification Preferences UI — Trung bình
- Backend `outbound_notification_service.py` có email/FCM/WebPush; `muteAlertCenterPreference` (`AlertCenterPage.tsx:213-217`) hardcode `mute_minutes:30`.
- Đề xuất: Tab "Cài đặt thông báo": toggle channel, severity threshold, mute list, cooldown tùy chỉnh.

### F9 [GAP] Không bulk ack / mark-all-read / auto-seen — Thấp/Trung bình
- `AlertCenterPage.tsx:194-206` chỉ ack từng cái. `delivery_service.mark_delivery_seen`/`acknowledge_delivery` đã có sẵn per-alert.
- Đề xuất: Bulk acknowledge, mark-all-read, auto-seen on view (dedup với WS `seen` event nếu có).

### F10 [GAP] Sound/Global toast + severity color system lỏng lẻo — Thấp
- `AlertCenterPage.styles.js` severity colors hardcode; `AlertCard.js:40` default `medium`.
- Đề xuất: Toast global (dùng pattern `StickyAlertBar` đã có ở frontend khác), sound option, severity map qua `socStatusColors.ts`.

### F11 [BUG] `sessionDate` state luôn `""` và không dùng — Thấp
- `AlertCenterPage.tsx:78` `useState("")`, không bao giờ set. Filter ngày phiên vô dụng.
- Đề xuất: Date picker hoặc auto = latest session (backend `views.py:194` đã hỗ trợ `session` timeframe auto).

### F12 [GAP] Duplicate file & dead code — Thấp
- `components/dashboard/UnifiedAlertCenter (1).js` (bản copy của `UnifiedAlertCenter.js`).
- `DetailDrawer.module.css`, `SymbolStatsTable.module.css` dead (JS không import).
- Đề xuất: Xóa `(1).js`; xóa 2 `.module.css` hoặc wire chúng.

### F13 [GAP] Accessibility — Thấp
- Toàn bộ component `createElement` thủ công, thiếu `aria-*`, `role`, keyboard nav drawer/pagination.
- Đề xuất: `role="alert"`/`aria-live` cho feed, focus trap cho drawer.

### F14 [GAP/SSOT] 2 hook feed + 2 UI alert-center — Trung bình (root cause của duplicate)
- `useAlertCenterData.js` (AlertCenterPage) vs `useAlertCenterSnapshot.ts` (DashboardPage); `AlertCenterPage.tsx` vs `UnifiedAlertCenter.js`(+dup).
- Đề xuất: Consolidate 1 hook feed (React Query, theo Sprint 6 `useTenantAdminQuery`) + 1 shared `AlertCenter` component dùng trong cả AlertCenterPage và DashboardPage.

---

## F. QUALITY GATES AUDIT

| Gate | Lệnh | Kết quả |
|------|------|---------|
| Lint | `npx eslint src/pages/AlertCenterPage.tsx src/components/alert-center src/hooks/useAlertCenterData.js` | ✅ EXIT 0 |
| Type-check | `npx tsc --noEmit` | ✅ EXIT 0 |
| i18n scan | grep `vi.js`/`en.js` | ❌ AlertCenterPage + 4 component: 0 key namespace `alertCenter.*` (chỉ nav label tồn tại) |
| Test | backend `signal_intelligence/tests` (9 files) | ✅ feed/summary/ack/mute có test |
| Test | frontend AlertCenterPage component | ❌ KHÔNG có test component |
| Contract validate | serializer vs `unified-alert.contract.json` | ❌ serializer vi phạm `additionalProperties:false` |
| WS contract | `broadcasting.py`/`consumers.py` vs `WEBSOCKET_EVENT_CONTRACT.md` | ❌ protocol + event_type lệch |

---

## G. CÂU HỎI CẦN LÀM RÕ

1. `broadcasting.py` phát `system_alert` (cho SIGNAL/SYSTEM) nhưng WS contract §3 KHÔNG định nghĩa `system_alert` — intentional hay thiếu?
2. `useRealtimeFeedCore.js` lắng nghe `whale_advisory`/`news_digest`/`market_discovery_event` nhưng backend hiện không phát 3 event này → có plan phát không, hay client over-engineered?
3. AlertCenterPage là route `core` (không ShellX). Có plan promote lên `ShellAlertCenterPage` (baseline) để đồng bộ layout không?
4. `UnifiedAlertCenter.js` (DashboardPage) có plan gộp vào AlertCenterPage để có SSOT không?

---

## H. ROADMAP NÂNG CẤP LÊN ĐẲNG CẤP THƯƠNG MẠI (TradingView / Finviz / Benzinga class)

Dựa trên hạ tầng backend đã xuất sắc (9 endpoint + WS + delivery state machine + notification), trọng tâm là **gắn pipeline realtime đang đứt + chuẩn hóa SSOT + i18n/theme**.

| Priority | Hạng mục | Effort | Impact | Depends |
|----------|----------|--------|--------|---------|
| **P0** | F2: Sửa WS broadcast phát `market_discovery_event` (hoặc client handler) — mở realtime | S | Rất cao (CX) | — |
| **P0** | F1: AlertCenterPage consume `useRealtimeFeedFromManager` thay polling 5s | M | Rất cao | F2 |
| **P0** | F3: Chuẩn hóa WS contract doc ↔ consumers (giữ `symbols`/`subscribed`, sửa doc) | S | Cao (doc/SSOT) | F2 |
| **P0** | F5: Sửa contract `unified-alert` (bỏ `additionalProperties:false` hoặc thêm field thiếu) | S | Cao (contract integrity) | — |
| **P0** | F3(i18n): Namespace `alertCenter.*` vi/en, refactor 5 component | M | Cao (compliance) | — |
| **P0** | F5(filter): Thêm filter severity + alert_family (tái dùng `useAlertCenterSnapshot` params) | S | Cao (core feature) | — |
| **P1** | F4: race-guard / dedupe (hoặc tự giải bằng WS) | S | Cao (data integrity) | F1 |
| **P1** | R1/R2/R3 (theme): Xóa `CORE_STYLES`, tạo `AlertCenterPage.module.css`, wire dead `.module.css`, map `--neon-*`→token | M | Cao (UX/light theme) | — |
| **P1** | F6: Enrich DetailDrawer (chart + recent_events + structured evidence) | M | Cao | — |
| **P1** | F14/SSOT: Consolidate 1 hook feed (React Query) + 1 shared AlertCenter component | L | Rất cao (maintainability) | F1,F5 |
| **P2** | F8: Bulk ack / mark-all-read / auto-seen | S | TB | F1 |
| **P2** | F7: Notification Preferences UI | M | Cao | — |
| **P2** | F9: Global toast + sound + severity system (socStatusColors) | M | TB | R1 |
| **P3** | F10/F11/F12/F13: sessionDate picker, xóa dup file, a11y | S | Thấp | R1 |

**Kết luận:** Backend đã đạt chuẩn thương mại. Frontier lớn nhất là **pipeline realtime bị đứt giữa `broadcasting.py` và client** (F2) + AlertCenterPage tự viết polling thay vì dùng WS client sẵn có (F1). Sửa 2 điểm này + i18n + filter + theme sẽ đưa tính năng từ "MVP island" lên "TradingView-class" với effort trung bình, rủi ro thấp (không đổi REST contract, chỉ sửa WS event_type + frontend consume).

---

## I. CORRECTION (re-review 2026-07-18) — F2 BỊ OVERSTATE

**Phản biện từ review độc lập:** F2 ("WS broadcast không phát market_discovery_event → realtime feed chết hoàn toàn") là **SAI / overstate**. Đã xác minh:

- `broadcasting.py:122-128` gửi **cùng 1 payload** (`event_type=whale_alert`/`dark_flow_alert`/`system_alert`) vào **CẢ** `market_{symbol}` VÀ `market_discovery` group.
- `useRealtimeFeedCore.js:1103` branch `whale_alert` xử lý theo `payload.event_type`, **không phân biệt group** (group không nằm trong payload). → Event từ discovery group đi vào `applyAlert()` bình thường. **KHÔNG bị bỏ qua.**
- `DashboardPage.tsx:177` dùng `useRealtimeFeedFromManager({symbols})` → nhận realtime alert thành công. → WS pipeline thực tế HOẠT ĐỘNG.

**Root cause thực sự của AlertCenterPage "không realtime" = F1:** `AlertCenterPage.tsx:1-9` chỉ import `useAlertCenterData` (REST) và **KHÔNG gọi `useRealtimeFeedFromManager`**. Data WS có đến nhưng không ai render.

**Re-classify F2:** `market_discovery_event` enum chỉ là **dead contract** (backend không emit, client `useRealtimeFeedCore.js:1127` listener tương ứng là dead code) → mức **THẤP**, KHÔNG phải blocker. WS contract doc (`WEBSOCKET_EVENT_CONTRACT.md` §3) nên được update bỏ/`market_discovery_event` hoặc backend bổ sung emit (tùy roadmap).

**Các điểm audit gốc ĐÚNG (được review xác nhận):** F1 (AlertCenterPage không consume WS), F3 contract doc stale (`channels`→`symbols`), F5 (thiếu filter severity/alert_family UI), i18n island, dup code. **Điểm audit gốc tự mâu thuẫn:** vừa gọi `useAlertCenterSnapshot` là "orphan" (§B/§D) vừa là "SSOT của Dashboard" — thực tế hook được `DashboardPage.tsx:166` dùng, **KHÔNG orphan**.

**Nuance kỹ thuật bắt buộc cho implement F1:** `useRealtimeFeedFromManager` (`RealtimeContext.js:155-158`) filter alert theo `normalizedSymbols.includes(item.symbol)`. Nếu AlertCenterPage subscribe `['market_discovery']`, filter này loại bỏ mọi alert thực tế (symbol là mã CP, không phải `'MARKET_DISCOVERY'`). → AlertCenterPage phải consume WS alert qua path **KHÔNG filter theo symbol** (dùng `baseFeed.alerts` raw) hoặc subscribe với symbol list rỗng + cơ chế passthrough riêng. Chi tiết xem `IMPLEMENTATION_PLAN_ALERT_CENTER_P0_20260718.md` Phase 1.
