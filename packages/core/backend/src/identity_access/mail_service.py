import base64
from datetime import date
from email.utils import formataddr
import json
import logging

import httpx
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone

from .gmail_service import send_gmail_api_message
from .google_oauth_service import refresh_google_access_token
from .models import SystemMailConfig


logger = logging.getLogger(__name__)


def _humanize_gmail_error(exc: Exception) -> str:
    if not isinstance(exc, httpx.HTTPStatusError):
        return str(exc)

    status_code = exc.response.status_code
    reason = ''
    payload_error = ''
    try:
        payload = exc.response.json()
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


def get_active_mail_config() -> SystemMailConfig | None:
    return SystemMailConfig.objects.filter(is_active=True).order_by('-created_at').first()


def build_sender_address(account: SystemMailConfig | None) -> str:
    if not account:
        return settings.DEFAULT_FROM_EMAIL
    display_name = (account.from_name or account.name or '').strip()
    if display_name:
        return formataddr((display_name, account.from_email))
    return account.from_email


def build_email_connection(account: SystemMailConfig | None = None, fail_silently: bool = False):
    if not account:
        return get_connection(fail_silently=fail_silently)

    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=account.smtp_host,
        port=account.smtp_port,
        username=account.smtp_username or None,
        password=account.get_smtp_password() or None,
        use_tls=account.smtp_use_tls,
        use_ssl=account.smtp_use_ssl,
        timeout=account.timeout_seconds,
        fail_silently=fail_silently,
    )


def _send_via_google_oauth2(
    *,
    account: SystemMailConfig,
    subject: str,
    message: str,
    recipient_list: list[str],
    html_message: str | None,
) -> int:
    refresh_token = account.get_google_refresh_token()
    if not refresh_token:
        raise ValueError('Google OAuth2 account chưa có refresh token. Vui lòng kết nối Google trong Admin.')

    token_payload = refresh_google_access_token(
        client_id=account.google_client_id,
        client_secret=account.get_google_client_secret(),
        refresh_token=refresh_token,
        timeout_seconds=account.timeout_seconds,
    )
    access_token = token_payload['access_token']
    sent_count = send_gmail_api_message(
        access_token=access_token,
        subject=subject,
        text_body=message,
        html_body=html_message,
        from_email=build_sender_address(account),
        recipient_list=recipient_list,
        reply_to_email=account.reply_to_email or None,
        timeout_seconds=account.timeout_seconds,
    )
    account.token_last_refreshed_at = timezone.now()
    account.token_last_error = ''
    account.save(update_fields=['token_last_refreshed_at', 'token_last_error', 'updated_at'])
    return sent_count


def _send_via_google_dwd(
    *,
    account: SystemMailConfig,
    subject: str,
    message: str,
    recipient_list: list[str],
    html_message: str | None,
) -> int:
    from email.mime.text import MIMEText

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sa_json = account.get_google_service_account_json()
    if not sa_json:
        raise ValueError('Google Service Account JSON chưa được cấu hình.')

    sa_info = json.loads(sa_json)
    scopes = [scope.strip() for scope in (account.google_token_scope or '').split() if scope.strip()]
    if not scopes:
        scopes = ['https://www.googleapis.com/auth/gmail.send']

    credentials = service_account.Credentials.from_service_account_info(
        sa_info,
        scopes=scopes,
    ).with_subject(account.google_delegated_user_email)

    service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)

    message_obj = MIMEText(message or '', 'plain', 'utf-8')
    if html_message:
        message_obj = MIMEText(html_message, 'html', 'utf-8')
    message_obj['to'] = ', '.join(recipient_list)
    message_obj['from'] = build_sender_address(account)
    message_obj['subject'] = subject

    raw_message = base64.urlsafe_b64encode(message_obj.as_bytes()).decode('utf-8')
    service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
    account.token_last_error = ''
    account.save(update_fields=['token_last_error', 'updated_at'])
    return len(recipient_list)


def send_system_email(
    subject: str,
    message: str,
    recipient_list: list[str],
    html_message: str | None = None,
    account: SystemMailConfig | None = None,
    fail_silently: bool = False,
) -> int:
    selected_account = account or get_active_mail_config()

    if selected_account and selected_account.provider == SystemMailConfig.PROVIDER_GMAIL:
        try:
            if selected_account.has_google_oauth_credentials:
                return _send_via_google_oauth2(
                    account=selected_account,
                    subject=subject,
                    message=message,
                    recipient_list=recipient_list,
                    html_message=html_message,
                )

            if selected_account.has_google_service_account:
                return _send_via_google_dwd(
                    account=selected_account,
                    subject=subject,
                    message=message,
                    recipient_list=recipient_list,
                    html_message=html_message,
                )

            raise ValueError('Cấu hình Google Gmail API chưa đủ thông tin để gửi mail.')
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


def send_report_email(
    recipient: str,
    subject: str,
    html_content: str | None = None,
    csv_content: str | None = None,
    report_format: str = 'html',
) -> int:
    """Send a scheduled report email with optional HTML body and CSV attachment."""
    from django.core.mail import EmailMultiAlternatives

    message = f'Báo cáo {subject} từ VNInvest'
    email = EmailMultiAlternatives(
        subject=subject,
        body=message,
        to=[recipient],
    )
    if html_content:
        email.attach_alternative(html_content, 'text/html')
    if csv_content and report_format == 'csv':
        email.attach(f'report_{date.today().isoformat()}.csv', csv_content, 'text/csv')
    return email.send(fail_silently=False)


def send_test_email(account: SystemMailConfig, recipient_email: str) -> int:
    subject = '[VNInvest] Kiểm tra cấu hình gửi mail'
    if account.provider == SystemMailConfig.PROVIDER_GMAIL:
        transport_name = 'Google OAuth2' if account.has_google_oauth_credentials else 'Google DWD'
    else:
        transport_name = 'SMTP'

    display_name = (account.name or account.from_email).strip()
    message = (
        'VNInvest đã gửi email kiểm tra bằng cấu hình mail trong trang quản trị.\n\n'
        f'Cấu hình: {display_name}\n'
        f'Kiểu gửi: {transport_name}\n'
        f'Host: {account.smtp_host or "(không áp dụng)"}:{account.smtp_port or "-"}\n'
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
        account.last_test_status = SystemMailConfig.TestStatusChoices.FAILED
        account.last_test_message = str(exc)
        account.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message', 'updated_at'])
        raise

    account.last_tested_at = timezone.now()
    account.last_test_status = SystemMailConfig.TestStatusChoices.SUCCESS
    account.last_test_message = f'Đã gửi mail kiểm tra tới {recipient_email}.'
    account.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message', 'updated_at'])
    return sent_count