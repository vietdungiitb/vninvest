import base64
from email.message import EmailMessage

import httpx


def _build_raw_message(
    *,
    subject: str,
    text_body: str,
    html_body: str | None,
    from_email: str,
    recipient_list: list[str],
    reply_to_email: str | None = None,
) -> str:
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = ', '.join(recipient_list)
    if reply_to_email:
        msg['Reply-To'] = reply_to_email
    msg.set_content(text_body or '')
    if html_body:
        msg.add_alternative(html_body, subtype='html')

    raw_bytes = msg.as_bytes()
    return base64.urlsafe_b64encode(raw_bytes).decode('utf-8')


def send_gmail_api_message(
    *,
    access_token: str,
    subject: str,
    text_body: str,
    html_body: str | None,
    from_email: str,
    recipient_list: list[str],
    reply_to_email: str | None = None,
    timeout_seconds: int = 20,
) -> int:
    if not recipient_list:
        return 0

    raw_message = _build_raw_message(
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        from_email=from_email,
        recipient_list=recipient_list,
        reply_to_email=reply_to_email,
    )

    response = httpx.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        json={'raw': raw_message},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return len(recipient_list)
