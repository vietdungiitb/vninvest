from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from portfolio.models import SeedExecutionLog
from portfolio.seed_governance import assert_demo_seed_allowed, runtime_environment_name


User = get_user_model()


class Command(BaseCommand):
    help = 'Run standardized seed profiles with production-safe guardrails.'

    SEED_VERSION = '2026.04.21'

    def add_arguments(self, parser):
        parser.add_argument(
            '--profile',
            choices=['reference', 'demo-smoke', 'demo-load'],
            required=True,
            help='reference=taxonomy only; demo-smoke=light demo user dataset; demo-load=large benchmark dataset.',
        )
        parser.add_argument('--reset', action='store_true', help='Pass reset flag to selected profile when supported.')
        parser.add_argument('--dry-run', action='store_true', help='Preview commands without executing writes.')
        parser.add_argument('--allow-production', action='store_true', help='Allow demo profile on production-like environment.')
        parser.add_argument('--username', default='testuser', help='Username for demo-smoke profile.')
        parser.add_argument('--password', default='Test@123456', help='Password for demo-smoke profile.')
        parser.add_argument('--actor-username', default='', help='Optional actor username for audit log.')

    def handle(self, *args, **options):
        profile = options['profile']
        reset = bool(options.get('reset'))
        dry_run = bool(options.get('dry_run'))
        allow_production = bool(options.get('allow_production'))
        username = str(options.get('username') or 'testuser').strip()
        password = str(options.get('password') or 'Test@123456').strip()
        actor_username = str(options.get('actor_username') or '').strip()

        if profile in {'demo-smoke', 'demo-load'}:
            assert_demo_seed_allowed(command_name='seed_environment', allow_production_flag=allow_production)

        command_plan = self._build_command_plan(
            profile=profile,
            reset=reset,
            username=username,
            password=password,
            allow_production=allow_production,
        )

        env_name = runtime_environment_name()
        self.stdout.write(
            f"[seed_environment] profile={profile} version={self.SEED_VERSION} env={env_name} dry_run={dry_run}"
        )

        for cmd in command_plan:
            self.stdout.write(f"  - {cmd}")

        actor = self._resolve_actor(actor_username)

        if dry_run:
            self._log_execution(
                command_name='seed_environment',
                profile=profile,
                status=SeedExecutionLog.StatusChoices.DRY_RUN,
                message='Dry-run only. No command executed.',
                actor=actor,
                options_payload={
                    'profile': profile,
                    'reset': reset,
                    'dry_run': True,
                    'commands': command_plan,
                },
            )
            self.stdout.write(self.style.WARNING('Dry-run complete.'))
            return

        try:
            for cmd in command_plan:
                call_command(*cmd)
        except Exception as exc:
            self._log_execution(
                command_name='seed_environment',
                profile=profile,
                status=SeedExecutionLog.StatusChoices.FAILED,
                message=str(exc),
                actor=actor,
                options_payload={
                    'profile': profile,
                    'reset': reset,
                    'dry_run': False,
                    'commands': command_plan,
                },
            )
            raise CommandError(f'Execution failed: {exc}') from exc

        self._log_execution(
            command_name='seed_environment',
            profile=profile,
            status=SeedExecutionLog.StatusChoices.SUCCESS,
            message='Completed successfully.',
            actor=actor,
            options_payload={
                'profile': profile,
                'reset': reset,
                'dry_run': False,
                'commands': command_plan,
            },
        )
        self.stdout.write(self.style.SUCCESS('Seed profile completed successfully.'))

    def _build_command_plan(self, *, profile: str, reset: bool, username: str, password: str, allow_production: bool):
        if profile == 'reference':
            return [
                ['seed_securities_groups', '--mode', 'all'],
            ]

        if profile == 'demo-smoke':
            cmd = ['seed_demo_data', '--username', username, '--password', password]
            if reset:
                cmd.append('--reset')
            if allow_production:
                cmd.append('--allow-production')
            return [cmd]

        cmd = ['seed_comprehensive_demo', '--random-seed', '20260421']
        if reset:
            cmd.append('--reset')
        if allow_production:
            cmd.append('--allow-production')
        return [cmd]

    def _resolve_actor(self, username: str):
        if not username:
            return None
        return User.objects.filter(username=username).first()

    def _log_execution(self, *, command_name: str, profile: str, status: str, message: str, actor, options_payload: dict):
        SeedExecutionLog.objects.create(
            command_name=command_name,
            seed_profile=profile,
            seed_version=self.SEED_VERSION,
            runtime_environment=runtime_environment_name(),
            options_json=options_payload,
            status=status,
            message=message,
            executed_by=actor,
        )
