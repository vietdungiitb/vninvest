from unittest.mock import patch
from datetime import timedelta

from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.messages import get_messages
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.core.exceptions import ValidationError
from django.test import RequestFactory, TestCase
from django.utils import timezone

from portfolio.admin import (
    WhaleAdvisoryAdmin,
    WhaleConfigApprovalAdmin,
    WhaleConfigDraftAdmin,
    WhaleConfigRolloutAdmin,
    WhaleConfigVersionAdmin,
)
from portfolio.models import (
    IntradayTick,
    WhaleAdvisory,
    WhaleConfigApproval,
    WhaleConfigAuditLog,
    WhaleConfigDraft,
    WhaleConfigRollout,
    StockProfile,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
)
from portfolio.services import (
    auto_revert_whale_config_rollout,
    activate_due_scheduled_whale_config_rollouts,
    build_whale_rollout_anomaly_snapshot,
    build_rollout_propagation_snapshot,
    build_whale_config_diff_preview,
    initialize_whale_config_rollout,
    monitor_whale_config_rollout_anomalies,
    record_whale_config_worker_ack,
    resolve_whale_runtime_config,
    refresh_rollout_propagation_status,
    symbol_matches_canary_scope,
    validate_whale_config_guardrails,
)


class WhaleMissionControlModelTests(TestCase):
    def setUp(self):
        self.analyst = User.objects.create_user(username='analyst_mc', password='Test@123456')
        self.supervisor = User.objects.create_user(username='supervisor_mc', password='Test@123456', is_staff=True)
        self.factory = RequestFactory()

    def _attach_messages(self, request):
        middleware = SessionMiddleware(lambda req: None)
        middleware.process_request(request)
        request.session.save()
        request._messages = FallbackStorage(request)
        return request

    def _message_texts(self, request):
        return [str(message) for message in get_messages(request)]

    def test_create_draft_and_version(self):
        draft = WhaleConfigDraft.objects.create(
            name='Draft A',
            config_json={'threshold': 1200, 'cooldown': 300},
            created_by=self.analyst,
        )
        self.assertEqual(draft.status, WhaleConfigDraft.StatusChoices.DRAFT)

        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-001',
            config_json=draft.config_json,
            created_by=self.analyst,
            status=WhaleConfigVersion.StatusChoices.DRAFT,
        )
        draft.linked_version = version
        draft.save(update_fields=['linked_version', 'updated_at'])

        self.assertEqual(draft.linked_version_id, version.id)
        self.assertEqual(version.status, WhaleConfigVersion.StatusChoices.DRAFT)

    def test_maker_checker_block_same_creator_as_reviewer(self):
        draft = WhaleConfigDraft.objects.create(
            name='Draft MakerChecker',
            config_json={'threshold': 999},
            created_by=self.analyst,
        )
        approval = WhaleConfigApproval(
            draft=draft,
            reviewer=self.analyst,
            decision=WhaleConfigApproval.DecisionChoices.APPROVED,
            comment='self-approve should fail',
        )
        with self.assertRaises(ValidationError):
            approval.full_clean()

    def test_supervisor_can_approve(self):
        draft = WhaleConfigDraft.objects.create(
            name='Draft B',
            config_json={'threshold': 888},
            created_by=self.analyst,
        )
        approval = WhaleConfigApproval.objects.create(
            draft=draft,
            reviewer=self.supervisor,
            decision=WhaleConfigApproval.DecisionChoices.APPROVED,
            comment='approved by supervisor',
        )
        self.assertEqual(approval.reviewer_id, self.supervisor.id)

    def test_rollout_worker_ack_and_audit_log(self):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-002',
            config_json={'threshold': 1500},
            created_by=self.analyst,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        rollout = WhaleConfigRollout.objects.create(
            version=version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            initiated_by=self.supervisor,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
        )
        ack = WhaleConfigWorkerAck.objects.create(
            rollout=rollout,
            worker_name='worker-1',
            worker_version=version.version_code,
            acked=True,
        )
        self.assertTrue(ack.acked)

        log = WhaleConfigAuditLog.objects.create(
            actor=self.supervisor,
            action='apply',
            version=version,
            rollout=rollout,
            reason='apply approved config',
            before_json={'status': 'approved'},
            after_json={'status': 'active'},
        )
        self.assertEqual(log.action, 'apply')

    def test_admin_role_split_permissions(self):
        whale_advisory_admin = WhaleAdvisoryAdmin(WhaleAdvisory, admin.site)
        draft_admin = WhaleConfigDraftAdmin(WhaleConfigDraft, admin.site)
        approval_admin = WhaleConfigApprovalAdmin(WhaleConfigApproval, admin.site)
        version_admin = WhaleConfigVersionAdmin(WhaleConfigVersion, admin.site)

        analyst_request = self.factory.get('/admin/')
        analyst_request.user = self.analyst
        supervisor_request = self.factory.get('/admin/')
        supervisor_request.user = self.supervisor

        self.assertTrue(whale_advisory_admin.has_view_permission(analyst_request))
        self.assertFalse(whale_advisory_admin.has_add_permission(analyst_request))
        self.assertTrue(draft_admin.has_add_permission(analyst_request))
        self.assertFalse(approval_admin.has_add_permission(analyst_request))
        self.assertFalse(version_admin.has_add_permission(analyst_request))

        self.assertTrue(whale_advisory_admin.has_view_permission(supervisor_request))
        self.assertTrue(draft_admin.has_add_permission(supervisor_request))
        self.assertTrue(approval_admin.has_add_permission(supervisor_request))
        self.assertTrue(version_admin.has_add_permission(supervisor_request))

    def test_whale_models_are_exposed_in_custom_admin_menu_groups(self):
        request = self.factory.get('/admin/')
        request.user = User.objects.create_superuser(
            username='root_mc',
            email='root@example.com',
            password='Test@123456',
        )

        app_list = admin.site.get_app_list(request)
        whale_group = next((app for app in app_list if app.get('app_label') == 'whale_alerts_mission_control'), None)

        self.assertIsNotNone(whale_group)
        model_names = {model.get('object_name') for model in whale_group.get('models', [])}
        self.assertIn('WhaleAdvisory', model_names)
        self.assertIn('WhaleConfigVersion', model_names)
        self.assertIn('WhaleConfigRollout', model_names)
        self.assertIn(WhaleAdvisory, admin.site._registry)

    def test_admin_draft_save_creates_audit_log(self):
        draft_admin = WhaleConfigDraftAdmin(WhaleConfigDraft, admin.site)
        request = self.factory.post('/admin/portfolio/whaleconfigdraft/add/')
        request.user = self.analyst

        draft = WhaleConfigDraft(
            name='Draft Audit',
            config_json={'threshold': 1201},
            reason='create from admin',
            created_by=self.analyst,
        )
        draft_admin.save_model(request, draft, form=None, change=False)

        self.assertTrue(
            WhaleConfigAuditLog.objects.filter(
                action='create_draft',
                draft=draft,
                actor=self.analyst,
            ).exists()
        )

    def test_admin_approval_by_supervisor_writes_audit(self):
        draft = WhaleConfigDraft.objects.create(
            name='Draft Submit',
            config_json={'threshold': 1111},
            created_by=self.analyst,
            status=WhaleConfigDraft.StatusChoices.SUBMITTED,
        )
        approval_admin = WhaleConfigApprovalAdmin(WhaleConfigApproval, admin.site)
        request = self.factory.post('/admin/portfolio/whaleconfigapproval/add/')
        request.user = self.supervisor

        approval = WhaleConfigApproval(
            draft=draft,
            reviewer=self.supervisor,
            decision=WhaleConfigApproval.DecisionChoices.APPROVED,
            comment='ship it',
        )
        approval_admin.save_model(request, approval, form=None, change=False)

        draft.refresh_from_db()
        self.assertEqual(draft.status, WhaleConfigDraft.StatusChoices.APPROVED)
        self.assertTrue(
            WhaleConfigAuditLog.objects.filter(
                action='approve',
                draft=draft,
                actor=self.supervisor,
            ).exists()
        )

    def test_guardrail_validator_rejects_dangerous_thresholds(self):
        result = validate_whale_config_guardrails(
            {
                'whale_threshold': 50,
                'shark_threshold': 60,
                'cooldown_seconds': 10,
                'rate_limit_per_minute': 1,
                'weights': {'size_impact': 0, 'aggression_bonus': 0, 'concentration_ratio': 0},
            }
        )

        self.assertGreaterEqual(len(result['errors']), 4)
        self.assertTrue(any('Whale threshold' in error for error in result['errors']))
        self.assertTrue(any('Shark threshold' in error for error in result['errors']))

    def test_initialize_rollout_creates_pending_worker_ack_records(self):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-propagation',
            config_json={'whale_threshold': 700},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )

        rollout, snapshot = initialize_whale_config_rollout(
            version,
            initiated_by=self.supervisor,
            worker_names=['worker-a', 'worker-b'],
        )

        self.assertEqual(rollout.status, WhaleConfigRollout.StatusChoices.RUNNING)
        self.assertEqual(rollout.worker_acks.count(), 2)
        self.assertEqual(snapshot['expected_count'], 2)
        self.assertEqual(snapshot['acked_count'], 0)
        self.assertEqual(snapshot['signal'], 'red')

    def test_record_worker_ack_marks_rollout_completed_when_all_workers_ack(self):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-green',
            config_json={'whale_threshold': 900},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        rollout, _snapshot = initialize_whale_config_rollout(
            version,
            initiated_by=self.supervisor,
            worker_names=['worker-a', 'worker-b'],
        )

        record_whale_config_worker_ack(
            rollout,
            worker_name='worker-a',
            worker_version=version.version_code,
            acked=True,
            details='loaded_ok',
        )
        record_whale_config_worker_ack(
            rollout,
            worker_name='worker-b',
            worker_version=version.version_code,
            acked=True,
            details='loaded_ok',
        )

        snapshot = refresh_rollout_propagation_status(rollout)
        rollout.refresh_from_db()

        self.assertEqual(rollout.status, WhaleConfigRollout.StatusChoices.COMPLETED)
        self.assertEqual(snapshot['signal'], 'green')
        self.assertEqual(snapshot['acked_count'], 2)

    def test_rollout_snapshot_marks_stale_worker_version_as_amber(self):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-stale',
            config_json={'whale_threshold': 950},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        rollout, _snapshot = initialize_whale_config_rollout(
            version,
            initiated_by=self.supervisor,
            worker_names=['worker-a'],
        )

        record_whale_config_worker_ack(
            rollout,
            worker_name='worker-a',
            worker_version='v-old',
            acked=True,
            details='stale_version',
        )
        snapshot = build_rollout_propagation_snapshot(rollout)

        self.assertEqual(snapshot['stale_count'], 1)
        self.assertEqual(snapshot['signal'], 'red')

    def test_canary_scope_matches_symbol_exchange_and_percentage(self):
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corp',
            industry='Technology',
            exchange='HOSE',
        )

        self.assertTrue(symbol_matches_canary_scope('FPT', {'symbols': ['FPT'], 'exchange': 'HOSE', 'percent': 100}))
        self.assertFalse(symbol_matches_canary_scope('FPT', {'symbols': ['MWG'], 'exchange': 'HOSE', 'percent': 100}))
        self.assertFalse(symbol_matches_canary_scope('FPT', {'symbols': ['FPT'], 'exchange': 'HNX', 'percent': 100}))

    @patch('portfolio.services.get_live_celery_worker_names')
    def test_activate_due_scheduled_rollout_marks_version_active(self, mock_workers):
        mock_workers.return_value = {'ok': True, 'workers': ['worker-scheduled'], 'detail': 'workers=1'}
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-scheduled',
            config_json={'whale_threshold': 820},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        rollout = WhaleConfigRollout.objects.create(
            version=version,
            mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            status=WhaleConfigRollout.StatusChoices.PENDING,
            initiated_by=self.supervisor,
            effective_from=timezone.now() - timedelta(minutes=1),
            note='scheduled_test',
        )

        activated = activate_due_scheduled_whale_config_rollouts()

        version.refresh_from_db()
        rollout.refresh_from_db()
        self.assertEqual(len(activated), 1)
        self.assertEqual(version.status, WhaleConfigVersion.StatusChoices.ACTIVE)
        self.assertEqual(rollout.status, WhaleConfigRollout.StatusChoices.RUNNING)
        self.assertEqual(rollout.worker_acks.count(), 1)

    def test_resolve_runtime_config_prefers_canary_and_auto_acks_worker(self):
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corp',
            industry='Technology',
            exchange='HOSE',
        )
        active_version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-base',
            config_json={'whale_threshold': 500},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
        )
        WhaleConfigRollout.objects.create(
            version=active_version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=self.supervisor,
            started_at=timezone.now(),
        )
        canary_version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-canary',
            config_json={'whale_threshold': 900, 'shark_threshold': 300},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        canary_rollout, _snapshot = initialize_whale_config_rollout(
            canary_version,
            initiated_by=self.supervisor,
            mode=WhaleConfigRollout.ModeChoices.CANARY,
            canary_scope_json={'symbols': ['FPT'], 'percent': 100},
            worker_names=['worker-canary'],
        )

        runtime_config = resolve_whale_runtime_config(symbol='FPT', worker_name='worker-canary', source='test_runtime')
        canary_rollout.refresh_from_db()

        self.assertEqual(runtime_config['version_code'], canary_version.version_code)
        self.assertEqual(runtime_config['mode'], WhaleConfigRollout.ModeChoices.CANARY)
        self.assertEqual(len(runtime_config['thresholds_vnd']), 2)
        ack = canary_rollout.worker_acks.get(worker_name='worker-canary')
        self.assertTrue(ack.acked)
        self.assertEqual(ack.worker_version, canary_version.version_code)

    def test_diff_preview_detects_threshold_and_weight_changes(self):
        diff_items = build_whale_config_diff_preview(
            {
                'whale_threshold': 500,
                'cooldown_seconds': 900,
                'weights': {'size_impact': 0.6, 'aggression_bonus': 0.15, 'concentration_ratio': 0.25},
            },
            {
                'whale_threshold': 700,
                'cooldown_seconds': 600,
                'weights': {'size_impact': 0.5, 'aggression_bonus': 0.2, 'concentration_ratio': 0.3},
            },
        )

        diff_keys = {item['key'] for item in diff_items}
        self.assertIn('whale_threshold_million', diff_keys)
        self.assertIn('cooldown_seconds', diff_keys)
        self.assertIn('weights', diff_keys)

    def test_anomaly_snapshot_detects_whale_tick_spike(self):
        observed_at = timezone.now()
        StockProfile.objects.create(
            symbol='VNM',
            company_name='Vinamilk',
            industry='Consumer',
            exchange='HOSE',
        )
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-anomaly',
            config_json={'whale_threshold': 500},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
        )
        rollout = WhaleConfigRollout.objects.create(
            version=version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=self.supervisor,
            started_at=observed_at - timedelta(minutes=2),
        )

        for offset_minutes in (1, 2, 3, 4, 5, 6):
            tick = IntradayTick.objects.create(
                symbol='VNM',
                trade_date=observed_at.date(),
                trade_time=(observed_at - timedelta(minutes=offset_minutes)).time(),
                price='100000',
                volume=10000,
                side=IntradayTick.Side.BUY,
                stream_id=f'spike-{offset_minutes}',
            )
            IntradayTick.objects.filter(pk=tick.pk).update(created_at=observed_at - timedelta(minutes=1))

        snapshot = build_whale_rollout_anomaly_snapshot(rollout, now=observed_at)

        self.assertFalse(snapshot['healthy'])
        self.assertTrue(snapshot['should_auto_revert'])
        self.assertIn('tick_notional_spike', snapshot['reason_codes'])
        self.assertGreaterEqual(snapshot['current_tick_count'], 3)

    @patch('portfolio.services.notify_whale_config_auto_revert')
    @patch('portfolio.services.get_live_celery_worker_names')
    def test_monitor_rollout_anomalies_auto_reverts_to_previous_version(self, mock_workers, mock_notify):
        observed_at = timezone.now()
        mock_workers.return_value = {'ok': True, 'workers': ['worker-rollback'], 'detail': 'workers=1'}
        mock_notify.return_value = {'sent': False, 'recipients': [], 'detail': 'suppressed_in_test'}
        StockProfile.objects.create(
            symbol='HPG',
            company_name='Hoa Phat',
            industry='Steel',
            exchange='HOSE',
        )
        fallback = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-safe',
            config_json={'whale_threshold': 800},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.ARCHIVED,
            approved_at=observed_at - timedelta(hours=2),
            activated_at=observed_at - timedelta(hours=2),
        )
        risky = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-risky',
            config_json={'whale_threshold': 500},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
            approved_at=observed_at - timedelta(minutes=10),
            activated_at=observed_at - timedelta(minutes=10),
        )
        rollout = WhaleConfigRollout.objects.create(
            version=risky,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=self.supervisor,
            started_at=observed_at - timedelta(minutes=3),
        )
        for offset_minutes in (1, 2, 3, 4, 5, 6):
            tick = IntradayTick.objects.create(
                symbol='HPG',
                trade_date=observed_at.date(),
                trade_time=(observed_at - timedelta(minutes=offset_minutes)).time(),
                price='100000',
                volume=12000,
                side=IntradayTick.Side.SELL,
                stream_id=f'hpg-{offset_minutes}',
            )
            IntradayTick.objects.filter(pk=tick.pk).update(created_at=observed_at - timedelta(minutes=1))
        advisory = WhaleAdvisory.objects.create(
            symbol='HPG',
            matched_value=1_200_000_000,
            side='SELL',
            threshold=500_000_000,
            ai_summary='spike',
            ai_detail='spike detail',
        )
        WhaleAdvisory.objects.filter(pk=advisory.pk).update(created_at=observed_at - timedelta(minutes=1))

        results = monitor_whale_config_rollout_anomalies(auto_revert=True)

        rollout.refresh_from_db()
        risky.refresh_from_db()
        fallback.refresh_from_db()
        self.assertTrue(any(item['rollout_id'] == rollout.id and item['auto_reverted'] for item in results))
        self.assertEqual(rollout.status, WhaleConfigRollout.StatusChoices.ROLLED_BACK)
        self.assertEqual(risky.status, WhaleConfigVersion.StatusChoices.ROLLED_BACK)
        self.assertEqual(fallback.status, WhaleConfigVersion.StatusChoices.ACTIVE)
        self.assertTrue(
            WhaleConfigAuditLog.objects.filter(
                action='rollback',
                version=risky,
                rollout=rollout,
                reason='auto_revert_from_anomaly_detection',
            ).exists()
        )

    @patch('portfolio.admin.build_whale_config_runtime_preview')
    def test_submit_selected_drafts_blocks_when_preview_has_blocking_issues(self, mock_preview):
        draft = WhaleConfigDraft.objects.create(
            name='Draft Invalid',
            config_json={'whale_threshold': 50},
            created_by=self.analyst,
            status=WhaleConfigDraft.StatusChoices.DRAFT,
        )
        draft_admin = WhaleConfigDraftAdmin(WhaleConfigDraft, admin.site)
        request = self._attach_messages(self.factory.post('/admin/portfolio/whaleconfigdraft/'))
        request.user = self.analyst
        mock_preview.return_value = {
            'diff_items': [{'key': 'whale_threshold_million', 'label': 'Whale threshold', 'old': '500', 'new': '50'}],
            'diff_lines': ['Whale threshold: 500 -> 50'],
            'warnings': [],
            'blocking_issues': ['Whale threshold phai >= 100 trieu VND, hien tai la 50.0.'],
            'dependency_summary': {'summary': 'data_provider=ok; redis=ok', 'blocking_issues': []},
        }

        draft_admin.submit_selected_drafts(request, WhaleConfigDraft.objects.filter(pk=draft.pk))

        draft.refresh_from_db()
        self.assertEqual(draft.status, WhaleConfigDraft.StatusChoices.DRAFT)
        self.assertTrue(any('Whale threshold phai >=' in text for text in self._message_texts(request)))

    @patch('portfolio.admin.build_whale_config_runtime_preview')
    def test_apply_active_version_blocks_when_dependencies_degraded(self, mock_preview):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-blocked',
            config_json={'whale_threshold': 700},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        version_admin = WhaleConfigVersionAdmin(WhaleConfigVersion, admin.site)
        request = self._attach_messages(self.factory.post('/admin/portfolio/whaleconfigversion/'))
        request.user = self.supervisor
        mock_preview.return_value = {
            'diff_items': [],
            'diff_lines': [],
            'warnings': [],
            'blocking_issues': ['Redis degraded: connection refused'],
            'dependency_summary': {'summary': 'data_provider=ok; redis=degraded', 'blocking_issues': ['Redis degraded: connection refused']},
        }

        version_admin.mark_as_active_version(request, WhaleConfigVersion.objects.filter(pk=version.pk))

        version.refresh_from_db()
        self.assertEqual(version.status, WhaleConfigVersion.StatusChoices.APPROVED)
        message_texts = self._message_texts(request)
        self.assertTrue(any('Dependency check' in text for text in message_texts))
        self.assertTrue(any('Apply bị chặn bởi integrity checks.' in text for text in message_texts))

    @patch('portfolio.admin.build_whale_config_runtime_preview')
    @patch('portfolio.admin.initialize_whale_config_rollout')
    def test_apply_active_version_shows_diff_preview_and_activates_target(self, mock_initialize_rollout, mock_preview):
        active_version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-active',
            config_json={'whale_threshold': 500, 'cooldown_seconds': 900},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
        )
        target = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-next',
            config_json={'whale_threshold': 750, 'cooldown_seconds': 600},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        version_admin = WhaleConfigVersionAdmin(WhaleConfigVersion, admin.site)
        request = self._attach_messages(self.factory.post('/admin/portfolio/whaleconfigversion/'))
        request.user = self.supervisor
        mock_rollout = WhaleConfigRollout.objects.create(
            version=target,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            initiated_by=self.supervisor,
            started_at=timezone.now(),
        )
        mock_preview.return_value = {
            'diff_items': [{'key': 'whale_threshold_million', 'label': 'Whale threshold', 'old': '500', 'new': '750'}],
            'diff_lines': ['Whale threshold: 500 -> 750'],
            'warnings': [],
            'blocking_issues': [],
            'dependency_summary': {
                'summary': 'data_provider=ok; redis=ok; channel_layer=ok; workers=ok',
                'blocking_issues': [],
                'checks': {'workers': {'ok': True, 'detail': 'workers=1'}},
            },
        }
        mock_initialize_rollout.return_value = (
            mock_rollout,
            {'signal': 'red', 'summary': '0/1 worker ACK', 'expected_count': 1, 'acked_count': 0},
        )

        version_admin.mark_as_active_version(request, WhaleConfigVersion.objects.filter(pk=target.pk))

        active_version.refresh_from_db()
        target.refresh_from_db()
        self.assertEqual(target.status, WhaleConfigVersion.StatusChoices.ACTIVE)
        self.assertEqual(active_version.status, WhaleConfigVersion.StatusChoices.ARCHIVED)
        message_texts = self._message_texts(request)
        self.assertTrue(any('Diff preview:' in text for text in message_texts))
        self.assertTrue(any('Propagation:' in text for text in message_texts))

    @patch('portfolio.admin.build_whale_config_runtime_preview')
    def test_scheduled_rollout_allows_warning_without_blocking(self, mock_preview):
        version = WhaleConfigVersion.objects.create(
            version_code='v2026.04.03-rollout',
            config_json={'whale_threshold': 700},
            created_by=self.supervisor,
            status=WhaleConfigVersion.StatusChoices.APPROVED,
        )
        rollout_admin = WhaleConfigRolloutAdmin(WhaleConfigRollout, admin.site)
        request = self._attach_messages(self.factory.post('/admin/portfolio/whaleconfigrollout/'))
        request.user = self.supervisor
        mock_preview.return_value = {
            'diff_items': [],
            'diff_lines': [],
            'warnings': ['Celery workers degraded: no live worker pong'],
            'blocking_issues': [],
            'dependency_summary': {'summary': 'data_provider=ok; redis=ok; workers=degraded', 'blocking_issues': []},
        }
        rollout = WhaleConfigRollout(
            version=version,
            mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            effective_from=timezone.now(),
            initiated_by=self.supervisor,
        )

        rollout_admin.save_model(request, rollout, form=None, change=False)

        self.assertIsNotNone(rollout.pk)
        self.assertTrue(any('workers degraded' in text.lower() for text in self._message_texts(request)))
