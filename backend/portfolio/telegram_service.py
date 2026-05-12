"""
PR-4 — I1: Telegram Bot Service
- Quản lý deep link auth (OTP token TTL 15 phút, lưu Redis).
- Webhook handler: nhận update từ Telegram.
- Gửi tin nhắn với gating logic (mask_symbol cho Free user).
- Handler các lệnh: /portfolio, /stock <symbol>, /mute <duration>, /settings.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

_DEEPLINK_TOKEN_TTL_SECONDS = 900          # 15 phút
_DEEPLINK_CACHE_PREFIX = 'tg_deeplink:'
_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', 'VNInvestBot')
_CRITICAL_THRESHOLD_VND = 50_000_000_000  # 50 tỷ
_HIGH_THRESHOLD_VND     = 10_000_000_000  # 10 tỷ


# ── Token / Deep Link ────────────────────────────────────────────────────────

def generate_deeplink_token(user_id: int) -> str:
    """Tạo token HMAC-SHA256 và lưu vào Redis với TTL 15 phút."""
    timestamp = int(timezone.now().timestamp())
    payload = f'{user_id}:{timestamp}'
    secret = os.getenv('SECRET_KEY', 'django-insecure-secret')
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    raw = f'{payload}:{sig}'
    token = base64.urlsafe_b64encode(raw.encode()).decode().rstrip('=')

    cache.set(f'{_DEEPLINK_CACHE_PREFIX}{token}', user_id, timeout=_DEEPLINK_TOKEN_TTL_SECONDS)
    return token


def validate_deeplink_token(token: str) -> int | None:
    """Xác thực token. Trả về user_id nếu hợp lệ, None nếu hết hạn/sai."""
    user_id = cache.get(f'{_DEEPLINK_CACHE_PREFIX}{token}')
    if user_id is not None:
        cache.delete(f'{_DEEPLINK_CACHE_PREFIX}{token}')  # One-time use
    return user_id


def get_deeplink_url(token: str) -> str:
    return f'https://t.me/{_BOT_USERNAME}?start={token}'


# ── Symbol Masking ───────────────────────────────────────────────────────────

def mask_symbol(symbol: str) -> str:
    """
    Băm mã CK cho user Free.
    VNM       → V**
    HP        → H*
    VN30F1M   → VN***1M
    Quy tắc:
      - Len 1-2: hiện ký tự đầu + '*' * còn lại
      - Len 3-4: hiện 1 ký tự đầu + '*' * (len-1)
      - Len >= 5: hiện 2 ký tự đầu + '*' * (len-4) + 2 ký tự cuối
    """
    s = symbol.upper().strip()
    n = len(s)
    if n <= 0:
        return s
    if n <= 2:
        return s[0] + '*' * (n - 1)
    if n <= 4:
        return s[0] + '*' * (n - 1)
    # n >= 5
    return s[:2] + '*' * (n - 4) + s[-2:]


# ── Severity ─────────────────────────────────────────────────────────────────

def get_signal_severity(matched_value_vnd: int | float) -> str:
    val = float(matched_value_vnd or 0)
    if val >= _CRITICAL_THRESHOLD_VND:
        return 'critical'
    if val >= _HIGH_THRESHOLD_VND:
        return 'high'
    return 'normal'


# ── Message Formatting ───────────────────────────────────────────────────────

def format_whale_alert_message(
    symbol: str,
    matched_value_vnd: int,
    side: str,
    ai_summary: str,
    severity: str,
    is_masked: bool = False,
) -> str:
    """Format tin nhắn alert dạng HTML cho Telegram."""
    display_symbol = mask_symbol(symbol) if is_masked else symbol
    value_bn = matched_value_vnd / 1_000_000_000
    side_display = '📈 MUA' if side.upper() == 'BUY' else '📉 BÁN'
    severity_emoji = {'critical': '🚨', 'high': '⚠️', 'normal': 'ℹ️'}.get(severity, 'ℹ️')

    summary_line = f'\n💬 <i>{ai_summary[:200]}</i>' if ai_summary and not is_masked else ''
    upgrade_line = '\n🔒 <a href="https://vninvest.app/upgrade">Nâng cấp Pro</a> để xem chi tiết' if is_masked else ''

    return (
        f'{severity_emoji} <b>WHALE ALERT</b>\n'
        f'{'─' * 28}\n'
        f'Mã: <b>{display_symbol}</b>\n'
        f'Giá trị: <b>{value_bn:.1f} tỷ VNĐ</b>\n'
        f'Chiều: <b>{side_display}</b>'
        f'{summary_line}'
        f'{upgrade_line}'
    )


# ── Bot API Call ─────────────────────────────────────────────────────────────

def _bot_api(method: str, payload: dict) -> dict | None:
    """Gọi Telegram Bot API qua httpx (sync)."""
    if not _BOT_TOKEN:
        logger.warning('[telegram] TELEGRAM_BOT_TOKEN chưa được cấu hình')
        return None
    import httpx
    url = f'https://api.telegram.org/bot{_BOT_TOKEN}/{method}'
    try:
        resp = httpx.post(url, json=payload, timeout=10.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.error('[telegram] Bot API call failed method=%s: %s', method, exc)
        return None


def send_message(chat_id: int, text: str, parse_mode: str = 'HTML', reply_markup: dict | None = None) -> dict | None:
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    return _bot_api('sendMessage', payload)


def edit_message_text(chat_id: int, message_id: int, text: str, parse_mode: str = 'HTML', reply_markup: dict | None = None) -> dict | None:
    payload = {'chat_id': chat_id, 'message_id': message_id, 'text': text, 'parse_mode': parse_mode}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    return _bot_api('editMessageText', payload)


# ── Command Handlers ─────────────────────────────────────────────────────────

def _handle_start(update: dict, profile):
    """Xử lý /start <token> — link tài khoản."""
    text = update.get('message', {}).get('text', '')
    parts = text.strip().split(maxsplit=1)
    if len(parts) < 2:
        send_message(profile.chat_id, '👋 Chào mừng đến VNInvest Bot!\nNhấn "Kết nối Telegram" trên web app để link tài khoản.')
        return

    token = parts[1].strip()
    user_id = validate_deeplink_token(token)
    if not user_id:
        send_message(profile.chat_id, '❌ Link đã hết hạn hoặc không hợp lệ. Vui lòng tạo link mới trên web app.')
        return

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        send_message(profile.chat_id, '❌ Tài khoản không tồn tại.')
        return

    from portfolio.models import TelegramProfile
    TelegramProfile.objects.update_or_create(
        telegram_user_id=update.get('message', {}).get('from', {}).get('id'),
        defaults={
            'user': user,
            'chat_id': profile.chat_id,
            'is_verified': True,
        },
    )
    send_message(profile.chat_id, f'✅ Đã liên kết thành công với tài khoản <b>{user.username}</b>!\nGõ /portfolio để xem danh mục.', parse_mode='HTML')


def _handle_portfolio(chat_id: int, user: User):
    """Trả về NAV tóm tắt + Inline Keyboard chọn danh mục."""
    try:
        # Core models (AUTHORITY)
        try:
            from user_workspace.models import Watchlist
        except (ImportError, RuntimeError):
            from portfolio.models import WatchlistGroup as Watchlist  # noqa: F401 - fallback
        
        groups = Watchlist.objects.filter(user=user)[:5]
        if not groups:
            send_message(chat_id, '📂 Bạn chưa có danh mục nào. Tạo danh mục trên web app.')
            return

        buttons = []
        for g in groups:
            buttons.append([{'text': f'📊 {g.name}', 'callback_data': f'portfolio:{g.pk}'}])

        send_message(
            chat_id,
            '📊 <b>Danh mục của bạn</b>\nChọn danh mục để xem chi tiết:',
            parse_mode='HTML',
            reply_markup={'inline_keyboard': buttons},
        )
    except Exception as exc:
        logger.error('[telegram /portfolio] user=%s: %s', user.username, exc)
        send_message(chat_id, '⚠️ Không thể tải danh mục lúc này.')


def _handle_stock(chat_id: int, user: User, symbol: str, is_pro: bool):
    """Trả về tóm tắt AI Advisory cho symbol."""
    from portfolio.models import WhaleAdvisory
    display_symbol = symbol if is_pro else mask_symbol(symbol)
    advisory = WhaleAdvisory.objects.filter(symbol=symbol).order_by('-created_at').first()
    if not advisory:
        send_message(chat_id, f'ℹ️ Chưa có phân tích AI cho mã <b>{display_symbol}</b>.', parse_mode='HTML')
        return

    summary = advisory.ai_summary[:300] if is_pro else '🔒 Nâng cấp Pro để xem phân tích chi tiết.'
    send_message(chat_id, f'📈 <b>{display_symbol}</b>\n\n{summary}', parse_mode='HTML')


def _handle_mute(chat_id: int, telegram_user_id: int, args: str):
    """Tắt thông báo theo thời gian: /mute 1h / /mute 30m / /mute off."""
    from portfolio.models import TelegramProfile
    try:
        profile = TelegramProfile.objects.get(telegram_user_id=telegram_user_id)
    except TelegramProfile.DoesNotExist:
        return

    args = args.strip().lower()
    if args == 'off' or args == '':
        profile.mute_until = None
        profile.save(update_fields=['mute_until'])
        send_message(chat_id, '🔔 Đã bật lại thông báo.')
        return

    m = re.match(r'^(\d+)(h|m)$', args)
    if not m:
        send_message(chat_id, '❓ Cú pháp: /mute 1h hoặc /mute 30m hoặc /mute off')
        return

    value, unit = int(m.group(1)), m.group(2)
    delta = timedelta(hours=value) if unit == 'h' else timedelta(minutes=value)
    profile.mute_until = timezone.now() + delta
    profile.save(update_fields=['mute_until'])
    send_message(chat_id, f'🔕 Đã tắt thông báo trong {value}{"h" if unit == "h" else " phút"}.')


def process_webhook_update(update: dict) -> None:
    """
    Điểm vào xử lý update từ Telegram webhook.
    Gọi từ views_notifications sau khi xác thực request.
    """
    from portfolio.models import TelegramProfile

    message = update.get('message') or {}
    callback_query = update.get('callback_query') or {}

    # ── Callback query (inline button) ──────────────────────────────────────
    if callback_query:
        cq_id = callback_query.get('id')
        data = callback_query.get('data', '')
        from_info = callback_query.get('from', {})
        tg_user_id = from_info.get('id')
        message_obj = callback_query.get('message', {})
        chat_id = message_obj.get('chat', {}).get('id')
        message_id = message_obj.get('message_id')

        try:
            profile = TelegramProfile.objects.get(telegram_user_id=tg_user_id, is_verified=True)
        except TelegramProfile.DoesNotExist:
            return

        if data.startswith('portfolio:'):
            group_id = data.split(':', 1)[1]
            try:
                # Core models (AUTHORITY)
                try:
                    from user_workspace.models import WatchlistItem
                except (ImportError, RuntimeError):
                    from portfolio.models import WatchlistItem  # noqa: F401 - fallback
                
                items = WatchlistItem.objects.filter(watchlist_id=group_id, watchlist__user=profile.user)[:10]
                lines = [f'• {i.symbol}' for i in items] or ['(Danh mục trống)']
                edit_message_text(chat_id, message_id, '📊 <b>Danh mục:</b>\n' + '\n'.join(lines), parse_mode='HTML')
            except Exception as exc:
                logger.error('[telegram callback portfolio] %s', exc)

        # Ack callback
        _bot_api('answerCallbackQuery', {'callback_query_id': cq_id})
        return

    # ── Text message ─────────────────────────────────────────────────────────
    tg_from = message.get('from', {})
    tg_user_id = tg_from.get('id')
    chat_id = message.get('chat', {}).get('id')
    text = message.get('text', '').strip()

    if not chat_id or not text:
        return

    # Đặt chat_id vào profile tạm để dùng trong _handle_start
    class _TempProfile:
        pass
    temp = _TempProfile()
    temp.chat_id = chat_id

    if text.startswith('/start'):
        _handle_start(update, temp)
        return

    # Các lệnh khác yêu cầu đã verify
    try:
        profile = TelegramProfile.objects.get(telegram_user_id=tg_user_id, is_verified=True)
    except TelegramProfile.DoesNotExist:
        send_message(chat_id, '🔐 Vui lòng link tài khoản trước. Nhấn "Kết nối Telegram" trên web app.')
        return

    user = profile.user

    # Kiểm tra plan
    try:
        from portfolio.opencore_premium import PremiumFeatureGate
        is_pro = PremiumFeatureGate.can_use_feature(user, 'telegram_bot_full')
    except Exception:
        is_pro = False

    if text.startswith('/portfolio'):
        _handle_portfolio(chat_id, user)
    elif text.startswith('/stock'):
        parts = text.split(maxsplit=1)
        symbol = parts[1].strip().upper() if len(parts) > 1 else ''
        if symbol:
            _handle_stock(chat_id, user, symbol, is_pro)
        else:
            send_message(chat_id, '❓ Cú pháp: /stock VNM')
    elif text.startswith('/mute'):
        parts = text.split(maxsplit=1)
        args = parts[1] if len(parts) > 1 else 'off'
        _handle_mute(chat_id, tg_user_id, args)
    elif text.startswith('/settings'):
        send_message(chat_id, '⚙️ Quản lý cài đặt tại: https://vninvest.app/settings')
    else:
        send_message(chat_id, '❓ Lệnh không hợp lệ. Thử: /portfolio, /stock VNM, /mute 1h, /settings')
