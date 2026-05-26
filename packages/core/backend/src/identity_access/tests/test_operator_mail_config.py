# Location: packages/core/backend/src/identity_access/tests/test_operator_mail_config.py
import os
import sys
from unittest.mock import patch, MagicMock

# Inject mock google modules into sys.modules BEFORE imports to avoid collection errors
sys.modules['google'] = MagicMock()
sys.modules['google.oauth2'] = MagicMock()
sys.modules['google.oauth2.service_account'] = MagicMock()
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()

import json
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.test import TransactionTestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status
from cryptography.fernet import Fernet

from identity_access.models import SystemMailConfig, MailConfigAuditLog

User = get_user_model()
TEST_FERNET_KEY = Fernet.generate_key().decode()

@override_settings(
    TURNSTILE_SECRET_KEY='test-secret-key',
    DEFAULT_FROM_EMAIL='fallback@vninvest.vn'
)
@patch.dict(os.environ, {'MAIL_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
class OperatorMailConfigAPITests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        
        # Create users
        self.admin = User.objects.create_user(
            username='admin_staff',
            email='admin@vninvest.vn',
            password='Password123!',
            is_staff=True,
            is_superuser=True
        )
        
        self.regular_user = User.objects.create_user(
            username='regular_user',
            email='user@vninvest.vn',
            password='Password123!',
            is_staff=False
        )

    def test_permission_gates(self):
        """Operator Mail Config: Only staff/admin users are allowed to access endpoints."""
        # Regular user must be blocked with 403
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/core/v1/operator/mail-config/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin user must be allowed
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/core/v1/operator/mail-config/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_smtp_configuration(self):
        """Operator Mail Config: Create valid dynamic SMTP mail configuration."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/core/v1/operator/mail-config/', {
            'provider': 'smtp',
            'from_email': 'dynamic-smtp@vninvest.vn',
            'smtp_host': 'smtp.mailtrap.io',
            'smtp_port': 587,
            'smtp_username': 'trapuser',
            'smtp_password': 'trappassword',
            'smtp_use_tls': True,
            'smtp_use_ssl': False
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertIn('id', res_data['data'])

        # Verify DB records and encryption
        config = SystemMailConfig.objects.get(id=res_data['data']['id'])
        self.assertEqual(config.from_email, 'dynamic-smtp@vninvest.vn')
        self.assertEqual(config.get_smtp_password(), 'trappassword')
        self.assertEqual(config.last_modified_by, self.admin)

        # Verify Audit Log
        audit = MailConfigAuditLog.objects.filter(target_config_id=config.id, action='create').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.operator_user, self.admin)

    def test_create_gmail_dwd_configuration(self):
        """Operator Mail Config: Create valid dynamic Gmail API DWD configuration."""
        self.client.force_authenticate(user=self.admin)
        sa_json = json.dumps({
            "type": "service_account",
            "project_id": "vninvest",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n",
            "client_email": "sa@vninvest.iam.gserviceaccount.com"
        })
        
        response = self.client.post('/api/core/v1/operator/mail-config/', {
            'provider': 'gmail_api',
            'from_email': 'notifications@vninvest.vn',
            'google_delegated_user_email': 'admin@vninvest.vn',
            'google_service_account_json': sa_json
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        config_id = response.json()['data']['id']
        
        config = SystemMailConfig.objects.get(id=config_id)
        self.assertEqual(config.provider, 'gmail_api')
        self.assertEqual(config.google_delegated_user_email, 'admin@vninvest.vn')
        self.assertEqual(config.get_google_service_account_json(), sa_json)

    def test_validation_errors(self):
        """Operator Mail Config: Improper fields must trigger validation error."""
        self.client.force_authenticate(user=self.admin)
        
        # Missing provider
        response = self.client.post('/api/core/v1/operator/mail-config/', {
            'from_email': 'notifications@vninvest.vn'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_and_update_configuration(self):
        """Operator Mail Config: Retrieve, update (PATCH), and check sensitive flags on config."""
        self.client.force_authenticate(user=self.admin)
        
        # Create config
        config = SystemMailConfig.objects.create(
            provider='smtp',
            from_email='smtp@vninvest.vn',
            smtp_host='smtp.mailtrap.io',
            smtp_port=587,
            smtp_username='user',
            last_modified_by=self.admin
        )
        config.set_smtp_password('password123')
        config.save()

        # GET detail
        response = self.client.get(f'/api/core/v1/operator/mail-config/{config.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertEqual(res_data['data']['from_email'], 'smtp@vninvest.vn')
        self.assertTrue(res_data['data']['smtp_password_configured'])
        self.assertFalse(res_data['data']['google_service_account_json_configured'])

        # PATCH update
        response = self.client.patch(f'/api/core/v1/operator/mail-config/{config.id}/', {
            'from_email': 'updated-smtp@vninvest.vn',
            'smtp_username': 'updateduser'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        updated_config = SystemMailConfig.objects.get(id=config.id)
        self.assertEqual(updated_config.from_email, 'updated-smtp@vninvest.vn')
        self.assertEqual(updated_config.smtp_username, 'updateduser')
        self.assertEqual(updated_config.get_smtp_password(), 'password123')  # Keep password

    def test_delete_active_config_blocked(self):
        """Operator Mail Config: Active configurations cannot be deleted."""
        self.client.force_authenticate(user=self.admin)
        
        config = SystemMailConfig.objects.create(
            provider='smtp',
            from_email='active@vninvest.vn',
            is_active=True
        )

        # Attempt to delete
        response = self.client.delete(f'/api/core/v1/operator/mail-config/{config.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(SystemMailConfig.objects.filter(id=config.id).exists())

        # Deactivate first
        config.is_active = False
        config.save()

        # Delete again
        response = self.client.delete(f'/api/core/v1/operator/mail-config/{config.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(SystemMailConfig.objects.filter(id=config.id).exists())

    def test_activate_config_and_concurrency_deactivation(self):
        """Operator Mail Config: Activating one config deactivates all other configs atomically."""
        self.client.force_authenticate(user=self.admin)
        
        config1 = SystemMailConfig.objects.create(
            provider='smtp',
            from_email='config1@vninvest.vn',
            is_active=True
        )
        config2 = SystemMailConfig.objects.create(
            provider='smtp',
            from_email='config2@vninvest.vn',
            is_active=False
        )

        self.assertTrue(config1.is_active)
        self.assertFalse(config2.is_active)

        # Activate config2
        response = self.client.post(f'/api/core/v1/operator/mail-config/{config2.id}/activate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        config1.refresh_from_db()
        config2.refresh_from_db()
        
        # Concurrency check
        self.assertFalse(config1.is_active)
        self.assertTrue(config2.is_active)

    @patch('identity_access.views_operator.send_mail')
    def test_test_connection_endpoint(self, mock_send_mail):
        """Operator Mail Config: Test mail transport verification (dry run sending)."""
        self.client.force_authenticate(user=self.admin)
        
        response = self.client.post('/api/core/v1/operator/mail-config/test/', {
            'provider': 'smtp',
            'from_email': 'test-sender@vninvest.vn',
            'test_email': 'recipient@vninvest.vn',
            'smtp_host': 'smtp.mailtrap.io',
            'smtp_port': 587,
            'smtp_username': 'user',
            'smtp_password': 'password'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send_mail.assert_called_once()
        call_kwargs = mock_send_mail.call_args[1]
        self.assertEqual(call_kwargs['from_email'], 'test-sender@vninvest.vn')
        self.assertEqual(call_kwargs['recipient_list'], ['recipient@vninvest.vn'])
