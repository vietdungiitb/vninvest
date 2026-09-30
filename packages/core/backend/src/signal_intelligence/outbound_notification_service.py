import logging
import httpx
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


class OutboundNotificationService:
    @classmethod
    def send_email(cls, to_email: str, subject: str, html_content: str, text_content: str = "") -> bool:
        """
        Sends transactional email via SMTP configured in settings.
        """
        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@vninvest.vn')
            send_mail(
                subject=subject,
                message=text_content or html_content,
                from_email=from_email,
                recipient_list=[to_email],
                html_message=html_content,
                fail_silently=False,
            )
            logger.info(f"Successfully sent email to={to_email} with subject='{subject}'")
            return True
        except Exception as exc:
            logger.error(f"Failed to send email to={to_email}: {str(exc)}", exc_info=True)
            return False

    @classmethod
    def send_fcm_push(cls, fcm_token: str, title: str, body: str, data: dict = None) -> bool:
        """
        Sends mobile push notifications via Firebase Cloud Messaging (FCM).
        Uses a mock/sandbox HTTP post to Firebase REST APIs with fallback logging.
        """
        try:
            fcm_api_key = getattr(settings, 'FCM_SERVER_KEY', 'MOCK_FCM_KEY')
            logger.info(f"Initiating FCM push to token={fcm_token[:15]}... title='{title}'")

            # Simulated FCM HTTP v1 REST call
            payload = {
                "to": fcm_token,
                "notification": {
                    "title": title,
                    "body": body,
                    "sound": "default"
                },
                "data": data or {}
            }

            # Log exact payload for transparency
            logger.debug(f"FCM payload: {payload}")

            # Return true in sandbox/mock environments
            if fcm_api_key == 'MOCK_FCM_KEY' or settings.DEBUG:
                logger.info("FCM running in Sandbox/Debug mode. Push marked as delivered.")
                return True

            # If in production, trigger actual Firebase endpoint
            headers = {
                # Endpoint `fcm.googleapis.com/fcm/send` là API **legacy** của
                # FCM, nó xác thực bằng server key dạng `Authorization: key=...`.
                # Trước đây dòng này là `fcode"key={fcm_api_key}"` — `fcode` là
                # tên chưa định nghĩa dính vào chuỗi, khiến **cả module** không
                # import được (Python parse toàn bộ file), làm chết luôn
                # `send_email` vốn chạy tốt. Sai lệch từ 2026-05-28 (`edda0182`)
                # và sống sót vì không module nào import file này.
                "Authorization": f"key={fcm_api_key}",
                "Content-Type": "application/json"
            }
            response = httpx.post(
                "https://fcm.googleapis.com/fcm/send",
                json=payload,
                headers=headers,
                timeout=5.0
            )

            if response.status_code == 200:
                logger.info(f"FCM pushed successfully to={fcm_token[:15]}")
                return True
            else:
                logger.error(f"FCM request failed with status={response.status_code}: {response.text}")
                return False

        except Exception as exc:
            logger.error(f"Exception during FCM push to token={fcm_token[:15]}: {str(exc)}", exc_info=True)
            return False

    @classmethod
    def send_webpush(cls, subscription_info: dict, title: str, body: str, icon: str = None, url: str = None) -> bool:
        """
        Sends Browser WebPush notifications using VAPID keys protocol.
        """
        try:
            vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', 'MOCK_VAPID_KEY')
            vapid_claims = getattr(settings, 'VAPID_CLAIMS', {"sub": "mailto:admin@vninvest.vn"})

            logger.info(f"Initiating WebPush to subscription={str(subscription_info)[:50]}...")

            # If mock, return true directly
            if vapid_private_key == 'MOCK_VAPID_KEY' or settings.DEBUG:
                logger.info("WebPush running in Sandbox/Debug mode. Browser push marked as delivered.")
                return True

            # In production, utilize pywebpush library dynamically to encrypt payload
            from pywebpush import webpush, WebPushException

            payload = {
                "notification": {
                    "title": title,
                    "body": body,
                    "icon": icon or "/icons/icon-192x192.png",
                    "data": {
                        "url": url or "/dashboard"
                    }
                }
            }

            import json
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims
            )
            logger.info("WebPush payload delivered and encrypted via VAPID.")
            return True

        except Exception as exc:
            logger.error(f"Exception during WebPush delivery: {str(exc)}", exc_info=True)
            return False

    @classmethod
    def route_and_dispatch_alert(cls, user, alert) -> dict:
        """
        Routes an alert through user preferences to outbound channels.
        """
        results = {"email": False, "fcm": False, "webpush": False}

        # 1. Fetch user profile for email/fcm token
        profile = getattr(user, 'core_profile', None)
        if not profile:
            logger.warning(f"No profile found for user={user.username}. Outbound skipped.")
            return results

        # 2. Email Notification Route (If user has email and enabled)
        if user.email and getattr(profile, 'email_notifications_enabled', True):
            subject = f"[VNInvest Alert] {alert.title}"
            html_body = f"""
            <h3>{alert.title}</h3>
            <p><strong>Mã cổ phiếu:</strong> {alert.symbol}</p>
            <p><strong>Loại tín hiệu:</strong> {alert.alert_type}</p>
            <p><strong>Nội dung:</strong> {alert.summary or alert.body}</p>
            <p style="font-size: 0.8rem; color: #888;">VNInvest Enterprise SaaS Platform. Cập nhật tại {timezone.now().isoformat()}</p>
            """
            results["email"] = cls.send_email(user.email, subject, html_body)

        # 3. Mobile FCM Push Route (If user has registered an FCM Token)
        fcm_token = getattr(profile, 'fcm_token', None)
        if fcm_token and getattr(profile, 'push_notifications_enabled', True):
            results["fcm"] = cls.send_fcm_push(
                fcm_token=fcm_token,
                title=alert.title,
                body=alert.summary or alert.body,
                data={"symbol": alert.symbol, "alert_id": str(alert.id)}
            )

        # 4. Browser WebPush Route (If user has registered a browser subscription info)
        webpush_sub = getattr(profile, 'webpush_subscription', None)
        if webpush_sub and isinstance(webpush_sub, dict) and getattr(profile, 'webpush_enabled', True):
            results["webpush"] = cls.send_webpush(
                subscription_info=webpush_sub,
                title=alert.title,
                body=alert.summary or alert.body,
                url=f"/stocks/{alert.symbol}"
            )

        return results
