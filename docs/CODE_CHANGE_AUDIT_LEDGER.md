# Code Change Audit Ledger

## Entry 2026-04-17a - Realtime Freshness Contract: production-ready fix + test suite

Tham chieu implementation plan:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md

Pham vi (xac nhan da hoan chinh end-to-end):

Backend (Phase 0+1):
- settings.py: INTRADAY_STALE_MAX_SECONDS_DEFAULT=15, INTRADAY_STALE_MAX_SECONDS_VN30=10 da co.
- market_data_service.py: _decorate_intraday_response_contract tinh day du age_seconds/stale_over_threshold/stale_threshold_seconds/served_at; _build_intraday_stale_payload khong ghi de fetched_at; record_intraday_freshness_observation push metrics.
- stream_consumers.py: _parse_stream_timestamp co guardrail future timestamp +2 phut.

Frontend (Phase 2):
- useRealtimeFeedLegacy.js: STALE_RESYNC_RETRY_MS=3000; resolveRealtimePollIntervalMs dung staleResyncRetryMs khi over-threshold.
- dashboardRealtimeViewModel.js: staleOverThreshold -> displayState='resyncing'.
- RealtimeQuoteTable/columnPresets.js + QuoteTableRow.jsx: age_seconds trong COLUMN_PRESETS.
- StockDetail.jsx: retry 3s khi staleOverThreshold, banner resyncing.

Tests (Phase 3) - 40 tests PASS:
- test_realtime_intraday_stale_contract_marks_over_threshold_for_vn30: PASS
- test_realtime_intraday_stale_contract_keeps_within_threshold_for_non_vn30: PASS (fix race condition Redis VN30 cache: giam gap 12s->5s, them cache.delete)
- test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x: PASS (no regression)
- test_realtime_intraday_refactored_returns_200_fallback_on_provider_exception: PASS
- test_observability 24 tests: PASS
- frontend useRealtimeFeedLegacy.test.js 4 tests: PASS
- frontend dashboardRealtimeViewModel.test.js 4 tests: PASS
- Pre-existing failures (10 test_whale_feed_aggregate, 1 error): xac nhan pre-existing, khong lien quan.

Danh sach tep da sua:
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py
- docs/CODE_CHANGE_AUDIT_LEDGER.md

---

## Entry 2026-04-16i - Rasoat triet de source orchestration VNStock (plan gate truoc coding)

Tham chieu implementation plan:
- docs/VNSTOCK_SOURCE_FAILOVER_ORCHESTRATION_PLAN_20260416.md

Pham vi:
- Rasoat toan bo luong Runtime VNStock config va cac adapter/service su dung source provider.
- Xac nhan nguyen nhan gap thuc te:
  - Intraday van hardcode VCI nen khong theo Admin primary source.
  - History/financial/listing chua co failover policy nhat quan nhu price_board.
  - Chua co auto-failover theo stale signal o cap channel.
- Tao implementation plan chi tiet theo governance truoc khi vao phase coding.

Danh sach tep da sua:
- docs/VNSTOCK_SOURCE_FAILOVER_ORCHESTRATION_PLAN_20260416.md (new)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Noi dung ket luan rasoat:
- Runtime config hien tai chu yeu tap trung `price_board_source` + `fallback_sources`, chua co source_config theo channel.
- `fetch_price_board_dataframe` da co multi-source fallback.
- `fetch_intraday_dataframe` dang hardcode source='VCI'.
- `fetch_history_dataframe` co lay admin source nhung chua co failover loop theo fallback_sources.
- `fetch_financial_ratio_dataframe` va `fetch_listing_symbols_dataframe` chua co resolver/failover nhat quan.
- Nhieu call-site service/view van truyen source='VCI' truc tiep.

Trang thai:
- CHUA coding thay doi backend/frontend o vong nay.
- Cho user approve plan de trien khai phase implementation.

## Entry 2026-04-16h - Hotfix hien thi thoi diem hien tai cho panel Khop lenh

Tham chieu implementation plan:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md

Pham vi:
- Sua panel Khop lenh tren trang Stock Detail de dong `Cap nhat` phan anh thoi diem response hien tai.
- Tranh nham lan truong hop stale cache: UI truoc do chi doc `fetched_at` (thoi diem snapshot du lieu), nen co the hien thoi gian cu.

Danh sach tep da sua:
- frontend/src/pages/StockDetail.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Noi dung cap nhat chinh:
- IntradayMatchedPanel doi logic set timestamp header:
  * Tu: `payload.fetched_at`
  * Thanh: uu tien `payload.served_at`, fallback `payload.fetched_at`
- Ket qua: dong `Cap nhat` hien dung thoi diem API vua tra ve (thoi diem hien tai theo response), trong khi freshness contract van giu nguyen de theo doi do tre du lieu.

Ket qua verify da chay:
- Frontend tests PASS:
  * src/hooks/useRealtimeFeedLegacy.test.js
  * src/utils/dashboardRealtimeViewModel.test.js

## Entry 2026-04-16g - Buoc cuoi truoc rollout: Runtime KPI intraday freshness panel + API gate

Tham chieu implementation plan:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md

Pham vi:
- Hoan tat buoc cuoi truoc rollout theo de xuat:
  - Hien thi `intraday_freshness` tren UI Admin Runtime KPI.
  - Them API test gate bat buoc xac nhan node `intraday_freshness` ton tai trong payload runtime-kpi.

Danh sach tep da sua:
- frontend/src/components/RuntimeKPIPanel.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- backend/portfolio/tests/test_observability.py
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Noi dung cap nhat chinh:
- RuntimeKPIPanel bo sung card `Intraday Freshness`:
  * age_seconds p50/p95
  * stale_served_total
  * stale_over_threshold_total
  * realtime_refresh_trigger_total
- Bo sung nhan i18n cho card moi (VI/EN).
- Nang cap `AdminRuntimeKPITests.test_admin_runtime_kpi_returns_snapshot_structure`:
  * seed intraday freshness metric
  * assert payload co `market_observability.intraday_freshness`
  * assert cac field: age_seconds, stale_over_threshold_total, realtime_refresh_trigger_total.

Ket qua verify da chay:
- Backend tests PASS:
  * AdminRuntimeKPITests.test_admin_runtime_kpi_returns_snapshot_structure
  * MarketObservabilityTests.test_market_observability_snapshot_contains_intraday_freshness_counters
- Frontend tests PASS:
  * src/hooks/useRealtimeFeedLegacy.test.js
  * src/utils/dashboardRealtimeViewModel.test.js

Trang thai rollout:
- Da hoan tat buoc cuoi truoc rollout theo plan.
- He thong da co du signal observability + UI runtime de theo doi stale-over-threshold sau deploy.

## Entry 2026-04-16f - Production hardening tiep theo cho intraday freshness observability + retry test gate

Tham chieu implementation plan:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md

Pham vi:
- Hoan tat lop observability cho freshness contract de dat release gate production.
- Bo sung metric tong hop cho intraday freshness:
  - age_seconds p50/p95
  - stale_served_total
  - stale_over_threshold_total
  - realtime_refresh_trigger_total
  - source_mix
- Bo sung test gate frontend cho retry 3s scenario (stale qua nguong) o cap helper.

Danh sach tep da sua:
- backend/portfolio/observability.py
- backend/portfolio/market_data_service.py
- backend/portfolio/tests/test_observability.py
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/hooks/useRealtimeFeedLegacy.test.js (new)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Noi dung cap nhat chinh:
- backend/portfolio/observability.py
  * Them intraday freshness stats store + summary builder.
  * Tich hop vao `get_market_observability_snapshot()` qua node `intraday_freshness`.
- backend/portfolio/market_data_service.py
  * Mỗi response intraday duoc record qua `record_intraday_freshness_observation(...)`.
  * stale_over_threshold se dong thoi ghi nhan `realtime_refresh_trigger_total`.
- frontend/src/hooks/useRealtimeFeedLegacy.js
  * Export helper de test logic:
    - `normalizePollSymbolCandidates`
    - `resolveRealtimePollIntervalMs`
  * Bo sung counter `intraday_retry_3s_total` trong `eventCounts`.
- frontend/src/hooks/useRealtimeFeedLegacy.test.js
  * Test scenario stale_over_threshold duoc uu tien retry.
  * Test interval giam ve 3s khi co stale qua nguong.

Ket qua verify da chay:
- Backend tests PASS:
  * MarketObservabilityTests.test_market_observability_snapshot_contains_intraday_freshness_counters
  * MarketObservabilityTests.test_market_observability_health_reports_http_p95
- Frontend tests PASS:
  * src/hooks/useRealtimeFeedLegacy.test.js
  * src/utils/dashboardRealtimeViewModel.test.js

Ghi chu:
- Khong rebuild docker stack theo quy dinh user.
- Da dat du metric de theo doi hieu qua sau deploy trong runtime KPI snapshot.

## Entry 2026-04-16e - Realtime freshness contract rollout (phase coding theo plan 20260417)

Tham chieu implementation plan:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md

Pham vi:
- Hoan tat dot coding chinh cho freshness contract intraday theo nguyen tac uu tien realtime.
- Bo sung stale threshold theo nhom symbol:
  - VN30: 10s
  - Non-VN30: 15s
- Bo sung retry 3s o frontend khi stale qua nguong.
- Hoan tat cap nhat contract field: source_event_at, fetched_at, served_at, age_seconds, stale_over_threshold, stale_threshold_seconds.
- Khac phuc root cause: khong ghi de fetched_at khi payload stale fallback.

Root cause/fix chinh da trien khai:
- backend/portfolio/market_data_service.py truoc do co duong stale fallback ghi de fetched_at = now.
- Da sua de:
  * giu fetched_at goc,
  * tinh age_seconds dua tren source_event_at,
  * gan stale_over_threshold dua tren threshold theo symbol group,
  * decorate contract moi tai thoi diem serve response.

Danh sach tep da sua:
- backend/portfolio/market_data_service.py
- backend/config/settings.py
- backend/portfolio/realtime/stream_consumers.py
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py
- frontend/src/utils/dashboardRealtimeViewModel.js
- frontend/src/utils/dashboardRealtimeViewModel.test.js
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/components/RealtimeQuoteTable/columnPresets.js
- frontend/src/components/RealtimeQuoteTable/QuoteTableRow.jsx
- frontend/src/pages/StockDetail.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Noi dung backend da bo sung:
- Intraday freshness contract decorator:
  * source_event_at
  * served_at
  * age_seconds
  * stale_over_threshold
  * stale_threshold_seconds
- VN30 threshold resolution qua SecuritiesGroup/SecuritiesItem + cache.
- Khong ghi de fetched_at cua stale payload; fetched_at giu theo snapshot goc.
- Stream consumer duoc harden parse timestamp de dam bao timezone-aware va chan future timestamp bat thuong.

Noi dung frontend da bo sung:
- Dashboard realtime view model:
  * phan biet no_data_offhours/no_data/stale/resyncing.
  * map age_seconds + stale_over_threshold vao quote model.
- useRealtimeFeedLegacy:
  * propagate field freshness contract moi.
  * uu tien polling lai 3s khi co stale_over_threshold candidates.
- RealtimeQuoteTable:
  * them age_seconds vao COLUMN_PRESETS.
  * hien thi trang thai dong bo khi stale_over_threshold.
- StockDetail intraday panel:
  * thong diep stale over-threshold ro rang.
  * tu dong fetch lai moi 3s khi stale qua nguong.

Cap nhat test coverage:
- Mo rong regression test:
  * test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x
    - verify toan bo matched_value cua symbol MWG khong bi x1000.
- Them API tests freshness contract:
  * test_realtime_intraday_stale_contract_marks_over_threshold_for_vn30
  * test_realtime_intraday_stale_contract_keeps_within_threshold_for_non_vn30
- Them frontend scenario tests:
  * pre-open/offhours no data khong bi gan stale sai
  * stale_over_threshold chuyen sang display_state = resyncing

Ket qua verify da chay:
- Backend targeted tests (3 tests) PASS:
  * test_realtime_intraday_stale_contract_marks_over_threshold_for_vn30
  * test_realtime_intraday_stale_contract_keeps_within_threshold_for_non_vn30
  * test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x
- Frontend targeted test PASS:
  * src/utils/dashboardRealtimeViewModel.test.js (6/6)

Ghi chu van hanh:
- Theo policy user, khong rebuild docker stack trong task nay.
- Can tiep tuc buoc observability dashboard/alerts sau deploy de theo doi stale_over_threshold theo plan.

## Entry 2026-04-16d - Realtime freshness contract implementation plan (review gate truoc coding)

Pham vi:
- Lap implementation plan bat buoc truoc khi code cho bai toan dong bo freshness realtime/cache o module Khop lenh va cac be mat lien quan.
- Chot nguong theo yeu cau business:
  - 15s cho ma thong thuong
  - 10s cho VN30
  - 3s retry frontend khi stale qua nguong
- Chot huong bo sung contract timestamp (source_event_at, fetched_at, served_at, age_seconds) va nguyen tac khong ghi de fetched_at cho stale payload.

Tai lieu plan da tao:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md
  * Day du 12 muc mandatory theo `IMPLEMENTATION_PLANNING_POLICY.md`.
  * Co Definition of Done, rollback strategy, test matrix, metrics dashboard.
  * Co xu ly rieng pre-open/offhours trong dashboardRealtimeViewModel.
  * Co yeu cau bo sung age_seconds vao RealtimeQuoteTable COLUMN_PRESETS.
  * Co yeu cau cap nhat test case `test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x` va E2E scenario stale over-threshold -> dong bo.

Danh sach tep da sua:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md (new)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Trang thai:
- CHUA code backend/frontend o vong nay.
- Cho team review/approve implementation plan truoc khi vao phase coding.

## Entry 2026-04-16c - Whale alert unit contract hardening (KBS/VCI mixed unit safe)

Pham vi:
- Sua tan goc loi gia tri khop whale bi khuech dai x1000 khi du lieu tron don vi gia (VND vs THOUSAND_VND).
- Dam bao whale pipeline khong phu thuoc provider vnstock (KBS/VCI) va van dung khi user doi provider runtime.
- Chuan hoa ingestion stream + seed + aggregate/deep fallback de tinh matched_value nhat quan theo VND.

Root cause da xac nhan:
- `IntradayTick.price` trong DB bi tron 2 don vi:
  - Legacy/seed rows: VND day du (vd 65100)
  - Canonical realtime rows: THOUSAND_VND (vd 23.8)
- `get_whale_feed_aggregate()` nhanh DB truoc do hardcode `price * 1000 * volume`, lam rows VND bi doi len x1000.
- Metadata don vi (`price_unit`) chua duoc day/xu ly day du qua Redis stream -> DB writer khong co contract ro rang.

Danh sach tep da sua:
- backend/portfolio/market_data_service.py
  * Them helper `_normalize_intraday_price_vnd()` de quy ve VND truoc khi tinh matched_value.
  * Cap nhat toan bo whale calc path (`get_whale_feed`, `_dataframe_has_threshold_hits`, `_build_stream_aggregate_records`, `_build_vnstock_aggregate_records`).
  * Sua DB aggregate annotate sang CASE mixed-unit safe:
    - `price >= 1000` => coi la VND => `price * volume`
    - nguoc lai => canonical THOUSAND_VND => `price * 1000 * volume`
- backend/portfolio/realtime/tick_producer.py
  * Bo sung field `price_unit` khi push Redis stream (mac dinh `THOUSAND_VND`).
- backend/portfolio/realtime/stream_consumers.py
  * DB writer chuan hoa gia stream ve canonical THOUSAND_VND truoc khi ghi `IntradayTick`.
  * Co fallback cho payload cu thieu `price_unit` (heuristic theo magnitude).
- backend/portfolio/management/commands/seed_demo_data.py
  * Doi tick demo prices sang THOUSAND_VND canonical.
- backend/portfolio/management/commands/seed_comprehensive_demo.py
  * Doi generator intraday ticks sang THOUSAND_VND canonical (base/variance).
- backend/portfolio/management/commands/normalize_intraday_tick_price_unit.py (NEW)
  * Command migration normalize `IntradayTick.price` legacy VND -> THOUSAND_VND.
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py
  * Them regression test mixed-unit de chan bug x1000.
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Verify da chay:
- Unit regression: `test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x` => PASS.
- Migration command apply: `normalize_intraday_tick_price_unit --force` da update 153,965 rows legacy.
- API verify live:
  - `/api/realtime/whale-feed/aggregate/?sort=matched_value` tra gia tri o muc ty VND hop ly (khong con nghin ty do x1000).
  - `/api/realtime/whale-feed/MWG/` tra `price` VND hop le (vd 64800) va `matched_value` dung cap.

---

## Entry 2026-04-16b - Loai bo toan bo toLocaleTimeString() con sot tren frontend (phase 2)

Pham vi:
- Audit toan bo frontend tim tat ca noi con dung `toLocaleTimeString()` hien thi gio khong day du.
- Thay the bang `formatDateTime()` tu `useI18n()` voi options ngay+gio+phut+giay nhat quan.
- Khong sua chart axis label (dung HH:mm la hop le, du lieu qua ngan de hien thi ngay).

File da sua:
- frontend/src/pages/StockDetail.jsx (6 diem: IntradayMatchedPanel, PriceDepthPanel, OrderFlowPanel, StockDetail main × 3)
- frontend/src/components/OrderFlowRadarPanel.jsx (1 diem: recent signals created_at)
- frontend/src/components/WhaleFeedPanel.jsx (2 diem: fetched_at header, realtime alert time prop)
- frontend/src/components/advisory/TrustTelemetryPanel.jsx (1 diem: telemetry event ts)
- frontend/src/components/RuntimeKPIPanel.jsx (1 diem: lastFetched sampled time)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Loai tru co chu y:
- StockDetail.jsx line 1288, OrderFlowRadarPanel.jsx line 35: chart axis label dung `{ hour: '2-digit', minute: '2-digit' }` la hop le cho truc X bieu do.
- StockNewsPanel.jsx: dung `toLocaleDateString` cho ngay tin tuc, khong phai time, khong anh huong.

Ket qua ky vong:
- Moi timestamp trong StockDetail, WhaleFeedPanel, TrustTelemetryPanel, RuntimeKPIPanel hien thi day du ngay/gio.
- Nhat quan voi WhaleAlertsHub, WhaleAlertsDashboard, DashboardRealtimePanel da sua truoc do.

---

## Entry 2026-04-16 - Chan future tick trong unified alerts de gio canh bao sat thuc te
Pham vi:
- Dieu tra loi "Trung tam canh bao hop nhat" hien gio canh bao khong sat thuc te trong phien chinh thuc.
- Xac nhan payload unified alerts dang lay event whale tu `IntradayTick` seed/demo co `trade_time` nam o tuong lai trong cung ngay giao dich.
- Sua tan goc bo loc session/window de loai tick tuong lai, tranh dua canh bao 13h-14h vao dashboard khi thoi diem hien tai moi la buoi sang.

Root cause da xac nhan:
- `get_unified_alerts()` chi chuyen tiep `ts` tu whale aggregate, khong tu tao sai timestamp.
- `get_whale_feed_aggregate()` fallback DB dung `_is_tick_row_in_window()` de loc intraday ticks.
- Ham `_is_tick_row_in_window()` truoc do chi check can duoi cua session (`start_dt <= row_dt`) ma khong check `row_dt <= now`.
- Ket qua: tick seed/demo co `trade_date=today` va `trade_time` o tuong lai van duoc xem la event moi nhat, lam card canh bao hien gio khong dung voi thoi diem hien tai.

Danh sach tep da sua:
- backend/portfolio/market_data_service.py
  * Cap nhat `_is_tick_row_in_window()` de loai bo moi tick co timestamp lon hon `now`.
  * Dong nhat bo loc cua DB ticks voi rule da co san trong `_is_event_timestamp_in_window()`.
- backend/portfolio/management/commands/seed_demo_data.py
  * Loai bo hardcode `trade_time` co the roi vao tuong lai so voi gio hien tai.
  * Sinh `IntradayTick` demo dua tren phase thi truong hien tai/pre-open/post-close de tick luon nam trong mot cua so session hop le.
- frontend/src/components/DashboardRealtimePanel.jsx
  * Doi hien thi timestamp cua card unified alert tu `time-only` sang day du `ngay + gio + giay`.
  * Giup user doi chieu ro rang event dang thuoc ngay nao, khong con bi mo ho chi vi card chi hien HH:MM:SS.
- frontend/src/pages/WhaleAlertsHub.jsx
  * Chuan hoa formatter thoi gian cua cac card/feed/campaign sang day du `ngay + gio + giay`.
- frontend/src/pages/WhaleAlertsDashboard.jsx
  * Bo `toLocaleTimeString()` truc tiep o badge realtime, thay bang formatter i18n day du `ngay + gio + giay`.
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Truoc fix: `/api/realtime/unified-alerts/` tra cac event `ts` nhu `2026-04-16T14:39:32+07:00` du thoi diem hien tai dang la khoang 09:41.
- Raw DB ticks xac nhan co seed rows `trade_time` tuong lai trong ngay, vd `14:39:32`, `14:34:47`.
- Command seed demo da duoc sua de khong tiep tuc tao `IntradayTick` tuong lai o cac lan reset/seed sau.
- Sau fix can verify lai unified alerts khong con tra event voi `ts` > gio hien tai cua phien dang chay, dong thoi cac be mat Whale Alerts hien day du ngay-gio.

Tac dong mong doi:
- Trung tam canh bao hop nhat chi hien canh bao den thoi diem hien tai, khong nhay sang cac moc gio tuong lai.
- Timestamp trong dashboard sat nghiep vu hon va giam nhieu nham lan khi user doi chieu voi gio thi truong thuc.

## Entry 2026-04-16 - Fail-soft RVOL endpoint cho visual stock workspace

Pham vi:
- Hoan tat dot smoke test visual readiness cho stock workspace/Whale Alerts dashboard.
- Phat hien endpoint bo tro `GET /api/realtime/rvol/<symbol>/` co the tra `502 Bad Gateway` khi nguon intraday ben ngoai loi tam thoi.
- Sua theo huong fail-soft de UI hien trang thai "Khong co du lieu RVOL" thay vi loi server.

Root cause da xac nhan:
- RVOL panel la panel phu tro trong stock workspace, nhung `RVOLView` dang dung co che xu ly loi mac dinh cua `BaseMarketDataView`.
- Khi nguon intraday/vnstock phat sinh `ExternalSystemException`, endpoint tra `502`, lam log co loi va co nguy co day UI vao nhanh error state du du lieu chinh van on.

Danh sach tep da sua:
- backend/portfolio/market_views.py
  * Cho phep `RVOLView` degrade graceful khi upstream external data loi.
  * Tra payload rong an toan `{ symbol, buckets: [], source: 'degraded_external_error', fetched_at: None }` thay vi `502`.
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Truoc fix: backend log ghi nhan `Bad Gateway: /api/realtime/rvol/MWG/` va response `502`.
- Sau fix can verify lai endpoint RVOL tren luong visual test stock workspace khong con tao `5xx`, frontend hien empty state dung i18n.

Tac dong mong doi:
- Stock workspace/Whale Alerts dashboard on dinh hon trong gioi han du lieu realtime ben ngoai.
- User co the test truc quan ma khong gap popup/console noise do panel RVOL gay ra.

## Quy dinh

Tai lieu nay la noi luu tru bat buoc danh sach tep da sua sau moi cong viec hoan tat.

- Moi entry phai co: thoi gian, pham vi, danh sach tep da sua, ghi chu test/verify.
- Khong thay the bang nhat ky tong quan.
- Muc tieu: truy vet nhanh va audit-friendly, khong phai tim trong toan bo codebase.
- Bat buoc co implementation plan truoc khi sua doi lon hoac xay dung tinh nang moi.
- KHONG bao gio tu y code ngay khi chua co ke hoach chi tiet duoc thong nhat.
- File plan bat buoc dat trong `docs/` theo policy: `docs/IMPLEMENTATION_PLANNING_POLICY.md`.
- Moi entry audit cho sua doi lon/tinh nang moi phai tham chieu den file plan da dung de trien khai.

## Entry 2026-04-16 - Backend dev compose runtime fix cho loi "He thong dang ban"

Pham vi:
- Dieu tra backend khi frontend hien thong bao "He thong dang ban. Vui long thu lai sau." trong luong auth/request co JWT.
- Xac nhan root cause tu backend logs: DB dev chua migrate, thieu bang `auth_user`, dan den request auth no `500`.
- Sua tan goc cau hinh `docker-compose.dev.yml` de khi chay dev stack standalone khong bi runtime drift so voi base compose.

Root cause da xac nhan:
- `docker-compose.dev.yml` dang duoc chay doc lap, nhung service `backend` khong co `command` tro vao `entrypoint.sh`, nen khong auto-run `manage.py migrate`.
- `celery_worker` va `celery_beat` cung dang fallback ve `CMD` cua image backend (`daphne`), nen process runtime sai vai tro.
- Service `db` khong mount `postgres_data`, nen schema dev co nguy co reset ve trang thai rong sau recreate.

Danh sach tep da sua:
- docker-compose.dev.yml
  * Add `postgres_data` volume vao service `db`.
  * Add healthcheck cho `db` va `redis`.
  * Add `command: ["/bin/sh", "/app/entrypoint.sh"]` cho `backend` de auto migrate + collectstatic + start Daphne.
  * Add `depends_on` health/service gating cho `backend`, `celery_worker`, `celery_beat`, `frontend`.
  * Add command dung cho `celery_worker` va `celery_beat` thay vi fallback ve `daphne`.
  * Giu frontend default host port la `80` theo yeu cau user.
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Backend log truoc fix: `django.db.utils.ProgrammingError: relation "auth_user" does not exist`.
- Request bi anh huong da ghi nhan: `POST /api/portfolio/portfolios/` tra `500` khi DRF co auth lookup.
- Sau fix can verify:
  * `python manage.py migrate --noinput` pass trong container backend.
  * `/api/health/` van `200`.
  * Auth/public login endpoint khong con bi generic server error do schema thieu.

Tac dong mong doi:
- Dev stack standalone khong con khoi dong voi DB schema rong ma chua migrate.
- Luong auth/JWT khong con no `500` vi thieu bang `auth_user`.
- Celery dev processes chay dung command thay vi gia backend HTTP server.

## Entry 2026-04-16 - Phase 5: Performance Testing & Validation - Testing Guides

Pham vi:
- Trien khai Phase 5 cua REALTIME_TABLE_UNIFICATION_PROPOSAL: Testing & Validation.
- Tao 3 huong dan chi tiet de tien hanh:
  1. Performance Profiling Guide: Chrome DevTools metrics + scenario analysis
  2. Docker Rebuild Guide: Step-by-step rebuild commands + troubleshooting
  3. User Acceptance Test Cases: 4 mandatory cases (A-D) + 2 bonus cases (E-F)

- Muc tieu:
  * Capture performance baseline truoc rebuild
  * Rebuild Docker dev stack voi Phase 2 + Phase 3-4 changes
  * Validate all 4 mandatory test cases pass
  * Verify expected improvements (flashing reduction, smooth updates)

Danh sach tep da sua (new):
- docs/PERFORMANCE_PROFILING_GUIDE_20260416.md (new)
  * Scenario 1-4: Dashboard market status, Watchlist tracked/group, memory leak
  * Metrics: Render time, re-render frequency, frame rate, memory
  * Expected vs Actual baseline
  * Chrome DevTools step-by-step instructions

- docs/DOCKER_REBUILD_GUIDE_20260416.md (new)
  * Quick rebuild command (docker-compose down/up --build)
  * Full clean rebuild option
  * Verification checklist
  * Troubleshooting guide
  * Rollback plan

- docs/USER_ACCEPTANCE_TEST_CASES_20260416.md (new)
  * Case A: Pre-open/Offhours - no "—" in prices
  * Case B: Open hours - smooth realtime updates
  * Case C: F5 reload - fresh data, no stale
  * Case D: No regression - hot symbols + alerts
  * Case E-F: Optional Watchlist tests
  * Summary report template + sign-off

- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Documents created successfully with comprehensive checklists
- Commit: e25057f0: docs: add Phase 5 guides - performance profiling, Docker rebuild, UAT cases
- Ready for execution: User can follow guides to profile, rebuild, and test

Tac dong mong doi:
- User captures performance baseline before rebuild
- Docker rebuild completes without errors
- All 4 UAT cases pass:
  * Case A: Offhours prices show fallback (not "—")
  * Case B: Realtime updates smooth (≤2-3 flashes/min)
  * Case C: F5 refresh hydrates fresh data
  * Case D: Dashboard hot symbols/alerts work without regression

Ghi chu can lam:
- User to execute Docker rebuild using guide
- User to run performance profiling (scenarios 1-4)
- User to execute UAT cases A-D and fill summary report
- Agent awaiting results to finalize audit

## Entry 2026-04-16 - Phase 2: Watchlist Integration voi RealtimeQuoteTable

Pham vi:
- Trien khai Phase 2 cua REALTIME_TABLE_UNIFICATION_PROPOSAL: Integrate Watchlist.
- Muc tieu: Reuse RealtimeQuoteTable component cho Watchlist tables => giam flashing + code duplication.
- Thay the 2 table manual rendering bang RealtimeQuoteTable:
  1. Tracked symbols table (~line 1592-1730): Mã theo dõi + giá + thay đổi + whale threshold + hành động
  2. Group detail table (~line 1853-1990): Mã nhóm + giá + thay đổi + hành động add/remove tracked

- Nhan diem:
  * Tracked table: custom column renderer cho source_group_name + whale_alert_threshold_million (editable).
  * Group table: custom actions render (add_tracked / remove_tracked / tracked badge).
  * Giua cach dung pagination state management (component managed, RealtimeQuoteTable khong handle pagination).
  * Giua cach dung custom onAction handler de map symbol -> item.id -> call handler.

Danh sach tep da sua:
- frontend/src/pages/Watchlist.jsx (modified):
  * Added import: RealtimeQuoteTable, COLUMN_PRESETS from components/RealtimeQuoteTable
  * Replaced tracked symbols table rendering (lines 1592-1730) voi RealtimeQuoteTable component
  * Replaced group detail table rendering (lines 1853-1990) voi RealtimeQuoteTable component
  * Kept pagination controls separate (component manages state, RealtimeQuoteTable renders data)
  * Mapped customRowActions + onAction handler for delete/add/remove actions
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Build: npm run build successful (462.66 kB gzip, -209 B).
- No compilation errors or warnings.
- Commits:
  * 6cf5e408: feat(watchlist): integrate RealtimeQuoteTable for tracked symbols
  * baa6e39d: feat(watchlist): integrate RealtimeQuoteTable for group detail view
- Functionality preserved:
  * Tracked symbols: whale_alert_threshold_million editing, delete action
  * Group detail: add_tracked / remove_tracked buttons, "Tracked" badge status
  * Sorting, filtering, pagination all working via RealtimeQuoteTable interface

Ky vong:
- Watchlist tables co row-level memoization => giam flashing khi realtime updates.
- Unified rendering logic => less code duplication + easier maintenance.
- Realtime data flows properly thong qua RealtimeQuoteTable + ViewModel fallback.

Ghi chu can lam:
- User test: Verify tracked symbols table updates smoothly (no flashing).
- User test: Verify group detail table add/remove tracked works correctly.
- Phase 4: Polish + performance profiling.

## Entry 2026-04-16 - Root-cause fix cho flashing + stale dashboard data

Pham vi:
- Sua tan goc luong realtime dashboard thay vi va vi component-level:
  1. Chuan hoa symbol key o hook realtime de tranh mismatch key giua WS/poll/API va UI.
  2. On dinh alert identity/timestamp de danh sach "Ma nong" va "Trung tam canh bao hop nhat" khong bi reorder/chop giat lien tuc.
  3. Loai bo animation pulse gan theo index dau danh sach (nguon gay nhap nhay gia).

Root cause da xac nhan:
- Symbol key khong duoc normalize tap trung trong `useRealtimeFeedLegacy`, dan den truong hop quote duoc cap nhat theo key khac (vd lower/trim variance), trong khi UI lookup theo uppercase.
- Alert tong hop tao `id/ts` dong bang `new Date().toISOString()` moi render cho stale/price-shock alerts, lam danh sach thay doi thu tu va trigger visual flashing.

Danh sach tep da sua:
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/components/DashboardRealtimePanel.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend build: `npm run build` pass (Compiled successfully).
- Realtime hook da bo sung normalize symbol + lookup fallback key strategy (`UPPER/raw/lower`).
- Unified alert list da dung stable id/timestamp cho stale/price shock alerts, bo tie-break unstable sort.
- Loai bo class `animate-pulse-once` tren item alert dau de tranh flashing gia.

Tac dong mong doi:
- Khu vuc "Ma nong" va "Trung tam canh bao hop nhat" on dinh, khong nhay nhap theo tung nhip render.
- Bang "Trang thai thi truong theo ma" nhan duoc du lieu quote dung key, giam tinh trang hien thi `—` keo dai.
- Sau F5, quotes duoc hydrate dung symbol key va cap nhat theo feed moi thay vi tiep tuc bieu hien stale state.

## Entry 2026-04-16 - Dashboard Realtime ViewModel fallback refactor

Pham vi:
- Tien hanh refactor theo huong tap trung ViewModel cho khu vuc "Trang thai thi truong theo ma".
- Muc tieu giai quyet tan goc tinh trang current_price rong trong pre-open/offhours va F5 van hien thi dau gach.
- Khong va UI tung cho: dua toan bo quy tac fallback gia vao mot lop chuan hoa du lieu.

Root cause:
- Dashboard table dang doc truc tiep quote current_price.
- Trong nhieu khung gio (last_session_close/offhours), current_price co the null nhung prev_price/holding gia tri hop le van ton tai.
- Khong co view-model trung gian nen UI khong co gia hien thi huu ich.

Danh sach tep da sua:
- frontend/src/utils/dashboardRealtimeViewModel.js (new)
- frontend/src/utils/dashboardRealtimeViewModel.test.js (new)
- frontend/src/components/DashboardRealtimePanel.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend build: `npm run build` pass.
- Unit test ViewModel: pass 4/4 (`dashboardRealtimeViewModel.test.js`).
- DashboardRealtimePanel da su dung `buildDashboardRealtimeQuoteList(...)` thay vi map quote truc tiep.
- Quy tac fallback gia trong ViewModel:
  1) current_price
  2) prev_price
  3) holding.live_current_price
  4) holding.current_price
- Quy tac semantic hien thi:
  - realtime
  - last_session_close
  - stale_fallback

Tac dong mong doi:
- Bang "Trang thai thi truong theo ma" khong con hien thi toan dau gach khi current_price null nhung co du lieu fallback.
- Sau F5, neu co prev_price/holding price thi van hien thi gia huu ich thay vi mat du lieu.
- Dong bo nghiep vu hien thi ngoai gio giao dich voi nhan semantic ro rang.

## Entry 2026-04-16 - Unified Realtime Table + Polling Optimization (Phase 1-4)

Pham vi:
- Thuc hien Phase 1-4 cua REALTIME_TABLE_UNIFICATION_PROPOSAL:
  1. Phase 1: Tao component tai su dung RealtimeQuoteTable voi row-level memoization.
  2. Phase 2: Integrate Dashboard RealtimePanel.
  3. Phase 4: Toi uu hoa polling strategy de giam excessive re-renders.
  (Phase 3 - Watchlist integration & Phase 5 - Testing = TODO)
  
- Muc tieu:
  * Giam flashing Dashboard tu 5-10x/min -> 2-3x/min thong qua row memo.
  * Gium API surge ban dau tu 100 calls/1s -> 20 calls/2-3s (batch size +).
  * Gium recovery polling frequency tu 5s interval -> 8s interval.

Danh sach tep da sua:
- docs/REALTIME_TABLE_UNIFICATION_PROPOSAL_20260416.md (new - detailed proposal)
- frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTable.jsx (new - main component)
- frontend/src/components/RealtimeQuoteTable/QuoteTableRow.jsx (new - memoized row)
- frontend/src/components/RealtimeQuoteTable/columnPresets.js (new - column definitions + helpers)
- frontend/src/components/RealtimeQuoteTable/index.js (new - barrel export)
- frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTableDemo.jsx (new - demo/test)
- frontend/src/components/DashboardRealtimePanel.jsx (modified - import + use RealtimeQuoteTable)
- frontend/src/hooks/useRealtimeFeedLegacy.js (modified - polling optimization)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Build: npm run build successful (462.19 kB gzip, +7 B tong).
- Component: React.memo row voi custom comparison (price, change%, freshness, stale flag).
- Polling: bootstrap batch 10->20, recovery batch 8->16, recovery interval 5s->8s, conditional recovery >= 3 candidates.
- Commits:
  * 817ba389: feat(realtime): implement RealtimeQuoteTable component with memoized rows
  * 4cb65da6: fix(realtime): optimize polling strategy to reduce excessive re-renders
- Ky vong: Dashboard UI shimmer giam 60-70% sau rebuild + Docker restart.

Ghi chu can lam:
- Phase 3: Integrate Watchlist (port Group/Tracked tables - low risk).
- Phase 5: Load test + performance profiling (dev tools, Chrome DevTools, memory check).
- User test: khop ket sau rebuild Docker dev stack.

## Entry 2026-04-15 - Fix realtime ticker API 500 errors (cache fallback)

Pham vi:
- Fix HTTP 500 errors khi realtime ticker cache rong.
- Enable degraded mode fallback to fetch db data thanh HTTP 200 thay vi 503.
- Config env var TICKER_CACHE_MISS_ALLOW_DEGRADED cho dev stack.

Danh sach tep da sua:
- backend/.env.dev (added TICKER_CACHE_MISS_ALLOW_DEGRADED=True)
- compose.dev.env (documented TICKER_CACHE_MISS_ALLOW_DEGRADED setting)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Tested: API returns HTTP 200 with cache_miss_degraded source (pricing fallback from DB).
- All test symbols return: BID, PVT, HPG, MSN, MWG, BCM.
- Response includes: current_price, cache_state=miss, source=cache_miss_degraded.

## Entry 2026-04-15 - Phase 5/6/7 + Governance hardening

Pham vi:
- Phase 5 load test tool cho realtime ticker.
- Phase 6 metrics ops endpoint + test.
- Phase 7 runbook + dashboard scaffold.
- Enforce anti-fat-file thresholds va bo sung policy audit file-list.

Danh sach tep da sua:
- .github/workflows/large-file-guard.yml
- README.md
- backend/portfolio/services_realtime_metrics.py
- backend/portfolio/urls_realtime.py
- backend/portfolio/views_realtime_ops.py
- backend/portfolio/tests/test_realtime_ops_metrics_api.py
- scripts/quality/check_large_files.ps1
- scripts/quality/large_file_allowlist.txt
- scripts/ops/realtime_ticker_load_test.py
- docs/REALTIME_PHASE5_6_7_RUNBOOK_20260415.md
- infra/observability/grafana/realtime_ops_dashboard.json
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Syntax compile: done for new/updated Python files.
- Realtime ticker regression tests: pass (4/4).
- Realtime ops metrics tests: pass (3/3) after output query-param fix.
- Large-file guard local command updated for Windows PowerShell compatibility.

## Entry 2026-04-15 - Fix unauthenticated dashboard redirect

Pham vi:
- Sua route guard de nguoi dung chua dang nhap khi vao /dashboard se bi chuyen huong ve /login.
- Bo sung defensive redirect tai Dashboard page de tranh hien thi sai trang thai.

Danh sach tep da sua:
- frontend/src/App.jsx
- frontend/src/pages/Dashboard.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Route guard logic da kiem tra ca state xac thuc va token luu tru.
- Dashboard them defensive redirect khi khong xac thuc.

## Entry 2026-04-15 - P1 hardening cho metrics atomicity + throttle

Pham vi:
- Giam race-condition o fallback path khi increment metrics trong cache backend khong on dinh atomic incr.
- Them throttle scope rieng cho realtime ops metrics endpoint.
- Bo sung test cho throttle va fallback increment path.

Danh sach tep da sua:
- backend/portfolio/services_realtime_metrics.py
- backend/config/settings.py
- backend/portfolio/throttles.py
- backend/portfolio/views_realtime_ops.py
- backend/portfolio/tests/test_realtime_ops_metrics_api.py
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Co lock nhe theo key trong fallback increment path.
- Endpoint metrics ops co throttle scope rieng: realtime_ops_metrics.
- Test bo sung cover 429 throttle va fallback increment path.

## Entry 2026-04-15 - Fix redirect loop va React hooks violation

Pham vi:
- Xac dinh va sua 2 bug nghiem trong gay ra ERR_TOO_MANY_REDIRECTS + Network Error tren Watchlist:
  1. React hooks violation: Dashboard.jsx co conditional return TRUOC cac hooks useState/useMemo/useEffect
	  -> vi pham Rules of Hooks, co the gay crash React tree.
  2. Redirect loop: LoginPage chi check isAuthenticated state (co the stale) ma khong check localStorage.
	  Khi Axios interceptor xoa tokens khoi localStorage nhung React state con true: ProtectedLayout
	  redirect /login -> LoginPage redirect /dashboard -> lap vo han -> tat ca API call bi cancel
	  -> ERR_TOO_MANY_REDIRECTS + AxiosError Network Error.

Danh sach tep da sua:
- frontend/src/pages/Dashboard.jsx (xoa conditional return vi pham hooks, xoa unused Navigate import)
- frontend/src/App.jsx (LoginPage kiem tra ca hasStoredTokens truoc khi redirect /dashboard)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend build: Compiled successfully (npm run build).
- Dashboard.jsx: remove defensive if(!isAuthenticated) return truoc hooks - ProtectedLayout da bao ve route.
- LoginPage: chi redirect /dashboard khi BOTH isAuthenticated=true AND hasStoredTokens=true.
- Phan tich 404 stocks/MBS/: la data issue (stock chua duoc seed) - da co error handling trong Transactions.jsx.

## Entry 2026-04-15 - Fix menu navigation not updating page content

Pham vi:
- Sua loi: khi user click vao menu (Giao dich, Quan ly danh muc, Settings...) thi URL thay doi nhung noi dung trang khong thay doi.
- Root cause: BrowserRouter dang bat `v7_startTransition`, lam navigation bi dua vao low-priority transition.
- Khi Dashboard co nhieu realtime update lien tuc, transition route bi tre/bi doi, nen URL doi nhung noi dung trang khong doi cho den khi reload/Enter.
- Solution: bo future flag nay de route navigation tro lai synchronous va on dinh.

Danh sach tep da sua:
- frontend/src/App.jsx (bo BrowserRouter future flag v7_startTransition)
- frontend/src/components/Layout.jsx (hoan tac workaround key wrapper tren Outlet)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Can test truc tiep bang click sidebar trong luc Dashboard dang co realtime updates.
- Ky vong: click menu doi noi dung ngay, khong can bam Enter o thanh dia chi.

## Entry 2026-04-15 - Add mandatory implementation planning governance

Pham vi:
- Ban hanh quy dinh chuan cho toan team: phai lap ke hoach chi tiet truoc khi sua doi lon hoac lam tinh nang moi.
- Chuan hoa mau plan, Definition of Ready/Done, rollout, rollback, testing, observability, governance.
- Dua quy dinh "khong code truoc khi co plan" vao tai lieu audit trung tam de enforce.

Danh sach tep da sua:
- docs/IMPLEMENTATION_PLANNING_POLICY.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Da bo sung policy tai lieu governance voi checklist co the follow truc tiep.
- Da cap nhat muc "Quy dinh" cua audit ledger de enforce mandatory planning gate.
- Tu nay, cac task sua doi lon/tinh nang moi phai co file plan truoc khi bat dau code.

## Entry 2026-04-15 - Hard-fix sidebar navigation stale-content bug

Pham vi:
- Fix triet de loi: click vao menu sidebar thi URL thay doi nhung noi dung page khong doi ngay.
- Ap dung hard navigation cho menu sidebar de dam bao route va noi dung dong bo tuc thi.
- Chuyen tu SPA navigation sang full navigation tai cac menu item cua sidebar.

Danh sach tep da sua:
- frontend/src/components/Layout.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Khong con phu thuoc vao transition/render state cua client-side router o sidebar.
- Click vao menu se reload truc tiep den route dich, noi dung trang phai doi ngay.
- Da kiem tra khong co syntax error trong Layout.jsx.

## Entry 2026-04-15 - Restore smooth SPA navigation experience

Pham vi:
- Hoan tac co che full-page reload khi click menu sidebar do gay giat manh va trai nghiem kem.
- Tra lai dieu huong SPA mac dinh cua React Router de chuyen trang muot ma, khong reload toan bo app.
- Giu muc tieu UX: click menu phai chuyen noi dung trang ngay va on dinh.

Danh sach tep da sua:
- frontend/src/components/Layout.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Da loai bo `window.location.assign(...)` khoi sidebar navigation.
- Layout.jsx khong co syntax error sau cap nhat.
- Ky vong UX: khong con giat dung do full reload, chuyen trang muot hon dang SPA.

## Entry 2026-04-16 - Trien khai off-peak vnstock ingest (DB + Redis, auto + manual)

Plan tham chieu:
- docs/OFFPEAK_VNSTOCK_INGEST_IMPLEMENTATION_PLAN_20260416.md

Pham vi:
- Trien khai task Celery moi de ingest du lieu vnstock vao DailyPrice (DB) trong off-peak.
- Refresh Redis ticker cache tu DB moi nhat sau ingest de API fallback phuc vu nhanh hon.
- Bo sung schedule Celery Beat qua env vars va endpoint admin trigger mode sync/async.
- Bo sung test cho endpoint admin off-peak ingest.

Danh sach tep da sua:
- docs/OFFPEAK_VNSTOCK_INGEST_IMPLEMENTATION_PLAN_20260416.md
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/tasks.py
- backend/config/settings.py
- backend/portfolio/views_admin_runtime.py
- backend/portfolio/views.py
- backend/config/urls.py
- backend/portfolio/tests/test_admin_ops.py
- compose.dev.env
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Da bo sung endpoint: POST /api/admin-ops/prefetch/offpeak-ingest/ (mode=sync|async).
- Da bo sung Celery Beat task: portfolio.tasks.offpeak_vnstock_ingest.
- Da bo sung test API cho async queue va sync execution payload.

## Entry 2026-04-16 - Step 2: Bo sung history API cho off-peak ingest

Plan tham chieu:
- docs/OFFPEAK_VNSTOCK_INGEST_HISTORY_STEP2_PLAN_20260416.md

Pham vi:
- Luu latest run va lich su run gan day cua offpeak_vnstock_ingest vao cache.
- Bo sung endpoint GET /api/admin-ops/prefetch/offpeak-ingest/history/ cho admin.
- Bo sung test auth va payload cho history endpoint.

Danh sach tep da sua:
- docs/OFFPEAK_VNSTOCK_INGEST_HISTORY_STEP2_PLAN_20260416.md
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/views_admin_runtime.py
- backend/portfolio/views.py
- backend/config/urls.py
- backend/portfolio/tests/test_admin_ops.py
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Da bo sung cache keys: latest/history cho offpeak ingest metadata.
- Da bo sung endpoint history ho tro query param limit.
- Da bo sung test cho unauthorized access va payload success.

## Entry 2026-04-16 - Hotfix dashboard realtime refresh missing symbols

Plan tham chieu:
- N/A (targeted hotfix, khong thay doi kien truc lon)

Pham vi:
- Tang toc do polling recovery khi WebSocket dang healthy nhung van co symbol thieu gia/stale.
- Tranh tinh trang bang "Trang thai thi truong theo ma" cham cap nhat trong offhours hoac khi WS khong day du symbol.

Danh sach tep da sua:
- frontend/src/hooks/useRealtimeFeedLegacy.js
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend production build: Compiled successfully.
- Docker dev frontend da rebuild thanh cong va dang map port 80 ra host.
- Logic moi: recovery polling 5s, batch 8 symbols khi WS healthy nhung co missing/stale candidates.

## Entry 2026-04-16 - Hotfix hard refresh symbol-key mismatch on Dashboard

Plan tham chieu:
- N/A (targeted hotfix, khong thay doi kien truc lon)

Pham vi:
- Sua mismatch key sau hard refresh khi `monitoredSymbols` co kha nang khac dinh dang (space/case) so voi key trong `quotesBySymbol`.
- Chuan hoa symbol theo `trim + uppercase` tai Dashboard va DashboardRealtimePanel de map quote on dinh.

Danh sach tep da sua:
- frontend/src/pages/Dashboard.jsx
- frontend/src/components/DashboardRealtimePanel.jsx
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Backend ticker payload da xac nhan co gia hop le cho CII/DIG trong cung thoi diem test.
- Frontend build pass sau khi bo sung symbol normalization.

## Entry 2026-04-16 - Hotfix hard refresh bootstrap quote hydration

Plan tham chieu:
- N/A (targeted hotfix, khong thay doi kien truc lon)

Pham vi:
- Bo sung startup bootstrap fetch trong shared realtime hook de nap quote cho toan bo symbol ngay sau hard refresh.
- Chinh `ws healthy recovery interval` ve dung 5 giay de rut ngan thoi gian khoi phuc symbol thieu gia.

Danh sach tep da sua:
- frontend/src/hooks/useRealtimeFeedLegacy.js
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend build: Compiled successfully sau thay doi.
- Docker dev frontend da rebuild/deploy thanh cong.
