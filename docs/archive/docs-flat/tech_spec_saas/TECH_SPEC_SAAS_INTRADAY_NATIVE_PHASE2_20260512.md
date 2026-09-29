# TECH SPEC — Phase 2: Native Intraday API (vnbroker adapter + core DB)

**Ngày**: 2026-05-12 | **Status**: APPROVED FOR IMPLEMENTATION  
**Workstream**: SAAS-MIGRATION — Market Data Domain — Phase 2  
**Owner**: packages/core backend team

---

## 1. PHASE 1 → PHASE 2 TRANSITION

### Current state (Phase 1 — Bridge):
- ✅ `IntradayPricesView` + `IntradayTapeView` bridge to legacy endpoints
- ✅ Endpoints live and responding
- ✅ Frontend can call `/core/v1/market-data/intraday-*` 
- ✅ Graceful degradation when legacy unavailable

### Phase 2 Goal:
Replace bridge with **native vnbroker adapter** + **core DB** storage, keeping bridge as fallback.

---

## 2. ARCHITECTURE — SHADOW RUN PATTERN

```
Phase 2 views: IntradayPricesView + IntradayTapeView (modified from Phase 1)

GET /core/v1/market-data/intraday-prices/{symbol}/
    ↓
    Try native first (if data exists in core DB)
    ├─ Return native response
    └─ If no native data → Fall back to bridge
    
GET /core/v1/market-data/intraday-tape/{symbol}/
    ↓
    Try native first (if data exists in core DB)
    ├─ Return native response
    └─ If no native data → Fall back to bridge

Shadow run (optional post-Phase 2):
    Execute both paths, log parity_score, compare schemas
```

---

## 3. DATA MODELS (3 models, no inheritance)

### Model 1: `IntradayBar`

**Purpose**: OHLCV bars (intraday 1m/5m/15m/1H/etc)

```python
# packages/core/backend/src/market_data/models.py

class IntradayBar(models.Model):
    """
    Intraday OHLCV bar for a single symbol at a specific timeframe.
    
    PK: (symbol, timeframe, timestamp)
    Storage: 90 days rolling window (older data pruned)
    Source: vnbroker intraday API
    """
    symbol = models.CharField(max_length=10, db_index=True)  # e.g., VCB
    timeframe = models.CharField(
        max_length=2,
        choices=[
            ('1', '1 minute'),
            ('5', '5 minutes'),
            ('15', '15 minutes'),
            ('H', '1 hour'),
            ('D', '1 day'),
            ('W', '1 week'),
        ],
        default='H',
        db_index=True
    )
    timestamp = models.DateTimeField(db_index=True)  # UTC, e.g., 2026-05-12T09:00:00Z
    
    open = models.DecimalField(max_digits=18, decimal_places=2)  # Raw VND, e.g., 92500.00
    high = models.DecimalField(max_digits=18, decimal_places=2)
    low = models.DecimalField(max_digits=18, decimal_places=2)
    close = models.DecimalField(max_digits=18, decimal_places=2)
    volume = models.BigIntegerField()  # shares, e.g., 1250000
    
    source = models.CharField(max_length=20, default='vnbroker')  # 'vnbroker' | 'bridge'
    fetched_at = models.DateTimeField(auto_now_add=True)  # When record was inserted
    
    class Meta:
        indexes = [
            models.Index(fields=['symbol', 'timeframe', '-timestamp']),
            models.Index(fields=['symbol', '-timestamp']),
        ]
        verbose_name_plural = 'Intraday bars'
        constraints = [
            models.UniqueConstraint(
                fields=['symbol', 'timeframe', 'timestamp'],
                name='unique_symbol_timeframe_timestamp'
            ),
        ]
    
    def __str__(self):
        return f"{self.symbol} {self.timeframe} {self.timestamp}: {self.open}-{self.close}"
```

### Model 2: `IntradayTick`

**Purpose**: Individual trade ticks (tape)

```python
class IntradayTick(models.Model):
    """
    Intraday trade tick for a single symbol.
    
    PK: trade_id (from vnbroker)
    Storage: 7 days rolling window (older data pruned to IntradayTickArchive)
    Source: vnbroker streaming API
    """
    symbol = models.CharField(max_length=10, db_index=True)  # e.g., VCB
    trade_id = models.CharField(max_length=50, unique=True)  # e.g., "VCB-2026-05-12-001", unique across all symbols
    
    timestamp = models.DateTimeField(db_index=True)  # UTC, e.g., 2026-05-12T09:30:45.123Z
    price = models.DecimalField(max_digits=18, decimal_places=2)  # Raw VND, e.g., 92500.00
    volume = models.BigIntegerField()  # shares, e.g., 5000
    
    side = models.CharField(
        max_length=10,
        choices=[
            ('BUY', 'Buy'),
            ('SELL', 'Sell'),
            ('UNKNOWN', 'Unknown'),
        ],
        default='UNKNOWN',
        db_index=True
    )
    match_type = models.CharField(
        max_length=20,
        default='NORMAL',
        db_index=True
    )  # e.g., 'NORMAL', 'ATO', 'ATC'
    
    source = models.CharField(max_length=20, default='vnbroker')  # 'vnbroker' | 'bridge'
    fetched_at = models.DateTimeField(auto_now_add=True)  # When record was inserted
    
    class Meta:
        indexes = [
            models.Index(fields=['symbol', '-timestamp']),
            models.Index(fields=['-timestamp']),
        ]
        verbose_name_plural = 'Intraday ticks'
    
    def __str__(self):
        return f"{self.symbol} {self.timestamp}: {self.side} {self.volume}@{self.price}"
```

### Model 3: `IntradayDataMetadata`

**Purpose**: Track ingestion status per symbol/day

```python
class IntradayDataMetadata(models.Model):
    """
    Tracks last successful ingestion for each symbol.
    Prevents re-ingesting same day multiple times.
    """
    symbol = models.CharField(max_length=10, primary_key=True, db_index=True)
    
    last_bar_ingestion = models.DateTimeField(null=True, blank=True)  # UTC
    last_tick_ingestion = models.DateTimeField(null=True, blank=True)  # UTC
    
    bar_source = models.CharField(max_length=20, default='vnbroker')  # 'vnbroker' | 'bridge'
    tick_source = models.CharField(max_length=20, default='vnbroker')
    
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.symbol}: bars={self.last_bar_ingestion}, ticks={self.last_tick_ingestion}"
```

---

## 4. VNBROKER ADAPTER METHODS (add to market_data/vnbroker_adapter.py)

### New method 1: `fetch_intraday_bars(symbol, timeframe, days=30)`

```python
def fetch_intraday_bars(
    symbol: str,
    timeframe: str,
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Fetch intraday OHLCV bars from vnbroker.
    
    Args:
        symbol: Stock symbol (e.g., 'VCB')
        timeframe: '1', '5', '15', 'H', 'D', 'W'
        days: Number of days to fetch (default 30, max 180)
    
    Returns:
        List of dict: [
            {
                'timestamp': '2026-05-12T09:00:00Z',
                'open': Decimal('92500.00'),
                'high': Decimal('93200.00'),
                'low': Decimal('91800.00'),
                'close': Decimal('92900.00'),
                'volume': 1250000,
            },
            ...
        ]
    
    Raises:
        VnbrokerAPIError: If API call fails
        ValueError: If symbol invalid or timeframe unsupported
    """
    from vnbroker import Vnbroker
    from decimal import Decimal
    
    client = Vnbroker()
    try:
        # Mock for Phase 2a; replace with real API call in Phase 2b
        # Real: bars = client.get_intraday_bars(symbol, timeframe, days)
        bars = []  # TODO: Call vnbroker API
        
        # Transform to internal schema
        return [
            {
                'timestamp': bar.get('timestamp'),
                'open': Decimal(str(bar.get('open', 0))),
                'high': Decimal(str(bar.get('high', 0))),
                'low': Decimal(str(bar.get('low', 0))),
                'close': Decimal(str(bar.get('close', 0))),
                'volume': int(bar.get('volume', 0)),
            }
            for bar in bars
        ]
    except Exception as e:
        logger.error(f"fetch_intraday_bars failed for {symbol}: {e}")
        raise VnbrokerAPIError(f"Failed to fetch bars for {symbol}: {e}")
```

### New method 2: `fetch_intraday_ticks(symbol, limit=100)`

```python
def fetch_intraday_ticks(
    symbol: str,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Fetch intraday trade ticks from vnbroker.
    
    Args:
        symbol: Stock symbol (e.g., 'VCB')
        limit: Max ticks to fetch (default 100, max 500)
    
    Returns:
        List of dict: [
            {
                'trade_id': 'VCB-2026-05-12-001',
                'timestamp': '2026-05-12T09:30:45.123Z',
                'price': Decimal('92500.00'),
                'volume': 5000,
                'side': 'BUY',
                'match_type': 'NORMAL',
            },
            ...
        ]
    
    Raises:
        VnbrokerAPIError: If API call fails
    """
    from vnbroker import Vnbroker
    from decimal import Decimal
    
    client = Vnbroker()
    try:
        # Mock for Phase 2a; replace with real API call in Phase 2b
        # Real: ticks = client.get_intraday_ticks(symbol, limit)
        ticks = []  # TODO: Call vnbroker API
        
        # Transform to internal schema
        return [
            {
                'trade_id': tick.get('id'),
                'timestamp': tick.get('timestamp'),
                'price': Decimal(str(tick.get('price', 0))),
                'volume': int(tick.get('volume', 0)),
                'side': tick.get('side', 'UNKNOWN').upper(),
                'match_type': tick.get('match_type', 'NORMAL').upper(),
            }
            for tick in ticks
        ]
    except Exception as e:
        logger.error(f"fetch_intraday_ticks failed for {symbol}: {e}")
        raise VnbrokerAPIError(f"Failed to fetch ticks for {symbol}: {e}")
```

---

## 5. VIEW UPDATES (modified Phase 1 views)

### `IntradayPricesView` — Modified for Phase 2

```python
class IntradayPricesView(APIView):
    """
    Phase 2: Native-first, bridge fallback.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        timeframe = request.query_params.get('timeframe', '1H')
        days = request.query_params.get('days', '30')
        
        try:
            days = min(int(days), 180)  # Cap at 180
        except (ValueError, TypeError):
            days = 30
        
        # Try native first
        native_data = self._get_native_bars(symbol, timeframe, days)
        if native_data and len(native_data.get('points', [])) > 0:
            return Response(native_data)
        
        # Fall back to bridge
        bridged = legacy_bridge_response(
            request,
            f'/api/stock-management/stocks/{symbol}/chart/',
            unavailable_message='Legacy intraday chart bridge hiện không khả dụng.',
        )
        if bridged is not None and bridged.status_code < 500:
            return bridged
        
        # Graceful degradation
        return Response({
            'symbol': symbol,
            'days': 0,
            'timeframe': timeframe,
            'interval': 'n/a',
            'points': [],
            'technical': {},
            'source': 'bridge_unavailable',
        })

    def _get_native_bars(self, symbol, timeframe, days):
        """Query native IntradayBar table."""
        from django.utils import timezone
        from datetime import timedelta
        from .models import IntradayBar
        from .serializers import IntradayBarSerializer
        
        now = timezone.now()
        start_date = now - timedelta(days=days)
        
        try:
            bars = IntradayBar.objects.filter(
                symbol=symbol,
                timeframe=timeframe,
                timestamp__gte=start_date,
                timestamp__lte=now,
            ).order_by('timestamp')
            
            if not bars.exists():
                return None
            
            serializer = IntradayBarSerializer(bars, many=True)
            return {
                'symbol': symbol,
                'days': days,
                'timeframe': timeframe,
                'interval': timeframe,
                'points': serializer.data,
                'technical': {},
                'source': 'native',
            }
        except Exception as e:
            logger.warning(f"_get_native_bars failed for {symbol}: {e}")
            return None
```

### `IntradayTapeView` — Modified for Phase 2

```python
class IntradayTapeView(APIView):
    """
    Phase 2: Native-first, bridge fallback.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        page_size = request.query_params.get('page_size', '50')
        
        try:
            page_size = min(int(page_size), 500)
        except (ValueError, TypeError):
            page_size = 50
        
        # Try native first
        native_data = self._get_native_ticks(symbol, page_size)
        if native_data and len(native_data.get('trades', [])) > 0:
            return Response(native_data)
        
        # Fall back to bridge
        bridged = legacy_bridge_response(
            request,
            f'/api/realtime/intraday/{symbol}/',
            unavailable_message='Legacy intraday tape bridge hiện không khả dụng.',
        )
        if bridged is not None and bridged.status_code < 500:
            return bridged
        
        # Graceful degradation
        return Response({
            'symbol': symbol,
            'trades': [],
            'total': 0,
            'source': 'bridge_unavailable',
            'stale': True,
            'fetched_at': None,
        })

    def _get_native_ticks(self, symbol, page_size):
        """Query native IntradayTick table."""
        from .models import IntradayTick
        from .serializers import IntradayTickSerializer
        
        try:
            ticks = IntradayTick.objects.filter(
                symbol=symbol
            ).order_by('-timestamp')[:page_size]
            
            if not ticks.exists():
                return None
            
            serializer = IntradayTickSerializer(ticks, many=True)
            return {
                'symbol': symbol,
                'trades': serializer.data,
                'total': ticks.count(),
                'source': 'native',
                'stale': False,
                'fetched_at': timezone.now().isoformat(),
            }
        except Exception as e:
            logger.warning(f"_get_native_ticks failed for {symbol}: {e}")
            return None
```

---

## 6. SERIALIZERS (new)

### Add to `market_data/serializers.py`

```python
class IntradayBarSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntradayBar
        fields = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
        read_only_fields = fields

class IntradayTickSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntradayTick
        fields = ['timestamp', 'price', 'volume', 'side', 'match_type']
        read_only_fields = fields
```

---

## 7. MIGRATIONS

**Must be created**:
- `market_data/migrations/0002_intradaybar.py` — IntradayBar model
- `market_data/migrations/0003_intradaytick.py` — IntradayTick model
- `market_data/migrations/0004_intradaydatametadata.py` — Metadata model

**Commands**:
```bash
cd packages/core/backend
python manage.py makemigrations market_data
python manage.py migrate market_data
```

---

## 8. TESTS (extend test_market_data_api_routes.py)

### New test class: `IntradayNativeDataTests`

```python
class IntradayNativeDataTests(TestCase):
    """Tests for native intraday data queries."""
    
    def setUp(self):
        self.symbol = 'VCB'
        self.user = User.objects.create_user(username='native-tester', password='test123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_intraday_prices_returns_native_when_available(self):
        # Insert test bar
        IntradayBar.objects.create(
            symbol=self.symbol,
            timeframe='1H',
            timestamp=timezone.now(),
            open=Decimal('92500.00'),
            high=Decimal('93200.00'),
            low=Decimal('91800.00'),
            close=Decimal('92900.00'),
            volume=1250000,
        )
        
        resp = self.client.get(f'/api/market-data/intraday-prices/{self.symbol}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['source'], 'native')
        self.assertEqual(len(data['points']), 1)
    
    def test_intraday_tape_returns_native_when_available(self):
        # Insert test tick
        IntradayTick.objects.create(
            symbol=self.symbol,
            trade_id=f'{self.symbol}-2026-05-12-001',
            timestamp=timezone.now(),
            price=Decimal('92500.00'),
            volume=5000,
            side='BUY',
        )
        
        resp = self.client.get(f'/api/market-data/intraday-tape/{self.symbol}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['source'], 'native')
        self.assertEqual(len(data['trades']), 1)
```

---

## 9. OUT OF SCOPE

| Item | Reason |
|------|--------|
| Backfill historical intraday data | Separate data pipeline task |
| Real vnbroker API integration | Phase 2b (after testing with mocks) |
| Shadow run comparison logging | Phase 2.5 (optional, after both paths stable) |
| Retention/purge policies | Phase 2.5 (7-day rolling for ticks, 90-day for bars) |
| Real-time streaming ingest | Phase 3 (WebSocket/Celery task) |

---

## 10. ROLLBACK SAFETY

If models/migrations cause issues:
```bash
python manage.py migrate market_data 0001  # Revert to Phase 1
git revert HEAD~N  # Revert commits
```

Models are **additive only** — no breaking changes to Phase 1.
