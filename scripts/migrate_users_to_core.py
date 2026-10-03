#!/usr/bin/env python
"""
SFI-B2.5: User migration script — copies auth_user from legacy DB to core identity_access.

Usage:
    python scripts/migrate_users_to_core.py [--dry-run] [--legacy-db-url URL]

Idempotent: skips users already migrated (checked via UserProfile.legacy_user_id).
Set LEGACY_DATABASE_URL env var or pass --legacy-db-url argument.
"""

import argparse
import os
import sys
from datetime import datetime

import django


def setup_django():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'packages', 'core', 'backend', 'src'))
    django.setup()


def get_legacy_cursor(legacy_db_url=None):
    legacy_url = legacy_db_url or os.environ.get('LEGACY_DATABASE_URL', '')
    if not legacy_url:
        from django.conf import settings
        try:
            from django.db import connections
            return connections['legacy_readonly'].cursor()
        except Exception:
            print("ERROR: No LEGACY_DATABASE_URL set and no 'legacy_readonly' DB configured.")
            sys.exit(1)

    import dj_database_url
    from django.db import connection
    config = dj_database_url.parse(legacy_url)
    config['CONN_MAX_AGE'] = 0
    # Use Django's DB connection with the legacy URL
    from django.db.backends.utils import CursorWrapper
    connection.settings_dict.update(config)
    return connection.cursor()


def migrate_users(dry_run=False, legacy_db_url=None):
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from identity_access.models import UserProfile, CoreTenant

    User = get_user_model()

    # Check if legacy DB is available
    if not legacy_db_url and 'legacy_readonly' not in settings.DATABASES:
        legacy_db_url = os.environ.get('LEGACY_DATABASE_URL', '')
    if not legacy_db_url and 'legacy_readonly' not in settings.DATABASES:
        print("INFO: No legacy database configured. Skipping migration.")
        return

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    cursor = get_legacy_cursor(legacy_db_url)
    cursor.execute(
        "SELECT id, username, first_name, last_name, email, is_active, is_staff, is_superuser, date_joined, last_login "
        "FROM auth_user ORDER BY id"
    )

    rows = cursor.fetchall()
    print(f"Found {len(rows)} users in legacy auth_user table.")

    for row in rows:
        legacy_id, username, first_name, last_name, email, is_active, is_staff, is_superuser, date_joined, last_login = row

        # Check if already migrated
        existing_profile = UserProfile.objects.filter(legacy_user_id=legacy_id).first()
        if existing_profile:
            skipped_count += 1
            continue

        # Also check by email
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            # Already exists in core by email — link profile
            profile, created = UserProfile.objects.get_or_create(
                user=existing_user,
                defaults={
                    'display_name': f"{first_name} {last_name}".strip() or username,
                    'language': 'vi',
                    'theme': 'dark',
                    'legacy_user_id': legacy_id,
                }
            )
            if not created:
                profile.legacy_user_id = legacy_id
                profile.save(update_fields=['legacy_user_id'])
            skipped_count += 1
            continue

        if dry_run:
            print(f"  [DRY-RUN] Would migrate: {username} ({email})")
            migrated_count += 1
            continue

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name or '',
                    last_name=last_name or '',
                )
                user.is_active = is_active
                user.is_staff = is_staff
                user.is_superuser = is_superuser
                if date_joined:
                    user.date_joined = date_joined
                user.save()

                # Create tenant with code based on username
                tenant, _ = CoreTenant.objects.get_or_create(
                    owner_user=user,
                    defaults={
                        'tenant_code': f"tenant_{username}",
                        'display_name': f"{first_name} {last_name}'s Workspace".strip() or f"{username}'s Workspace",
                        'plan': CoreTenant.PlanChoices.FREE,
                        'status': CoreTenant.StatusChoices.ACTIVE,
                    }
                )

                UserProfile.objects.create(
                    user=user,
                    tenant=tenant,
                    display_name=f"{first_name} {last_name}".strip() or username,
                    language='vi',
                    theme='dark',
                    legacy_user_id=legacy_id,
                )
                migrated_count += 1
                print(f"  OK: {username} ({email}) -> user_id={user.id}")

        except Exception as e:
            error_count += 1
            print(f"  ERROR: {username} ({email}): {e}")

    cursor.close()
    action = "DRY-RUN: Would migrate" if dry_run else "Migrated"
    print(f"\nSummary: {action} {migrated_count} users, Skipped: {skipped_count}, Errors: {error_count}")


def main():
    parser = argparse.ArgumentParser(description="Migrate users from legacy to core DB")
    parser.add_argument('--dry-run', action='store_true', help="Preview only, no writes")
    parser.add_argument('--legacy-db-url', help="Legacy database URL (overrides LEGACY_DATABASE_URL env)")
    args = parser.parse_args()

    setup_django()
    migrate_users(dry_run=args.dry_run, legacy_db_url=args.legacy_db_url)


if __name__ == '__main__':
    main()
