from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone

from .models import SystemEmailAccount


def get_active_email_account() -> SystemEmailAccount | None:
    account = SystemEmailAccount.objects.filter(is_active=True, is_default=True).first()
    if account:
        return account
    return SystemEmailAccount.objects.filter(is_active=True).order_by('name').first()


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
    message = (
        'VNInvest đã gửi email kiểm tra bằng cấu hình SMTP trong trang quản trị.\n\n'
        f'Cấu hình: {account.name}\n'
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