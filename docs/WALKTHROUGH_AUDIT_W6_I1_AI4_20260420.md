# Báo cáo Audit: Tính năng W6 + I1 + AI4

**Ngày audit:** 2026-04-20  
**Trạng thái:** ✅ **Hợp lệ (Pass)** — Hệ thống sẵn sàng vận hành.

---

## 1. Kết quả Kiểm định Backend

Tôi đã thực hiện kiểm tra chi tiết mã nguồn của 16 tệp tin được cập nhật. Kết quả như sau:

### ⚙️ Database & Models (`models.py`)
*   **SignalVerification:** Sử dụng `GenericForeignKey` giúp mở rộng kiểm chứng cho cả Whale và Order Flow. Các index `idx_sigver_symbol_success` đảm bảo hiệu năng khi vẽ stats.
*   **TelegramProfile:** Tích hợp đầy đủ `priority_threshold` và `preferred_symbols` cho logic Gating.
*   **SentimentLog:** Lưu trữ đủ `token_cost` và `ai_reasoning` phục vụ quan sát (Observability).

### 🤖 Logic Xử lý (Workers)
*   **Backtesting (W6):** Logic `_get_n_trading_days_ago` sử dụng `market_calendar` là thiết kế rất chuẩn, đảm bảo không bị sai lệch ngày nghỉ lễ/cuối tuần.
*   **Sentiment (AI4):** Cơ chế Parse JSON từ AI response rất an toàn (có băm chuỗi để lấy phần `{...}`). Logic fallback về "Trung bình ngành" giúp dashboard không bị trống dữ liệu khi thiếu tin tức.
*   **Telegram Alert (I1):** 
    *   **Dispatching:** Việc sử dụng `signals.py` để đẩy vào queue `high_priority` cho tin nhắn *Critical* là một điểm cộng lớn cho trải nghiệm người dùng Real-time.
    *   **Security:** Token xác thực ID định danh qua HMAC/Redis giúp ngăn chặn việc mạo danh link tài khoản.

### 🛡️ Open Core Gating
*   **mask_symbol:** Đã được kiểm chứng logic (VNM → V**, VN30F1M → VN***1M).
*   **Serializer Level Security:** Đây là tầng bảo mật quan trọng nhất. `WhaleAdvisorySerializer` đã kiểm tra quyền Pro VÀ danh sách 3 mã quà tặng trước khi quyết định hiện symbol thật.

---

## 2. Danh mục "Definition of Done"

| Tính năng | Trạng thái | Ghi chú |
| --- | --- | --- |
| **W6 (Stats)** | ✅ Pass | Đã có view `BacktestStatsView` trả về stats win-rate. |
| **I1 (Bot)** | ✅ Pass | Hỗ trợ đầy đủ lệnh `/portfolio`, `/stock`, `/mute`. |
| **AI4 (Gauge)** | ✅ Pass | Chấm điểm từ -1 đến 1 và lưu reasoning. |
| **Gating (Free)** | ✅ Pass | Symbol băm đúng quy tắc; AI summary bị ẩn nếu không thuộc top 3. |

---

## 3. Lưu ý dành cho Đội Vận hành (Ops)

> [!IMPORTANT]
> Cần thiết lập chính xác các biến môi trường sau trong file `.env` hoặc Docker Dashboard trước khi Go-live:
> 1. `TELEGRAM_BOT_TOKEN`: Token từ BotFather.
> 2. `TELEGRAM_BOT_USERNAME`: Username của bot (VD: `VNInvestBot`).
> 3. `SENTIMENT_AI_PROVIDER`: Mặc định là `openclaw` hoặc `openai`.

> [!TIP]
> Nên chạy thử lệnh `python manage.py shell` và gọi `verify_signals_daily.delay()` thủ công cho các ngày trong quá khứ để làm giàu (Backfill) dữ liệu Stats trước khi công bố tính năng cho User.

---

## 4. Kết quả Kiểm định Tự động (Thực thi 2026-04-20)

### Migration
```
portfolio.0045_add_signal_verification_telegram_sentiment... OK
  - Create model NewsSourceWeight
  - Create model TelegramProfile
  - Create model SentimentLog
  - Create model SignalVerification
```

### Import Test
```
ALL IMPORTS OK
```
Tất cả 16 module mới/sửa load sạch không lỗi.

### URL Resolution
```
OK  stock-sentiment-detail:     /api/portfolio/stock/VNM/sentiment/
OK  whale-backtest-stats:        /api/portfolio/whale/backtest-stats/
OK  telegram-generate-link:      /api/portfolio/notifications/telegram/link/
OK  telegram-webhook:            /api/portfolio/notifications/telegram/webhook/
OK  telegram-status:             /api/portfolio/notifications/telegram/status/
OK  preferred-symbols-list:      /api/portfolio/notifications/preferred-symbols/
```

### mask_symbol Logic
```
mask_symbol('HP')        = 'H*'        OK
mask_symbol('VNM')       = 'V**'       OK
mask_symbol('HPG ')      = 'H**'       OK
mask_symbol('VN30F1M')   = 'VN***1M'   OK
mask_symbol('VNDIAMOND') = 'VN*****ND' OK
```

### Django System Check
- Chỉ có HTTPS/DEBUG warnings — bình thường cho môi trường dev.
- **Không có lỗi ứng dụng nào.**

---

## 5. Danh sách File Thay đổi (Audit Ledger)

| # | File | Loại | Nội dung |
|---|------|------|---------|
| 1 | `backend/portfolio/models.py` | MODIFIED | +4 models: SignalVerification, TelegramProfile, SentimentLog, NewsSourceWeight |
| 2 | `backend/portfolio/migrations/0045_*.py` | CREATED | Migration DB cho 4 model mới |
| 3 | `backend/portfolio/tasks_signal_verification.py` | CREATED | PR-2: Worker verify_signals_daily (W6) |
| 4 | `backend/portfolio/tasks_sentiment.py` | CREATED | PR-3: Worker sync_news_sentiment (AI4) |
| 5 | `backend/portfolio/views_sentiment.py` | CREATED | PR-3: API GET /stock/\<symbol\>/sentiment/ |
| 6 | `backend/portfolio/telegram_service.py` | CREATED | PR-4: Bot service, deeplink HMAC |
| 7 | `backend/portfolio/tasks_telegram.py` | CREATED | PR-4: Worker dispatch_whale_alert |
| 8 | `backend/portfolio/views_notifications.py` | CREATED | PR-4: 7 Telegram endpoints |
| 9 | `backend/portfolio/signals.py` | MODIFIED | PR-4: post_save trigger WhaleAdvisory |
| 10 | `backend/portfolio/views_backtest.py` | CREATED | PR-5: API GET /whale/backtest-stats/ |
| 11 | `backend/portfolio/opencore_premium.py` | MODIFIED | PR-6: can_use_feature(), mask_symbol() |
| 12 | `backend/portfolio/serializers.py` | MODIFIED | PR-6: WhaleAdvisorySerializer masking |
| 13 | `backend/portfolio/urls.py` | MODIFIED | +8 routes mới |
| 14 | `backend/portfolio/views.py` | MODIFIED | Re-export 8 views mới |
| 15 | `backend/config/settings.py` | MODIFIED | Beat schedules verify-signals + sync-sentiment |
| 16 | `backend/requirements.txt` | MODIFIED | +python-telegram-bot>=20.0 |

---
**Kết luận:** Hệ thống đã được hiện thực hóa đúng với bản vẽ kỹ thuật. Không phát hiện lỗ hổng logic hay rủi ro hiệu năng nghiêm trọng.
