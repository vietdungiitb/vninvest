"""
Tests for OpenCore trial/grace lifecycle transitions (Day 5, Sprint26).

Verifies that process_plan_lifecycle_transitions task correctly:
1. Transitions trial_active -> grace_active when trial_ends_at passes
2. Transitions grace_active -> expired (downgrades to free) when grace_ends_at passes
3. Updates UserConfig.plan to 'free' when grace expires
"""

from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from portfolio.models import UserConfig, UserPlanLifecycle
from portfolio.tasks import process_plan_lifecycle_transitions
from portfolio.permissions import resolve_user_entitlements

User = get_user_model()


class OpenCoreLifecycleTransitionTests(TestCase):
    """Test trial/grace lifecycle transitions."""

    def setUp(self):
        """Create test user and plan lifecycle."""
        self.user = User.objects.create_user(username='lifecycle-user', email='lc@test.com')
        self.user_config, _ = UserConfig.objects.get_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True},
        )
        now = timezone.now()
        self.lifecycle, _ = UserPlanLifecycle.objects.get_or_create(
            user=self.user,
            defaults={
                'trial_starts_at': now - timedelta(days=5),
                'trial_ends_at': now + timedelta(days=2),  # 2 days until trial ends
                'grace_ends_at': None,  # Grace not yet created
            },
        )

    def test_trial_active_returns_in_entitlements(self):
        """Verify trial_active state exposed via entitlements."""
        entitlements = resolve_user_entitlements(self.user)
        self.assertEqual(entitlements['trial_state'], 'trial_active')
        self.assertIsNotNone(entitlements['trial_ends_at'])
        self.assertIsNone(entitlements['grace_ends_at'])

    def test_transition_trial_to_grace(self):
        """Verify task transitions trial_active -> grace_active."""
        # Move trial_ends_at to past
        now = timezone.now()
        self.lifecycle.trial_ends_at = now - timedelta(hours=1)
        self.lifecycle.grace_ends_at = None  # Not yet created
        self.lifecycle.save()

        # Run task
        result = process_plan_lifecycle_transitions()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['trial_to_grace'], 1)

        # Verify grace_ends_at created
        self.lifecycle.refresh_from_db()
        self.assertIsNotNone(self.lifecycle.grace_ends_at)
        expected_grace_deadline = (now - timedelta(hours=1)) + timedelta(days=7)
        self.assertTrue(
            abs((self.lifecycle.grace_ends_at - expected_grace_deadline).total_seconds()) < 60
        )

    def test_grace_active_returns_in_entitlements(self):
        """Verify grace_active state exposed via entitlements."""
        now = timezone.now()
        self.lifecycle.trial_ends_at = now - timedelta(days=1)
        self.lifecycle.grace_ends_at = now + timedelta(days=5)  # Still in grace
        self.lifecycle.save()

        entitlements = resolve_user_entitlements(self.user)
        self.assertEqual(entitlements['trial_state'], 'grace_active')
        self.assertIsNotNone(entitlements['trial_ends_at'])
        self.assertIsNotNone(entitlements['grace_ends_at'])

    def test_transition_grace_to_expired(self):
        """Verify task transitions grace_active -> expired (downgrade to free)."""
        now = timezone.now()
        self.lifecycle.trial_ends_at = now - timedelta(days=2)
        self.lifecycle.grace_ends_at = now - timedelta(hours=1)  # Grace expired
        self.lifecycle.save()

        # Ensure user is on pro plan before transition
        self.user_config.plan = 'pro'
        self.user_config.save()

        # Run task
        result = process_plan_lifecycle_transitions()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['grace_expired'], 1)

        # Verify user downgraded to free
        self.user_config.refresh_from_db()
        self.assertEqual(self.user_config.plan, 'free')

    def test_expired_plan_returns_in_entitlements(self):
        """Verify expired state exposed and user shows as free after downgrade."""
        now = timezone.now()
        self.lifecycle.trial_ends_at = now - timedelta(days=2)
        self.lifecycle.grace_ends_at = now - timedelta(hours=1)
        self.lifecycle.save()

        self.user_config.plan = 'free'
        self.user_config.save()

        entitlements = resolve_user_entitlements(self.user)
        self.assertEqual(entitlements['trial_state'], 'expired')
        self.assertEqual(entitlements['plan'], 'free')

    def test_no_double_transition_grace_to_grace(self):
        """Verify grace_ends_at not overwritten if already set."""
        now = timezone.now()
        original_grace = now + timedelta(days=5)
        self.lifecycle.trial_ends_at = now - timedelta(hours=1)
        self.lifecycle.grace_ends_at = original_grace
        self.lifecycle.save()

        # Run task
        result = process_plan_lifecycle_transitions()
        # Should not transition again (grace already set)
        self.assertEqual(result['trial_to_grace'], 0)

        self.lifecycle.refresh_from_db()
        self.assertEqual(self.lifecycle.grace_ends_at, original_grace)

    def test_task_handles_missing_user_config(self):
        """Verify task gracefully handles user with no UserConfig."""
        # Create user with lifecycle but no config
        user2 = User.objects.create_user(username='no-config-user', email='nc@test.com')
        now = timezone.now()
        lifecycle = UserPlanLifecycle.objects.create(
            user=user2,
            trial_starts_at=now - timedelta(days=10),
            trial_ends_at=now - timedelta(days=3),
            grace_ends_at=now - timedelta(hours=1),
        )

        # Run task should not crash
        result = process_plan_lifecycle_transitions()
        self.assertEqual(result['status'], 'ok')
        # grace_expired might increment or not depending on logic, but no error

    def test_task_returns_error_count(self):
        """Verify task reports error count on failures."""
        result = process_plan_lifecycle_transitions()
        # Should have 'errors' key even if 0
        self.assertIn('errors', result)
