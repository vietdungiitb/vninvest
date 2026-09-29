# Kế hoạch thực hiện: Trung tâm cảnh báo + Tín hiệu (bàn giao đội code, không cần hỏi lại)

- Ngày: 2026-09-20
- Phạm vi: sửa Hình 1 (AlertCenter) triệt để + vá Hình 2 (Signals) ở mức trung thực hiển thị + hội tụ realtime về SSE
- Căn cứ audit:
  - Chung bảng `UnifiedAlert` (`packages/core/backend/src/signal_intelligence/models.py:15`) nhưng khác SSOT đọc.
  - Flash do `isLoading = ... || isFetching` (`packages/web/src/hooks/useAlertCenterData.js:91-92`) + skeleton thay list (`packages/web/src/pages/AlertCenterPage.tsx:425`).
  - 32 card rỗng từ WS (`normalizeAlert` không có title/body — `packages/web/src/hooks/useRealtimeFeedCore.js:238-262` — gặp fallback `AlertCard.tsx:92-149`).
  - Summary 0 do `queryset.none()` khi user rỗng (`packages/core/backend/src/signal_intelligence/delivery_service.py:65-68`).
- Quy ước cứng (mọi slice): tokens `soc.module.css`, i18n qua `LangContext`, API qua `defaultCoreApiAdapter as unknown as {...}`, nhãn Việt full dấu, `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi slice, `eslint` 0 errors file chạm vào, cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` khi đóng slice.

## Bảng quyết định chốt (đội code không hỏi lại)

| # | Quyết định | Lý do 1 dòng |
|---|---|---|
| D1 | Realtime chuẩn cho feed cảnh báo = **SSE**, WS chỉ giữ cho giá/ticker | SSE đúng nguồn DB, đúng scope, resume được; WS mất shape (`useRealtimeFeedCore.js:238`) |
| D2 | Trước khi có SSE AlertCenter: **tách WS ra lane riêng "Realtime chưa định danh"**, không merge vào feed REST | Xóa vĩnh viễn bug dedupe khác key `alert_id/event_id` (`AlertCenterPage.tsx:157-166`) |
| D3 | 3 trạng thái rỗng: `NO_SCOPE` / `NO_DATA` / `NO_MATCH`, mỗi loại 1 message + 1 CTA | Chấm dứt mâu thuẫn "0/0/0 nhưng 32 card" |
| D4 | Nhãn severity VI: Nghiêm trọng/Cao/Trung bình/Thấp; giữ value EN trong `title` attr để debug | Theo quy ước repo + screenshot đối chứng |
| D5 | Ngưỡng tần suất giữ `>=8/4/2` (`AlertCenterPage.tsx:253-257`), nhưng map bằng **enum key**, không chuỗi Việt | Sửa vỡ locale EN mà không đổi hành vi |
| D6 | Phân trang stats: giữ **client 8/trang**, luôn fetch `page_size=200&page=1`, ghi comment lý do | Dataset <200, tránh scope creep phân trang server |
| D7 | CSV: limit 5000 dòng, BOM UTF-8, thống nhất 12 cột AlertCenter hiện tại | Đồng chuẩn Signals (`buildSignalsCsv`, `SocSignalsPanel.tsx:211`) |
| D8 | Mute: giữ default 30 phút trên nút nhanh, modal cho phép 15/30/60/240 + family + reason | Tương thích BE (`views.py:145-150`) mà không vỡ UX cũ |
| D9 | Signals: thêm 2 thẻ SYSTEM + AI **(kèm thêm 2 field `system_alerts` + `ai_alerts` vào payload `SignalsSummaryView`, có sửa BE — xem R6.1)**, hiện `session_date đang đọc`, giữ số 0 nhưng thêm chú thích nguyên nhân | Sửa "TỔNG 1 vs 3 số 0" — summary hiện tại chỉ trả whale/dark/signal (`signals.py:99-101,664-666`) |
| D10 | `useCoreQuery` (`useCoreQuery.ts:10-25`) trả raw `useQuery` → dùng `isPending/isLoading` cho skeleton lần đầu, `isFetching` chỉ cho dot nền | TanStack v5 semantic, sửa flash tận gốc |

---

## S0 — Seed + môi trường kiểm chứng (làm trước, chặn mọi slice khác)

- Vấn đề: cả 2 màn hình đang rỗng nên không kiểm chứng runtime được.
- Yêu cầu:
  - R0.1 Seed 12 `UnifiedAlert`: đủ 5 loại (whale/dark_flow/signal-system-signal/system-stale/ai_alert/ai_suggest), 2 phiên (hôm nay + hôm qua), có ít nhất 1 whale `value >= 2 tỷ` (severity HIGH theo `materializers.py:260-263`), 1 price_shock `source_ref=market_anomaly:*`, 1 stale `source_ref=stale_quote:*`. **Bắt buộc seed kèm ≥1 `WhaleAlertCanonical` gắn vào alert whale (qua `alert` OneToOne — vì `get_executed_at` đọc `whale_detail`, `serializers.py:47-51`, thiếu là `executed_at` luôn None và A3.1 không pass) và evidence đầy đủ trong `UnifiedAlert.evidence` cho alert stale_quote.**
  - R0.2 1 user test có watchlist chứa đúng 2 mã trong seed + 1 user trắng (0 watchlist) để tái hiện Hình 1.
  - R0.3 Lệnh seed idempotent (chạy lại không trùng nhờ `source_ref` unique — `models.py:60-66`).
- Phạm vi: `packages/core/backend/src/signal_intelligence/management/commands/seed_alertcenter_demo.py` (mới) + ghi ledger.
- Tiêu chí: A0.1 chạy 2 lần không lỗi unique; A0.2 SQL kiểm đếm đúng 12; A0.3 user trắng summary = 0, user seed summary > 0.
- Phản biện: "Seed vào DB dev làm bẩn dữ liệu" → rebuttal: `source_ref` prefix `demo:` + lệnh delete kèm theo, chỉ chạy dev/test, không vào migration.
- Minh chứng V0: `manage.py seed_alertcenter_demo && manage.py seed_alertcenter_demo` (lần 2 skip hết); SQL đếm theo `alert_type/session_date`; chụp network `summary` 2 user.

## S1 — Diệt flash (hotfix, ship đầu tiên)

- Vấn đề: poll nền 5s/30s thay cả list bằng skeleton (`useAlertCenterData.js:41-75` + `:91-92` + `AlertCenterPage.tsx:425`), WS resort thêm giật (`:203-213`, virtual `itemSize={280}` `:431-436`).
- Yêu cầu:
  - R1.1 `useAlertCenterData` trả thêm `isInitialLoading` (= `isPending` lần đầu, cả 3 query) và `isBackgroundFetching` (= `isFetching && !isInitialLoading`); giữ shape cũ để không vỡ caller.
  - R1.2 Page chỉ skeleton khi `isInitialLoading && alerts.length===0`; poll nền chỉ hiện dot nhỏ ở nút Làm mới + `aria-busy`, không unmount `VirtualFeedList`.
  - R1.3 Lỗi tách theo section (feed/summary/stats) + Retry từng khối — **phạm vi render: tách khối hiển thị feed/summary/stats trong `AlertCenterPage.tsx` thành 3 vùng lỗi độc lập (mỗi vùng tự `error` + nút Retry riêng), thay vì 1 banner global `ShellPageChrome error` (`AlertCenterPage.tsx:355`)**; bỏ timer giả 800ms (`AlertCenterPage.tsx:309-313`), `isRefreshing` bám vào promise `refetch()` thật.
  - R1.4 Sort ổn định: thêm tie-break `alert_id` sau `triggered_at`.
- Phạm vi: `useAlertCenterData.js`, `AlertCenterPage.tsx` (khối 309-313, 420-456).
- Tiêu chí: A1.1 bật `autoRefresh`, đợi 3 chu kỳ 5s: list không unmount lần nào (đếm `Skeleton` render = 1); A1.2 rút mạng 1 query: 2 khối còn lại vẫn hiện + đúng 1 banner lỗi khối đó; A1.3 `eslint` 0 errors, `tsc` 0.
- Phản biện: "Giữ skeleton mỗi poll để user biết đang tải" → rebuttal: chuẩn Bloomberg/Datadog dùng chỉ báo nền; unmount list mất scroll + gây flash, đã có `aria-busy` + dot.
- Minh chứng V1: quay clip 20s bật autoRefresh (không flash); DevTools Network thấy poll 5s nhưng DOM list giữ nguyên node; test `vitest` mới: background fetch không render skeleton.

## S2 — Scope rỗng + tách WS (xóa mâu thuẫn 0 vs 32)

- Vấn đề: summary 0 (đúng) nhưng feed 32 card rỗng (sai) — WS bypass scope (`useAlertCenterRealtime.js:5-18`), dedupe sai key, sort giá trị vô nghĩa.
- Yêu cầu:
  - R2.1 Phân biệt 3 empty-state (D3): `NO_SCOPE` ("Bạn chưa theo dõi mã nào" + CTA tới watchlist), `NO_DATA` (scope ok, DB trống), `NO_MATCH` (bộ lọc loại hết) — áp dụng cho cả feed và stats.
  - R2.2 Bỏ merge WS vào `alerts` (`AlertCenterPage.tsx:152-167`); thêm section riêng "Realtime chưa định danh" (cap 20, có badge nguồn WS + nút "Ẩn"), đếm `feedShowing` chỉ đếm REST.
  - R2.3 Khi `appliedSymbol` khác rỗng: lọc WS section client-side theo symbol đó (ghi comment "lọc tạm client, SSE S7 sẽ lọc server").
  - R2.4 Sort "Giá trị lớn nhất" chỉ áp dụng REST; WS section sort theo `ts` giảm dần.
- Phạm vi: `AlertCenterPage.tsx` (152-167, 203-213, 282-307 đếm CSV chỉ REST), `useAlertCenterRealtime.js` (giữ nguyên, chỉ đổi caller), `vi.js:5388-5508` thêm key empty-state.
- Tiêu chí: A2.1 user trắng: summary 0 + `NO_SCOPE` + WS tách riêng (không còn card `— VND` trong feed chính); A2.2 user seed: feed REST có title/body thật, không còn fallback `cardTitle/cardNoSummary`; A2.3 filter sai mã → `NO_MATCH`.
- Phản biện: "Tách WS làm mất tính realtime của feed" → rebuttal: WS hiện tại realtime sai scope + sai shape; tách ra vẫn realtime nhưng trung thực; SSE S7 gộp lại đúng cách.
- Minh chứng V2: network `feed` user trắng `results: []` + UI `NO_SCOPE`; screenshot feed chính không còn `— · Lane main` (`AlertCard.tsx:133` chỉ còn ở WS section hoặc bỏ hẳn theo S5).

## S3 — Drawer pháp y + Ack/Mute/Seen đầy đủ

- Vấn đề: drawer bỏ trường BE đã trả (`DetailDrawer.tsx:87-134` vs `views.py:602` + `serializers.py:6-51`); mute cứng 30' (`useAlertCenterActions.ts:67-89` vs BE hỗ trợ duration+cooldown `views.py:145-150`); ack ẩn ở lane AI (`AlertCard.tsx:199-208`); `closeDetail` không reset hết (`useAlertCenterActions.ts:91-93`).
- Yêu cầu:
  - R3.1 Drawer render thêm: severity, confidence %, value, direction, session_date, triggered_at, `source_ref`, evidence, metadata (JSON gọn), `executed_at` (whale), link order-flow/whale-analytics.
  - R3.2 "Đã xem (Seen)": BE AlertCenter chưa có endpoint seen (chỉ Signals có) nên Seen ở S3 là **optimistic local** (đánh dấu đã mở drawer), không gọi BE. Ghi rõ để không ai tự sáng tạo endpoint.
  - R3.3 Ack hiện cả 2 lane; mute nhanh 30' giữ + modal mute (duration 15/30/60/240, family auto-fill, reason optional) gọi đúng `muteAlertCenterPreference` (`market.js:127`).
  - R3.4 `closeDetail` reset `activeAlertId/activeDetail/activeContext`.
- Phạm vi: `DetailDrawer.tsx`, `useAlertCenterActions.ts`, `AlertCard.tsx` (199-217), i18n key mới.
- Tiêu chí: A3.1 mở 1 whale + 1 stale_quote thấy đủ 10 trường + evidence; A3.2 mute 60' → `UserAlertPreference.mute_until ≈ now+60'` trong DB; A3.3 ack lane AI 200 (`views.py:654-665` cho lane ai); A3.4 đóng/mở lại không dính dữ liệu cũ.
- Phản biện: "Drawer nhiều trường rối" → rebuttal: gom 3 nhóm gập được (Tổng quan / Pháp y / Bối cảnh mã), mặc định mở Tổng quan — pattern `accordion` sẵn có (`AlertCard.tsx:173-187`).
- Minh chứng V3: clip mở drawer 1 whale + 1 stale_quote; query `UserAlertPreference` sau mute; network `ack?lane=ai` 200.

## S4 — StatsPanel đúng + không vỡ locale

- Vấn đề: FE hardcode `page: 1&page_size: 200` tại call-site (`useAlertCenterData.js:71-72`) nên `page` của BE (`views.py:507-514`) không bao giờ được dùng tới; freq map chuỗi Việt (`StatsTable.tsx:22-34`); `latestTime` chết (`AlertCenterPage.tsx:250`); neutral tính mà không hiện (`StatsTable.tsx:97-100`); link `/stocks/` chưa xác minh.
- Yêu cầu: R4.1 comment chuẩn "client paging 8/trang trên snapshot 200" tại call-site (**không logic mới — chỉ comment, vì call-site đã hardcode page:1**); R4.2 freq key enum (`explosive/high/medium/low`), map enum→class+label; R4.3 hiện `latestTime` (giờ:phút ngày) + neutral trong tooltip/bar; R4.4 xác minh route `/stocks/:symbol` trong `routeCatalog`, nếu không đổi sang route stock workspace đúng của repo.
- Tiêu chí: A4.1 locale EN màu/nhãn freq vẫn đúng; A4.2 mọi dòng có dữ liệu hiện `latestTime`; A4.3 click symbol đi đúng trang mã.
- Phản biện: "Sao không phân trang server luôn" → rebuttal: snapshot 200 + 8/trang đủ cho màn hình này; vượt 500 symbols mới làm server (ghi backlog, không làm ở đây).
- Minh chứng V4: screenshot EN + VI cùng dataset; test `StatsTable` freq 4 mức 2 locale.

## S5 — i18n + CSV thống nhất

- Vấn đề: severity Anh trong UI Việt (`vi.js:5471-5474`), freshness/direction thô (`AlertCard.tsx:125-143`), date input native, chuỗi debug `· Lane` (`:133`); CSV client khác chuẩn Signals.
- Yêu cầu: R5.1 `sevCritical→Nghiêm trọng, sevHigh→Cao, sevMedium→Trung bình, sevLow→Thấp` (VI), EN giữ nguyên; map freshness (fresh→Mới, stale→Cũ) + direction (buy→Mua, sell→Bán, neutral→Trung tính); bỏ `· Lane` khỏi card (vào tooltip); R5.2 CSV: giữ 12 cột hiện tại đúng thứ tự, thêm BOM, cắt 5000 dòng, tên `alert-center-YYYYMMDD-HHmm.csv`, chỉ xuất feed REST.
- Tiêu chí: A5.1 `i18n:scan` không key thiếu; A5.2 mở CSV bằng Excel không lỗi dấu; A5.3 không còn chuỗi "Lane" trong card.
- Phản biện: "Đổi nhãn severity gây nhầm với BE" → rebuttal: chỉ đổi lớp hiển thị, `title` attr giữ EN + network giữ EN.
- Minh chứng V5: `npm run i18n:scan` exit 0; file CSV mẫu đính kèm PR.

## S6 — Signals trung thực (Hình 2)

- Vấn đề: tổng 1 vs 3 số 0 do thiếu loại (`signals.py:664-666` bỏ system/ai), không hiện phiên đọc, 0%/0ms không giải thích.
- Yêu cầu: R6.1 **BE: thêm 2 field `system_alerts` + `ai_alerts` vào `SignalsSummaryResponseSerializer` (`signals.py:96-108`) và `SignalsSummaryView` (`signals.py:643-683`, cả nhánh rỗng `:646-658` lẫn nhánh có dữ liệu `:671-683`) — đếm `alert_type=system` và `alert_type IN (ai_alert, ai_suggest)` trên cùng queryset phiên (`alerts` đã có). Không thêm endpoint.** FE: thêm thẻ SYSTEM + tooltip AI count đọc từ 2 field mới; R6.2 header hiện "Phiên đang đọc: YYYY-MM-DD" (`session_date` từ summary); R6.3 tooltip `detection_rate` theo đúng công thức `active/order_flow_events` (`signals.py:678`): "0% do chưa có alert nào trong phiên" (khi active=0) hoặc "0% do chưa có order_flow_events trong phiên" (khi events=0) — không ghi cứng 1 nhánh; latency giữ số 0 + chú thích (không đổi contract số, chỉ thêm field count); **R6.4 BE: sửa map `alert_type → fe_type` trong `signals_stream.py:200-205` (hiện SYSTEM/AI rơi vào default `"whale"`, thổi phồng thẻ whale realtime) thành map đúng: system→`"system"`, ai_alert/ai_suggest→`"ai"`; FE `SocSignalsPanel handleStreamSignal` (`SocSignalsPanel.tsx:408-419`) + cộng dồn metrics (`:437-449`) xử lý 2 type mới (không cộng vào whale). Nếu ngoài khả năng slice thì tuyên bố rõ + mở backlog, không để map sai tồn tại cùng mục tiêu "trung thực".**
- Tiêu chí: A6.1 seed S0: TỔNG = whale+dark+signal+system+ai, các thẻ cộng khớp; SSE realtime không còn cộng system/ai vào whale; A6.2 phiên hôm nay trống: header hiện đúng phiên cũ.
- Phản biện: "Thêm thẻ vỡ layout" → rebuttal: grid responsive chịu được; đây là bug bỏ sót loại, không phải feature mới.
- Minh chứng V6: screenshot đủ thẻ + tooltip; response `GET /operator/soc/signals/summary/` đính kèm.

## S7 — SSE AlertCenter (hội tụ realtime, sau S1–S5)

- Vấn đề: 2 cơ chế realtime song song, WS sai scope/shape.
- Yêu cầu:
  - R7.1 BE `GET /core/v1/signals/alert-center/stream/` copy contract `signals_stream.py:104`: params `lane/symbol/severity/alert_family/since`, poll DB 3s trên queryset đã qua `apply_user_delivery_policy`, event `alert-center`, payload đủ `alert_id/symbol/severity/title/value/direction/triggered_at/session_date`, `token` fallback + idle như Signals, thêm `max_loops` cho test. **Chốt 2 điểm (không đoán): (a) `since` dùng `pk` tăng dần (`pk__gt`, copy `signals_stream.py:150-171,193,219` — replay từ max hiện tại khi thiếu, tránh flood); (b) throttle KHÔNG dùng `SOCStreamThrottle` (scope `soc_stream` của namespace operator — `signals_stream.py:33-34,109-110`) mà định nghĩa local `AlertCenterStreamThrottle(UserRateThrottle)` scope `alert_center_stream` 60/min ngay trong `signal_intelligence/views.py` (cạnh `SignalRateThrottle` scope `signals`, `views.py:20-21`) — tránh import ngược sang `service_ops` (vi phạm isolation) và tránh ăn quota API thường.**
  - R7.2 FE `useAlertCenterStream` clone `useSignalStream.ts:46-216` (backoff 1s→30s, watchdog 35s, reset `since` khi filter đổi); page dùng SSE prepend + highlight, **xóa** `useAlertCenterRealtime` khỏi page (giữ file cho màn hình giá khác dùng).
  - R7.3 Test BE 5 case (auth/scope/filter/since/idle) + FE 3 case (live/badge/reconnect).
- Tiêu chí: A7.1 user trắng nhận 0 event dù DB có alert ngoài scope; A7.2 đổi filter không lọt event cũ; A7.3 ngắt mạng 10s tự nối lại không trùng.
- Phản biện: "Sao không sửa WS cho có scope" → rebuttal (D1): WS multiplex giá + auth socket khác; SSE HTTP tái dùng auth/throttle/filter server hiện có, ít code mới hơn.
- Minh chứng V7: 2 tab cùng user: tạo alert mới → cả 2 prepend trong 5s; log reconnect không duplicate.

## S8 — Gates + bàn giao

- Yêu cầu: R8.1 `manage.py check` 0; BE full `signal_intelligence` + `service_ops` signals pass; R8.2 `npx tsc --noEmit` 0, `npm run build` pass, `eslint` 0 errors file chạm, `jest` soc+alertCenter + `vitest` alert-center/signals pass; R8.3 clip 60s/user (trắng + seed) + network log + SQL đếm đính kèm; R8.4 ledger entry + checklist rollback (tắt SSE về poll bằng flag `enabled` của hook).
- Tiêu chí: đội khác checkout + seed + chạy checklist S0–S7 pass mà không hỏi tác giả.
- Minh chứng V8: bảng tick toàn bộ A-criteria + link commit từng slice.

## Thứ tự + song song

S0 → S1 (ship ngay) → [S2, S3 song song] → S4 + S5 song song → S6 độc lập (sau S0) → S7 sau S2 → S8 cuối. S1 nhỏ nhất nhưng giá trị thấy ngay (hết flash); S7 lớn nhất (BE endpoint mới). **Lưu ý tránh đụng `vi.js` (1 file chung): S5 và S6 nếu chạy song song thì S5 giữ key `alertCenter.*`, S6 chỉ thêm key prefix `soc.signals.*` + thẻ mới, không ai sửa key của ai; gộp conflict tại S8 nếu có.**

## Phụ lục bàn giao (đội code điền link vào từng mục V khi đóng slice)

Seed script S0, query SQL S0/S6, sample `summary/feed` response, bảng map nhãn VI/EN, danh sách test file mới, checklist quay clip.

## Lịch sử sửa đổi (audit phản biện độc lập 2026-09-20 — đã xác minh lại trong code thật)

| Finding | Mức | Vá trong plan |
|---|---|---|
| F1 — R6.1 đòi system/ai count mà summary không trả (`signals.py:99-101,664-666,671-683` xác minh không có field) | MEDIUM | R6.1 + D9: thêm `system_alerts`/`ai_alerts` vào serializer + view (vẫn không thêm endpoint) |
| F2 — SSE map SYSTEM/AI → `"whale"` (`signals_stream.py:201-205`) + panel cộng dồn vào whale (`SocSignalsPanel.tsx:408-419,437-449`) | MEDIUM | R6.4 mới: map đúng type 2 đầu BE+FE |
| F3 — `executed_at` đọc `whale_detail` (`serializers.py:47-51`), seed thiếu là A3.1 fail | MEDIUM | R0.1: seed kèm `WhaleAlertCanonical` + evidence |
| F4 — "BE có page nhưng FE không dùng" sai một nửa (FE hardcode `page:1`, `useAlertCenterData.js:71-72`) | LOW | Sửa diễn đạt S4: R4.1 chỉ là comment |
| F5 — `since` + throttle class chưa chốt | LOW | R7.1: `since` = `pk`; throttle local scope `alert_center_stream` 60/min |
| F6 — tooltip 0% chỉ đúng 1 nhánh công thức (`signals.py:678`) | LOW | R6.3: chú thích theo đúng nhánh |
| F7 — R1.3 cần nêu rõ phạm vi render 3 vùng lỗi (`AlertCenterPage.tsx:355` đang 1 banner global) | LOW | R1.3: ghi rõ tách khối render |
| C3 — S5+S6 cùng chạm `vi.js` | — | Ghi chú phối hợp ở mục Thứ tự |
