# Audit Chuyen Sau Whale Alerts va Dark Money

Ngay audit: 2026-04-10
Pham vi: Whale alerts realtime, whale advisory merge/generation, dark money order-flow detection, UI hien thi lien quan
Muc tieu: Ghi lai cac finding de thao luan va len backlog fix o cac phien sau

## 1. Tom tat dieu hanh

He thong whale alerts hien co pipeline kha day du tu ingest -> scoring -> websocket -> dashboard/feed -> advisory merge. Tuy nhien, co mot so sai lech logic o dark money va o viec dong bo threshold theo tung ma, khien chat luong tin hieu co the khong phan anh dung hanh vi giao dich thuc te.

Ket luan tong quat:

- Whale alerts: kha on dinh ve pipeline, nhung chua dong bo het per-symbol threshold override qua realtime publishing va advisory generation.
- Dark money: co rui ro cao hon do detector dang dung cua so thoi gian sai theo UTC, va advisory downstream dang lam phang muc do nghiem trong cua tin hieu.
- UI: hien thi duoc dark flow trong stock dashboard, nhung nguoi dung de hieu sai y nghia cua bo loc window vi signal dark flow khong thay doi theo window da chon.

## 2. Pham vi kiem tra

Da doi chieu cac thanh phan sau:

- backend/portfolio/order_flow.py
- backend/portfolio/tasks.py
- backend/portfolio/views.py
- backend/portfolio/whale_feed_helpers.py
- backend/portfolio/realtime/compute.py
- backend/portfolio/consumers.py
- frontend/src/pages/WhaleAlertsDashboard.jsx
- frontend/src/pages/WhaleAlertsHub.jsx
- frontend/src/hooks/useRealtimeFeedLegacy.js
- backend/portfolio/tests/test_order_flow.py
- backend/portfolio/tests/test_whale_advisory_task.py
- backend/portfolio/tests/test_api_routes.py
- docs/BACKEND_AUDIT_DARK_MONEY_20260406.md

## 3. Findings theo muc do uu tien

### F1. High - Dark money/order-flow dang loc cua so thoi gian theo UTC, khong theo gio giao dich noi dia

Mo ta:

- order_flow dang lay ngay va gio hien tai bang UTC.
- Du lieu tick lai duoc luu va query theo trade_date/trade_time cua phien giao dich noi dia.
- Ket qua la logic "5 phut gan nhat" hoac "60 phut gan nhat" co the mo rong sai rat nhieu gio trong thuc te.

Bang chung code:

- backend/portfolio/order_flow.py:44
- backend/portfolio/order_flow.py:48
- backend/portfolio/order_flow.py:64
- backend/portfolio/order_flow.py:173

Tac dong:

- False positive va false negative trong dark money detection.
- strength va confidence cua dark flow co the bi phong dai.
- CVD, tick-rate va iceberg/absorption co the dang tinh tren tap tick rong hon ten ham/API mo ta.

Danh gia:

- Day la loi logic production-level, anh huong truc tiep den do tin cay cua tin hieu.

Huong xu ly de xuat:

- Chuyen _today() va _now_time() sang timezone.localdate() va timezone.localtime().time().
- Bo sung regression test cho cac khung 5m, 15m, 30m voi du lieu tick o gio VN.

### F2. High - Per-symbol whale threshold override chua di xuyen suot qua realtime va advisory

Mo ta:

- API aggregate whale feed da ton trong threshold override theo tung ma.
- Tuy nhien, realtime publishing va advisory accumulation van chu yeu dung threshold cap user, khong dua tracked_symbol override vao duong di event.

Bang chung code:

- backend/portfolio/tasks.py:276
- backend/portfolio/tasks.py:513
- backend/portfolio/tasks.py:523
- backend/portfolio/tasks.py:611
- backend/portfolio/tasks.py:612
- backend/portfolio/tasks.py:1394
- backend/portfolio/tasks.py:1395
- backend/portfolio/tests/test_api_routes.py:4359

Tac dong:

- User dat threshold rieng cho FPT/HPG co the van nhan whale alert/advisory theo nguong chung.
- Tin hieu realtime, merge event, va AI advisory co the khac voi nhung gi UI cho phep cau hinh.

Danh gia:

- Anh huong truc tiep den do nhat quan giua config nguoi dung va he thong canh bao.

Huong xu ly de xuat:

- Tai thoi diem fan-out theo tracked_user_id, resolve threshold theo tung tracked symbol thay vi chi lay threshold cap user.
- Bo sung test cho collect_and_publish_realtime va dark/whale advisory merge path khi co whale_alert_threshold_million.

### F3. Medium - Dark-flow-driven advisory dang bi lam phang severity do matched_value gan bang threshold

Mo ta:

- Khi dark_flow duoc gom vao advisory merge, matched_value_vnd dang duoc gan bang threshold_vnd cua user.
- Severity cua advisory lai duoc tinh tu matched_value_vnd / threshold.
- Dieu nay khien advisory tu dark flow don le gan nhu luon ve muc info, du detector co strength cao.

Bang chung code:

- backend/portfolio/tasks.py:289
- backend/portfolio/tasks.py:903
- backend/portfolio/tasks.py:1403

Tac dong:

- Severity va noi dung AI tom tat co the khong phan biet duoc dark money yeu va dark money rat manh.
- Khuyen nghi sinh ra cho dark flow co nguy co "phang hoa", giam gia tri dieu phoi hanh dong.

Huong xu ly de xuat:

- Tach mot truong nhu suspicious_value_vnd, inferred_flow_value_vnd, hoac event_magnitude tu detector.
- Neu chua co gia tri tien te dang tin cay, can severity mapper rieng cho dark_flow thay vi tai su dung matched_value/threshold ratio cua whale.

### F4. Medium - Bo loc window tren stock order-flow page gay hieu nham

Mo ta:

- UI cho user chon 5m, 15m, 30m, 1h.
- Tuy nhien, detect_dark_flow tren stock order flow API van duoc goi theo mac dinh cua detector, khong su dung window_param.
- Chi cvd_series la thay doi theo window; dark_flow signal thi khong.

Bang chung code:

- backend/portfolio/views.py:3804
- backend/portfolio/views.py:3805
- backend/portfolio/views.py:3807
- backend/portfolio/order_flow.py:435
- frontend/src/pages/WhaleAlertsDashboard.jsx:709
- frontend/src/pages/WhaleAlertsDashboard.jsx:1020

Tac dong:

- User de hieu sai rang dark money signal da doi theo khung thoi gian minh chon.
- UI dung ve mat ky thuat, nhung sai ve mat expectation/product semantics.

Huong xu ly de xuat:

- Cho detect_dark_flow nhan window_minutes.
- Hoac doi ten/label UI thanh "CVD window" neu chua muon thay doi behavior detector.

### F5. Medium - Iceberg signal chua co direction ro rang, de mo ho ve accumulation/distribution

Mo ta:

- Iceberg detection hien dua tren lap lai muc gia + small_order_ratio cao.
- Khong co logic side clustering rieng cho cum lenh.
- Huong BUY/SELL phai suy luan gian tiep qua cvd_change va merge score.

Bang chung code:

- backend/portfolio/order_flow.py:346
- backend/portfolio/order_flow.py:465
- backend/portfolio/tasks.py:72
- backend/portfolio/tasks.py:93

Tac dong:

- He thong co the dung khi ket luan "co dong tien an" nhung sai khi ket luan huong tich luy/phan phoi.
- Advisory merge co nguy co suy huong sai neu cvd_change va iceberg cluster mau thuan nhau.

Huong xu ly de xuat:

- Dua side profile vao iceberg clustering.
- Hoac danh dau iceberg la direction-agnostic o cap detector, chi nang cap huong khi co bang chung phu tro.

## 4. Danh gia rieng cho UI va duong di event

### Whale dashboard

- Whale feed panel dang uu tien hien whale alert realtime va feed backend.
- Dark flow khong chen vao whale feed panel, ma di vao order-flow radar panel.
- Cach tach nay hop ly, nhung can lam ro trong UX de user khong nham dark flow voi whale matched orders.

Bang chung:

- frontend/src/pages/WhaleAlertsDashboard.jsx:177
- frontend/src/pages/WhaleAlertsDashboard.jsx:856
- frontend/src/pages/WhaleAlertsDashboard.jsx:862
- frontend/src/pages/WhaleAlertsDashboard.jsx:998
- frontend/src/pages/WhaleAlertsDashboard.jsx:1020

### WebSocket path

- consumer co nhan dark_flow_alert va gui ve client.
- useRealtimeFeedLegacy co dem event dark_flow_alert va cap nhat state.
- useRealtimeFeed manager moi dang wrap legacy feed, nen hien tai dark flow van co duong di duoc su dung.

Bang chung:

- backend/portfolio/consumers.py:86
- frontend/src/hooks/useRealtimeFeedLegacy.js:472
- frontend/src/context/RealtimeContext.jsx:120

## 5. Coverage gap va muc do tin cay cua test hien co

Da xac nhan:

- Co test cho per-symbol threshold override trong aggregate feed API.
- Co test cho whale advisory gating, merge metadata, reversal advisory va cooldown behavior.
- Co test don vi cho order_flow detection core.

Khoang trong coverage:

- Chua thay test cho loi timezone/local market window trong order_flow.
- Chua thay test cho per-symbol override o realtime publish path.
- Chua thay test cho dark-flow advisory severity khi event den tu dark_flow ma khong phai whale matched order.
- Chua thay test cho semantics cua window selector tren stock order flow API.

Bang chung tham chieu:

- backend/portfolio/tests/test_api_routes.py:4359
- backend/portfolio/tests/test_whale_advisory_task.py:328
- backend/portfolio/tests/test_whale_advisory_task.py:462
- backend/portfolio/tests/test_order_flow.py:274

Ghi chu van hanh:

- Da thu chay focused suite order_flow + whale_advisory, nhung lan chay bi dung o giai doan tao test database nen chua co ket qua pass/fail cuoi cung de dinh kem vao audit nay.

## 6. Uu tien sua loi de xuat

### P0

1. Sua timezone/local market window trong order_flow detector.
2. Dong bo per-symbol threshold override qua realtime publish va advisory accumulation.

### P1

1. Doi model severity cho dark-flow advisory de khong phu thuoc matched_value = threshold.
2. Lam ro semantics cua window tren stock order-flow API/UI.

### P2

1. Them direction model cho iceberg signal.
2. Bo sung monitoring cho do lech giua dark_flow strength va advisory severity sau khi sua.

## 7. De xuat backlog ky thuat

Story A - Fix market-time window cho order flow

- Chuyen datetime UTC sang local market time
- Them regression test theo gio giao dich VN
- Re-audit dark flow strength sau fix

Story B - Threshold override consistency

- Resolve threshold theo tracked symbol o realtime publishing
- Resolve threshold theo tracked symbol o advisory accumulation/merge
- Bo sung integration test end-to-end

Story C - Dark flow severity remapping

- Thiet ke field magnitude rieng cho dark flow
- Cap nhat advisory generator va prompt context
- Cap nhat UI severity badge neu can

Story D - UI semantics cho order-flow window

- Truyen window xuong detect_dark_flow hoac doi nhan UI
- Them test API + frontend expectation

## 7.1 Re-audit delta 2026-04-11 (sau khi sua code)

Trang thai cap nhat:

- F1 (timezone order_flow): Da fix. `_today()` va `_now_time()` dung local timezone VN.
- F2 (per-symbol threshold propagation): Da fix cho realtime publish path.
	- `collect_and_publish_realtime` da resolve threshold theo symbol override cua user neu co.
	- Advisory fan-out path tiep tuc giu threshold override theo tracked symbol.
- F3 (dark_flow severity phang hoa): Da fix tu truoc trong `generate_whale_advisory_task` qua `_compute_dark_flow_severity`.
- F4 (window semantics tren stock order-flow): Da fix.
	- `stock_order_flow_api` truyen `window_minutes` vao `detect_dark_flow`.
	- `detect_dark_flow` da nhan va propagate window vao `_fetch_ticks`, `compute_cvd_series`, `compute_tick_rate`, `detect_iceberg_clustering`.
- F5 (duplicate multi-threshold whale events): Da fix theo policy 1-trade-1-signal.
	- `detect_whale_signals` chi emit 1 signal voi threshold cao nhat ma trade dat duoc.

Test evidence moi:

- P0 threshold propagation tests (moi):
	- `WhaleAdvisoryTaskTests.test_collect_realtime_prefers_symbol_override_threshold`
	- `WhaleAdvisoryTaskTests.test_collect_realtime_uses_user_threshold_when_symbol_override_missing`
- P1-A window propagation tests:
	- `TestDetectDarkFlow.test_detect_dark_flow_propagates_window_minutes`
	- `ApiRouteSmokeTests.test_stock_order_flow_returns_200_when_feature_enabled_for_pro_dpi_license` (assert detector call arg)
- P1-B duplicate policy tests:
	- `RealtimeComputeTests.test_detect_whale_signals_emits_threshold_hits`
	- `RealtimeComputeTests.test_detect_whale_signals_selects_highest_matched_threshold_only`

Gate run 2026-04-11:

- Whale full smoke: `ApiRouteSmokeTests -k whale` = 56/56 PASS (sqlite mode).
- Regression block lien quan: `test_whale_advisory_task` + `test_order_flow` + `test_realtime_compute` = 71 tests PASS (sqlite mode).

## 8. Ket luan

Whale alerts hien dang o trang thai tot hon dark money ve tinh toan ven cua pipeline. Dark money co gia tri phan tich cao, nhung dang bi han che boi mot loi timezone nghiem trong va mot cach quy doi severity chua phu hop. Neu can uu tien sua theo ty le loi/anh huong, nen bat dau tu F1 va F2 truoc khi nang cap them logic AI hay mo rong dashboard.

## 9. Tai lieu lien quan

- docs/BACKEND_AUDIT_DARK_MONEY_20260406.md
- docs/AUDIT_WHALE_DARK_MONEY_20260410.md
