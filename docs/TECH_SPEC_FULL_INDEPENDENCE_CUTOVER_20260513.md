# TECH SPEC — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Scope**: C1–C7 — Loại bỏ bridge, decommission legacy containers  
**Source of truth cho contract code** — không code nếu chưa đọc spec này  

---

## 0. Invariants (bất biến — không vi phạm bất kỳ commit nào)

| ID | Rule |
|----|------|
| INV-01 | `CoreRouter.db_for_write()` phải block write vào `legacy_readonly`. Không được sửa `db_router.py`. |
| INV-02 | `LEGACY_BACKEND_URL` là env var — không hardcode. File: `settings.py` dòng `LEGACY_BACKEND_URL = os.environ.get(...)` |
| INV-03 | Port 8000 không expose trong compose. Đã done B1 — giữ nguyên. |
| INV-04 | Sau C2+C3: không còn import `legacy_bridge_response` trong `api_urls.py` và `public_urls.py` |
| INV-05 | `legacy_http_bridge.py` bị xóa hoàn toàn ở C7 — không để lại dead code |
| INV-06 | SubAccount: return `[]` HTTP 200 — không raise 5xx |
| INV-07 | Telegram: return `{"status": "not_available"}` HTTP 200 |
| INV-08 | Mọi view native mới phải có `permission_classes = [permissions.IsAuthenticated]` tối thiểu |

---

## 1. C1 — Kích hoạt ingest trong core-beat

### 1.1 Problem

`fetch_and_upsert_price_board` task tồn tại trong `data_ingest/tasks.py` nhưng **không** có trong `CELERY_BEAT_SCHEDULE`. Legacy-worker là nguồn duy nhất update `SymbolSnapshot`. Nếu legacy-worker bị stop, snapshot sẽ stale.

### 1.2 Change

**File**: `packages/core/backend/src/vninvest_core/settings.py`

Tìm block `CELERY_BEAT_SCHEDULE` (hiện tại ~line 385+). Thêm entry mới:

```python
CELERY_BEAT_SCHEDULE = {
    # ... existing entries ...

    # C1: Native ingest — fetch price board và upsert SymbolSnapshot mỗi 60s
    'ingest-price-board-60s': {
        'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
        'schedule': 60.0,
        'options': {'queue': 'realtime_prefetch'},
    },
}
```

### 1.3 Validation

```python
# Django shell: kiểm tra beat schedule
from django.conf import settings
'ingest-price-board-60s' in settings.CELERY_BEAT_SCHEDULE  # → True

# Kiểm tra SymbolSnapshot được update
from market_serving.models import SymbolSnapshot
from django.utils.timezone import now
latest = SymbolSnapshot.objects.order_by('-fetched_at').first()
(now() - latest.fetched_at).seconds < 90  # → True (sau 1 minute chạy)
```

### 1.4 Constraints

- Queue PHẢI là `realtime_prefetch` — cùng queue với materializer tasks khác
- Không dùng `crontab` — dùng float seconds để 60s interval

---

## 2. C2 — 9 realtime bridge routes → native views

### 2.1 Current state

9 routes trong `market_serving/api_urls.py` trỏ về `RealtimeLegacyBridgeView` (forward về `backend:8000`).

### 2.2 Target: Native views dùng SymbolSnapshot

Tạo các view mới trong `market_serving/views.py` (hoặc `market_serving/native_views.py` nếu tách):

#### C2-V1: `RealtimeTickerView` — `/api/realtime/ticker/<symbol>/`

```python
class RealtimeTickerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        today = date.today()
        try:
            snap = SymbolSnapshot.objects.get(symbol=symbol, session_date=today)
        except SymbolSnapshot.DoesNotExist:
            return Response({'symbol': symbol, 'price': None, 'stale': True, 'source': 'no_data'})
        return Response({
            'symbol': snap.symbol,
            'price': str(snap.price),
            'price_change': str(snap.price_change),
            'price_change_pct': str(snap.price_change_pct),
            'volume': snap.volume,
            'market_status': snap.market_status,
            'stale': snap.stale,
            'source': snap.source,
            'fetched_at': snap.fetched_at.isoformat(),
        })
```

#### C2-V2: `RealtimeTickerListView` — `/api/realtime/tickers/`

```python
class RealtimeTickerListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        symbols_raw = request.query_params.get('symbols', '')
        if symbols_raw:
            symbols = [s.strip().upper() for s in symbols_raw.split(',') if s.strip()]
            qs = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        else:
            qs = SymbolSnapshot.objects.filter(session_date=today).order_by('symbol')[:100]
        return Response([{
            'symbol': s.symbol,
            'price': str(s.price),
            'price_change': str(s.price_change),
            'price_change_pct': str(s.price_change_pct),
            'volume': s.volume,
            'market_status': s.market_status,
            'stale': s.stale,
        } for s in qs])
```

#### C2-V3: `RealtimeIntradayView` — `/api/realtime/intraday/<symbol>/`

Data source: `IntradayBar` model (nếu có) hoặc bridge từ `SessionFacts`. Fallback: empty list nếu không có data.

```python
class RealtimeIntradayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Lấy intraday bars từ market_serving
        from market_serving.models import IntradayBar  # nếu model tồn tại
        today = date.today()
        bars = IntradayBar.objects.filter(symbol=symbol, bar_date=today).order_by('bar_time')
        if bars.exists():
            return Response({
                'symbol': symbol,
                'bars': [{'time': b.bar_time.isoformat(), 'open': str(b.open), 'high': str(b.high),
                          'low': str(b.low), 'close': str(b.close), 'volume': b.volume} for b in bars]
            })
        # Fallback: trả empty với stale flag
        return Response({'symbol': symbol, 'bars': [], 'stale': True})
```

> **Note**: Nếu `IntradayBar` model chưa tồn tại trong `market_serving/models.py`, kiểm tra trước. Nếu không có, trả `{'symbol': symbol, 'bars': [], 'note': 'intraday_not_available_in_native'}`.

#### C2-V4: `RealtimePriceBoardView` — `/api/realtime/price-board/<symbol>/`

```python
class RealtimePriceBoardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        today = date.today()
        snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
        if not snap:
            return Response({'symbol': symbol, 'data': None, 'stale': True})
        return Response({
            'symbol': snap.symbol,
            'price': str(snap.price),
            'price_change': str(snap.price_change),
            'price_change_pct': str(snap.price_change_pct),
            'volume': snap.volume,
            'market_status': snap.market_status,
            'stale': snap.stale,
            'fetched_at': snap.fetched_at.isoformat(),
        })
```

#### C2-V5: `RealtimeBreadthView` — `/api/realtime/breadth/<symbol>/`

Market breadth là aggregate data. Nếu chưa có native computation:

```python
class RealtimeBreadthView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # Aggregate: tính advancing/declining từ SymbolSnapshot hiện tại
        today = date.today()
        total = SymbolSnapshot.objects.filter(session_date=today).count()
        advancing = SymbolSnapshot.objects.filter(session_date=today, price_change__gt=0).count()
        declining = SymbolSnapshot.objects.filter(session_date=today, price_change__lt=0).count()
        return Response({
            'symbol': symbol,
            'total': total,
            'advancing': advancing,
            'declining': declining,
            'unchanged': total - advancing - declining,
        })
```

#### C2-V6: `RealtimeWhaleFeedView` — `/api/realtime/whale-feed/<symbol>/`

Native `RealtimeUnifiedAlertsView` đã xử lý unified alerts. Whale feed per symbol có thể delegate:

```python
class RealtimeWhaleFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Dùng UnifiedAlert model (đã native từ B3)
        from market_serving.models import UnifiedAlert
        limit = int(request.query_params.get('limit', 50))
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-created_at')[:limit]
        return Response({
            'symbol': symbol,
            'alerts': [{'id': a.id, 'alert_type': a.alert_type, 'value': str(a.value or ''),
                        'created_at': a.created_at.isoformat()} for a in alerts]
        })
```

#### C2-V7: `RealtimeSymbolInvestigationView` — `/api/realtime/symbol-investigation/<symbol>/`

```python
class RealtimeSymbolInvestigationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        from market_data.models import StockProfile, DailyPrice
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            return Response({'symbol': symbol, 'found': False})
        snap = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-fetched_at').first()
        return Response({
            'symbol': symbol,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'price': str(snap.price) if snap else None,
            'stale': snap.stale if snap else True,
        })
```

#### C2-V8: `RealtimeRvolView` — `/api/realtime/rvol/<symbol>/`

RVOL = Relative Volume = today_volume / avg_volume_N_days.

```python
class RealtimeRvolView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        from market_data.models import DailyPrice
        from django.db.models import Avg
        today = date.today()
        snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
        today_vol = snap.volume if snap else 0
        avg_vol = DailyPrice.objects.filter(symbol=symbol).order_by('-date')[:20].aggregate(
            avg=Avg('volume'))['avg'] or 1
        rvol = round(today_vol / avg_vol, 2) if avg_vol else 0
        return Response({'symbol': symbol, 'rvol': rvol, 'today_volume': today_vol, 'avg_volume_20d': round(avg_vol, 0)})
```

#### C2-V9: `RealtimeDepthChartView` — `/api/realtime/depth-chart/<symbol>/`

Depth chart (order book) cần dữ liệu realtime. Nếu chưa có native:

```python
class RealtimeDepthChartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Trả empty depth nếu chưa có native order book
        return Response({'symbol': symbol, 'bids': [], 'asks': [], 'note': 'depth_not_available_in_native'})
```

### 2.3 URL wiring

**File**: `packages/core/backend/src/market_serving/api_urls.py`

Thay tất cả `RealtimeLegacyBridgeView.as_view()` bằng native views tương ứng:

```python
from .views import (  # hoặc native_views
    RealtimeTickerView, RealtimeTickerListView, RealtimeIntradayView,
    RealtimePriceBoardView, RealtimeBreadthView, RealtimeWhaleFeedView,
    RealtimeSymbolInvestigationView, RealtimeRvolView, RealtimeDepthChartView,
)

urlpatterns = [
    path('realtime/ticker/<str:symbol>/', RealtimeTickerView.as_view(), name='realtime-ticker'),
    path('realtime/tickers/', RealtimeTickerListView.as_view(), name='realtime-tickers'),
    path('realtime/intraday/<str:symbol>/', RealtimeIntradayView.as_view(), name='realtime-intraday'),
    path('realtime/price-board/<str:symbol>/', RealtimePriceBoardView.as_view(), name='realtime-price-board'),
    path('realtime/breadth/<str:symbol>/', RealtimeBreadthView.as_view(), name='realtime-breadth'),
    path('realtime/whale-feed/<str:symbol>/', RealtimeWhaleFeedView.as_view(), name='realtime-whale-feed'),
    path('realtime/symbol-investigation/<str:symbol>/', RealtimeSymbolInvestigationView.as_view(), name='realtime-symbol-investigation'),
    path('realtime/rvol/<str:symbol>/', RealtimeRvolView.as_view(), name='realtime-rvol'),
    path('realtime/depth-chart/<str:symbol>/', RealtimeDepthChartView.as_view(), name='realtime-depth-chart'),
    # KEEP — already native:
    # path('realtime/unified-alerts/', RealtimeUnifiedAlertsView.as_view(), ...),
    # path('realtime/whale-feed-aggregate/', RealtimeWhaleFeedAggregateView.as_view(), ...),
    # path('realtime/whale-campaigns/', RealtimeWhaleCampaignsView.as_view(), ...),
]
```

---

## 3. C3 — 11 stock-management bridge routes → native views

### 3.1 Current state

11 routes trong `market_data/public_urls.py` trỏ về `StockManagementLegacyBridgeView`.

### 3.2 Target: Native views

**File**: `packages/core/backend/src/market_data/views.py` (thêm vào file hiện tại)

#### C3-V1: `StockManagementTechnicalsView` — `/api/stock-management/technicals/bulk/`

```python
class StockManagementTechnicalsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        symbols_raw = request.query_params.get('symbols', '')
        if not symbols_raw:
            return Response({'results': []})
        symbols = [s.strip().upper() for s in symbols_raw.split(',') if s.strip()]
        today = date.today()
        from market_serving.models import SymbolSnapshot
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        snap_map = {s.symbol: s for s in snaps}
        results = []
        for sym in symbols:
            snap = snap_map.get(sym)
            results.append({
                'symbol': sym,
                'price': str(snap.price) if snap else None,
                'price_change_pct': str(snap.price_change_pct) if snap else None,
                'volume': snap.volume if snap else None,
                'stale': snap.stale if snap else True,
            })
        return Response({'results': results})
```

#### C3-V2: `StockManagementDetailView` — `/api/stock-management/stocks/<symbol>/`

Delegate đến `StockProfileDetailView` đã có:

```python
class StockManagementDetailView(StockProfileDetailView):
    """Compat alias cho legacy /stock-management/stocks/<symbol>/ route."""
    pass
```

#### C3-V3: `StockManagementOverviewView` — `/api/stock-management/stocks/<symbol>/overview/`

```python
class StockManagementOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock not found: {symbol}')
        from market_serving.models import SymbolSnapshot
        snap = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-fetched_at').first()
        return Response({
            'symbol': symbol,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'outstanding_shares': profile.outstanding_shares,
            'price': str(snap.price) if snap else None,
            'volume': snap.volume if snap else None,
            'stale': snap.stale if snap else True,
        })
```

#### C3-V4: `StockManagementChartView` — `/api/stock-management/stocks/<symbol>/chart/`

Delegate đến `DailyPriceListView` đã có:

```python
class StockManagementChartView(DailyPriceListView):
    """Compat alias: /stock-management/stocks/<symbol>/chart/ → daily prices."""
    pass
```

#### C3-V5: `StockManagementOrderFlowView` — `/api/stock-management/stocks/<symbol>/order-flow/`

```python
class StockManagementOrderFlowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Order flow data từ UnifiedAlert / whale feed
        from market_serving.models import UnifiedAlert
        limit = int(request.query_params.get('limit', 100))
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-created_at')[:limit]
        return Response({
            'symbol': symbol,
            'order_flow': [{'id': a.id, 'type': a.alert_type, 'value': str(a.value or ''),
                            'created_at': a.created_at.isoformat()} for a in alerts]
        })
```

#### C3-V6: `StockManagementNewsView` — `/api/stock-management/stocks/<symbol>/news/`

```python
class StockManagementNewsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        # Nếu có news model trong core, dùng nó. Không có → empty list
        return Response({'symbol': symbol, 'news': [], 'note': 'news_not_available_in_native'})
```

#### C3-V7: `StockManagementNewsAISummaryView` — `/api/stock-management/stocks/<symbol>/news/ai-summary/`

```python
class StockManagementNewsAISummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'summary': None, 'note': 'ai_summary_not_available_in_native'})
```

#### C3-V8–V10: AI Advisory routes

Delegate đến `advisory` domain views đã native (B5):

**`/api/stock-management/stocks/<symbol>/ai-advisory-session/`** → đã xử lý bởi `advisory/views.py`.

Kiểm tra `/api/stock-management/stocks/<symbol>/ai-advisory-session/` URL mapping — có thể đã trỏ đúng. Nếu chưa, tạo compat:

```python
from advisory.views import AdvisoryLatestView, AdvisoryRefreshView

class StockManagementAIAdvisorySessionView(AdvisoryLatestView):
    """Compat alias: /stock-management/stocks/<symbol>/ai-advisory-session/ → advisory latest."""
    pass
```

#### C3-V11: `StockManagementAIAdvisorySummaryRegenerateView`

```python
class StockManagementAIAdvisorySummaryRegenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        # Delegate sang AdvisoryRefreshView logic
        from advisory.views import AdvisoryRefreshView
        # Reuse advisory refresh
        view = AdvisoryRefreshView.as_view()
        return view(request, symbol=symbol.upper())
```

### 3.3 URL wiring

**File**: `packages/core/backend/src/market_data/public_urls.py`

Thay tất cả `StockManagementLegacyBridgeView.as_view()` bằng native views.

---

## 4. C4 — Portfolio analytics native computation

### 4.1 Current state

`user_workspace/legacy_views.py` có `PortfolioAnalyticsStubView` trả empty data.

### 4.2 Target: Real computation từ `Transaction` + `SymbolSnapshot`

**File**: `packages/core/backend/src/user_workspace/views.py` (thêm native views) hoặc replace stubs trong `legacy_views.py`

#### C4-V1: Holdings

```python
class PortfolioHoldingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id=None):
        from django.db.models import Sum, F, ExpressionWrapper, DecimalField
        from market_serving.models import SymbolSnapshot
        import datetime

        # Lấy danh mục của user
        if portfolio_id:
            portfolios = Portfolio.objects.filter(id=portfolio_id, user=request.user)
        else:
            portfolios = Portfolio.objects.filter(user=request.user)

        portfolio = portfolios.first()
        if not portfolio:
            return Response([])

        # Aggregate transactions → holdings
        holdings_qs = (
            Transaction.objects.filter(portfolio=portfolio)
            .values('symbol')
            .annotate(
                total_buy_qty=Sum('quantity', filter=models.Q(transaction_type='BUY')),
                total_sell_qty=Sum('quantity', filter=models.Q(transaction_type='SELL')),
            )
        )

        today = datetime.date.today()
        snap_map = {
            s.symbol: s
            for s in SymbolSnapshot.objects.filter(
                symbol__in=[h['symbol'] for h in holdings_qs],
                session_date=today,
            )
        }

        results = []
        for h in holdings_qs:
            net_qty = (h['total_buy_qty'] or 0) - (h['total_sell_qty'] or 0)
            if net_qty <= 0:
                continue
            snap = snap_map.get(h['symbol'])
            current_price = float(snap.price) if snap else 0

            # Tính avg cost
            buys = Transaction.objects.filter(
                portfolio=portfolio, symbol=h['symbol'], transaction_type='BUY'
            ).aggregate(
                total_cost=Sum(ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField())),
                total_qty=Sum('quantity'),
            )
            avg_cost = float(buys['total_cost'] or 0) / float(buys['total_qty'] or 1)
            unrealized_pnl = (current_price - avg_cost) * net_qty
            unrealized_pnl_pct = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0

            results.append({
                'symbol': h['symbol'],
                'quantity': net_qty,
                'avg_cost': round(avg_cost, 2),
                'current_price': current_price,
                'market_value': round(current_price * net_qty, 0),
                'unrealized_pnl': round(unrealized_pnl, 0),
                'unrealized_pnl_pct': round(unrealized_pnl_pct, 2),
            })

        return Response(results)
```

#### C4-V2: Portfolio Summary

```python
class PortfolioSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolio = Portfolio.objects.filter(user=request.user, is_default=True).first()
        if not portfolio:
            portfolio = Portfolio.objects.filter(user=request.user).first()
        if not portfolio:
            return Response({'total_value': 0, 'total_cost': 0, 'total_pnl': 0, 'portfolio_count': 0})

        # Reuse holdings logic for summary aggregation
        holdings_view = PortfolioHoldingsView()
        holdings_response = holdings_view.get(request)
        holdings = holdings_response.data

        total_value = sum(h['market_value'] for h in holdings)
        total_pnl = sum(h['unrealized_pnl'] for h in holdings)
        total_cost = total_value - total_pnl

        return Response({
            'total_value': round(total_value, 0),
            'total_cost': round(total_cost, 0),
            'total_pnl': round(total_pnl, 0),
            'total_pnl_pct': round(total_pnl / total_cost * 100, 2) if total_cost else 0,
            'portfolio_name': portfolio.name,
        })
```

#### C4-V3: Equity Curve

```python
class PortfolioEquityCurveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from market_data.models import DailyPrice
        portfolio = Portfolio.objects.filter(user=request.user).first()
        if not portfolio:
            return Response({'dates': [], 'values': []})

        # Lấy tất cả transactions
        transactions = Transaction.objects.filter(portfolio=portfolio).order_by('date')
        if not transactions.exists():
            return Response({'dates': [], 'values': []})

        # Tính holdings tích lũy theo ngày
        start_date = transactions.first().date
        today = date.today()

        # Lấy daily prices cho tất cả symbols đã giao dịch
        symbols = list(transactions.values_list('symbol', flat=True).distinct())
        price_data = {}
        for sym in symbols:
            prices = DailyPrice.objects.filter(symbol=sym, date__gte=start_date).order_by('date')
            price_data[sym] = {p.date: float(p.close) for p in prices}

        # Daily equity curve calculation
        dates = []
        values = []
        from datetime import timedelta
        current_date = start_date
        holdings = {}  # symbol → {qty, avg_cost}

        while current_date <= today:
            # Apply transactions on this date
            day_txns = transactions.filter(date=current_date)
            for txn in day_txns:
                sym = txn.symbol
                if sym not in holdings:
                    holdings[sym] = {'qty': 0, 'avg_cost': 0}
                if txn.transaction_type == 'BUY':
                    old_qty = holdings[sym]['qty']
                    old_cost = holdings[sym]['avg_cost']
                    new_qty = old_qty + txn.quantity
                    holdings[sym]['avg_cost'] = (old_qty * old_cost + txn.quantity * float(txn.price)) / new_qty
                    holdings[sym]['qty'] = new_qty
                elif txn.transaction_type == 'SELL':
                    holdings[sym]['qty'] = max(0, holdings[sym]['qty'] - txn.quantity)

            # Compute portfolio value on this date
            total = 0
            for sym, h in holdings.items():
                if h['qty'] > 0:
                    price = price_data.get(sym, {}).get(current_date)
                    if price:
                        total += price * h['qty']

            if total > 0:
                dates.append(current_date.isoformat())
                values.append(round(total, 0))

            current_date += timedelta(days=1)

        return Response({'dates': dates, 'values': values})
```

### 4.3 Import references

```python
# Tất cả cần:
import datetime
from datetime import date
from django.db import models
from django.db.models import Sum, ExpressionWrapper, DecimalField, F
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Portfolio, Transaction
```

---

## 5. C5 — Auth email verify native

### 5.1 Current state

Verify email flow đang bridge về legacy. `identity_access/views_auth.py` cần thêm `VerifyEmailView`.

### 5.2 Target

**File**: `packages/core/backend/src/identity_access/views_auth.py`

```python
class VerifyEmailView(APIView):
    """
    POST /api/auth/verify/ — xác thực email token từ verification email.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'token_required'}, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra token trong EmailVerificationToken model
        from .models import EmailVerificationToken
        try:
            vt = EmailVerificationToken.objects.get(token=token, used=False)
        except EmailVerificationToken.DoesNotExist:
            return Response({'error': 'invalid_or_expired_token'}, status=status.HTTP_400_BAD_REQUEST)

        if vt.is_expired():
            return Response({'error': 'token_expired'}, status=status.HTTP_400_BAD_REQUEST)

        # Activate user
        user = vt.user
        user.is_active = True
        user.save(update_fields=['is_active'])
        vt.used = True
        vt.save(update_fields=['used'])

        return Response({'status': 'email_verified', 'username': user.username})
```

> **Note**: Nếu `EmailVerificationToken` model chưa tồn tại, implement model đơn giản với fields: `user`, `token` (UUID), `created_at`, `used`, `expires_at`. Add migration.

---

## 6. C6 — Misc graceful stubs

### 6.1 SubAccount → `[]`

**File**: `packages/core/backend/src/user_workspace/legacy_views.py` hoặc `views.py`

```python
class SubAccountListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # SubAccount feature không có trong core — trả empty list per INV-06
        return Response([])
```

URL: `/api/account/sub-accounts/` → `SubAccountListView`

### 6.2 Telegram Status → `not_available`

```python
class TelegramStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'status': 'not_available'})
```

URL: `/api/telegram/status/` → `TelegramStatusView`

### 6.3 Watchlist sync trigger

Khi user update watchlist, trigger `sync_market_groups` task để ingest symbols mới:

```python
# Trong WatchlistItemCreateView (hoặc tương đương) sau khi save:
from data_ingest.tasks import sync_market_groups
sync_market_groups.apply_async(queue='realtime_prefetch')
```

---

## 7. C7 — Decommission

### 7.1 Pre-decommission gates (phải PASS hết)

| Gate | Kiểm tra | Lệnh |
|------|---------|------|
| A | Không còn import `legacy_bridge_response` trong market_serving | `grep -rn "legacy_bridge_response" packages/core/backend/src/market_serving/` → 0 |
| B | Không còn import `legacy_bridge_response` trong market_data | `grep -rn "legacy_bridge_response" packages/core/backend/src/market_data/` → 0 |
| C | Không còn `RealtimeLegacyBridgeView` trong api_urls | `grep -n "LegacyBridge" packages/core/backend/src/market_serving/api_urls.py` → 0 |
| D | Không còn `StockManagementLegacyBridgeView` trong public_urls | `grep -n "LegacyBridge" packages/core/backend/src/market_data/public_urls.py` → 0 |
| E | C1+C2+C3+C4 evidence files tồn tại | `dir docs/evidence/CUT-C*` → 4+ files |
| F | SymbolSnapshot fresh (C1 đang chạy) | Django shell: `(now()-SymbolSnapshot.objects.order_by('-fetched_at').first().fetched_at).seconds < 90` → True |
| G | Smoke test với backend STOPPED pass | Xem C7.3 |

### 7.2 Xóa legacy_http_bridge.py

```powershell
Remove-Item packages/core/backend/src/vninvest_core/legacy_http_bridge.py
```

Sau đó verify:
```powershell
grep -rn "legacy_http_bridge" packages/core/backend/src/ | grep -v ".pyc"
# → 0 results (không còn import nào)
```

Nếu còn import trong `market_serving/legacy_views.py`:
- Xóa `from vninvest_core.legacy_http_bridge import legacy_bridge_response`
- Xóa class `RealtimeLegacyBridgeView` nếu không còn dùng
- Xóa class `StockManagementLegacyBridgeView` từ `user_workspace/legacy_views.py`

### 7.3 Smoke test với backend STOPPED

```powershell
# Stop legacy containers
docker compose -f docker-compose.dev.yml stop backend backend-worker

# Chờ 5s
Start-Sleep 5

# Smoke test
$token = "your_test_pat_token"
$headers = @{ "Authorization" = "Bearer $token" }

# Test C2 routes
Invoke-RestMethod "http://localhost/api/realtime/ticker/VCB/" -Headers $headers  # → 200
Invoke-RestMethod "http://localhost/api/realtime/tickers/?symbols=VCB,HPG" -Headers $headers  # → 200

# Test C3 routes
Invoke-RestMethod "http://localhost/api/stock-management/stocks/VCB/" -Headers $headers  # → 200

# Test C4 routes
Invoke-RestMethod "http://localhost/api/portfolio/holdings/" -Headers $headers  # → 200

# Verify không còn 502
# All requests above MUST NOT return 502
```

### 7.4 Stop legacy containers (sau gates PASS)

**File**: `docker-compose.dev.yml` — comment out hoặc remove services `backend` và `backend-worker`:

```yaml
# DECOMMISSIONED at C7 — 2026-05-13
# backend:
#   ...
# backend-worker:
#   ...
```

Sau đó rebuild:
```powershell
docker compose -f docker-compose.dev.yml up -d --build core-api core-beat
```

---

## 8. Settings invariants

Sau C7, `settings.py` PHẢI:
- Không còn reference `LEGACY_BACKEND_URL` (hoặc comment rõ "deprecated")
- Không còn reference `LEGACY_DATABASE_URL` trong compose files
- `CELERY_BEAT_SCHEDULE` phải có entry `ingest-price-board-60s`

---

*Đây là spec cuối — không cần hỏi lại. Implement theo đúng contract trên.*
