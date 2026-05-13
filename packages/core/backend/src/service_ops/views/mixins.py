"""
SOC Domain Views — Mixin cho ConfigApplyMixin logic.

ConfigApplyMixin quản lý:
  - Validate config từ request
  - Check ownership (can_apply)
  - Save config
  - Record audit trail
"""
from rest_framework import status
from rest_framework.response import Response
from django.db import transaction

from ..models import ServiceDefinition, ServiceConfig, ConfigChangeAudit
from ..ownership import build_ownership_matrix_from_db


class ConfigApplyMixin:
    """Mixin cho config apply endpoints."""

    def apply_config(
        self,
        request,
        service_key: str,
        domain: str,
        config_payload: dict,
        config_class,  # e.g., VnbrokerDomainConfig
    ) -> 'Response | tuple':
        """
        Áp dụng config cho service. Trả Response hoặc (service, config_obj).
        """
        try:
            service = ServiceDefinition.objects.get(service_key=service_key)
        except ServiceDefinition.DoesNotExist:
            return self.error_response(
                request,
                code='SERVICE_NOT_FOUND',
                detail=f"Service '{service_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        # Check ownership
        matrix = build_ownership_matrix_from_db()
        if not matrix.is_domain_writable(domain):
            block_reason = matrix.get_write_block_reason(domain)
            return self.error_response(
                request,
                code='OWNERSHIP_WRITE_DENIED',
                detail=block_reason or f"Domain '{domain}' không có quyền ghi.",
                http_status=status.HTTP_403_FORBIDDEN,
            )

        # Validate config
        config_obj = config_class.from_dict(config_payload)
        errors = config_obj.validate()
        if errors:
            return self.error_response(
                request,
                code='CONFIG_VALIDATION_FAILED',
                detail='; '.join(errors),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'payload': errors},
            )

        # Save config transactionally
        try:
            with transaction.atomic():
                svc_config = ServiceConfig.objects.create(
                    service=service,
                    config_schema_version='1.0',
                    config_payload=config_obj.to_dict(),
                    applied_by=getattr(request.user, 'username', 'api'),
                    change_reason=request.data.get('change_reason', ''),
                )

                # Audit trail
                ConfigChangeAudit.objects.create(
                    service=service,
                    action='apply',
                    actor=getattr(request.user, 'username', 'api'),
                    actor_ip=request.META.get('REMOTE_ADDR', ''),
                    before_snapshot={},
                    after_snapshot=config_obj.to_dict(),
                    change_summary=request.data.get('change_reason', ''),
                    request_id=self.get_request_id(request),
                )
        except Exception as e:
            return self.error_response(
                request,
                code='CONFIG_SAVE_FAILED',
                detail=f"Lỗi lưu config: {str(e)}",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return (service, svc_config)
