## 🎯 COMPREHENSIVE DEMO DATASET - VNINVEST

### 📊 Dataset Summary

**Trạng thái:** ✅ HOÀN THÀNH
**Ngày tạo:** April 4, 2026
**Kích thước dữ liệu:** Lớn (phù hợp cho load testing)

---

### 👤 Demo Accounts

| Username | Password | Loại | Ghi chú |
|----------|----------|------|---------|
| `testuser` | `DemoPass@123` | User gốc | Admin, Premium plan |
| `demo_user2` | `DemoPass@123` | User 2 | Premium plan, threshold: 500-1500M |
| `demo_user3` | `DemoPass@123` | User 3 | Premium plan, threshold: 500-1500M |

**Truy cập:**
```bash
# Terminal
cd backend
python manage.py createsuperuser  # Hoặc dùng account trên
```

---

### 📈 Dữ Liệu Được Tạo

#### 1. **Stock Profiles** (28 cổ phiếu)
- **VN30 Bluechips:** VNM, VCB, HPG, MWG, FPT, TCB, BID, VIC, GAS, SAB, BVH, VJC, MSN, VRE, HDB, ERN, MBB, VPB, CTG, POW, KDH, TYA, PNJ, DIG, STB, VNPAY, SBT
- **Loại:** Blue chips + bank + energy + tech
- **Sàn:** HOSE (Hà Nội)
- **Trạng thái:** Tất cả đang giao dịch (is_active=True)

#### 2. **Daily Prices (Giá Đóng Cửa Hàng Ngày)**
- **Phạm vi:** 180 ngày (6 tháng lịch sử)
- **Tính chất:** Volatility ngẫu nhiên 0.5-2.0% mỗi ngày
- **Bao gồm:** Open, High, Low, Close, Volume
- **Dùng để:** Vẽ biểu đồ, tính MA, RSI, MACD, Bollinger Bands, v.v.
- **Kích thước:** ~4,619 records

#### 3. **Portfolios & Sub-accounts** (Per User)
**Per user tạo 3 danh mục:**
- **Danh mục Dài hạn** → 3 sub-accounts (Cash, Special, Margin)
- **Danh mục Giao dịch** → 3 sub-accounts
- **Danh mục Margin** → 3 sub-accounts

**Mỗi sub-account có:**
- 8 giao dịch mẫu (BUY/SELL ngẫu nhiên)
- 30 snapshots NAV (daily, 30 ngày lịch sử)

#### 4. **Intraday Ticks (Tick-by-Tick Data)**
- **Tổng số:** 40,500+ records
- **Phạm vi:** 30 ngày gần đây
- **Tần suất:** ~50 ticks/mã/ngày
- **Bao gồm:** Price, Volume, Side (BUY/SELL/UNKNOWN), Match Type (LO/ATO/MP)
- **Timestamp:** Chính xác đến giây (9:15-14:30 VNM)
- **Dùng để:** VWAP, intraday charts, tick analysis, whale detection

#### 5. **Whale Advisories (AI-Powered Alerts)**
- **Tổng số:** 500 bản ghi
- **Phân bố:** Ngẫu nhiên theo 28 mã, per 20 advisories = 1 điểm lùi thời gian 1 ngày
- **Trường dữ liệu:**
  - `symbol`: VNM, HPG, FPT, v.v.
  - `matched_value`: 500M-5B VNĐ (khối lượng lệnh)
  - `side`: BUY hoặc SELL
  - `ai_summary`: ~50 từ (Pro+ feature)
  - `ai_detail`: ~150 từ chi tiết (Premium+ feature)
  - `ai_provider`: openclaw
  - `prompt_tokens`, `completion_tokens`: Sử dụng token giả lập
- **Hiệu năng:** Feed pagination, filtering, realtime updates

#### 6. **Order Flow Signals (Dark Money Detection)**
- **Tổng số:** 200 bản ghi
- **Loại tín hiệu:**
  - `absorption` (Hấp thụ)
  - `iceberg` (Tảng băng)
  - `twap_bot` (TWAP automation)
  - `mixed` (Kết hợp)
- **Metric:**
  - `strength`: 0-100 (25-95)
  - `confidence`: low/medium/high
  - `tick_rate`: Ticks/phút
  - `small_order_ratio`: Tỷ lệ lệnh nhỏ
  - `cvd_at_signal`: Cumulative Volume Delta
  - `window_seconds`: 5m/15m/30m/1h
- **Dùng để:** Order Flow Radar dashboard, signal detection

#### 7. **AI Advisory Components (Multi-Tab System)**
- **Tổng số:** 100 bản ghi
- **Loại thành phần:**
  - Price Action (Support/Resistance, Trendline, Channel)
  - Indicator (RSI, MACD, Stochastic, Bollinger Bands)
  - Volume/Order Flow (Volume Profile, CVD, Order Flow Delta)
  - Sentiment (Market Sentiment, Whale Activity, Retail Bias)
- **Status:** Overbought/Oversold/Accumulation/Breakout/Neutral
- **Suggested Action:** Watch/Buy/Sell/Hold Off
- **Dùng để:** Multi-tab AI advisory cards, component breakdown

#### 8. **Price Alert Rules**
- **Tổng số:** 52 quy tắc (per user × symbols)
- **Bao gồm:**
  - Condition: ABOVE hoặc BELOW
  - Target price: ±2000 từ giá base
  - Cooldown: 300-3600 giây
  - Active: 75% active (25% disabled)
- **Dùng để:** Real-time price monitoring, notifications

#### 9. **Screener Rules (Bộ Lọc Động)**
- **Tổng số:** 10 quy tắc (4 template × 3 users - 2 duplicate)
- **Template:**
  - "Bluechip tăng thanh khoản" (RSI < 50, Momentum > 1.5%)
  - "Ngân hàng giữ nền" (SMA20±5%, SMA50 stable)
  - "Momentum breakout" (Volume × 1.5, Price +2% in 3 days)
  - "Asymptotic recovery" (52w low +10%, RSI > 30)
- **Dùng để:** Stock screening, watchlist generation

#### 10. **Watchlists & Trackers** (Per User)
- **Danh sách theo dõi:** 3 nhóm (Theo dõi sát, Tích lũy dài hạn, Cảnh báo đặc biệt)
- **Mã/nhóm:** 5-8 mã per nhóm
- **Tracked symbols:** 8-12 mã per user
- **Market groups:** Tự động phân nhóm theo sector

---

### 🎮 Test Scenarios

#### Scenario 1: **Load Testing - Feed Pagination**
```
Feature: Whale Alerts Hub → AI Advisory Feed
Data: 500 advisories × 3 users = 1500 total records
Test: Scroll, filter by symbol, sort by time
Expected: <200ms response time per page
```

#### Scenario 2: **Realtime Intraday Analysis**
```
Feature: Stock Detail → Intraday Charts & Ticks
Data: 40,500 intraday ticks
Test: Load /stocks/HPG, display tick history
Expected: Chart render <500ms, tick table paginate smoothly
```

#### Scenario 3: **Order Flow Radar**
```
Feature: Whale Alerts → Order Flow Radar
Data: 200 OrderFlowSignal records
Test: Toggle 5m/15m/30m/1h windows, visualize CVD
Expected: Live update <100ms, SVG render <300ms
```

#### Scenario 4: **AI Advisory Drilldown**
```
Feature: Stock Detail → AI Summary Tab
Data: 100 AIAdvisoryComponentRecord per user
Test: Open AI advisory, expand component breakdown
Expected: 4 tabs load simultaneously <250ms total
```

#### Scenario 5: **Screener Execution**
```
Feature: Stock Screener
Data: 28 stocks × 4 screener rules
Test: Run screener "Bluechip tăng thanh khoản"
Expected: Filter results <500ms, show matching stocks
```

---

### 🔧 Phương Thức Truy Cập Dữ Liệu

#### Via Django ORM (Python)
```python
# Whale advisories
from portfolio.models import WhaleAdvisory
advisories = WhaleAdvisory.objects.filter(symbol='HPG').order_by('-created_at')[:20]

# Intraday ticks
from portfolio.models import IntradayTick
ticks = IntradayTick.objects.filter(symbol='FPT', trade_date=date.today())

# Order flow signals
from portfolio.models import OrderFlowSignal
signals = OrderFlowSignal.objects.filter(signal_type='absorption').order_by('-strength')
```

#### Via Django Admin Panel
```
URL: http://localhost:8000/admin/
User: testuser / DemoPass@123
Sections:
  - Whale Advisories
  - Intraday Ticks
  - Order Flow Signals
  - AI Advisory Components
  - Portfolios & Transactions
  - Price Alert Rules
  - Screener Rules
```

#### Via REST API (if enabled)
```bash
# Whale advisories
curl http://localhost:8000/api/whale-advisories/?symbol=HPG&limit=50

# Order flow signals
curl http://localhost:8000/api/order-flow-signals/?signal_type=absorption

# Intraday ticks
curl http://localhost:8000/api/intraday-ticks/?symbol=FPT&date=2026-04-04
```

---

### 📊 Database Stats

| Model | Count | Purpose |
|-------|-------|---------|
| StockProfile | 28 | Static stock info |
| DailyPrice | 4,619+ | OHLCV history |
| IntradayTick | 40,500+ | Tick-level trades |
| WhaleAdvisory | 500 | Whale alerts + AI insights |
| OrderFlowSignal | 200 | Dark money detection |
| AIAdvisoryComponentRecord | 100 | Component breakdown |
| Portfolio | 9 (3 users × 3) | User portfolios |
| SubAccount | 27 (3 users × 3 × 3) | Account types |
| Transaction | 24+ | Trade history |
| AccountSnapshot | 90+ | NAV history |
| WatchlistGroup | 9 (3 users × 3) | User watchlists |
| WatchlistItem | 50+ | Stocks in watchlists |
| TrackedSymbol | 25+ | Tracked by users |
| PriceAlertRule | 52+ | Price alerts |
| ScreenerRule | 10 | Filter templates |
| **TOTAL** | **~46,000+** | Production-like dataset |

---

### 🚀 Giới Hạn & Luận Cứ Kích Thước

**Tại sao 180 ngày daily prices?**
- 6 tháng đủ để test charting library (Recharts) performances
- Đủ để tính moving averages (MA20, MA50, MA200)
- Đủ timeline để UI display meaningful trends

**Tại sao 40,500 intraday ticks?**
- ~50 ticks/mã/ngày × 28 mã × 30 ngày = ~42,000
- Đủ để test intraday table pagination (1000 rows per page)
- Test VWAP, cumulative volume calculations
- Simulate realistic HFT-like volume distribution

**Tại sao 500 whale advisories?**
- 500 records ≈ 16-17 per day over 30 days
- Đủ để test feed pagination (20-50 per page)
- Đủ để test filtering, sorting performance
- Simulate realistic whale alert frequency in active market

**Tại sao OrderFlowSignal & AIAdvisoryComponent kiểm chế?**
- OrderFlowSignal: 200 records = small subset (signal rarity)
- AIAdvisoryComponent: 100 records = deep drill-down depth
- Tất cả mapped to users & symbols → test JOIN performance

---

### 🔍 Verification Commands

```bash
# Bash/PowerShell - Check record counts
cd backend
python manage.py shell

# Inside Django shell
from portfolio.models import *
from django.contrib.auth.models import User

# Count data
print(f"Users: {User.objects.count()}")
print(f"Stocks: {StockProfile.objects.count()}")
print(f"Daily Prices: {DailyPrice.objects.count()}")
print(f"Intraday Ticks: {IntradayTick.objects.count()}")
print(f"Whale Advisories: {WhaleAdvisory.objects.count()}")
print(f"Order Flow Signals: {OrderFlowSignal.objects.count()}")
print(f"AI Components: {AIAdvisoryComponentRecord.objects.count()}")

# Sample queries
print("\nRecent Whale Advisories (HPG):")
print(WhaleAdvisory.objects.filter(symbol='HPG').order_by('-created_at')[:3])

print("\nToday's Intraday Ticks (FPT):")
from datetime import date
print(IntradayTick.objects.filter(symbol='FPT', trade_date=date.today()).count())
```

---

### 🎯 Next Steps

**1. Frontend Testing:**
```bash
cd frontend
npm start  # http://localhost:3000
# Login with: testuser / DemoPass@123
# Navigate to:
#  - /stocks/HPG → View intraday ticks, whale feed
#  - /whale-alerts/HPG → View Order Flow Radar
#  - /whale-advisory → Scroll through 500 advisories
#  - /screener → Run screening rules
```

**2. Backend Load Testing:**
```bash
# Use Apache Bench or Locust
ab -n 1000 -c 50 http://localhost:8000/api/whale-advisories/

# Or use Django test client:
python manage.py test portfolio.tests
```

**3. Database Optimization:**
```bash
python manage.py shell
from django.db import connection
from django.test.utils import CaptureQueriesContext

# Profile query performance
with CaptureQueriesContext(connection) as ctx:
    WhaleAdvisory.objects.filter(symbol='HPG')[:20]
print(f"Queries: {len(ctx.captured_queries)}, Time: {sum([q['time'] for q in ctx.captured_queries])}")
```

---

### 📝 Seed Command Usage

**Create bộ dữ liệu theo cách khác:**
```bash
# Default (như trên)
python manage.py seed_comprehensive_demo

# Custom scale
python manage.py seed_comprehensive_demo \
  --users=5 \
  --symbols=30 \
  --days=365 \
  --ticks-per-symbol-per-day=100 \
  --advisories=1000 \
  --signals=500 \
  --components=250 \
  --reset

# Reset only
python manage.py seed_comprehensive_demo --reset

# Mini dataset (testing)
python manage.py seed_comprehensive_demo \
  --users=1 --symbols=5 --days=30 \
  --advisories=50 --signals=20 --components=10
```

---

### ⚙️ Configuration

**File tạo:** `backend/portfolio/management/commands/seed_comprehensive_demo.py`

**Tuning parameters trong script:**
- `BASE_PRICES`: Dictionary giá base mỗi mã
- `VN30_SYMBOLS`: Danh sách mã + metadata
- `AI_DESCRIPTIONS`: Template AI advisory text
- `ORDER_FLOW_SIGNALS`: List các loại signal
- Randomization: `uniform()`, `randint()`, `choice()`

---

### 🎉 Ready for Testing!

✅ Dataset đây đủ để test:
- UI responsiveness
- Database query performance
- API endpoint scalability
- Real-time data streaming (WebSocket)
- Feed pagination & filtering
- Chart rendering with large datasets
- Multi-user concurrent access

**Login & Start Testing:**
```
URL: http://localhost:3000
User: testuser
Password: DemoPass@123
```

---

Generated: 2026-04-04
Command: `seed_comprehensive_demo`
Status: ✅ COMPLETED
