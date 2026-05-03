from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import (
    AdvisoryAggregateAuditLog,
    CrawlAuditLog,
    CrawlJob,
    CrawlRun,
    SignalServiceRun,
    SystemAISettings,
    SystemAISettingsAuditLog,
    WhaleConfigAuditLog,
)


class OperatorJobsAuditApiTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='operator-jobs-admin',
            email='operator-jobs-admin@example.com',
            password='Admin@123456',
        )
        self.regular_user = User.objects.create_user(
            username='operator-jobs-user',
            email='operator-jobs-user@example.com',
            password='User@123456',
        )

        self.signal_run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.WHALE,
            run_type=SignalServiceRun.RunType.MANUAL,
            status=SignalServiceRun.StatusChoices.RUNNING,
            params_json={'symbol': 'VNM'},
            task_id='task-signal-001',
            progress_pct=42.5,
            processed_items=7,
            stored_items=3,
            failed_items=0,
            log='signal job is running',
            created_by=self.admin_user,
        )
        self.crawl_job, _ = CrawlJob.objects.get_or_create(
            service_code='ops_jobs_audit_crawl',
            defaults={
                'description': 'Operator jobs audit crawl',
                'is_active': True,
            },
        )
        self.crawl_run = CrawlRun.objects.create(
            job=self.crawl_job,
            trigger_type='manual',
            task_id='task-crawl-001',
            status='success',
            log='crawl completed successfully',
        )

        self.system_settings, _ = SystemAISettings.objects.get_or_create(
            name='ops-audit-settings',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
                'notes': 'operator audit fixture',
            },
        )
        self.system_settings.is_active = True
        self.system_settings.ai_provider = 'openclaw'
        self.system_settings.ai_model = ''
        self.system_settings.allow_env_fallback = True
        self.system_settings.notes = 'operator audit fixture'
        self.system_settings.save()
        self.system_audit = SystemAISettingsAuditLog.objects.create(
            settings=self.system_settings,
            actor=self.admin_user,
            action='update_settings',
            reason='Cập nhật cấu hình AI',
            before_json={'provider': 'openclaw'},
            after_json={'provider': 'openclaw', 'ready': True},
        )
        self.whale_audit = WhaleConfigAuditLog.objects.create(
            actor=self.admin_user,
            action='apply',
            reason='Áp dụng cấu hình whale',
            before_json={'version': 'v1'},
            after_json={'version': 'v2'},
            ticket_ref='OPS-04',
        )
        self.advisory_audit = AdvisoryAggregateAuditLog.objects.create(
            user=self.admin_user,
            symbol='VNM',
            before_state_json={'status': 'draft'},
            after_state_json={'status': 'published'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(self.admin_user.id),
            metadata_json={'source': 'operator-jobs-audit-test'},
        )
        self.crawl_audit = CrawlAuditLog.objects.create(
            run=self.crawl_run,
            event='run_started',
            payload={'service_code': self.crawl_job.service_code},
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_operator_jobs_requires_admin(self):
        self._authenticate(self.regular_user)

        response = self.client.get('/api/core/v1/operator/jobs/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_jobs_returns_job_rows(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/jobs/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'list')
        self.assertIn('summary_cards', data)
        self.assertGreaterEqual(len(data['summary_cards']), 4)
        kinds = {row['kind'] for row in data['data']}
        self.assertIn('signal_run', kinds)
        self.assertIn('crawl_run', kinds)
        signal_rows = [row for row in data['data'] if row['kind'] == 'signal_run']
        self.assertEqual(signal_rows[0]['request_id'], f'signal_run:{self.signal_run.id}')
        self.assertEqual(signal_rows[0]['service_domain'], self.signal_run.service_domain)
        self.assertEqual(signal_rows[0]['status_category'], 'running')
        crawl_rows = [row for row in data['data'] if row['kind'] == 'crawl_run']
        self.assertEqual(crawl_rows[0]['request_id'], f'crawl_run:{self.crawl_run.id}')
        self.assertEqual(crawl_rows[0]['service_code'], self.crawl_job.service_code)
        self.assertEqual(crawl_rows[0]['status_category'], 'completed')

    def test_operator_jobs_support_kind_filter(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/jobs/', {'kind': 'crawl_run'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['data'])
        self.assertTrue(all(row['kind'] == 'crawl_run' for row in data['data']))

    def test_operator_audit_requests_returns_audit_rows(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/audit/requests/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'list')
        self.assertIn('summary_cards', data)
        self.assertGreaterEqual(len(data['summary_cards']), 4)
        kinds = {row['kind'] for row in data['data']}
        self.assertIn('system_ai_settings', kinds)
        self.assertIn('whale_config', kinds)
        self.assertIn('advisory', kinds)
        self.assertIn('crawl_audit', kinds)

    def test_operator_audit_requests_support_kind_filter(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/audit/requests/', {'kind': 'advisory'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['data'])
        self.assertTrue(all(row['kind'] == 'advisory' for row in data['data']))

    def test_operator_audit_request_detail_returns_source_record(self):
        self._authenticate(self.admin_user)

        response = self.client.get(f'/api/core/v1/operator/audit/requests/advisory:{self.advisory_audit.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'operator_audit_request_detail')
        self.assertEqual(data['request_id'], f'advisory:{self.advisory_audit.id}')
        self.assertEqual(data['request']['kind'], 'advisory')
        self.assertEqual(data['request']['symbol'], 'VNM')
        self.assertIn('metadata_json', data['source_record'])
        self.assertEqual(data['source_record']['metadata_json']['source'], 'operator-jobs-audit-test')
