from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from portfolio.models import Portfolio, SubAccount
from portfolio.starter_portfolio_service import (
    STARTER_PORTFOLIO_TEMPLATES,
    STARTER_SUBACCOUNT_TEMPLATES,
)


User = get_user_model()


class BackfillStarterPortfoliosCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='backfill_user',
            email='backfill_user@example.com',
            password='Test@123456',
        )

    def test_dry_run_does_not_create_data(self):
        out = StringIO()
        call_command('backfill_starter_portfolios', '--username', self.user.username, '--dry-run', stdout=out)

        self.assertIn('[DRY-RUN]', out.getvalue())
        self.assertEqual(Portfolio.objects.filter(user=self.user).count(), 0)
        self.assertEqual(SubAccount.objects.filter(portfolio__user=self.user).count(), 0)

    def test_backfill_username_creates_starter_data(self):
        out = StringIO()
        call_command('backfill_starter_portfolios', '--username', self.user.username, stdout=out)

        self.assertIn('[OK]', out.getvalue())
        self.assertEqual(
            Portfolio.objects.filter(user=self.user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES),
        )
        self.assertEqual(
            SubAccount.objects.filter(portfolio__user=self.user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )
