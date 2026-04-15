# Code Change Audit Ledger

## Quy dinh

Tai lieu nay la noi luu tru bat buoc danh sach tep da sua sau moi cong viec hoan tat.

- Moi entry phai co: thoi gian, pham vi, danh sach tep da sua, ghi chu test/verify.
- Khong thay the bang nhat ky tong quan.
- Muc tieu: truy vet nhanh va audit-friendly, khong phai tim trong toan bo codebase.

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
- Root cause: React Router Outlet component khong re-render khi route thay doi.
- Solution: Them key={location.pathname} vao Outlet component de force re-mount.

Danh sach tep da sua:
- frontend/src/components/Layout.jsx (import useLocation, add key prop to Outlet)
- docs/CODE_CHANGE_AUDIT_LEDGER.md

Ghi chu verify:
- Frontend build: success
- Route change behavior: URL updates and page content re-renders properly
- Each page's useEffect hooks fire when navigated to
- No stale state carries over between page transitions
