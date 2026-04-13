from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.core import signing
from django.template.loader import render_to_string

from .mail_service import get_active_email_account, send_system_email


PASSWORD_RESET_SALT = 'portfolio.password-reset'


def _password_reset_expiry_label() -> str:
    max_age_seconds = int(settings.PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS)
    if max_age_seconds % 86400 == 0:
        day_count = max_age_seconds // 86400
        return f'{day_count} ngay' if day_count != 1 else '1 ngay'
    if max_age_seconds % 3600 == 0:
        hour_count = max_age_seconds // 3600
        return f'{hour_count} gio' if hour_count != 1 else '1 gio'
    minute_count = max(max_age_seconds // 60, 1)
    return f'{minute_count} phut' if minute_count != 1 else '1 phut'


def generate_password_reset_token(user: User) -> str:
    return signing.dumps(
        {
            'user_id': user.id,
            'email': user.email,
            'pw_hash': user.password[:20],
        },
        salt=PASSWORD_RESET_SALT,
    )


def resolve_password_reset_token(token: str) -> User:
    payload = signing.loads(
        token,
        salt=PASSWORD_RESET_SALT,
        max_age=settings.PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS,
    )
    user = User.objects.get(pk=payload['user_id'])
    if (user.email or '').strip().lower() != (payload.get('email') or '').strip().lower():
        raise signing.BadSignature('Email does not match token payload.')
    # Invalidate token if password has already been changed since token was generated.
    token_pw_hash = payload.get('pw_hash', '')
    if token_pw_hash and user.password[:20] != token_pw_hash:
        raise signing.BadSignature('Token đã bị vô hiệu do mật khẩu đã được thay đổi.')
    return user


def build_password_reset_url(token: str) -> str:
    base_url = settings.FRONTEND_BASE_URL.rstrip('/')
    return f'{base_url}/reset-password?{urlencode({"token": token})}'


def send_password_reset_email(user: User) -> int:
    active_account = get_active_email_account()
    if not active_account:
        raise RuntimeError('Chua co cau hinh tai khoan gui mail mac dinh trong trang quan tri.')

    token = generate_password_reset_token(user)
    reset_url = build_password_reset_url(token)
    template_context = {
        'user': user,
        'reset_url': reset_url,
        'expiry_label': _password_reset_expiry_label(),
        'frontend_base_url': settings.FRONTEND_BASE_URL.rstrip('/'),
        'product_name': 'VNInvest',
    }
    subject = render_to_string('emails/reset_password_subject.txt', template_context).strip().replace('\n', ' ')
    message = render_to_string('emails/reset_password.txt', template_context)
    html_message = render_to_string('emails/reset_password.html', template_context)
    return send_system_email(
        subject=subject,
        message=message,
        recipient_list=[user.email],
        html_message=html_message,
        account=active_account,
        fail_silently=False,
    )
