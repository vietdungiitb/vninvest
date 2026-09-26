"""Slice C / C3 + C4 — one consumer per outbox event_type, and nothing dies silently.

C3 defect (verified file:line before the fix):
  data_ingest/tasks.py:3048 process_outbox_events selected status=PENDING and, for
  event_type == 'UserRegisteredEvent', ran execute_provisioning_consumer (:3070-3074,
  impl :3110-3167) which only get_or_creates tenant/profile/service-account and NEVER
  sends mail — then set STATUS_PROCESSED (:3079-3081).
  Meanwhile trigger_email_verification_flow (:2302) was the only thing that actually
  sent the mail and ALSO wrote STATUS_PROCESSED (:2346-2349).
  Both views that create the row (identity_access/views/register.py:155 and :396) used
  the same event_type. So if the Celery message was lost — worker restart,
  non-persistent Redis, worker simply down — the beat poller picked the row up within
  30s, marked it PROCESSED, and because the query only ever looked at PENDING it never
  retried. Account stuck is_active=False, dead outbox row, no email ever sent.

C4 defect:
  data_ingest/tasks.py:2352-2362 caught the retry exhaustion and returned
  {'status': 'failed'} — a success-shaped dict — while the row sat in STATUS_FAILED
  that nothing ever scanned again.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from data_ingest.tasks import (
    EMAIL_VERIFICATION_REQUESTED_EVENT,
    OUTBOX_FAILED_REDRIVE_AFTER_SECONDS,
    OUTBOX_MAX_REDRIVES,
    OUTBOX_RECOVERY_GRACE_SECONDS,
    TENANT_PROVISIONING_EVENT,
    USER_REGISTERED_EVENT,
    execute_provisioning_consumer,
    process_outbox_events,
)
from identity_access.models import (
    CoreServiceAccount,
    CoreTenant,
    EmailVerificationToken,
    OutboxEvent,
    ProcessedEvent,
    UserProfile,
)


User = get_user_model()


def make_inactive_user(username='c3user', email=None):
    return User.objects.create_user(
        username=username,
        email=email or f'{username}@vninvest.vn',
        password='x',
        is_active=False,
    )


def make_event(event_type=USER_REGISTERED_EVENT, user=None, age_seconds=0, **kwargs):
    event = OutboxEvent.objects.create(
        event_id=uuid.uuid4(),
        event_type=event_type,
        payload=kwargs.pop('payload', None) or (
            {'user_id': user.id, 'email': user.email} if user else {}
        ),
        status=kwargs.pop('status', OutboxEvent.STATUS_PENDING),
        **kwargs,
    )
    if age_seconds:
        OutboxEvent.objects.filter(pk=event.pk).update(
            created_at=timezone.now() - timedelta(seconds=age_seconds)
        )
        event.refresh_from_db()
    return event


class OutboxRoutesToExactlyOneConsumerTests(TestCase):
    def setUp(self):
        self.user = make_inactive_user('c3route')

    def test_c3_no_event_type_has_two_consumers(self):
        from data_ingest.tasks import _OUTBOX_CONSUMERS

        # structural: the registry is a plain event_type -> callable map
        for event_type, consumer in _OUTBOX_CONSUMERS.items():
            self.assertTrue(callable(consumer), f'{event_type} consumer is not callable')
        self.assertIn(USER_REGISTERED_EVENT, _OUTBOX_CONSUMERS)
        self.assertIn(EMAIL_VERIFICATION_REQUESTED_EVENT, _OUTBOX_CONSUMERS)
        self.assertIn(TENANT_PROVISIONING_EVENT, _OUTBOX_CONSUMERS)

    def test_c3_user_registered_event_no_longer_runs_the_provisioning_consumer(self):
        """The old poller ran provisioning and marked PROCESSED without any mail."""
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)
        with patch('data_ingest.tasks.execute_provisioning_consumer') as mock_provision:
            with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
                mock_mail.return_value = {'status': 'sent'}
                result = process_outbox_events()

        mock_provision.assert_not_called()
        self.assertEqual(result['recovered_verification_emails'], 1)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PROCESSED)

    def test_c3_tenant_provisioning_event_routes_to_the_provisioning_consumer(self):
        tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='c3_prov',
            display_name='C3 prov',
        )
        event = make_event(
            event_type=TENANT_PROVISIONING_EVENT,
            user=self.user,
            age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10,
        )
        result = process_outbox_events()
        self.assertEqual(result['failed'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PROCESSED)
        self.assertTrue(ProcessedEvent.objects.filter(event_id=event.event_id).exists())
        self.assertTrue(CoreTenant.objects.filter(pk=tenant.pk).exists())

    def test_c3_unknown_event_type_is_failed_not_silently_processed(self):
        event = make_event(event_type='SomethingNobodyHandles', user=self.user)
        result = process_outbox_events()
        self.assertEqual(result['failed'], 1)
        self.assertEqual(result['processed'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_FAILED)
        self.assertIn('SomethingNobodyHandles', event.last_error)
        self.assertFalse(ProcessedEvent.objects.filter(event_id=event.event_id).exists())


class PollerRecoversLostVerificationEmailTests(TestCase):
    """The actual C3 promise: a stranded PENDING row still gets its email sent."""

    def setUp(self):
        self.user = make_inactive_user('c3lost')

    def test_c3_pending_event_with_no_celery_delivery_still_sends_the_email(self):
        event = make_event(
            user=self.user,
            age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10,
        )
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.return_value = {'status': 'sent', 'email': self.user.email}
            result = process_outbox_events()

        self.assertEqual(result['failed'], 0)
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['recovered_verification_emails'], 1)
        mock_mail.assert_called_once()
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PROCESSED)
        self.assertTrue(ProcessedEvent.objects.filter(event_id=event.event_id).exists())

    def test_c3_recovery_mints_a_usable_token_and_invalidates_the_old_one(self):
        # The raw token is NOT recoverable: EmailVerificationToken stores only
        # token_hash = SHA-256 (models.py:1330). So recovery has to mint a new one.
        stale = EmailVerificationToken.objects.create(
            user=self.user,
            token_hash='a' * 64,
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)

        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.return_value = {'status': 'sent'}
            process_outbox_events()

        stale.refresh_from_db()
        self.assertTrue(stale.is_used, 'the stranded token must not stay usable')

        fresh = EmailVerificationToken.objects.filter(user=self.user, is_used=False).first()
        self.assertIsNotNone(fresh, 'recovery must leave exactly one live token')

        minted_token = mock_mail.call_args.kwargs['token']
        import hashlib
        self.assertEqual(
            fresh.token_hash,
            hashlib.sha256(minted_token.encode('utf-8')).hexdigest(),
            'the token handed to the mail task must be the one stored in the DB',
        )

    def test_c3_fresh_row_is_left_to_the_celery_task_to_avoid_double_sending(self):
        event = make_event(user=self.user, age_seconds=5)
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            result = process_outbox_events()

        mock_mail.assert_not_called()
        self.assertEqual(result['deferred_to_active_worker'], 1)
        self.assertEqual(result['processed'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PENDING)

    def test_c3_already_active_user_is_not_emailed_again(self):
        self.user.is_active = True
        self.user.save(update_fields=['is_active'])
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)

        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            result = process_outbox_events()

        mock_mail.assert_not_called()
        self.assertEqual(result['failed'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PROCESSED)

    def test_c3_user_without_email_is_a_hard_failure_not_a_silent_pass(self):
        self.user.email = ''
        self.user.save(update_fields=['email'])
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)

        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            result = process_outbox_events()

        mock_mail.assert_not_called()
        self.assertEqual(result['failed'], 1)
        event.refresh_from_db()
        self.assertNotEqual(event.status, OutboxEvent.STATUS_PROCESSED)

    def test_c3_missing_user_id_in_payload_is_a_hard_failure(self):
        event = make_event(
            user=None,
            payload={'username': 'ghost'},
            age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10,
        )
        result = process_outbox_events()
        self.assertEqual(result['failed'], 1)
        event.refresh_from_db()
        self.assertNotEqual(event.status, OutboxEvent.STATUS_PROCESSED)
        self.assertIn('user_id', event.last_error)

    def test_c3_second_poller_pass_does_not_resend(self):
        make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.return_value = {'status': 'sent'}
            process_outbox_events()
            self.assertEqual(mock_mail.call_count, 1)
            process_outbox_events()
            self.assertEqual(mock_mail.call_count, 1, 'a PROCESSED row must never be re-sent')

    def test_c3_send_failure_keeps_the_row_recoverable(self):
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.return_value = {'status': 'failed', 'error': 'smtp down'}
            result = process_outbox_events()

        self.assertEqual(result['failed'], 1)
        event.refresh_from_db()
        self.assertNotEqual(
            event.status,
            OutboxEvent.STATUS_PROCESSED,
            'a failed send must never be recorded as processed',
        )
        self.assertFalse(ProcessedEvent.objects.filter(event_id=event.event_id).exists())


class RetryExhaustionIsRecoverableTests(TestCase):
    """C4 — the dead-letter window, and no more success-shaped failure dicts."""

    def setUp(self):
        self.user = make_inactive_user('c4user')

    def _failed_event(self, *, age_seconds, retry_count):
        event = make_event(
            user=self.user,
            age_seconds=age_seconds,
            status=OutboxEvent.STATUS_FAILED,
            retry_count=retry_count,
        )
        return event

    def test_c4_failed_row_is_redriven_after_the_dead_letter_window(self):
        event = self._failed_event(
            age_seconds=OUTBOX_FAILED_REDRIVE_AFTER_SECONDS + 60,
            retry_count=5,
        )
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.return_value = {'status': 'sent'}
            result = process_outbox_events()

        self.assertEqual(result['failed_rows_redriven'], 1)
        mock_mail.assert_called_once()
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_PROCESSED)
        self.assertEqual(event.retry_count, 0)
        self.assertEqual(event.last_error, '')

    def test_c4_recently_failed_row_is_left_alone(self):
        event = self._failed_event(age_seconds=10, retry_count=5)
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            result = process_outbox_events()

        mock_mail.assert_not_called()
        self.assertEqual(result['failed_rows_redriven'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_FAILED)

    def test_c4_redrive_is_bounded_so_a_broken_row_cannot_spin_forever(self):
        event = self._failed_event(
            age_seconds=OUTBOX_FAILED_REDRIVE_AFTER_SECONDS + 60,
            retry_count=OUTBOX_MAX_REDRIVES,
        )
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            result = process_outbox_events()

        mock_mail.assert_not_called()
        self.assertEqual(result['failed_rows_redriven'], 0)
        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_FAILED)

    def test_c4_mail_task_raises_instead_of_returning_a_failure_dict(self):
        """A success-shaped {'status': 'failed'} hid the failure from the worker."""
        from data_ingest.tasks import trigger_email_verification_flow

        event = make_event(user=self.user)
        # send_system_email is imported inside the task body, so patch it at source.
        with patch('identity_access.mail_service.send_system_email', side_effect=RuntimeError('smtp down')), \
             patch('data_ingest.tasks.send_mail', side_effect=RuntimeError('smtp down')):
            with self.assertRaises(Exception):
                trigger_email_verification_flow(
                    self.user.id,
                    event.event_id,
                    email=self.user.email,
                    token='raw-token',
                )

        event.refresh_from_db()
        self.assertEqual(event.status, OutboxEvent.STATUS_FAILED)
        self.assertTrue(event.last_error)

    def test_c4_exhausted_row_is_not_silently_marked_processed(self):
        event = make_event(user=self.user, age_seconds=OUTBOX_RECOVERY_GRACE_SECONDS + 10)
        with patch('data_ingest.tasks.trigger_email_verification_flow') as mock_mail:
            mock_mail.side_effect = RuntimeError('broker lost the message')
            process_outbox_events()

        event.refresh_from_db()
        self.assertNotEqual(event.status, OutboxEvent.STATUS_PROCESSED)
        self.assertEqual(event.retry_count, 1)
        self.assertIn('broker lost', event.last_error)


class ProvisioningConsumerStillWorksTests(TestCase):
    """execute_provisioning_consumer is kept intact for the provisioning event type."""

    def test_c3_provisioning_consumer_creates_tenant_profile_and_service_account(self):
        user = make_inactive_user('c3provuser')
        status, msg = execute_provisioning_consumer(
            uuid.uuid4(),
            {'user_id': user.id},
        )
        self.assertEqual(status, 'processed', msg)
        tenant = CoreTenant.objects.get(owner_user=user)
        self.assertTrue(UserProfile.objects.filter(user=user, tenant=tenant).exists())
        self.assertTrue(CoreServiceAccount.objects.filter(tenant=tenant, name='default').exists())

    def test_c3_provisioning_consumer_reports_a_missing_user_as_failed(self):
        status, msg = execute_provisioning_consumer(uuid.uuid4(), {'user_id': 987654})
        self.assertEqual(status, 'failed')
        self.assertIn('does not exist', msg)
