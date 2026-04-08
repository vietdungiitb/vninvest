from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from portfolio.models import OnboardingPlanPolicy, PlanAssignmentLog, UserConfig
from portfolio.onboarding_trial_service import (
    apply_onboarding_trial_for_new_user,
    process_expired_onboarding_trials,
)
from portfolio.tasks import process_expired_onboarding_trials_task

User = get_user_model()


class OnboardingTrialServiceTests(TestCase):
    def setUp(self):
        self.policy = OnboardingPlanPolicy.objects.create(
            is_active=True,
            trial_plan=UserConfig.PlanChoices.PRO,
            trial_duration_days=7,
            fallback_plan=UserConfig.PlanChoices.BASIC,
        )

    def test_apply_onboarding_trial_for_new_user_sets_plan_and_log(self):
        user = User.objects.create_user(
            username='trial-user-01',
            email='trial-user-01@example.com',
            password='Test@123456',
        )

        result = apply_onboarding_trial_for_new_user(user=user, signup_method='email_password')

        self.assertTrue(result.applied)
        self.assertEqual(result.reason, 'trial_applied')
        self.assertEqual(result.plan, UserConfig.PlanChoices.PRO)

        cfg = user.user_config
        cfg.refresh_from_db()
        self.assertEqual(cfg.plan, UserConfig.PlanChoices.PRO)
        self.assertEqual(cfg.plan_source, UserConfig.PlanSourceChoices.ONBOARDING_TRIAL)
        self.assertIsNotNone(cfg.plan_expires_at)
        self.assertIsNotNone(cfg.plan_assigned_at)

        log = PlanAssignmentLog.objects.filter(user=user).latest('created_at')
        self.assertEqual(log.reason, PlanAssignmentLog.ReasonChoices.SIGNUP_TRIAL)
        self.assertEqual(log.new_plan, UserConfig.PlanChoices.PRO)
        self.assertEqual(log.actor_type, PlanAssignmentLog.ActorTypeChoices.SYSTEM)

    def test_process_expired_onboarding_trials_downgrades_eligible_users(self):
        user = User.objects.create_user(
            username='trial-user-expire',
            email='trial-user-expire@example.com',
            password='Test@123456',
        )
        cfg, _ = UserConfig.objects.get_or_create(user=user)
        cfg.plan = UserConfig.PlanChoices.PRO
        cfg.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
        cfg.plan_expires_at = timezone.now() - timedelta(minutes=5)
        cfg.auto_downgrade_enabled = True
        cfg.plan_locked_by_admin = False
        cfg.save()

        result = process_expired_onboarding_trials(batch_size=100)

        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['downgraded'], 1)

        cfg.refresh_from_db()
        self.assertEqual(cfg.plan, UserConfig.PlanChoices.BASIC)
        self.assertEqual(cfg.plan_source, UserConfig.PlanSourceChoices.SYSTEM_DEFAULT)
        self.assertIsNone(cfg.plan_expires_at)
        self.assertIsNotNone(cfg.downgraded_at)

        expire_log = PlanAssignmentLog.objects.filter(
            user=user,
            reason=PlanAssignmentLog.ReasonChoices.TRIAL_EXPIRED,
        ).latest('created_at')
        self.assertEqual(expire_log.new_plan, UserConfig.PlanChoices.BASIC)

    def test_process_expired_onboarding_trials_respects_lock_and_auto_downgrade(self):
        user_locked = User.objects.create_user(
            username='trial-user-locked',
            email='trial-user-locked@example.com',
            password='Test@123456',
        )
        cfg_locked, _ = UserConfig.objects.get_or_create(user=user_locked)
        cfg_locked.plan = UserConfig.PlanChoices.PRO
        cfg_locked.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
        cfg_locked.plan_expires_at = timezone.now() - timedelta(hours=1)
        cfg_locked.plan_locked_by_admin = True
        cfg_locked.auto_downgrade_enabled = True
        cfg_locked.save()

        user_disabled = User.objects.create_user(
            username='trial-user-disabled',
            email='trial-user-disabled@example.com',
            password='Test@123456',
        )
        cfg_disabled, _ = UserConfig.objects.get_or_create(user=user_disabled)
        cfg_disabled.plan = UserConfig.PlanChoices.PRO
        cfg_disabled.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
        cfg_disabled.plan_expires_at = timezone.now() - timedelta(hours=1)
        cfg_disabled.plan_locked_by_admin = False
        cfg_disabled.auto_downgrade_enabled = False
        cfg_disabled.save()

        result = process_expired_onboarding_trials(batch_size=100)

        self.assertEqual(result['processed'], 0)
        self.assertEqual(result['downgraded'], 0)
        self.assertEqual(result['skipped'], 0)

        cfg_locked.refresh_from_db()
        cfg_disabled.refresh_from_db()
        self.assertEqual(cfg_locked.plan, UserConfig.PlanChoices.PRO)
        self.assertEqual(cfg_disabled.plan, UserConfig.PlanChoices.PRO)

    def test_process_expired_onboarding_trials_task_wraps_service_result(self):
        user = User.objects.create_user(
            username='trial-task-user',
            email='trial-task-user@example.com',
            password='Test@123456',
        )
        cfg, _ = UserConfig.objects.get_or_create(user=user)
        cfg.plan = UserConfig.PlanChoices.PRO
        cfg.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
        cfg.plan_expires_at = timezone.now() - timedelta(minutes=1)
        cfg.save()

        result = process_expired_onboarding_trials_task(batch_size=50)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['downgraded'], 1)

    def test_process_expired_onboarding_trials_is_idempotent(self):
        user = User.objects.create_user(
            username='trial-idempotent-user',
            email='trial-idempotent-user@example.com',
            password='Test@123456',
        )
        cfg, _ = UserConfig.objects.get_or_create(user=user)
        cfg.plan = UserConfig.PlanChoices.PRO
        cfg.plan_source = UserConfig.PlanSourceChoices.ONBOARDING_TRIAL
        cfg.plan_expires_at = timezone.now() - timedelta(minutes=3)
        cfg.auto_downgrade_enabled = True
        cfg.plan_locked_by_admin = False
        cfg.save()

        first = process_expired_onboarding_trials(batch_size=100)
        second = process_expired_onboarding_trials(batch_size=100)

        self.assertEqual(first['downgraded'], 1)
        self.assertEqual(second['downgraded'], 0)

        trial_expired_logs = PlanAssignmentLog.objects.filter(
            user=user,
            reason=PlanAssignmentLog.ReasonChoices.TRIAL_EXPIRED,
        )
        self.assertEqual(trial_expired_logs.count(), 1)
