# TECH SPEC: Market Data Service Unification (MDSU)

**Ngày tạo**: 2026-04-21  
**Phạm vi chương trình**: MDSU — Market Data Service Unification  
**Trạng thái**: DRAFT — kèm theo Implementation Plan

---

## 1. Module Location

```
backend/portfolio/market_data_service.py
```

File này **đã tồn tại** với logic `UnifiedAlerts`. Class `MarketDataService` sẽ được **thêm vào** file này mà không xóa code cũ.

---

## 2. Class Design — MarketDataService

```python
import logging
from datetime import date, timedelta
from typing import Optional

from django.db.models import Max
from django.core.cache import cache

from .models import DailyPrice

logger = logging.getLogger(__name__)

_MDSU_CACHE_VERSION = "v1"
_LATEST_TTL = 300        # 5 phút — đủ fresh cho API requests
_HISTORY_TTL = 3600      # 1 giờ — dữ liệu lịch sử ổn định sau close


class MarketDataService:
    """
    Single Source of Truth cho mọi truy vấn DailyPrice trong business modules.
    Không instantiate — dùng classmethod trực tiếp.
    
    Quy tắc canonical:
    - "latest" = Max(date) per symbol trong DB.
    - "reference" = close_price của latest date đó.
    - Trading date là naive date (Asia/Ho_Chi_Minh, không lưu tz trong model).
    - Missing candle: bỏ qua, không fill NaN.
    - Adjusted/unadjusted: dùng close_price trong DailyPrice (unadjusted).
    """

    # ------------------------------------------------------------------ #
    #  PUBLIC API                                                          #
    # ------------------------------------------------------------------ #

    @classmethod
    def get_latest_snapshot(
        cls,
        symbols: list[str],
        _local_cache: Optional[dict] = None,
    ) -> dict[str, dict]:
        """
        Trả về snapshot giá mới nhất cho danh sách symbols.

        Args:
            symbols: Danh sách mã (uppercase, e.g. ['VNM', 'VCB']).
            _local_cache: Dict dùng làm local context cache cho batch jobs.
                          Nếu không truyền, dùng Redis only.

        Returns:
            {
              'VNM': {
                'close_price': 85000,
                'open_price': 84000,
                'high_price': 86000,
                'low_price': 83500,
                'volume': 1200000,
                'date': date(2026, 4, 21),
              },
              ...
            }
            Symbol không tồn tại trong DB: không có key trong kết quả.
        """
        if not symbols:
            return {}

        symbols = [s.upper() for s in symbols]
        result = {}
        missing = []

        # 1. Local context cache
        if _local_cache is not None:
            for sym in symbols:
                key = f"latest:{sym}"
                if key in _local_cache:
                    result[sym] = _local_cache[key]
                else:
                    missing.append(sym)
        else:
            missing = list(symbols)

        # 2. Redis cache
        redis_missing = []
        for sym in missing:
            rkey = cls._redis_key("latest", sym)
            cached = cache.get(rkey)
            if cached is not None:
                result[sym] = cached
                if _local_cache is not None:
                    _local_cache[f"latest:{sym}"] = cached
            else:
                redis_missing.append(sym)

        if not redis_missing:
            cls._log("get_latest_snapshot", len(symbols), len(symbols) - len(redis_missing), 0)
            return result

        # 3. DB Query — một bulk query duy nhất
        latest_dates = (
            DailyPrice.objects
            .filter(symbol__in=redis_missing)
            .values('symbol')
            .annotate(latest_date=Max('date'))
        )
        date_map = {row['symbol']: row['latest_date'] for row in latest_dates}

        if not date_map:
            cls._log("get_latest_snapshot", len(symbols), len(result), 1)
            return result

        # Một query nữa để lấy rows với date đã biết
        from django.db.models import Q
        q = Q()
        for sym, d in date_map.items():
            q |= Q(symbol=sym, date=d)

        rows = DailyPrice.objects.filter(q).values(
            'symbol', 'date', 'close_price', 'open_price',
            'high_price', 'low_price', 'volume',
        )
        for row in rows:
            data = {
                'close_price': row['close_price'],
                'open_price': row.get('open_price'),
                'high_price': row.get('high_price'),
                'low_price': row.get('low_price'),
                'volume': row.get('volume'),
                'date': row['date'],
            }
            sym = row['symbol']
            result[sym] = data
            cache.set(cls._redis_key("latest", sym), data, _LATEST_TTL)
            if _local_cache is not None:
                _local_cache[f"latest:{sym}"] = data

        cls._log("get_latest_snapshot", len(symbols), len(result), 2)
        return result

    @classmethod
    def get_ohlcv_batch(
        cls,
        symbols: list[str],
        start_date: date,
        end_date: date,
        fields: Optional[list[str]] = None,
        _local_cache: Optional[dict] = None,
    ) -> dict[str, list[dict]]:
        """
        Trả về OHLCV lịch sử theo khoảng ngày cho nhiều symbols.

        Args:
            symbols: Danh sách mã (uppercase).
            start_date: Ngày bắt đầu (inclusive).
            end_date: Ngày kết thúc (inclusive).
            fields: Các field cần lấy. Default: ['date','close_price','volume'].
            _local_cache: Local context cache cho batch jobs.

        Returns:
            {
              'VNM': [
                {'date': date(2026,4,1), 'close_price': 84000, 'volume': 1100000},
                ...
              ],
              ...
            }
            Sorted by date ASC. Missing candle = bỏ qua.
        """
        if not symbols:
            return {}

        symbols = [s.upper() for s in symbols]
        _fields = fields or ['date', 'close_price', 'volume']

        # Cache key bao gồm range → dùng cho trường hợp start/end cố định
        cache_key_base = f"{start_date.isoformat()}_{end_date.isoformat()}"
        result = {}
        missing = []

        if _local_cache is not None:
            for sym in symbols:
                key = f"ohlcv:{sym}:{cache_key_base}"
                if key in _local_cache:
                    result[sym] = _local_cache[key]
                else:
                    missing.append(sym)
        else:
            missing = list(symbols)

        redis_missing = []
        for sym in missing:
            rkey = cls._redis_key(f"ohlcv:{cache_key_base}", sym)
            cached = cache.get(rkey)
            if cached is not None:
                result[sym] = cached
                if _local_cache is not None:
                    _local_cache[f"ohlcv:{sym}:{cache_key_base}"] = cached
            else:
                redis_missing.append(sym)

        if not redis_missing:
            return result

        # DB Query — một bulk query
        rows = (
            DailyPrice.objects
            .filter(symbol__in=redis_missing, date__gte=start_date, date__lte=end_date)
            .order_by('symbol', 'date')
            .values('symbol', *_fields)
        )

        grouped: dict[str, list] = {sym: [] for sym in redis_missing}
        for row in rows:
            sym = row['symbol']
            entry = {f: row[f] for f in _fields}
            grouped[sym].append(entry)

        for sym, data in grouped.items():
            result[sym] = data
            rkey = cls._redis_key(f"ohlcv:{cache_key_base}", sym)
            cache.set(rkey, data, _HISTORY_TTL)
            if _local_cache is not None:
                _local_cache[f"ohlcv:{sym}:{cache_key_base}"] = data

        return result

    @classmethod
    def get_historical_indicators(
        cls,
        symbols: list[str],
        lookback_days: int,
        include_fields: Optional[list[str]] = None,
        _local_cache: Optional[dict] = None,
    ) -> dict[str, list[dict]]:
        """
        Trả về lịch sử gần nhất (lookback_days phiên giao dịch) cho tính toán indicator.

        Args:
            symbols: Danh sách mã (uppercase).
            lookback_days: Số phiên giao dịch gần nhất cần lấy.
            include_fields: Default ['date','close_price','volume'].
            _local_cache: Local context cache cho batch jobs.

        Returns:
            {
              'VNM': [
                {'date': date(...), 'close_price': 85000, 'volume': 1200000},
                ...
              ],
              ...  # sorted ASC, tối đa lookback_days rows
            }
        
        Note: Canonical lookback = tính từ trading date mới nhất trong DB,
              không phải từ today() — để tránh lệch khi chạy backfill lịch sử.
        """
        if not symbols:
            return {}

        symbols = [s.upper() for s in symbols]
        _fields = include_fields or ['date', 'close_price', 'volume']
        result = {}
        missing = []

        if _local_cache is not None:
            for sym in symbols:
                key = f"hist:{sym}:{lookback_days}"
                if key in _local_cache:
                    result[sym] = _local_cache[key]
                else:
                    missing.append(sym)
        else:
            missing = list(symbols)

        redis_missing = []
        for sym in missing:
            rkey = cls._redis_key(f"hist:{lookback_days}", sym)
            cached = cache.get(rkey)
            if cached is not None:
                result[sym] = cached
                if _local_cache is not None:
                    _local_cache[f"hist:{sym}:{lookback_days}"] = cached
            else:
                redis_missing.append(sym)

        if not redis_missing:
            return result

        # Lấy latest date per symbol để xác định window canonical
        latest_dates = (
            DailyPrice.objects
            .filter(symbol__in=redis_missing)
            .values('symbol')
            .annotate(latest_date=Max('date'))
        )
        date_map = {row['symbol']: row['latest_date'] for row in latest_dates}

        # Một query bulk cho tất cả symbols × window
        from django.db.models import Q
        q = Q()
        for sym, latest in date_map.items():
            # Ước tính start_date: lookback_days * 1.5 để đảm bảo đủ trading days
            approx_start = latest - timedelta(days=int(lookback_days * 1.5))
            q |= Q(symbol=sym, date__gte=approx_start, date__lte=latest)

        rows = (
            DailyPrice.objects
            .filter(q)
            .order_by('symbol', 'date')
            .values('symbol', *_fields)
        )

        grouped: dict[str, list] = {sym: [] for sym in redis_missing}
        for row in rows:
            sym = row['symbol']
            entry = {f: row[f] for f in _fields}
            grouped[sym].append(entry)

        for sym, data in grouped.items():
            # Slice cuối lookback_days phiên
            sliced = data[-lookback_days:] if len(data) > lookback_days else data
            result[sym] = sliced
            rkey = cls._redis_key(f"hist:{lookback_days}", sym)
            cache.set(rkey, sliced, _LATEST_TTL)
            if _local_cache is not None:
                _local_cache[f"hist:{sym}:{lookback_days}"] = sliced

        return result

    # ------------------------------------------------------------------ #
    #  INTERNAL HELPERS                                                    #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _redis_key(type_key: str, symbol: str) -> str:
        return f"mdsu:{type_key}:{symbol}:{_MDSU_CACHE_VERSION}"

    @staticmethod
    def _log(method: str, total: int, hits: int, db_queries: int) -> None:
        logger.debug(
            "mdsu.%s symbols=%d cache_hits=%d db_queries=%d",
            method, total, hits, db_queries,
        )
```

---

## 3. Canonical Rules (bắt buộc)

| Tên | Quy tắc | Lý do |
|-----|---------|-------|
| `latest` | `Max('date')` per symbol via aggregate | Nhất quán, một DB round-trip |
| `reference_price` | `close_price` của `latest` date | Không dùng `order_by('-date').first()` riêng lẻ |
| `trading_date` | Naive Python `date`, không có tz | Model hiện tại không lưu tz |
| Missing candle | Bỏ qua, không fill | Tránh giá trị giả ảnh hưởng indicator |
| Adjusted | Unadjusted (`close_price` raw) | Nguồn dữ liệu hiện tại là unadjusted |
| Lookback window | Tính từ `Max(date)` trong DB, không từ `date.today()` | Đúng với backfill lịch sử |

---

## 4. Migration Mapping — Call-sites hiện tại → API mới

| File | Line | Pattern cũ | API mới |
|------|:----:|------------|---------|
| `analytics.py` | 93 | `DailyPrice.objects.filter(...)` | `get_ohlcv_batch()` |
| `analytics.py` | 225 | Loop filter per symbol | `get_latest_snapshot()` |
| `analytics.py` | 268 | Filter + annotate | `get_ohlcv_batch()` |
| `analytics.py` | 805 | Benchmark filter | `get_ohlcv_batch()` |
| `views_analytics_extended.py` | 39 | `Max(date)` per symbol | `get_latest_snapshot()` |
| `views_analytics_extended.py` | 98 | `Max(date)` loop | `get_latest_snapshot()` |
| `views_analytics_extended.py` | 108 | Single symbol filter | `get_latest_snapshot()` |
| `tasks_watchlist_indicators.py` | 73 | Historical slice [:60] | `get_historical_indicators(lookback=60)` |
| `tasks_watchlist_indicators.py` | 80 | Historical slice [:30] | `get_historical_indicators(lookback=30)` |
| `services_backfill.py` | 44 | Prev close filter | `get_latest_snapshot()` |
| `views_screener.py` | 65 | Global latest dates | `get_latest_snapshot()` |
| `views_screener.py` | 80,106 | Chunk filter | `get_ohlcv_batch()` |
| `tasks_prefetch.py` | 1478,1483 | Single symbol latest | `get_latest_snapshot()` |
| `ai_advisory_helpers.py` | 957 | `[:lookback_days]` | `get_historical_indicators()` |
| `ai_advisory_helpers.py` | 1038 | Filter historical | `get_historical_indicators()` |
| `ai_context.py` | 55 | Filter [:30] | `get_historical_indicators(lookback=30)` |
| `views_ai_advisory_session.py` | 79,83 | `legacy_views.DailyPrice` | `get_latest_snapshot()` |
| `tasks_signal_verification.py` | 43,50 | `count()` + `.get()` | `get_latest_snapshot()` |

---

## 5. Feature Flag Design

```python
# backend/config/settings.py — thêm vào FEATURE_FLAGS dict hiện có
FEATURE_FLAGS = {
    ...
    "MDSU_BACKFILL_ENABLED": env.bool("MDSU_BACKFILL_ENABLED", default=False),
    "MDSU_ANALYTICS_ENABLED": env.bool("MDSU_ANALYTICS_ENABLED", default=False),
    "MDSU_AI_ENABLED": env.bool("MDSU_AI_ENABLED", default=False),
}
```

Dùng trong code:
```python
from django.conf import settings

if settings.FEATURE_FLAGS.get("MDSU_BACKFILL_ENABLED"):
    result = MarketDataService.get_latest_snapshot(symbols)
else:
    result = _legacy_backfill_query(symbols)  # code cũ giữ nguyên tạm thời
```

---

## 6. Contract Tests (bắt buộc Phase 0)

```python
# backend/portfolio/tests/test_market_data_service.py

class MarketDataServiceParityTest(TestCase):
    """Parity tests: service output == kết quả query cũ."""

    FIXTURE_SYMBOLS = ['VNM', 'VCB', 'FPT']

    def setUp(self):
        # Tạo DailyPrice fixtures cố định cho bộ test
        for sym in self.FIXTURE_SYMBOLS:
            for i in range(30):
                DailyPrice.objects.create(
                    symbol=sym,
                    date=date(2026, 3, 1) + timedelta(days=i),
                    close_price=Decimal(str(80000 + i * 100)),
                    volume=1000000 + i * 1000,
                )

    def test_get_latest_snapshot_parity(self):
        """get_latest_snapshot kết quả phải khớp query cũ."""
        old_result = {}
        for sym in self.FIXTURE_SYMBOLS:
            dp = DailyPrice.objects.filter(symbol=sym).order_by('-date').first()
            old_result[sym] = dp.close_price

        new_result = MarketDataService.get_latest_snapshot(self.FIXTURE_SYMBOLS)
        for sym in self.FIXTURE_SYMBOLS:
            self.assertEqual(new_result[sym]['close_price'], old_result[sym])

    def test_get_latest_snapshot_empty(self):
        result = MarketDataService.get_latest_snapshot([])
        self.assertEqual(result, {})

    def test_get_latest_snapshot_missing_symbol(self):
        result = MarketDataService.get_latest_snapshot(['NOTEXIST'])
        self.assertNotIn('NOTEXIST', result)

    def test_get_historical_indicators_count(self):
        """Số rows trả về không vượt lookback_days."""
        result = MarketDataService.get_historical_indicators(
            ['VNM'], lookback_days=10
        )
        self.assertLessEqual(len(result['VNM']), 10)

    def test_get_historical_indicators_sorted_asc(self):
        """Rows được sorted date ASC."""
        result = MarketDataService.get_historical_indicators(
            ['VNM'], lookback_days=30
        )
        dates = [row['date'] for row in result['VNM']]
        self.assertEqual(dates, sorted(dates))

    def test_local_context_cache(self):
        """Local cache được populated sau lần gọi đầu."""
        ctx = {}
        MarketDataService.get_latest_snapshot(['VNM'], _local_cache=ctx)
        self.assertIn('latest:VNM', ctx)
        # Lần 2 không query DB (không thể assert trực tiếp nhưng không raise)
        MarketDataService.get_latest_snapshot(['VNM'], _local_cache=ctx)
```

---

## 7. Gate Test Design

```python
# backend/portfolio/tests/test_mdsu_gate.py

MIGRATED_FILES = [
    'backend/portfolio/analytics.py',
    'backend/portfolio/views_analytics_extended.py',
    'backend/portfolio/tasks_watchlist_indicators.py',
    'backend/portfolio/services_backfill.py',
    'backend/portfolio/views_screener.py',
    'backend/portfolio/ai_advisory_helpers.py',
    'backend/portfolio/ai_context.py',
    'backend/portfolio/views_ai_advisory_session.py',
    'backend/portfolio/tasks_signal_verification.py',
    'backend/portfolio/tasks_prefetch.py',
]

FORBIDDEN_PATTERNS = [
    r'DailyPrice\.objects\.filter\(',
    r'DailyPrice\.objects\.order_by\(',
    r'DailyPrice\.objects\.annotate\(',
    r'legacy_views\.DailyPrice',
]

class MdsuGateTest(TestCase):
    def test_no_direct_dailyprice_query_in_migrated_files(self):
        import re, os
        for rel_path in MIGRATED_FILES:
            abs_path = os.path.join(
                os.path.dirname(__file__), '..', '..', '..', rel_path
            )
            if not os.path.exists(abs_path):
                continue
            with open(abs_path, encoding='utf-8') as f:
                content = f.read()
            for pattern in FORBIDDEN_PATTERNS:
                matches = re.findall(pattern, content)
                self.assertEqual(
                    len(matches), 0,
                    f"MDSU Gate FAIL: '{pattern}' found in {rel_path}"
                )
```

---

## 8. Redis Key Convention

| Key | TTL | Ví dụ |
|-----|:---:|-------|
| `mdsu:latest:{SYM}:v1` | 300s | `mdsu:latest:VNM:v1` |
| `mdsu:ohlcv:{START}_{END}:{SYM}:v1` | 3600s | `mdsu:ohlcv:2026-01-01_2026-04-21:VNM:v1` |
| `mdsu:hist:{DAYS}:{SYM}:v1` | 300s | `mdsu:hist:30:VNM:v1` |

Khi cần explicit invalidation (sau market close):
```python
# Purge all latest caches
from django.core.cache import cache
# Django Redis: cache.delete_pattern('mdsu:latest:*:v1')
```

---

*Tài liệu này thuộc Mandatory Triad MDSU. Tham chiếu:*
- *Implementation Plan: `IMPLEMENTATION_PLAN_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
- *Taskboard: `TASKBOARD_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
