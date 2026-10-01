"""
Self-service onboarding endpoints for packages/core.

Allows authenticated users to register a trial tenant and receive welcome communication.

.. warning::

   **This endpoint is currently unreachable in production.** It is not listed in
   ``identity_access.middleware.TenantResolutionMiddleware.EXEMPT_PATH_PREFIXES``
   (middleware.py:25-35), and that middleware answers ``403 tenant_not_found``
   for any authenticated user it cannot resolve a tenant for (middleware.py:93-101)
   - which is exactly the only kind of user this endpoint exists to serve. It is
   reachable in tests only because ``force_authenticate`` attaches the user
   *after* the middleware has already run.

   Option B was chosen over deleting the endpoint: `urls.py` is not this slice's
   to change, deletion would break the FE's zero-caller contract for no gain,
   and one line in a file slice B already owns restores the feature. The exact
   line is in the slice A report:

       EXEMPT_PATH_PREFIXES = (
           ...
           '/core/v1/onboarding/',     # <- slice B adds this
           ...
       )

   Everything below is written so it is correct the moment that line lands: the
   three writes are atomic, the owner race is resolved by a row lock plus an
   ``IntegrityError`` guard, ``IsTenantActive`` is no longer dropped, and the
   tenant code carries real entropy.
"""
import logging
import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from tenant_lifecycle.models import TenantLifecycleEvent
from .envelope import envelope
from .models import CoreTenant, UserProfile
from .permissions import IsTenantActive
from .serializers import CoreTenantSerializer

logger = logging.getLogger(__name__)

#: Bytes of entropy in the generated tenant code. Was `secrets.token_hex(4)`,
#: i.e. 32 bits, and tenant_code is UNIQUE - a birthday collision on 2**16
#: values is likely somewhere around 300 tenants, so a popular signup burst
#: could start colliding and surface as an opaque 500. 12 bytes = 96 bits keeps
#: the value inside the 96-character column while making a collision
#: unreachable in practice.
TENANT_CODE_ENTROPY_BYTES = 12


class RegisterTenantSerializer(serializers.Serializer):
    """Input schema for tenant registration."""
    display_name = serializers.CharField(
        max_length=120,
        allow_blank=False,
        required=True,
        help_text='Display name for the tenant',
    )


def _enqueue_welcome_email(user, tenant):
    """Enqueue a welcome email task for the new trial tenant."""
    from identity_access.email_tasks import send_welcome_email
    send_welcome_email.delay(user.id, tenant.public_id)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsTenantActive])
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

    See the module docstring: this route is not yet reachable in production
    because ``TenantResolutionMiddleware.EXEMPT_PATH_PREFIXES`` is missing the
    ``/core/v1/onboarding/`` prefix.
    """
    user = request.user

    # Validate input first. Validating before touching the database is also what
    # makes the duplicate check below meaningful: a malformed body should not
    # consume the "one tenant per user" answer.
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

    trial_ends_at = timezone.now() + timedelta(days=14)
    try:
        # The three writes below were independent commits, so a failure at the
        # lifecycle event left a tenant with no TRIAL_STARTED audit row and no
        # welcome email, with nothing to retry from. One transaction.
        with transaction.atomic():
            # A8: `CoreTenant.owner_user` is a OneToOne, so the database does
            # enforce one tenant per owner - but the old code did a
            # `.filter(...).first()` check OUTSIDE any transaction and then
            # `create()`d inside none, so two concurrent POSTs both passed the
            # check and the loser got an unhandled IntegrityError (a 500) rather
            # than the 409 this endpoint documents. Locking the user row
            # serialises the check against itself; the IntegrityError handler
            # below is the backstop if the lock is ever bypassed.
            locked_user = type(user).objects.select_for_update().get(pk=user.pk)

            existing_tenant = CoreTenant.objects.filter(owner_user=locked_user).first()
            if existing_tenant is not None:
                return Response(
                    {
                        'error': 'Conflict',
                        'message': f'User already has tenant: {existing_tenant.public_id}',
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # 1. Create tenant with trial status.
            # A8: tenant_code entropy was `secrets.token_hex(4)` = 32 bits on a
            # UNIQUE column. 96 bits now, still inside the 96-char limit.
            tenant = CoreTenant.objects.create(
                owner_user=locked_user,
                display_name=display_name,
                tenant_code=f'tenant-{locked_user.id}-{secrets.token_urlsafe(TENANT_CODE_ENTROPY_BYTES)}',
                plan=CoreTenant.PlanChoices.FREE,
                status=CoreTenant.StatusChoices.TRIAL,
                trial_ends_at=trial_ends_at,
                features=[],
            )

            # 2. Log lifecycle event: TRIAL_STARTED.
            TenantLifecycleEvent.objects.create(
                tenant=tenant,
                event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED,
                actor_type='self_service',
                actor_user=locked_user,
                new_value={
                    'status': tenant.status,
                    'plan': tenant.plan,
                    'trial_ends_at': trial_ends_at.isoformat(),
                },
            )

            # 3. A8: this never created a UserProfile, and
            # `email_tasks.send_welcome_email` resolves the recipient through
            # `UserProfile.objects.get(user__id=...)`. Without a profile it took
            # the `UserProfile.DoesNotExist` branch and returned
            # {'status': 'skipped'} - so the welcome email was never sent by this
            # endpoint, silently, on every single successful signup.
            # The other registration paths (register_view, verify_email_view)
            # both create a profile; this one was the odd one out.
            UserProfile.objects.get_or_create(
                user=locked_user,
                defaults={
                    'tenant': tenant,
                    'display_name': display_name,
                    'theme': 'dark',
                    'language': 'vi',
                },
            )
    except IntegrityError:
        # Lost the OneToOne race, or tenant_code collided. Same answer as the
        # check above: the user already has a tenant.
        logger.info('register_tenant_view: concurrent signup detected for user=%s', user.pk)
        return Response(
            {
                'error': 'Conflict',
                'message': 'User already has a tenant.',
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Enqueue welcome email (async, non-critical). Deliberately OUTSIDE the
    # transaction: a broker outage must not roll back a tenant that exists.
    try:
        _enqueue_welcome_email(user, tenant)
    except Exception:
        # Log but don't fail the registration if email enqueue fails
        logger.error(
            'Welcome email enqueue failed for user=%s tenant=%s',
            user.id, tenant.tenant_code, exc_info=True,
        )

    # Return created tenant
    result_serializer = CoreTenantSerializer(tenant)
    return envelope(result_serializer.data, status=status.HTTP_201_CREATED)
