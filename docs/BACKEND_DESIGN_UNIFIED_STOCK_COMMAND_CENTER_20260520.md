# BACKEND DESIGN — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Tổng quan backend impact

Feature này là **thuần frontend refactor**. Không có endpoint mới, không có model mới, không có migration mới.

Backend impact duy nhất:
1. Route redirect (có thể xử lý ở frontend React Router hoặc Nginx).
2. Không thay đổi bất kỳ Django view, serializer, model, hay Celery task.

---

## 2. API endpoints tái sử dụng

Tất cả endpoints đã có và đang hoạt động. Đội code chỉ cần tái sử dụng đúng cách.

| Endpoint | Dùng ở Tab | Hook/Function trong client.js |
|----------|-----------|-------------------------------|
| `GET /api/market/stock-workspace/:symbol/overview/` | TopBar | `getStockWorkspaceOverview` |
| `GET /api/market/stock-workspace/:symbol/chart/` | KLineChart | `getStockPriceChart` |
| `GET /api/market/depth-chart/:symbol/` | Right Sidebar | `getDepthChart` |
| `GET /api/market/intraday-matched/:symbol/` | Right Sidebar | `getIntradayMatched` |
| `GET /api/market/rvol/:symbol/` | Tab Cá Mập | `getRVOL` |
| `GET /api/market/whale-feed/aggregate/:symbol/` | Tab Cá Mập | `getAggregateWhaleFeed` |
| `POST /api/stock-management/:symbol/ai-advisory/session/` | Tab AI Advisory | `getStockAIAdvisorySession` |
| `GET /api/market/stock-order-flow/:symbol/` | Tab Order Flow | `getStockOrderFlow` |
| `GET /api/market/whale-analytics-snapshot/:symbol/` | Tab Cá Mập | `getWhaleAnalyticsSnapshot` |
| `GET /api/market/session-facts/:symbol/` | KLine context | `getSessionFacts` |
| `GET /api/market/session-facts-cvd/:symbol/` | KLine context | `getSessionFactsCvd` |

---

## 3. Redirect strategy

### Option A: Frontend React Router (Khuyến nghị)
```jsx
// Trong App.jsx hoặc router config:
<Route
  path="/whale-alerts/:symbol"
  element={<WhaleAlertsRedirect />}
/>

function WhaleAlertsRedirect() {
  const { symbol } = useParams();
  return <Navigate to={`/stocks/${symbol}`} replace />;
}
```

**Ưu điểm:** Không cần deploy Nginx rule. Redirect xảy ra ở client-side.
**Nhược điểm:** Cần frontend build. Không phải 301 HTTP redirect thực sự.

### Option B: Nginx redirect (301 HTTP)
```nginx
# Thêm vào nginx.conf hoặc site config:
location ~ ^/whale-alerts/(.+)$ {
  return 301 /stocks/$1;
}
```

**Ưu điểm:** Redirect thực sự 301, SEO-safe, hoạt động trước khi JS load.
**Khuyến nghị:** Dùng Option B cho production, Option A là fallback.

---

## 4. WebSocket / Realtime impact

Không thay đổi. `RealtimeConsumer` trong `backend/portfolio/consumers.py` vẫn giữ nguyên contract:
- `ticker_update` → vẫn nhận theo symbol subscription.
- `whale_alert` → vẫn nhận theo symbol.
- `whale_advisory` → vẫn nhận theo symbol.

Frontend chỉ cần đảm bảo `StockDetailUnifiedPage` subscribe đúng channel khi mount.

---

## 5. Không cần thực hiện ở backend

- ❌ Không tạo endpoint mới.
- ❌ Không thêm migration.
- ❌ Không thay đổi serializer.
- ❌ Không thay đổi Celery task.
- ❌ Không thay đổi model.
- ❌ Không thay đổi `market_data_service.py`.

---

## 6. Smoke test backend (không thay đổi nhưng phải verify)

Sau khi deploy frontend mới, xác nhận các endpoint vẫn trả về đúng:

```bash
# Test từ backend container:
curl -s "http://localhost:8000/api/market/stock-workspace/BMP/overview/" -H "Authorization: Bearer <token>" | python -m json.tool | head -20

curl -s "http://localhost:8000/api/market/whale-analytics-snapshot/BMP/?trade_date=$(date +%Y-%m-%d)" -H "Authorization: Bearer <token>" | python -m json.tool | head -20
```

Expected: HTTP 200, JSON envelope hợp lệ.
