# CODE QUALITY CONSTITUTION — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Scope**: Coding rules cho mọi commit trong C1–C7  
**Enforcement**: Code review phải check từng rule trước khi approve  

---

## 1. Bất biến tuyệt đối (không được vi phạm)

### INV-01: Không write vào legacy_readonly

```python
# ❌ FORBIDDEN
MyModel.objects.using('legacy_readonly').create(...)
MyModel.objects.using('legacy_readonly').update(...)

# ✅ OK — read only
data = MyModel.objects.using('legacy_readonly').filter(...)
```

`CoreRouter` đã guard write operations. Không được sửa `db_router.py`.

---

### INV-02: Không hardcode URL legacy backend

```python
# ❌ FORBIDDEN
import httpx
resp = httpx.get("http://backend:8000/api/...")  # hardcoded

# ✅ OK — nếu cần bridge (chỉ trong transition)
from django.conf import settings
url = f"{settings.LEGACY_BACKEND_URL}/api/..."
```

Sau C7: không còn `LEGACY_BACKEND_URL` reference nào trong source.

---

### INV-03: Mọi view mới phải có authentication

```python
# ❌ FORBIDDEN
class MyView(APIView):
    # không có permission_classes — default có thể allow any
    def get(self, request):
        ...

# ✅ REQUIRED
class MyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ...
```

---

### INV-04: SubAccount phải return `[]` không raise 5xx

```python
# ❌ FORBIDDEN
class SubAccountView(APIView):
    def get(self, request):
        raise NotImplementedError("SubAccount not migrated")

# ✅ REQUIRED
class SubAccountListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([])
```

---

### INV-05: Telegram phải return `{"status": "not_available"}`

```python
# ✅ REQUIRED
class TelegramStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"status": "not_available"})
```

---

### INV-06: Port 8000 không được expose trong compose

```yaml
# ❌ FORBIDDEN trong docker-compose.dev.yml:
backend:
  ports:
    - "8000:8000"

# ✅ OK — nếu backend còn cần giao tiếp internal trước C7:
backend:
  # (không có ports section — internal only)
```

---

## 2. View coding standards

### 2.1 Import pattern chuẩn cho native views

```python
# Standard imports cho mọi native view trong pack này
import datetime
from datetime import date

from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ...  # domain models

# Cross-domain imports — acceptable trong cutover period:
from market_serving.models import SymbolSnapshot  # từ market_data views
from market_data.models import DailyPrice, StockProfile  # từ market_serving views
```

### 2.2 Symbol sanitization

```python
# ✅ REQUIRED — uppercase symbol trước khi query
def get(self, request, symbol):
    symbol = symbol.upper()
    ...
```

### 2.3 Decimal fields phải convert to str trong response

```python
# ❌ problematic — Decimal không JSON-serializable directly
return Response({'price': snap.price})  # có thể gây lỗi

# ✅ CORRECT
return Response({'price': str(snap.price)})
# Hoặc dùng serializer với DecimalField
```

### 2.4 Graceful fallback pattern

```python
# ✅ CORRECT — graceful khi không có data
snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
if not snap:
    return Response({'symbol': symbol, 'data': None, 'stale': True})
```

### 2.5 Không dùng `get_object_or_404` khi muốn custom response

```python
# ❌ AVOID — trả HTML 404 page
from django.shortcuts import get_object_or_404
profile = get_object_or_404(StockProfile, symbol=symbol)

# ✅ CORRECT — trả JSON 404
from rest_framework.exceptions import NotFound
try:
    profile = StockProfile.objects.get(symbol=symbol)
except StockProfile.DoesNotExist:
    raise NotFound(f'Stock not found: {symbol}')
```

---

## 3. Celery task standards

### 3.1 Task queue phải explicit

```python
# ✅ REQUIRED — queue explicit trong beat schedule
'ingest-price-board-60s': {
    'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
    'schedule': 60.0,
    'options': {'queue': 'realtime_prefetch'},  # ← phải có
}
```

### 3.2 Không dùng crontab khi float seconds đủ

```python
# ❌ AVOID (phức tạp hơn cần)
'schedule': crontab(minute='*/1')  # chạy mỗi phút

# ✅ SIMPLER
'schedule': 60.0  # 60 giây
```

---

## 4. URL wiring standards

### 4.1 Native view phải được import rõ ràng

```python
# ✅ CORRECT
from .views import RealtimeTickerView, RealtimeTickerListView

urlpatterns = [
    path('realtime/ticker/<str:symbol>/', RealtimeTickerView.as_view()),
    ...
]
```

### 4.2 Không để dead imports sau cutover

```python
# ❌ DEAD CODE sau C2 — phải xóa
from .legacy_views import RealtimeLegacyBridgeView  # xóa nếu không còn dùng

# ✅ Clean sau cutover
from .views import RealtimeTickerView  # chỉ giữ gì đang dùng
```

---

## 5. Portfolio analytics standards

### 5.1 Aggregation phải dùng Django ORM annotate

```python
# ✅ CORRECT — vectorized SQL
from django.db.models import Sum, F, ExpressionWrapper, DecimalField

holdings_qs = (
    Transaction.objects.filter(portfolio=portfolio)
    .values('symbol')
    .annotate(
        total_buy_qty=Sum('quantity', filter=Q(transaction_type='BUY')),
        total_sell_qty=Sum('quantity', filter=Q(transaction_type='SELL')),
    )
)

# ❌ AVOID — Python loop trên queryset
for txn in Transaction.objects.filter(portfolio=portfolio):
    if txn.transaction_type == 'BUY':
        holdings[txn.symbol] = holdings.get(txn.symbol, 0) + txn.quantity
```

### 5.2 Decimal arithmetic

```python
# ✅ CORRECT — float conversion nhất quán
avg_cost = float(buys['total_cost'] or 0) / float(buys['total_qty'] or 1)
unrealized_pnl = (current_price - avg_cost) * net_qty

# ❌ Mixed types — gây TypeError
avg_cost = buys['total_cost'] / buys['total_qty']  # Decimal / int → OK nhưng risky
```

---

## 6. Decommission checklist (code review C7)

Reviewer phải verify từng dòng sau trong PR:

- [ ] `legacy_http_bridge.py` đã xóa khỏi repo (không còn trong git status)
- [ ] `grep -rn "from vninvest_core.legacy_http_bridge"` → 0 kết quả
- [ ] `grep -rn "legacy_bridge_response"` → 0 kết quả  
- [ ] `grep -rn "RealtimeLegacyBridgeView"` trong `api_urls.py` → 0
- [ ] `grep -rn "StockManagementLegacyBridgeView"` trong `public_urls.py` → 0
- [ ] compose files: services `backend` và `backend-worker` đã bị remove/comment
- [ ] `LEGACY_BACKEND_URL` và `LEGACY_DATABASE_URL` đã bị xóa khỏi compose

---

## 7. Security checklist (mọi PR)

- [ ] Không có `permission_classes = [permissions.AllowAny]` trên route authenticated
- [ ] Không có hardcoded credentials, URLs, tokens
- [ ] Symbol param được `.upper()` trước khi dùng làm query key
- [ ] Không có `print()` statements với dữ liệu user trong production code
- [ ] `DEBUG` check không bypass security guards

---

## 8. Anti-patterns cần reject trong code review

| Pattern | Lý do reject | Alternative |
|---------|-------------|-------------|
| `objects.using('legacy_readonly').create(...)` | Violates INV-01 | Dùng default DB |
| `httpx.get("http://backend:8000/...")` | Hardcoded URL | settings.LEGACY_BACKEND_URL (trước C7) |
| `return Response(status=500)` cho missing data | Ngắt UI | Graceful: `return Response({'data': None})` |
| `pass` trong Exception handler | Ẩn lỗi | Log + return appropriate status |
| `queryset.all()` trong view không có pagination | Memory issue | Dùng `[:100]` hoặc paginator |
| Import từ `backend.*` (legacy app) trong packages/core | Isolation violation | Chỉ dùng models/services trong packages/core |

---

*Constitution này là rule book — code review phải check trước khi merge bất kỳ PR nào trong pack C1–C7.*
