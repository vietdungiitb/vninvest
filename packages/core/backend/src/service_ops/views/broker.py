"""B2.3: SOC Broker domain views — system broker registry + system credentials ops.

GET /api/soc/broker/config/ — current config (defaults khi chưa có)
POST /api/soc/broker/config/apply/ — validate + lưu version mới + audit
POST /api/soc/broker/config/preview/ — diff before/after + validation errors
GET /api/soc/broker/audit/ — ConfigChangeAudit của service broker_config
GET /api/soc/broker/health/ — registry state + credential status (không secret)
GET /api/soc/broker/credentials/ — system credentials (masked preview)
POST /api/soc/broker/credentials/ — tạo/cập nhật (staff-only, có audit)
DELETE /api/soc/broker/credentials/<provider>/ — xóa (có audit)
POST /api/soc/broker/test-connection/ — enqueue test job hệ thống

Tất cả kế thừa SOCBaseView = [IsAuthenticated, IsAdminUser] (views/base.py:99-102).
"""
from __future__ import annotations

import logging
import uuid

from django.utils import timezone
from rest_framework import status
from vninvest_core.client_ip import get_client_ip

from rest_framework.response import Response

from ..domain_configs.broker import (
    BROKER_CONFIG_SERVICE_KEY,
    SUPPORTED_BROKER_PROVIDERS,
    VALID_PURPOSES,
    BrokerSystemConfig,
    get_default_broker_system_config,
)
from ..models import ConfigChangeAudit, ServiceConfig, ServiceDefinition
from ..envelope import envelope
from .base import SOCBaseView
from .mixins import ConfigApplyMixin
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


logger = logging.getLogger(__name__)


def _get_or_create_service() -> ServiceDefinition:
    service, _ = ServiceDefinition.objects.get_or_create(
        service_key=BROKER_CONFIG_SERVICE_KEY,
        defaults={
            'name': 'Broker System Config',
            'domain': 'platform',
            'description': 'Registry + guards cho brokerage hệ thống (dnse/ssi/tcbs).',
            'owner_team': 'core',
        },
    )
    return service


def _current_payload() -> dict:
    try:
        service = _get_or_create_service()
        current = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current and isinstance(current.config_payload, dict):
            return dict(current.config_payload)
    except Exception:  # noqa: BLE001 — DB chưa migrate vẫn trả defaults
        logger.warning('broker config: cannot read current, using defaults')
    return get_default_broker_system_config().to_dict()


def _diff_summary(before: dict, after: dict, prefix: str = '') -> list[str]:
    changes: list[str] = []
    keys = sorted(set((before or {}).keys()) | set((after or {}).keys()))
    for key in keys:
        old, new = (before or {}).get(key), (after or {}).get(key)
        path = f'{prefix}{key}'
        if isinstance(old, dict) and isinstance(new, dict):
            changes.extend(_diff_summary(old, new, prefix=path + '.'))
        elif old != new:
            changes.append(f'{path}: {old!r} → {new!r}')
    return changes


def _write_audit(request, action: str, before: dict | None, after: dict | None,
                 summary: str) -> None:
    try:
        service = _get_or_create_service()
        ConfigChangeAudit.objects.create(
            service=service,
            action=action,
            actor=getattr(request.user, 'username', 'staff'),
            actor_ip=get_client_ip(request),
            before_snapshot=before,
            after_snapshot=after,
            change_summary=summary[:2000],
            request_id=request.META.get('HTTP_X_REQUEST_ID', '') or f'req_{uuid.uuid4().hex[:16]}',
        )
    except Exception:  # noqa: BLE001 — audit không được chặn apply
        logger.exception('broker config: failed to write audit')


def _masked_system_credentials() -> list[dict]:
    from identity_access.models import SystemBrokerCredential
    rows = []
    for cred in SystemBrokerCredential.objects.all().order_by('provider'):
        rows.append({
            'provider': cred.provider,
            'allowed_purposes': cred.allowed_purposes or [],
            'is_verified': cred.is_verified,
            'last_verified_at': cred.last_verified_at,
            'last_check': cred.last_check or {},
            'preview': cred.masked_preview(),
            'updated_by': cred.updated_by,
        })
    return rows


@extend_schema(
    summary='BrokerConfigView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET current / POST apply registry config."""

    def get(self, request):
        return envelope({
            'config': _current_payload(),
            'service_key': BROKER_CONFIG_SERVICE_KEY,
        })

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        payload = data.get('config_payload') or {}
        change_reason = str(data.get('change_reason', '') or '')
        cfg = BrokerSystemConfig.from_dict(payload)
        errors = cfg.validate()
        if errors:
            return Response({'ok': False, 'validation_errors': errors},
                            status=status.HTTP_400_BAD_REQUEST)
        before = _current_payload()
        after = cfg.to_dict()
        summary_lines = _diff_summary(before, after)
        service = _get_or_create_service()
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload=after,
            applied_by=getattr(request.user, 'username', 'staff'),
            change_reason=change_reason[:500],
            is_current=True,
        )
        summary = '; '.join(summary_lines) or 'no changes'
        if change_reason:
            summary = f'[{change_reason[:120]}] ' + summary
        _write_audit(request, 'apply', before, after, summary)
        return envelope({'ok': True, 'config': after,
                         'change_summary': summary_lines})


@extend_schema(
    summary='BrokerConfigPreviewView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerConfigPreviewView(SOCBaseView):
    """POST preview: diff + validation, không lưu."""

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        payload = data.get('config_payload') or {}
        cfg = BrokerSystemConfig.from_dict(payload)
        errors = cfg.validate()
        before = _current_payload()
        after = cfg.to_dict()
        return envelope({
            'before': before,
            'after': after,
            'change_summary': _diff_summary(before, after),
            'validation_errors': errors,
        })


@extend_schema(
    summary='BrokerAuditView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerAuditView(SOCBaseView):
    """GET audit trail (limit ≤ 200)."""

    def get(self, request):
        try:
            limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
        except (TypeError, ValueError):
            limit = 50
        service = _get_or_create_service()
        rows = ConfigChangeAudit.objects.filter(service=service).order_by('-timestamp')[:limit]
        return envelope({'audits': [
            {'action': r.action, 'actor': r.actor, 'actor_ip': str(r.actor_ip or ''),
             'change_summary': r.change_summary, 'timestamp': r.timestamp,
             'request_id': r.request_id}
            for r in rows
        ]})


@extend_schema(
    summary='BrokerHealthView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerHealthView(SOCBaseView):
    """GET registry state + credential status (không secret)."""

    def get(self, request):
        cfg = BrokerSystemConfig.from_dict(_current_payload())
        creds = {c['provider']: c for c in _masked_system_credentials()}
        providers = []
        for provider_id in SUPPORTED_BROKER_PROVIDERS:
            entry = cfg.entries.get(provider_id)
            cred = creds.get(provider_id, {})
            providers.append({
                'provider': provider_id,
                'enabled': bool(entry and entry.enabled),
                'routing_order': entry.routing_order if entry else None,
                'purposes': entry.purpose_allowlist if entry else [],
                'credential_present': bool(cred),
                'is_verified': bool(cred.get('is_verified')),
                'last_check': cred.get('last_check') or {},
            })
        return envelope({
            'status': 'ok',
            'kill_switch_write': cfg.kill_switch_write,
            'quiet_hours': {'start': cfg.quiet_hours_start, 'end': cfg.quiet_hours_end},
            'providers': providers,
        })


@extend_schema(
    summary='BrokerCredentialsView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerCredentialsView(SOCBaseView):
    """GET list / POST upsert system credential (staff-only, có audit, không trả secret)."""

    def get(self, request):
        return envelope({'credentials': _masked_system_credentials()})

    def post(self, request):
        from identity_access.models import SystemBrokerCredential

        data = request.data if isinstance(request.data, dict) else {}
        provider = str(data.get('provider', '') or '').strip().lower()
        secrets = data.get('secrets') or {}
        purposes = [str(p) for p in (data.get('allowed_purposes') or [])]
        if provider not in SUPPORTED_BROKER_PROVIDERS:
            return Response({'ok': False, 'error': 'provider phải là dnse/ssi/tcbs'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(secrets, dict) or not secrets:
            return Response({'ok': False, 'error': 'secrets là bắt buộc'},
                            status=status.HTTP_400_BAD_REQUEST)
        unknown = [p for p in purposes if p not in VALID_PURPOSES]
        if unknown:
            return Response({'ok': False, 'error': f'purpose không hợp lệ: {unknown}'},
                            status=status.HTTP_400_BAD_REQUEST)
        cred, created = SystemBrokerCredential.objects.get_or_create(provider=provider)
        before = {'provider': provider, 'allowed_purposes': cred.allowed_purposes or [],
                  'preview': cred.masked_preview() if cred.secrets_cipher else {}}
        cred.set_secrets({k: str(v) for k, v in secrets.items()})
        cred.allowed_purposes = purposes
        cred.is_verified = False
        cred.last_verified_at = None
        cred.updated_by = getattr(request.user, 'username', 'staff')
        cred.save()
        after = {'provider': provider, 'allowed_purposes': purposes,
                 'preview': cred.masked_preview()}
        _write_audit(
            request, 'apply', before, after,
            f"system credential {provider} {'created' if created else 'rotated'} "
            f"(purposes: {','.join(purposes) or 'none'})")
        return envelope({'ok': True, 'credential': {
            'provider': provider, 'allowed_purposes': purposes,
            'is_verified': False, 'preview': cred.masked_preview()}})


@extend_schema(
    summary='BrokerCredentialDeleteView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerCredentialDeleteView(SOCBaseView):
    """DELETE system credential (có audit)."""

    def delete(self, request, provider):
        from identity_access.models import SystemBrokerCredential

        provider = str(provider or '').strip().lower()
        cred = SystemBrokerCredential.objects.filter(provider=provider).first()
        if not cred:
            return Response({'ok': False, 'error': 'not_found'},
                            status=status.HTTP_404_NOT_FOUND)
        before = {'provider': provider, 'preview': cred.masked_preview()}
        cred.delete()
        _write_audit(request, 'apply', before, None,
                     f'system credential {provider} deleted')
        return envelope({'ok': True})


@extend_schema(
    summary='BrokerTestConnectionView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class BrokerTestConnectionView(SOCBaseView):
    """POST enqueue system test-connection job (async, poll qua broker/jobs)."""

    def post(self, request):
        from ..tasks import test_system_broker_connection_task

        data = request.data if isinstance(request.data, dict) else {}
        provider = str(data.get('provider', '') or '').strip().lower()
        if provider not in SUPPORTED_BROKER_PROVIDERS:
            return Response({'ok': False, 'error': 'provider phải là dnse/ssi/tcbs'},
                            status=status.HTTP_400_BAD_REQUEST)
        job = test_system_broker_connection_task.delay(provider)
        return envelope({'job_id': job.id, 'state': 'pending'},
                        status=status.HTTP_202_ACCEPTED)
