import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.exceptions import APIException

from vninvest_core.exceptions import (
    ConflictErrorException,
    InternalErrorException,
    RateLimitErrorException,
    ValidationErrorException,
)

from ..models import (
    CoreServiceAccount,
    CoreTenant,
    EmailVerificationToken,
    OutboxEvent,
    UserProfile,
)
from ..schema import F3SuccessResponseSerializer
from ..security_utils import (
    atomic_bump,
    client_ip_bucket,
    client_subnet_bucket,
    enforce_rate_limit,
    get_client_ip,
    get_user_by_email,
    get_user_by_username,
    peek_rate_limit,
    value_bucket,
)
from .helpers import success_response

logger = logging.getLogger(__name__)
User = get_user_model()


# --------------------------------------------------------------------------
# A6 - malformed-traffic ceiling.
#
# The register budget used to be consumed before the payload was even looked at
# (`cache.set(ip_key, ip_count + 1, 60)` ran before `serializer.is_valid()`), so
# three typos locked a user out for 60 seconds and an attacker sharing a victim's
# NAT could burn the victim's /24 bucket for them.
#
# The budget is now spent only on a real attempt. That alone would re-open the
# bot hole, because a bot spraying malformed JSON would get unlimited free tries
# at whatever the Turnstile endpoint costs. So malformed traffic gets its own,
# looser IP ceiling: enough to stop a flood, loose enough that a human's typos do
# not consume the real registration budget.
#
# TODO(coordinator): promote to settings as REGISTER_MALFORMED_IP_LIMIT so it is
# operator-tunable like every other threshold. settings.py is not this slice's.
MALFORMED_ATTEMPT_IP_MULTIPLIER = 3

#: A7 - one message and one code for every registration failure that is not
#: caused by the payload itself. Previously three distinguishable outcomes
#: (`username_already_exists`, `email_already_exists`, 201) let an unauthenticated
#: caller confirm any username or email in the system.
REGISTRATION_UNAVAILABLE_DETAIL = (
    'Không thể tạo tài khoản với thông tin đã cung cấp. '
    'Nếu bạn đã có tài khoản, hãy đăng nhập hoặc dùng chức năng quên mật khẩu.'
)
REGISTRATION_UNAVAILABLE_CODE = 'registration_unavailable'

#: A7 - the single response shape of the resend endpoint, for all three of its
#: internal outcomes (address unknown / already activated / token sent).
RESEND_NEUTRAL_MESSAGE = (
    'Nếu email tồn tại trong hệ thống và chưa được xác minh, '
    'một liên kết xác minh mới đã được gửi.'
)


def _malformed_ip_limit() -> int:
    return max(1, settings.REGISTER_IP_LIMIT_THRESHOLD) * MALFORMED_ATTEMPT_IP_MULTIPLIER


def _dispatch_verification_email(user_id: int, event_id, email: str, raw_token: str) -> None:
    """Push the verification email onto the broker. Never raises.

    A3: this runs from a ``transaction.on_commit`` hook, i.e. *after* the user,
    tenant, profile and service-account rows are already committed. The old
    lambda called ``.delay()`` bare, so a broker outage propagated out of the
    callback, through the blanket ``except Exception`` in the view, and turned a
    fully successful registration into a 500 ``server_error``. The client then
    retried and got a 409 on the second attempt, having no way to tell the two
    apart. A queue being down must never change the HTTP status of a write that
    already happened.

    On failure the OutboxEvent row is deliberately left PENDING so the beat
    poller can pick it up, and the log carries the user id for reconciliation.
    """
    try:
        from data_ingest.tasks import trigger_email_verification_flow

        trigger_email_verification_flow.delay(
            user_id,
            event_id,
            email=email,
            token=raw_token,
            frontend_url=settings.FRONTEND_URL,
        )
    except Exception:
        logger.exception(
            'verification email enqueue failed for user_id=%s event_id=%s; '
            'leaving the outbox row PENDING for the beat poller',
            user_id,
            event_id,
        )


#: Cả ba view dưới đây trả F3 **phẳng** `{status, timestamp, request_id, data}`
#: qua `success_response()` (`views/helpers.py:327`) — **không** phải envelope
#: `{data, meta}`. `request_id` là thứ client dùng để tra log nên không được bọc
#: vào `data`.
#:
#: `register_view` trả **201** (`status.HTTP_201_CREATED`), không phải 200.
@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={201: F3SuccessResponseSerializer},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """
    SFI-B2.2: POST /api/auth/register/
    Upgraded SaaS Native User Registration with 3-Layer Spam Shield and Transactional Outbox.
    """
    from django.db import transaction

    from ..serializers import SaaSRegisterSerializer

    # A5: was `request.META['HTTP_X_FORWARDED_FOR'].split(',')[0]`, i.e. the
    # left-most XFF entry, which is the one a client injects. Every rate limit
    # in this file was therefore trivially bypassable with
    # `X-Forwarded-For: 1.2.3.4`. get_client_ip() honours the header only when
    # the socket peer is a trusted proxy, and falls back to UNKNOWN_IP - which
    # deliberately puts every unidentifiable caller in one shared bucket, the
    # fail-closed direction.
    client_ip = get_client_ip(request)

    # Peek only: the attempt budget is NOT consumed yet (A6).
    attempt_buckets = [
        client_ip_bucket(
            'register',
            request,
            settings.REGISTER_IP_LIMIT_THRESHOLD,
            'Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.',
        ),
        client_subnet_bucket(
            'register',
            request,
            settings.REGISTER_SUBNET_LIMIT_THRESHOLD,
            'Thử lại quá nhanh từ mạng của bạn. Vui lòng đợi 1 phút.',
        ),
    ]
    enforce_rate_limit(attempt_buckets, code='register_rate_limit_exceeded', consume=False)

    serializer = SaaSRegisterSerializer(data=request.data, context={'client_ip': client_ip})
    if not serializer.is_valid():
        # A6: malformed/invalid payloads get their own, looser IP ceiling so a
        # flood is still bounded while a few typos cannot lock a real user out
        # of a real attempt.
        enforce_rate_limit(
            [client_ip_bucket(
                'register-malformed',
                request,
                _malformed_ip_limit(),
                'Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.',
            )],
            code='register_rate_limit_exceeded',
        )
        raise ValidationErrorException(
            detail=serializer.errors,
            code='validation_error'
        )

    data = serializer.validated_data
    normalized_email = str(data['email']).lower()

    # A real attempt: now the budget is spent. The email dimension is keyed on
    # the serializer's normalised email, i.e. an address that came out of a
    # syntactically valid request, not on whatever the client typed. An
    # attacker can still burn one victim's email bucket, but only by spending
    # their own IP budget (3/min) and their own subnet budget (10/min) to do it,
    # so the vector is bounded instead of free.
    enforce_rate_limit(
        attempt_buckets + [
            value_bucket(
                'register',
                'email',
                normalized_email,
                settings.REGISTER_EMAIL_LIMIT_THRESHOLD,
                'Thử lại quá nhanh với email này. Vui lòng đợi 1 phút.',
            ),
        ],
        code='register_rate_limit_exceeded',
    )

    # A7 + A10: duplicate detection happens once, after validation, and both
    # collisions produce the SAME opaque error. Previously the username collision
    # and the email collision had distinct codes, so an unauthenticated caller
    # could tell which of the two was taken - and a 409 vs a 201 told them
    # whether the pair was free at all.
    if get_user_by_username(data['username']) is not None or get_user_by_email(normalized_email) is not None:
        raise ConflictErrorException(
            detail=REGISTRATION_UNAVAILABLE_DETAIL,
            code=REGISTRATION_UNAVAILABLE_CODE,
        )

    try:
        with transaction.atomic():
            # 1. Tạo đối tượng User (chờ kích hoạt qua email)
            user = User.objects.create_user(
                username=data['username'],
                email=data['email'],
                password=data['password'],
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                is_active=False
            )

            # 2. Tạo CoreTenant tương ứng làm chủ sở hữu
            tenant = CoreTenant.objects.create(
                owner_user=user,
                tenant_code=f"tenant_{user.username}",
                display_name=f"{user.first_name} {user.last_name}'s Workspace".strip() or f"{user.username}'s Workspace",
                plan=CoreTenant.PlanChoices.FREE,
                status=CoreTenant.StatusChoices.ACTIVE
            )

            # 3. Tạo UserProfile
            UserProfile.objects.create(
                user=user,
                tenant=tenant,
                display_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                theme='dark',
                language='vi'
            )

            # 4. Áp dụng Quyền tối thiểu (Least Privilege)
            # Tạo Service Account ở mức phân quyền thấp
            service_account = CoreServiceAccount.objects.create(
                tenant=tenant,
                name="default",
                status=CoreServiceAccount.StatusChoices.ACTIVE,
                scopes=['market:read', 'signals:read']  # Chỉ đọc dữ liệu thị trường căn bản
            )

            # 5. Ghi nhận Transactional Outbox Event
            event_payload = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "tenant_id": str(tenant.id),
                "service_account_id": str(service_account.id)
            }

            outbox_event = OutboxEvent.objects.create(
                event_type='UserRegisteredEvent',
                payload=event_payload,
                status=OutboxEvent.STATUS_PENDING
            )

            # 6. Sinh token xác minh và gửi email
            # 256 bits of entropy from a CSPRNG, stored only as a SHA-256 hash.
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

            # Hủy kích hoạt tất cả các token xác minh cũ của user.
            # A12e: the rows are marked used but never deleted, so this table
            # grows without bound; `email_tasks.prune_email_verification_tokens`
            # (added in this slice) deletes them, but it still needs a
            # CELERY_BEAT_SCHEDULE entry - see the report to the coordinator.
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

            # Tạo token mới trong DB với TTL 30 phút
            expires_at = timezone.now() + timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES)
            EmailVerificationToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at
            )

            # 7. Lập lịch gửi Email bất đồng bộ an toàn qua on_commit
            transaction.on_commit(
                lambda: _dispatch_verification_email(
                    user.id,
                    outbox_event.event_id,
                    user.email,
                    raw_token,
                ),
                robust=True,
            )

    except APIException:
        # A3: a typed DRF/CoreAPIException raised inside the block (e.g. from a
        # post_save signal or a future row-level guard) keeps its own status and
        # code. The blanket handler used to relabel every one of them as
        # 500 server_error, destroying the only signal the caller had.
        raise
    except Exception:
        logger.exception("Error occurred during user registration provisioning transaction.")
        raise InternalErrorException(
            detail="Không thể xử lý yêu cầu đăng ký do lỗi hệ thống.",
            code="server_error"
        )

    # A3: outside the try on purpose. success_response() cannot fail, and having
    # it inside meant a post-commit `.delay()` failure could re-label a
    # successful registration as a 500.
    return success_response({
        "username": user.username,
        "email": user.email,
        "plan": tenant.plan,
        "tenant_id": str(tenant.id),
        "verification_required": True,
        "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản."
    }, status.HTTP_201_CREATED, request=request)


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: F3SuccessResponseSerializer},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def verify_email_view(request):
    """
    SFI-B2.3: POST /api/auth/verify-email/
    Body: { "token": "..." }
    Activates the user account and elevates scopes.
    """
    from django.db import transaction

    token = str(request.data.get('token', '') or '').strip()
    if not token:
        raise ValidationErrorException(
            detail={'token': ['token is required.']},
            code='validation_error'
        )

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    max_attempts = settings.EMAIL_VERIFICATION_MAX_ATTEMPTS

    # A11: the endpoint had NO rate limit at all, so the 256-bit token was the
    # only defence and a token found in a log or a shared inbox could be
    # ground-tested at will. Two dimensions: per client IP, and per token hash
    # so one bad actor cannot rotate IPs to keep grinding a single guess.
    # The per-IP limit is per-attempt (a wrong guess is a real attempt), while
    # the per-token limit is generous because the legitimate client retries.
    enforce_rate_limit(
        [
            client_ip_bucket(
                'verify-email',
                request,
                settings.EMAIL_VERIFICATION_MAX_ATTEMPTS * 4,
                'Thử quá nhiều lần. Vui lòng đợi một chút rồi thử lại.',
            ),
            value_bucket(
                'verify-email',
                'token',
                token_hash,
                max_attempts * 2,
                'Mã xác minh đã bị thử quá nhiều lần. Vui lòng yêu cầu gửi lại email.',
            ),
        ],
        code='verification_rate_limited',
    )

    failure_detail = 'Token không hợp lệ hoặc đã hết hạn.'
    lockout_detail = 'Tài khoản này đã bị khóa xác minh do thử quá nhiều lần. Vui lòng yêu cầu gửi lại email.'

    # A11: the token is now read under `SELECT ... FOR UPDATE` and `is_used` is
    # re-checked inside the lock. Before this the read was a bare
    # `.filter().first()` and the `is_used` test sat OUTSIDE the atomic block
    # that started later, so two concurrent POSTs with the same valid token both
    # passed and both activated - the second one re-running the scope elevation.
    with transaction.atomic():
        token_obj = (
            EmailVerificationToken.objects
            .select_for_update()
            .filter(token_hash=token_hash)
            .first()
        )
        lockout_key = None
        failure = None

        if token_obj is None:
            # A11: a wrong token used to increment NOTHING, so the per-email
            # `attempts` counter only ever counted replays of the CORRECT token
            # and was useless as a brute-force control.
            failure = 'unknown'
        elif token_obj.is_used:
            failure = 'used'
        elif token_obj.expires_at < timezone.now():
            failure = 'expired'
        elif token_obj.attempts >= max_attempts:
            failure = 'attempts'
        else:
            user = token_obj.user
            user.is_active = True
            user.save(update_fields=['is_active'])

            token_obj.is_used = True
            token_obj.save(update_fields=['is_used'])

            lockout_key = f'ratelimit:verify:attempts:{(user.email or "").strip().lower()}'
            cache.delete(lockout_key)

            # Nâng scopes Service Account (Progressive Elevation)
            tenant, _ = CoreTenant.objects.get_or_create(
                owner_user=user,
                defaults={
                    'tenant_code': f"tenant_{user.username}",
                    'display_name': f"{user.first_name} {user.last_name}'s Workspace".strip() or f"{user.username}'s Workspace",
                    'plan': CoreTenant.PlanChoices.FREE,
                    'status': CoreTenant.StatusChoices.ACTIVE
                }
            )

            # Tạo default UserProfile nếu thiếu
            UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'tenant': tenant,
                    'display_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'theme': 'dark',
                    'language': 'vi'
                }
            )

            service_account, _ = CoreServiceAccount.objects.get_or_create(
                tenant=tenant,
                name="default",
                defaults={
                    'status': CoreServiceAccount.StatusChoices.ACTIVE,
                    'scopes': ['market:read', 'signals:read']
                }
            )
            # A12d: was `list(set(service_account.scopes or []) | {...})`. Set
            # iteration order is not defined, so two servers that provisioned
            # the same account could store the same scopes in a different order,
            # which shows up as a spurious diff in every audit and makes
            # `CoreServiceAccountSerializer` output unstable for tests and
            # clients that compare arrays.
            service_account.scopes = sorted(set(service_account.scopes or []) | {'ai:invoke', 'manage_pats'})
            service_account.save(update_fields=['scopes', 'updated_at'])

        if failure is not None:
            if token_obj is not None and not token_obj.is_used:
                # A11: every failure path now counts, not just replays.
                token_obj.attempts += 1
                if token_obj.attempts >= max_attempts:
                    token_obj.is_used = True
                token_obj.save(update_fields=['attempts', 'is_used'])
                lockout_key = f'ratelimit:verify:attempts:{token_obj.user.email.strip().lower()}'

    # Bookkeeping for the failure path happens AFTER the atomic block so a raise
    # below cannot roll the attempt counter back.
    if failure is not None:
        locked = False
        if lockout_key:
            locked = _bump_verify_lockout(lockout_key, max_attempts)
        if failure == 'attempts' or locked:
            raise RateLimitErrorException(
                detail=lockout_detail,
                code='verification_locked_out'
            )
        raise ValidationErrorException(
            detail=failure_detail,
            code='invalid_token'
        )

    return success_response({
        'message': 'Email đã được xác minh. Bạn có thể đăng nhập.'
    }, status.HTTP_200_OK, request=request)


def _bump_verify_lockout(lockout_key: str, max_attempts: int) -> bool:
    """Count a failed verification against the per-email lockout.

    Uses the shared atomic primitive and the operator-tunable
    ``EMAIL_VERIFICATION_LOCKOUT_TIMEOUT``, replacing a hard-coded 900s that no
    one could change without a deploy (the setting existed but was never read).

    Returns:
        bool: True once the address is locked out. The caller turns that into a
        429, which is what makes the lockout observable to the client instead
        of it silently only logging.
    """
    attempts = atomic_bump(lockout_key, settings.EMAIL_VERIFICATION_LOCKOUT_TIMEOUT)
    logger.info('verify_email: attempt counter for one address is now %s/%s', attempts, max_attempts)
    if attempts >= max_attempts:
        logger.warning('verify_email: address locked out after %s failed attempts', attempts)
        return True
    return False


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: F3SuccessResponseSerializer},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def resend_email_verification_view(request):
    """
    SFI-B2.3a: POST /api/auth/resend-verification/
    Body: { "email": "..." }
    Resends the email verification token with anti-abuse multi-dimensional rate limiting.
    """
    from django.db import transaction

    email = str(request.data.get('email', '') or '').strip()
    if not email:
        raise ValidationErrorException(
            detail={'email': ['Email là bắt buộc.']},
            code='validation_error'
        )

    normalized_email = email.lower()

    # A5: atomic now, and checked all-then-consumed. Previously the IP bucket
    # was incremented before the subnet bucket was even looked at, so a request
    # rejected on the subnet dimension still burned the caller's IP budget.
    enforce_rate_limit(
        [
            client_ip_bucket(
                'resend',
                request,
                settings.RESEND_IP_LIMIT_THRESHOLD,
                'Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.',
            ),
            client_subnet_bucket(
                'resend',
                request,
                settings.RESEND_SUBNET_LIMIT_THRESHOLD,
                'Thử lại quá nhanh từ mạng của bạn. Vui lòng đợi 1 phút.',
            ),
        ],
        code='rate_limit_exceeded',
    )

    # Cooldown per email, on the operator-tunable setting that existed but was
    # never read (the value was hard-coded to 60s).
    cooldown_key = f'cooldown:resend:email:{normalized_email}'
    if peek_rate_limit(cooldown_key):
        raise RateLimitErrorException(
            detail='Vui lòng đợi một chút trước khi yêu cầu gửi lại email xác minh.',
            code='resend_cooldown_active'
        )
    cache.set(cooldown_key, 1, settings.EMAIL_VERIFICATION_RESEND_COOLDOWN)

    # A7: this comment promised enumeration-safe responses and then returned
    # three different messages - "a new link was sent" / "already verified" /
    # nothing at all - so it disclosed both whether the address exists AND
    # whether the account was already activated. One shape for all outcomes.
    user = get_user_by_email(normalized_email)
    if user is None or user.is_active:
        return success_response({'message': RESEND_NEUTRAL_MESSAGE}, status.HTTP_200_OK, request=request)

    try:
        with transaction.atomic():
            # A12e: rows are marked used, never deleted - pruned by
            # `email_tasks.prune_email_verification_tokens` once the coordinator
            # adds it to CELERY_BEAT_SCHEDULE.
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

            # Ghi nhận Transactional Outbox Event
            event_payload = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
            }

            # Resend is NOT a registration. It gets its own event type so the two
            # flows stay distinguishable in the outbox table (and in any audit that
            # counts "registrations" from it). Both types route to the same email
            # consumer -- see data_ingest/tasks.py _OUTBOX_CONSUMERS -- so this is a
            # semantics fix, not a routing fix. Imported inside the branch because
            # data_ingest.tasks pulls in celery; a module-level import would make
            # this view module pay for celery on every import.
            from data_ingest.tasks import EMAIL_VERIFICATION_REQUESTED_EVENT

            outbox_event = OutboxEvent.objects.create(
                event_type=EMAIL_VERIFICATION_REQUESTED_EVENT,
                payload=event_payload,
                status=OutboxEvent.STATUS_PENDING
            )

            # Sinh token xác minh và lưu DB
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

            expires_at = timezone.now() + timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES)
            EmailVerificationToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at
            )

            # Same defensive dispatch as register_view: a broker outage must not
            # turn a completed write into a 500.
            transaction.on_commit(
                lambda: _dispatch_verification_email(
                    user.id,
                    outbox_event.event_id,
                    user.email,
                    raw_token,
                ),
                robust=True,
            )

    except APIException:
        raise
    except Exception:
        logger.exception("Failed to resend verification email.")
        raise InternalErrorException(
            detail='Không thể xử lý yêu cầu gửi lại email xác minh do lỗi hệ thống.',
            code='resend_failed'
        )

    return success_response({'message': RESEND_NEUTRAL_MESSAGE}, status.HTTP_200_OK, request=request)
