from email.utils import formataddr
import json

import httpx
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone

from .gmail_service import send_gmail_api_message
from .google_oauth_service import refresh_google_access_token
from .models import SystemEmailAccount


def _humanize_gmail_error(exc: Exception) -> str:
    if not isinstance(exc, httpx.HTTPStatusError):
        return str(exc)

    status_code = exc.response.status_code
    reason = ''
    payload_error = ''
    try:
        payload = exc.response.json()
    except json.JSONDecodeError:
        payload = {}
    except Exception:
        payload = {}

    if isinstance(payload, dict):
        error_obj = payload.get('error')
        if isinstance(error_obj, dict):
            reason = str(error_obj.get('message') or '').strip()
            payload_error = str(error_obj.get('status') or error_obj.get('code') or '').strip()

    if status_code == 401:
        return 'Google OAuth token không hợp lệ hoặc đã hết hạn. Vui lòng Revoke và Connect lại Google.'
    if status_code == 403:
        return 'Google từ chối quyền gửi mail (403). Kiểm tra scope gmail.send, OAuth consent hoặc quota dự án.'
    if status_code == 429:
        return 'Google API rate limit exceeded (429). Hãy giảm tần suất gửi và thử lại sau.'
    if status_code >= 500:
        return 'Google API đang lỗi phía máy chủ (5xx). Vui lòng thử lại sau.'

    details = reason or payload_error or str(exc)
    return f'Gmail API lỗi HTTP {status_code}: {details}'


def _build_env_fallback_email_account() -> SystemEmailAccount | None:
    if not getattr(settings, 'SYSTEM_EMAIL_FALLBACK_ENABLED', False):
        return None

    host = str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_HOST', '') or '').strip()
    from_email = str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_FROM_EMAIL', '') or '').strip()
    if not host or not from_email:
        return None

    account = SystemEmailAccount(
        name='Env fallback mail account',
        auth_type=SystemEmailAccount.AuthTypeChoices.SMTP_PASSWORD,
        host=host,
        port=int(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_PORT', 1025)),
        username=str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_USERNAME', '') or '').strip(),
        use_tls=bool(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_USE_TLS', False)),
        use_ssl=bool(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_USE_SSL', False)),
        timeout_seconds=int(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_TIMEOUT_SECONDS', 20)),
        from_email=from_email,
        from_name=str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_FROM_NAME', '') or '').strip(),
        reply_to_email=str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_REPLY_TO', '') or '').strip(),
        is_active=True,
        is_default=True,
        notes='Derived from environment fallback settings.',
    )
    password = str(getattr(settings, 'SYSTEM_EMAIL_FALLBACK_PASSWORD', '') or '')
    if password:
        account.set_smtp_password(password)
    return account


def get_active_email_account() -> SystemEmailAccount | None:
    account = SystemEmailAccount.objects.filter(is_active=True, is_default=True).first()
    if account:
        return account
    fallback = SystemEmailAccount.objects.filter(is_active=True).order_by('name').first()
    if fallback:
        return fallback
    return _build_env_fallback_email_account()


def build_sender_address(account: SystemEmailAccount | None) -> str:
    if not account:
        return settings.DEFAULT_FROM_EMAIL
    if account.from_name:
        return formataddr((account.from_name, account.from_email))
    return account.from_email


def build_email_connection(account: SystemEmailAccount | None = None, fail_silently: bool = False):
    if not account:
        return get_connection(fail_silently=fail_silently)

    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=account.host,
        port=account.port,
        username=account.username or None,
        password=account.get_smtp_password() or None,
        use_tls=account.use_tls,
        use_ssl=account.use_ssl,
        timeout=account.timeout_seconds,
        fail_silently=fail_silently,
    )


def send_system_email(
    subject: str,
    message: str,
    recipient_list: list[str],
    html_message: str | None = None,
    account: SystemEmailAccount | None = None,
    fail_silently: bool = False,
) -> int:
    selected_account = account or get_active_email_account()

    if selected_account and selected_account.auth_type == SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2:
        refresh_token = selected_account.get_google_refresh_token()
        if not refresh_token:
            raise ValueError('Google OAuth2 account chưa có refresh token. Vui lòng kết nối Google trong Admin.')

        try:
            token_payload = refresh_google_access_token(
                client_id=selected_account.google_client_id,
                client_secret=selected_account.get_google_client_secret(),
                refresh_token=refresh_token,
                timeout_seconds=selected_account.timeout_seconds,
            )
            access_token = token_payload['access_token']
            sent_count = send_gmail_api_message(
                access_token=access_token,
                subject=subject,
                text_body=message,
                html_body=html_message,
                from_email=build_sender_address(selected_account),
                recipient_list=recipient_list,
                reply_to_email=selected_account.reply_to_email or None,
                timeout_seconds=selected_account.timeout_seconds,
            )
            selected_account.token_last_refreshed_at = timezone.now()
            selected_account.token_last_error = ''
            selected_account.save(update_fields=['token_last_refreshed_at', 'token_last_error', 'updated_at'])
            return sent_count
        except Exception as exc:
            selected_account.token_last_error = _humanize_gmail_error(exc)
            selected_account.save(update_fields=['token_last_error', 'updated_at'])
            if fail_silently:
                return 0
            raise RuntimeError(selected_account.token_last_error) from exc

    connection = build_email_connection(selected_account, fail_silently=fail_silently)
    email = EmailMultiAlternatives(
        subject=subject,
        body=message,
        from_email=build_sender_address(selected_account),
        to=recipient_list,
        connection=connection,
        reply_to=[selected_account.reply_to_email] if selected_account and selected_account.reply_to_email else None,
    )
    if html_message:
        email.attach_alternative(html_message, 'text/html')
    return email.send(fail_silently=fail_silently)


def send_test_email(account: SystemEmailAccount, recipient_email: str) -> int:
    subject = '[VNInvest] Kiểm tra cấu hình gửi mail'
    transport_name = 'Google OAuth2' if account.auth_type == SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2 else 'SMTP'
    message = (
        'VNInvest đã gửi email kiểm tra bằng cấu hình mail trong trang quản trị.\n\n'
        f'Cấu hình: {account.name}\n'
        f'Kiểu gửi: {transport_name}\n'
        f'Host: {account.host}:{account.port}\n'
        f'Thời điểm: {timezone.localtime().strftime("%Y-%m-%d %H:%M:%S")}\n'
    )

    try:
        sent_count = send_system_email(
            subject=subject,
            message=message,
            recipient_list=[recipient_email],
            account=account,
            fail_silently=False,
        )
    except Exception as exc:
        account.last_tested_at = timezone.now()
        account.last_test_status = SystemEmailAccount.TestStatusChoices.FAILED
        account.last_test_message = str(exc)
        account.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message', 'updated_at'])
        raise

    account.last_tested_at = timezone.now()
    account.last_test_status = SystemEmailAccount.TestStatusChoices.SUCCESS
    account.last_test_message = f'Đã gửi mail kiểm tra tới {recipient_email}.'
    account.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message', 'updated_at'])
    return sent_count
