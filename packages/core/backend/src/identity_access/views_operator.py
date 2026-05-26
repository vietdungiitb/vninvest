import logging
import json
import uuid
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.pagination import CursorPagination
from identity_access.models import SystemMailConfig, MailConfigAuditLog
from vninvest_core.utils.crypto import encrypt_secret
from django.core.mail import get_connection, send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def success_response(data: dict, status_code: int = status.HTTP_200_OK, request=None) -> Response:
    request_id = None
    if request:
        request_id = getattr(request, 'request_id', None)
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:16]}"
    return Response({
        "status": "success",
        "timestamp": timezone.now().isoformat(),
        "request_id": request_id,
        "data": data
    }, status=status_code)


class MailConfigCursorPagination(CursorPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100
    ordering = '-created_at'

class OperatorMailConfigListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = SystemMailConfig.objects.all().order_by('-created_at')
        paginator = MailConfigCursorPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        
        results = []
        for config in page:
            results.append({
                "id": config.id,
                "provider": config.provider,
                "is_active": config.is_active,
                "from_email": config.from_email,
                "smtp_host": config.smtp_host,
                "smtp_port": config.smtp_port,
                "smtp_username": config.smtp_username,
                "smtp_password_configured": bool(config.smtp_password_encrypted),
                "smtp_use_tls": config.smtp_use_tls,
                "smtp_use_ssl": config.smtp_use_ssl,
                "google_service_account_json_configured": bool(config.google_service_account_json_encrypted),
                "google_delegated_user_email": config.google_delegated_user_email,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat(),
            })

        return paginator.get_paginated_response(results)

    def post(self, request):
        data = request.data
        provider = data.get('provider')
        from_email = data.get('from_email')

        if not provider or not from_email:
            return Response({
                "detail": "provider và from_email là bắt buộc.",
                "code": "validation_error"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                config = SystemMailConfig(
                    provider=provider,
                    from_email=from_email,
                    last_modified_by=request.user
                )

                if provider == SystemMailConfig.PROVIDER_SMTP:
                    config.smtp_host = data.get('smtp_host')
                    config.smtp_port = int(data.get('smtp_port', 587))
                    config.smtp_username = data.get('smtp_username')
                    config.smtp_use_tls = data.get('smtp_use_tls', True)
                    config.smtp_use_ssl = data.get('smtp_use_ssl', False)
                    if data.get('smtp_password'):
                        config.set_smtp_password(data.get('smtp_password'))
                elif provider == SystemMailConfig.PROVIDER_GMAIL:
                    config.google_delegated_user_email = data.get('google_delegated_user_email')
                    if data.get('google_service_account_json'):
                        config.set_google_service_account_json(data.get('google_service_account_json'))

                config.full_clean()
                config.save()

                # Ghi nhận Audit Log
                MailConfigAuditLog.objects.create(
                    operator_user=request.user,
                    action="create",
                    target_config_id=config.id,
                    description=f"Staff created new mail config (Provider: {provider}, Sender: {from_email})"
                )

            return success_response({
                "id": config.id,
                "message": "Tạo cấu hình mail hệ thống thành công."
            }, status.HTTP_201_CREATED, request=request)

        except Exception as e:
            logger.exception("Failed to create mail configuration.")
            return Response({
                "detail": "Không thể tạo cấu hình mail do lỗi hệ thống hoặc thông số không hợp lệ.",
                "code": "server_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperatorMailConfigDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get_config(self, pk):
        try:
            return SystemMailConfig.objects.get(pk=pk)
        except SystemMailConfig.DoesNotExist:
            return None

    def get(self, request, pk):
        config = self._get_config(pk)
        if not config:
            return Response({"detail": "Không tìm thấy cấu hình.", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return success_response({
            "id": config.id,
            "provider": config.provider,
            "is_active": config.is_active,
            "from_email": config.from_email,
            "smtp_host": config.smtp_host,
            "smtp_port": config.smtp_port,
            "smtp_username": config.smtp_username,
            "smtp_password_configured": bool(config.smtp_password_encrypted),
            "smtp_use_tls": config.smtp_use_tls,
            "smtp_use_ssl": config.smtp_use_ssl,
            "google_service_account_json_configured": bool(config.google_service_account_json_encrypted),
            "google_delegated_user_email": config.google_delegated_user_email,
            "created_at": config.created_at.isoformat(),
            "updated_at": config.updated_at.isoformat(),
        }, status.HTTP_200_OK, request=request)

    def patch(self, request, pk):
        config = self._get_config(pk)
        if not config:
            return Response({"detail": "Không tìm thấy cấu hình.", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        try:
            with transaction.atomic():
                config.last_modified_by = request.user
                if 'from_email' in data:
                    config.from_email = data['from_email']
                if 'provider' in data:
                    config.provider = data['provider']

                if config.provider == SystemMailConfig.PROVIDER_SMTP:
                    if 'smtp_host' in data:
                        config.smtp_host = data['smtp_host']
                    if 'smtp_port' in data:
                        config.smtp_port = int(data['smtp_port'])
                    if 'smtp_username' in data:
                        config.smtp_username = data['smtp_username']
                    if 'smtp_use_tls' in data:
                        config.smtp_use_tls = bool(data['smtp_use_tls'])
                    if 'smtp_use_ssl' in data:
                        config.smtp_use_ssl = bool(data['smtp_use_ssl'])
                    if 'smtp_password' in data:
                        config.set_smtp_password(data['smtp_password'])
                elif config.provider == SystemMailConfig.PROVIDER_GMAIL:
                    if 'google_delegated_user_email' in data:
                        config.google_delegated_user_email = data['google_delegated_user_email']
                    if 'google_service_account_json' in data:
                        config.set_google_service_account_json(data['google_service_account_json'])

                config.full_clean()
                config.save()

                # Ghi nhận Audit Log
                MailConfigAuditLog.objects.create(
                    operator_user=request.user,
                    action="update",
                    target_config_id=config.id,
                    description=f"Staff updated mail config ID {config.id}"
                )

            return success_response({
                "id": config.id,
                "message": "Cập nhật cấu hình thành công."
            }, status.HTTP_200_OK, request=request)
        except Exception as e:
            logger.exception("Failed to update mail configuration.")
            return Response({
                "detail": "Không thể cập nhật cấu hình do lỗi hệ thống hoặc thông số không hợp lệ.",
                "code": "server_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        config = self._get_config(pk)
        if not config:
            return Response({"detail": "Không tìm thấy cấu hình.", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if config.is_active:
            return Response({
                "detail": "Không được phép xóa cấu hình đang ở trạng thái hoạt động.",
                "code": "cannot_delete_active_config"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                config_id = config.id
                config.delete()

                # Ghi nhận Audit Log
                MailConfigAuditLog.objects.create(
                    operator_user=request.user,
                    action="delete",
                    target_config_id=config_id,
                    description=f"Staff deleted mail config ID {config_id}"
                )

            return success_response({
                "message": "Xóa cấu hình thành công."
            }, status.HTTP_200_OK, request=request)
        except Exception as e:
            logger.exception("Failed to delete mail configuration.")
            return Response({
                "detail": "Không thể xóa cấu hình do lỗi hệ thống.",
                "code": "server_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperatorMailConfigActivateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                # Lock bản ghi để kích hoạt an toàn tránh race condition
                configs = SystemMailConfig.objects.select_for_update().all()
                try:
                    target_config = configs.get(pk=pk)
                except SystemMailConfig.DoesNotExist:
                    return Response({"detail": "Không tìm thấy cấu hình.", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)

                # Hủy kích hoạt tất cả các cấu hình khác
                configs.exclude(pk=pk).update(is_active=False)
                
                # Kích hoạt cấu hình chỉ định
                target_config.is_active = True
                target_config.save()

                # Ghi nhận Audit Log
                MailConfigAuditLog.objects.create(
                    operator_user=request.user,
                    action="activate",
                    target_config_id=target_config.id,
                    description=f"Staff activated mail config ID {target_config.id} (Sender: {target_config.from_email})"
                )

            return success_response({
                "id": target_config.id,
                "message": "Kích hoạt cấu hình mail thành công."
            }, status.HTTP_200_OK, request=request)
        except Exception as e:
            logger.exception("Failed to activate mail configuration.")
            return Response({
                "detail": "Không thể kích hoạt cấu hình do lỗi hệ thống.",
                "code": "server_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperatorMailConfigTestView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        data = request.data
        test_email = data.get('test_email')
        config_id = data.get('config_id')

        if not test_email:
            return Response({
                "detail": "test_email là bắt buộc.",
                "code": "validation_error"
            }, status=status.HTTP_400_BAD_REQUEST)

        subject = "[VNInvest Operator] Thử nghiệm kết nối Mail Động"
        html_content = "<p>Chúc mừng! Kết nối máy chủ Mail Động đã hoạt động chính xác.</p>"
        text_content = "Kết nối máy chủ Mail Động đã hoạt động chính xác."

        # Resolve connection params — two modes:
        # 1) config_id provided → load credentials securely from DB (password never sent over wire)
        # 2) inline → caller provides all fields including password (for pre-save testing)
        if config_id:
            try:
                saved_config = SystemMailConfig.objects.get(pk=int(config_id))
            except (SystemMailConfig.DoesNotExist, ValueError, TypeError):
                return Response({
                    "detail": "Không tìm thấy cấu hình.",
                    "code": "not_found"
                }, status=status.HTTP_404_NOT_FOUND)
            provider = saved_config.provider
            from_email = saved_config.from_email
            smtp_host = saved_config.smtp_host
            smtp_port = saved_config.smtp_port
            smtp_username = saved_config.smtp_username
            smtp_password = saved_config.get_smtp_password()
            smtp_use_tls = saved_config.smtp_use_tls
            smtp_use_ssl = saved_config.smtp_use_ssl
            google_service_account_json = saved_config.get_google_service_account_json()
            google_delegated_user_email = saved_config.google_delegated_user_email
        else:
            provider = data.get('provider')
            from_email = data.get('from_email')
            if not provider or not from_email:
                return Response({
                    "detail": "Cần cung cấp config_id hoặc đủ provider, from_email.",
                    "code": "validation_error"
                }, status=status.HTTP_400_BAD_REQUEST)
            smtp_host = data.get('smtp_host')
            smtp_port = int(data.get('smtp_port', 587))
            smtp_username = data.get('smtp_username')
            smtp_password = data.get('smtp_password')
            smtp_use_tls = data.get('smtp_use_tls', True)
            smtp_use_ssl = data.get('smtp_use_ssl', False)
            google_service_account_json = data.get('google_service_account_json')
            google_delegated_user_email = data.get('google_delegated_user_email')

        try:
            if provider == 'smtp':
                connection = get_connection(
                    host=smtp_host,
                    port=smtp_port,
                    username=smtp_username,
                    password=smtp_password,
                    use_tls=smtp_use_tls,
                    use_ssl=smtp_use_ssl,
                    timeout=3.0  # 3000ms SLA timeout
                )
                send_mail(
                    subject=subject,
                    message=text_content,
                    html_message=html_content,
                    from_email=from_email,
                    recipient_list=[test_email],
                    connection=connection,
                    fail_silently=False
                )
            elif provider == 'gmail_api':
                from googleapiclient.discovery import build
                from email.mime.text import MIMEText
                import base64

                sa_info = json.loads(google_service_account_json)
                scopes = ['https://www.googleapis.com/auth/gmail.send']

                credential_type = sa_info.get('type', '')
                if credential_type == 'service_account':
                    # Flow 1: Service Account với Domain-Wide Delegation
                    from google.oauth2 import service_account as _sa
                    credentials = _sa.Credentials.from_service_account_info(
                        sa_info,
                        scopes=scopes,
                    ).with_subject(google_delegated_user_email)
                else:
                    # Flow 2: OAuth2 Web Client với refresh_token
                    # Hỗ trợ cả format wrapped {"web": {...}} lẫn flat {"client_id": ...}
                    from google.oauth2.credentials import Credentials as OAuthCredentials
                    from google.auth.transport.requests import Request as GoogleAuthRequest
                    web_info = sa_info.get('web') or sa_info.get('installed') or sa_info
                    refresh_token = sa_info.get('refresh_token') or web_info.get('refresh_token')
                    if not refresh_token:
                        raise ValueError(
                            "OAuth2 Web Client JSON thiếu 'refresh_token'. "
                            "Hãy thêm trường 'refresh_token' vào JSON credentials."
                        )
                    credentials = OAuthCredentials(
                        token=None,
                        refresh_token=refresh_token,
                        token_uri=web_info.get('token_uri', 'https://oauth2.googleapis.com/token'),
                        client_id=web_info.get('client_id') or sa_info.get('client_id'),
                        client_secret=web_info.get('client_secret') or sa_info.get('client_secret'),
                        scopes=scopes,
                    )
                    credentials.refresh(GoogleAuthRequest())

                service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)

                message = MIMEText(html_content, 'html', 'utf-8')
                message['to'] = test_email
                message['from'] = from_email
                message['subject'] = subject

                raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
                service.users().messages().send(userId='me', body={'raw': raw_message}).execute()

            return success_response({
                "message": "Thử nghiệm kết nối động và gửi email thành công."
            }, status.HTTP_200_OK, request=request)
        except Exception as e:
            logger.exception("Mail connection test failed.")
            return Response({
                "detail": "Thử nghiệm kết nối thất bại. Vui lòng kiểm tra lại thông số cấu hình và quyền ủy quyền.",
                "code": "mail_test_failed"
            }, status=status.HTTP_400_BAD_REQUEST)
