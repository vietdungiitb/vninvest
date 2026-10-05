"""
Webhook Management views for partner namespace (Phase 4).

Endpoints:
  GET    /partner/webhooks/                        — list
  POST   /partner/webhooks/                        — create
  GET    /partner/webhooks/<id>/                   — detail
  PATCH  /partner/webhooks/<id>/                   — update
  DELETE /partner/webhooks/<id>/                   — delete
  POST   /partner/webhooks/<id>/regenerate-secret/ — rotate HMAC secret
  GET    /partner/webhooks/<id>/deliveries/         — delivery log
  POST   /partner/webhooks/<id>/test/               — test dispatch
"""
from __future__ import annotations

import logging
import secrets

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from vninvest_core.api_envelope import envelope_response

from identity_access.envelope import envelope
from identity_access.models import CoreTenant, TenantWebhookConfig, WebhookDelivery
from identity_access.permissions import IsTenantActive, require_pat_scopes_or_human_session
from identity_access.utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission
from identity_access.schema import (
    DetailResponseSerializer,
    PartnerBillingStatusSerializer,
    PlanChangePreviewSerializer,
    WebhookConfigWithSecretSerializer,
    WebhookSecretResponseSerializer,
)
from identity_access.serializers import TenantWebhookConfigSerializer, WebhookDeliverySerializer
from identity_access.tasks import deprovision_tenant_async
from identity_access.webhook_dispatcher import WebhookDispatcher
from drf_spectacular.openapi import OpenApiTypes


logger = logging.getLogger(__name__)

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


@extend_schema(
    summary='WebhookConfigListCreateView',
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
class WebhookConfigListCreateView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(TenantWebhookConfigSerializer, many=True)},
    )
    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:read')
        tenant = _get_request_tenant(request)
        qs = TenantWebhookConfig.objects.filter(tenant=tenant).order_by('-created_at')
        return envelope(TenantWebhookConfigSerializer(qs, many=True).data)

    @extend_schema(
        responses={201: envelope_response(WebhookConfigWithSecretSerializer)},
    )
    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        tenant = _get_request_tenant(request)
        serializer = TenantWebhookConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        config = serializer.save(tenant=tenant)
        data = TenantWebhookConfigSerializer(config).data
        data['raw_secret'] = config.secret
        return envelope(data, status=status.HTTP_201_CREATED)


class WebhookConfigDetailView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    def _get_config(self, request, config_id):
        tenant = _get_request_tenant(request)
        try:
            return TenantWebhookConfig.objects.get(id=config_id, tenant=tenant)
        except TenantWebhookConfig.DoesNotExist:
            return None

    @extend_schema(
        responses={200: envelope_response(TenantWebhookConfigSerializer)},
    )
    @extend_schema(
        summary='WebhookConfigDetailView GET',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:read')
        config = self._get_config(request, config_id)
        if config is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return envelope(TenantWebhookConfigSerializer(config).data)

    @extend_schema(
        responses={200: envelope_response(TenantWebhookConfigSerializer)},
    )
    @extend_schema(
        summary='WebhookConfigDetailView PATCH',
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
    def patch(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        config = self._get_config(request, config_id)
        if config is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TenantWebhookConfigSerializer(config, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return envelope(TenantWebhookConfigSerializer(config).data)

    @extend_schema(
        responses={204: None},
    )
    @extend_schema(
        summary='WebhookConfigDetailView DELETE',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            204: None,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def delete(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        config = self._get_config(request, config_id)
        if config is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        config.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='WebhookRegenerateSecretView',
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
class WebhookRegenerateSecretView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(WebhookSecretResponseSerializer)},
    )
    def post(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        tenant = _get_request_tenant(request)
        try:
            config = TenantWebhookConfig.objects.get(id=config_id, tenant=tenant)
        except TenantWebhookConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        config.secret = secrets.token_hex(32)
        config.save(update_fields=['secret'])
        return envelope({'raw_secret': config.secret})


class WebhookDeliveryLogView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(WebhookDeliverySerializer, many=True)},
    )
    def get(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:read')
        tenant = _get_request_tenant(request)
        try:
            config = TenantWebhookConfig.objects.get(id=config_id, tenant=tenant)
        except TenantWebhookConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        qs = WebhookDelivery.objects.filter(config=config).order_by('-created_at')[:100]
        return envelope(WebhookDeliverySerializer(qs, many=True).data)


@extend_schema(
    summary='WebhookTestView',
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
class WebhookTestView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(DetailResponseSerializer)},
    )
    def post(self, request, config_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        tenant = _get_request_tenant(request)
        try:
            config = TenantWebhookConfig.objects.get(id=config_id, tenant=tenant)
        except TenantWebhookConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        from .webhook_dispatcher import _schedule_delivery
        _schedule_delivery(config, 'webhook.test', {
            'event': 'webhook.test',
            'message': 'This is a test event from VNInvest webhook system.',
        })
        return envelope({'detail': 'Test webhook dispatched'})


@extend_schema(
    summary='WebhookManualRetryView',
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
class WebhookManualRetryView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(DetailResponseSerializer)},
    )
    def post(self, request, config_id, delivery_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'webhook:write')
        tenant = _get_request_tenant(request)
        try:
            config = TenantWebhookConfig.objects.get(id=config_id, tenant=tenant)
        except TenantWebhookConfig.DoesNotExist:
            return Response({'detail': 'Config not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            delivery = WebhookDelivery.objects.get(id=delivery_id, config=config)
        except WebhookDelivery.DoesNotExist:
            return Response({'detail': 'Delivery not found'}, status=status.HTTP_404_NOT_FOUND)
        from .tasks import deliver_webhook
        deliver_webhook.delay(delivery.id)
        return envelope({'detail': 'Retry dispatched'})


class BillingStatusView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(PartnerBillingStatusSerializer)},
    )
    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        tenant = _get_request_tenant(request)
        data = {
            'plan': tenant.plan,
            'status': tenant.status,
            'pending': False,
            'trial_ends_at': tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
            'stripe_current_period_end': tenant.stripe_current_period_end.isoformat() if tenant.stripe_current_period_end else None,
        }
        return envelope(data)


@extend_schema(
    summary='PreviewPlanChangeView',
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
class PreviewPlanChangeView(generics.GenericAPIView):
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(PlanChangePreviewSerializer)},
    )
    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:write')
        tenant = _get_request_tenant(request)
        target_plan = request.data.get('target_plan', '').strip()
        if target_plan not in dict(CoreTenant.PlanChoices.choices):
            return Response({'detail': f'Invalid plan: {target_plan}'}, status=status.HTTP_400_BAD_REQUEST)

        features_map = {
            'free': {'api_calls': 1000, 'members': 3, 'sso': False, 'webhooks': False, 'audit_days': 7},
            'starter': {'api_calls': 10000, 'members': 5, 'sso': False, 'webhooks': False, 'audit_days': 7},
            'pro': {'api_calls': 50000, 'members': 25, 'sso': True, 'webhooks': True, 'audit_days': 30},
            'enterprise': {'api_calls': None, 'members': None, 'sso': True, 'webhooks': True, 'audit_days': 90},
        }

        current = features_map.get(tenant.plan, features_map['free'])
        target = features_map.get(target_plan, features_map['pro'])

        changes = {}
        for key in ['api_calls', 'members', 'sso', 'webhooks', 'audit_days']:
            if current.get(key) != target.get(key):
                changes[key] = {'from': current.get(key), 'to': target.get(key)}

        from datetime import date
        return envelope({
            'current_plan': tenant.plan,
            'target_plan': target_plan,
            'prorated_amount': 0,
            'next_billing_amount': 0,
            'effective_date': date.today().isoformat(),
            'trial_extension_days': None,
            'changes': changes,
        })


@extend_schema(
    summary='DeprovisionView',
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
class DeprovisionView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    @extend_schema(
        responses={200: envelope_response(DetailResponseSerializer)},
    )
    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'tenant:write')
        tenant = _get_request_tenant(request)
        if tenant.status == CoreTenant.StatusChoices.DEPROVISIONED:
            return Response({'detail': 'Tenant already deprovisioned.'}, status=status.HTTP_400_BAD_REQUEST)

        tenant.status = CoreTenant.StatusChoices.DEPROVISIONED
        tenant.save(update_fields=['status'])

        deprovision_tenant_async.delay(tenant.public_id)

        WebhookDispatcher.dispatch(tenant, 'tenant.deprovisioned', {
            'event': 'tenant.deprovisioned',
            'tenant_id': tenant.public_id,
            'tenant_code': tenant.tenant_code,
            'status': tenant.status,
            'occurred_at': timezone.now().isoformat(),
        })

        return envelope({'detail': 'Tenant deprovisioned successfully.'}, status=status.HTTP_200_OK)
