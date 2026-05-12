# IMPLEMENTATION PLAN — SaaS Intraday API (Chart + Tape)

**Ngày**: 2026-05-12 | **Ref Spec**: TECH_SPEC_SAAS_INTRADAY_API_20260512.md  
**Tổng thời gian**: ~3 giờ (1 dev) | **Số commit**: 3 | **Số file thay đổi**: 3

---

## PREREQUISITE CHECK (trước khi bắt đầu)

```bash
# Chạy ngay để verify baseline
cd packages/core/backend
python manage.py test tests.test_market_data_api_routes --keepdb -v2
```

**Expected**: `Ran 4 tests in X.Xs — OK`  
**Nếu FAIL**: Dừng, report cho team lead. Không code tiếp trên baseline broken.

---

## SLICE 1 — Views + URLs

**Thời gian ước tính**: 30 phút  
**Mục tiêu**: 2 view class + 2 URL route tồn tại và resolve đúng

### Bước 1.1 — Thêm 2 view class

**File**: `packages/core/backend/src/market_data/views.py`  
**Thao tác**: Append vào **cuối file** (sau `TrackedSymbolsView`)

```python
class IntradayPricesView(APIView):
    """
    GET /core/v1/market-data/intraday-prices/{symbol}/

    Phase 1: Bridge to legacy chart endpoint.
    Phase 2: Replace with native vnbroker adapter.

    Query params (forwarded to legacy):
        timeframe: 1m|5m|15m|1H|2H|4H|D|W|M  (default: 1H)
        days: int  (default: 180)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        bridged = legacy_bridge_response(
            request,
            f'/api/stock-management/stocks/{symbol}/chart/',
            unavailable_message='Legacy intraday chart bridge hiện không khả dụng.',
        )
        if bridged is not None and bridged.status_code < 500:
            return bridged
        return Response({
            'symbol': symbol,
            'days': 0,
            'timeframe': request.query_params.get('timeframe', '1H'),
            'interval': 'n/a',
            'points': [],
            'technical': {},
            'source': 'bridge_unavailable',
        })


class IntradayTapeView(APIView):
    """
    GET /core/v1/market-data/intraday-tape/{symbol}/

    Phase 1: Bridge to legacy intraday endpoint.
    Phase 2: Replace with native tick stream.

    Query params (forwarded to legacy):
        page_size: int  (default: 50)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        bridged = legacy_bridge_response(
            request,
            f'/api/realtime/intraday/{symbol}/',
            unavailable_message='Legacy intraday tape bridge hiện không khả dụng.',
        )
        if bridged is not None and bridged.status_code < 500:
            return bridged
        return Response({
            'symbol': symbol,
            'trades': [],
            'total': 0,
            'source': 'bridge_unavailable',
            'stale': True,
            'fetched_at': None,
        })
```

### Bước 1.2 — Thêm 2 URL route

**File**: `packages/core/backend/src/market_data/urls.py`  
**Thao tác**: Thêm 2 dòng trước `]` cuối `urlpatterns`

```python
# THÊM TRƯỚC DẤU ]
    path('market-data/intraday-prices/<str:symbol>/', views.IntradayPricesView.as_view(), name='intraday-prices'),
    path('market-data/intraday-tape/<str:symbol>/', views.IntradayTapeView.as_view(), name='intraday-tape'),
```

### DoD Slice 1

```bash
cd packages/core/backend
python -c "
import os; os.environ['DJANGO_SETTINGS_MODULE']='vninvest_core.settings'
import sys; sys.path.insert(0, 'src')
import django; django.setup()
from django.urls import resolve
from market_data.views import IntradayPricesView, IntradayTapeView
assert resolve('/api/market-data/intraday-prices/VCB/').func.view_class is IntradayPricesView, 'FAIL: prices'
assert resolve('/api/market-data/intraday-tape/VCB/').func.view_class is IntradayTapeView, 'FAIL: tape'
print('SLICE 1 OK — Routes resolve correctly')
"
```

**Pass condition**: `SLICE 1 OK — Routes resolve correctly`  
**Commit message**: `feat(market_data): add IntradayPricesView and IntradayTapeView bridge endpoints`

---

## SLICE 2 — Tests

**Thời gian ước tính**: 45 phút  
**Mục tiêu**: 9 test cases mới passing, 0 regression

### Bước 2.1 — Thêm test class

**File**: `packages/core/backend/tests/test_market_data_api_routes.py`  
**Thao tác**: Thêm ở đầu file: import cần thiết

```python
# THÊM VÀO PHẦN IMPORTS ĐÃ CÓ (sau dòng import hiện tại)
from unittest.mock import patch, MagicMock
```

Thêm vào cuối file:

```python
class IntradayApiRouteTests(TestCase):
    """Route + auth + bridge behavior tests for intraday-prices and intraday-tape."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='intraday-tester-' + str(id(self)),  # unique per test run
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    # --- Route resolution ---
    def test_intraday_prices_route_resolves(self):
        from market_data.views import IntradayPricesView
        resolver = resolve('/api/market-data/intraday-prices/VCB/')
        self.assertIs(resolver.func.view_class, IntradayPricesView)

    def test_intraday_tape_route_resolves(self):
        from market_data.views import IntradayTapeView
        resolver = resolve('/api/market-data/intraday-tape/VCB/')
        self.assertIs(resolver.func.view_class, IntradayTapeView)

    # --- Auth required ---
    def test_intraday_prices_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, 401)

    def test_intraday_tape_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 401)

    # --- Bridge active ---
    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_prices_bridges_to_legacy_chart(self, mock_bridge):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.data = {'symbol': 'VCB', 'points': [], 'timeframe': '1H'}
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-prices/VCB/?timeframe=1H&days=30')
        self.assertEqual(resp.status_code, 200)
        call_path = mock_bridge.call_args[0][1]
        self.assertEqual(call_path, '/api/stock-management/stocks/VCB/chart/')

    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_tape_bridges_to_legacy_intraday(self, mock_bridge):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.data = {'symbol': 'VCB', 'trades': [], 'total': 0}
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        call_path = mock_bridge.call_args[0][1]
        self.assertEqual(call_path, '/api/realtime/intraday/VCB/')

    # --- Bridge disabled / None ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_prices_graceful_degradation(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['points'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_tape_graceful_degradation(self, _):
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['trades'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    # --- Symbol normalization ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_symbol_is_uppercased_prices(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/vcb/')
        self.assertEqual(resp.json()['symbol'], 'VCB')

    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_symbol_is_uppercased_tape(self, _):
        resp = self.client.get('/api/market-data/intraday-tape/vcb/')
        self.assertEqual(resp.json()['symbol'], 'VCB')
```

### DoD Slice 2

```bash
cd packages/core/backend
python manage.py test tests.test_market_data_api_routes --keepdb -v2
```

**Pass condition**:
```
Ran 13 tests in X.XXXs
OK
```
(4 test cũ + 9 test mới = 13)  
**Commit message**: `test(market_data): add 9 unit tests for IntradayPricesView and IntradayTapeView`

---

## SLICE 3 — Integration Smoke Test + Dev Stack Rebuild

**Thời gian ước tính**: 45 phút  
**Mục tiêu**: Endpoint live trong dev stack, curl trả về JSON đúng schema

### Bước 3.1 — Rebuild dev stack

```powershell
cd "c:\Mujoco Projects\vninvest"
docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build core-api
```

### Bước 3.2 — Lấy token

```powershell
$TOKEN = (Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8001/api/auth/token/" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin"}').access
echo "Token: $TOKEN"
```

### Bước 3.3 — Smoke test

```powershell
# Test 1: Intraday Prices
$r1 = Invoke-RestMethod -Method GET `
  -Uri "http://localhost:8001/core/v1/market-data/intraday-prices/VCB/?timeframe=1H&days=30" `
  -Headers @{Authorization="Bearer $TOKEN"}
echo "Intraday Prices symbol: $($r1.symbol)"
echo "Points count: $($r1.points.Count)"
# Pass: symbol=VCB, no 404/500

# Test 2: Intraday Tape
$r2 = Invoke-RestMethod -Method GET `
  -Uri "http://localhost:8001/core/v1/market-data/intraday-tape/VCB/" `
  -Headers @{Authorization="Bearer $TOKEN"}
echo "Intraday Tape symbol: $($r2.symbol)"
echo "Trades count: $($r2.trades.Count)"
# Pass: symbol=VCB, no 404/500

# Test 3: Auth required
try {
  Invoke-RestMethod -Method GET -Uri "http://localhost:8001/core/v1/market-data/intraday-prices/VCB/"
} catch { 
  echo "Auth check: $($_.Exception.Response.StatusCode)"  # Expected: 401
}
```

### DoD Slice 3

| Check | Pass Condition |
|-------|---------------|
| `GET intraday-prices/VCB/` | HTTP 200, body có `symbol=VCB` |
| `GET intraday-prices/VCB/` không có token | HTTP 401 |
| `GET intraday-tape/VCB/` | HTTP 200, body có `symbol=VCB` |
| `GET intraday-tape/VCB/` không có token | HTTP 401 |
| Legacy bridge active (LEGACY_BACKEND_URL set) | `source` KHÔNG phải `bridge_unavailable` |
| Legacy bridge off (LEGACY_BACKEND_URL unset) | `points=[]` hoặc `trades=[]`, `source=bridge_unavailable` |
| Unit tests | Tất cả 13 tests pass |

**Commit message**: `chore: rebuild dev stack after intraday bridge endpoints`

---

## FILES THAY ĐỔI TỔNG KẾT

| File | Loại thay đổi | Dòng delta |
|------|--------------|-----------|
| `packages/core/backend/src/market_data/views.py` | Append 2 class | +58 |
| `packages/core/backend/src/market_data/urls.py` | Append 2 routes | +2 |
| `packages/core/backend/tests/test_market_data_api_routes.py` | Append 1 test class | +75 |
| **Tổng** | **3 files** | **+135 dòng** |

**Không tạo file mới. Không xóa file cũ. Không sửa model. Không migration.**

---

## ROLLBACK PLAN

Nếu cần rollback sau khi đã push:

```bash
# Remove 2 views
git diff HEAD~1 -- packages/core/backend/src/market_data/views.py
# Remove 2 routes  
git diff HEAD~1 -- packages/core/backend/src/market_data/urls.py
# Remove test class
git diff HEAD~1 -- packages/core/backend/tests/test_market_data_api_routes.py

# Hoặc revert commit
git revert HEAD~2..HEAD
```

→ Rollback **không ảnh hưởng** đến database, migrations, hay bất kỳ service nào khác.
