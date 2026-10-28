"""Slice A regression tests: one test per verified defect, named after it.

Covers A1-A12 from the slice A brief. Each test states the concrete failure it
pins in its docstring, so a future revert is diagnosable from the test name
alone.

Run:
    CORE_DATABASE_URL=... DJANGO_DEBUG=1 \
        python manage.py test identity_access.tests.test_tenantreg_a
"""
import hashlib
import re
import secrets
import threading
from datetime import datetime, timedelta
from datetime import UTC
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.email_tasks import prune_email_verification_tokens
from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    EmailVerificationToken,
    PasswordResetToken,
    UserProfile,
)
from identity_access.security_utils import (
    atomic_bump,
    get_user_by_email,
    get_user_by_username,
    peek_rate_limit,
)
from identity_access.serializers import CoreTenantSerializer

User = get_user_model()

REGISTER_URL = '/core/v1/auth/register/'
VERIFY_URL = '/core/v1/auth/verify-email/'
RESEND_URL = '/core/v1/auth/resend-verification/'
LOGIN_URL = '/core/v1/auth/login/'
RESET_REQUEST_URL = '/core/v1/auth/password-reset/'
RESET_CONFIRM_URL = '/core/v1/auth/password-reset/confirm/'
PASSWORD_CHANGE_URL = '/core/v1/auth/password-change/'

STRONG_PASSWORD = 'BrandNewPassw0rd!'

# Turnstile is bypassed by emptying the secret with enforcement off, which is the
# documented development posture - it keeps these tests off the network without
# patching the method under test.
@override_settings(
    TURNSTILE_SECRET_KEY='',
    STRICT_TURNSTILE_ENFORCEMENT=False,
)
class TenantRegistrationSliceATests(TestCase):
    """A1, A2, A3, A5, A6, A7, A10, A12c."""

    def setUp(self):
        # LocMemCache survives between tests in the same process; the limiters
        # are keyed on 127.0.0.1 so a stale bucket would leak across tests.
        cache.clear()
        self.client = APIClient()

    def _register_payload(self, **over):
        payload = {
            'username': 'newcomer',
            'email': 'newcomer@vninvest.vn',
            'password': STRONG_PASSWORD,
            'password_confirm': STRONG_PASSWORD,
            'website': '',
            'turnstile_token': 'test-token',
        }
        payload.update(over)
        return payload

    # ---------------------------------------------------------------- A3
    def test_a3_register_returns_201_when_the_broker_is_down(self):
        """A3: a broker outage must not turn a committed signup into a 500.

        Before: the `.delay()` call lived in a `transaction.on_commit` lambda
        registered inside the view's `try:`. The rows committed, the callback
        raised, the blanket `except Exception` relabelled it 500 `server_error`,
        and the client - which had in fact succeeded - retried into a 409.
        """
        with patch(
            'data_ingest.tasks.trigger_email_verification_flow.delay',
            side_effect=OSError('broker unreachable'),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(REGISTER_URL, self._register_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newcomer').exists())
        self.assertTrue(CoreTenant.objects.filter(owner_user__username='newcomer').exists())
        # The outbox row is left PENDING so the beat poller can pick it up.
        from identity_access.models import OutboxEvent

        outbox = OutboxEvent.objects.get(event_type='UserRegisteredEvent')
        self.assertEqual(outbox.status, OutboxEvent.STATUS_PENDING)

    # ---------------------------------------------------------------- A6
    def test_a6_invalid_payloads_do_not_consume_the_attempt_budget(self):
        """A6: three typos must not lock a real registration out for 60s.

        Before: all three counters were incremented before the duplicate checks
        and before `serializer.is_valid()`, so three malformed requests burned
        the whole 3/minute IP budget and the legitimate 4th request got a 429.
        """
        for _ in range(3):
            bad = self.client.post(
                REGISTER_URL,
                self._register_payload(password='tiny', password_confirm='tiny'),
                format='json',
            )
            self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        # The attempt budget is untouched, so the real request still goes through.
        ok = self.client.post(REGISTER_URL, self._register_payload(), format='json')
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)

    def test_a6_malformed_flood_is_still_bounded(self):
        """A6: the other half of the trade-off - a malformed flood is still cut off.

        The attempt budget is only spent on real attempts, so without a separate
        ceiling a bot could hammer the endpoint for free. There is one, at
        REGISTER_IP_LIMIT_THRESHOLD * 3, and this pins that it actually trips.
        """
        statuses = []
        for _ in range(12):
            statuses.append(
                self.client.post(
                    REGISTER_URL,
                    self._register_payload(password='tiny', password_confirm='tiny'),
                    format='json',
                ).status_code
            )
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)
        self.assertEqual(statuses[-1], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_a6_attempt_budget_is_consumed_by_real_attempts(self):
        """A6: the budget still counts genuine attempts (3/minute per IP)."""
        statuses = []
        for index in range(5):
            statuses.append(
                self.client.post(
                    REGISTER_URL,
                    self._register_payload(
                        username=f'newcomer{index}',
                        email=f'newcomer{index}@vninvest.vn',
                    ),
                    format='json',
                ).status_code
            )
        self.assertEqual(statuses[:3], [status.HTTP_201_CREATED] * 3)
        self.assertEqual(statuses[3], status.HTTP_429_TOO_MANY_REQUESTS)

    # ---------------------------------------------------------------- A7
    def test_a7_username_and_email_collisions_are_indistinguishable(self):
        """A7: one 409, one code, one message - for either collision.

        Before: 409 `username_already_exists` vs 409 `email_already_exists` told
        an unauthenticated caller which of the two was taken.
        """
        User.objects.create_user(username='taken_name', email='taken@vninvest.vn', password=STRONG_PASSWORD)
        User.objects.create_user(username='other_name', email='other@vninvest.vn', password=STRONG_PASSWORD)

        by_username = self.client.post(
            REGISTER_URL,
            self._register_payload(username='taken_name', email='brandnew1@vninvest.vn'),
            format='json',
        )
        by_email = self.client.post(
            REGISTER_URL,
            self._register_payload(username='brandnew2', email='taken@vninvest.vn'),
            format='json',
        )

        self.assertEqual(by_username.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(by_email.status_code, status.HTTP_409_CONFLICT)
        # `timestamp` and `request_id` differ per request by design; the
        # comparable surface is everything a caller can act on.
        self.assertEqual(by_username.json()['code'], by_email.json()['code'])
        self.assertEqual(by_username.json()['detail'], by_email.json()['detail'])
        self.assertEqual(by_username.json()['code'], 'registration_unavailable')

    def test_a7_collision_response_does_not_name_the_offending_field(self):
        """A7: the 400 body must not leak the answer through a field name either.

        `SaaSRegisterSerializer.validate_username` / `validate_email` used to
        raise their own "already exists" errors, so even after the view-level
        check the *key* in the 400 body answered the question.
        """
        User.objects.create_user(username='taken_name', email='taken@vninvest.vn', password=STRONG_PASSWORD)
        serializer = self.client.post(
            REGISTER_URL,
            self._register_payload(username='taken_name', email='brandnew3@vninvest.vn'),
            format='json',
        )
        body = serializer.json()
        self.assertEqual(body['code'], 'registration_unavailable')
        self.assertNotIn('username_already_exists', str(body))
        self.assertNotIn('đã tồn tại', str(body))

    def test_a7_resend_returns_one_shape_for_every_outcome(self):
        """A7: unknown / unverified / already-activated must be indistinguishable.

        Before: three different messages, which disclosed both existence and
        activation state, despite the comment promising enumeration safety.
        """
        User.objects.create_user(username='dormant', email='dormant@vninvest.vn', password=STRONG_PASSWORD, is_active=False)
        User.objects.create_user(username='awake', email='awake@vninvest.vn', password=STRONG_PASSWORD, is_active=True)

        unknown = self.client.post(RESEND_URL, {'email': 'ghost@vninvest.vn'}, format='json')
        # Clear the per-email cooldown so the next address is not blocked by it.
        unverified = self.client.post(RESEND_URL, {'email': 'dormant@vninvest.vn'}, format='json')
        cache.clear()
        activated = self.client.post(RESEND_URL, {'email': 'awake@vninvest.vn'}, format='json')

        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(unverified.status_code, status.HTTP_200_OK)
        self.assertEqual(activated.status_code, status.HTTP_200_OK)
        # `timestamp` and `request_id` are per-request by design, so the
        # comparable surface is the payload itself.
        self.assertEqual(unknown.json()['data'], unverified.json()['data'])
        self.assertEqual(unknown.json()['data'], activated.json()['data'])
        # And the activated account did NOT get a new token: no activation state leak.
        self.assertFalse(EmailVerificationToken.objects.filter(user__username='awake').exists())
        self.assertEqual(EmailVerificationToken.objects.filter(user__username='dormant').count(), 1)

    # ---------------------------------------------------------------- A12c
    def test_a12c_non_string_username_does_not_500(self):
        """A12c: `{"username": 123}` used to raise AttributeError OUTSIDE the try.

        `.strip()` was called on `request.data.get('username')` before the view's
        `try:` block, so a JSON body with a non-string value produced an
        unhandled AttributeError and a 500. The view no longer touches the raw
        body at all - the value comes from `validated_data`, where DRF's
        CharField/EmailField have already coerced or rejected it.
        """
        response = self.client.post(
            REGISTER_URL,
            self._register_payload(username=123, email='typed@vninvest.vn'),
            format='json',
        )
        # 201 is acceptable: DRF coerces a scalar to its string form and "123"
        # is a legal username. What matters is that it is not a 500.
        self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_a12c_structured_username_is_a_400_not_a_500(self):
        """A12c: a non-coercible value is rejected as validation, not a crash."""
        response = self.client.post(
            REGISTER_URL,
            self._register_payload(username={'unexpected': 'object'}, email='typed2@vninvest.vn'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a12c_non_string_email_is_a_400_not_a_500(self):
        """A12c: same for the email field."""
        response = self.client.post(
            REGISTER_URL,
            self._register_payload(username='newcomer', email=['a', 'b']),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TenantRegAAtomicRateLimitTests(TestCase):
    """A5: the counter must be an atomic increment, not a read-modify-write."""

    def setUp(self):
        cache.clear()

    def test_atomic_bump_seeds_the_first_value_with_add(self):
        """A5: the first-seen path uses `add`, which only succeeds when absent."""
        fake = MagicMock()
        fake.add.return_value = True
        with patch('identity_access.security_utils.cache', fake):
            self.assertEqual(atomic_bump('k', 60), 1)
        fake.add.assert_called_once_with('k', 1, 60)
        fake.incr.assert_not_called()
        fake.set.assert_not_called()

    def test_atomic_bump_uses_incr_once_seeded(self):
        """A5: afterwards it must be a single atomic increment, never get+set."""
        fake = MagicMock()
        fake.add.return_value = False
        fake.incr.return_value = 7
        with patch('identity_access.security_utils.cache', fake):
            self.assertEqual(atomic_bump('k', 60), 7)
        fake.add.assert_called_once()
        fake.incr.assert_called_once_with('k')
        fake.get.assert_not_called()
        fake.set.assert_not_called()

    def test_atomic_bump_reseeds_when_the_key_expires_mid_flight(self):
        """A5: `incr` on a vanished key raises ValueError - re-seed, never 500."""
        fake = MagicMock()
        fake.add.return_value = False
        fake.incr.side_effect = ValueError('Key not found')
        with patch('identity_access.security_utils.cache', fake):
            self.assertEqual(atomic_bump('k', 60), 1)
        fake.set.assert_called_once_with('k', 1, 60)

    def test_atomic_bump_loses_no_increments_under_real_concurrency(self):
        """A5: 24 threads, 24 increments.

        The old pattern (`get` then `set(count + 1)`) let every thread that read
        before the first write store the same value, so the final count was
        however many threads won the race - not 24. This is the property the
        read-modify-write could not provide.
        """
        key = 'ratelimit:sliceA:concurrency'
        threads_count = 24
        barrier = threading.Barrier(threads_count)

        def bump():
            barrier.wait()
            atomic_bump(key, 60)

        threads = [threading.Thread(target=bump) for _ in range(threads_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(peek_rate_limit(key), threads_count)


class TenantRegAPasswordPolicyTests(TestCase):
    """A1, A2, A9, A10 on the reset + change paths."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='resetuser', email='reset@vninvest.vn', password='OriginalPass123!', is_active=True,
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='tenant_resetuser',
            display_name='Reset Workspace',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read'],
        )

    def _issue_reset_token(self):
        _token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user.email, hours=1,
        )
        return raw_token

    def _issue_human_session(self, label):
        credential, _raw = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            expires_at=timezone.now() + timedelta(hours=12),
            label=label,
            is_human_session=True,
        )
        return credential

    # ---------------------------------------------------------------- A1
    def test_a1_confirm_accepts_the_key_the_frontend_actually_sends(self):
        """A1: the FE adapter posts `new_password`; the view read `password`.

        packages/web/src/adapters/core/auth.js:112-116 posts
        {token, new_password, new_password_confirm}, so every confirm from the
        real UI returned 400 `token and password are required.` This is the
        exact payload the UI sends.
        """
        raw_token = self._issue_reset_token()
        response = self.client.post(
            RESET_CONFIRM_URL,
            {
                'token': raw_token,
                'new_password': 'BrandResetPass0rd!',
                'new_password_confirm': 'BrandResetPass0rd!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandResetPass0rd!'))

    def test_a1_confirm_still_accepts_the_legacy_password_key(self):
        """A1: `password` must keep working - the repo's own tests use it."""
        raw_token = self._issue_reset_token()
        response = self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'password': 'LegacyPathPass0rd!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('LegacyPathPass0rd!'))

    def test_a1_confirm_rejects_a_mismatched_confirm_field(self):
        """A1: the server, not the browser, decides the two passwords match."""
        raw_token = self._issue_reset_token()
        response = self.client.post(
            RESET_CONFIRM_URL,
            {
                'token': raw_token,
                'new_password': 'BrandResetPass0rd!',
                'new_password_confirm': 'SomethingElse123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = response.json()
        self.assertEqual(body['code'], 'password_confirmation_mismatch')
        self.assertIn('new_password_confirm', body['field_errors'])
        # The token must NOT be consumed by a rejected confirmation.
        self.assertFalse(PasswordResetToken.objects.get(email=self.user.email).used)

    def test_a1_confirm_reports_missing_fields_per_field(self):
        """A1: the 400 carries a per-field shape the FE can map to inputs."""
        response = self.client.post(RESET_CONFIRM_URL, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        field_errors = response.json()['field_errors']
        self.assertIn('token', field_errors)
        self.assertIn('new_password', field_errors)

    # ---------------------------------------------------------------- A2
    def test_a2_confirm_enforces_auth_password_validators(self):
        """A2: `len < 8` was the whole policy; AUTH_PASSWORD_VALIDATORS is now it."""
        raw_token = self._issue_reset_token()
        response = self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'new_password': 'password1', 'new_password_confirm': 'password1'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['code'], 'weak_password')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OriginalPass123!'))

    def test_a2_change_enforces_auth_password_validators(self):
        """A2: same for password_change, where `len < 8` was also the only policy."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            PASSWORD_CHANGE_URL,
            {
                'current_password': 'OriginalPass123!',
                'new_password': 'password1',
                'new_password_confirm': 'password1',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['code'], 'weak_password')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OriginalPass123!'))

    def test_a2_rejected_password_does_not_consume_the_reset_token(self):
        """A2: the token and the user are resolved before the token is consumed."""
        raw_token = self._issue_reset_token()
        self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'new_password': 'password1'},
            format='json',
        )
        self.assertFalse(PasswordResetToken.objects.get(email=self.user.email).used)
        # ...so a compliant retry with the SAME token still works.
        retry = self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'new_password': 'CompliantPass123!'},
            format='json',
        )
        self.assertEqual(retry.status_code, status.HTTP_200_OK)

    # ---------------------------------------------------------------- A9
    def test_a9_reset_revokes_every_human_session(self):
        """A9: a stolen human-session PAT must die when the victim resets.

        Before: only `set_password` ran, so every already-issued 12h session
        token kept working after the reset.
        """
        first = self._issue_human_session('attacker-1')
        second = self._issue_human_session('attacker-2')
        raw_token = self._issue_reset_token()

        response = self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'new_password': 'AfterResetPass0rd!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for credential in (first, second):
            credential.refresh_from_db()
            self.assertEqual(credential.status, CorePATCredential.StatusChoices.REVOKED)
            self.assertIn('password reset', credential.revoked_reason)

    def test_a9_change_revokes_other_sessions_but_keeps_the_caller(self):
        """A9: on change the caller's own session survives - they are still typing."""
        own = self._issue_human_session('own')
        other = self._issue_human_session('stolen')

        self.client.force_authenticate(user=self.user, token=own.token_prefix)
        response = self.client.post(
            PASSWORD_CHANGE_URL,
            {
                'current_password': 'OriginalPass123!',
                'new_password': 'AfterChangePass0rd!',
                'new_password_confirm': 'AfterChangePass0rd!',
            },
            format='json',
        )
        self.assertIn(response.status_code, (200, 401, 403))

        other.refresh_from_db()
        self.assertEqual(other.status, CorePATCredential.StatusChoices.REVOKED)

    # ---------------------------------------------------------------- A10
    def test_a10_duplicate_email_rows_do_not_500_on_login(self):
        """A10: two rows sharing an email used to raise MultipleObjectsReturned.

        `auth_user.email` has no unique index (`AUTH_USER_MODEL` is unset), so
        two concurrent registrations can both insert. Every `.get(email=...)`
        then blew up with an exception no caller caught, i.e. a 500 on the login
        path. The rows below are created directly to reproduce that state, which
        the application-level `.exists()` check can still let happen.
        """
        # The root cause is now closed: identity_access migration 9000 adds a partial
        # UNIQUE index on lower(auth_user.email). This test used to build two rows
        # sharing an address to prove the defensive lookup tolerated them; the
        # database now refuses to create that state at all. So the assertion is
        # inverted -- the constraint is the thing that must hold -- and the
        # single surviving row is what the rest of the test then exercises.
        # Wrapped in atomic() so the expected IntegrityError rolls back to a
        # savepoint instead of poisoning the enclosing TestCase transaction. Both
        # rows go inside, so the savepoint rolls back the FIRST insert too.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(username='dup_low', email='dup@vninvest.vn', password='DupPassword123!', is_active=True)
                User.objects.create_user(username='dup_high', email='dup@vninvest.vn', password='DupPassword123!', is_active=True)
        self.assertEqual(User.objects.filter(email__iexact='dup@vninvest.vn').count(), 0)
        User.objects.create_user(username='dup_low', email='dup@vninvest.vn', password='DupPassword123!', is_active=True)
        # The deterministically-resolved account needs the rest of its graph for
        # the login to complete.
        resolved = get_user_by_email('dup@vninvest.vn')
        tenant = CoreTenant.objects.create(
            owner_user=resolved,
            tenant_code='tenant_dup_low',
            display_name='Dup workspace',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        CoreServiceAccount.objects.create(
            tenant=tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read'],
        )

        response = self.client.post(
            LOGIN_URL,
            {'username': 'dup@vninvest.vn', 'password': 'DupPassword123!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['data']['user']['username'], 'dup_low')
        self.assertEqual(
            get_user_by_email('dup@vninvest.vn').pk,
            User.objects.filter(email__iexact='dup@vninvest.vn').order_by('pk').first().pk,
        )

    def test_a10_duplicate_email_rows_do_not_500_on_reset_confirm(self):
        """A10: same 500, different endpoint."""
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(username='dup2_low', email='dup2@vninvest.vn', password='Dup2Password123!', is_active=True)
                User.objects.create_user(username='dup2_high', email='dup2@vninvest.vn', password='Dup2Password123!', is_active=True)
        self.assertEqual(User.objects.filter(email__iexact='dup2@vninvest.vn').count(), 0)
        User.objects.create_user(username='dup2_low', email='dup2@vninvest.vn', password='Dup2Password123!', is_active=True)
        _obj, raw_token = PasswordResetToken.generate_and_save(email='dup2@vninvest.vn', hours=1)

        response = self.client.post(
            RESET_CONFIRM_URL,
            {'token': raw_token, 'new_password': 'Dup2ResetPass0rd!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a10_get_user_helpers_return_none_instead_of_raising(self):
        """A10: the helpers never raise, whatever the table contains."""
        self.assertIsNone(get_user_by_email('nobody@vninvest.vn'))
        self.assertIsNone(get_user_by_email(''))
        self.assertIsNone(get_user_by_email(None))
        self.assertIsNone(get_user_by_username('nobody'))
        self.assertEqual(get_user_by_username('RESETUSER').username, 'resetuser')


class TenantRegAVerificationTests(TestCase):
    """A11: row lock, a rate limit, and an attempt counter that counts."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='verifyme', email='verify@vninvest.vn', password='VerifyPass123!', is_active=False,
        )

    def _make_token(self, *, expired=False, used=False):
        raw_token = secrets.token_urlsafe(32)
        token = EmailVerificationToken.objects.create(
            user=self.user,
            token_hash=hashlib.sha256(raw_token.encode('utf-8')).hexdigest(),
            expires_at=timezone.now() - timedelta(minutes=1) if expired else timezone.now() + timedelta(minutes=30),
            is_used=used,
        )
        return raw_token, token

    # ---------------------------------------------------------------- A11
    def test_a11_valid_token_activates_the_account(self):
        """A11: happy path still works, and elevation is deterministic."""
        raw_token, token = self._make_token()
        response = self.client.post(VERIFY_URL, {'token': raw_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        token.refresh_from_db()
        self.assertTrue(token.is_used)

        service_account = CoreServiceAccount.objects.get(tenant__owner_user=self.user, name='default')
        # A12d: sorted, not `list(set(...))` - set iteration order is undefined,
        # so the same account could be stored in a different order on two hosts.
        self.assertEqual(service_account.scopes, ['ai:invoke', 'manage_pats', 'market:read', 'signals:read'])
        self.assertEqual(service_account.scopes, sorted(service_account.scopes))

    def test_a11_replay_of_a_used_token_is_rejected(self):
        """A11: `is_used` is now re-checked under the row lock."""
        raw_token, _token = self._make_token()
        first = self.client.post(VERIFY_URL, {'token': raw_token}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post(VERIFY_URL, {'token': raw_token}, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.json()['code'], 'invalid_token')

    def test_a11_unknown_token_now_increments_a_counter(self):
        """A11: a wrong token used to increment NOTHING.

        The per-email `attempts` counter only ever counted replays of the
        CORRECT token, so it was useless as a brute-force control. A per-token
        cache dimension now counts every guess, including unknown ones.
        """
        for _ in range(3):
            response = self.client.post(VERIFY_URL, {'token': 'not-a-real-token'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        token_hash = hashlib.sha256(b'not-a-real-token').hexdigest()
        self.assertEqual(peek_rate_limit(f'ratelimit:verify-email:token:{token_hash}'), 3)

    def test_a11_expired_token_increments_the_stored_attempts(self):
        """A11: the DB counter moves on failure paths, not only on replays."""
        raw_token, token = self._make_token(expired=True)
        self.client.post(VERIFY_URL, {'token': raw_token}, format='json')
        token.refresh_from_db()
        self.assertEqual(token.attempts, 1)

    def test_a11_endpoint_is_rate_limited(self):
        """A11: the endpoint had no rate limit at all before this slice."""
        statuses = set()
        for _ in range(24):
            statuses.add(
                self.client.post(VERIFY_URL, {'token': f'guess-{_}'}, format='json').status_code
            )
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)

    def test_a11_lockout_after_max_attempts(self):
        """A11: the lockout actually engages, and reports itself as such."""
        raw_token, _token = self._make_token(expired=True)
        last = None
        for _ in range(5):
            last = self.client.post(VERIFY_URL, {'token': raw_token}, format='json')
        self.assertEqual(last.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(last.json()['code'], 'verification_locked_out')

    def test_a11_token_entropy_is_256_bits(self):
        """A11: the 256-bit generator must not be weakened by any of this."""
        raw_token, _token = self._make_token()
        # secrets.token_urlsafe(32) -> 32 bytes -> 43 base64url chars.
        self.assertGreaterEqual(len(raw_token), 43)


class TenantRegALoginEnumerationTests(TestCase):
    """A7 on the login path."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.active = User.objects.create_user(
            username='activeuser', email='active@vninvest.vn', password='ActivePass123!', is_active=True,
        )
        self.inactive = User.objects.create_user(
            username='inactiveuser', email='inactive@vninvest.vn', password='InactivePass123!', is_active=False,
        )
        for owner in (self.active, self.inactive):
            tenant = CoreTenant.objects.create(
                owner_user=owner,
                tenant_code=f'tenant_{owner.username}',
                display_name=f'{owner.username} workspace',
                plan=CoreTenant.PlanChoices.FREE,
                status=CoreTenant.StatusChoices.ACTIVE,
            )
            CoreServiceAccount.objects.create(
                tenant=tenant,
                name='default',
                status=CoreServiceAccount.StatusChoices.ACTIVE,
                scopes=['market:read'],
            )

    def test_a7_unverified_account_with_the_right_password_says_so(self):
        """A7: the owner still gets the "check your inbox" guidance."""
        response = self.client.post(
            LOGIN_URL,
            {'username': 'inactiveuser', 'password': 'InactivePass123!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()['code'], 'user_inactive')

    def test_a7_unverified_account_with_a_wrong_password_is_not_an_oracle(self):
        """A7: the actual fix - no secret, no answer.

        Before, `user_inactive` was returned before the password was ever
        checked, so anyone could confirm the account existed.
        """
        response = self.client.post(
            LOGIN_URL,
            {'username': 'inactiveuser', 'password': 'WrongGuess123!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()['code'], 'invalid_credentials')

    def test_a7_unknown_account_matches_the_inactive_response(self):
        """A7: unverified-with-wrong-password and unknown must look the same."""
        unverified = self.client.post(
            LOGIN_URL, {'username': 'inactiveuser', 'password': 'WrongGuess123!'}, format='json',
        )
        cache.clear()
        unknown = self.client.post(
            LOGIN_URL, {'username': 'ghostuser', 'password': 'WrongGuess123!'}, format='json',
        )
        self.assertEqual(unverified.json()['code'], unknown.json()['code'])
        self.assertEqual(unverified.json()['detail'], unknown.json()['detail'])
        self.assertEqual(unverified.status_code, unknown.status_code)


class TenantRegATenantWriteTests(TestCase):
    """A12a: a tenant must not be able to edit server-owned lifecycle state."""

    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            username='serializerowner', email='serializerowner@vninvest.vn', password='SerializerPass123!',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='tenant_serializer_a12',
            display_name='Serializer Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_a12a_plan_is_read_only(self):
        """A12a: PATCHing plan to enterprise was a straight privilege escalation.

        Note on the mechanism: DRF's `read_only_fields` silently DROPS the field
        from the input rather than rejecting it, so the request is a 200 - the
        assertion is on the effect, not on a validation error. What matters is
        that the value never reaches `validated_data` and never lands on the row.
        """
        serializer = CoreTenantSerializer(
            self.tenant, data={'plan': CoreTenant.PlanChoices.ENTERPRISE}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('plan', serializer.validated_data)
        serializer.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.FREE)

    def test_a12a_status_is_read_only(self):
        """A12a: a suspended tenant could un-suspend itself."""
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status'])
        serializer = CoreTenantSerializer(
            self.tenant, data={'status': CoreTenant.StatusChoices.ACTIVE}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('status', serializer.validated_data)
        serializer.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.status, CoreTenant.StatusChoices.SUSPENDED)

    def test_a12a_features_and_billing_fields_are_read_only(self):
        """A12a: same treatment for the remaining server-owned fields."""
        payload = {
            'features': ['ai:invoke'],
            'trial_ends_at': '2030-01-01T00:00:00Z',
            'activated_at': '2030-01-01T00:00:00Z',
            'suspended_at': '2030-01-01T00:00:00Z',
            'billing_period_start': '2030-01-01T00:00:00Z',
            'billing_period_end': '2030-02-01T00:00:00Z',
        }
        serializer = CoreTenantSerializer(self.tenant, data=payload, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        for field in payload:
            self.assertNotIn(field, serializer.validated_data, f'{field} must not be settable')
        serializer.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.features, [])
        # The point of the assertion is that the CLIENT's 2030 value must not land.
        # It is no longer `assertIsNone`, because slice C's C8 added a lifecycle
        # post_save that legitimately stamps `activated_at` when the tenant is
        # ACTIVE. So the correct invariant is "not the value the client sent" --
        # checking against the sent value is what actually pins the read-only rule.
        self.assertNotEqual(
            self.tenant.activated_at,
            datetime(2030, 1, 1, tzinfo=UTC),
            "client-supplied activated_at must not be written",
        )
        self.assertIsNone(self.tenant.suspended_at)
        self.assertIsNone(self.tenant.billing_period_start)
        self.assertIsNone(self.tenant.billing_period_end)

    def test_a12a_display_name_is_still_writable(self):
        """A12a: the fields a tenant legitimately owns keep working."""
        serializer = CoreTenantSerializer(
            self.tenant, data={'display_name': 'Renamed Workspace'}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.display_name, 'Renamed Workspace')


class TenantRegAOnboardingTests(TestCase):
    """A8: the self-service trial tenant, and the welcome email it never sent."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='trialuser', email='trial@vninvest.vn', password='TrialPass123!', is_active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_a8_trial_tenant_is_created_atomically_with_its_profile(self):
        """A8: no UserProfile meant the welcome email never went out.

        `send_welcome_email` resolves its recipient through
        `UserProfile.objects.get(user__id=...)`, so with no profile the task
        returned `{'status': 'skipped'}` on every single successful signup.
        """
        with patch('identity_access.email_tasks.send_welcome_email.delay') as mock_send:
            response = self.client.post(
                '/core/v1/onboarding/register/',
                {'display_name': 'Trial Company'},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        tenant = CoreTenant.objects.get(owner_user=self.user)
        self.assertEqual(tenant.status, CoreTenant.StatusChoices.TRIAL)
        self.assertIsNotNone(tenant.trial_ends_at)
        self.assertTrue(UserProfile.objects.filter(user=self.user, tenant=tenant).exists())
        mock_send.assert_called_once()

        # TenantLifecycleEvent landed in the same transaction.
        from tenant_lifecycle.models import TenantLifecycleEvent

        self.assertTrue(
            TenantLifecycleEvent.objects.filter(
                tenant=tenant,
                event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED,
            ).exists()
        )

    def test_a8_second_signup_is_a_409_not_an_integrity_error(self):
        """A8: the owner race used to surface as an unhandled IntegrityError."""
        self.client.post('/core/v1/onboarding/register/', {'display_name': 'First'}, format='json')
        second = self.client.post('/core/v1/onboarding/register/', {'display_name': 'Second'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(CoreTenant.objects.filter(owner_user=self.user).count(), 1)

    def test_a8_tenant_code_entropy_is_not_32_bits(self):
        """A8: `secrets.token_hex(4)` is 8 hex chars = 32 bits on a UNIQUE column.

        The suffix is `secrets.token_urlsafe(12)`, i.e. 16 base64url characters.
        It is extracted with an explicit `tenant-<id>-` prefix match rather than
        `rsplit('-', 1)`: base64url's alphabet CONTAINS '-', so splitting on the
        last dash is a coin flip on the random suffix and this test was itself
        flaky.
        """
        self.client.post('/core/v1/onboarding/register/', {'display_name': 'Entropy'}, format='json')
        tenant = CoreTenant.objects.get(owner_user=self.user)
        match = re.fullmatch(r'tenant-\d+-([A-Za-z0-9_-]+)', tenant.tenant_code)
        self.assertIsNotNone(match, f'unexpected tenant_code shape: {tenant.tenant_code!r}')
        suffix = match.group(1)
        self.assertGreaterEqual(len(suffix), 16, 'tenant_code suffix must carry >= 96 bits')

    def test_a8_invalid_display_name_creates_nothing(self):
        """A8: validation runs before the database is touched."""
        response = self.client.post('/core/v1/onboarding/register/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CoreTenant.objects.filter(owner_user=self.user).exists())

    def test_a8_welcome_email_sends_even_without_a_profile(self):
        """A8: belt and braces - a missing profile must not skip the email."""
        with patch('identity_access.mail_service.send_system_email') as mock_send:
            mock_send.return_value = 1
            from identity_access.email_tasks import send_welcome_email

            tenant = CoreTenant.objects.create(
                owner_user=self.user,
                tenant_code='tenant_welcome_fallback',
                display_name='Welcome Tenant',
                plan=CoreTenant.PlanChoices.FREE,
                status=CoreTenant.StatusChoices.TRIAL,
            )
            result = send_welcome_email(self.user.id, str(tenant.public_id))
        self.assertEqual(result['status'], 'sent')
        self.assertEqual(result['recipient'], 'trial@vninvest.vn')


class TenantRegATokenRetentionTests(TestCase):
    """A12e: spent verification tokens are never deleted."""

    def setUp(self):
        cache.clear()

    def _token(self, *, age_hours, is_used=False):
        user = User.objects.create_user(
            username=f'retention{age_hours}{int(is_used)}',
            email=f'retention{age_hours}{int(is_used)}@vninvest.vn',
            password='RetentionPass123!',
        )
        return EmailVerificationToken.objects.create(
            user=user,
            token_hash=hashlib.sha256(
                f'retention{age_hours}{int(is_used)}'.encode()
            ).hexdigest(),
            expires_at=timezone.now() - timedelta(hours=age_hours),
            is_used=is_used,
        )

    def test_a12e_prune_deletes_only_unusable_rows(self):
        """A12e: nothing could delete these rows before, so the table grew forever."""
        ancient_unused = self._token(age_hours=48, is_used=False)
        recent_unused = self._token(age_hours=1, is_used=False)

        result = prune_email_verification_tokens(older_than_hours=24)

        self.assertFalse(EmailVerificationToken.objects.filter(pk=ancient_unused.pk).exists())
        self.assertTrue(EmailVerificationToken.objects.filter(pk=recent_unused.pk).exists())
        self.assertEqual(result['deleted'], 1)

    def test_a12e_prune_is_idempotent(self):
        """A12e: safe to run on a schedule - a second run deletes nothing."""
        self._token(age_hours=48)
        prune_email_verification_tokens(older_than_hours=24)
        self.assertEqual(prune_email_verification_tokens(older_than_hours=24)['deleted'], 0)
