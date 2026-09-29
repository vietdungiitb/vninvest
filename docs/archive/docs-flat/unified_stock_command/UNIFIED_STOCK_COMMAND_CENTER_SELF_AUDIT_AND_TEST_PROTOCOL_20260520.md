# SELF AUDIT & TEST PROTOCOL — Unified Stock Command Center
## Feature: UNIFIED_STOCK_COMMAND_CENTER | Ngày: 2026-05-20

---

## 1. Immutable source audit (chạy TRƯỚC khi mark slice xong)

```bash
# Từ root project:
git diff HEAD -- frontend/src/components/WhaleBubbleChart.jsx
git diff HEAD -- frontend/src/components/WhaleAnalyticsTab.jsx
git diff HEAD -- frontend/src/components/modern/ModularPositionDeck.jsx
git diff HEAD -- frontend/src/components/KLineChartPanel.jsx
git diff HEAD -- frontend/src/components/OrderFlowRadarPanel.jsx
git diff HEAD -- frontend/src/components/FactsFirstWhaleBubbleChart.jsx
git diff HEAD -- frontend/src/components/modern/AIAdvisorAlertPanel.jsx
```

**Expected:** Output trống (no changes) cho tất cả file trên.
**Nếu có diff:** STOP — rollback thay đổi, không được merge.

---

## 2. Build validation (sau mỗi slice)

```bash
# Frontend:
npm run build --prefix frontend 2>&1 | tail -30

# Hoặc full docker rebuild:
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

**Expected:** Build thành công, không có error. Warning mới phải được documented.

---

## 3. Test suite (chạy trước khi mark slice done)

```bash
# Unit tests:
npm test --prefix frontend -- --watchAll=false --passWithNoTests

# Specific test files:
npm test --prefix frontend -- --testPathPattern="FactsFirstWhaleBubbleChart|useWhaleAnalyticsData|WhaleBubbleChart.sync|AnalyticsTabDeck" --watchAll=false
```

**Expected:** Tất cả test PASS. 0 failure.

---

## 4. Functional audit checklist (manual)

### 4.1 Layout (S1 audit)
- [ ] `/stocks/BMP` render layout 2 cột: KLine trái, sidebar phải.
- [ ] KLine chiếm ≥ 60% chiều rộng màn hình trên 1440px.
- [ ] Sidebar collapse/expand animation smooth.
- [ ] Không có content overflow hoặc scrollbar ngoài ý muốn.
- [ ] TopBar hiển thị giá, % thay đổi, badge sector đúng.

### 4.2 Tab deck (S2 audit)
- [ ] 3 tab hiển thị đúng label: "🐋 Cá Mập", "📊 Order Flow", "🤖 AI Advisory".
- [ ] Active tab có indicator màu (border-bottom màu accent).
- [ ] Switch tab animate smooth (fade + slide).
- [ ] KLine KHÔNG bị flicker/reload khi switch tab.
- [ ] Mở DevTools → Components → xác nhận KLineChartPanel không unmount.

### 4.3 Session sync (S3 + S4 audit)
- [ ] Click nến ngày hôm qua trên KLine.
- [ ] Tab Cá Mập: Bubble Chart hiện dữ liệu đúng ngày.
- [ ] Tab AI Advisory: nhận định có context của session đã chọn.
- [ ] Hover nhiều nến khác nhau → Tab Cá Mập không thay đổi.
- [ ] Đổi timeframe KLine (1H → D) → `selectedTradeDate` reset về null hoặc latest session.

### 4.4 Whale marker viewport rule (S1 audit)
- [ ] Zoom vào KLine (chỉ còn 20 nến visible) → đếm shark markers, phải ≤ ceil(20 * 10%) = 2 markers.
- [ ] Zoom out (100 nến visible) → markers nhiều hơn nhưng vẫn là top 10%.
- [ ] Markers chỉ xuất hiện ở nến có whale signal thực, không ngẫu nhiên.

### 4.5 Redirect (S5 audit)
- [ ] Gõ `localhost/whale-alerts/BMP` → redirect về `localhost/stocks/BMP`.
- [ ] Gõ `localhost/whale-alerts/VNM` → redirect về `localhost/stocks/VNM`.
- [ ] Không có 404 hay loop redirect.

### 4.6 i18n audit (S2–S4)
- [ ] Text "🐋 Cá Mập", "📊 Order Flow", "🤖 AI Advisory" xuất hiện đúng trên UI.
- [ ] Grep trong locale files: `grep -r "commandCenter.tab" frontend/src/locales/`.
- [ ] Không có text hardcode tiếng Việt nằm trực tiếp trong JSX.

---

## 5. Regression audit (sau S5)

Xác nhận các tính năng cũ của Stock Detail KHÔNG bị mất:
- [ ] Phần Financial Metrics (Biên độ ngày, 52W, REF/Trần/Sàn).
- [ ] Phần Watchlist actions (Bỏ theo dõi, Lưu vào nhóm).
- [ ] Price Alert creation.
- [ ] AI Advisory prompt config drawer (AIAdvisoryPromptConfigDrawer).
- [ ] Sector breadth mini panel.

---

## 6. Performance audit

- [ ] KLine chart FPS ≥ 50 khi pan/zoom (DevTools Performance tab).
- [ ] Không có memory leak sau 5 lần switch tab (kiểm tra heap size).
- [ ] Network tab: không có duplicate API calls khi switch tab sau lần mount đầu.
- [ ] Tab Cá Mập: data load ≤ 2 giây trên connection bình thường.
