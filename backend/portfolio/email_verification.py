from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.core import signing
from django.template.loader import render_to_string

from .mail_service import get_active_email_account, send_system_email


EMAIL_VERIFICATION_SALT = 'portfolio.email-verification'


def _verification_expiry_label() -> str:
    max_age_seconds = int(settings.EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS)
    if max_age_seconds % 86400 == 0:
        day_count = max_age_seconds // 86400
        return f'{day_count} ngay' if day_count != 1 else '1 ngay'
    if max_age_seconds % 3600 == 0:
        hour_count = max_age_seconds // 3600
        return f'{hour_count} gio' if hour_count != 1 else '1 gio'
    minute_count = max(max_age_seconds // 60, 1)
    return f'{minute_count} phut' if minute_count != 1 else '1 phut'


def generate_email_verification_token(user: User) -> str:
    return signing.dumps(
        {
            'user_id': user.id,
            'email': user.email,
        },
        salt=EMAIL_VERIFICATION_SALT,
    )


def resolve_email_verification_token(token: str) -> User:
    payload = signing.loads(
        token,
        salt=EMAIL_VERIFICATION_SALT,
        max_age=settings.EMAIL_VERIFICATION_TOKEN_MAX_AGE_SECONDS,
    )
    user = User.objects.get(pk=payload['user_id'])
    if (user.email or '').strip().lower() != (payload.get('email') or '').strip().lower():
        raise signing.BadSignature('Email does not match token payload.')
    return user


def build_email_verification_url(token: str) -> str:
    base_url = settings.FRONTEND_BASE_URL.rstrip('/')
    return f'{base_url}/verify-email?{urlencode({"token": token})}'


def send_verification_email(user: User) -> int:
    active_account = get_active_email_account()
    if not active_account:
        raise RuntimeError('Chua co cau hinh tai khoan gui mail mac dinh trong trang quan tri.')

    token = generate_email_verification_token(user)
    verify_url = build_email_verification_url(token)
    template_context = {
        'user': user,
        'verify_url': verify_url,
        'expiry_label': _verification_expiry_label(),
        'frontend_base_url': settings.FRONTEND_BASE_URL.rstrip('/'),
        'product_name': 'VNInvest',
    }
    subject = render_to_string('emails/verify_email_subject.txt', template_context).strip().replace('\n', ' ')
    message = render_to_string('emails/verify_email.txt', template_context)
    html_message = render_to_string('emails/verify_email.html', template_context)
    return send_system_email(
        subject=subject,
        message=message,
        recipient_list=[user.email],
        html_message=html_message,
        account=active_account,
        fail_silently=False,
    )