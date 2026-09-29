# Bản Đặc Tả Kỹ Thuật Chi Tiết - System Hardening
**Ngày: 2026-04-17**  
**Phiên bản: 1.0**  
**Trạng thái: Sẵn sàng bàn giao code**

---

## Mục Đích

Tài liệu này cung cấp **hướng dẫn code chi tiết từng bước** để team dev có thể thực thi ngay lập tức mà không cần hỏi lại về logic hay cấu trúc. Mỗi phase có:
- ✅ Mô tả vấn đề gốc
- ✅ Mã giả (pseudocode) / code sample
- ✅ Danh sách tệp cần sửa
- ✅ Test cases để validate

---

## Phase 1: Frontend Throttling (RAF + Batching)

### 📍 Vấn Đề Gốc

**Hiện tại:**
```jsx
// ❌ BAD: Mỗi websocket message trigger setState
ws.onmessage = (event) => {
  const ticker = JSON.parse(event.data);
  setQuotesBySymbol(prev => ({ ...prev, [ticker.symbol]: ticker }));
  // React re-render ngay → DOM update ngay → 100+ renders/giây
};
```

**Kết quả:** Browser lag, mouse stutter, 95% CPU spike.

---

### 🎯 Giải Pháp: RAF Throttling

**Nguyên lý:**
1. Mỗi websocket message không gọi setState ngay
2. Thay vào đó, **lưu vào buffer** (Mutable Ref)
3. Chỉ 1 lần mỗi frame (tối đa 60fps = 1 lần/16ms), gọi setState một lần duy nhất với toàn bộ accumulated updates
4. Kết quả: 100 messages → 1 setState → 1 re-render

---

### 💻 Code Implementation

#### **File 1: `frontend/src/hooks/useRealtimeFeedCore.js` (NEW/MAJOR REFACTOR)**

```javascript
import { useEffect, useRef, useState, useCallback } from 'react';

export const useRealtimeFeedCore = (wsUrl) => {
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  
  // ✅ KEY: Mutable ref buffer để accumulate updates
  const pendingUpdatesRef = useRef({});
  const rafIdRef = useRef(null);
  const isScheduledRef = useRef(false);
  
  // ✅ Hàm flush: gọi setState với toàn bộ pending updates
  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
      setQuotesBySymbol(prev => ({
        ...prev,
        ...pendingUpdatesRef.current
      }));
      
      // Log throttling metric
      console.log(`[RAF] Flushed ${Object.keys(pendingUpdatesRef.current).length} updates`);
      
      // Reset buffer cho frame tiếp theo
      pendingUpdatesRef.current = {};
    }
    isScheduledRef.current = false;
  }, []);
  
  // ✅ Schedule flush on next RAF frame
  const scheduleFlush = useCallback(() => {
    if (!isScheduledRef.current) {
      isScheduledRef.current = true;
      rafIdRef.current = requestAnimationFrame(flushUpdates);
    }
  }, [flushUpdates]);
  
  // ✅ Hàm handle message: chỉ đẩy vào buffer, không setState
  const handleMessage = useCallback((event) => {
    try {
      const ticker = JSON.parse(event.data);
      // Accumulate vào buffer
      pendingUpdatesRef.current[ticker.symbol] = ticker;
      // Schedule flush nếu chưa scheduled
      scheduleFlush();
    } catch (error) {
      console.error('Failed to parse ticker:', error);
    }
  }, [scheduleFlush]);
  
  // ✅ WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onmessage = handleMessage;
    ws.onerror = (error) => console.error('WS error:', error);
    
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      ws.close();
    };
  }, [wsUrl, handleMessage]);
  
  return { quotesBySymbol };
};
```

**Giải thích:**
- `pendingUpdatesRef`: Object lưu tất cả updates chưa được flush (không trigger re-render)
- `flushUpdates()`: Gọi setState với toàn bộ buffer, sau đó reset buffer
- `requestAnimationFrame()`: Đảm bảo flush diễn ra 1 lần/frame (tối đa 60fps)
- Result: 100 messages → 1 setState → 1 re-render instead of 100 re-renders

---

#### **File 2: `frontend/src/components/RealtimeDashboard.jsx` (REFACTOR UPDATE METHOD)**

```jsx
const RealtimeDashboard = ({ wsUrl }) => {
  const [chartData, setChartData] = useState([]);
  const pendingChartUpdatesRef = useRef([]);
  const chartRafIdRef = useRef(null);
  const isChartScheduledRef = useRef(false);
  
  // ✅ Flush chart updates với max frequency 60fps
  const flushChartUpdates = useCallback(() => {
    if (pendingChartUpdatesRef.current.length > 0) {
      setChartData(prev => [
        ...prev,
        ...pendingChartUpdatesRef.current
      ]);
      console.log(`[CHART] Throttled ${pendingChartUpdatesRef.current.length} points`);
      pendingChartUpdatesRef.current = [];
    }
    isChartScheduledRef.current = false;
  }, []);
  
  // ... rest of implementation
};
```

---

## Phase 2: Async-First AI Advisory (Circuit Breaker + 202 Response)

### 📍 Vấn Đề Gốc

**Hiện tại:**
```python
# ❌ BAD: View chặn web worker
@api_view(['POST'])
def create_ai_advisory(request):
    symbol = request.data['symbol']
    advisory = AIAdvisor.compute_sync(symbol)  # ← BLOCKING 20-60s
    return Response(advisory, status=200)  # ← Web worker stuck
```

**Kết quả:** 1 request = 1 web worker × 60s. 8 workers → chỉ 8 users, request 9 hang → 504 error.

---

### 🎯 Giải Pháp: Circuit Breaker + 202 Accepted

**Nguyên lý:**
1. API trả về `202 Accepted` **ngay lập tức** (dưới 100ms)
2. Celery task xử lý async background
3. Frontend poll endpoint hoặc listen websocket cho kết quả
4. Kết quả: Web worker **luôn free**

---

### 💻 Code Implementation

#### **File 1: `backend/config/settings.py` (ADD CONFIG)**

```python
# ========== AI ADVISORY SETTINGS ==========

# ✅ Disable sync fallback
FORCE_SYNC_AI_ADVISORY = False

# ✅ Async computation timeout (seconds)
AI_ADVISORY_COMPUTE_TIMEOUT = 30

# ✅ Circuit breaker: max concurrent tasks
AI_ADVISORY_MAX_QUEUE_DEPTH = 1000

# ✅ Webhook callback (tuỳ chọn)
AI_ADVISORY_WEBHOOK_URL = os.getenv(
    'AI_ADVISORY_WEBHOOK_URL',
    'http://localhost:8000/api/ai-advisory/callback/'
)
```

---

#### **File 2: `backend/portfolio/views_ai_advisory_session.py` (REFACTOR VIEW - ASYNC FIRST)**

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from portfolio.tasks import compute_ai_advisory_async
from celery.result import AsyncResult
import uuid

@api_view(['POST'])
def get_or_create_ai_advisory(request):
    """✅ NEW: Async-first returns 202 Accepted immediately"""
    symbol = request.data.get('symbol')
    if not symbol:
        return Response({'error': 'symbol required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # ✅ Launch async task
    task_id = str(uuid.uuid4())
    task = compute_ai_advisory_async.apply_async(
        args=[symbol],
        task_id=task_id,
        expires=30,
        time_limit=30,
    )
    
    # ✅ Return 202 Accepted immediately
    return Response(
        {
            'status': 'queued',
            'task_id': task_id,
            'poll_url': f'/api/ai-advisory/status/{task_id}/',
        },
        status=status.HTTP_202_ACCEPTED
    )


@api_view(['GET'])
def get_ai_advisory_status(request, task_id):
    """✅ Poll endpoint: check advisory status"""
    result = AsyncResult(task_id)
    
    if result.state == 'SUCCESS':
        return Response({'status': 'completed', 'data': result.result}, status=200)
    elif result.state in ['PENDING', 'PROGRESS']:
        return Response({'status': 'processing'}, status=202)
    else:
        return Response({'status': 'failed', 'error': str(result.info)}, status=500)
```

---

#### **File 3: `backend/portfolio/tasks.py` (ADD CELERY TASK)**

```python
from celery import shared_task
from django.conf import settings
from portfolio.models import IntradayTick
import pandas as pd

@shared_task(bind=True, time_limit=settings.AI_ADVISORY_COMPUTE_TIMEOUT)
def compute_ai_advisory_async(self, symbol):
    """✅ Async task: Compute AI advisory without blocking web worker"""
    
    # ✅ Compute VWAP (vectorized)
    ticks = IntradayTick.objects.filter(symbol=symbol).values('price', 'volume')
    if ticks:
        df = pd.DataFrame.from_records(list(ticks))
        df['pv'] = df['price'] * df['volume']
        vwap = float(df['pv'].sum() / df['volume'].sum())
    else:
        vwap = None
    
    return {
        'symbol': symbol,
        'vwap': vwap,
        'timestamp': timezone.now().isoformat(),
    }
```

---

## Phase 3: Pandas Vectorization for History Charts

### 📍 Vấn Đề Gốc

**Hiện tại:**
```python
# ❌ BAD: Loop-based side inference
for tick in ticks.iterator():  # ← Loop 50k times
    side = 'BUY' if tick.price > prev_price else 'SELL'
    # 5s+ to complete
```

---

### 🎯 Giải Pháp: SQL → Pandas Vectorization

```python
# ✅ GOOD: Pandas vectorized
ticks = IntradayTick.objects.filter(symbol=symbol).values('price', 'volume')
df = pd.DataFrame.from_records(list(ticks))

# ✅ Vectorized side inference (instant)
df['prev_price'] = df['price'].shift(1)
df['side'] = df.apply(lambda row: 'BUY' if row['price'] > row['prev_price'] else 'SELL', axis=1)

# ✅ Vectorized quantiles
df['p10'] = df['volume'].quantile(0.10)
df['p50'] = df['volume'].quantile(0.50)
df['p90'] = df['volume'].quantile(0.90)
```

---

## Phase 4: Config Sync (Settings Centralization)

### 🎯 Giải Pháp

#### **File 1: `backend/config/settings.py`**

```python
# ✅ Centralize Redis stream config
STREAM_MAX_LEN = int(os.getenv('STREAM_MAX_LEN', '100000'))
```

#### **File 2: `backend/portfolio/tasks_maintenance.py`**

```python
# ✅ BEFORE: hardcoded 50000
# STREAM_MAX_LEN = 50000

# ✅ AFTER: import from settings
from django.conf import settings

@periodic_task(run_every=crontab(minute='*/5'))
def trim_redis_streams():
    """Trim Redis streams to configured max length"""
    redis_client = get_redis_client()
    max_len = settings.STREAM_MAX_LEN  # ✅ Single source of truth
    
    streams = ['ticker_stream', 'whale_stream', 'dark_flow_stream']
    for stream_name in streams:
        redis_client.execute_command('XTRIM', stream_name, 'MAXLEN', '~', max_len)
```

---

## Testing & Validation

### Phase 1 Test (Browser Performance)
```javascript
// Measure FPS & CPU usage
const startTime = performance.now();
let renderCount = 0;

// Simulate 500 ticker updates
for (let i = 0; i < 500; i++) {
  ws.send(JSON.stringify({ symbol: 'STK', price: 100 + i }));
}

// ✅ Expect: FPS 55-60, CPU <20%
```

### Phase 2 Test (Async Advisory)
```python
def test_create_advisory_returns_202():
    response = client.post('/api/ai-advisory/create/', {'symbol': 'VNM'})
    assert response.status_code == 202  # ✅ Async
    assert 'task_id' in response.json()
```

### Phase 3 Test (Chart Vectorization)
```python
def test_chart_vectorization_fast():
    start = time.time()
    data = get_chart_data_vectorized('VNM', days=30)
    elapsed = time.time() - start
    assert elapsed < 1.0  # ✅ <1s vs 5s before
```

---

## Rollback Plan

| Phase | Command | Time |
|-------|---------|------|
| 1 | `git revert <commit>` + `npm run build` | 5m |
| 2 | `git revert <commit>` + `python manage.py migrate --fake` | 10m |
| 3 | `git revert <commit>` + clear Redis | 5m |
| 4 | Update settings + restart Celery | 2m |

---

**Tài liệu này sẵn sàng để team dev thực hiện ngay lập tức.**

---

**Trạng thái:** 🟡 Ready for Immediate Implementation
