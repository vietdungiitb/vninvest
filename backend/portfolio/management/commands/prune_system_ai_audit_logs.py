from django.core.management.base import BaseCommand
from django.utils import timezone

from portfolio.models import SystemAISettingsAuditLog


class Command(BaseCommand):
    help = 'Prune old System AI audit logs based on retention days.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=180,
            help='Keep logs in the last N days (default: 180).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show the number of rows to delete without deleting.',
        )

    def handle(self, *args, **options):
        days = max(int(options.get('days') or 0), 1)
        dry_run = bool(options.get('dry_run'))

        cutoff = timezone.now() - timezone.timedelta(days=days)
        target_qs = SystemAISettingsAuditLog.objects.filter(created_at__lt=cutoff)
        target_count = target_qs.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'[DRY-RUN] prune_system_ai_audit_logs days={days} cutoff={cutoff.isoformat()} rows={target_count}'
                )
            )
            return

        deleted_count, _ = target_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f'prune_system_ai_audit_logs completed days={days} cutoff={cutoff.isoformat()} deleted={deleted_count}'
            )
        )
