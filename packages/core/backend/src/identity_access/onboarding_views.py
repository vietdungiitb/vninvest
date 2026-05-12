"""
Self-service onboarding endpoints for packages/core.

Allows authenticated users to register a trial tenant and receive welcome communication.
"""
import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from tenant_lifecycle.models import TenantLifecycleEvent
from .models import CoreTenant
from .serializers import CoreTenantSerializer


class RegisterTenantSerializer(serializers.Serializer):
    """Input schema for tenant registration."""
    display_name = serializers.CharField(
        max_length=120,
        allow_blank=False,
        required=True,
        help_text='Display name for the tenant',
    )


def _enqueue_welcome_email(user, tenant):
    """
    Enqueue a welcome email task for the new trial tenant.

    In production, this would call a Celery task. For now, we log the intent
    as a side-effect and leave the actual email delivery to a later slice.
    """
    # TODO(T08-follow-up): Wire to actual mail queue task when available
    # from vninvest_core.tasks import send_welcome_email
    # send_welcome_email.delay(user.id, tenant.public_id)
    pass


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def register_tenant_view(request):
    """
    POST /api/core/v1/onboarding/register/

    Authenticated user creates their first tenant with trial status.

    Request body:
        {
            "display_name": "My Company"
        }

    Response:
        201 Created
        {
            "tenant_id": "uuid",
            "tenant_code": "tenant-123-xxxx",
            "display_name": "My Company",
            "plan": "free",
            "status": "trial",
            "trial_ends_at": "2026-05-26T...",
            ...
        }

    Errors:
        400 Bad Request — missing or invalid display_name
        409 Conflict — user already has a tenant
        500 Internal Server Error — unexpected DB error
    """
    user = request.user

    # Check if user already has a tenant
    existing_tenant = CoreTenant.objects.filter(owner_user=user).first()
    if existing_tenant is not None:
        return Response(
            {
                'error': 'Conflict',
                'message': f'User already has tenant: {existing_tenant.public_id}',
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Validate input
    serializer = RegisterTenantSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'error': 'Bad Request',
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    display_name = serializer.validated_data['display_name'].strip()

    # Create tenant with trial status
    trial_ends_at = timezone.now() + timedelta(days=14)
    tenant = CoreTenant.objects.create(
        owner_user=user,
        display_name=display_name,
        tenant_code=f'tenant-{user.id}-{secrets.token_hex(4)}',
        plan=CoreTenant.PlanChoices.FREE,
        status=CoreTenant.StatusChoices.TRIAL,
        trial_ends_at=trial_ends_at,
        features=[],
    )

    # Log lifecycle event: TRIAL_STARTED
    TenantLifecycleEvent.objects.create(
        tenant=tenant,
        event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED,
        actor_type='self_service',
        actor_user=user,
        new_value={
            'status': tenant.status,
            'plan': tenant.plan,
            'trial_ends_at': trial_ends_at.isoformat(),
        },
    )

    # Enqueue welcome email (async, non-critical)
    try:
        _enqueue_welcome_email(user, tenant)
    except Exception:
        # Log but don't fail the registration if email enqueue fails
        pass

    # Return created tenant
    result_serializer = CoreTenantSerializer(tenant)
    return Response(result_serializer.data, status=status.HTTP_201_CREATED)
