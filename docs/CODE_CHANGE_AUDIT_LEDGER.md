# Code Change Audit Ledger

## Quy dinh

Tai lieu nay la noi luu tru bat buoc danh sach tep da sua sau moi cong viec hoan tat.

- Moi entry phai co: thoi gian, pham vi, danh sach tep da sua, ghi chu test/verify.
- Khong thay the bang nhat ky tong quan.
- Muc tieu: truy vet nhanh va audit-friendly, khong phai tim trong toan bo codebase.
- Bat buoc co implementation plan truoc khi sua doi lon hoac xay dung tinh nang moi.
- KHONG bao gio tu y code ngay khi chua co ke hoach chi tiet duoc thong nhat.
- File plan bat buoc dat trong `docs/` theo policy: `docs/IMPLEMENTATION_PLANNING_POLICY.md`.
- Moi entry audit cho sua doi lon/tinh nang moi phai tham chieu den file plan da dung de trien khai.

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
