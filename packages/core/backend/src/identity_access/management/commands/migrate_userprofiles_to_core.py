"""
Management command: migrate_userprofiles_to_core

Reads legacy portfolio_userconfig (via legacy_readonly DB) and creates/updates
UserProfile records in the core DB.

Usage:
    python manage.py migrate_userprofiles_to_core --dry-run
    python manage.py migrate_userprofiles_to_core --execute [--batch-size 500]

DoD:
    - --dry-run logs what would be migrated without writing anything
    - --execute performs upsert; reports rows_created, rows_updated, parity %
    - Parity >= 99% required before cutover

ISOLATION RULE: Reads from 'legacy_readonly' DB only. Writes to 'default' only.
"""
from __future__ import annotations

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction


class Command(BaseCommand):
    help = 'Migrate UserConfig → UserProfile from legacy DB to core DB.'

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument('--dry-run', action='store_true', help='Preview only; no writes.')
        group.add_argument('--execute', action='store_true', help='Perform migration.')
        parser.add_argument('--batch-size', type=int, default=500, help='Rows per batch (default 500).')

    def handle(self, *args, **options):
        dry_run: bool = options['dry_run']
        batch_size: int = options['batch_size']

        self.stdout.write(self.style.NOTICE('== migrate_userprofiles_to_core =='))
        self.stdout.write(f'Mode: {"DRY-RUN" if dry_run else "EXECUTE"}  |  batch_size={batch_size}')

        # Import late to avoid module-level issues if DB not ready
        from identity_access.models import CoreTenant, UserProfile  # noqa: PLC0415

        rows = self._fetch_legacy_userconfigs()
        total_legacy = len(rows)
        self.stdout.write(f'Legacy UserConfig rows fetched: {total_legacy}')

        if total_legacy == 0:
            self.stdout.write(self.style.WARNING('No legacy UserConfig rows found. Nothing to migrate.'))
            return

        created = 0
        updated = 0
        skipped = 0
        errors = 0

        for i in range(0, total_legacy, batch_size):
            batch = rows[i:i + batch_size]
            for row in batch:
                legacy_user_id = row['user_id']
                try:
                    user = User.objects.using('default').filter(id=legacy_user_id).first()
                    if user is None:
                        self.stdout.write(self.style.WARNING(
                            f'  [SKIP] legacy user_id={legacy_user_id} not found in core Django auth.'
                        ))
                        skipped += 1
                        continue

                    profile_data = {
                        'display_name': user.get_full_name() or user.username,
                        'language': row.get('language', 'vi') or 'vi',
                        'theme': row.get('theme', 'dark') or 'dark',
                        'whale_alert_threshold': row.get('whale_alert_threshold', 500),
                        'preferences': {
                            'plan': row.get('plan', 'free'),
                            'plan_source': row.get('plan_source', 'system_default'),
                        },
                        'legacy_user_id': legacy_user_id,
                    }

                    if dry_run:
                        action = 'CREATE' if not UserProfile.objects.filter(user=user).exists() else 'UPDATE'
                        self.stdout.write(f'  [DRY-RUN] would {action} UserProfile for user={user.username}')
                        continue

                    with transaction.atomic():
                        profile, was_created = UserProfile.objects.update_or_create(
                            user=user,
                            defaults=profile_data,
                        )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(self.style.ERROR(
                        f'  [ERROR] legacy user_id={legacy_user_id}: {exc}'
                    ))
                    errors += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f'DRY-RUN complete. Would process {total_legacy} rows '
                f'(skipped={skipped}, errors=0 estimated).'
            ))
            return

        total_processed = created + updated + skipped + errors
        migrated = created + updated
        parity = round(migrated / total_legacy * 100, 2) if total_legacy > 0 else 0.0

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== Migration Summary ==='))
        self.stdout.write(f'  Legacy rows     : {total_legacy}')
        self.stdout.write(f'  Created         : {created}')
        self.stdout.write(f'  Updated         : {updated}')
        self.stdout.write(f'  Skipped (no user): {skipped}')
        self.stdout.write(f'  Errors          : {errors}')
        self.stdout.write(f'  Parity          : {parity}%')

        if parity < 99.0:
            raise CommandError(
                f'Parity gate FAILED: {parity}% < 99%. Do NOT proceed with cutover until parity >= 99%.'
            )
        self.stdout.write(self.style.SUCCESS(f'Parity gate PASSED: {parity}% >= 99%'))

    def _fetch_legacy_userconfigs(self) -> list[dict]:
        """
        Read all rows from portfolio_userconfig via legacy_readonly connection.
        Returns list of dicts with keys: user_id, whale_alert_threshold, theme, language, plan, plan_source.
        """
        sql = """
            SELECT
                uc.user_id,
                uc.whale_alert_threshold,
                uc.theme,
                uc.language,
                uc.plan,
                uc.plan_source
            FROM portfolio_userconfig uc
            ORDER BY uc.user_id
        """
        with connections['legacy_readonly'].cursor() as cursor:
            cursor.execute(sql)
            cols = [col[0] for col in cursor.description]
            return [dict(zip(cols, row)) for row in cursor.fetchall()]
