from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from portfolio.models import UserConfig
from portfolio.starter_portfolio_service import provision_starter_portfolios_for_user


User = get_user_model()


class Command(BaseCommand):
    help = 'Backfill starter portfolios for existing users.'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='', help='Backfill a single username.')
        parser.add_argument('--all', action='store_true', help='Process all users.')
        parser.add_argument('--limit', type=int, default=200, help='Max users to process when not using --username.')
        parser.add_argument('--dry-run', action='store_true', help='Show who would be processed without writing data.')
        parser.add_argument('--force', action='store_true', help='Re-run seeding even if tracking says already seeded.')

    def handle(self, *args, **options):
        username = (options.get('username') or '').strip()
        include_all = bool(options.get('all'))
        dry_run = bool(options.get('dry_run'))
        force = bool(options.get('force'))
        limit = max(int(options.get('limit') or 0), 1)

        queryset = User.objects.order_by('id')
        if username:
            queryset = queryset.filter(username=username)
        elif not include_all:
            queryset = queryset.exclude(user_config__starter_portfolios_seeded=True)
            queryset = queryset[:limit]

        users = list(queryset)
        if not users:
            self.stdout.write(self.style.WARNING('No users matched the backfill criteria.'))
            return

        success_count = 0
        skip_count = 0
        fail_count = 0
        fail_users = []

        for user in users:
            if dry_run:
                self.stdout.write(f'[DRY-RUN] would process user={user.username}')
                continue

            try:
                result = provision_starter_portfolios_for_user(user=user, force=force)
                cfg, _ = UserConfig.objects.get_or_create(user=user)
                if result.reason == 'already_seeded' and cfg.starter_portfolios_seeded and not force:
                    skip_count += 1
                    self.stdout.write(f'[SKIP] user={user.username} reason=already_seeded')
                else:
                    success_count += 1
                    self.stdout.write(
                        f'[OK] user={user.username} created_portfolios={result.created_portfolios} '
                        f'created_subaccounts={result.created_subaccounts}'
                    )
            except Exception as exc:
                fail_count += 1
                fail_users.append(user.username)
                self.stderr.write(f'[FAIL] user={user.username} err={exc}')

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'DRY-RUN completed. users={len(users)}'))
            return

        self.stdout.write(
            self.style.SUCCESS(
                'Backfill completed: '
                f'success={success_count}, skipped={skip_count}, failed={fail_count}'
            )
        )
        if fail_users:
            self.stdout.write(f'Failed users: {", ".join(fail_users)}')
