# AUDIT ĐỘC LẬP — PHẢN BIỆN PIPELINE ALERT CENTER
# (Independent review of docs/AUDIT_ALERT_CENTER_INDEPENDENT_20260718.md)

**Ngày:** 2026-07-18 (audit độc lập thứ 2, đối chiếu với audit gốc)
**Phạm vi:** Phản biện 5 findings + 14 F-findings của audit gốc. Mọi claim đi kèm `file:line` thực tế, verify từng điểm qua read/grep.
**Phương pháp:** Đọc thực tế từng file cốt lõi, trace luồng broadcast→client, đối chiếu audit gốc vs code.

---

## 0. TÓM TẮT KẾT LUẬN ĐỘC LẬP

Audit gốc **về cơ bản đúng về F1 (kiến trúc polling)** và **F3 (contract lệch)**, nhưng **OVERSTATE NGHIÊM TRỌNG F2** (claim "realtime feed chết hoàn toàn" là SAI). Đồng thời audit gốc **mis-trace pipeline** giữa `broadcasting.py` ↔ `useRealtimeFeedCore.js`.

### 5 findings nghiêm trọng nhất — ĐÁNH GIÁ LẠI

| # | Claim audit gốc | Thực tế verify | Đánh giá |
|---|-----------------|----------------|----------|
| 1 | AlertCenterPage tự polling 5s thay vì WS client | `AlertCenterPage.tsx:115-121` setInterval 5s → `setRefreshToken`; page CHỈ import `useAlertCenterData` (`AlertCenterPage.tsx:8`), KHÔNG import `useRealtimeFeedFromManager`/`useRealtimeFeedCore` | ✅ **ĐÚNG** — F1 confirmed, đây là root cause thực sự của "không realtime ở AlertCenterPage" |
| 2 | WS broadcast KHÔNG BAO GIỜ phát `market_discovery_event` → realtime feed chết hoàn toàn | `broadcasting.py:122-128` gửi CÙNG `event_data` (event_type=`whale_alert`/`dark_flow_alert`) vào CẢ `market_{symbol}` VÀ `market_discovery` group. Client `useRealtimeFeedCore.js:1103` branch `whale_alert` xử lý event từ BẤT KỲ group nào → `applyAlert()` | ❌ **SAI / OVERSTATE** — Xem mục 2 bên dưới |
| 3 | WS subscribe contract lệch 2 chiều (channels/subscription_ack vs symbols/subscribed) | `consumers.py:192-216` nhận `symbols`/`subscribed`; `WEBSOCKET_EVENT_CONTRACT.md:148-172` quy định `channels`/`subscription_ack`; client `useRealtimeFeedCore.js:886,1044` GỬI/NHẬN `symbols`/`subscribed` | ✅ **ĐÚNG** — nhưng là doc-stale, không phải bug runtime (client+server đã thống nhất `symbols`) |
| 4 | 2 hook feed + 2 UI alert-center chồng lấp | `useAlertCenterData.js` (AlertCenterPage) vs `useAlertCenterSnapshot.ts` (DashboardPage:166); `AlertCenterPage.tsx` vs `UnifiedAlertCenter.js`(+dup `(1).js` tại `components/dashboard/`) | ⚠️ **ĐÚNG về dup**, nhưng audit gốc tự mâu thuẫn: vừa gọi `useAlertCenterSnapshot` là "orphan SAI" (D.7) vừa gọi là "SSOT của Dashboard" (B.3). Thực tế: hook ĐƯỢC DÙNG (DashboardPage:166), không orphan |
| 5 | i18n island + inline CORE_STYLES 1053 dòng + dead .module.css | `AlertCenterPage.tsx:292` inject `CORE_STYLES`; grep `i18n/vi.js` chỉ có nav label `alertCenter` (line 67,93), 0 namespace content; `DetailDrawer.module.css`/`SymbolStatsTable.module.css` KHÔNG import ở JS con | ✅ **ĐÚNG** |

---

## 1. BẢN ĐỒ KIẾN TRÚC (verify từng line)

| File | Line thực tế | Trách nhiệm | Note audit gốc đúng? |
|------|-------------|-------------|----------------------|
| `pages/AlertCenterPage.tsx` | 490 | Trang alert-center, polling 5s | ✅ |
| `hooks/useAlertCenterData.js` | 92 | Fetch feed+summary+symbolStats | ✅ chỉ `mountedRef`, no requestId (F4 race confirmed) |
| `hooks/useAlertCenterSnapshot.ts` | 89 | Cursor pagination, có `severity`/`alert_family` params (line 6-7,38) | ✅ ĐÚNG là SSOT của Dashboard, KHÔNG orphan |
| `components/alert-center/AlertCard.js` | 135 | Card alert | ✅ hardcode VN |
| `components/alert-center/SummaryMetrics.js` | 21 | 5 card tổng hợp | ✅ hardcode VN |
| `components/alert-center/SymbolStatsTable.js` | 119 | Bảng thống kê mã | ✅ dead .module.css |
| `components/alert-center/DetailDrawer.js` | 44 | Drawer pháp y | ✅ dead .module.css, no chart |
| `pages/AlertCenterPage.styles.js` | 1053 | CSS inline qua `<style>` | ✅ |
| `adapters/core/market.js` | 560 | Map alert-center ↔ core | ✅ đầy đủ |
| `hooks/useRealtimeFeedCore.js` | 1256 | WS client production-grade | ✅ |
| `context/RealtimeContext.js` | 197 | Manager; `useRealtimeFeedFromManager` line 108 | ✅ ĐÚNG export tồn tại |
| `signal_intelligence/consumers.py` | 250 | subscribe `symbols`/`subscribed` | ✅ |
| `signal_intelligence/broadcasting.py` | 148 | `broadcast_unified_alert` | ⚠️ audit gốc đọc SAI line (nói 62-66, thực tế serialize 56-110, broadcast 113-131) |
| `signal_intelligence/views.py` | 713 | 9 endpoint | ✅ |
| `signal_intelligence/serializers.py` | 74 | Trả `alert_family`/`lane`/`summary` | ⚠️ audit gốc claim "trái contract additionalProperties:false" — cần verify contract (CHƯA XÁC MINH contract JSON) |
| `signal_intelligence/delivery_service.py` | 196 | ack/seen/mute state machine | ✅ |
| `docs/WEBSOCKET_EVENT_CONTRACT.md` | 190 | WS event contract | ✅ doc-stale (`channels` vs `symbols`) |
| `pages/pageRegistry.js` | 302 | Route `alert-center` | ✅ route `core`, không ShellX |

---

## 2. F2 — ĐIỂM MÂU THUẪN QUAN TRỌNG NHẤT (audit gốc SAI)

### 2.1 Audit gốc claim (A.2, C.3, F2)
> "`broadcasting.py` phát `whale_alert`/`dark_flow_alert`; client `useRealtimeFeedCore.js:1127` chỉ xử lý `market_discovery_event` → event từ `market_discovery` group bị bỏ qua → Realtime feed chết hoàn toàn."

### 2.2 Thực tế verify (file:line)
- `broadcasting.py:122-128`:
  ```python
  symbol_group = f'market_{symbol}'
  discovery_group = 'market_discovery'
  event_data = {'type': 'market_update', 'data': payload}  # payload.event_type = whale_alert/dark_flow_alert
  channel_layer.group_send(symbol_group, event_data)
  channel_layer.group_send(discovery_group, event_data)   # CÙNG payload vào CẢ 2 group
  ```
- `useRealtimeFeedCore.js:1013-1014`: subscribe `['market_discovery', ...symbols]` → nhận event từ CẢ 2 group.
- `useRealtimeFeedCore.js:1103-1114`: branch `else if (payload.event_type === 'whale_alert')` → `applyAlert(normalizedPayload)` — **KHÔNG phân biệt group nguồn**. Event từ `market_discovery` group với event_type=`whale_alert` SẼ được xử lý tại đây.
- `useRealtimeFeedCore.js:1127` branch `market_discovery_event` chỉ dành cho format event KHÁC (có `id` field, xem `applyMarketDiscoveryEvent` line 693-704 filter `item.id`). Backend HIỆN TẠI KHÔNG phát format này.

### 2.3 Kết luận F2
- **Audit gốc SAI khi claim "realtime feed chết hoàn toàn".** WS thực tế hoạt động: whale/dark_flow alert ĐƯỢC deliver tới client qua cả symbol group và discovery group, và đươc `applyAlert`/`applyDarkFlowAlert` render.
- **Tuy nhiên, có 2 vấn đề thực sự:**
  1. **F2a (real bug, nhỏ):** `market_discovery_event` enum trong WS contract §3 KHÔNG BAO GIỜ được backend phát. Nghĩa là `applyMarketDiscoveryEvent` (line 693) + `marketDiscoveryEvents` state (line 431) + `window.dispatchEvent('market_discovery_update')` (line 703) là **dead code** đối với AlertCenter pipeline. Client over-engineered cho 1 event type backend không emit.
  2. **F2b (root cause thực sự của AlertCenterPage không realtime):** AlertCenterPage **KHÔNG GỌI** `useRealtimeFeedFromManager`/`useRealtimeFeedCore` (chỉ import `useAlertCenterData`, REST). Nên dù WS data đến, trang này không render nó. Đây là F1, không phải F2.

### 2.4 Đề xuất sửa (correction của F2)
- **KHÔNG cần** sửa `broadcasting.py` để phát `market_discovery_event` (sẽ break contract enum ngược lại, vì backend chưa có data format đó).
- Nếu muốn AlertCenterPage có realtime: **F1 là đủ** — consume `useRealtimeFeedFromManager({symbols:['market_discovery']})` trong AlertCenterPage, map `feed.alerts`/`feed.darkFlowAlerts` vào UI. WS đã deliver whale/dark_flow rồi.
- F2a (dead `market_discovery_event`): hoặc (a) backend bổ sung emit format này, hoặc (b) xóa dead branch client. Ưu tiên (b) nếu không có plan phát.

---

## 3. CONTRADICTIONS (audit gốc vs code)

| Audit gốc claim | Thực tế file:line | Đánh giá |
|-----------------|-------------------|----------|
| F2: "event từ market_discovery bị bỏ qua" | `useRealtimeFeedCore.js:1103` branch `whale_alert` xử lý mọi group | ❌ SAI — branch whale_alert bắt được |
| D.7: `useAlertCenterSnapshot.ts` là "orphan" | `DashboardPage.tsx:166` import & dùng | ❌ Tự mâu thuẫn trong cùng 1 audit (B.3 gọi là SSOT) |
| A.2 line `broadcasting.py:62-66`/`113-131` | Thực tế serialize 56-110, broadcast 113-131 | ⚠️ Line reference lệch, nhưng nội dung đúng |
| F3: contract lệch 2 chiều | `consumers.py:192-216` symbols/subscribed; client `:886,1044` cũng symbols/subscribed | ✅ ĐÚNG — nhưng là doc stale, client+server đã thống nhất |
| F14: 2 hook + 2 UI chồng lấp | Confirmed dup | ✅ ĐÚNG — nhưng không phải "root cause của duplicate" gây bug, chỉ là maintainability |

---

## 4. FINDINGS ĐỘC LẬP (đã verify)

### F1 [GAP/KIẾN TRÚC] AlertCenterPage không consume WS client — CAO (root cause thực sự)
- `AlertCenterPage.tsx:1-9` chỉ import `useAlertCenterData`; `:115-121` polling 5s.
- Tác động: ~12 req/user/phút (3 endpoint × 4 lần/phút) thay vì 0 cho realtime; trễ 0–5s.
- Đề xuất: Thêm `const realtimeFeed = useRealtimeFeedFromManager({ symbols: ['market_discovery'] })`; merge `realtimeFeed.alerts`+`darkFlowAlerts` vào `alerts` state; giữ REST polling làm fallback khi WS down (logic fallback có sẵn trong `useRealtimeFeedCore`).

### F2 [CORRECTED] WS `market_discovery_event` là dead contract — THẤP/TRUNG BÌNH
- Backend không emit `market_discovery_event` (`broadcasting.py:56-110` chỉ whale/dark_flow/system).
- Client `useRealtimeFeedCore.js:1127,693-704` dead code với AlertCenter pipeline.
- Đề xuất: (a) backend emit format này, hoặc (b) xóa dead branch. **KHÔNG phải blocker realtime.**

### F3 [CONTRACT] WS subscribe doc stale — CAO (doc only)
- `WEBSOCKET_EVENT_CONTRACT.md:148-172` `channels`/`subscription_ack` vs `consumers.py:192-216` + client `:886,1044` `symbols`/`subscribed`.
- Đề xuất: Sửa doc thành `symbols`/`subscribed` (đã implement + chạy). KHÔNG sửa code.

### F4 [BUG/RACE] Polling không dedupe stale — TRUNG BÌNH/CAO
- `useAlertCenterData.js:16-89`: chỉ `mountedRef`. Request chậm (6s) resolve sau request nhanh (1s) → ghi đè data cũ.
- Đề xuất: `requestIdRef`/`AbortController`. Tự giải nếu chuyển F1 (WS làm source of truth).

### F5 [GAP] Thiếu filter severity & alert_family ở UI — CAO
- Backend: `views.py:_apply_common_alert_filters` (audit claim 141-197) hỗ trợ.
- Frontend: `useAlertCenterData.js:23-27` KHÔNG truyền severity/alert_family. `AlertCenterPage.tsx:317-331` chỉ filter symbol.
- Đề xuất: Thêm multi-select severity + chips alert_family; truyền vào query `useAlertCenterData`. (Lưu ý: `useAlertCenterSnapshot.ts:6-11,38` ĐÃ có params này → tái dùng nếu consolidate F14.)

### F6 [GAP] Pagination sai kiến trúc (client-side trên page đầu) — TRUNG BÌNH
- `AlertCenterPage.tsx:236-242` slice trên `results` (tối đa page_size backend). `useAlertCenterData.js:44-48` lưu `next/previous` nhưng không dùng.
- Đề xuất: Cursor pagination (pattern có trong `useAlertCenterSnapshot.ts`).

### F7..F14 — ĐỒNG Ý với audit gốc (không re-verify chi tiết, cùng mức độ)
- F7 DetailDrawer nghèo (no chart/evidence visual) — TRUNG BÌNH
- F8 Thiếu Notification Preferences UI — TRUNG BÌNH
- F9 Không bulk ack/mark-all-read — THẤP/TRUNG BÌNH
- F10 Sound/toast/severity system lỏng lẻo — THẤP
- F11 `sessionDate` state luôn `""` vô dụng — THẤP
- F12 Dup file `UnifiedAlertCenter (1).js` + dead `.module.css` — THẤP
- F13 Accessibility thiếu aria/role — THẤP
- F14 2 hook + 2 UI chồng lấp (SSOT) — TRUNG BÌNH (maintainability, không phải bug)

---

## 5. QUALITY GATES (re-verify)

| Gate | Lệnh | Kết quả |
|------|------|---------|
| Lint | `npx eslint src/pages/AlertCenterPage.tsx src/components/alert-center src/hooks/useAlertCenterData.js` | ✅ EXIT 0 (theo audit gốc; CHƯA tự chạy — CHƯA XÁC MINH) |
| Type-check | `npx tsc --noEmit` | ✅ EXIT 0 (theo audit gốc; CHƯA XÁC MINH) |
| i18n scan | grep `vi.js`/`en.js` | ✅ XÁC MINH: chỉ nav label `alertCenter` (vi.js:67,93), 0 namespace content |
| Test frontend | AlertCenterPage component | ❌ KHÔNG có test (theo audit gốc) |
| Contract validate | serializer vs `unified-alert.contract.json` | ⚠️ CHƯA XÁC MINH contract JSON — audit gốc claim vi phạm `additionalProperties:false` nhưng KHÔNG quote line contract cụ thể |

---

## 6. ĐÁNH GIÁ TỔNG THỂ

**Audit gốc phần lớn đúng về hướng (F1, F3, F5, i18n island, dup code), NHƯNG overstate F2 thành "blocker realtime chết hoàn toàn" — điều này SAI.** Thực tế:

1. **WS pipeline KHÔNG chết.** `broadcasting.py` phát whale/dark_flow vào cả symbol + discovery group, client `useRealtimeFeedCore.js:1103` xử lý chúng bất kể group. DashboardPage (đã consume hook) nhận realtime alert bình thường.
2. **Root cause AlertCenterPage "không realtime" là F1**, không phải F2: trang này đơn giản là không gọi WS hook.
3. **F2 thực sự** chỉ là: `market_discovery_event` contract enum là dead (backend không emit) → dead code client. Mức độ THẤP, không phải blocker.

**Ưu tiên implement độc lập (corrected roadmap):**
- **P0:** F1 (AlertCenterPage consume `useRealtimeFeedFromManager`) — mở realtime thực sự.
- **P0:** F5 (filter severity/alert_family) — core feature, backend sẵn sàng.
- **P0:** F3(i18n) — namespace `alertCenter.*` vi/en, refactor 5 component.
- **P0:** F3(contract doc) — sửa `WEBSOCKET_EVENT_CONTRACT.md` thành `symbols`/`subscribed`.
- **P1:** F4 (race-guard, hoặc tự giải bởi F1), F14 (consolidate 1 hook + 1 shared component), theme (xóa CORE_STYLES).
- **P2:** F7/F8/F9.
- **P3:** F6/F10/F11/F12/F13.
- **F2:** Xử lý riêng — xóa dead `market_discovery_event` branch client HOẶC backend emit. KHÔNG phải P0.

**Rủi ro thực hiện P0:** THẤP. Không đổi REST contract. Chỉ (a) thêm 1 hook call ở AlertCenterPage, (b) thêm filter UI, (c) sửa doc, (d) i18n.

---

## 7. CÂU HỎI CẦN LÀM RÕ (updated)
1. Có plan backend emit `market_discovery_event` (format có `id`) không? Nếu không → xóa dead branch client (F2).
2. AlertCenterPage có plan consume `useRealtimeFeedFromManager` (F1) thay vì giữ REST polling làm primary? Recommend: WS primary + REST fallback.
3. `UnifiedAlertCenter.js` có plan gộp vào AlertCenterPage (F14 SSOT)?
4. Có muốn sửa `WEBSOCKET_EVENT_CONTRACT.md` thành `symbols`/`subscribed` (F3) đồng bộ code thực tế?

(End of file)
