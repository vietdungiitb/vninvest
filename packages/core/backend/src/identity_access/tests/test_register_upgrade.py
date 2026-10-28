# Location: packages/core/backend/src/identity_access/tests/test_register_upgrade.py
import os
import sys
from unittest.mock import MagicMock, patch

# Inject mock google modules into sys.modules BEFORE rest of imports to prevent collection errors
sys.modules['google'] = MagicMock()
sys.modules['google.oauth2'] = MagicMock()
sys.modules['google.oauth2.service_account'] = MagicMock()
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()

import json
import uuid

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from data_ingest.tasks import trigger_email_verification_flow
from identity_access.management.commands.backfill_missing_tenants import (
    Command as BackfillCommand,
)
from identity_access.management.commands.rotate_mail_credential_key import (
    Command as RotateCommand,
)
from identity_access.models import (
    CoreServiceAccount,
    CoreTenant,
    OutboxEvent,
    ProcessedEvent,
    SystemMailConfig,
    UserProfile,
)

User = get_user_model()

# Set up standard symmetric encryption key for tests
TEST_FERNET_KEY = Fernet.generate_key().decode()

@override_settings(
    BLOCKED_DISPOSABLE_DOMAINS={'mailinator.com', '10minutemail.com'},
    TURNSTILE_SECRET_KEY='test-secret-key',
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn'
)
@patch.dict(os.environ, {'MAIL_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
# `TestCase`, not `TransactionTestCase`. `TransactionTestCase` flushes all 123
# tables after every test (measured 12.9-14.6s per TRUNCATE on this Postgres),
# which is why this module cost 223s for 10 tests. Nothing here needs a committed
# write: the DB-level constraint test is wrapped in `transaction.atomic()` so the
# expected IntegrityError does not poison the test transaction.
class SaaSUserRegistrationSpamProtectionTests(TestCase):
    def setUp(self):
        # Clear cache to reset manual rate limits before each test run
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_staff',
            email='admin@vninvest.vn',
            password='Password123!',
            is_staff=True
        )
        self.client.force_authenticate(user=self.admin)

    def test_honeypot_field_validation_blocked(self):
        """Spam Shield: Tầng 1 - Honeypot field filled must be blocked."""
        response = self.client.post('/core/v1/auth/register/', {
            'username': 'spambot',
            'email': 'bot@vninvest.vn',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'website': 'http://spamsite.com',  # Honeypot filled!
            'turnstile_token': 'dummy-token'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertIn('detail', response_data)
        self.assertIn('website', response_data['detail'])

    def test_disposable_domain_validation_blocked(self):
        """Spam Shield: Tầng 2 - Disposable email domains must be blocked O(1)."""
        response = self.client.post('/core/v1/auth/register/', {
            'username': 'spamuser',
            'email': 'spam@mailinator.com',  # Disposable domain!
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'website': '',
            'turnstile_token': 'dummy-token'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertIn('detail', response_data)
        self.assertIn('email', response_data['detail'])
        self.assertEqual(response_data['detail']['email'][0], "Không cho phép đăng ký bằng địa chỉ email tạm thời.")

    @patch('requests.post')
    def test_turnstile_token_invalid_blocked(self, mock_post):
        """Spam Shield: Tầng 3 - Invalid Turnstile token must be blocked."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': False, 'error-codes': ['invalid-input-response']}
        mock_post.return_value = mock_response

        response = self.client.post('/core/v1/auth/register/', {
            'username': 'normaluser',
            'email': 'user@vninvest.vn',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'website': '',
            'turnstile_token': 'invalid-token'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertIn('detail', response_data)
        self.assertIn('turnstile_token', response_data['detail'])

    @patch('requests.post')
    @patch('data_ingest.tasks.trigger_email_verification_flow.delay')
    def test_happy_path_registration_atomic_provisioning(self, mock_celery, mock_post):
        """SaaS dynamic provisioning: normal registration must be atomic and low privilege."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': True}
        mock_post.return_value = mock_response

        # `captureOnCommitCallbacks(execute=True)` is REQUIRED under `TestCase`:
        # registration dispatches the verification task from
        # `transaction.on_commit(...)` (`identity_access/views/register.py:287`),
        # and `TestCase` discards on_commit callbacks when it rolls back — so
        # without this the mock is never called and the assertion below would be
        # vacuous. This keeps the fast base class without losing the coverage that
        # the original `TransactionTestCase` gave.
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/core/v1/auth/register/', {
                'username': 'vietdung',
                'email': 'vietdung@vninvest.vn',
                'password': 'Password123!',
                'password_confirm': 'Password123!',
                'website': '',
                'turnstile_token': 'valid-token'
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertEqual(data['username'], 'vietdung')
        self.assertTrue(data['verification_required'])

        # Verify DB records created atomic
        user = User.objects.get(username='vietdung')
        self.assertFalse(user.is_active)  # Must be inactive initially

        tenant = CoreTenant.objects.get(owner_user=user)
        self.assertEqual(tenant.plan, CoreTenant.PlanChoices.FREE)

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.theme, 'dark')

        service_account = CoreServiceAccount.objects.get(tenant=tenant, name='default')
        # Least privilege check
        self.assertEqual(service_account.scopes, ['market:read', 'signals:read'])

        # Verify OutboxEvent recorded
        outbox = OutboxEvent.objects.get(event_type='UserRegisteredEvent')
        self.assertEqual(outbox.payload['user_id'], user.id)
        self.assertEqual(outbox.status, OutboxEvent.STATUS_PENDING)

        # Celery verification task must have been queued via transaction.on_commit
        mock_celery.assert_called_once()
        args, kwargs = mock_celery.call_args
        self.assertEqual(args[0], user.id)
        self.assertEqual(args[1], outbox.event_id)
        self.assertEqual(kwargs['email'], 'vietdung@vninvest.vn')
        self.assertTrue(len(kwargs['token']) > 0)

    # =========================================================================
    # TC_CONCURRENCY_01: Unique Constraint on Active Configurations
    # =========================================================================
    def test_tc_concurrency_01_active_mail_config_constraint(self):
        """TC_CONCURRENCY_01: Database UniqueConstraint protects from multiple active configurations."""
        # Create active config 1
        config1 = SystemMailConfig.objects.create(
            provider=SystemMailConfig.PROVIDER_SMTP,
            from_email='smtp1@vninvest.vn',
            smtp_host='smtp.mailtrap.io',
            smtp_port=587,
            smtp_username='user1',
            is_active=True
        )
        self.assertTrue(config1.is_active)

        # Try to create active config 2 - should throw IntegrityError
        # `transaction.atomic()` is required here, not cosmetic: `TestCase` runs
        # the whole test inside one transaction, so an expected IntegrityError
        # would poison it and every later query in the same test would fail.
        # The savepoint is what lets us assert the constraint and carry on.
        with self.assertRaises(IntegrityError), transaction.atomic():
            SystemMailConfig.objects.create(
                provider=SystemMailConfig.PROVIDER_SMTP,
                from_email='smtp2@vninvest.vn',
                smtp_host='smtp.mailtrap.io',
                smtp_port=587,
                smtp_username='user2',
                is_active=True
            )

    # =========================================================================
    # TC_CHAOS_FAILOVER_02: Dynamic Google API impersonation failover to static SMTP
    # =========================================================================
    @patch('data_ingest.tasks.send_mail')
    def test_tc_chaos_failover_02_google_api_crash_fallback(self, mock_send_mail):
        """TC_CHAOS_FAILOVER_02: Google API crash fallbacks to default SMTP settings seamlessly."""
        # Setup active google provider
        sa_json = json.dumps({
            "type": "service_account",
            "project_id": "vninvest",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
            "client_email": "sa@vninvest.iam.gserviceaccount.com"
        })
        google_config = SystemMailConfig.objects.create(
            provider=SystemMailConfig.PROVIDER_GMAIL,
            from_email='sa@vninvest.vn',
            google_delegated_user_email='admin@vninvest.vn',
            is_active=True
        )
        google_config.set_google_service_account_json(sa_json)
        google_config.save()

        # Mock the build client in dynamic Google Gmail API to fail (simulate sập)
        with patch('googleapiclient.discovery.build', side_effect=Exception("Google DNS Resolution Timeout / Network Unreachable")):
            event_id = uuid.uuid4()
            OutboxEvent.objects.create(
                event_id=event_id,
                event_type='UserRegisteredEvent',
                payload={},
                status=OutboxEvent.STATUS_PENDING
            )

            # Run task
            result = trigger_email_verification_flow(
                user_id=1,
                outbox_event_id=event_id,
                email='user@vninvest.vn',
                token='otp-token'
            )

            # Must send via default fallback SMTP
            mock_send_mail.assert_called_once()
            call_args = mock_send_mail.call_args[1]
            self.assertEqual(call_args['from_email'], 'fallback@vninvest.vn')
            self.assertEqual(call_args['recipient_list'], ['user@vninvest.vn'])
            self.assertIn('verify-email?token=otp-token', call_args['html_message'])

    # =========================================================================
    # TC_OUTBOX_ATOMIC_03: Atomic register view failure rollback
    # =========================================================================
    @patch('requests.post')
    def test_tc_outbox_atomic_03_atomic_failure_rollback(self, mock_post):
        """TC_OUTBOX_ATOMIC_03: User registration failure rolls back Outbox and profile models."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': True}
        mock_post.return_value = mock_response

        # Force a database IntegrityError during registration by mocking user create to throw
        with patch('django.contrib.auth.models.UserManager.create_user', side_effect=IntegrityError("DB lock conflict")):
            response = self.client.post('/core/v1/auth/register/', {
                'username': 'failuser',
                'email': 'fail@vninvest.vn',
                'password': 'Password123!',
                'password_confirm': 'Password123!',
                'website': '',
                'turnstile_token': 'valid-token'
            }, format='json')

            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Assert absolutely no records created (atomic rollback verify)
            self.assertFalse(User.objects.filter(username='failuser').exists())
            self.assertFalse(CoreTenant.objects.filter(tenant_code='tenant_failuser').exists())
            self.assertFalse(OutboxEvent.objects.filter(payload__username='failuser').exists())

    # =========================================================================
    # TC_OUTBOX_CONSUME_04: Consumer Idempotency check via ProcessedEvent
    # =========================================================================
    def test_tc_outbox_consume_04_idempotent_event_processing(self):
        """TC_OUTBOX_CONSUME_04: Second delivery of event is blocked gracefully via ProcessedEvent."""
        event_id = uuid.uuid4()
        
        # Simulating the Consumer Provisioning method receiving the event
        def execute_provisioning(evt_id):
            # Check idempotency
            if ProcessedEvent.objects.filter(event_id=evt_id).exists():
                logger_msg = f"Event {evt_id} already processed. Dropping."
                return "dropped", logger_msg
            
            with transaction.atomic():
                ProcessedEvent.objects.create(event_id=evt_id)
                # execute provisioning actions...
                return "processed", "success"

        # First Delivery
        status1, msg1 = execute_provisioning(event_id)
        self.assertEqual(status1, "processed")
        self.assertTrue(ProcessedEvent.objects.filter(event_id=event_id).exists())

        # Second Delivery
        status2, msg2 = execute_provisioning(event_id)
        self.assertEqual(status2, "dropped")
        self.assertIn("already processed", msg2)

    # =========================================================================
    # TC_MIGRATION_KEY_05: Symmetric Key Rotation
    # =========================================================================
    def test_tc_migration_key_05_credential_rotation(self):
        """TC_MIGRATION_KEY_05: Key rotation command safely decrypts with old key and encrypts with new key."""
        # Create config encrypted with old key (TEST_FERNET_KEY)
        config = SystemMailConfig.objects.create(
            provider=SystemMailConfig.PROVIDER_SMTP,
            from_email='smtp@vninvest.vn',
            smtp_host='smtp.mailtrap.io',
            smtp_port=587,
            smtp_username='my-smtp-user',
            is_active=False
        )
        config.set_smtp_password("SuperSecretSMTPPassword123")
        config.save()

        # Verify we can decrypt normally
        self.assertEqual(config.get_smtp_password(), "SuperSecretSMTPPassword123")

        # Generate a new Fernet key
        NEW_FERNET_KEY = Fernet.generate_key().decode()

        # Run rotation management command
        cmd = RotateCommand()
        cmd.stdout = MagicMock()
        cmd.stderr = MagicMock()
        
        # Run rotation passing the new key
        cmd.handle(new_key=NEW_FERNET_KEY)

        # Update environment to use the new key for decrypting
        with patch.dict(os.environ, {'MAIL_CREDENTIAL_FERNET_KEY': NEW_FERNET_KEY}):
            # Refresh config from DB
            rotated_config = SystemMailConfig.objects.get(id=config.id)
            # Decrypt should succeed with the new key!
            self.assertEqual(rotated_config.get_smtp_password(), "SuperSecretSMTPPassword123")

        # Update environment to the old key - decrypt must fail (returning empty string "" per decrypt_secret implementation)
        with patch.dict(os.environ, {'MAIL_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY}):
            rotated_config = SystemMailConfig.objects.get(id=config.id)
            self.assertEqual(rotated_config.get_smtp_password(), "")

    # =========================================================================
    # BACKFILL MIGRATION RUNBOOK TEST
    # =========================================================================
    def test_backfill_missing_tenants_command(self):
        """Verify the backfill_missing_tenants command updates legacy users correctly."""
        # Create legacy user without CoreTenant, UserProfile, and ServiceAccount
        legacy_user = User.objects.create_user(
            username='legacy_dung',
            email='legacy@vninvest.vn',
            password='Password123!',
            is_active=True
        )
        
        # Verify legacy user has no CoreTenant initially
        self.assertFalse(CoreTenant.objects.filter(owner_user=legacy_user).exists())

        cmd = BackfillCommand()
        cmd.stdout = MagicMock()
        cmd.stderr = MagicMock()

        # Run dry-run first
        cmd.handle(dry_run=True)
        self.assertFalse(CoreTenant.objects.filter(owner_user=legacy_user).exists())

        # Run actual backfill
        cmd.handle(dry_run=False)

        # Verify records successfully backfilled
        self.assertTrue(CoreTenant.objects.filter(owner_user=legacy_user).exists())
        tenant = CoreTenant.objects.get(owner_user=legacy_user)
        self.assertEqual(tenant.tenant_code, 'tenant_legacy_dung')

        self.assertTrue(UserProfile.objects.filter(user=legacy_user).exists())
        self.assertTrue(CoreServiceAccount.objects.filter(tenant=tenant).exists())
        service_account = CoreServiceAccount.objects.get(tenant=tenant)
        self.assertEqual(service_account.scopes, ['market:read', 'signals:read', 'ai:invoke', 'manage_pats'])
