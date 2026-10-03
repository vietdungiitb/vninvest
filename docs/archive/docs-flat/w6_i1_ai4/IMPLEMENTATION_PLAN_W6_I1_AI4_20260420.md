# Kế hoạch Triển khai: W6 (Backtesting) + I1 (Telegram Bot) + AI4 (Sentiment)

**Ngày soạn:** 2026-04-20  
**Trạng thái:** ĐÃ CHỐT — Sẵn sàng code  
**Tham chiếu spec:**
- `docs/FEATURE_PLAN_WHALE_BOT_SENTIMENT_SPEC_20260420.md`
- `docs/TECHNICAL_SPEC_DATABASE_SCHEMA_20260420.md`
- `docs/TECHNICAL_SPEC_API_BOT_INTERFACE_20260420.md`
- `docs/TECHNICAL_SPEC_ALGORITHM_WORKER_LOGIC_20260420.md`

---

## 1. Hiện trạng Codebase (Audit nhanh)

| Thành phần | Tệp hiện có | Trạng thái |
|---|---|---|
| `WhaleAdvisory`, `OrderFlowSignal`, `DailyPrice` | `portfolio/models.py` | ✅ Sẵn có |
| `PremiumFeatureGate` | `portfolio/opencore_premium.py` | ✅ Sẵn có |
| Celery beat, Redis queue | `config/`, `tasks_*.py` | ✅ Sẵn có |
| WebSocket broadcast | `tasks_whale_broadcast.py` | ✅ Sẵn có |
| `market_calendar.py` | `portfolio/market_calendar.py` | ✅ Sẵn có |
| `ai_service.py` | `portfolio/ai_service.py` | ✅ Sẵn có |
| OpenNews pipeline | `tasks_news_context.py` | ✅ Sẵn có |
| **`SignalVerification`** | — | ❌ Chưa có |
| **`TelegramProfile`** | — | ❌ Chưa có |
| **`SentimentLog`** | — | ❌ Chưa có |
| **`NewsSourceWeight`** | — | ❌ Chưa có |
| **Telegram Bot integration** | — | ❌ Chưa có |
| **Sentiment worker + API** | — | ❌ Chưa có |
| **`mask_symbol()` tập trung** | — | ❌ Chưa có |

---

## 2. Cấu trúc PR — Thứ tự triển khai

```
PR-1 (DB Models + Migration)
    │
    ├──► PR-2 (W6 Backtesting Worker)
    │
    ├──► PR-3 (AI4 Sentiment Worker + API)
    │
    └──► PR-4 (I1 Telegram Bot)
              │
              └──► PR-5 (Frontend: Gauge + Badge + Settings)
                        │
                        └──► PR-6 (Open Core Gating Hardening)
```

PR-2, PR-3, PR-4 có thể chạy **song song** sau khi PR-1 merge.

---

## 3. PR-1 — Database Foundation

**Ước tính:** 2–3 giờ  
**Tệp thay đổi:**
- `backend/portfolio/models.py` — thêm 4 model mới (cuối file)
- `backend/portfolio/migrations/00xx_add_signal_verification_telegram_sentiment.py` — tự sinh bằng `makemigrations`

### 3.1 Model `SignalVerification` (W6)

```python
class SignalVerification(models.Model):
    # Generic FK — trỏ tới WhaleAdvisory hoặc OrderFlowSignal
    content_type              = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id                 = models.PositiveIntegerField()
    original_signal           = GenericForeignKey('content_type', 'object_id')

    symbol                    = models.CharField(max_length=10, db_index=True)
    signal_price              = models.DecimalField(max_digits=15, decimal_places=2)
    t3_price                  = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    vnindex_price_at_signal   = models.DecimalField(max_digits=15, decimal_places=2)   # T0
    vnindex_price_t3          = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)  # T3
    alpha_score               = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    is_success                = models.BooleanField(default=False)
    data_warning              = models.BooleanField(default=False)   # giá lệch > 1%
    processed_at              = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['symbol', 'is_success']),
            models.Index(fields=['processed_at']),
            models.Index(fields=['content_type', 'object_id']),
        ]
```

### 3.2 Model `TelegramProfile` (I1)

```python
class TelegramProfile(models.Model):
    user                = models.OneToOneField(User, on_delete=models.CASCADE, related_name='telegram_profile')
    telegram_user_id    = models.BigIntegerField(unique=True)
    chat_id             = models.BigIntegerField()
    is_verified         = models.BooleanField(default=False)
    priority_threshold  = models.IntegerField(
        default=2,
        choices=[(1, 'High/Critical only'), (2, 'High+Normal'), (3, 'All')]
    )
    mute_until          = models.DateTimeField(null=True, blank=True)
    last_interacted_at  = models.DateTimeField(auto_now=True)
    preferred_symbols   = models.JSONField(default=list, blank=True)  # max 3 mã cho Free

    class Meta:
        verbose_name = 'Telegram Profile'
```

### 3.3 Model `SentimentLog` (AI4)

```python
class SentimentLog(models.Model):
    symbol          = models.CharField(max_length=10, db_index=True)
    sentiment_score = models.DecimalField(max_digits=5, decimal_places=2)  # -1.00 đến 1.00
    source_type     = models.CharField(max_length=20, default='news')       # news, social, web
    headline_count  = models.IntegerField(default=0)
    ai_reasoning    = models.TextField(blank=True, default='')
    token_cost      = models.IntegerField(default=0)
    captured_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['symbol', '-captured_at']),
        ]
```

### 3.4 Model `NewsSourceWeight` (AI4 — spec còn thiếu)

```python
class NewsSourceWeight(models.Model):
    source_name = models.CharField(max_length=100, unique=True)  # 'cafef', 'vietstock', 'opennews'
    weight      = models.FloatField(default=1.0)                 # 0.0 – 2.0
    is_active   = models.BooleanField(default=True)
```

---

## 4. PR-2 — Whale Backtesting Worker (W6)

**Ước tính:** 3–4 giờ  
**Tệp tạo mới:** `backend/portfolio/tasks_signal_verification.py`  
**Tệp sửa:** Beat schedule trong `config/` hoặc `tasks.py`

### Logic Worker `verify_signals_daily`

```
Trigger: 16:30 ICT hàng ngày (CronTrigger)

1. Tính ngày T0 = today - 3 ngày GIAO DỊCH (dùng market_calendar.py)
2. Lấy tất cả WhaleAdvisory và OrderFlowSignal có created_at.date() == T0
3. Với mỗi tín hiệu:
   a. Bỏ qua nếu symbol là IPO < 30 ngày giao dịch
   b. Lấy DailyPrice.close_price của symbol tại today → t3_price
   c. Validate adjusted price: so sánh với backup source, nếu lệch > 1% → data_warning=True, bỏ tính alpha
   d. Lấy DailyPrice của 'VNINDEX' tại T0 → vnindex_price_at_signal
   e. Lấy DailyPrice của 'VNINDEX' tại today → vnindex_price_t3
      ⚠️ LƯU Ý: Cả t3_price (cổ phiếu) và vnindex_price_t3 phải được lấy từ
         cùng một mốc thời gian chốt giá 16:30 ICT để đảm bảo so sánh đồng nhất.
         Dùng DailyPrice.close_price (EOD), KHÔNG dùng giá intraday.
   f. Tính alpha = ((t3_price/signal_price) - 1) - ((vnindex_t3/vnindex_t0) - 1)
   g. is_success = True nếu alpha > 0 HOẶC price_change > 2%
   h. Tạo hoặc cập nhật SignalVerification
```

### Beat Schedule cần thêm

```python
'verify-signals-daily': {
    'task': 'portfolio.tasks_signal_verification.verify_signals_daily',
    'schedule': crontab(hour=9, minute=30, day_of_week='1-5'),  # 16:30 ICT = 09:30 UTC
},
```

---

## 5. PR-3 — AI Sentiment Worker + API (AI4)

**Ước tính:** 4–5 giờ  
**Tệp tạo mới:**
- `backend/portfolio/tasks_sentiment.py`
- `backend/portfolio/views_sentiment.py`

**Tệp sửa:** `backend/portfolio/urls.py`

### Worker `sync_news_sentiment`

```
Trigger: Mỗi 30 phút (PeriodicTask)

1. Lấy danh sách symbol đang active (từ DailyPrice hoặc Portfolio)
2. Với mỗi symbol:
   a. Quét tiêu đề tin 24h qua từ OpenNews pipeline (đã có)
   b. Lấy trọng số nguồn từ NewsSourceWeight
   c. Gọi ai_service.py với prompt:
      "Chấm điểm tâm lý danh sách tiêu đề từ -1 đến 1.
       Tóm tắt lý do trong 30 từ tiếng Việt."
   d. Nếu nhiều batch → Weighted Average theo headline_count * source_weight
   e. Fallback: không có tin → dùng trung bình SentimentLog của ngành trong 7 ngày
   f. Vẫn không có → score=0.0, ai_reasoning='Dữ liệu hạn chế'
   g. Lưu SentimentLog mới
```

### API Endpoint

```
GET /api/v1/stock/<symbol>/sentiment/

Response (Pro):
{
  "symbol": "VNM",
  "current_score": 0.75,
  "status": "Bullish",           # Bullish / Slightly Bullish / Neutral / Slightly Bearish / Bearish
  "summary": "Dòng tiền lớn vào mạnh...",
  "history_7d": [
    {"date": "2026-04-19", "score": 0.60},
    ...
  ]
}

Response (Free — gating):
{
  "symbol": "VNM",
  "current_score": null,
  "status": "Bullish",           # Chỉ trả label, không có số và history
  "summary": null,
  "history_7d": null,
  "upgrade_prompt": "Nâng cấp Pro để xem lịch sử và điểm số chi tiết"
}
```

---

## 6. PR-4 — Telegram Bot (I1)

**Ước tính:** 6–8 giờ  
**Tệp sửa:** `backend/requirements.txt` — thêm `python-telegram-bot>=20.0`  
**Tệp tạo mới:**
- `backend/portfolio/telegram_service.py`
- `backend/portfolio/tasks_telegram.py`
- `backend/portfolio/views_notifications.py`

**Tệp sửa:** `backend/portfolio/urls.py`

### 6.1 Authentication Flow

```
1. User nhấn "Link Telegram" trên Web
2. Backend sinh token = BASE64(user_id + timestamp + HMAC)
   → TTL: 15 phút, lưu vào Redis
3. Trả về deep link: https://t.me/VNInvestBot?start=<TOKEN>
4. Telegram gọi Webhook POST /api/v1/notifications/telegram/webhook/
5. Backend xác thực token → tạo TelegramProfile với chat_id từ update
```

### 6.2 Task `telegram_alert_dispatcher`

```
Trigger: Signal post_save của WhaleAdvisory

⚠️ LƯU Ý QUAN TRỌNG — ASYNC DISPATCH:
Hàm handler trong signals.py CHỈ được gọi:
    telegram_alert_dispatcher.delay(advisory_id=advisory.pk)
KHÔNG được xử lý logic trực tiếp trong post_save handler.
Mục đích: tránh làm chậm (block) quá trình ghi DB của tín hiệu gốc.
Toàn bộ logic bên dưới chạy bên trong Celery worker.

1. Xác định severity từ matched_value:
   - Critical: > 50 tỷ VNĐ
   - High:     > 10 tỷ VNĐ
   - Normal:   còn lại

2. Lấy danh sách TelegramProfile có is_verified=True

3. Với mỗi profile:
   a. Nếu mute_until > now() và severity != Critical → bỏ qua
   b. Nếu priority_threshold < severity_level → bỏ qua
   c. Nếu user.plan == 'free':
      - Nếu symbol không trong preferred_symbols (max 3) → bỏ qua
      - Mask symbol: mask_symbol(symbol)
   d. Format tin nhắn theo template MarkdownV2
   e. Đưa vào queue:
      - Critical → Celery queue 'high_priority'
      - Normal   → Celery queue 'default'

4. Gửi qua Telegram Bot API
```

### 6.3 `mask_symbol()` — quy tắc tập trung

```python
def mask_symbol(symbol: str) -> str:
    """
    VNM       → V**
    HP        → H*
    VN30F1M   → VN***1M
    Quy tắc: giữ 1-2 ký tự đầu, mask giữa bằng *, giữ 2 ký tự cuối nếu dài > 4
    """
```

⚠️ LƯU Ý VỀ VỊ TRÍ TRIỂN KHAI:
`mask_symbol()` phải được định nghĩa trong `opencore_premium.py` nhưng
**gọi tại tầng `serializers.py` của DRF**, không phải trong View hay Task.
Đảm bảo dữ liệu được băm ngay trước khi xuất ra JSON —
an toàn tuyệt đối kể cả khi có lỗi logic ở tầng View hay Task.

```python
# Ví dụ trong WhaleAdvisorySerializer:
class WhaleAdvisorySerializer(serializers.ModelSerializer):
    symbol = serializers.SerializerMethodField()

    def get_symbol(self, obj):
        request = self.context.get('request')
        if request and not PremiumFeatureGate.can_use(request.user, 'telegram_bot_full'):
            return mask_symbol(obj.symbol)
        return obj.symbol
```

### 6.4 Bot Commands

| Command | Hành vi | Gating |
|---|---|---|
| `/portfolio` | Inline Keyboard danh sách danh mục → nhấn nút → editMessageText P/L | Free: NAV tổng; Pro: chi tiết từng mã |
| `/stock <symbol>` | Tóm tắt AI Advisory từ `WhaleAdvisory.ai_summary` | Free: masked symbol |
| `/mute 1h` | Set `mute_until = now + 1h` | All |
| `/settings` | Link deep link về Web App | All |

---

## 7. PR-5 — Frontend

**Ước tính:** 4–5 giờ  
**Tệp tạo mới:**
- `frontend/src/components/SentimentGauge.jsx`

**Tệp sửa:**
- Whale Feed component — thêm win-rate badge
- Settings page — thêm nút "Link Telegram"

### 7.1 `SentimentGauge` (ECharts)

```
- ECharts gauge chart: -1 (đỏ) → 0 (vàng) → +1 (xanh)
- Hiển thị trong tab AI Advisory
- Tooltip: hiện ai_reasoning khi hover
- Dùng API GET /api/v1/stock/<symbol>/sentiment/
- Nếu user Free: hiện gauge bị blur + lock icon + "Nâng cấp Pro"
```

### 7.2 Win-rate Badge trong Whale Feed

```
- Gọi GET /api/v1/whale/backtest-stats/?symbol=VNM
- Hiện badge nhỏ: "▲ 68% Win" màu xanh / "▼ 32% Win" màu đỏ
- Nếu chưa đủ dữ liệu (< 10 tín hiệu): hiện "Đang thu thập..."
- Chỉ hiện cho user Pro
```

### 7.3 Telegram Link trong Settings

```
- Nút "Kết nối Telegram" → POST /api/v1/notifications/telegram/link/
- Nhận deep link → mở tab mới tới t.me/VNInvestBot?start=...
- Sau khi link thành công: hiện status + nút "Ngắt kết nối"
- Toggle ngưỡng cảnh báo: High only / High+Normal / Tất cả
```

---

## 8. PR-6 — Open Core Gating Hardening

**Ước tính:** 2–3 giờ  
**Tệp sửa:** `backend/portfolio/opencore_premium.py`

### Feature keys mới cần đăng ký

```python
'whale_backtesting':     min_plan='pro'
'sentiment_analysis':    min_plan='pro'
'telegram_bot_full':     min_plan='pro'        # full symbol, no mask
'telegram_bot_community': min_plan='free'      # market-wide alerts only
'preferred_symbols_crud': min_plan='free'      # quản lý 3 mã quà tặng
```

### API quản lý `preferred_symbols`

```
GET    /api/v1/notifications/preferred-symbols/   → Lấy danh sách (max 3)
POST   /api/v1/notifications/preferred-symbols/   → Thêm mã (check max 3, nếu vượt → 402 Upgrade)
DELETE /api/v1/notifications/preferred-symbols/<symbol>/  → Xóa mã
```

---

## 9. Danh mục tệp sẽ tạo/sửa (Tổng hợp)

| # | Tệp | Hành động | PR |
|---|---|---|---|
| 1 | `backend/portfolio/models.py` | **Sửa** — thêm 4 model cuối file | PR-1 |
| 2 | `backend/portfolio/migrations/00xx_*.py` | **Tạo** — auto bởi makemigrations | PR-1 |
| 3 | `backend/portfolio/tasks_signal_verification.py` | **Tạo mới** | PR-2 |
| 4 | Beat schedule config | **Sửa** | PR-2 |
| 5 | `backend/portfolio/tasks_sentiment.py` | **Tạo mới** | PR-3 |
| 6 | `backend/portfolio/views_sentiment.py` | **Tạo mới** | PR-3 |
| 7 | `backend/portfolio/urls.py` | **Sửa** — thêm routes | PR-3,4,5,6 |
| 8 | `backend/requirements.txt` | **Sửa** — `python-telegram-bot>=20.0` | PR-4 |
| 9 | `backend/portfolio/telegram_service.py` | **Tạo mới** | PR-4 |
| 10 | `backend/portfolio/tasks_telegram.py` | **Tạo mới** | PR-4 |
| 11 | `backend/portfolio/views_notifications.py` | **Tạo mới** | PR-4 |
| 12 | `backend/portfolio/views_backtest.py` | **Tạo mới** | PR-5 |
| 13 | `frontend/src/components/SentimentGauge.jsx` | **Tạo mới** | PR-5 |
| 14 | `frontend/src/pages/Settings.jsx` (hoặc tương đương) | **Sửa** | PR-5 |
| 15 | Whale Feed component | **Sửa** — thêm win-rate badge | PR-5 |
| 16 | `backend/portfolio/opencore_premium.py` | **Sửa** — feature keys + định nghĩa `mask_symbol()` | PR-6 |
| 17 | `backend/portfolio/serializers.py` | **Sửa** — gọi `mask_symbol()` tại tầng Serializer | PR-6 |

**Tổng:** 17 tệp, 6 PR, có thể song song từ PR-2 trở đi.

---

## 10. Điều kiện "Done" mỗi PR

| PR | Done khi |
|---|---|
| PR-1 | `manage.py migrate` chạy không lỗi; 4 bảng xuất hiện trong DB |
| PR-2 | Task chạy thủ công với `call_command` → tạo được `SignalVerification` rows |
| PR-3 | API `/sentiment/` trả đúng JSON; Worker tạo được `SentimentLog` rows |
| PR-4 | Bot phản hồi `/portfolio` command; alert được đẩy khi có Whale signal mới |
| PR-5 | `SentimentGauge` render trên staging; win-rate badge hiện đúng |
| PR-6 | User Free không thấy symbol thật trong Bot và API; test bằng cách gọi API với token Free và kiểm tra symbol trong response JSON |
