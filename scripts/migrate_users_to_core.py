#!/usr/bin/env python
"""
SFI-B2.6: Migrate users from legacy backend DB to core-api DB.

Usage:
    # Dry run (no writes):
    python scripts/migrate_users_to_core.py --dry-run

    # Live migration:
    python scripts/migrate_users_to_core.py

    # Migrate specific users by username:
    python scripts/migrate_users_to_core.py --usernames user1,user2

Environment variables required:
    LEGACY_DATABASE_URL   — postgres://user:pass@host:port/dbname (legacy)
    CORE_DATABASE_URL     — postgres://user:pass@host:port/dbname (core-api)

The script:
1. Connects to both DBs via psycopg2 (no Django ORM required).
2. Reads users from legacy auth_user table.
3. For each user: creates matching record in core DB auth_user table (password hash preserved).
4. Reports created / skipped (already exists) / errors.

Security constraints:
- NEVER logs passwords or hashed passwords.
- Uses parameterized queries only (no string interpolation).
- Reads credentials from env only (no hardcoded values).
"""

import argparse
import os
import sys
from datetime import datetime


def get_connection(url: str):
    """Parse DATABASE_URL and return a psycopg2 connection."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    # Basic URL parsing — avoids dependency on dj-database-url in migration context.
    # Format: postgres://user:pass@host:port/dbname
    url = url.strip()
    if url.startswith('postgres://') or url.startswith('postgresql://'):
        url = url.split('://', 1)[1]
    else:
        raise ValueError(f"Unsupported DATABASE_URL scheme: {url[:20]}...")

    # user:pass@host:port/dbname
    if '@' in url:
        credentials, hostpart = url.rsplit('@', 1)
    else:
        credentials = ''
        hostpart = url

    if ':' in credentials:
        db_user, db_pass = credentials.split(':', 1)
    else:
        db_user = credentials
        db_pass = ''

    if '/' in hostpart:
        host_port, dbname = hostpart.split('/', 1)
    else:
        host_port = hostpart
        dbname = ''

    if ':' in host_port:
        host, port_str = host_port.rsplit(':', 1)
        port = int(port_str)
    else:
        host = host_port
        port = 5432

    return psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=db_user,
        password=db_pass,
    )


def fetch_legacy_users(legacy_conn, usernames: list[str] | None) -> list[dict]:
    """Read users from legacy auth_user table."""
    with legacy_conn.cursor() as cur:
        if usernames:
            placeholders = ','.join(['%s'] * len(usernames))
            cur.execute(
                f'SELECT id, username, email, first_name, last_name, password, '  # noqa: S608
                f'is_active, is_staff, is_superuser, date_joined, last_login '
                f'FROM auth_user WHERE username IN ({placeholders})',
                usernames,
            )
        else:
            cur.execute(
                'SELECT id, username, email, first_name, last_name, password, '  # noqa: S608
                'is_active, is_staff, is_superuser, date_joined, last_login '
                'FROM auth_user ORDER BY id',
            )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def migrate_user(core_conn, user: dict, dry_run: bool) -> str:
    """
    Insert user into core DB if not already present (match by username).
    Returns: 'created' | 'skipped' | 'error:<msg>'
    """
    with core_conn.cursor() as cur:
        cur.execute('SELECT id FROM auth_user WHERE username = %s', (user['username'],))
        existing = cur.fetchone()
        if existing:
            return 'skipped'

        if dry_run:
            return 'would_create'

        try:
            cur.execute(
                'INSERT INTO auth_user '
                '(username, email, first_name, last_name, password, is_active, '
                'is_staff, is_superuser, date_joined, last_login) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                (
                    user['username'],
                    user['email'],
                    user['first_name'],
                    user['last_name'],
                    user['password'],  # hashed — never logged
                    user['is_active'],
                    user['is_staff'],
                    user['is_superuser'],
                    user['date_joined'] or datetime.utcnow(),
                    user['last_login'],
                ),
            )
            core_conn.commit()
            return 'created'
        except Exception as exc:  # noqa: BLE001
            core_conn.rollback()
            return f'error:{exc}'


def main() -> None:
    parser = argparse.ArgumentParser(description='Migrate legacy users → core-api DB')
    parser.add_argument('--dry-run', action='store_true', help='Preview only; no writes')
    parser.add_argument('--usernames', default='', help='Comma-separated usernames to migrate')
    args = parser.parse_args()

    legacy_url = os.environ.get('LEGACY_DATABASE_URL', '')
    core_url = os.environ.get('CORE_DATABASE_URL', '')

    if not legacy_url or not core_url:
        print('ERROR: LEGACY_DATABASE_URL and CORE_DATABASE_URL must be set.')
        sys.exit(1)

    usernames = [u.strip() for u in args.usernames.split(',') if u.strip()] or None

    print(f"Connecting to legacy DB: {legacy_url.split('@')[-1]}")
    legacy_conn = get_connection(legacy_url)

    print(f"Connecting to core DB:   {core_url.split('@')[-1]}")
    core_conn = get_connection(core_url)

    users = fetch_legacy_users(legacy_conn, usernames)
    print(f"Found {len(users)} user(s) in legacy DB.")

    if args.dry_run:
        print("DRY RUN mode — no writes will be made.")

    results: dict[str, int] = {'created': 0, 'skipped': 0, 'would_create': 0, 'error': 0}
    for user in users:
        outcome = migrate_user(core_conn, user, dry_run=args.dry_run)
        category = outcome if outcome in results else 'error'
        results[category] += 1
        status_label = outcome if outcome.startswith('error') else outcome.upper()
        print(f"  [{status_label}] {user['username']}")

    print("\nSummary:")
    for k, v in results.items():
        if v > 0:
            print(f"  {k}: {v}")

    legacy_conn.close()
    core_conn.close()
    print("Migration complete.")


if __name__ == '__main__':
    main()
