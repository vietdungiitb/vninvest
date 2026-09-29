# Technical Implementation Plan: Heatmap Refinement

**Phiên bản**: 1.5 | **Ngày chốt**: 2026-04-20 | **Ước tính**: 1.5 Sprint (~7 ngày làm việc)

---

## 1. Backend: Data Enrichment (Python/Django)

### B1 — Gộp StockProfile query vào `compute_holdings` · `analytics.py`

**Vấn đề hiện tại**: `HoldingsView` thực hiện query `StockProfile` riêng biệt sau khi `compute_holdings` trả về — đây là N+1 pattern ẩn.

**Sửa `analytics.py`** — thêm đoạn sau vào cuối `compute_holdings`, ngay trước `return df_holdings`:

```python
# --- Bước 3c: Join StockProfile (industry, market_cap_bn) — 1 query duy nhất ---
symbols_list = df_holdings['symbol'].tolist()
profiles_qs = StockProfile.objects.filter(
    symbol__in=symbols_list
).values('symbol', 'industry', 'market_cap_bn')
df_profiles = (
    pd.DataFrame.from_records(profiles_qs)
    if profiles_qs.exists()
    else pd.DataFrame(columns=['symbol', 'industry', 'market_cap_bn'])
)
if not df_profiles.empty:
    df_holdings = df_holdings.merge(df_profiles, on='symbol', how='left')
    df_holdings['industry'] = df_holdings['industry'].fillna('Khác')
    df_holdings['market_cap_bn'] = df_holdings['market_cap_bn'].fillna(0).astype(float)
else:
    df_holdings['industry'] = 'Khác'
    df_holdings['market_cap_bn'] = 0.0
```

**Sửa `views_portfolio_watchlist.py`** — xoá block StockProfile thủ công trong `HoldingsView.get`:

```python
# XOÁ ĐOẠN NÀY (không còn cần thiết sau B1):
# if holding_list:
#     symbols = [h['symbol'] for h in holding_list]
#     profiles = {
#         p['symbol']: p['industry'] or 'Khác'
#         for p in StockProfile.objects.filter(symbol__in=symbols).values('symbol', 'industry')
#     }
#     for h in holding_list:
#         h['industry'] = profiles.get(h['symbol'], 'Khác')
```

---

### B2 — Thêm `period` parameter và `change_period_pct` · `analytics.py`

**Thay đổi signature** của `compute_holdings`:

```python
# Từ:
def compute_holdings(portfolio) -> pd.DataFrame:
# Thành:
def compute_holdings(portfolio, period: str = '1D') -> pd.DataFrame:
```

**Thêm block tính `change_period_pct`** ngay sau khi có `symbols_list`, trước bước 3b:

```python
# --- Bước 3a-extra: change_period_pct cho period > 1D ---
# 1 query duy nhất lấy toàn bộ dải ngày cho tất cả symbols
PERIOD_DAYS = {'1D': 1, '5D': 5, '1M': 21}
n_days = PERIOD_DAYS.get(period, 1)

if n_days > 1:
    from datetime import date, timedelta
    ref_date = date.today() - timedelta(days=n_days + 3)  # +3 buffer cho ngày không giao dịch
    prices_range_qs = DailyPrice.objects.filter(
        symbol__in=symbols_list,
        date__gte=ref_date,
    ).values('symbol', 'date', 'close_price').order_by('symbol', 'date')
    # Đây là 1 query bulk duy nhất — không có loop, không có N+1
    df_range = pd.DataFrame.from_records(prices_range_qs)
    if not df_range.empty:
        df_range['date'] = pd.to_datetime(df_range['date'])
        df_range['close_price'] = df_range['close_price'].astype(float)
        df_latest = df_range.groupby('symbol').last()[['close_price']].rename(
            columns={'close_price': 'price_latest'}
        )
        df_prev = df_range.groupby('symbol').first()[['close_price']].rename(
            columns={'close_price': 'price_prev'}
        )
        df_period = df_latest.join(df_prev)
        df_period['change_period_pct'] = np.where(
            df_period['price_prev'] != 0,
            ((df_period['price_latest'] - df_period['price_prev']) / df_period['price_prev'] * 100).round(4),
            0.0,
        )
        df_holdings = df_holdings.merge(
            df_period[['change_period_pct']].reset_index(),
            on='symbol', how='left',
        )
    else:
        df_holdings['change_period_pct'] = None
else:
    df_holdings['change_period_pct'] = None  # period=1D dùng live feed từ market_data_service
```

---

### B3 — Redis Cache · `views_portfolio_watchlist.py`

**Thêm import** đầu file:

```python
from django.core.cache import cache
```

**Wrap `HoldingsView.get`**:

```python
def get(self, request, portfolio_id):
    portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
    period = request.query_params.get('period', '1D')
    if period not in ('1D', '5D', '1M', 'YTD'):
        period = '1D'

    from datetime import date
    cache_key = f'holdings:{portfolio_id}:{period}:{date.today().isoformat()}'
    # TTL: 5 phút cho 1D (giá live thay đổi thường xuyên), 1 tiếng cho các period dài
    ttl = 300 if period == '1D' else 3600

    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    df = compute_holdings(portfolio, period=period)
    holding_list = df.to_dict(orient='records') if not df.empty else []
    serializer = HoldingSerializer(holding_list, many=True)
    result = serializer.data
    cache.set(cache_key, result, ttl)
    return Response(result)
```

**Cache Key Format** (chuẩn để debug/flush thủ công):
```
holdings:{portfolio_id}:{period}:{YYYY-MM-DD}
Ví dụ: holdings:12:1D:2026-04-20
```

**Cache Invalidation** — tạo file `backend/portfolio/signals.py` (nếu chưa có):

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.cache import cache
from .models import Transaction

@receiver(post_save, sender=Transaction)
def invalidate_holdings_cache(sender, instance, **kwargs):
    portfolio_id = instance.portfolio_id
    from datetime import date
    today = date.today().isoformat()
    for period in ('1D', '5D', '1M', 'YTD'):
        cache.delete(f'holdings:{portfolio_id}:{period}:{today}')
```

**Đăng ký signal** trong `backend/portfolio/apps.py`:

```python
class PortfolioConfig(AppConfig):
    # ...
    def ready(self):
        import portfolio.signals  # noqa
```

---

### B4 — Thêm `change_period_pct` vào `HoldingSerializer` · `serializers.py`

Tìm class `HoldingSerializer`, thêm field:

```python
change_period_pct = serializers.FloatField(allow_null=True, required=False, default=None)
```

---

## 2. Frontend: UI & Interaction (React/ECharts)

Tất cả thay đổi trong `frontend/src/components/PortfolioHeatmap.jsx`.

### F1 — Neon Palette · Lines 12–19

Thay toàn bộ constant `FINTECH_HEAT_COLORS`:

```javascript
// Từ:
const FINTECH_HEAT_COLORS = {
  upStrong: '#089981',
  upSoft: '#1B5E20',
  downStrong: '#F23645',
  downSoft: '#7F1D1D',
  neutral: '#2A2E39',
};

// Thành:
const FINTECH_HEAT_COLORS = {
  upStrong: '#00FFBB',   // Neon Emerald
  upSoft: '#00CC99',
  downStrong: '#FF3344', // Electric Red
  downSoft: '#FF6677',
  neutral: '#2A2E39',    // không đổi
};
```

Sửa `itemStyle` trong `chartData` useMemo — tăng shadowBlur cho tile extreme:

```javascript
// Từ:
shadowBlur: isExtreme ? 10 : 0,
// Thành:
shadowBlur: isExtreme ? 15 : 0,
```

Thêm `textShadowColor` vào `rich.symbol` trong treemap series (để chữ đọc được trên nền `#00FFBB`):

```javascript
symbol: {
  color: '#ffffff',
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 16,
  textShadowBlur: 3,
  textShadowColor: 'rgba(0, 0, 0, 0.7)',  // THÊM DÒNG NÀY
  align: 'center',
},
```

Sửa 2 legend dots hardcode ở cuối JSX:

```jsx
// Dot tăng:
<div className="w-2.5 h-2.5 rounded-full bg-[#00FFBB] shadow-[0_0_8px_rgba(0,255,187,0.45)]" />
// Dot giảm:
<div className="w-2.5 h-2.5 rounded-full bg-[#FF3344] shadow-[0_0_8px_rgba(255,51,68,0.45)]" />
```

---

### F2 — Đổi nhãn "Weight" → "Giá trị"

```javascript
// Từ:
{t('dashboardRealtime.heatmapSizeWeight', { defaultValue: 'Weight' })}
// Thành:
{t('dashboardRealtime.heatmapSizeWeight', { defaultValue: 'Giá trị' })}
```

Cập nhật i18n:
- `frontend/src/locales/vi.json`: `"dashboardRealtime.heatmapSizeWeight": "Giá trị"`
- `frontend/src/locales/en.json`: `"dashboardRealtime.heatmapSizeWeight": "Value"`

---

### F3 — Click-to-Sync Signal Dispatcher

**Bước 1** — Đổi tooltip trigger về click-only (trong `const tooltip = { ... }`):

```javascript
// Từ:
triggerOn: 'mousemove|click',
// Thành:
triggerOn: 'click',
```

**Bước 2** — Thêm hàm `dispatchSyncEvent` (trước `return` của component):

```javascript
const dispatchSyncEvent = useCallback((params) => {
  const data = params?.data;
  if (!data || data.children) return; // bỏ qua sector node
  window.dispatchEvent(new CustomEvent('vninvest:sync:interaction', {
    detail: {
      timestamp: null,
      symbol: data.symbol || data.name,
      source: 'PortfolioHeatmap',
      action: 'select',
    },
  }));
}, []);
```

**Bước 3** — Gắn vào `<ReactECharts>`:

```jsx
<ReactECharts
  key={`${viewMode}-${locale}`}
  ref={chartComponentRef}
  option={option}
  style={{ height: HEATMAP_HEIGHT, width: '100%' }}
  notMerge={false}
  lazyUpdate={true}
  opts={{ renderer: 'canvas' }}
  onEvents={{ click: dispatchSyncEvent }}  {/* THÊM DÒNG NÀY */}
  onChartReady={() => { ... }}
/>
```

---

### F4 — Mobile Label Fallback · `buildLeafLabel`

```javascript
// Từ:
if (ratio < 0.18) {
  return `{symbol|${leaf.name}}`;
}
// Thành:
if (ratio < 0.3) {
  return `{symbol|${leaf.name}}`;
}
```

---

## 3. Thứ tự thực hiện & Dependency

```
D (docs)    ──────────────────────────────────────────────────► DONE
B1 → B2 → B3 → B4   (sequential, không block frontend)
F1, F2, F4  ─────────────────────── song song nhau ──────────►
F3          ─────────────────────── sau khi B4 merge ────────►
```

**Breakdown thời gian**:

| Task | File | Ước tính |
|------|------|----------|
| B1 — Gộp StockProfile query | `analytics.py`, `views_portfolio_watchlist.py` | 0.5 ngày |
| B2 — Period + change_period_pct | `analytics.py` | 1 ngày |
| B3 — Redis cache + invalidation | `views_portfolio_watchlist.py`, `signals.py`, `apps.py` | 0.5 ngày |
| B4 — Serializer field | `serializers.py` | 0.25 ngày |
| F1 — Neon palette | `PortfolioHeatmap.jsx` | 0.5 ngày |
| F2 — Label rename + i18n | `PortfolioHeatmap.jsx`, locales | 0.25 ngày |
| F3 — Signal dispatcher | `PortfolioHeatmap.jsx` | 1 ngày |
| F4 — Mobile fallback | `PortfolioHeatmap.jsx` | 0.25 ngày |
| Testing + QA checklist | — | 1.5 ngày |
| **Tổng** | | **~5.75 ngày ≈ 1.5 Sprint** |

---

## 4. Verification Checklist (QA)

- [ ] Mở DevTools Network, rà chuột liên tục qua heatmap → **0 API request** nào được gửi
- [ ] Click vào 1 ô heatmap → Console log `CustomEvent 'vninvest:sync:interaction'` với `action: 'select'` và `symbol` đúng
- [ ] `GET /api/portfolios/1/holdings/?period=5D` → Response có field `change_period_pct` ≠ null
- [ ] Gọi API holdings 2 lần liên tiếp trong 5 phút → Lần 2 nhanh hơn rõ rệt (Redis cache hit)
- [ ] Tạo 1 transaction mới → Gọi lại API → Dữ liệu mới (cache đã bị invalidate)
- [ ] Tile tăng mạnh (>3%) → Màu `#00FFBB`, `shadowBlur: 15`
- [ ] Legend "Tăng" hiển thị màu `#00FFBB` (không phải `#089981`)
- [ ] Màn hình 375px wide → Tile nhỏ chỉ hiện symbol, ẩn % và giá

---

## 5. Các file sẽ được sửa đổi

| File | Loại | Tasks |
|------|------|-------|
| `backend/portfolio/analytics.py` | Python | B1, B2 |
| `backend/portfolio/views_portfolio_watchlist.py` | Python | B1, B3 |
| `backend/portfolio/serializers.py` | Python | B4 |
| `backend/portfolio/signals.py` | Python (tạo mới) | B3 |
| `backend/portfolio/apps.py` | Python | B3 |
| `frontend/src/components/PortfolioHeatmap.jsx` | React | F1, F2, F3, F4 |
| `frontend/src/locales/vi.json` | JSON | F2 |
| `frontend/src/locales/en.json` | JSON | F2 |

---

**Plan Version**: 1.5 (Bulk Fetch + Redis + Click-to-Sync)  
**Status**: Ready for Implementation  
**Estimated Effort**: 1.5 Sprints (~7 ngày làm việc)
