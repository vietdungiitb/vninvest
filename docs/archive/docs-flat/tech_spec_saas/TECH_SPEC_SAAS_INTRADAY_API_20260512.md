# TECH SPEC — SaaS Intraday API (Chart + Tape)

**Ngày**: 2026-05-12 | **Status**: APPROVED FOR IMPLEMENTATION  
**Workstream**: SAAS-MIGRATION — Market Data Domain  
**Owner**: packages/core backend team

---

## 1. AUDIT BASELINE — HIỆN TRẠNG THỰC TẾ

> Đây là kết quả đọc source trực tiếp ngày 2026-05-12. Không phỏng đoán.

### 1.1 Những gì ĐÃ CÓ (đã verify)

| File | Nội dung đã có | Verified |
|------|---------------|----------|
| `packages/core/backend/src/market_data/models.py` | `StockProfile`, `DailyPrice`, `VnbrokerRuntimeConfig` | ✅ |
| `packages/core/backend/src/market_data/views.py` | `StockProfileListView`, `StockProfileDetailView`, `DailyPriceListView`, `TrackedSymbolsView` | ✅ |
| `packages/core/backend/src/market_data/serializers.py` | `StockProfileSerializer`, `DailyPriceSerializer` | ✅ |
| `packages/core/backend/src/market_data/urls.py` | 3 routes: `symbols/`, `symbols/<sym>/`, `daily-prices/<sym>/` | ✅ |
| `packages/core/backend/src/market_data/vnbroker_adapter.py` | `fetch_price_board_snapshot()` (mock), `fetch_listing_symbols()` (mock) | ✅ |
| `packages/core/backend/src/vninvest_core/legacy_http_bridge.py` | `legacy_bridge_response()`, `legacy_bridge_enabled()` | ✅ |
| `packages/core/backend/src/market_serving/api_urls.py` | `realtime/intraday/<sym>/` → `RealtimeLegacyBridgeView` (bridge đã có!) | ✅ |
| `packages/core/backend/tests/test_market_data_api_routes.py` | Test pattern chuẩn dùng `APIClient`, `resolve()`, `force_authenticate()` | ✅ |

### 1.2 Những gì ĐANG THIẾU (gap cần fill)

| Gap | Nơi cần thêm | Legacy endpoint tương đương |
|-----|-------------|----------------------------|
| `IntradayPricesView` (OHLCV bars) | `market_data/views.py` | `GET /api/stock-management/stocks/{sym}/chart/?timeframe=1H&days=30` |
| `IntradayTapeView` (tick trades) | `market_data/views.py` | `GET /api/realtime/intraday/{sym}/` |
| Serializers intraday | `market_data/serializers.py` | N/A |
| 2 URL routes | `market_data/urls.py` | N/A |
| Test cases intraday | `tests/test_market_data_api_routes.py` | Extend existing test file |

### 1.3 Pattern mẫu từ codebase

`TrackedSymbolsView` (đã có trong `market_data/views.py`) là blueprint chính xác:
```python
# Hiện tại dòng 83–107 trong views.py
class TrackedSymbolsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        bridged_response = legacy_bridge_response(
            request, '/api/stock-management/tracked-symbols/',
            unavailable_message='Legacy tracked-symbol bridge hiện không khả dụng.',
        )
        if bridged_response is not None and bridged_response.status_code < 500:
            return bridged_response
        return Response([])
```
→ **Follow exact same pattern** cho cả 2 view mới.

---

## 2. KIẾN TRÚC QUYẾT ĐỊNH (LOCKED)

### 2.1 Approach: Bridge-first → Native-later

```
Phase 1 (task này):   /core/v1/market-data/intraday-* → bridge → legacy
Phase 2 (sau decom):  /core/v1/market-data/intraday-* → native vnbroker + core DB
```

**Lý do**:
- `ISOLATION RULE` trong `market_data/models.py` cấm import từ `backend.portfolio` → không thể dùng `IntradayTick` legacy trực tiếp
- `legacy_bridge_response()` đã có sẵn, đã tested, nhất quán với pattern hiện tại
- Frontend cần endpoint tồn tại **ngay** để unblock migration; data accuracy từ bridge là đủ

### 2.2 URL Contracts (LOCKED — không được thay đổi)

```
GET /core/v1/market-data/intraday-prices/{symbol}/
    Query: timeframe=[1m|5m|15m|1H|2H|4H|D|W|M] (default: 1H), days=int (default: 180)
    Bridges to: /api/stock-management/stocks/{symbol}/chart/

GET /core/v1/market-data/intraday-tape/{symbol}/
    Query: page_size=int (default: 50)
    Bridges to: /api/realtime/intraday/{symbol}/
```

### 2.3 Response contracts (frontend đang expect)

**Intraday Prices** — pass-through từ legacy chart endpoint:
```json
{
  "symbol": "VCB",
  "days": 180,
  "timeframe": "1H",
  "interval": "1h",
  "points": [
    { "date": "2026-05-12T09:00:00", "open": 92.5, "high": 93.2, "low": 91.8, "close": 92.9, "volume": 1250000 }
  ],
  "technical": { "change_percent": 1.5 }
}
```

**Intraday Tape** — pass-through từ legacy intraday endpoint:
```json
{
  "symbol": "VCB",
  "trades": [
    { "time": "09:30:45", "ts": "2026-05-12T09:30:45+07:00", "price": 92.5, "volume": 5000, "side": "buy", "match_type": "BUY" }
  ],
  "total": 1,
  "source": "stream",
  "stale": false
}
```

> ⚠️ **Bridge pass-through**: response schema KHÔNG thay đổi — legacy trả gì, SaaS forward y nguyên. Frontend đã biết schema này.

---

## 3. CODE CẦN VIẾT (copy-paste ready)

### 3.1 File: `market_data/views.py` — Thêm vào cuối file

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
        # Graceful degradation: empty chart when legacy unavailable
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
        # Graceful degradation: empty tape when legacy unavailable
        return Response({
            'symbol': symbol,
            'trades': [],
            'total': 0,
            'source': 'bridge_unavailable',
            'stale': True,
            'fetched_at': None,
        })
```

### 3.2 File: `market_data/urls.py` — Thêm 2 route

```python
# Thêm vào cuối urlpatterns (trước dấu ])
    path('market-data/intraday-prices/<str:symbol>/', views.IntradayPricesView.as_view(), name='intraday-prices'),
    path('market-data/intraday-tape/<str:symbol>/', views.IntradayTapeView.as_view(), name='intraday-tape'),
```

### 3.3 File: `tests/test_market_data_api_routes.py` — Thêm test class

```python
from market_data.views import IntradayPricesView, IntradayTapeView
from unittest.mock import patch, MagicMock
from rest_framework import status as drf_status


class IntradayApiRouteTests(TestCase):
    """Tests for intraday-prices and intraday-tape endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='intraday-tester', password='testpass123')
        self.client.force_authenticate(user=self.user)

    # --- Route resolution ---
    def test_intraday_prices_route_resolves(self):
        resolver = resolve('/api/market-data/intraday-prices/VCB/')
        self.assertIs(resolver.func.view_class, IntradayPricesView)

    def test_intraday_tape_route_resolves(self):
        resolver = resolve('/api/market-data/intraday-tape/VCB/')
        self.assertIs(resolver.func.view_class, IntradayTapeView)

    # --- Auth ---
    def test_intraday_prices_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, drf_status.HTTP_401_UNAUTHORIZED)

    def test_intraday_tape_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, drf_status.HTTP_401_UNAUTHORIZED)

    # --- Bridge enabled: returns bridge response ---
    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_prices_forwards_to_legacy(self, mock_bridge):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.data = {'symbol': 'VCB', 'points': [], 'timeframe': '1H'}
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-prices/VCB/?timeframe=1H&days=30')
        self.assertEqual(resp.status_code, 200)
        mock_bridge.assert_called_once()
        call_args = mock_bridge.call_args
        self.assertIn('/api/stock-management/stocks/VCB/chart/', call_args[0])

    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_tape_forwards_to_legacy(self, mock_bridge):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.data = {'symbol': 'VCB', 'trades': [], 'total': 0}
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        mock_bridge.assert_called_once()
        call_args = mock_bridge.call_args
        self.assertIn('/api/realtime/intraday/VCB/', call_args[0])

    # --- Bridge disabled / unavailable: graceful degradation ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_prices_degraded_when_bridge_off(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['points'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_tape_degraded_when_bridge_off(self, _):
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['trades'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    # --- Symbol uppercased ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_symbol_is_uppercased(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/vcb/')
        self.assertEqual(resp.json()['symbol'], 'VCB')
```

---

## 4. ISOLATION RULE — CONSTRAINT BẮT BUỘC

`market_data/models.py` dòng 1:
```
ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
```

→ Code mới **TUYỆT ĐỐI** không được:
```python
# ❌ CẤM
from portfolio.models import IntradayTick
from backend.portfolio.market_data_service import ...
import backend.anything
```

→ Chỉ được dùng:
```python
# ✅ ĐÚNG
from vninvest_core.legacy_http_bridge import legacy_bridge_response
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
```

---

## 5. IMPORTS CẦN THÊM VÀO views.py

`views.py` hiện tại **đã có** import `legacy_bridge_response`:
```python
# Dòng 14 (đã có sẵn)
from vninvest_core.legacy_http_bridge import legacy_bridge_response
```
→ **Không cần thêm import mới**. Chỉ thêm 2 class vào cuối file.

---

## 6. VERIFY COMMANDS

```bash
cd packages/core/backend

# 1. Route resolution
python -c "
import os; os.environ['DJANGO_SETTINGS_MODULE']='vninvest_core.settings'
import sys; sys.path.insert(0, 'src')
import django; django.setup()
from django.urls import resolve
r1 = resolve('/api/market-data/intraday-prices/VCB/')
r2 = resolve('/api/market-data/intraday-tape/VCB/')
from market_data.views import IntradayPricesView, IntradayTapeView
assert r1.func.view_class is IntradayPricesView
assert r2.func.view_class is IntradayTapeView
print('ROUTES OK')
"

# 2. Run new tests only
python manage.py test tests.test_market_data_api_routes.IntradayApiRouteTests --keepdb -v2

# 3. Run all market_data tests (no regression)
python manage.py test tests.test_market_data_api_routes --keepdb -v2
```

**Expected output**:
```
Ran 12 tests in X.XXXs
OK
```

---

## 7. KHÔNG LÀM TRONG TASK NÀY

| Item | Lý do |
|------|-------|
| Tạo model `IntradayBar` trong core | Phase 2 — sau khi có native data pipeline |
| Thêm cache layer cho bridge | Không cần; legacy đã cache |
| Seed IntradayTick data | Đây là data ops task riêng |
| Modify `market_serving/api_urls.py` | Bridge đã có ở đó, không đụng vào |
| Viết native vnbroker adapter cho intraday | Phase 2 |
| Performance optimization | Đủ cho Phase 1, review ở Phase 2 |
