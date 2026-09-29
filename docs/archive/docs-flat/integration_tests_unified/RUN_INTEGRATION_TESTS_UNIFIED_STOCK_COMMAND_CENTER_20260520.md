# RUN INTEGRATION TESTS — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Lệnh chạy unit tests

```bash
# Chạy tất cả tests liên quan feature này:
npm test --prefix frontend -- \
  --testPathPattern="FactsFirstWhaleBubbleChart|FactsFirstWhaleAnalyticsTab|WhaleBubbleChart.sync|WhaleBubbleChart.tooltip|useWhaleAnalyticsData|AnalyticsTabDeck|StockDetail" \
  --watchAll=false \
  --verbose 2>&1 | tee test_results_unified_command_center.txt

# Expected: 0 failures
```

---

## 2. Lệnh chạy full test suite (regression check)

```bash
# Đảm bảo không break test cũ:
npm test --prefix frontend -- --watchAll=false --passWithNoTests 2>&1 | tail -20
```

---

## 3. Build validation

```bash
# Frontend build:
npm run build --prefix frontend 2>&1 | tail -30

# Hoặc docker rebuild:
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend 2>&1 | tail -20
```

---

## 4. Integration smoke test (manual)

Thực hiện với symbol BMP và FPT để cover đủ data:

### 4.1 Smoke test BMP

```
1. Truy cập: http://localhost/stocks/BMP
2. Xác nhận: TopBar hiển thị giá BMP.
3. Xác nhận: KLineChart render (nến xuất hiện).
4. Xác nhận: Pane CVD và Pane Strength nằm dưới KLine, cùng trục X.
5. Click vào một nến bất kỳ.
6. Xác nhận: Tab Cá Mập hiện Bubble Chart với dữ liệu ngày của nến đã click.
7. Chuyển sang Tab Order Flow → radar chart render.
8. Chuyển sang Tab AI Advisory → nhận định AI hoặc skeleton.
9. Thu gọn right sidebar → KLine mở rộng.
10. Expand sidebar → layout trở về bình thường.
```

### 4.2 Smoke test redirect

```
1. Truy cập: http://localhost/whale-alerts/BMP
2. Xác nhận: URL chuyển thành http://localhost/stocks/BMP
3. Xác nhận: Trang hiển thị đúng Command Center cho BMP.
```

### 4.3 Smoke test FPT (regression)

```
1. Truy cập: http://localhost/stocks/FPT
2. Xác nhận tất cả items từ 4.1 cũng hoạt động cho FPT.
3. Xác nhận: Price alerts, watchlist actions vẫn hoạt động.
4. Xác nhận: AI Advisory prompt config drawer vẫn mở được.
```

---

## 5. Performance check

```bash
# Trong browser DevTools:
# 1. Mở Performance tab
# 2. Start recording
# 3. Pan/zoom KLine chart 5 lần
# 4. Switch tab 3 lần
# 5. Stop recording
# Expected: FPS >= 50 trong suốt quá trình

# Memory leak check:
# 1. Mở Memory tab
# 2. Take snapshot trước khi test
# 3. Switch tab qua lại 10 lần
# 4. Take snapshot sau
# 5. So sánh heap size — không tăng đột biến (< 5MB increase)
```

---

## 6. Backend health check (không đổi nhưng phải verify)

```bash
# Từ backend container hoặc curl:
TOKEN="<JWT token của user test>"

# Kiểm tra overview:
curl -s "http://localhost/api/market/stock-workspace/BMP/overview/" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -10

# Kiểm tra whale analytics:
curl -s "http://localhost/api/market/whale-analytics-snapshot/BMP/?trade_date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -10

# Kiểm tra AI advisory:
curl -s -X POST "http://localhost/api/stock-management/BMP/ai-advisory/session/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python -m json.tool | head -10
```

**Expected:** HTTP 200, response JSON hợp lệ.
