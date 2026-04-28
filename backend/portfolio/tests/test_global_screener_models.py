from django.contrib import admin
from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.admin import GlobalScreenerRuleAdmin, ScreenerScheduleConfigAdmin, UserAlertHistoryAdmin
from portfolio.models import GlobalScreenerRule, ScreenerScheduleConfig, UserAlertHistory


class GlobalScreenerModelTests(TestCase):
    def test_global_screener_rule_can_be_created(self):
        rule = GlobalScreenerRule.objects.create(
            name='Global RSI Filter',
            rules_json=[{'field': 'rsi_14', 'op': 'lt', 'value': 30}],
        )

        self.assertEqual(rule.name, 'Global RSI Filter')
        self.assertTrue(rule.is_active)
        self.assertIn('Global RSI Filter', str(rule))

    def test_screener_schedule_config_defaults_to_enabled(self):
        config = ScreenerScheduleConfig.objects.create()

        self.assertEqual(config.cron_expression, '*/5 * * * *')
        self.assertTrue(config.is_user_custom_screener_enabled)
        self.assertIn('Bật', str(config))

    def test_user_alert_history_repr_and_admin_registration(self):
        user = User.objects.create_user(username='alert-user', password='Test@123456')
        history = UserAlertHistory.objects.create(
            user=user,
            symbol='FPT',
            alert_type=UserAlertHistory.AlertTypeChoices.SCREENER,
            message='FPT vượt điều kiện screener',
        )

        self.assertEqual(history.symbol, 'FPT')
        self.assertIn('FPT', str(history))
        self.assertIsInstance(admin.site._registry[GlobalScreenerRule], GlobalScreenerRuleAdmin)
        self.assertIsInstance(admin.site._registry[ScreenerScheduleConfig], ScreenerScheduleConfigAdmin)
        self.assertIsInstance(admin.site._registry[UserAlertHistory], UserAlertHistoryAdmin)